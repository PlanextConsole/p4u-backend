import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import AdmZip, { IZipEntry } from 'adm-zip';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { MediaLibraryFolder } from './entities/MediaLibraryFolder';
import { MediaLibraryAsset } from './entities/MediaLibraryAsset';
import { MediaLibraryB2Service, isB2Configured, publicFileUrlForKey } from './media-library-b2.service';

const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads');

function slugify(name: string): string {
  let s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (!s) s = 'folder';
  return s;
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name || 'file').replace(/[^\w.\-()+@ ]/g, '_');
  return base.slice(0, 200) || 'file';
}

function mimeFromName(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };
  return map[ext] || 'application/octet-stream';
}

export class MediaLibraryAdminService {
  private audit = new AuditService();
  private b2 = new MediaLibraryB2Service();

  private folderRepo() {
    return AppDataSource.getRepository(MediaLibraryFolder);
  }

  private assetRepo() {
    return AppDataSource.getRepository(MediaLibraryAsset);
  }

  async listFolders(opts: { kind?: string; q?: string }): Promise<(MediaLibraryFolder & { fileCount: number })[]> {
    const fRepo = this.folderRepo();
    const aRepo = this.assetRepo();
    const qb = fRepo.createQueryBuilder('f').orderBy('f.name', 'ASC');
    if (opts.kind && opts.kind !== 'all') {
      qb.andWhere('f.kind = :kind', { kind: opts.kind });
    }
    if (opts.q?.trim()) {
      qb.andWhere('f.name LIKE :q', { q: `%${opts.q.trim()}%` });
    }
    const folders = await qb.getMany();
    if (folders.length === 0) return [];
    const ids = folders.map(f => f.id);
    const counts = await aRepo
      .createQueryBuilder('a')
      .select('a.folder_id', 'folderId')
      .addSelect('COUNT(a.id)', 'cnt')
      .where('a.folder_id IN (:...ids)', { ids })
      .groupBy('a.folder_id')
      .getRawMany<{ folderId: string; cnt: string }>();
    const map = new Map(counts.map(r => [r.folderId, parseInt(r.cnt, 10)]));
    return folders.map(f => Object.assign(f, { fileCount: map.get(f.id) ?? 0 }));
  }

