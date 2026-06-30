import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { SocialConversation } from '../entities/SocialConversation';
import { SocialMessage } from '../entities/SocialMessage';
import { SocialConversationState } from '../entities/SocialConversationState';
import { InteractionService } from './interaction.service';
import { resolveAuthor, resolveAuthorMap } from './authorProfile.service';
import { normalizeMediaUrl } from '../util/normalizeMediaUrl';

function pairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export class MessageService {
  private interactions = new InteractionService();

  private async ensureState(conversationId: string, userId: string) {
    const repo = AppDataSource.getRepository(SocialConversationState);
    let row = await repo.findOne({ where: { conversationId, userId } });
    if (!row) {
      row = await repo.save(repo.create({ conversationId, userId, unreadCount: 0, lastReadAt: null }));
    }
    return row;
  }

  async listConversations(userId: string, q?: string) {
    const repo = AppDataSource.getRepository(SocialConversation);
    const qb = repo
      .createQueryBuilder('c')
      .where('c.participant_one_id = :userId OR c.participant_two_id = :userId', { userId })
      .orderBy('c.last_message_at', 'DESC')
      .addOrderBy('c.created_at', 'DESC');

    const rows = await qb.getMany();
    const stateRepo = AppDataSource.getRepository(SocialConversationState);
    const convIds = rows.map((c) => c.id);
    const states = convIds.length
      ? await stateRepo.find({ where: { userId, conversationId: In(convIds) } })
      : [];
    const unreadMap = new Map(states.map((s) => [s.conversationId, s.unreadCount]));

    const participantIds = rows.map((c) => (c.participantOneId === userId ? c.participantTwoId : c.participantOneId));
    const authorMap = await resolveAuthorMap(participantIds);

    const items = rows.map((c) => {
      const otherId = c.participantOneId === userId ? c.participantTwoId : c.participantOneId;
      const author = authorMap.get(otherId) || { userName: 'user', userAvatar: null };
      const lastMessage = c.lastMessageText || '';
      return {
        id: c.id,
        participantId: otherId,
        participantName: author.userName,
        participantAvatar: author.userAvatar,
        lastMessageText: lastMessage,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? c.createdAt.toISOString(),
        unreadCount: unreadMap.get(c.id) ?? 0,
        isRequest: Boolean(c.isRequest && c.requestForUserId === userId),
      };
    });

    const query = (q || '').trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.participantName.toLowerCase().includes(query)
        || item.participantId.toLowerCase().includes(query)
        || (item.lastMessageText || '').toLowerCase().includes(query),
    );
  }

  async openConversation(userId: string, participantId: string) {
    if (!participantId || participantId === userId) {
      throw Object.assign(new Error('Invalid participant'), { statusCode: 400 });
    }
    const [one, two] = pairIds(userId, participantId);
    const repo = AppDataSource.getRepository(SocialConversation);
    let conv = await repo.findOne({ where: { participantOneId: one, participantTwoId: two } });
    if (!conv) {
      const follows = await this.interactions.isFollowing(participantId, userId);
      conv = await repo.save(
        repo.create({
          participantOneId: one,
          participantTwoId: two,
          lastMessageText: null,
          lastMessageAt: null,
          isRequest: false,
          requestForUserId: null,
        }),
      );
      await Promise.all([
        this.ensureState(conv.id, userId),
        this.ensureState(conv.id, participantId),
      ]);
      void follows;
    }
    const author = await resolveAuthor(participantId);
    const state = await this.ensureState(conv.id, userId);
    return {
      id: conv.id,
      participantId,
      participantName: author.userName,
      participantAvatar: author.userAvatar,
      lastMessageText: conv.lastMessageText || '',
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? conv.createdAt.toISOString(),
      unreadCount: state.unreadCount,
      isRequest: Boolean(conv.isRequest && conv.requestForUserId === userId),
    };
  }

  async listMessages(userId: string, conversationId: string, limit = 50) {
    const conv = await this.getConversationForUser(userId, conversationId);
    if (!conv) return [];
    const rows = await AppDataSource.getRepository(SocialMessage).find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    const senders = await resolveAuthorMap(rows.map((r) => r.senderId));
    return rows.map((row) => {
      const author = senders.get(row.senderId) || { userName: 'user', userAvatar: null };
      return {
        id: row.id,
        conversationId: row.conversationId,
        senderId: row.senderId,
        senderName: author.userName,
        senderAvatar: author.userAvatar,
        content: row.contentText,
        mediaUrl: row.mediaUrl ? normalizeMediaUrl(row.mediaUrl) : null,
        mediaType: row.mediaType,
        createdAt: row.createdAt.toISOString(),
        isMine: row.senderId === userId,
      };
    });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    data: { content?: string; mediaUrl?: string; mediaType?: string },
  ) {
    const conv = await this.getConversationForUser(userId, conversationId);
    if (!conv) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404 });
    }
    const content = (data.content || '').trim();
    const mediaUrl = data.mediaUrl?.trim() || null;
    if (!content && !mediaUrl) {
      throw Object.assign(new Error('Message content is required'), { statusCode: 400 });
    }

    const otherId = conv.participantOneId === userId ? conv.participantTwoId : conv.participantOneId;
    const msgRepo = AppDataSource.getRepository(SocialMessage);
    const saved = await msgRepo.save(
      msgRepo.create({
        conversationId,
        senderId: userId,
        contentText: content || null,
        mediaUrl,
        mediaType: data.mediaType || (mediaUrl ? 'image' : null),
      }),
    );

    const preview = content || (data.mediaType === 'video' ? 'Video' : 'Photo');
    conv.lastMessageText = preview;
    conv.lastMessageAt = saved.createdAt;

    if (userId !== otherId) {
      const messageCount = await msgRepo.count({ where: { conversationId } });
      if (messageCount === 1) {
        const recipientFollowsSender = await this.interactions.isFollowing(otherId, userId);
        if (!recipientFollowsSender) {
          conv.isRequest = true;
          conv.requestForUserId = otherId;
        }
      }
    }

    await AppDataSource.getRepository(SocialConversation).save(conv);

    const stateRepo = AppDataSource.getRepository(SocialConversationState);
    const recipientState = await this.ensureState(conversationId, otherId);
    recipientState.unreadCount = (recipientState.unreadCount || 0) + 1;
    await stateRepo.save(recipientState);

    const author = await resolveAuthor(userId);
    return {
      id: saved.id,
      conversationId,
      senderId: userId,
      senderName: author.userName,
      senderAvatar: author.userAvatar,
      content: saved.contentText,
      mediaUrl: saved.mediaUrl ? normalizeMediaUrl(saved.mediaUrl) : null,
      mediaType: saved.mediaType,
      createdAt: saved.createdAt.toISOString(),
      isMine: true,
    };
  }

  async markConversationRead(userId: string, conversationId: string) {
    const conv = await this.getConversationForUser(userId, conversationId);
    if (!conv) return false;
    const stateRepo = AppDataSource.getRepository(SocialConversationState);
    const state = await this.ensureState(conversationId, userId);
    state.unreadCount = 0;
    state.lastReadAt = new Date();
    await stateRepo.save(state);
    if (conv.isRequest && conv.requestForUserId === userId) {
      conv.isRequest = false;
      conv.requestForUserId = null;
      await AppDataSource.getRepository(SocialConversation).save(conv);
    }
    return true;
  }

  async sendTyping(_userId: string, _conversationId: string, _isTyping: boolean) {
    return true;
  }

  private async getConversationForUser(userId: string, conversationId: string) {
    const conv = await AppDataSource.getRepository(SocialConversation).findOne({ where: { id: conversationId } });
    if (!conv) return null;
    if (conv.participantOneId !== userId && conv.participantTwoId !== userId) return null;
    return conv;
  }
}
