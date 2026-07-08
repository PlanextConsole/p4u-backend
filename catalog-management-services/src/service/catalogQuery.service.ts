import { In, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../config/database';
import { ProductCategory } from '../entities/ProductCategory';
import { ProductSubcategory } from '../entities/ProductSubcategory';
import { ServiceCategory } from '../entities/ServiceCategory';
import { ServiceSubcategory } from '../entities/ServiceSubcategory';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { Product } from '../entities/Product';
import { ProductVariation } from '../entities/ProductVariation';
import { Vendor } from '../entities/Vendor';
import { VendorService } from '../entities/VendorService';
import { normalizeDocumentsJson, normalizeMediaUrl, normalizeMediaUrlList } from '../util/normalizeMediaUrl';

function normCategory<T extends PublicCategory>(c: T): T {
  return {
    ...c,
    thumbnailUrl: normalizeMediaUrl(c.thumbnailUrl ?? null),
    iconUrl: normalizeMediaUrl(c.iconUrl ?? null),
    bannerUrls: normalizeMediaUrlList(c.bannerUrls ?? null),
  };
}

function normVariation(v: ProductVariation) {
  return {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    attributes: v.attributes,
    sellPrice: v.sellPrice,
    discountAmount: v.discountAmount,
    finalPrice: v.finalPrice,
    quantity: v.quantity,
    thumbnailUrl: normalizeMediaUrl(v.thumbnailUrl ?? null),
    isActive: v.isActive,
    sortOrder: v.sortOrder,
    metadata: v.metadata,
  };
}

function normProduct<T extends { thumbnailUrl?: string | null; bannerUrls?: string[] | null }>(p: T): T {
  return {
    ...p,
    thumbnailUrl: normalizeMediaUrl(p.thumbnailUrl ?? null),
    bannerUrls: normalizeMediaUrlList(p.bannerUrls ?? null),
  };
}

function normVendor<T extends {
  logoUrl?: string | null;
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
  documentsJson?: Record<string, unknown> | null;
}>(v: T): T {
  return {
    ...v,
    logoUrl: normalizeMediaUrl(v.logoUrl ?? null),
    thumbnailUrl: normalizeMediaUrl(v.thumbnailUrl ?? null),
    bannerUrl: normalizeMediaUrl(v.bannerUrl ?? null),
    documentsJson: normalizeDocumentsJson(v.documentsJson ?? null),
  };
}

type Paging = { limit: number; offset: number };

function isPostgresDb(): boolean {
  const dbType = (process.env.DB_TYPE || process.env.DATABASE_TYPE || 'mysql').toLowerCase();
  return dbType === 'postgres' || dbType === 'postgresql';
}

/** Postgres: catalog_vendors.id may be uuid while catalog_products.vendor_id is varchar — cast both sides. */
function activeVendorProductJoin(productAlias: string): string {
  if (isPostgresDb()) {
    return `CAST(v.id AS TEXT) = CAST(${productAlias}.vendor_id AS TEXT) AND v.status = :vstatus`;
  }
  return `v.id = ${productAlias}.vendorId AND v.status = :vstatus`;
}

export type CategoryBrowseFilter = {
  categoryId?: string;
  subcategoryId?: string;
};

export type CategoryKind = 'product' | 'service';

/** Unified category shape for web clients (shop vs services use different backing tables). */
export type PublicCategory = {
  id: string;
  name: string;
  parentId: string | null;
  thumbnailUrl?: string | null;
  iconUrl?: string | null;
  bannerUrls?: string[] | null;
  isActive: boolean;
};

export class CatalogQueryService {
  /** Filters applied to customer-facing product listings (shop, search, vendor pages). */
  private applyPublicProductFilters(qb: SelectQueryBuilder<Product>, includeInactive: boolean) {
    if (includeInactive) return;
    qb.innerJoin(Vendor, 'v', activeVendorProductJoin('p'), { vstatus: 'active' });
    qb.andWhere("(p.moderationStatus = :approved OR p.moderationStatus IS NULL)", { approved: 'approved' });
    qb.andWhere('(p.isActive = :active OR p.availability = :avail)', { active: true, avail: true });
  }

  /** Service browse: subcategory ids under a root service category. */
  private async collectServiceSubcategoryIds(rootServiceCategoryId: string): Promise<string[]> {
    const subRepo = AppDataSource.getRepository(ServiceSubcategory);
    const subs = await subRepo.find({
      where: { serviceCategoryId: rootServiceCategoryId },
      select: ['id'],
    });
    return subs.map((s) => s.id);
  }

  /** Product browse: root category id + all its product subcategory ids. */
  private async collectProductBrowseIds(rootProductCategoryId: string): Promise<string[]> {
    const subRepo = AppDataSource.getRepository(ProductSubcategory);
    const subs = await subRepo.find({
      where: { productCategoryId: rootProductCategoryId },
      select: ['id'],
    });
    return [rootProductCategoryId, ...subs.map((s) => s.id)];
  }

  async listCategories(includeInactive: boolean, kind: CategoryKind): Promise<PublicCategory[]> {
    if (kind === 'service') {
      const repo = AppDataSource.getRepository(ServiceCategory);
      const qb = repo.createQueryBuilder('c').orderBy('c.sortOrder', 'ASC').addOrderBy('c.name', 'ASC');
      if (!includeInactive) qb.andWhere('c.isActive = :a', { a: true });
      const rows = await qb.getMany();
      return rows.map((c) => normCategory({
        id: c.id,
        name: c.name,
        parentId: null,
        thumbnailUrl: c.thumbnailUrl,
        iconUrl: c.iconUrl,
        bannerUrls: c.bannerUrls,
        isActive: c.isActive,
      }));
    }
    const repo = AppDataSource.getRepository(ProductCategory);
    const qb = repo.createQueryBuilder('c').orderBy('c.sortOrder', 'ASC').addOrderBy('c.name', 'ASC');
    if (!includeInactive) qb.andWhere('c.isActive = :a', { a: true });
    const rows = await qb.getMany();
    return rows.map((c) => normCategory({
      id: c.id,
      name: c.name,
      parentId: null,
      thumbnailUrl: c.thumbnailUrl,
      iconUrl: c.iconUrl,
      bannerUrls: c.bannerUrls,
      isActive: c.isActive,
    }));
  }

  /** Product or service subcategories under a root category. */
  async listCategoryChildren(parentId: string, includeInactive: boolean, kind: CategoryKind): Promise<PublicCategory[]> {
    if (kind === 'service') {
      const repo = AppDataSource.getRepository(ServiceSubcategory);
      const qb = repo
        .createQueryBuilder('s')
        .where('s.serviceCategoryId = :parentId', { parentId })
        .orderBy('s.sortOrder', 'ASC')
        .addOrderBy('s.name', 'ASC');
      if (!includeInactive) qb.andWhere('s.isActive = :a', { a: true });
      const rows = await qb.getMany();
      return rows.map((s) => normCategory({
        id: s.id,
        name: s.name,
        parentId: s.serviceCategoryId,
        thumbnailUrl: s.thumbnailUrl,
        iconUrl: null,
        bannerUrls: s.bannerUrls,
        isActive: s.isActive,
      }));
    }

    const repo = AppDataSource.getRepository(ProductSubcategory);
    const qb = repo
      .createQueryBuilder('s')
      .where('s.productCategoryId = :parentId', { parentId })
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.name', 'ASC');
    if (!includeInactive) qb.andWhere('s.isActive = :a', { a: true });
    const rows = await qb.getMany();
    return rows.map((s) => normCategory({
      id: s.id,
      name: s.name,
      parentId: s.productCategoryId,
      thumbnailUrl: s.thumbnailUrl,
      iconUrl: null,
      bannerUrls: s.bannerUrls,
      isActive: s.isActive,
    }));
  }

  async listVendors(includeInactive: boolean, paging: Paging, filters?: { vendorKind?: string }) {
    const repo = AppDataSource.getRepository(Vendor);
    const qb = repo
      .createQueryBuilder('v')
      .orderBy('v.updatedAt', 'DESC')
      .addOrderBy('v.businessName', 'ASC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('v.status = :status', { status: 'active' });
    const kind = filters?.vendorKind?.trim().toLowerCase();
    if (kind === 'product' || kind === 'service') {
      qb.andWhere('v.vendorKind = :vk', { vk: kind });
    }
    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(normVendor), total };
  }

  async getVendor(id: string, includeInactive: boolean) {
    const repo = AppDataSource.getRepository(Vendor);
    const where = includeInactive ? { id } : { id, status: 'active' };
    const row = await repo.findOne({ where });
    return row ? normVendor(row) : null;
  }

  async listProducts(vendorId: string | undefined, includeInactive: boolean, paging: Paging) {
    const repo = AppDataSource.getRepository(Product);
    const qb = repo
      .createQueryBuilder('p')
      .orderBy('p.updatedAt', 'DESC')
      .addOrderBy('p.name', 'ASC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (vendorId) qb.andWhere('p.vendorId = :vendorId', { vendorId });
    this.applyPublicProductFilters(qb, includeInactive);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(normProduct), total };
  }

  async getProduct(id: string, includeInactive: boolean) {
    const repo = AppDataSource.getRepository(Product);
    const varRepo = AppDataSource.getRepository(ProductVariation);
    let row: Product | null;
    if (includeInactive) {
      row = await repo.findOne({ where: { id } });
    } else {
      row = await repo
        .createQueryBuilder('p')
        .innerJoin(Vendor, 'v', activeVendorProductJoin('p'), { vstatus: 'active' })
        .where('p.id = :id', { id })
        .andWhere("(p.moderationStatus = :approved OR p.moderationStatus IS NULL)", { approved: 'approved' })
        .andWhere('(p.isActive = :active OR p.availability = :avail)', { active: true, avail: true })
        .getOne();
    }
    if (!row) return null;
    const variationWhere: { productId: string; isActive?: boolean } = { productId: id };
    if (!includeInactive) variationWhere.isActive = true;
    const variations = await varRepo.find({
      where: variationWhere,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return { ...normProduct(row), variations: variations.map(normVariation) };
  }

  async listProductsForBrowse(includeInactive: boolean, paging: Paging, filters?: CategoryBrowseFilter) {
    const repo = AppDataSource.getRepository(Product);
    const qb = repo
      .createQueryBuilder('p')
      .orderBy('p.updatedAt', 'DESC')
      .addOrderBy('p.name', 'ASC')
      .limit(paging.limit)
      .offset(paging.offset);

    this.applyPublicProductFilters(qb, includeInactive);

    const sub = filters?.subcategoryId?.trim();
    const cat = filters?.categoryId?.trim();
    if (sub) {
      qb.andWhere('p.categoryId = :cid', { cid: sub });
    } else if (cat) {
      const ids = await this.collectProductBrowseIds(cat);
      qb.andWhere('p.categoryId IN (:...cids)', { cids: ids.length ? ids : ['__none__'] });
    }

    const [items, total] = await qb.getManyAndCount();
    const vRepo = AppDataSource.getRepository(Vendor);
    const vIds = [...new Set(items.map((p) => p.vendorId).filter(Boolean))] as string[];
    let vendorMap = new Map<string, Vendor>();
    if (vIds.length) {
      const vendors = await vRepo.find({ where: { id: In(vIds) } });
      vendorMap = new Map(vendors.map((v) => [v.id, v]));
    }
    const enriched = items.map((p) => {
      const v = p.vendorId ? vendorMap.get(p.vendorId) : undefined;
      return normProduct({
        ...p,
        vendorBusinessName: v?.businessName ?? null,
        vendorLogoUrl: normalizeMediaUrl(v?.logoUrl ?? null),
      } as Product & { vendorBusinessName: string | null; vendorLogoUrl: string | null });
    });
    return { items: enriched, total };
  }

  async listServices(includeInactive: boolean, paging: Paging, filters?: CategoryBrowseFilter) {
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const qb = repo
      .createQueryBuilder('s')
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('s.isActive = :a', { a: true });

    const sub = filters?.subcategoryId?.trim();
    const cat = filters?.categoryId?.trim();
    if (sub) {
      qb.andWhere('s.serviceSubcategoryId = :ssid', { ssid: sub });
    } else if (cat) {
      const subIds = await this.collectServiceSubcategoryIds(cat);
      if (subIds.length) {
        qb.andWhere(
          '(s.serviceSubcategoryId IN (:...ssids) OR (s.serviceSubcategoryId IS NULL AND s.serviceCategoryId = :root))',
          { ssids: subIds, root: cat },
        );
      } else {
        qb.andWhere('s.serviceCategoryId = :root', { root: cat });
      }
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((s) => ({
        ...s,
        categoryId: s.serviceSubcategoryId || s.serviceCategoryId,
        iconUrl: normalizeMediaUrl(s.iconUrl ?? null),
      })),
      total,
    };
  }

  async listVendorOffersForService(serviceId: string, includeInactiveVendors: boolean) {
    const vsRepo = AppDataSource.getRepository(VendorService);
    const vRepo = AppDataSource.getRepository(Vendor);
    const offers = await vsRepo.find({
      where: { serviceId, isActive: true },
      order: { price: 'ASC' },
    });
    if (!offers.length) {
      const vendors = await vRepo.find();
      const target = String(serviceId);
      const matched = vendors.filter((v) => {
        if (!includeInactiveVendors && v.status !== 'active') return false;
        if (String(v.vendorKind || '').toLowerCase() === 'product') return false;
        const raw = (v as unknown as { servicesJson?: unknown }).servicesJson;
        if (raw == null) return false;
        if (Array.isArray(raw)) {
          return raw.some((entry) => {
            if (entry == null) return false;
            if (typeof entry === 'string' || typeof entry === 'number') {
              return String(entry) === target;
            }
            if (typeof entry === 'object') {
              const obj = entry as Record<string, unknown>;
              const id = obj.id ?? obj.serviceId ?? obj.value;
              return id != null && String(id) === target;
            }
            return false;
          });
        }
        return false;
      });

      return matched.map((v) => ({
        vendorServiceId: `legacy-${v.id}-${target}`,
        price: '0',
        isAvailable: true,
        vendor: {
          id: v.id,
          businessName: v.businessName,
          logoUrl: normalizeMediaUrl(v.logoUrl ?? null),
          thumbnailUrl: normalizeMediaUrl(v.thumbnailUrl ?? null),
        },
      }));
    }

    const vendorIds = [...new Set(offers.map((o) => o.vendorId))];
    const vendors = await vRepo.find({ where: { id: In(vendorIds) } });
    const vmap = new Map(vendors.map((v) => [v.id, v]));

    const out: Array<{
      vendorServiceId: string;
      price: string;
      isAvailable: boolean;
      vendor: { id: string; businessName: string; logoUrl: string | null; thumbnailUrl: string | null } | null;
    }> = [];

    for (const o of offers) {
      const v = vmap.get(o.vendorId);
      if (!v) continue;
      if (!includeInactiveVendors && v.status !== 'active') continue;
      if (String(v.vendorKind || '').toLowerCase() === 'product') continue;
      out.push({
        vendorServiceId: o.id,
        price: o.price,
        isAvailable: o.isAvailable,
        vendor: {
          id: v.id,
          businessName: v.businessName,
          logoUrl: normalizeMediaUrl(v.logoUrl ?? null),
          thumbnailUrl: normalizeMediaUrl(v.thumbnailUrl ?? null),
        },
      });
    }
    return out;
  }

  async getService(id: string, includeInactive: boolean) {
    const repo = AppDataSource.getRepository(CatalogServiceItem);
    const where = includeInactive ? { id } : { id, isActive: true };
    return repo.findOne({ where });
  }

  async searchAll(q: string, includeInactive: boolean, paging: Paging) {
    const like = `%${q}%`;
    const items: Array<Record<string, unknown>> = [];

    const pcQb = AppDataSource.getRepository(ProductCategory)
      .createQueryBuilder('c')
      .where('c.name LIKE :like', { like })
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .limit(paging.limit);
    if (!includeInactive) pcQb.andWhere('c.isActive = :a', { a: true });
    const pcats = await pcQb.getMany();
    items.push(...pcats.map((c) => ({ type: 'category', categoryKind: 'product', ...c })));

    const scQb = AppDataSource.getRepository(ServiceCategory)
      .createQueryBuilder('c')
      .where('c.name LIKE :like', { like })
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .limit(paging.limit);
    if (!includeInactive) scQb.andWhere('c.isActive = :a', { a: true });
    const scats = await scQb.getMany();
    items.push(...scats.map((c) => ({ type: 'category', categoryKind: 'service', ...c })));

    const ssQb = AppDataSource.getRepository(ServiceSubcategory)
      .createQueryBuilder('s')
      .where('s.name LIKE :like', { like })
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .limit(paging.limit);
    if (!includeInactive) ssQb.andWhere('s.isActive = :a', { a: true });
    const ssubs = await ssQb.getMany();
    items.push(...ssubs.map((s) => ({ type: 'subcategory', categoryKind: 'service', ...s })));

    const vendorsQb = AppDataSource.getRepository(Vendor)
      .createQueryBuilder('v')
      .where('v.businessName LIKE :like OR v.ownerName LIKE :like', { like })
      .orderBy('v.updatedAt', 'DESC')
      .limit(paging.limit);
    if (!includeInactive) vendorsQb.andWhere('v.status = :status', { status: 'active' });
    const vendors = await vendorsQb.getMany();
    items.push(...vendors.map((v) => ({ type: 'vendor', ...v })));

    const productsQb = AppDataSource.getRepository(Product)
      .createQueryBuilder('p')
      .where('p.name LIKE :like OR p.description LIKE :like', { like })
      .orderBy('p.updatedAt', 'DESC')
      .limit(paging.limit);
    this.applyPublicProductFilters(productsQb, includeInactive);
    const products = await productsQb.getMany();
    items.push(...products.map((p) => ({ type: 'product', ...p })));

    const servicesQb = AppDataSource.getRepository(CatalogServiceItem)
      .createQueryBuilder('s')
      .where('s.name LIKE :like OR s.description LIKE :like', { like })
      .orderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .limit(paging.limit);
    if (!includeInactive) servicesQb.andWhere('s.isActive = :a', { a: true });
    const services = await servicesQb.getMany();
    items.push(...services.map((s) => ({ type: 'service', ...s })));

    return items.slice(paging.offset, paging.offset + paging.limit);
  }
}