  async createFolder(name: string, kind: string, actorSub: string | undefined, ip: string | undefined): Promise<MediaLibraryFolder> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Folder name is required');
    const k = kind === 'kyc' ? 'kyc' : 'general';
    const fRepo = this.folderRepo();
    const base = slugify(trimmed);
    let slug = base;
    let n = 1;
    while (await fRepo.count({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }
    const row = fRepo.create({
      id: randomUUID(),
      name: trimmed,
      slug,
      kind: k,
    });
    await fRepo.save(row);
    await this.audit.log({
      actorSub: actorSub ?? 'unknown',
      action: 'CREATE',
      entityType: 'MediaLibraryFolder',
      entityId: row.id,
      metadata: { name: row.name, slug: row.slug, kind: row.kind },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async getFolder(id: string): Promise<MediaLibraryFolder | null> {
    return this.folderRepo().findOne({ where: { id } });
  }

  async listAssets(folderId: string, limit: number, offset: number): Promise<{ items: MediaLibraryAsset[]; total: number }> {
    const repo = this.assetRepo();
    const [items, total] = await repo.findAndCount({
      where: { folderId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async listMigrateCandidates(limit: number, offset: number): Promise<{ items: MediaLibraryAsset[]; total: number }> {
    const repo = this.assetRepo();
    const [items, total] = await repo.findAndCount({
      where: { storageKind: 'local' },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async recordUploadedDiskFile(
    folderId: string,
    multerFile: Express.Multer.File,
    baseUrl: string
  ): Promise<MediaLibraryAsset> {
    const folder = await this.getFolder(folderId);
    if (!folder) throw new Error('Folder not found');
    const rel = path.join('media-library', folderId, multerFile.filename).replace(/\\/g, '/');
    const fileUrl = `${baseUrl}/uploads/${rel}`;
    const repo = this.assetRepo();
    const row = repo.create({
      id: randomUUID(),
      folderId,
      originalName: multerFile.originalname,
      fileUrl,
      relativePath: rel,
      mime: multerFile.mimetype || mimeFromName(multerFile.originalname),
      sizeBytes: String(multerFile.size),
      storageKind: 'local',
      b2Key: null,
    });
    await repo.save(row);
    return row;
  }

  async deleteAsset(id: string, actorSub: string | undefined, ip: string | undefined): Promise<void> {
    const repo = this.assetRepo();
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Asset not found');
    if (row.storageKind === 'local' && row.relativePath) {
      const abs = path.join(UPLOAD_DIR, row.relativePath);
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        /* ignore */
      }
    }
    await repo.remove(row);
    await this.audit.log({
      actorSub: actorSub ?? 'unknown',
      action: 'DELETE',
      entityType: 'MediaLibraryAsset',
      entityId: id,
      metadata: { originalName: row.originalName },
      ipAddress: ip ?? null,
    });
  }

  async ingestZipToFolder(folderId: string, zipDiskPath: string, baseUrl: string): Promise<{ created: number }> {
    const folder = await this.getFolder(folderId);
    if (!folder) throw new Error('Folder not found');
    const destBase = path.join(UPLOAD_DIR, 'media-library', folderId);
    fs.mkdirSync(destBase, { recursive: true });
    const zip = new AdmZip(zipDiskPath);
    const entries = zip.getEntries().filter((e: IZipEntry) => !e.isDirectory && e.entryName && !e.entryName.endsWith('/'));
    let created = 0;
    const repo = this.assetRepo();
    const destResolved = path.resolve(destBase);
    for (const entry of entries) {
      const entryName = (entry.entryName || '').replace(/\\/g, '/');
      if (!entryName || entryName.includes('..')) continue;
      const safeInner = path.basename(entryName.split('/').pop() || 'file');
      if (!safeInner || safeInner === '.' || safeInner === '..') continue;
      const diskName = `${Date.now()}-${created}-${sanitizeFilename(safeInner)}`;
      const abs = path.join(destBase, diskName);
      const resolved = path.resolve(abs);
      if (!resolved.startsWith(destResolved)) continue;
      fs.writeFileSync(resolved, entry.getData());
      const stat = fs.statSync(resolved);
      const rel = path.join('media-library', folderId, diskName).replace(/\\/g, '/');
      const row = repo.create({
        id: randomUUID(),
        folderId,
        originalName: safeInner,
        fileUrl: `${baseUrl}/uploads/${rel}`,
        relativePath: rel,
        mime: mimeFromName(safeInner),
        sizeBytes: String(stat.size),
        storageKind: 'local',
        b2Key: null,
      });
      await repo.save(row);
      created++;
    }
    return { created };
  }

  async importB2Keys(keys: string[], folderId: string, baseUrl: string): Promise<{ imported: number }> {
    if (!isB2Configured()) throw new Error('B2 not configured');
    const folder = await this.getFolder(folderId);
    if (!folder) throw new Error('Folder not found');
    const destBase = path.join(UPLOAD_DIR, 'media-library', folderId);
    fs.mkdirSync(destBase, { recursive: true });
    let imported = 0;
    for (const key of keys) {
      if (!key || key.endsWith('/')) continue;
      const baseName = sanitizeFilename(path.basename(key));
      const diskName = `${Date.now()}-${imported}-${baseName}`;
      const abs = path.join(destBase, diskName);
      await this.b2.downloadObjectToFile(key, abs);
      const stat = fs.statSync(abs);
      const rel = path.join('media-library', folderId, diskName).replace(/\\/g, '/');
      const row = this.assetRepo().create({
        id: randomUUID(),
        folderId,
        originalName: baseName,
        fileUrl: `${baseUrl}/uploads/${rel}`,
        relativePath: rel,
        mime: mimeFromName(baseName),
        sizeBytes: String(stat.size),
        storageKind: 'local',
        b2Key: key,
      });
      await this.assetRepo().save(row);
      imported++;
    }
    return { imported };
  }

  async migrateAssetToB2(assetId: string): Promise<MediaLibraryAsset> {
    if (!isB2Configured()) throw new Error('B2 not configured');
    const pubBase = process.env.B2_PUBLIC_FILE_BASE?.trim();
    if (!pubBase) throw new Error('Set B2_PUBLIC_FILE_BASE to the public URL prefix for files in this bucket (e.g. https://f003.backblazeb2.com/file/your-bucket).');
    const repo = this.assetRepo();
    const row = await repo.findOne({ where: { id: assetId } });
    if (!row) throw new Error('Asset not found');
    if (row.storageKind === 'b2') return row;
    if (row.storageKind !== 'local' || !row.relativePath) throw new Error('Only local files can be migrated');
    const abs = path.join(UPLOAD_DIR, row.relativePath);
    if (!fs.existsSync(abs)) throw new Error('Local file missing on disk');
    const folder = await this.getFolder(row.folderId);
    if (!folder) throw new Error('Folder missing');
    const b2Key = `media-library/${folder.slug}/${row.id}-${sanitizeFilename(row.originalName)}`;
    await this.b2.uploadFileToKey(abs, b2Key, row.mime);
    const nextUrl = publicFileUrlForKey(b2Key);
    row.storageKind = 'b2';
    row.b2Key = b2Key;
    row.fileUrl = nextUrl || row.fileUrl;
    row.relativePath = `b2:${b2Key}`.slice(0, 512);
    await repo.save(row);
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
    return row;
  }

  browseB2(prefix: string) {
    return this.b2.browse(prefix);
  }

  isB2Ready(): boolean {
    return isB2Configured();
  }
}
