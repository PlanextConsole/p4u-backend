import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Product } from '../products/entities/Product';
import { ProductCategory } from './entities/ProductCategory';
import { ProductSubcategory } from './entities/ProductSubcategory';
import { ServiceCategory } from './entities/ServiceCategory';
import { CatalogServiceItem } from './entities/CatalogServiceItem';
import { VendorService as CatalogVendorServiceLink } from './entities/VendorService';
import { Vendor } from '../vendors/entities/Vendor';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateCatalogServiceDto } from './dto/create-catalog-service.dto';
import { UpdateCatalogServiceDto } from './dto/update-catalog-service.dto';
import { CreateVendorServiceDto } from './dto/create-vendor-service.dto';
import { UpdateVendorServiceDto } from './dto/update-vendor-service.dto';

export class CatalogAdminService {
  private audit = new AuditService();

  /**
   * Emergency / priceType / duration are stored in JSON `metadata` so MySQL does not need
   * extra columns (avoids "Unknown column ... in field list" when schema was not migrated).
   * API responses still expose them at the top level like regular columns.
   */
  private enrichServiceRow(row: CatalogServiceItem): Record<string, unknown> {
    const m = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
    return {
      ...row,
      categoryId: row.serviceCategoryId,
      emergency: typeof m.emergency === 'boolean' ? m.emergency : false,
      priceType: typeof m.priceType === 'string' ? m.priceType : null,
      duration: typeof m.duration === 'string' ? m.duration : null,
    };
  }

  // ─── Product categories (shop roots) ───
  async listProductCategories(includeInactive: boolean): Promise<ProductCategory[]> {
    const repo = AppDataSource.getRepository(ProductCategory);
    const qb = repo.createQueryBuilder('c').orderBy('c.sortOrder', 'ASC').addOrderBy('c.name', 'ASC');
    if (!includeInactive) qb.andWhere('c.isActive = :a', { a: true });
    return qb.getMany();
  }

  async getProductCategory(id: string): Promise<ProductCategory | null> {
    return AppDataSource.getRepository(ProductCategory).findOne({ where: { id } });
  }

