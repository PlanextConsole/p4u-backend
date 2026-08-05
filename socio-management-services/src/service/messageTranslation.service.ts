import axios from 'axios';
import { AppDataSource } from '../config/database';
import { SocialMessage } from '../entities/SocialMessage';
import { SocialConversation } from '../entities/SocialConversation';

export const CHAT_LANGUAGES = ['en', 'ta', 'ml', 'hi', 'te', 'kn'] as const;
export type ChatLanguage = (typeof CHAT_LANGUAGES)[number];

const LANGUAGE_SET = new Set<string>(CHAT_LANGUAGES);
const ENGINE_URL = (process.env.INDICTRANS2_SERVICE_URL || 'http://localhost:8091').replace(/\/$/, '');
const ENGINE_TIMEOUT_MS = Math.max(1_000, Number(process.env.INDICTRANS2_TIMEOUT_MS || 20_000));

type CacheRow = { translated_text: string; source_language: string };

export class MessageTranslationService {
  async translate(userId: string, messageId: string, targetLanguage: string) {
    const target = targetLanguage.trim().toLowerCase();
    if (!LANGUAGE_SET.has(target)) {
      throw Object.assign(new Error('Unsupported translation language'), { statusCode: 400 });
    }

    const message = await AppDataSource.getRepository(SocialMessage).findOne({ where: { id: messageId } });
    if (!message) throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    const conversation = await AppDataSource.getRepository(SocialConversation).findOne({
      where: { id: message.conversationId },
    });
    if (!conversation || (conversation.participantOneId !== userId && conversation.participantTwoId !== userId)) {
      throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    }
    if (message.senderId === userId) {
      throw Object.assign(new Error('Only received messages can be translated'), { statusCode: 400 });
    }
    const originalText = message.contentText?.trim() || '';
    if (!originalText) throw Object.assign(new Error('This message has no text to translate'), { statusCode: 400 });

    const driver = AppDataSource.options.type;
    const cached: CacheRow[] = await AppDataSource.query(
      driver === 'postgres'
        ? 'SELECT translated_text, source_language FROM social_message_translations WHERE message_id = $1 AND target_language = $2 LIMIT 1'
        : 'SELECT translated_text, source_language FROM social_message_translations WHERE message_id = ? AND target_language = ? LIMIT 1',
      [messageId, target],
    );
    if (cached[0]) {
      return { messageId, originalText, translatedText: cached[0].translated_text, sourceLanguage: cached[0].source_language, targetLanguage: target, cached: true };
    }

    let engineResponse: { translatedText?: string; sourceLanguage?: string };
    try {
      const response = await axios.post(
        `${ENGINE_URL}/translate`,
        { text: originalText, targetLanguage: target },
        { timeout: ENGINE_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } },
      );
      engineResponse = response.data || {};
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail || error.message : String(error);
      throw Object.assign(new Error(`Translation is temporarily unavailable: ${detail}`), { statusCode: 503 });
    }
    const translatedText = String(engineResponse.translatedText || '').trim();
    const sourceLanguage = String(engineResponse.sourceLanguage || 'en').toLowerCase();
    if (!translatedText) throw Object.assign(new Error('Translation engine returned an empty result'), { statusCode: 503 });

    if (driver === 'postgres') {
      await AppDataSource.query(
        `INSERT INTO social_message_translations(message_id, target_language, source_language, translated_text)
         VALUES ($1,$2,$3,$4) ON CONFLICT(message_id,target_language)
         DO UPDATE SET translated_text=EXCLUDED.translated_text, source_language=EXCLUDED.source_language`,
        [messageId, target, sourceLanguage, translatedText],
      );
    } else {
      await AppDataSource.query(
        `INSERT INTO social_message_translations(message_id, target_language, source_language, translated_text)
         VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE translated_text=VALUES(translated_text), source_language=VALUES(source_language)`,
        [messageId, target, sourceLanguage, translatedText],
      );
    }
    return { messageId, originalText, translatedText, sourceLanguage, targetLanguage: target, cached: false };
  }
}
