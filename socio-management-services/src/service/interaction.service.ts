import { AppDataSource } from '../config/database';
import { PostLike } from '../entities/PostLike';
import { PostComment } from '../entities/PostComment';
import { UserFollow } from '../entities/UserFollow';
import { SocialPost } from '../entities/SocialPost';
import { SocioRewardPointsService } from './socioRewardPoints.service';
import { resolveAuthor, resolveAuthorMap, withAuthor } from './authorProfile.service';

export class InteractionService {
  private rewardPoints = new SocioRewardPointsService();

  async likePost(userId: string, postId: string) {
    return AppDataSource.transaction(async (manager) => {
      const likeRepo = manager.getRepository(PostLike);
      const existing = await likeRepo.findOne({ where: { postId, userId } });
      if (existing) return existing;

      const postRepo = manager.getRepository(SocialPost);
      const post = await postRepo.findOne({ where: { id: postId } });
      if (!post) throw new Error('Post not found');

      const like = await likeRepo.save(likeRepo.create({ postId, userId }));

      await postRepo.increment({ id: postId }, 'likeCount', 1);

      // Award POST_LIKE_POINTS to the post OWNER (not the liker). The unique (postId, userId)
      // guard above ensures this fires at most once per liker. Self-likes earn nothing.
      if (post.authorId && post.authorId !== userId) {
        await this.rewardPoints.creditPostLikeInTransaction(manager, post.authorId, postId, userId);
      }

      return like;
    });
  }

  async unlikePost(userId: string, postId: string) {
    return AppDataSource.transaction(async (manager) => {
      const likeRepo = manager.getRepository(PostLike);
      const existing = await likeRepo.findOne({ where: { postId, userId } });
      if (!existing) return false;

      await likeRepo.remove(existing);

      const postRepo = manager.getRepository(SocialPost);
      const post = await postRepo.findOne({ where: { id: postId } });
      await postRepo.decrement({ id: postId }, 'likeCount', 1);

      // Reverse the point that was awarded to the post owner for this like (if any).
      if (post && post.authorId && post.authorId !== userId) {
        await this.rewardPoints.reversePostLikeInTransaction(manager, post.authorId, postId, userId);
      }

      return true;
    });
  }

  /** Increments shareCount and credits POST_SHARE_POINTS to the sharer's wallet. */
  async sharePost(userId: string, postId: string) {
    return AppDataSource.transaction(async (manager) => {
      const postRepo = manager.getRepository(SocialPost);
      await postRepo.increment({ id: postId }, 'shareCount', 1);
      await this.rewardPoints.creditPostShareInTransaction(manager, userId, postId);
      return { postId, sharedBy: userId };
    });
  }

  async addComment(userId: string, postId: string, data: { contentText: string; parentCommentId?: string }) {
    const commentRepo = AppDataSource.getRepository(PostComment);
    const comment = await commentRepo.save(
      commentRepo.create({
        postId,
        userId,
        contentText: data.contentText,
        parentCommentId: data.parentCommentId || null,
        status: 'published',
      })
    );

    const postRepo = AppDataSource.getRepository(SocialPost);
    await postRepo.increment({ id: postId }, 'commentCount', 1);

    // Return with author info so the new comment renders the name immediately.
    const author = await resolveAuthor(userId);
    return { ...comment, ...author };
  }

  async listComments(postId: string, limit: number, offset: number) {
    const [rows, total] = await AppDataSource.getRepository(PostComment).findAndCount({
      where: { postId, status: 'published' },
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
    });
    const map = await resolveAuthorMap(rows.map((r) => r.userId));
    return [rows.map((r) => withAuthor(r, r.userId, map)), total] as const;
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) throw new Error('Cannot follow yourself');

    const repo = AppDataSource.getRepository(UserFollow);
    const existing = await repo.findOne({ where: { followerId, followingId } });
    if (existing) return existing;

    return repo.save(repo.create({ followerId, followingId }));
  }

  async unfollowUser(followerId: string, followingId: string) {
    const repo = AppDataSource.getRepository(UserFollow);
    const existing = await repo.findOne({ where: { followerId, followingId } });
    if (!existing) return false;
    await repo.remove(existing);
    return true;
  }

  async getFollowers(userId: string, limit: number, offset: number) {
    return AppDataSource.getRepository(UserFollow).findAndCount({
      where: { followingId: userId },
      skip: offset,
      take: limit,
    });
  }

  async getFollowing(userId: string, limit: number, offset: number) {
    return AppDataSource.getRepository(UserFollow).findAndCount({
      where: { followerId: userId },
      skip: offset,
      take: limit,
    });
  }

  async getSuggestions(userId: string, limit: number) {
    const followingIds = await AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('f.following_id', 'followingId')
      .where('f.follower_id = :userId', { userId })
      .getRawMany();

    const excludeIds = [userId, ...followingIds.map((r) => r.followingId)];

    return AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('DISTINCT f.follower_id', 'userId')
      .where('f.follower_id NOT IN (:...excludeIds)', { excludeIds })
      .limit(limit)
      .getRawMany();
  }
}