  async createProductCategory(dto: CreateCategoryDto, actorSub: string, ip: string | undefined): Promise<ProductCategory> {
    const repo = AppDataSource.getRepository(ProductCategory);
    const row = repo.create({
      name: dto.name,
      availability: dto.availability ?? false,
      emergency: dto.emergency ?? false,
      trending: dto.trending ?? false,
      description: dto.description ?? null,
      slug: dto.slug ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      bannerUrls: dto.bannerUrls ?? null,
      iconUrl: dto.iconUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      commissionOverridePercent: dto.commissionOverridePercent ?? null,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'ProductCategory',
      entityId: row.id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateProductCategory(id: string, dto: UpdateCategoryDto, actorSub: string, ip: string | undefined): Promise<ProductCategory> {
    const repo = AppDataSource.getRepository(ProductCategory);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product category not found');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.availability !== undefined) row.availability = dto.availability;
    if (dto.emergency !== undefined) row.emergency = dto.emergency;
    if (dto.trending !== undefined) row.trending = dto.trending;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.slug !== undefined) row.slug = dto.slug;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = dto.thumbnailUrl;
    if (dto.bannerUrls !== undefined) row.bannerUrls = dto.bannerUrls;
    if (dto.iconUrl !== undefined) row.iconUrl = dto.iconUrl;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.commissionOverridePercent !== undefined) row.commissionOverridePercent = dto.commissionOverridePercent;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'ProductCategory',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteProductCategory(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const sRepo = AppDataSource.getRepository(ProductSubcategory);
    await sRepo.delete({ productCategoryId: id });
    const repo = AppDataSource.getRepository(ProductCategory);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product category not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'ProductCategory',
      entityId: id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
  }

  // ─── Product subcategories ───
  async listProductSubcategories(includeInactive: boolean): Promise<ProductSubcategory[]> {
    const repo = AppDataSource.getRepository(ProductSubcategory);
    const qb = repo.createQueryBuilder('s').orderBy('s.sortOrder', 'ASC').addOrderBy('s.name', 'ASC');
    if (!includeInactive) qb.andWhere('s.isActive = :a', { a: true });
    return qb.getMany();
  }

  async getProductSubcategory(id: string): Promise<ProductSubcategory | null> {
    return AppDataSource.getRepository(ProductSubcategory).findOne({ where: { id } });
  }

  /** Reuses CreateCategoryDto.parentId as product_category_id */
  async createProductSubcategory(dto: CreateCategoryDto, actorSub: string, ip: string | undefined): Promise<ProductSubcategory> {
    if (!dto.parentId?.trim()) throw new Error('Parent product category is required');
    const p = await this.getProductCategory(dto.parentId);
    if (!p) throw new Error('Product category not found');
    const repo = AppDataSource.getRepository(ProductSubcategory);
    const row = repo.create({
      productCategoryId: dto.parentId,
      name: dto.name,
      availability: dto.availability ?? false,
      emergency: dto.emergency ?? false,
      trending: dto.trending ?? false,
      description: dto.description ?? null,
      slug: dto.slug ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      bannerUrls: dto.bannerUrls ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'ProductSubcategory',
      entityId: row.id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateProductSubcategory(id: string, dto: UpdateCategoryDto, actorSub: string, ip: string | undefined): Promise<ProductSubcategory> {
    const repo = AppDataSource.getRepository(ProductSubcategory);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product subcategory not found');
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        const p = await this.getProductCategory(dto.parentId);
        if (!p) throw new Error('Product category not found');
        row.productCategoryId = dto.parentId;
      }
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.availability !== undefined) row.availability = dto.availability;
    if (dto.emergency !== undefined) row.emergency = dto.emergency;
    if (dto.trending !== undefined) row.trending = dto.trending;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.slug !== undefined) row.slug = dto.slug;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = dto.thumbnailUrl;
    if (dto.bannerUrls !== undefined) row.bannerUrls = dto.bannerUrls;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'ProductSubcategory',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteProductSubcategory(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(ProductSubcategory);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product subcategory not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'ProductSubcategory',
      entityId: id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
  }

  // ─── Service categories (booking roots) ───
  async listServiceCategories(includeInactive: boolean): Promise<ServiceCategory[]> {
    const repo = AppDataSource.getRepository(ServiceCategory);
    const qb = repo.createQueryBuilder('c').orderBy('c.sortOrder', 'ASC').addOrderBy('c.name', 'ASC');
    if (!includeInactive) qb.andWhere('c.isActive = :a', { a: true });
    return qb.getMany();
  }

  async getServiceCategory(id: string): Promise<ServiceCategory | null> {
    return AppDataSource.getRepository(ServiceCategory).findOne({ where: { id } });
  }

  async createServiceCategory(dto: CreateCategoryDto, actorSub: string, ip: string | undefined): Promise<ServiceCategory> {
    const repo = AppDataSource.getRepository(ServiceCategory);
    const row = repo.create({
      name: dto.name,
      availability: dto.availability ?? false,
      emergency: dto.emergency ?? false,
      trending: dto.trending ?? false,
      description: dto.description ?? null,
      slug: dto.slug ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      bannerUrls: dto.bannerUrls ?? null,
      iconUrl: dto.iconUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'ServiceCategory',
      entityId: row.id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateServiceCategory(id: string, dto: UpdateCategoryDto, actorSub: string, ip: string | undefined): Promise<ServiceCategory> {
    const repo = AppDataSource.getRepository(ServiceCategory);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Service category not found');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.availability !== undefined) row.availability = dto.availability;
    if (dto.emergency !== undefined) row.emergency = dto.emergency;
    if (dto.trending !== undefined) row.trending = dto.trending;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.slug !== undefined) row.slug = dto.slug;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = dto.thumbnailUrl;
    if (dto.bannerUrls !== undefined) row.bannerUrls = dto.bannerUrls;
    if (dto.iconUrl !== undefined) row.iconUrl = dto.iconUrl;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'ServiceCategory',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteServiceCategory(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(ServiceCategory);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Service category not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'ServiceCategory',
      entityId: id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
  }

  async getService(id: string): Promise<Record<string, unknown> | null> {
    const row = await AppDataSource.getRepository(CatalogServiceItem).findOne({ where: { id } });
    return row ? this.enrichServiceRow(row) : null;
  }

  async listServices(includeInactive: boolean): Promise<Record<string, unknown>[]> {
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const qb = repo.createQueryBuilder('s').orderBy('s.sortOrder', 'ASC').addOrderBy('s.name', 'ASC');
    if (!includeInactive) qb.andWhere('s.isActive = :a', { a: true });
    const rows = await qb.getMany();
    return rows.map((r) => this.enrichServiceRow(r));
  }

  async createService(dto: CreateCatalogServiceDto, actorSub: string, ip: string | undefined): Promise<Record<string, unknown>> {
    if (dto.categoryId) {
      const c = await this.getServiceCategory(dto.categoryId);
      if (!c) throw new Error('Service category not found');
    }
    const meta: Record<string, unknown> = {
      ...(dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : {}),
      emergency: dto.emergency ?? false,
    };
    if (dto.priceType) meta.priceType = dto.priceType;
    if (dto.duration != null && String(dto.duration).trim() !== '') {
      meta.duration = String(dto.duration).trim();
    }
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const row = repo.create({
      serviceCategoryId: dto.categoryId ?? null,
      name: dto.name,
      availability: dto.availability ?? false,
      trending: dto.trending ?? false,
      iconUrl: dto.iconUrl ?? null,
      description: dto.description ?? null,
      basePrice:
        dto.basePrice != null && String(dto.basePrice).trim() !== ''
          ? String(dto.basePrice)
          : null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      metadata: Object.keys(meta).length ? meta : { emergency: false },
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'CatalogServiceItem',
      entityId: row.id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
    return this.enrichServiceRow(row);
  }

  async updateService(id: string, dto: UpdateCatalogServiceDto, actorSub: string, ip: string | undefined): Promise<Record<string, unknown>> {
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Service not found');
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        const c = await this.getServiceCategory(dto.categoryId);
        if (!c) throw new Error('Service category not found');
      }
      row.serviceCategoryId = dto.categoryId;
    }
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.availability !== undefined) row.availability = dto.availability;
    if (dto.trending !== undefined) row.trending = dto.trending;
    if (dto.iconUrl !== undefined) row.iconUrl = dto.iconUrl;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.basePrice !== undefined) {
      row.basePrice =
        dto.basePrice != null && String(dto.basePrice).trim() !== ''
          ? String(dto.basePrice)
          : null;
    }
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    const meta = { ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) } as Record<string, unknown>;
    if (dto.emergency !== undefined) meta.emergency = dto.emergency;
    if (dto.priceType !== undefined) {
      if (dto.priceType) meta.priceType = dto.priceType;
      else delete meta.priceType;
    }
    if (dto.duration !== undefined) {
      if (dto.duration != null && String(dto.duration).trim() !== '') {
        meta.duration = String(dto.duration).trim();
      } else {
        delete meta.duration;
      }
    }
    if (dto.metadata !== undefined) {
      if (dto.metadata && typeof dto.metadata === 'object') {
        Object.assign(meta, dto.metadata);
      }
    }
    row.metadata = Object.keys(meta).length ? meta : null;

    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'CatalogServiceItem',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return this.enrichServiceRow(row);
  }

  async deleteService(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Service not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'CatalogServiceItem',
      entityId: id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
  }

  async batchUnlinkServicesForCategory(categoryId: string, actorSub: string, ip: string | undefined): Promise<{ categoryId: string; updated: number }> {
    const cat = await this.getServiceCategory(categoryId);
    if (!cat) throw new Error('Service category not found');
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const result = await repo.update({ serviceCategoryId: categoryId }, { serviceCategoryId: null });
    const updated = result.affected ?? 0;
    await this.audit.log({
      actorSub,
      action: 'BATCH_UPDATE',
      entityType: 'CatalogServiceItem',
      entityId: categoryId,
      metadata: { batch: 'unlink_category', updated },
      ipAddress: ip ?? null,
    });
    return { categoryId, updated };
  }

  async batchUnlinkProductsForCategory(
    categoryId: string,
    actorSub: string,
    ip: string | undefined,
  ): Promise<{ categoryId: string; updated: number; note: string }> {
    const cat = await this.getProductCategory(categoryId);
    if (!cat) throw new Error('Product category not found');
    const result = await AppDataSource.getRepository(Product).update({ categoryId }, { categoryId: null });
    const updated = result.affected ?? 0;
    await this.audit.log({
      actorSub,
      action: 'BATCH_UPDATE',
      entityType: 'Product',
      entityId: categoryId,
      metadata: { batch: 'unlink_category', updated },
      ipAddress: ip ?? null,
    });
    return {
      categoryId,
      updated,
      note: updated > 0 ? 'Products unlinked from category.' : 'No products matched category.',
    };
  }

  async listVendorServiceLinks(params: {
    vendorId?: string;
    serviceId?: string;
    moderationStatus?: string;
  }): Promise<CatalogVendorServiceLink[]> {
    const repo = AppDataSource.getRepository(CatalogVendorServiceLink);
    const mod = params.moderationStatus?.trim();
    if (mod) {
      return repo.find({
        where: { moderationStatus: mod },
        order: { updatedAt: 'DESC' },
        take: 500,
      });
    }
    if (params.vendorId) {
      return repo.find({ where: { vendorId: params.vendorId }, order: { updatedAt: 'DESC' } });
    }
    if (params.serviceId) {
      return repo.find({ where: { serviceId: params.serviceId }, order: { price: 'ASC' } });
    }
    throw new Error('vendorId, serviceId, or moderationStatus query parameter is required');
  }

  async upsertVendorServiceLink(
    dto: CreateVendorServiceDto,
    actorSub: string,
    ip: string | undefined,
  ): Promise<CatalogVendorServiceLink> {
    const vRepo = AppDataSource.getRepository(Vendor);
    const sRepo = AppDataSource.getRepository(CatalogServiceItem);
    const vsRepo = AppDataSource.getRepository(CatalogVendorServiceLink);

    const vendor = await vRepo.findOne({ where: { id: dto.vendorId } });
    if (!vendor) throw new Error('Vendor not found');
    const service = await sRepo.findOne({ where: { id: dto.serviceId } });
    if (!service) throw new Error('Service not found');

    let row = await vsRepo.findOne({ where: { vendorId: dto.vendorId, serviceId: dto.serviceId } });
    const isNew = !row;
    if (!row) {
      row = vsRepo.create({
        vendorId: dto.vendorId,
        serviceId: dto.serviceId,
        price: String(dto.price),
        isAvailable: dto.isAvailable ?? true,
        isActive: dto.isActive ?? true,
        moderationStatus: 'approved',
        metadata: dto.metadata ?? null,
      });
    } else {
      row.price = String(dto.price);
      if (dto.isAvailable !== undefined) row.isAvailable = dto.isAvailable;
      if (dto.isActive !== undefined) row.isActive = dto.isActive;
      if (dto.metadata !== undefined) row.metadata = dto.metadata;
    }
    await vsRepo.save(row);
    await this.audit.log({
      actorSub,
      action: isNew ? 'CREATE' : 'UPDATE',
      entityType: 'CatalogVendorService',
      entityId: row.id,
      metadata: { vendorId: dto.vendorId, serviceId: dto.serviceId, price: dto.price },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateVendorServiceLink(
    id: string,
    dto: UpdateVendorServiceDto,
    actorSub: string,
    ip: string | undefined,
  ): Promise<CatalogVendorServiceLink> {
    const repo = AppDataSource.getRepository(CatalogVendorServiceLink);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Vendor service offer not found');
    if (dto.price !== undefined) row.price = String(dto.price);
    if (dto.isAvailable !== undefined) row.isAvailable = dto.isAvailable;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.moderationStatus !== undefined) row.moderationStatus = dto.moderationStatus;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'CatalogVendorService',
      entityId: id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteVendorServiceLink(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(CatalogVendorServiceLink);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Vendor service offer not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'CatalogVendorService',
      entityId: id,
      metadata: { vendorId: row.vendorId, serviceId: row.serviceId },
      ipAddress: ip ?? null,
    });
  }
}
