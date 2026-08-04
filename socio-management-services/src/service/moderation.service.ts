import { AppDataSource } from '../config/database';
import { ContentReport } from '../entities/ContentReport';
import { PostComment } from '../entities/PostComment';
import { SocialPost } from '../entities/SocialPost';

const REASONS = new Set(['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'misinformation', 'other']);
const STATUSES = new Set(['pending', 'reviewed', 'dismissed', 'actioned']);

export class ModerationService {
  async report(reporterId: string, targetType: string, targetId: string, reason: string, details?: string) {
    if (targetType !== 'post' && targetType !== 'comment') throw Object.assign(new Error('Invalid report target'), { statusCode: 400 });
    if (!REASONS.has(reason)) throw Object.assign(new Error('Invalid report reason'), { statusCode: 400 });
    const target = targetType === 'post'
      ? await AppDataSource.getRepository(SocialPost).findOne({ where: { id: targetId, status: 'published' } })
      : await AppDataSource.getRepository(PostComment).findOne({ where: { id: targetId, status: 'published' } });
    if (!target) throw Object.assign(new Error('Content not found'), { statusCode: 404 });
    const authorId = targetType === 'post' ? (target as SocialPost).authorId : (target as PostComment).userId;
    if (authorId === reporterId) throw Object.assign(new Error('You cannot report your own content'), { statusCode: 400 });
    const repo = AppDataSource.getRepository(ContentReport);
    const existing = await repo.findOne({ where: { reporterId, targetType, targetId } });
    if (existing) throw Object.assign(new Error('You already reported this content'), { statusCode: 409 });
    return repo.save(repo.create({ reporterId, targetType, targetId, reason, details: details?.trim().slice(0, 500) || null, status: 'pending' }));
  }

  async list(status: string | undefined, limit: number, offset: number) {
    const repo = AppDataSource.getRepository(ContentReport);
    const where = status && STATUSES.has(status) ? { status: status as ContentReport['status'] } : {};
    const [rows, total] = await repo.findAndCount({ where, order: { createdAt: 'DESC' }, take: limit, skip: offset });
    const enriched = await Promise.all(rows.map(async (r) => {
      const target = r.targetType === 'post'
        ? await AppDataSource.getRepository(SocialPost).findOne({ where: { id: r.targetId } })
        : await AppDataSource.getRepository(PostComment).findOne({ where: { id: r.targetId } });
      return { ...r, contentPreview: target ? String(target.contentText || '').slice(0, 300) : null, contentStatus: target?.status || 'deleted' };
    }));
    return { items: enriched, total, limit, offset };
  }

  async moderate(id: string, moderatorId: string, status: string, action: string, note?: string) {
    if (!STATUSES.has(status) || status === 'pending') throw Object.assign(new Error('Invalid moderation status'), { statusCode: 400 });
    if (!['none', 'hide', 'restore'].includes(action)) throw Object.assign(new Error('Invalid moderation action'), { statusCode: 400 });
    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ContentReport);
      const report = await repo.findOne({ where: { id } });
      if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });
      if (action !== 'none') {
        const contentStatus = action === 'hide' ? 'moderated' : 'published';
        const targetRepo = report.targetType === 'post' ? manager.getRepository(SocialPost) : manager.getRepository(PostComment);
        await targetRepo.update({ id: report.targetId } as never, { status: contentStatus } as never);
      }
      report.status = status as ContentReport['status'];
      report.moderatorId = moderatorId;
      report.moderatorNote = note?.trim().slice(0, 500) || null;
      report.moderationAction = action;
      report.resolvedAt = new Date();
      return repo.save(report);
    });
  }
}
