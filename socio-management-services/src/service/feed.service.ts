import { AppDataSource } from '../config/database';
import { SocialPost } from '../entities/SocialPost';
import { UserFollow } from '../entities/UserFollow';
import { deleteMediaByIds } from '../service/socialMediaStorage.service';
import { resolveAuthor, resolveAuthorMap, withAuthor } from '../service/authorProfile.service';
import { normalizeMediaUrl, normalizeMediaUrlList } from '../util/normalizeMediaUrl';

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
    },
  ) {
    const repo = AppDataSource.getRepository(SocialPost);
    const metadata: Record<string, unknown> = {};
    if (data.location?.trim()) metadata.location = data.location.trim();
    if (data.tags?.length) metadata.tags = data.tags.map((t) => t.trim()).filter(Boolean);

    const saved = await repo.save(
      repo.create({
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

    const ids = followingIds.map((r) => r.followingId);
    if (ids.length === 0) return [];

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

  async getPublicFeed(limit: number, offset: number) {
    const rows = await AppDataSource.getRepository(SocialPost).find({
      where: { status: 'published', visibility: 'public' },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return withAuthors(rows.map(withNormalizedMedia));
  }

  async getUserPosts(userId: string, limit: number, offset: number) {
    const rows = await AppDataSource.getRepository(SocialPost).find({
      where: { authorId: userId },
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
}
