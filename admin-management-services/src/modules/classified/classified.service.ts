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
import { UpsertAvailableAreaDto } from './dto/upsert-available-area.dto';
import { UpsertAvailableCityDto } from './dto/upsert-available-city.dto';

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

  async listCities(purpose: string | undefined, limit: number, offset: number) {
    const result = await this.listPurpose<AvailableCity>(AppDataSource.getRepository(AvailableCity), purpose, limit, offset);
    if (!result.items.length) return result;
    const counts = await AppDataSource.getRepository(AvailableArea)
      .createQueryBuilder('area')
      .select('area.cityId', 'cityId')
      .addSelect('COUNT(area.id)', 'areaCount')
      .where('area.cityId IN (:...cityIds)', { cityIds: result.items.map((city) => city.id) })
      .groupBy('area.cityId')
      .getRawMany<{ cityId: string; areaCount: string }>();
    const countByCity = new Map(counts.map((row) => [row.cityId, Number(row.areaCount)]));
    return {
      ...result,
      items: result.items.map((city) => ({ ...city, areaCount: countByCity.get(city.id) ?? 0 })),
    };
  }

  async listAreas(purpose: string | undefined, limit: number, offset: number) {
    const result = await this.listPurpose<AvailableArea>(AppDataSource.getRepository(AvailableArea), purpose, limit, offset);
    const cityIds = [...new Set(result.items.map((area) => area.cityId).filter((id): id is string => Boolean(id)))];
    if (!cityIds.length) return { ...result, items: result.items.map((area) => ({ ...area, cityName: null })) };
    const cities = await AppDataSource.getRepository(AvailableCity)
      .createQueryBuilder('city')
      .where('city.id IN (:...cityIds)', { cityIds })
      .getMany();
    const cityById = new Map(cities.map((city) => [city.id, city.name]));
    return {
      ...result,
      items: result.items.map((area) => ({ ...area, cityName: area.cityId ? cityById.get(area.cityId) ?? null : null })),
    };
  }
  listClassifiedCategories(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedCategory>(AppDataSource.getRepository(ClassifiedCategory), purpose, limit, offset); }
  listClassifiedServices(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedService>(AppDataSource.getRepository(ClassifiedService), purpose, limit, offset); }
  listClassifiedVendors(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedVendor>(AppDataSource.getRepository(ClassifiedVendor), purpose, limit, offset); }
  listClassifiedProducts(purpose: string | undefined, limit: number, offset: number) { return this.listPurpose<ClassifiedProduct>(AppDataSource.getRepository(ClassifiedProduct), purpose, limit, offset); }

  async createCity(dto: UpsertAvailableCityDto, actorSub: string, ip: string | undefined): Promise<AvailableCity> {
    const repo = AppDataSource.getRepository(AvailableCity);
    const saved = await repo.save(repo.create({ name: dto.name!, stateName: dto.stateName?.trim() || null, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'AvailableCity', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }
  async updateCity(id: string, dto: UpsertAvailableCityDto, actorSub: string, ip: string | undefined): Promise<AvailableCity> {
    const repo = AppDataSource.getRepository(AvailableCity); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableCity not found');
    if (dto.name !== undefined) row.name = dto.name; if (dto.stateName !== undefined) row.stateName = dto.stateName?.trim() || null; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'AvailableCity', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return saved;
  }
  async deleteCity(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(AvailableCity); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableCity not found');
    const areaCount = await AppDataSource.getRepository(AvailableArea).count({ where: { cityId: id } });
    if (areaCount > 0) throw new Error(`Cannot delete city with ${areaCount} assigned areas`);
    await repo.remove(row); await this.audit.log({ actorSub, action: 'DELETE', entityType: 'AvailableCity', entityId: id, ipAddress: ip ?? null });
  }

  private async requireCity(cityId: string): Promise<AvailableCity> {
    const city = await AppDataSource.getRepository(AvailableCity).findOne({ where: { id: cityId } });
    if (!city) throw new Error('Selected city was not found');
    return city;
  }

  async createArea(dto: UpsertAvailableAreaDto, actorSub: string, ip: string | undefined): Promise<AvailableArea & { cityName: string }> {
    const repo = AppDataSource.getRepository(AvailableArea);
    const city = await this.requireCity(dto.cityId!);
    const saved = await repo.save(repo.create({ cityId: city.id, name: dto.name!.trim(), postalCode: dto.postalCode?.trim() || null, isActive: dto.isActive ?? true, metadata: dto.metadata ?? null }));
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'AvailableArea', entityId: saved.id, ipAddress: ip ?? null });
    return { ...saved, cityName: city.name };
  }
  async updateArea(id: string, dto: UpsertAvailableAreaDto, actorSub: string, ip: string | undefined): Promise<AvailableArea & { cityName: string | null }> {
    const repo = AppDataSource.getRepository(AvailableArea); const row = await repo.findOne({ where: { id } }); if (!row) throw new Error('AvailableArea not found');
    let cityName: string | null = null;
    if (dto.cityId !== undefined) { const city = await this.requireCity(dto.cityId); row.cityId = city.id; cityName = city.name; }
    else if (row.cityId) { cityName = (await this.requireCity(row.cityId)).name; }
    if (dto.name !== undefined) row.name = dto.name.trim(); if (dto.postalCode !== undefined) row.postalCode = dto.postalCode?.trim() || null; if (dto.isActive !== undefined) row.isActive = dto.isActive; if (dto.metadata !== undefined) row.metadata = dto.metadata;
    const saved = await repo.save(row); await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'AvailableArea', entityId: id, metadata: { changes: dto }, ipAddress: ip ?? null }); return { ...saved, cityName };
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
