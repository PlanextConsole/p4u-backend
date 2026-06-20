import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { PosVendor } from './entities/PosVendor';
import { PosCategory } from './entities/PosCategory';
import { PosProduct } from './entities/PosProduct';
import { UpsertPosVendorDto } from './dto/upsert-pos-vendor.dto';
import { UpsertPosCategoryDto } from './dto/upsert-pos-category.dto';
import { UpsertPosProductDto } from './dto/upsert-pos-product.dto';

export class PosAdminService {
  private audit = new AuditService();

  async listVendors(limit: number, offset: number) {
    const repo = AppDataSource.getRepository(PosVendor);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }
  async createVendor(dto: UpsertPosVendorDto, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosVendor);
    const row = await repo.save(repo.create({ vendorId: dto.vendorId ?? null, name: dto.name ?? 'POS Vendor', isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'PosVendor', entityId: row.id, ipAddress: ip ?? null });
    return row;
  }
  async updateVendor(id: string, dto: UpsertPosVendorDto, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosVendor); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('PosVendor not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId; if (dto.name !== undefined) row.name = dto.name; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'PosVendor', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteVendor(id: string, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosVendor); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('PosVendor not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'PosVendor', entityId: id, ipAddress: ip ?? null });
  }

  async listProducts(limit: number, offset: number) {
    const repo = AppDataSource.getRepository(PosProduct);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }
  async createProduct(dto: UpsertPosProductDto, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosProduct);
    const row = await repo.save(repo.create({ vendorId: dto.vendorId ?? null, categoryId: dto.categoryId ?? null, name: dto.name ?? 'POS Product', price: dto.price ?? '0', isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'PosProduct', entityId: row.id, ipAddress: ip ?? null });
    return row;
  }
  async updateProduct(id: string, dto: UpsertPosProductDto, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosProduct); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('PosProduct not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId; if (dto.categoryId !== undefined) row.categoryId = dto.categoryId; if (dto.name !== undefined) row.name = dto.name; if (dto.price !== undefined) row.price = dto.price; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'PosProduct', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteProduct(id: string, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosProduct); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('PosProduct not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'PosProduct', entityId: id, ipAddress: ip ?? null });
  }

  async listCategories(limit: number, offset: number) {
    const repo = AppDataSource.getRepository(PosCategory);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }
  async createCategory(dto: UpsertPosCategoryDto, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosCategory);
    const row = await repo.save(repo.create({ name: dto.name ?? 'POS Category', isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'PosCategory', entityId: row.id, ipAddress: ip ?? null });
    return row;
  }
  async updateCategory(id: string, dto: UpsertPosCategoryDto, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosCategory); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('PosCategory not found');
    if (dto.name !== undefined) row.name = dto.name; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'PosCategory', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteCategory(id: string, actorSub: string, ip: string | undefined) {
    const repo = AppDataSource.getRepository(PosCategory); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('PosCategory not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'PosCategory', entityId: id, ipAddress: ip ?? null });
  }
}
