import { AppDataSource } from '../config/database';
import { Product } from '../entities/Product';

export interface MergedCategoryRow {
  id: string;
  name: string;
  parentId: string | null;
}

export class VendorCatalogService {
  async getCategoriesForProducts(): Promise<MergedCategoryRow[]> {
    const roots: { id: string; name: string }[] = await AppDataSource.query(
      `SELECT id, name FROM product_categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`,
    );
    const subs: { id: string; name: string; product_category_id: string }[] = await AppDataSource.query(
      `SELECT id, name, product_category_id FROM product_subcategories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC`,
    );
    return [
      ...roots.map((c) => ({ id: c.id, name: c.name, parentId: null as string | null })),
      ...subs.map((s) => ({
        id: s.id,
        name: s.name,
        parentId: s.product_category_id,
      })),
    ];
  }

  async listTaxConfigurations(): Promise<
    { id: string; code: string; title: string; percentage: string; isActive: boolean }[]
  > {
    return AppDataSource.query(
      `SELECT id, code, title, percentage, is_active AS isActive FROM catalog_tax_configurations WHERE is_active = 1 ORDER BY title ASC`,
    );
  }

  async listProductAttributes(): Promise<
    { id: string; name: string; type: string; isActive: boolean; selectValues: unknown }[]
  > {
    const rows: {
      id: string;
      name: string;
      type: string;
      is_active: number;
      select_values: string | null;
    }[] = await AppDataSource.query(
      `SELECT id, name, type, is_active, select_values FROM product_attribute_definitions WHERE is_active = 1 ORDER BY name ASC`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      isActive: Boolean(r.is_active),
      selectValues: normalizeSelectValues(r.select_values),
    }));
  }

  async listProductsForVendor(
    vendorId: string,
    opts: { q?: string; status?: string; moderation?: string; limit: number; offset: number },
  ): Promise<{ items: Product[]; total: number }> {
    const repo = AppDataSource.getRepository(Product);
    const qb = repo.createQueryBuilder('p').where('p.vendor_id = :vendorId', { vendorId });
    const q = (opts.q || '').trim();
    if (q) {
      qb.andWhere('p.name LIKE :q', { q: `%${q}%` });
    }
    const mod = (opts.moderation || 'all').toLowerCase();
    if (mod === 'pending') {
      qb.andWhere('p.moderationStatus = :ms', { ms: 'pending' });
    } else if (mod === 'approved') {
      qb.andWhere('(p.moderationStatus = :ap OR p.moderationStatus IS NULL)', { ap: 'approved' });
    }
    const st = (opts.status || 'all').toLowerCase();
    if (st === 'active') qb.andWhere('p.is_active = 1');
    else if (st === 'inactive') qb.andWhere('p.is_active = 0');
    qb.orderBy('p.created_at', 'DESC').take(opts.limit).skip(opts.offset);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getProductForVendor(vendorId: string, productId: string): Promise<Product | null> {
    const row = await AppDataSource.getRepository(Product).findOne({ where: { id: productId } });
    if (!row || row.vendorId !== vendorId) return null;
    return row;
  }

  async createProductForVendor(vendorId: string, body: Record<string, unknown>): Promise<Product> {
    const repo = AppDataSource.getRepository(Product);
    const sell = toPriceString(body.sellPrice ?? body.sell_price, '0');
    const disc = toPriceString(body.discountAmount ?? body.discount_amount, '0');
    const fin = toPriceString(body.finalPrice ?? body.final_price, sell);
    const row = repo.create({
      name: String(body.name || '').trim() || 'Untitled',
      availability: false,
      vendorId,
      categoryId: (body.categoryId as string) || (body.category_id as string) || null,
      serviceId: (body.serviceId as string) || null,
      sellPrice: sell,
      discountAmount: disc,
      finalPrice: fin,
      taxConfigurationId: (body.taxConfigurationId as string) || null,
      durationHours: toInt(body.durationHours, 0),
      durationMinutes: toInt(body.durationMinutes, 0),
      shortDescription: strOrNull(body.shortDescription),
      longDescription: strOrNull(body.longDescription),
      promiseP4u: strOrNull(body.promiseP4u),
      helpLineNumber: strOrNull(body.helpLineNumber),
      thumbnailUrl: strOrNull(body.thumbnailUrl),
      bannerUrls: Array.isArray(body.bannerUrls) ? (body.bannerUrls as string[]) : null,
      commissionOverridePercent: pctOrNull(body.commissionOverridePercent),
      description: strOrNull(body.description),
      price: toPriceString(body.price, sell),
      isActive: false,
      moderationStatus: 'pending',
      metadata: metaObj(body.metadata),
    });
    return repo.save(row);
  }

  async updateProductForVendor(
    vendorId: string,
    productId: string,
    body: Record<string, unknown>,
  ): Promise<Product> {
    const repo = AppDataSource.getRepository(Product);
    const row = await repo.findOne({ where: { id: productId } });
    if (!row) throw new Error('Product not found');
    if (row.vendorId !== vendorId) throw new Error('Product does not belong to vendor');

    const pending = row.moderationStatus === 'pending';

    if (body.name !== undefined) row.name = String(body.name || '').trim() || row.name;
    if (!pending && body.availability !== undefined) row.availability = Boolean(body.availability);
    if (body.categoryId !== undefined) row.categoryId = (body.categoryId as string) || null;
    if (body.serviceId !== undefined) row.serviceId = (body.serviceId as string) || null;
    if (body.sellPrice !== undefined) row.sellPrice = toPriceString(body.sellPrice, row.sellPrice);
    if (body.discountAmount !== undefined) row.discountAmount = toPriceString(body.discountAmount, row.discountAmount);
    if (body.finalPrice !== undefined) row.finalPrice = toPriceString(body.finalPrice, row.finalPrice);
    if (body.taxConfigurationId !== undefined) row.taxConfigurationId = (body.taxConfigurationId as string) || null;
    if (body.durationHours !== undefined) row.durationHours = toInt(body.durationHours, row.durationHours);
    if (body.durationMinutes !== undefined) row.durationMinutes = toInt(body.durationMinutes, row.durationMinutes);
    if (body.shortDescription !== undefined) row.shortDescription = strOrNull(body.shortDescription);
    if (body.longDescription !== undefined) row.longDescription = strOrNull(body.longDescription);
    if (body.promiseP4u !== undefined) row.promiseP4u = strOrNull(body.promiseP4u);
    if (body.helpLineNumber !== undefined) row.helpLineNumber = strOrNull(body.helpLineNumber);
    if (body.thumbnailUrl !== undefined) row.thumbnailUrl = strOrNull(body.thumbnailUrl);
    if (body.bannerUrls !== undefined) row.bannerUrls = Array.isArray(body.bannerUrls) ? (body.bannerUrls as string[]) : null;
    if (body.commissionOverridePercent !== undefined) {
      row.commissionOverridePercent = pctOrNull(body.commissionOverridePercent);
    }
    if (body.description !== undefined) row.description = strOrNull(body.description);
    if (body.price !== undefined) row.price = toPriceString(body.price, row.price);
    if (!pending && body.isActive !== undefined) row.isActive = Boolean(body.isActive);
    if (body.metadata !== undefined) row.metadata = metaObj(body.metadata);
    return repo.save(row);
  }

  async deleteProductForVendor(vendorId: string, productId: string): Promise<void> {
    const repo = AppDataSource.getRepository(Product);
    const row = await repo.findOne({ where: { id: productId } });
    if (!row) throw new Error('Product not found');
    if (row.vendorId !== vendorId) throw new Error('Product does not belong to vendor');
    await repo.remove(row);
  }
}

function normalizeSelectValues(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  if (v && typeof v === 'object' && Buffer.isBuffer(v)) {
    try {
      const p = JSON.parse(v.toString('utf8'));
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toBool(v: unknown, def: boolean): boolean {
  if (v === undefined || v === null) return def;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return def;
}

function toInt(v: unknown, def: number): number {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
}

function toPriceString(v: unknown, fallback: string): string {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n)) return fallback;
  return n.toFixed(2);
}

function pctOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function metaObj(v: unknown): Record<string, unknown> | null {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}
