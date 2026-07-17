import { AppDataSource } from '../config/database';
import { randomUUID } from 'crypto';
import { SocialPost } from '../entities/SocialPost';
import { UserFollow } from '../entities/UserFollow';
import { deleteMediaByIds } from '../service/socialMediaStorage.service';
import { resolveAuthor, resolveAuthorMap, withAuthor } from '../service/authorProfile.service';
import { normalizeMediaUrl, normalizeMediaUrlList } from '../util/normalizeMediaUrl';
import { getPlatformVarNumber, getSocioAdMode, PLATFORM_VAR_KEYS } from './platformVariable.reader';

/** Attaches userName/userAvatar to a list of posts in a single profile lookup. */
async function withAuthors<T extends { authorId: string }>(rows: T[]): Promise<Array<T & { userName: string; userAvatar: string | null }>> {
  const map = await resolveAuthorMap(rows.map((r) => r.authorId));
  return rows.map((r) => withAuthor(r, r.authorId, map));
}

/**
 * Extracts media ids from a `/socio-uploads/media/{id}` URL. Returns null for
 * anything else (legacy disk paths, external URLs) so callers can ignore them.
 */
function mediaIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/socio-uploads\/media\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

function withNormalizedMedia<T extends { mediaUrls?: string[] | null }>(post: T): T {
  if (!post.mediaUrls?.length) return post;
  return { ...post, mediaUrls: normalizeMediaUrlList(post.mediaUrls) };
}

export class FeedService {

  async getSocioAdConfig() {
    const [configuredEvery, mode] = await Promise.all([
      getPlatformVarNumber(PLATFORM_VAR_KEYS.ADVERTISEMENT_PER_POSTS),
      getSocioAdMode(),
    ]);
    return {
      adEveryN: Math.max(1, Math.min(100, Math.trunc(configuredEvery || 5))),
      mode,
    };
  }
  async createPost(
    authorId: string,
    authorType: string,
    data: {
      contentText?: string;
      mediaUrls?: string[];
      postType?: string;
      visibility?: string;
      location?: string;
      tags?: string[];
      category?: string;
      linkedProducts?: unknown[];
      hideLikeCount?: boolean;
      commentPermission?: string;
    },
  ) {
    const repo = AppDataSource.getRepository(SocialPost);
    const metadata: Record<string, unknown> = {};
    if (data.location?.trim()) metadata.location = data.location.trim();
    if (data.tags?.length) metadata.tags = data.tags.map((t) => t.trim()).filter(Boolean);
    if (data.category?.trim()) metadata.category = data.category.trim();
    if (Array.isArray(data.linkedProducts) && data.linkedProducts.length) metadata.linkedProducts = data.linkedProducts;
    if (data.hideLikeCount) metadata.hideLikeCount = true;
    if (data.commentPermission === 'followers' || data.commentPermission === 'none') {
      metadata.commentPermission = data.commentPermission;
    } else if (data.commentPermission) {
      metadata.commentPermission = 'everyone';
    }

    const saved = await repo.save(
      repo.create({
        id: randomUUID(),
        authorId,
        authorType,
        contentText: data.contentText || null,
        mediaUrls: normalizeMediaUrlList(data.mediaUrls || null),
        postType: data.postType || 'text',
        visibility: data.visibility || 'public',
        status: 'published',
        metadata: Object.keys(metadata).length ? metadata : null,
      }),
    );
    // Return with author info so the new post renders the name/avatar immediately.
    const author = await resolveAuthor(authorId);
    return { ...withNormalizedMedia(saved), ...author };
  }

