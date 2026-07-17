import { AppDataSource } from '../config/database';
import { Banner } from '../entities/Banner';
import { PopupBanner } from '../entities/PopupBanner';
import { ClassifiedProduct } from '../entities/ClassifiedProduct';
import { Post } from '../entities/Post';
import { WebsiteQuery } from '../entities/WebsiteQuery';
import { Brand } from '../entities/Brand';
import { FeaturedProduct } from '../entities/FeaturedProduct';
import { ServiceHighlight } from '../entities/ServiceHighlight';

type Paging = { limit: number; offset: number };

export class ContentQueryService {
  private parseMetadata(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  async listBanners(includeInactive: boolean, paging: Paging) {
    const repo = AppDataSource.getRepository(Banner);
    const qb = repo
      .createQueryBuilder('b')
      .orderBy('b.sortOrder', 'ASC')
      .addOrderBy('b.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('b.isActive = :a', { a: true });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listPopups(includeInactive: boolean, paging: Paging) {
    const repo = AppDataSource.getRepository(PopupBanner);
    const qb = repo
      .createQueryBuilder('p')
      .orderBy('p.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('p.isActive = :a', { a: true });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listReels(paging: Paging) {
    const repo = AppDataSource.getRepository(Post);
    const qb = repo
      .createQueryBuilder('post')
      .where('post.status = :status', { status: 'published' })
      .orderBy('post.createdAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listClassified(includeInactive: boolean, paging: Paging) {
    const repo = AppDataSource.getRepository(ClassifiedProduct);
    const qb = repo
      .createQueryBuilder('c')
      .orderBy('c.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('c.isActive = :a', { a: true });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async createNewsletterSubscription(payload: {
    fullName?: string;
    email?: string;
    phone?: string;
    message?: string;
  }) {
    const repo = AppDataSource.getRepository(WebsiteQuery);
    const row = repo.create({
      fullName: payload.fullName ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      message: payload.message ?? 'newsletter-subscription',
      status: 'new',
      metadata: { source: 'content-management-service', type: 'newsletter' },
    });
    return repo.save(row);
  }

  async listBrands(includeInactive: boolean, paging: Paging) {
    const repo = AppDataSource.getRepository(Brand);
    const qb = repo
      .createQueryBuilder('b')
      .orderBy('b.sortOrder', 'ASC')
      .addOrderBy('b.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('b.isActive = :a', { a: true });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listFeaturedProducts(includeInactive: boolean, paging: Paging) {
    if (!includeInactive) {
      const idTextType = AppDataSource.options.type === 'postgres' ? 'TEXT' : 'CHAR';
      const products = await AppDataSource.query(
        `SELECT p.*, v.business_name AS vendor_business_name
         FROM catalog_products p
         INNER JOIN catalog_vendors v
           ON CAST(v.id AS ${idTextType}) = CAST(p.vendor_id AS ${idTextType})
         WHERE p.is_active = true
           AND LOWER(COALESCE(p.moderation_status, 'approved')) = 'approved'
           AND LOWER(v.status) = 'active'`,
      ) as Array<Record<string, unknown>>;
      const orders = await AppDataSource.query(
        `SELECT metadata
         FROM commerce_orders
         WHERE LOWER(status) IN ('completed', 'delivered')`,
      ) as Array<Record<string, unknown>>;
      const completedOrderCount = new Map<string, number>();
      for (const order of orders) {
        const meta = this.parseMetadata(order.metadata);
        const lines = Array.isArray(meta.lines)
          ? meta.lines
          : Array.isArray(meta.items) ? meta.items : [];
        const productIds = new Set(
          lines
            .filter((line): line is Record<string, unknown> =>
              Boolean(line) && typeof line === 'object' && !Array.isArray(line))
            .map((line) => String(line.productId ?? line.product_id ?? '').trim())
            .filter(Boolean),
        );
        for (const id of productIds) {
          completedOrderCount.set(id, (completedOrderCount.get(id) ?? 0) + 1);
        }
      }
      const ranked = products
        .map((row) => ({
          ...row,
          id: String(row.id),
          name: String(row.name ?? 'Product'),
          imageUrl: row.thumbnail_url ?? null,
          price: row.final_price ?? row.sell_price ?? row.price ?? null,
          vendorId: row.vendor_id ?? null,
          vendorName: row.vendor_business_name ?? null,
          isActive: true,
          moderationStatus: row.moderation_status ?? 'approved',
          orderCount: completedOrderCount.get(String(row.id)) ?? 0,
          updatedAt: row.updated_at ?? null,
        }))
        .sort((a, b) =>
          b.orderCount - a.orderCount ||
          String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
      return {
        items: ranked.slice(paging.offset, paging.offset + paging.limit),
        total: ranked.length,
      };
    }
    const repo = AppDataSource.getRepository(FeaturedProduct);
    const qb = repo
      .createQueryBuilder('fp')
      .orderBy('fp.section', 'ASC')
      .addOrderBy('fp.sortOrder', 'ASC')
      .addOrderBy('fp.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('fp.isActive = :a', { a: true });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listServiceHighlights(includeInactive: boolean, paging: Paging) {
    if (!includeInactive) {
      const services = await AppDataSource.query(
        `SELECT *
         FROM catalog_service_items
         WHERE is_active = true`,
      ) as Array<Record<string, unknown>>;
      const bookingRows = await AppDataSource.query(
        `SELECT service_id, COUNT(*) AS booking_count
         FROM commerce_bookings
         WHERE LOWER(status) = 'completed'
           AND service_id IS NOT NULL
         GROUP BY service_id`,
      ) as Array<Record<string, unknown>>;
      const bookingCounts = new Map(
        bookingRows.map((row) => [
          String(row.service_id),
          Number(row.booking_count ?? 0),
        ]),
      );
      const ranked = services
        .filter((row) => {
          const meta = this.parseMetadata(row.metadata);
          const moderation = String(
            meta.moderationStatus ?? meta.moderation_status ?? 'approved',
          ).toLowerCase();
          return moderation === 'approved';
        })
        .map((row) => ({
          ...row,
          id: String(row.id),
          title: String(row.name ?? 'Service'),
          name: String(row.name ?? 'Service'),
          description: row.description ?? null,
          imageUrl: row.icon_url ?? null,
          iconUrl: row.icon_url ?? null,
          price: row.base_price ?? null,
          basePrice: row.base_price ?? null,
          categoryId: row.service_category_id ?? null,
          isActive: true,
          bookingCount: bookingCounts.get(String(row.id)) ?? 0,
          sortOrder: Number(row.sort_order ?? 0),
          updatedAt: row.updated_at ?? null,
        }))
        .sort((a, b) =>
          b.bookingCount - a.bookingCount ||
          a.sortOrder - b.sortOrder ||
          String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
      return {
        items: ranked.slice(paging.offset, paging.offset + paging.limit),
        total: ranked.length,
      };
    }
    const repo = AppDataSource.getRepository(ServiceHighlight);
    const qb = repo
      .createQueryBuilder('sh')
      .orderBy('sh.sortOrder', 'ASC')
      .addOrderBy('sh.updatedAt', 'DESC')
      .limit(paging.limit)
      .offset(paging.offset);

    if (!includeInactive) qb.andWhere('sh.isActive = :a', { a: true });
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
