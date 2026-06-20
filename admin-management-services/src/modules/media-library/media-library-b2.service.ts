import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  type _Object,
  type CommonPrefix,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { Readable } from 'stream';

function normalizeBrowsePrefix(prefix: string): string {
  const p = (prefix || '').trim().replace(/^\/+/, '');
  if (!p) return '';
  return p.endsWith('/') ? p : `${p}/`;
}

export function isB2Configured(): boolean {
  return !!(
    process.env.B2_APPLICATION_KEY_ID &&
    process.env.B2_APPLICATION_KEY &&
    process.env.B2_BUCKET_NAME &&
    process.env.B2_S3_ENDPOINT
  );
}

export function createB2S3Client(): S3Client {
  return new S3Client({
    region: process.env.B2_S3_REGION || 'us-west-004',
    endpoint: process.env.B2_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.B2_APPLICATION_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
    forcePathStyle: true,
  });
}

export function publicFileUrlForKey(key: string): string {
  const base = (process.env.B2_PUBLIC_FILE_BASE || '').replace(/\/+$/, '');
  if (!base) return '';
  const k = key.replace(/^\/+/, '');
  const pathPart = k.split('/').map(encodeURIComponent).join('/');
  return `${base}/${pathPart}`;
}

export class MediaLibraryB2Service {
  async browse(prefix: string): Promise<{
    prefixes: { name: string; fullPrefix: string }[];
    objects: { key: string; size: number; lastModified: string | null }[];
    currentPrefix: string;
  }> {
    if (!isB2Configured()) {
      throw new Error('Backblaze B2 is not configured. Set B2_S3_ENDPOINT, B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME (and optional B2_S3_REGION, B2_PUBLIC_FILE_BASE).');
    }
    const client = createB2S3Client();
    const bucket = process.env.B2_BUCKET_NAME!;
    const p = normalizeBrowsePrefix(prefix);

    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: p,
        Delimiter: '/',
        MaxKeys: 500,
      })
    );

    const prefixes: { name: string; fullPrefix: string }[] = [];
    for (const cp of (out.CommonPrefixes || []) as CommonPrefix[]) {
      const fp = cp.Prefix || '';
      const name = fp.replace(/\/+$/, '').split('/').filter(Boolean).pop() || fp;
      prefixes.push({ name, fullPrefix: fp });
    }

    const objects: { key: string; size: number; lastModified: string | null }[] = [];
    for (const obj of (out.Contents || []) as _Object[]) {
      const key = obj.Key || '';
      if (!key || key === p) continue;
      if (key.endsWith('/')) continue;
      objects.push({
        key,
        size: Number(obj.Size || 0),
        lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
      });
    }

    return { prefixes, objects, currentPrefix: p };
  }

  async downloadObjectToFile(key: string, destPath: string): Promise<void> {
    if (!isB2Configured()) throw new Error('B2 not configured');
    const client = createB2S3Client();
    const bucket = process.env.B2_BUCKET_NAME!;
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = res.Body;
    if (!body) throw new Error(`Empty body for ${key}`);
    const stream = body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await fs.writeFile(destPath, Buffer.concat(chunks));
  }

  async uploadFileToKey(localPath: string, key: string, contentType: string): Promise<void> {
    if (!isB2Configured()) throw new Error('B2 not configured');
    const buf = await fs.readFile(localPath);
    const client = createB2S3Client();
    const bucket = process.env.B2_BUCKET_NAME!;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: contentType || 'application/octet-stream',
      })
    );
  }
}
