import { Router, Request, Response } from 'express';
import { FeedService } from '../service/feed.service';
import { InteractionService } from '../service/interaction.service';
import { StoryService } from '../service/story.service';
import { SocioProfileService } from '../service/socioProfile.service';
import { MessageService } from '../service/message.service';
import { SocioSettingsService } from '../service/socioSettings.service';
import { jwtAuth, requireAnyRole, requirePermission } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden } from '../middleware/responseEnvelope';

const userIdFromAuth = (req: Request): string | null => {
  const auth = (req as any).auth;
  return String(auth?.sub || '').trim() || null;
};

const authorTypeFromAuth = (req: Request): string => {
  const roles: string[] = Array.isArray((req as any).auth?.roles) ? (req as any).auth.roles : [];
  const upper = roles.map((r) => String(r).toUpperCase());
  if (upper.includes('VENDOR')) return 'vendor';
  if (upper.includes('ADMIN')) return 'admin';
  return 'customer';
};

const handleInteractionError = (res: Response, err: unknown): boolean => {
  const statusCode = (err as Error & { statusCode?: number })?.statusCode;
  const message = err instanceof Error ? err.message : 'Request failed';
  if (statusCode === 404) {
    sendNotFound(res, message);
    return true;
  }
  if (statusCode === 403) {
    sendForbidden(res, message);
    return true;
  }
  return false;
};

const parsePaging = (req: Request) => {
  const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
  const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
  return {
    limit: Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100),
    offset: Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0),
  };
};

