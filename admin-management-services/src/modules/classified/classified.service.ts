import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { AvailableCity } from './entities/AvailableCity';
import { AvailableArea } from './entities/AvailableArea';
import { ClassifiedCategory } from './entities/ClassifiedCategory';
import { ClassifiedService } from './entities/ClassifiedService';
import { ClassifiedVendor } from './entities/ClassifiedVendor';
import { ClassifiedProduct } from './entities/ClassifiedProduct';
import { UpsertNameActiveDto } from './dto/upsert-name-active.dto';
import { UpsertClassifiedProductDto } from './dto/upsert-classified-product.dto';

export class ClassifiedAdminService {
  private audit = new AuditService();

  private async listPurpose<E>(repo: any, purpose: string | undefined, limit: number, offset: number): Promise<{ items: E[]; total: number }> {
    const qb = repo.createQueryBuilder('x').orderBy('x.createdAt', 'DESC').offset(offset).limit(limit);
    if (purpose && purpose !== 'all') qb.andWhere('x.isActive = :a', { a: true });
    const items = (await qb.getMany()) as E[];
    const totalQb = repo.createQueryBuilder('x');
    if (purpose && purpose !== 'all') totalQb.where('x.isActive = :a', { a: true });
    const total = await totalQb.getCount();
    return { items, total };
  }

  listCities(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<AvailableCity>(AppDataSource.getRepository(AvailableCity), purpose, limit, offset); }
  listAreas(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<AvailableArea>(AppDataSource.getRepository(AvailableArea), purpose, limit, offset); }
  listClassifiedCategories(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedCategory>(AppDataSource.getRepository(ClassifiedCategory), purpose, limit, offset); }
  listClassifiedServices(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedService>(AppDataSource.getRepository(ClassifiedService), purpose, limit, offset); }
  listClassifiedVendors(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedVendor>(AppDataSource.getRepository(ClassifiedVendor), purpose, limit, offset); }
  listClassifiedProducts(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedProduct>(AppDataSource.getRepository(ClassifiedProduct), purpose, limit, offset); }

  async createCity(dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<AvailableCity> {
    const repo = AppDataSource.getRepository(AvailableCity);
    const saved = await repo.save(repo.create({ name: dto.name!, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'AvailableCity', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }
  async updateCity(id: string, dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<AvailableCity> {
    const repo = AppDataSource.getRepository(AvailableCity); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableCity not found');
    if (dto.name !== undefined) row.name = dto.name; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'AvailableCity', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteCity(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(AvailableCity); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableCity not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'AvailableCity', entityId: id, ipAddress: ip ?? null });
  }

  async createArea(dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<AvailableArea> {
    const repo = AppDataSource.getRepository(AvailableArea);
    const saved = await repo.save(repo.create({ name: dto.name!, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'AvailableArea', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }
  async updateArea(id: string, dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<AvailableArea> {
    const repo = AppDataSource.getRepository(AvailableArea); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableArea not found');
    if (dto.name !== undefined) row.name = dto.name; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'AvailableArea', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteArea(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(AvailableArea); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableArea not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'AvailableArea', entityId: id, ipAddress: ip ?? null });
  }

  async createClassifiedCategory(dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<ClassifiedCategory> {
    const repo = AppDataSource.getRepository(ClassifiedCategory);
    const saved = await repo.save(repo.create({ name: dto.name!, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'ClassifiedCategory', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }
  async updateClassifiedCategory(id: string, dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<ClassifiedCategory> {
    const repo = AppDataSource.getRepository(ClassifiedCategory); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('ClassifiedCategory not found');
    if (dto.name !== undefined) row.name = dto.name; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'ClassifiedCategory', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteClassifiedCategory(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(ClassifiedCategory); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('ClassifiedCategory not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'ClassifiedCategory', entityId: id, ipAddress: ip ?? null });
  }

  async createClassifiedService(dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<ClassifiedService> {
    const repo = AppDataSource.getRepository(ClassifiedService);
    const saved = await repo.save(repo.create({ name: dto.name!, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'ClassifiedService', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }
  async updateClassifiedService(id: string, dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<ClassifiedService> {
    const repo = AppDataSource.getRepository(ClassifiedService); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('ClassifiedService not found');
    if (dto.name !== undefined) row.name = dto.name; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'ClassifiedService', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteClassifiedService(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(ClassifiedService); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('ClassifiedService not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'ClassifiedService', entityId: id, ipAddress: ip ?? null });
  }

  async createClassifiedVendor(dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<ClassifiedVendor> {
    const repo = AppDataSource.getRepository(ClassifiedVendor);
    const saved = await repo.save(repo.create({ displayName: dto.name!, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'ClassifiedVendor', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }
  async updateClassifiedVendor(id: string, dto: UpsertNameActiveDto, actorSub: string, ip: string | undefined): Promise<ClassifiedVendor> {
    const repo = AppDataSource.getRepository(ClassifiedVendor);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('ClassifiedVendor not found');
    if (dto.name !== undefined) row.displayName = dto.name;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'ClassifiedVendor', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return saved;
  }
  deleteClassifiedVendor(id: string, actorSub: string, ip: string | undefined) {
    return (async () => {
      const repo = AppDataSource.getRepository(ClassifiedVendor); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('ClassifiedVendor not found');
      await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'ClassifiedVendor', entityId: id, ipAddress: ip ?? null });
    })();
  }

  async createClassifiedProduct(dto: UpsertClassifiedProductDto, actorSub: string, ip: string | undefined): Promise<ClassifiedProduct> {
    const repo = AppDataSource.getRepository(ClassifiedProduct);
    const row = repo.create({
      vendorId: dto.vendorId ?? null,
      categoryId: dto.categoryId ?? null,
      serviceId: dto.serviceId ?? null,
      name: dto.name ?? 'Untitled',
      description: dto.description ?? null,
      price: dto.price ?? '0',
      imageUrls: dto.imageUrls ?? null,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'ClassifiedProduct', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }

  async updateClassifiedProduct(id: string, dto: UpsertClassifiedProductDto, actorSub: string, ip: string | undefined): Promise<ClassifiedProduct> {
    const repo = AppDataSource.getRepository(ClassifiedProduct);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('ClassifiedProduct not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.categoryId !== undefined) row.categoryId = dto.categoryId;
    if (dto.serviceId !== undefined) row.serviceId = dto.serviceId;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.price !== undefined) row.price = dto.price;
    if (dto.imageUrls !== undefined) row.imageUrls = dto.imageUrls;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'ClassifiedProduct', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return saved;
  }
  async deleteClassifiedProduct(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(ClassifiedProduct); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('ClassifiedProduct not found');
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'ClassifiedProduct', entityId: id, ipAddress: ip ?? null });
  }

  async uploadClassifiedProductImages(id: string, imageUrls: string[], actorSub: string, ip: string | undefined): Promise<ClassifiedProduct> {
    const row = await this.updateClassifiedProduct(id, { imageUrls }, actorSub, ip);
    return row;
  }
}
