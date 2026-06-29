import { AppDataSource } from '../../config/database';
import { Customer } from '../customers/entities/Customer';
import { ObjectionableFeedLog } from '../posts/entities/ObjectionableFeedLog';
import { AdminSocialPost } from './entities/AdminSocialPost';
import { AdminSocialStory } from './entities/AdminSocialStory';
import { AdminSocialUserFollow } from './entities/AdminSocialUserFollow';
import { AdminSocialMedia } from './entities/AdminSocialMedia';
import { AuditService } from '../admin-core/services/audit.service';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function metaBool(meta: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!meta || typeof meta !== 'object') return false;
  for (const k of keys) {
    const v = meta[k];
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
  }
  return false;
}

function metaString(meta: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!meta || typeof meta !== 'object') return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function buildUsername(fullName: string, keycloakUserId: string | null, meta: Record<string, unknown> | null): string {
  const fromMeta = metaString(meta, ['username', 'userName', 'socialUsername', 'handle']);
  if (fromMeta) return fromMeta.startsWith('@') ? fromMeta : `@${fromMeta}`;
  const base = (fullName || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'user';
  const suffix = (keycloakUserId || '0000').replace(/-/g, '').slice(0, 4).toLowerCase();
  return `@${base}_${suffix}`;
}

function accountType(meta: Record<string, unknown> | null): string {
  const t = metaString(meta, ['accountType', 'profileType', 'userType']);
  if (!t) return 'Personal';
  const normalized = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return normalized;
}

function postTypeLabel(postType: string): string {
  const t = (postType || 'text').toLowerCase();
  if (t === 'reel' || t === 'video') return 'Reel';
  if (t === 'photo' || t === 'image') return 'Photo';
  if (t === 'text') return 'Text';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function isReelType(postType: string): boolean {
  const t = (postType || '').toLowerCase();
  return t === 'reel' || t === 'video';
}

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function extractHashtagsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/#[\w\u0080-\uFFFF]+/g);
  return matches ? matches.map((t) => t.toLowerCase()) : [];
}

function extractHashtagsFromMeta(meta: Record<string, unknown> | null): string[] {
  if (!meta) return [];
  const tags = meta.tags ?? meta.hashtags;
  if (Array.isArray(tags)) {
    return tags
      .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
  }
  return [];
}

export class SocialAdminService {
  private audit = new AuditService();

  async getDashboard(): Promise<{
    overview: { totalUsers: number; totalPosts: number; verified: number; creators: number };
    contentChart: { categories: string[]; posts: number[]; reels: number[]; stories: number[] };
    growthChart: { categories: string[]; users: number[] };
  }> {
    const customerRepo = AppDataSource.getRepository(Customer);
    const postRepo = AppDataSource.getRepository(AdminSocialPost);
    const storyRepo = AppDataSource.getRepository(AdminSocialStory);

    const socialCustomers = await customerRepo
      .createQueryBuilder('c')
      .where('c.keycloak_user_id IS NOT NULL')
      .andWhere("c.keycloak_user_id <> ''")
      .getMany();

    const totalUsers = socialCustomers.length;
    const totalPosts = await postRepo.count({ where: { status: 'published' } });

    let verified = 0;
    let creators = 0;
    for (const c of socialCustomers) {
      const meta = (c.metadata && typeof c.metadata === 'object' ? c.metadata : null) as Record<string, unknown> | null;
      if (metaBool(meta, ['verified', 'isVerified', 'is_verified'])) verified += 1;
      const type = (metaString(meta, ['accountType', 'profileType']) || '').toLowerCase();
      if (type === 'creator' || type === 'business') creators += 1;
    }

    if (creators === 0) {
      const authorRows = await postRepo
        .createQueryBuilder('p')
        .select('p.author_id', 'authorId')
        .addSelect('COUNT(*)', 'cnt')
        .where("p.status = 'published'")
        .groupBy('p.author_id')
        .having('cnt >= 3')
        .getRawMany<{ authorId: string; cnt: string }>();
      creators = authorRows.length;
    }

    const weekStart = startOfWeekMonday(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const postsThisWeek = await postRepo
      .createQueryBuilder('p')
      .where('p.created_at >= :start AND p.created_at < :end', { start: weekStart, end: weekEnd })
      .andWhere("p.status <> 'deleted'")
      .getMany();

    const storiesThisWeek = await storyRepo
      .createQueryBuilder('s')
      .where('s.created_at >= :start AND s.created_at < :end', { start: weekStart, end: weekEnd })
      .getMany();

    const posts = Array(7).fill(0);
    const reels = Array(7).fill(0);
    const stories = Array(7).fill(0);

    for (const p of postsThisWeek) {
      const idx = (new Date(p.createdAt).getDay() + 6) % 7;
      if (isReelType(p.postType)) reels[idx] += 1;
      else posts[idx] += 1;
    }
    for (const s of storiesThisWeek) {
      const idx = (new Date(s.createdAt).getDay() + 6) % 7;
      stories[idx] += 1;
    }

    const growthCategories: string[] = [];
    const growthUsers: number[] = [];
    const now = new Date();
    for (let w = 5; w >= 0; w -= 1) {
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);
      end.setHours(23, 59, 59, 999);
      growthCategories.push(`W${6 - w}`);
      const count = socialCustomers.filter((c) => new Date(c.createdAt).getTime() <= end.getTime()).length;
      growthUsers.push(count);
    }

    return {
      overview: { totalUsers, totalPosts, verified, creators },
      contentChart: { categories: [...DAY_LABELS], posts, reels, stories },
      growthChart: { categories: growthCategories, users: growthUsers },
    };
  }

  async listUsers(
    limit: number,
    offset: number,
    search?: string,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const customerRepo = AppDataSource.getRepository(Customer);
    const postRepo = AppDataSource.getRepository(AdminSocialPost);
    const followRepo = AppDataSource.getRepository(AdminSocialUserFollow);

    const qb = customerRepo
      .createQueryBuilder('c')
      .where('c.keycloak_user_id IS NOT NULL')
      .andWhere("c.keycloak_user_id <> ''")
      .orderBy('c.created_at', 'DESC');

    const q = (search || '').trim().toLowerCase();
    if (q) {
      qb.andWhere('(LOWER(c.full_name) LIKE :q OR LOWER(c.email) LIKE :q OR LOWER(c.phone) LIKE :q)', {
        q: `%${q}%`,
      });
    }

    const total = await qb.getCount();
    const customers = await qb.skip(offset).take(limit).getMany();

    const items = await Promise.all(
      customers.map(async (c) => {
        const meta = (c.metadata && typeof c.metadata === 'object' ? c.metadata : null) as Record<string, unknown> | null;
        const userId = c.keycloakUserId!;
        const postCount = await postRepo.count({ where: { authorId: userId, status: 'published' } });
        const followerCount = await followRepo.count({ where: { followingId: userId } });
        return {
          id: c.id,
          userId,
          username: buildUsername(c.fullName, c.keycloakUserId, meta),
          name: c.fullName,
          type: accountType(meta),
          followers: followerCount,
          posts: postCount,
          verified: metaBool(meta, ['verified', 'isVerified', 'is_verified']),
          status: c.status,
        };
      }),
    );

    return { items, total };
  }

  async listPosts(
    limit: number,
    offset: number,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const postRepo = AppDataSource.getRepository(AdminSocialPost);
    const [rows, total] = await postRepo
      .createQueryBuilder('p')
      .where("p.status IN ('published', 'hidden')")
      .orderBy('p.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const authorIds = [...new Set(rows.map((r) => r.authorId))];
    const authorMap = await this.resolveAuthors(authorIds);

    const items = rows.map((p) => ({
      id: p.id,
      type: postTypeLabel(p.postType),
      postType: p.postType,
      caption: (p.contentText || '—').trim() || '—',
      likes: p.likeCount,
      comments: p.commentCount,
      shares: p.shareCount,
      status: p.status,
      authorId: p.authorId,
      authorName: authorMap.get(p.authorId)?.name || 'P4U User',
      createdAt: p.createdAt,
    }));

    return { items, total };
  }

  async removePost(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(AdminSocialPost);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Social post not found');
    row.status = 'deleted';
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'AdminSocialPost',
      entityId: id,
      metadata: { status: 'deleted' },
      ipAddress: ip ?? null,
    });
  }

  async listReports(
    limit: number,
    offset: number,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const logRepo = AppDataSource.getRepository(ObjectionableFeedLog);
    const postRepo = AppDataSource.getRepository(AdminSocialPost);
    const [logs, total] = await logRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const postIds = logs.map((l) => l.postId).filter((id): id is string => Boolean(id));
    const posts = postIds.length
      ? await postRepo.createQueryBuilder('p').where('p.id IN (:...ids)', { ids: postIds }).getMany()
      : [];
    const postMap = new Map(posts.map((p) => [p.id, p]));

    const items = logs.map((log) => {
      const post = log.postId ? postMap.get(log.postId) : undefined;
      const meta = (log.metadata && typeof log.metadata === 'object' ? log.metadata : {}) as Record<string, unknown>;
      return {
        id: log.id,
        postId: log.postId,
        status: log.status,
        reasonCode: log.reasonCode,
        reviewNotes: log.reviewNotes,
        createdAt: log.createdAt,
        type: post ? postTypeLabel(post.postType) : metaString(meta, ['type', 'postType']) || '—',
        caption: post?.contentText?.trim() || metaString(meta, ['caption', 'content']) || '—',
        likes: post?.likeCount ?? 0,
        comments: post?.commentCount ?? 0,
      };
    });

    return { items, total };
  }

  async listHashtags(limit: number): Promise<{ items: Array<{ tag: string; posts: number; reach: number; status: string }> }> {
    const postRepo = AppDataSource.getRepository(AdminSocialPost);
    const posts = await postRepo.find({
      where: { status: 'published' },
      select: ['id', 'contentText', 'metadata', 'likeCount', 'shareCount', 'commentCount'],
      take: 2000,
      order: { createdAt: 'DESC' },
    });

    const counts = new Map<string, { posts: number; reach: number }>();
    for (const p of posts) {
      const meta = (p.metadata && typeof p.metadata === 'object' ? p.metadata : null) as Record<string, unknown> | null;
      const tags = [...extractHashtagsFromText(p.contentText), ...extractHashtagsFromMeta(meta)];
      const reach = p.likeCount + p.shareCount + p.commentCount;
      for (const tag of new Set(tags)) {
        const cur = counts.get(tag) || { posts: 0, reach: 0 };
        cur.posts += 1;
        cur.reach += reach;
        counts.set(tag, cur);
      }
    }

    const items = [...counts.entries()]
      .map(([tag, v]) => ({
        tag,
        posts: v.posts,
        reach: v.reach,
        status: v.posts >= 5 ? 'active' : 'review',
      }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, limit);

    return { items };
  }

  async listAudio(limit: number, offset: number): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const mediaRepo = AppDataSource.getRepository(AdminSocialMedia);
    const qb = mediaRepo
      .createQueryBuilder('m')
      .where("(m.kind = 'audio' OR m.mime_type LIKE 'audio/%')")
      .orderBy('m.created_at', 'DESC');

    const total = await qb.getCount();
    const rows = await qb.skip(offset).take(limit).getMany();

    const ownerIds = [...new Set(rows.map((r) => r.ownerId))];
    const authorMap = await this.resolveAuthors(ownerIds);

    const usageRows = await AppDataSource.getRepository(AdminSocialPost)
      .createQueryBuilder('p')
      .select('p.metadata', 'metadata')
      .where("p.status = 'published'")
      .getRawMany<{ metadata: Record<string, unknown> | null }>();

    const usageByMediaId = new Map<string, number>();
    for (const row of usageRows) {
      const meta = row.metadata;
      if (!meta || typeof meta !== 'object') continue;
      const audioId = meta.audioId ?? meta.audioMediaId ?? meta.soundId;
      if (typeof audioId === 'string' && audioId) {
        usageByMediaId.set(audioId, (usageByMediaId.get(audioId) || 0) + 1);
      }
    }

    const items = rows.map((m) => {
      const owner = authorMap.get(m.ownerId);
      return {
        id: m.id,
        title: m.originalName || `Audio ${m.id.slice(0, 8)}`,
        owner: owner?.name || 'P4U Library',
        usage: usageByMediaId.get(m.id) || 0,
        status: 'active',
        mimeType: m.mimeType,
        createdAt: m.createdAt,
      };
    });

    return { items, total };
  }

  private async resolveAuthors(ids: string[]): Promise<Map<string, { name: string }>> {
    const map = new Map<string, { name: string }>();
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return map;

    const customers = await AppDataSource.getRepository(Customer)
      .createQueryBuilder('c')
      .where('c.keycloak_user_id IN (:...ids)', { ids: unique })
      .getMany();

    for (const c of customers) {
      if (c.keycloakUserId) map.set(c.keycloakUserId, { name: c.fullName || 'P4U User' });
    }
    return map;
  }
}
