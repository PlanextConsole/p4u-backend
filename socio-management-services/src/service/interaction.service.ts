import { AppDataSource } from '../config/database';
import { In } from 'typeorm';
import { PostLike } from '../entities/PostLike';
import { PostComment } from '../entities/PostComment';
import { PostSave } from '../entities/PostSave';
import { UserFollow } from '../entities/UserFollow';
import { SocialPost } from '../entities/SocialPost';
import { CustomerProfile } from '../entities/CustomerProfile';
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
      const post = await postRepo.findOne({ where: { id: postId, status: 'published' } });
      if (!post) {
        const err = new Error('Post not found');
        (err as Error & { statusCode?: number }).statusCode = 404;
        throw err;
      }

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
      const post = await postRepo.findOne({ where: { id: postId, status: 'published' } });
      if (!post) {
        const err = new Error('Post not found');
        (err as Error & { statusCode?: number }).statusCode = 404;
        throw err;
      }
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
    const [rows, total] = await AppDataSource.getRepository(UserFollow).findAndCount({
      where: { followingId: userId },
      skip: offset,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    const users = await this.enrichUserIds(rows.map((r) => r.followerId));
    return [users, total] as const;
  }

  async getFollowing(userId: string, limit: number, offset: number) {
    const [rows, total] = await AppDataSource.getRepository(UserFollow).findAndCount({
      where: { followerId: userId },
      skip: offset,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    const users = await this.enrichUserIds(rows.map((r) => r.followingId));
    return [users, total] as const;
  }

  async getSuggestions(userId: string, limit: number) {
    const followingIds = await AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('f.following_id', 'followingId')
      .where('f.follower_id = :userId', { userId })
      .getRawMany();

    const excludeIds = [userId, ...followingIds.map((r) => r.followingId)];

    const raw = await AppDataSource.getRepository(UserFollow)
      .createQueryBuilder('f')
      .select('DISTINCT f.follower_id', 'userId')
      .where('f.follower_id NOT IN (:...excludeIds)', { excludeIds })
      .limit(limit)
      .getRawMany<{ userId: string }>();

    const ids = raw.map((r) => r.userId).filter(Boolean);
    if (ids.length === 0) {
      const profiles = await AppDataSource.getRepository(CustomerProfile)
        .createQueryBuilder('c')
        .where('c.keycloak_user_id IS NOT NULL')
        .andWhere('c.keycloak_user_id NOT IN (:...excludeIds)', { excludeIds })
        .orderBy('c.created_at', 'DESC')
        .limit(limit)
        .getMany();
      return this.enrichUserIds(profiles.map((p) => p.keycloakUserId).filter(Boolean) as string[]);
    }
    return this.enrichUserIds(ids);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId || followerId === followingId) return false;
    const row = await AppDataSource.getRepository(UserFollow).findOne({
      where: { followerId, followingId },
    });
    return Boolean(row);
  }

  async getLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    const rows = await AppDataSource.getRepository(PostLike).find({
      where: { userId, postId: In(postIds) },
    });
    return new Set(rows.map((r) => r.postId));
  }

  async getSavedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
    if (!postIds.length) return new Set();
    const rows = await AppDataSource.getRepository(PostSave).find({
      where: { userId, postId: In(postIds) },
    });
    return new Set(rows.map((r) => r.postId));
  }

  async savePost(userId: string, postId: string) {
    const post = await AppDataSource.getRepository(SocialPost).findOne({
      where: { id: postId, status: 'published' },
    });
    if (!post) {
      const err = new Error('Post not found');
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const repo = AppDataSource.getRepository(PostSave);
    const existing = await repo.findOne({ where: { postId, userId } });
    if (existing) return existing;
    return repo.save(repo.create({ postId, userId }));
  }

  async unsavePost(userId: string, postId: string) {
    const repo = AppDataSource.getRepository(PostSave);
    const existing = await repo.findOne({ where: { postId, userId } });
    if (!existing) return false;
    await repo.remove(existing);
    return true;
  }

  async listSavedPosts(userId: string, limit: number, offset: number) {
    const saveRepo = AppDataSource.getRepository(PostSave);
    const [saves, total] = await saveRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    if (!saves.length) return [[], 0] as [SocialPost[], number];
    const postIds = saves.map((s) => s.postId);
    const posts = await AppDataSource.getRepository(SocialPost).find({ where: { id: In(postIds) } });
    const byId = new Map(posts.map((p) => [p.id, p]));
    const ordered = postIds.map((id) => byId.get(id)).filter(Boolean) as SocialPost[];
    return [ordered, total] as const;
  }

  async attachPostFlags<T extends { id: string; authorId: string }>(
    viewerId: string,
    posts: T[],
  ): Promise<Array<T & { isLiked: boolean; isSaved: boolean; isFollowingAuthor: boolean }>> {
    if (!posts.length) return [];
    const postIds = posts.map((p) => p.id);
    const liked = await this.getLikedPostIds(viewerId, postIds);
    const saved = await this.getSavedPostIds(viewerId, postIds);
    const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean))];
    const followingChecks = await Promise.all(
      authorIds.map(async (aid) => ({ aid, ok: await this.isFollowing(viewerId, aid) })),
    );
    const followingSet = new Set(followingChecks.filter((x) => x.ok).map((x) => x.aid));
    return posts.map((p) => ({
      ...p,
      isLiked: liked.has(p.id),
      isSaved: saved.has(p.id),
      isFollowingAuthor: followingSet.has(p.authorId),
    }));
  }

  async getActivityNotifications(userId: string, limit: number) {
    const postRepo = AppDataSource.getRepository(SocialPost);
    const myPosts = await postRepo.find({
      where: { authorId: userId, status: 'published' },
      select: ['id'],
      take: 200,
    });
    const myPostIds = myPosts.map((p) => p.id);
    const items: Array<{
      id: string;
      type: 'like' | 'comment' | 'follow';
      actorId: string;
      actorName: string;
      actorAvatar: string | null;
      text: string;
      createdAt: Date;
      postId?: string;
    }> = [];

    if (myPostIds.length) {
      const likes = await AppDataSource.getRepository(PostLike).find({
        where: { postId: In(myPostIds) },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      const likeActors = await resolveAuthorMap(likes.map((l) => l.userId));
      for (const like of likes) {
        if (like.userId === userId) continue;
        const actor = likeActors.get(like.userId) || { userName: 'Someone', userAvatar: null };
        items.push({
          id: `like-${like.id}`,
          type: 'like',
          actorId: like.userId,
          actorName: actor.userName,
          actorAvatar: actor.userAvatar,
          text: 'liked your post',
          createdAt: like.createdAt,
          postId: like.postId,
        });
      }

      const comments = await AppDataSource.getRepository(PostComment).find({
        where: { postId: In(myPostIds), status: 'published' },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      const commentActors = await resolveAuthorMap(comments.map((c) => c.userId));
      for (const c of comments) {
        if (c.userId === userId) continue;
        const actor = commentActors.get(c.userId) || { userName: 'Someone', userAvatar: null };
        items.push({
          id: `comment-${c.id}`,
          type: 'comment',
          actorId: c.userId,
          actorName: actor.userName,
          actorAvatar: actor.userAvatar,
          text: `commented: ${(c.contentText || '').slice(0, 80)}`,
          createdAt: c.createdAt,
          postId: c.postId,
        });
      }
    }

    const follows = await AppDataSource.getRepository(UserFollow).find({
      where: { followingId: userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    const followActors = await resolveAuthorMap(follows.map((f) => f.followerId));
    for (const f of follows) {
      const actor = followActors.get(f.followerId) || { userName: 'Someone', userAvatar: null };
      items.push({
        id: `follow-${f.id}`,
        type: 'follow',
        actorId: f.followerId,
        actorName: actor.userName,
        actorAvatar: actor.userAvatar,
        text: 'started following you',
        createdAt: f.createdAt,
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.slice(0, limit);
  }

  private async enrichUserIds(userIds: string[]) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return [];
    const map = await resolveAuthorMap(unique);
    const postRepo = AppDataSource.getRepository(SocialPost);
    const out = [];
    for (const id of unique) {
      const info = map.get(id) || { userName: 'P4U User', userAvatar: null };
      const postCount = await postRepo.count({ where: { authorId: id, status: 'published' } });
      out.push({
        id,
        userId: id,
        name: info.userName,
        avatar: info.userAvatar,
        postCount,
      });
    }
    return out;
  }
}
