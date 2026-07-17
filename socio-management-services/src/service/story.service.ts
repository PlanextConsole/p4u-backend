import { AppDataSource } from '../config/database';
import { randomUUID } from 'crypto';
import { Story } from '../entities/Story';
import { UserFollow } from '../entities/UserFollow';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CustomerProfile } from '../entities/CustomerProfile';
import { deleteMediaByIds } from '../service/socialMediaStorage.service';
import { resolveAuthor, resolveAuthorMap, withAuthor } from '../service/authorProfile.service';
import { normalizeMediaUrl } from '../util/normalizeMediaUrl';
import { SocioRewardPointsService } from './socioRewardPoints.service';

function mediaIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/socio-uploads\/media\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

export class StoryService {
  private rewardPoints = new SocioRewardPointsService();
  async createStory(authorId: string, data: { mediaUrl: string; mediaType?: string; textOverlay?: string }) {
    const repo = AppDataSource.getRepository(Story);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const saved = await repo.save(
      repo.create({
        id: randomUUID(),
        authorId,
        mediaUrl: normalizeMediaUrl(data.mediaUrl) ?? data.mediaUrl,
        mediaType: data.mediaType || 'image',
        textOverlay: data.textOverlay || null,
        expiresAt,
        status: 'active',
      })
    );
    const author = await resolveAuthor(authorId);
    return { ...saved, mediaUrl: normalizeMediaUrl(saved.mediaUrl) ?? saved.mediaUrl, ...author };
  }

  async getFeedStories(userId: string) {
    // Sweep expired stories on read so feeds stay clean without a cron.
    await this.expireOldStories();

    const followingIds = await AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('f.following_id', 'followingId')
      .where('f.follower_id = :userId', { userId })
      .getRawMany();

    // Include the viewer's own active stories so a freshly posted story shows in
    // the rail immediately, alongside the stories of people they follow.
    const ids = [...new Set([userId, ...followingIds.map((r) => r.followingId)])];

    const rows = await AppDataSource.getRepository(Story)
      .createQueryBuilder('s')
      .where('s.author_id IN (:...ids)', { ids })
      .andWhere('s.expires_at > :now', { now: new Date() })
      .andWhere('s.status = :status', { status: 'active' })
      .orderBy('s.created_at', 'DESC')
      .getMany();

    const map = await resolveAuthorMap(rows.map((r) => r.authorId));
    return rows.map((s) =>
      withAuthor({ ...s, mediaUrl: normalizeMediaUrl(s.mediaUrl) ?? s.mediaUrl }, s.authorId, map),
    );
  }

  async getMyStories(userId: string) {
    // Only non-expired stories — expired ones must not show in the UI.
    await this.expireOldStories();
    const rows = await AppDataSource.getRepository(Story)
      .createQueryBuilder('s')
      .where('s.author_id = :userId', { userId })
      .andWhere('s.expires_at > :now', { now: new Date() })
      .andWhere('s.status = :status', { status: 'active' })
      .orderBy('s.created_at', 'DESC')
      .getMany();
    const author = await resolveAuthor(userId);
    return rows.map((s) => ({ ...s, mediaUrl: normalizeMediaUrl(s.mediaUrl) ?? s.mediaUrl, ...author }));
  }

  /**
   * Marks expired stories as `expired` so they stop showing in feeds. Lazy strategy:
   * invoked at the start of feed reads so the first user to load after the 24h window
   * flips the flag (no separate cron needed). Also reclaims the underlying media blob
   * rows so 24h-old story media doesn't sit in the DB forever.
   * Returns the number of stories transitioned.
   */
  async expireOldStories(): Promise<number> {
    return AppDataSource.transaction(async (manager) => {
      const storyRepo = manager.getRepository(Story);
      const newlyExpired = await storyRepo.find({
        where: { status: 'active' },
        // narrow to only those past expires_at — same filter as the UPDATE below
      });
      const now = new Date();
      const targets = newlyExpired.filter((s) => s.expiresAt && s.expiresAt.getTime() <= now.getTime());
      if (targets.length === 0) return 0;

      const mediaIds = targets
        .map((s) => mediaIdFromUrl(s.mediaUrl))
        .filter((v): v is string => v != null);

      await storyRepo
        .createQueryBuilder()
        .update(Story)
        .set({ status: 'expired' })
        .whereInIds(targets.map((s) => s.id))
        .execute();

      if (mediaIds.length > 0) {
        await deleteMediaByIds(mediaIds);
      }
      return targets.length;
    });
  }

  async markStoryViewed(storyId: string) {
    const repo = AppDataSource.getRepository(Story);
    await repo.increment({ id: storyId }, 'viewCount', 1);
    return repo.findOne({ where: { id: storyId } });
  }

  /**
   * Likes a story (idempotent per user via metadata.likedBy[]) and credits the user's wallet
   * with STORY_LIKE_POINTS. No separate StoryLike table — kept lightweight on the story metadata.
   */
  async likeStory(userKeycloakSub: string, storyId: string) {
    return AppDataSource.transaction(async (manager) => {
      const storyRepo = manager.getRepository(Story);
      const story = await storyRepo.findOne({ where: { id: storyId } });
      if (!story) throw new Error('Story not found');

      const meta = (story.metadata ?? {}) as Record<string, unknown>;
      const likedBy = Array.isArray(meta.likedBy) ? (meta.likedBy as string[]) : [];
      if (likedBy.includes(userKeycloakSub)) {
        return { storyId, alreadyLiked: true };
      }
      const likeCount = typeof meta.likeCount === 'number' ? (meta.likeCount as number) : 0;
      story.metadata = { ...meta, likedBy: [...likedBy, userKeycloakSub], likeCount: likeCount + 1 };
      await storyRepo.save(story);

      if (story.authorId && story.authorId !== userKeycloakSub) {
        await this.rewardPoints.creditStoryLikeInTransaction(manager, story.authorId, storyId, userKeycloakSub);
      }
      return { storyId, alreadyLiked: false, likeCount: likeCount + 1 };
    });
  }
}
