import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { ClassifiedProduct } from '../entities/ClassifiedProduct';
import { ClassifiedCategory } from '../entities/ClassifiedCategory';

type Paging = { limit: number; offset: number };

export type PublicClassifiedAd = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image: string | null;
  images: string[];
  categoryId: string | null;
  categoryName: string | null;
  city: string | null;
  area: string | null;
  location: string | null;
  contactPhone: string | null;
  postedBy: string | null;
  memberSince: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function metaRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function strMeta(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function parsePrice(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function formatLocation(city: string | null, area: string | null): string | null {
  const parts = [area, city].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function formatIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapRow(row: ClassifiedProduct, categoryName?: string | null): PublicClassifiedAd {
  const meta = metaRecord(row.metadata);
  const images = Array.isArray(row.imageUrls) ? row.imageUrls.filter(Boolean) : [];
  const city = strMeta(meta, 'city', 'cityName');
  const area = strMeta(meta, 'area', 'areaName');
  return {
    id: row.id,
    title: row.name,
    description: row.description ?? null,
    price: parsePrice(row.price),
    image: images[0] ?? null,
    images,
    categoryId: row.categoryId ?? null,
    categoryName: categoryName ?? strMeta(meta, 'category', 'categoryName'),
    city,
    area,
    location: formatLocation(city, area),
    contactPhone: strMeta(meta, 'contactPhone', 'phone', 'whatsapp', 'whatsappPhone'),
    postedBy: strMeta(meta, 'postedBy', 'sellerName', 'vendorName') ?? 'Vendor',
    memberSince: strMeta(meta, 'memberSince') ?? '2024',
    createdAt: formatIso(row.createdAt),
    updatedAt: formatIso(row.updatedAt),
  };
}

export class ClassifiedPublicService {
  private async categoryMap(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean) as string[])];
    if (!unique.length) return new Map();
    const rows = await AppDataSource.getRepository(ClassifiedCategory).find({
      where: { id: In(unique) },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async listCategories(): Promise<{ id: string; name: string }[]> {
    const rows = await AppDataSource.getRepository(ClassifiedCategory).find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async listPublic(
    paging: Paging,
    filters?: { q?: string; categoryId?: string },
  ): Promise<{ items: PublicClassifiedAd[]; total: number }> {
    const repo = AppDataSource.getRepository(ClassifiedProduct);
    const qb = repo
      .createQueryBuilder('c')
      .where('c.isActive = :active', { active: true })
      .orderBy('c.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    const q = (filters?.q || '').trim();
    if (q) {
      qb.andWhere('(c.name LIKE :like OR c.description LIKE :like)', { like: `%${q}%` });
    }
    const categoryId = (filters?.categoryId || '').trim();
    if (categoryId) {
      qb.andWhere('c.categoryId = :categoryId', { categoryId });
    }

    const [rows, total] = await qb.getManyAndCount();
    const catMap = await this.categoryMap(rows.map((r) => r.categoryId));
    return {
      items: rows.map((r) => mapRow(r, r.categoryId ? catMap.get(r.categoryId) ?? null : null)),
      total,
    };
  }

  async getPublicById(id: string): Promise<PublicClassifiedAd | null> {
    const row = await AppDataSource.getRepository(ClassifiedProduct).findOne({
      where: { id, isActive: true },
    });
    if (!row) return null;
    let categoryName: string | null = null;
    if (row.categoryId) {
      const cat = await AppDataSource.getRepository(ClassifiedCategory).findOne({
        where: { id: row.categoryId },
      });
      categoryName = cat?.name ?? null;
    }
    return mapRow(row, categoryName);
  }

  async createFromCustomer(payload: {
    customerId: string;
    customerName?: string | null;
    customerPhone?: string | null;
    name: string;
    description?: string | null;
    price?: string | number;
    categoryId?: string | null;
    city?: string | null;
    area?: string | null;
    imageUrls?: string[] | null;
    contactPhone?: string | null;
  }): Promise<PublicClassifiedAd> {
    const repo = AppDataSource.getRepository(ClassifiedProduct);
    const title = payload.name.trim();
    if (!title) throw new Error('Title is required');

    const meta: Record<string, unknown> = {
      city: payload.city?.trim() || null,
      area: payload.area?.trim() || null,
      contactPhone: payload.contactPhone?.trim() || payload.customerPhone?.trim() || null,
      postedBy: payload.customerName?.trim() || 'Member',
      customerId: payload.customerId,
      approvalStatus: 'pending',
      status: 'pending',
      source: 'user-web',
    };

    const row = repo.create({
      vendorId: null,
      categoryId: payload.categoryId ?? null,
      serviceId: null,
      name: title,
      description: payload.description?.trim() || null,
      price: String(payload.price ?? '0'),
      imageUrls: payload.imageUrls?.length ? payload.imageUrls : null,
      isActive: false,
      metadata: meta,
    });
    const saved = await repo.save(row);

    let categoryName: string | null = null;
    if (saved.categoryId) {
      const cat = await AppDataSource.getRepository(ClassifiedCategory).findOne({
        where: { id: saved.categoryId },
      });
      categoryName = cat?.name ?? null;
    }
    return mapRow(saved, categoryName);
  }
}