export function createSocioRoutes(): Router {
  const router = Router();
  const feedSvc = new FeedService();
  const interactionSvc = new InteractionService();
  const storySvc = new StoryService();
  const profileSvc = new SocioProfileService();
  const messageSvc = new MessageService();
  const settingsSvc = new SocioSettingsService();

  /* ───── public health ───── */
  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'socio-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  /* ───── JWT gate ───── */
  router.use(jwtAuth);

  /* ───── Feed ───── */
  router.get(
    '/feed',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const { limit, offset } = parsePaging(req);
      const rows = await feedSvc.getFeedWithFallback(userId, limit, offset);
      const enriched = await interactionSvc.attachPostFlags(userId, rows);
      sendSuccess(res, enriched);
    }
  );

  router.get(
    '/feed/public',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const { limit, offset } = parsePaging(req);
      const rows = await feedSvc.getPublicFeed(limit, offset);
      const viewerId = userIdFromAuth(req);
      const enriched = viewerId ? await interactionSvc.attachPostFlags(viewerId, rows) : rows;
      sendSuccess(res, enriched);
    }
  );

  router.get(
    '/feed/ads',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const { limit } = parsePaging(req);
      const items = await feedSvc.getSocioAds(limit);
      sendSuccess(res, items);
    }
  );

  router.get(
    '/feed/ad-config',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (_req: Request, res: Response) => {
      sendSuccess(res, await feedSvc.getSocioAdConfig());
    }
  );

  router.get(
    '/posts/saved',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const { limit, offset } = parsePaging(req);
      const [posts, total] = await interactionSvc.listSavedPosts(userId, limit, offset);
      const formatted = await feedSvc.formatPosts(posts);
      const enriched = await interactionSvc.attachPostFlags(userId, formatted);
      sendSuccess(res, enriched, 200, { total, limit, offset });
    }
  );

  router.get(
    '/explore/tags',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
      const limit = Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 50);
      const items = await feedSvc.getTrendingTags(limit);
      sendSuccess(res, { items });
    },
  );

  router.get(
    '/explore/places',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
      const limit = Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 50);
      const items = await feedSvc.getTrendingPlaces(limit);
      sendSuccess(res, { items });
    },
  );

  /* ───── Posts ───── */
  router.get(
    '/posts/:postId',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const post = await feedSvc.getPost(req.params.postId);
      if (!post) return sendNotFound(res, 'Post not found');
      sendSuccess(res, post);
    }
  );

  router.post(
    '/posts',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.post.write'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const {
        contentText,
        mediaUrls,
        postType,
        visibility,
        location,
        tags,
        category,
        linkedProducts,
        hideLikeCount,
        commentPermission,
      } = req.body ?? {};
      const tagList = Array.isArray(tags)
        ? tags.map((t: unknown) => String(t))
        : typeof tags === 'string'
          ? tags.split(/[,\s#]+/).map((t) => t.trim()).filter(Boolean)
          : undefined;
      const post = await feedSvc.createPost(userId, authorTypeFromAuth(req), {
        contentText,
        mediaUrls,
        postType,
        visibility,
        location,
        tags: tagList,
        category,
        linkedProducts,
        hideLikeCount: Boolean(hideLikeCount),
        commentPermission,
      });
      sendCreated(res, post);
    }
  );

  router.delete(
    '/posts/:postId',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.post.write'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const result = await feedSvc.deletePost(userId, req.params.postId);
      if (!result) return sendNotFound(res, 'Post not found or not owned by user');
      sendSuccess(res, result);
    }
  );

  /* ───── Likes ───── */
  router.post(
    '/posts/:postId/like',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      try {
        const like = await interactionSvc.likePost(userId, req.params.postId);
        sendCreated(res, like);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    }
  );

  router.delete(
    '/posts/:postId/like',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const removed = await interactionSvc.unlikePost(userId, req.params.postId);
      if (!removed) return sendNotFound(res, 'Like not found');
      sendSuccess(res, { message: 'Unliked' });
    }
  );

  /* ───── Shares ───── */
  router.post(
    '/posts/:postId/share',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      try {
        const result = await interactionSvc.sharePost(userId, req.params.postId);
        sendCreated(res, result);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    }
  );

  router.post(
    '/posts/:postId/save',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      try {
        const saved = await interactionSvc.savePost(userId, req.params.postId);
        sendCreated(res, saved);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    }
  );

  router.delete(
    '/posts/:postId/save',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const removed = await interactionSvc.unsavePost(userId, req.params.postId);
      if (!removed) return sendNotFound(res, 'Save not found');
      sendSuccess(res, { message: 'Unsaved' });
    }
  );

  /* ───── Comments ───── */
  router.get(
    '/posts/:postId/comments',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const { limit, offset } = parsePaging(req);
      const [rows, total] = await interactionSvc.listComments(req.params.postId, limit, offset);
      sendSuccess(res, rows, 200, { total, limit, offset });
    }
  );

  router.post(
    '/posts/:postId/comments',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const { contentText, parentCommentId } = req.body ?? {};
      if (!contentText) return sendBadRequest(res, 'contentText is required');
      try {
        const comment = await interactionSvc.addComment(userId, req.params.postId, { contentText, parentCommentId });
        sendCreated(res, comment);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    }
  );

  router.get(
    '/users/me/profile',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const profile = await profileSvc.getProfile(userId, userId);
      sendSuccess(res, profile);
    }
  );

  router.get(
    '/users/:userId/profile',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const viewerId = userIdFromAuth(req);
      if (!viewerId) return sendBadRequest(res, 'user id missing in token');
      const profile = await profileSvc.getProfile(viewerId, req.params.userId);
      sendSuccess(res, profile);
    }
  );

  router.get(
    '/users/:userId/posts',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const viewerId = userIdFromAuth(req);
      const { limit, offset } = parsePaging(req);
      const rows = await feedSvc.getUserPosts(req.params.userId, limit, offset);
      const enriched = viewerId ? await interactionSvc.attachPostFlags(viewerId, rows) : rows;
      sendSuccess(res, enriched);
    }
  );

  router.get(
    '/notifications/me',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const limitRaw = parseInt(String(req.query.limit ?? '30'), 10);
      const limit = Number.isNaN(limitRaw) ? 30 : Math.min(Math.max(limitRaw, 1), 100);
      const items = await interactionSvc.getActivityNotifications(userId, limit);
      sendSuccess(res, items);
    }
  );

  /* ───── Follow ───── */
  router.post(
    '/users/:userId/follow',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const followerId = userIdFromAuth(req);
      if (!followerId) return sendBadRequest(res, 'user id missing in token');
      try {
        const follow = await interactionSvc.followUser(followerId, req.params.userId);
        sendCreated(res, follow);
      } catch (err: any) {
        if (err.message === 'Cannot follow yourself') return sendBadRequest(res, err.message);
        throw err;
      }
    }
  );

  router.delete(
    '/users/:userId/follow',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const followerId = userIdFromAuth(req);
      if (!followerId) return sendBadRequest(res, 'user id missing in token');
      const removed = await interactionSvc.unfollowUser(followerId, req.params.userId);
      if (!removed) return sendNotFound(res, 'Follow relationship not found');
      sendSuccess(res, { message: 'Unfollowed' });
    }
  );

  router.get(
    '/users/:userId/followers',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const { limit, offset } = parsePaging(req);
      const [rows, total] = await interactionSvc.getFollowers(req.params.userId, limit, offset);
      sendSuccess(res, rows, 200, { total, limit, offset });
    }
  );

  router.get(
    '/users/:userId/following',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const { limit, offset } = parsePaging(req);
      const [rows, total] = await interactionSvc.getFollowing(req.params.userId, limit, offset);
      sendSuccess(res, rows, 200, { total, limit, offset });
    }
  );

  router.get(
    '/users/suggestions',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const limitRaw = parseInt(String(req.query.limit ?? '10'), 10);
      const limit = Number.isNaN(limitRaw) ? 10 : Math.min(Math.max(limitRaw, 1), 100);
      const suggestions = await interactionSvc.getSuggestions(userId, limit);
      sendSuccess(res, suggestions);
    }
  );

  /* ───── Stories ───── */
  router.get(
    '/stories/feed',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const stories = await storySvc.getFeedStories(userId);
      sendSuccess(res, stories);
    }
  );

  router.get(
    '/stories/me',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const stories = await storySvc.getMyStories(userId);
      sendSuccess(res, stories);
    }
  );

  router.post(
    '/stories',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.post.write'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const { mediaUrl, mediaType, textOverlay } = req.body ?? {};
      if (!mediaUrl) return sendBadRequest(res, 'mediaUrl is required');
      const story = await storySvc.createStory(userId, { mediaUrl, mediaType, textOverlay });
      sendCreated(res, story);
    }
  );

  router.post(
    '/stories/:storyId/view',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const story = await storySvc.markStoryViewed(req.params.storyId);
      if (!story) return sendNotFound(res, 'Story not found');
      sendSuccess(res, story);
    }
  );

  router.post(
    '/stories/:storyId/like',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      try {
        const result = await storySvc.likeStory(userId, req.params.storyId);
        sendCreated(res, result);
      } catch (err: any) {
        if (err.message === 'Story not found') return sendNotFound(res, err.message);
        throw err;
      }
    }
  );

  /* ───── Direct messages ───── */
  router.get(
    '/messages/conversations',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const q = String(req.query.q ?? '').trim();
      const items = await messageSvc.listConversations(userId, q || undefined);
      sendSuccess(res, items);
    },
  );

  router.post(
    '/messages/conversations',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const participantId = String(req.body?.participantId ?? '').trim();
      if (!participantId) return sendBadRequest(res, 'participantId is required');
      try {
        const conversation = await messageSvc.openConversation(userId, participantId);
        sendCreated(res, conversation);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    },
  );

  router.get(
    '/messages/conversations/:conversationId/messages',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const limitRaw = parseInt(String(req.query.limit ?? '50'), 10);
      const limit = Number.isNaN(limitRaw) ? 50 : limitRaw;
      const items = await messageSvc.listMessages(userId, req.params.conversationId, limit);
      sendSuccess(res, items);
    },
  );

  router.post(
    '/messages/conversations/:conversationId/messages',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const { content, mediaUrl, mediaType } = req.body ?? {};
      try {
        const message = await messageSvc.sendMessage(userId, req.params.conversationId, { content, mediaUrl, mediaType });
        sendCreated(res, message);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    },
  );

  router.post(
    '/messages/conversations/:conversationId/read',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      await messageSvc.markConversationRead(userId, req.params.conversationId);
      sendSuccess(res, { ok: true });
    },
  );

  router.post(
    '/messages/conversations/:conversationId/typing',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const isTyping = Boolean(req.body?.isTyping);
      await messageSvc.sendTyping(userId, req.params.conversationId, isTyping);
      sendSuccess(res, { ok: true });
    },
  );

  /* ───── Social settings ───── */
  router.get(
    '/users/me/settings',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.feed.read'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const settings = await settingsSvc.getSettings(userId);
      sendSuccess(res, settings);
    },
  );

  router.patch(
    '/users/me/settings',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('social.interact'),
    async (req: Request, res: Response) => {
      const userId = userIdFromAuth(req);
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      try {
        const settings = await settingsSvc.updateSettings(userId, req.body ?? {});
        sendSuccess(res, settings);
      } catch (err) {
        if (handleInteractionError(res, err)) return;
        throw err;
      }
    },
  );

  return router;
}
