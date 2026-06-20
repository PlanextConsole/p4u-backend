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
