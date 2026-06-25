import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import AdmZip, { IZipEntry } from 'adm-zip';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { MediaLibraryFolder } from './entities/MediaLibraryFolder';
import { MediaLibraryAsset } from './entities/MediaLibraryAsset';
import { adminUploadRoot, adminUploadPublicUrl } from '../../config/uploadPaths';

const UPLOAD_DIR = adminUploadRoot();

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

  async recordUploadedDiskFile(
    folderId: string,
    multerFile: Express.Multer.File
  ): Promise<MediaLibraryAsset> {
    const folder = await this.getFolder(folderId);
    if (!folder) throw new Error('Folder not found');
    const rel = path.join('media-library', folderId, multerFile.filename).replace(/\\/g, '/');
    const fileUrl = adminUploadPublicUrl(rel);
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

  private async findOrCreateGeneralUploadsFolder(): Promise<MediaLibraryFolder> {
    const fRepo = this.folderRepo();
    const existing = await fRepo.findOne({ where: { slug: 'general-uploads' } });
    if (existing) return existing;
    return this.createFolder('General Uploads', 'general', 'system', undefined);
  }

  /** Index a flat `/uploads/{filename}` admin form upload in the media library. */
  async registerFlatAdminUpload(file: Express.Multer.File): Promise<MediaLibraryAsset | null> {
    if (!file?.filename) return null;
    const folder = await this.findOrCreateGeneralUploadsFolder();
    const fileUrl = adminUploadPublicUrl(file.filename);
    const repo = this.assetRepo();
    const prior = await repo.findOne({ where: { fileUrl } });
    if (prior) return prior;
    const row = repo.create({
      id: randomUUID(),
      folderId: folder.id,
      originalName: file.originalname || file.filename,
      fileUrl,
      relativePath: file.filename,
      mime: file.mimetype || mimeFromName(file.originalname || file.filename),
      sizeBytes: String(file.size ?? 0),
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

  async ingestZipToFolder(folderId: string, zipDiskPath: string): Promise<{ created: number }> {
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
        fileUrl: adminUploadPublicUrl(rel),
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
}
