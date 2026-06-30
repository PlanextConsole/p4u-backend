import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entities/CustomerProfile';

export type SocialSettingsPayload = {
  privateAccount?: boolean;
  showActivityStatus?: boolean;
  storyReplies?: string;
  messageAllowFrom?: string;
  commentsAllowFrom?: string;
  filterOffensiveComments?: boolean;
  notifications?: Record<string, boolean>;
  dailyTimeLimitMinutes?: number;
  dailyReminder?: boolean;
  language?: string;
  closeFriends?: string[];
  blockedUsers?: string[];
};

export const DEFAULT_SOCIAL_SETTINGS: Required<SocialSettingsPayload> = {
  privateAccount: false,
  showActivityStatus: true,
  storyReplies: 'Everyone',
  messageAllowFrom: 'Everyone',
  commentsAllowFrom: 'Everyone',
  filterOffensiveComments: true,
  notifications: {
    likes: true,
    comments: true,
    follows: true,
    messages: true,
    reposts: true,
    mentions: true,
    liveVideos: false,
    emailNotifs: false,
  },
  dailyTimeLimitMinutes: 60,
  dailyReminder: true,
  language: 'English',
  closeFriends: [],
  blockedUsers: [],
};

function mergeSettings(raw: unknown): Required<SocialSettingsPayload> {
  const base = { ...DEFAULT_SOCIAL_SETTINGS, notifications: { ...DEFAULT_SOCIAL_SETTINGS.notifications } };
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as SocialSettingsPayload;
  return {
    privateAccount: typeof src.privateAccount === 'boolean' ? src.privateAccount : base.privateAccount,
    showActivityStatus: typeof src.showActivityStatus === 'boolean' ? src.showActivityStatus : base.showActivityStatus,
    storyReplies: typeof src.storyReplies === 'string' ? src.storyReplies : base.storyReplies,
    messageAllowFrom: typeof src.messageAllowFrom === 'string' ? src.messageAllowFrom : base.messageAllowFrom,
    commentsAllowFrom: typeof src.commentsAllowFrom === 'string' ? src.commentsAllowFrom : base.commentsAllowFrom,
    filterOffensiveComments:
      typeof src.filterOffensiveComments === 'boolean' ? src.filterOffensiveComments : base.filterOffensiveComments,
    notifications: {
      ...base.notifications,
      ...(src.notifications && typeof src.notifications === 'object' ? src.notifications : {}),
    },
    dailyTimeLimitMinutes:
      typeof src.dailyTimeLimitMinutes === 'number' ? src.dailyTimeLimitMinutes : base.dailyTimeLimitMinutes,
    dailyReminder: typeof src.dailyReminder === 'boolean' ? src.dailyReminder : base.dailyReminder,
    language: typeof src.language === 'string' ? src.language : base.language,
    closeFriends: Array.isArray(src.closeFriends)
      ? src.closeFriends.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : base.closeFriends,
    blockedUsers: Array.isArray(src.blockedUsers)
      ? src.blockedUsers.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : base.blockedUsers,
  };
}

export class SocioSettingsService {
  private async getProfile(userId: string) {
    return AppDataSource.getRepository(CustomerProfile).findOne({ where: { keycloakUserId: userId } });
  }

  async getSettings(userId: string) {
    const profile = await this.getProfile(userId);
    const meta = profile?.metadata && typeof profile.metadata === 'object' ? profile.metadata : {};
    return mergeSettings((meta as Record<string, unknown>).socialSettings);
  }

  async updateSettings(userId: string, patch: SocialSettingsPayload) {
    const repo = AppDataSource.getRepository(CustomerProfile);
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw Object.assign(new Error('Profile not found'), { statusCode: 404 });
    }
    const meta =
      profile.metadata && typeof profile.metadata === 'object'
        ? { ...(profile.metadata as Record<string, unknown>) }
        : {};
    const current = mergeSettings(meta.socialSettings);
    const next = mergeSettings({
      ...current,
      ...patch,
      notifications: { ...current.notifications, ...(patch.notifications || {}) },
      closeFriends: patch.closeFriends ?? current.closeFriends,
      blockedUsers: patch.blockedUsers ?? current.blockedUsers,
    });
    meta.socialSettings = next;
    profile.metadata = meta;
    await repo.save(profile);
    return next;
  }
}
