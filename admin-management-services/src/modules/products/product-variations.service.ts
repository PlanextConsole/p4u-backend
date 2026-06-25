import { randomUUID } from 'crypto';
import { AppDataSource } from '../../config/database';
import { ProductVariation } from './entities/ProductVariation';
import { normalizeMediaUrl } from '../../util/normalizeMediaUrl';

export type VariationUpsertInput = {
  id?: string;
  sku?: string | null;
  attributes?: Record<string, string> | null;
  sellPrice?: string | number;
  discountAmount?: string | number;
  finalPrice?: string | number;
  quantity?: number;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
};

function toPrice(v: unknown, fallback = '0'): string {
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) return n.toFixed(2);
  if (typeof v === 'string' && v.trim()) return v.trim();
  return fallback;
}

function normalizeAttributes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = String(k || '').trim();
    const val = String(v ?? '').trim();
    if (key && val) acc[key] = val;
    return acc;
  }, {});
}

export class ProductVariationsService {
  private repo() {
    return AppDataSource.getRepository(ProductVariation);
  }

  async listByProductId(productId: string): Promise<ProductVariation[]> {
    return this.repo().find({
      where: { productId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async replaceForProduct(productId: string, rows: VariationUpsertInput[]): Promise<ProductVariation[]> {
    await this.repo().delete({ productId });
    if (!rows?.length) return [];

    const saved: ProductVariation[] = [];
    let order = 0;
    for (const raw of rows) {
      const attrs = normalizeAttributes(raw.attributes);
      if (!Object.keys(attrs).length) continue;
      const sell = toPrice(raw.sellPrice);
      const fin = toPrice(raw.finalPrice ?? raw.sellPrice, sell);
      const row = this.repo().create({
        id: String(raw.id || '').trim() || randomUUID(),
        productId,
        sku: raw.sku?.trim() || null,
        attributes: attrs,
        sellPrice: sell,
        discountAmount: toPrice(raw.discountAmount, '0'),
        finalPrice: fin,
        quantity: Math.max(0, Math.floor(Number(raw.quantity) || 0)),
        thumbnailUrl: normalizeMediaUrl(raw.thumbnailUrl ?? null),
        isActive: raw.isActive !== false,
        sortOrder: raw.sortOrder ?? order++,
        metadata: raw.metadata ?? null,
      });
      saved.push(await this.repo().save(row));
    }
    return saved;
  }

  async deleteForProduct(productId: string): Promise<void> {
    await this.repo().delete({ productId });
  }
}
