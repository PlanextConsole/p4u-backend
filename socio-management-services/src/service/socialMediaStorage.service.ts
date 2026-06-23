import fs from 'fs';
import path from 'path';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { SocialMedia } from '../entities/SocialMedia';
import { ensureSocioMediaDir, socioUploadRoot } from '../config/uploadPaths';

function extFromMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/gif') return '.gif';
  if (m === 'image/webp') return '.webp';
  if (m === 'video/mp4') return '.mp4';
  if (m === 'video/quicktime') return '.mov';
  if (m === 'video/webm') return '.webm';
  return '';
}

export function absolutePathForRow(row: Pick<SocialMedia, 'storagePath'>): string | null {
  if (!row.storagePath?.trim()) return null;
  const resolved = path.resolve(socioUploadRoot(), row.storagePath);
  const root = path.resolve(socioUploadRoot());
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

export function writeMediaToDisk(
  id: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): string {
  ensureSocioMediaDir();
  const fromName = path.extname(originalName || '');
  const ext = fromName || extFromMime(mimeType) || '.bin';
  const rel = path.join('media', `${id}${ext}`).replace(/\\/g, '/');
  const abs = path.join(socioUploadRoot(), rel);
  fs.writeFileSync(abs, buffer);
  return rel;
}

export function unlinkMediaFile(row: Pick<SocialMedia, 'storagePath'>): void {
  const abs = absolutePathForRow(row);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore */
  }
}

export async function deleteMediaByIds(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const repo = AppDataSource.getRepository(SocialMedia);
  const rows = await repo.find({ where: { id: In(ids) } });
  for (const row of rows) unlinkMediaFile(row);
  await repo.delete({ id: In(ids) });
}

/** One-time / startup migration: export legacy LONGBLOB rows to disk. */
export async function migrateBlobRowsToDisk(): Promise<number> {
  const repo = AppDataSource.getRepository(SocialMedia);
  const rows = await repo
    .createQueryBuilder('m')
    .where('m.data IS NOT NULL')
    .andWhere("(m.storage_path IS NULL OR m.storage_path = '')")
    .getMany();

  let migrated = 0;
  for (const row of rows) {
    if (!row.data?.length) continue;
    const rel = writeMediaToDisk(
      row.id,
      row.data,
      row.originalName || 'file',
      row.mimeType,
    );
    row.storagePath = rel;
    row.data = null;
    await repo.save(row);
    migrated++;
  }
  if (migrated > 0) {
    console.log(`Socio media: migrated ${migrated} blob row(s) to disk`);
  }
  return migrated;
}