  async getTrendingTags(limit: number): Promise<Array<{ tag: string; postCount: number }>> {
    const rows = await AppDataSource.getRepository(SocialPost)
      .createQueryBuilder('p')
      .select('p.metadata', 'metadata')
      .where('p.status = :status', { status: 'published' })
      .andWhere('p.metadata IS NOT NULL')
      .getRawMany<{ metadata: string | Record<string, unknown> | null }>();

    const counts = new Map<string, number>();
    for (const row of rows) {
      let meta = row.metadata;
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta) as Record<string, unknown>;
        } catch {
          meta = null;
        }
      }
      const tags = (meta as Record<string, unknown> | null)?.tags;
      if (!Array.isArray(tags)) continue;
      for (const raw of tags) {
        const tag = String(raw).trim().replace(/^#/, '');
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([tag, postCount]) => ({ tag, postCount }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);
  }

  async getTrendingPlaces(limit: number): Promise<Array<{ place: string; postCount: number }>> {
    const rows = await AppDataSource.getRepository(SocialPost)
      .createQueryBuilder('p')
      .select("JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.location'))", 'place')
      .addSelect('COUNT(*)', 'postCount')
      .where('p.status = :status', { status: 'published' })
      .andWhere("JSON_EXTRACT(p.metadata, '$.location') IS NOT NULL")
      .andWhere("JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.location')) != ''")
      .groupBy('place')
      .orderBy('postCount', 'DESC')
      .limit(limit)
      .getRawMany<{ place: string; postCount: string }>();

    return rows.map((r) => ({ place: r.place, postCount: Number(r.postCount) || 0 }));
  }

  async getPost(postId: string) {
    const row = await AppDataSource.getRepository(SocialPost).findOne({ where: { id: postId } });
    if (!row) return null;
    const author = await resolveAuthor(row.authorId);
    return { ...withNormalizedMedia(row), ...author };
  }

  async getFeed(userId: string, limit: number, offset: number) {
    const followingIds = await AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('f.following_id', 'followingId')
      .where('f.follower_id = :userId', { userId })
      .getRawMany();

    const ids = [userId, ...followingIds.map((r) => r.followingId)];
    const rows = await AppDataSource.getRepository(SocialPost)
      .createQueryBuilder('p')
      .where('p.author_id IN (:...ids)', { ids })
      .andWhere('p.status = :status', { status: 'published' })
      .orderBy('p.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();
    return withAuthors(rows.map(withNormalizedMedia));
  }

  /** Personalized feed; falls back to public posts when the user follows nobody yet. */
  async getFeedWithFallback(userId: string, limit: number, offset: number) {
    const personalized = await this.getFeed(userId, limit, offset);
    if (personalized.length > 0) return personalized;
    return this.getPublicFeed(limit, offset);
  }

  async getPublicFeed(limit: number, offset: number) {
    const rows = await AppDataSource.getRepository(SocialPost).find({
      where: { status: 'published', visibility: 'public' },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return withAuthors(rows.map(withNormalizedMedia));
  }

  /**
   * Active social advertisements created in the admin console (Advertisement →
   * Social Advertisement). These live in `content_ad_feed_items` (shared admin
   * DB); we read them directly and surface only the ones flagged for the socio
   * feed. Returned as lightweight "sponsored" items — NOT SocialPost rows — so
   * the client renders them as ad cards without like/comment interactions.
   */
  async getSocioAds(limit: number): Promise<Array<Record<string, unknown>>> {
    const cap = Math.max(1, Math.min(limit, 20));
    let rows: Array<Record<string, unknown>>;
    try {
      const postgres = AppDataSource.options.type === 'postgres';
      rows = await AppDataSource.query(
        `SELECT id, title, image_url, redirect_url, metadata, sort_order, created_at
         FROM content_ad_feed_items
         WHERE status = 'active'
         ORDER BY sort_order ASC, updated_at DESC
         LIMIT ${postgres ? '$1' : '?'}`,
        [cap * 4],
      );
    } catch {
      return [];
    }
    const parseMeta = (v: unknown): Record<string, unknown> => {
      if (!v) return {};
      if (typeof v === 'string') {
        try { return JSON.parse(v) || {}; } catch { return {}; }
      }
      return typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    };
    const isSocio = (meta: Record<string, unknown>): boolean => {
      if (meta.isSocioAd === true) return true;
      const pages = meta.pages;
      if (Array.isArray(pages)) return pages.map(String).includes('socio');
      if (typeof pages === 'string') return pages.split(',').map((s) => s.trim()).includes('socio');
      return false;
    };
    const now = Date.now();
    const eligible = rows.flatMap((r) => {
      const meta = parseMeta(r.metadata);
      if (!isSocio(meta)) return [];
      const starts = meta.startDate ? Date.parse(String(meta.startDate)) : NaN;
      const ends = meta.endDate ? Date.parse(String(meta.endDate)) : NaN;
      if ((!Number.isNaN(starts) && starts > now) || (!Number.isNaN(ends) && ends + 86_400_000 <= now)) return [];
      return [{ row: r, meta }];
    });

    const productIds = [...new Set(eligible.map(({ meta }) => String(meta.productId ?? meta.selectedProductId ?? '').trim()).filter(Boolean))];
    const directVendorIds = [...new Set(eligible.map(({ meta }) => String(meta.vendorId ?? meta.selectedVendorId ?? '').trim()).filter(Boolean))];
    const productVendors = new Map<string, string>();
    const trendingVendors = new Set<string>();
    try {
      const postgres = AppDataSource.options.type === 'postgres';
      if (productIds.length) {
        const placeholders = productIds.map((_, i) => postgres ? `$${i + 1}` : '?').join(',');
        const products = await AppDataSource.query(
          `SELECT id, vendor_id FROM catalog_products WHERE CAST(id AS ${postgres ? 'TEXT' : 'CHAR'}) IN (${placeholders})`,
          productIds,
        ) as Array<Record<string, unknown>>;
        for (const product of products) productVendors.set(String(product.id), String(product.vendor_id ?? ''));
      }
      const vendorIds = [...new Set([...directVendorIds, ...productVendors.values()].filter(Boolean))];
      if (vendorIds.length) {
        const placeholders = vendorIds.map((_, i) => postgres ? `$${i + 1}` : '?').join(',');
        const vendors = await AppDataSource.query(
          `SELECT id, trending FROM catalog_vendors WHERE CAST(id AS ${postgres ? 'TEXT' : 'CHAR'}) IN (${placeholders})`,
          vendorIds,
        ) as Array<Record<string, unknown>>;
        for (const vendor of vendors) {
          if (vendor.trending === true || vendor.trending === 1 || vendor.trending === '1') trendingVendors.add(String(vendor.id));
        }
      }
    } catch {
      // Catalog lookup is ranking-only; active admin ads still work if it is unavailable.
    }

    eligible.sort((a, b) => {
      const aProduct = String(a.meta.productId ?? a.meta.selectedProductId ?? '').trim();
      const bProduct = String(b.meta.productId ?? b.meta.selectedProductId ?? '').trim();
      const aVendor = String(a.meta.vendorId ?? a.meta.selectedVendorId ?? productVendors.get(aProduct) ?? '').trim();
      const bVendor = String(b.meta.vendorId ?? b.meta.selectedVendorId ?? productVendors.get(bProduct) ?? '').trim();
      const trendDiff = Number(trendingVendors.has(bVendor)) - Number(trendingVendors.has(aVendor));
      if (trendDiff) return trendDiff;
      return Number(a.row.sort_order ?? 0) - Number(b.row.sort_order ?? 0);
    });

    const out: Array<Record<string, unknown>> = [];
    for (const { row: r, meta } of eligible) {
      const desktopImage = (typeof meta.desktopImageUrl === 'string' && meta.desktopImageUrl) || (typeof r.image_url === 'string' ? r.image_url : null);
      const mobileImage = (typeof meta.mobileImageUrl === 'string' && meta.mobileImageUrl) || desktopImage;
      const productId = String(meta.productId ?? meta.selectedProductId ?? '').trim() || null;
      const vendorId = String(meta.vendorId ?? meta.selectedVendorId ?? (productId ? productVendors.get(productId) : '') ?? '').trim() || null;
      const targetType = String(meta.targetType ?? meta.linkType ?? (productId ? 'Product' : vendorId ? 'Vendor' : 'Custom URL'));
      out.push({
        id: `ad-${r.id}`,
        isSponsored: true,
        title: r.title,
        image: desktopImage ? normalizeMediaUrl(String(desktopImage)) : null,
        desktopImage: desktopImage ? normalizeMediaUrl(String(desktopImage)) : null,
        mobileImage: mobileImage ? normalizeMediaUrl(String(mobileImage)) : null,
        caption: (typeof meta.caption === 'string' && meta.caption) || (typeof meta.description === 'string' && meta.description) || '',
        advertiser: typeof meta.advertiser === 'string' ? meta.advertiser : '',
        redirectUrl: (typeof r.redirect_url === 'string' && r.redirect_url) || null,
        targetType,
        productId,
        vendorId,
        trendingVendor: vendorId ? trendingVendors.has(vendorId) : false,
        createdAt: r.created_at ?? null,
      });
      if (out.length >= cap) break;
    }
    return out;
  }

  async getUserPosts(userId: string, limit: number, offset: number) {
    const rows = await AppDataSource.getRepository(SocialPost).find({
      where: { authorId: userId, status: 'published' },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return withAuthors(rows.map(withNormalizedMedia));
  }

  async deletePost(authorId: string, postId: string) {
    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SocialPost);
      const post = await repo.findOne({ where: { id: postId, authorId } });
      if (!post) return null;

      // Hard-delete the post's media rows so blob bytes don't linger in the DB
      // after the post is taken down. Only ids we own via /socio-uploads/media/{id}
      // URLs — external URLs are left alone.
      const mediaIds = (post.mediaUrls ?? [])
        .map(mediaIdFromUrl)
        .filter((v): v is string => v != null);
      if (mediaIds.length > 0) {
        await deleteMediaByIds(mediaIds);
      }

      post.status = 'deleted';
      return repo.save(post);
    });
  }

  /** Normalize media URLs and attach author display fields. */
  async formatPosts(rows: SocialPost[]) {
    return withAuthors(rows.map(withNormalizedMedia));
  }
}
