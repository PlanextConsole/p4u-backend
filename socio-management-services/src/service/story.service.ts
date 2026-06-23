import { AppDataSource } from '../config/database';
import { Story } from '../entities/Story';
import { UserFollow } from '../entities/UserFollow';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CustomerProfile } from '../entities/CustomerProfile';
import { deleteMediaByIds } from '../service/socialMediaStorage.service';
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
    return repo.save(
      repo.create({
        authorId,
        mediaUrl: normalizeMediaUrl(data.mediaUrl) ?? data.mediaUrl,
        mediaType: data.mediaType || 'image',
        textOverlay: data.textOverlay || null,
        expiresAt,
        status: 'active',
      })
    );
  }

  async getFeedStories(userId: string) {
    // Sweep expired stories on read so feeds stay clean without a cron.
    await this.expireOldStories();

    const followingIds = await AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('f.following_id', 'followingId')
      .where('f.follower_id = :userId', { userId })
      .getRawMany();

    const ids = followingIds.map((r) => r.followingId);
    if (ids.length === 0) return [];

    return AppDataSource.getRepository(Story)
      .createQueryBuilder('s')
      .where('s.author_id IN (:...ids)', { ids })
      .andWhere('s.expires_at > :now', { now: new Date() })
      .andWhere('s.status = :status', { status: 'active' })
      .orderBy('s.created_at', 'DESC')
      .getMany()
      .then((rows) =>
        rows.map((s) => ({ ...s, mediaUrl: normalizeMediaUrl(s.mediaUrl) ?? s.mediaUrl })),
      );
  }

  async getMyStories(userId: string) {
    const rows = await AppDataSource.getRepository(Story).find({
      where: { authorId: userId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    return rows.map((s) => ({ ...s, mediaUrl: normalizeMediaUrl(s.mediaUrl) ?? s.mediaUrl }));
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

      await this.rewardPoints.creditStoryLikeInTransaction(manager, userKeycloakSub, storyId);
      return { storyId, alreadyLiked: false, likeCount: likeCount + 1 };
    });
  }
}
