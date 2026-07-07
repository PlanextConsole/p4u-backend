import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../config/database';
import { VendorMediaFolder } from '../entities/VendorMediaFolder';
import { VendorMediaAsset } from '../entities/VendorMediaAsset';

function assetKind(mime: string): 'image' | 'document' | 'other' {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf' || m.includes('document') || m.includes('sheet') || m === 'text/plain') return 'document';
  return 'other';
}

export class VendorMediaService {
  async listFolders(vendorId: string) {
    const items = await AppDataSource.getRepository(VendorMediaFolder).find({
      where: { vendorId },
      order: { createdAt: 'DESC' },
    });
    return { items };
  }

  async createFolder(vendorId: string, name: string): Promise<VendorMediaFolder> {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Folder name is required');
    const repo = AppDataSource.getRepository(VendorMediaFolder);
    const row = repo.create({ vendorId, name: trimmed.slice(0, 160) });
    return repo.save(row);
  }

  async getFolder(vendorId: string, folderId: string): Promise<VendorMediaFolder | null> {
    const row = await AppDataSource.getRepository(VendorMediaFolder).findOne({ where: { id: folderId } });
    if (!row || row.vendorId !== vendorId) return null;
    return row;
  }

  async listFolderAssets(vendorId: string, folderId: string) {
    const folder = await this.getFolder(vendorId, folderId);
    if (!folder) throw new Error('Folder not found');
    const items = await AppDataSource.getRepository(VendorMediaAsset).find({
      where: { vendorId, folderId },
      order: { createdAt: 'DESC' },
    });
    return { folder, items };
  }

  async searchAssets(
    vendorId: string,
    opts: { q?: string; type?: 'images' | 'documents' | 'all'; limit: number; offset: number },
  ) {
    const qb = AppDataSource.getRepository(VendorMediaAsset)
      .createQueryBuilder('a')
      .where('a.vendorId = :vendorId', { vendorId });

    const q = (opts.q || '').trim();
    if (q) qb.andWhere('a.originalName LIKE :q', { q: `%${q}%` });

    const type = (opts.type || 'all').toLowerCase();
    if (type === 'images') qb.andWhere('a.mimeType LIKE :img', { img: 'image/%' });
    else if (type === 'documents') qb.andWhere('(a.mimeType NOT LIKE :img OR a.mimeType IS NULL)', { img: 'image/%' });

    qb.orderBy('a.createdAt', 'DESC').take(opts.limit).skip(opts.offset);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: opts.limit, offset: opts.offset };
  }

  async createAssetFromUpload(
    vendorId: string,
    folderId: string | null,
    file: Express.Multer.File,
    publicUrl: string,
  ): Promise<VendorMediaAsset> {
    if (folderId) {
      const folder = await this.getFolder(vendorId, folderId);
      if (!folder) throw new Error('Folder not found');
    }
    const repo = AppDataSource.getRepository(VendorMediaAsset);
    const row = repo.create({
      vendorId,
      folderId,
      originalName: file.originalname || file.filename,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: String(file.size || 0),
      url: publicUrl,
    });
    return repo.save(row);
  }

  async moveAsset(vendorId: string, assetId: string, folderId: string): Promise<VendorMediaAsset> {
    const folder = await this.getFolder(vendorId, folderId);
    if (!folder) throw new Error('Folder not found');
    const repo = AppDataSource.getRepository(VendorMediaAsset);
    const row = await repo.findOne({ where: { id: assetId } });
    if (!row || row.vendorId !== vendorId) throw new Error('Asset not found');
    row.folderId = folderId;
    return repo.save(row);
  }

  /** Delete a folder together with all its assets (DB rows + local files). */
  async deleteFolder(vendorId: string, folderId: string): Promise<void> {
    const folder = await this.getFolder(vendorId, folderId);
    if (!folder) throw new Error('Folder not found');
    const assetRepo = AppDataSource.getRepository(VendorMediaAsset);
    const assets = await assetRepo.find({ where: { vendorId, folderId } });
    for (const asset of assets) {
      const rel = asset.url.replace(/^\/vendor-uploads\//, '');
      const diskPath = path.join(process.cwd(), 'uploads', rel);
      if (fs.existsSync(diskPath)) {
        try {
          fs.unlinkSync(diskPath);
        } catch {
          /* ignore disk cleanup errors */
        }
      }
    }
    if (assets.length) await assetRepo.remove(assets);
    await AppDataSource.getRepository(VendorMediaFolder).remove(folder);
  }

  async deleteAsset(vendorId: string, assetId: string): Promise<void> {
    const repo = AppDataSource.getRepository(VendorMediaAsset);
    const row = await repo.findOne({ where: { id: assetId } });
    if (!row || row.vendorId !== vendorId) throw new Error('Asset not found');

    const rel = row.url.replace(/^\/vendor-uploads\//, '');
    const diskPath = path.join(process.cwd(), 'uploads', rel);
    if (fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch {
        /* ignore disk cleanup errors */
      }
    }
    await repo.remove(row);
  }

  static kindOf(mime: string): 'image' | 'document' | 'other' {
    return assetKind(mime);
  }
}
