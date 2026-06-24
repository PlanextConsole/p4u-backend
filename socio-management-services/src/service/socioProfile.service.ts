import { AppDataSource } from '../config/database';
import { SocialPost } from '../entities/SocialPost';
import { UserFollow } from '../entities/UserFollow';
import { CustomerProfile } from '../entities/CustomerProfile';
import { resolveAuthor } from './authorProfile.service';

export type SocioUserProfile = {
  userId: string;
  userName: string;
  userAvatar: string | null;
  bio: string | null;
  postCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
};

function bioFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const keys = ['bio', 'about', 'description'];
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export class SocioProfileService {
  async getProfile(viewerId: string, targetUserId: string): Promise<SocioUserProfile> {
    const author = await resolveAuthor(targetUserId);
    const postRepo = AppDataSource.getRepository(SocialPost);
    const followRepo = AppDataSource.getRepository(UserFollow);

    const postCount = await postRepo.count({
      where: { authorId: targetUserId, status: 'published' },
    });
    const followerCount = await followRepo.count({ where: { followingId: targetUserId } });
    const followingCount = await followRepo.count({ where: { followerId: targetUserId } });

    let bio: string | null = null;
    const profile = await AppDataSource.getRepository(CustomerProfile).findOne({
      where: { keycloakUserId: targetUserId },
    });
    if (profile?.metadata && typeof profile.metadata === 'object') {
      bio = bioFromMetadata(profile.metadata as Record<string, unknown>);
    }

    let isFollowing = false;
    if (viewerId && viewerId !== targetUserId) {
      isFollowing = Boolean(
        await followRepo.findOne({ where: { followerId: viewerId, followingId: targetUserId } }),
      );
    }

    return {
      userId: targetUserId,
      userName: author.userName,
      userAvatar: author.userAvatar,
      bio,
      postCount,
      followerCount,
      followingCount,
      isFollowing,
      isSelf: viewerId === targetUserId,
    };
  }
}
