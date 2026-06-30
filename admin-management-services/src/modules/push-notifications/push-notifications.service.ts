import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { AdminPushNotificationSend } from './entities/AdminPushNotificationSend';
import { SendPushNotificationDto } from './dto/send-push-notification.dto';

export class PushNotificationsAdminService {
  private audit = new AuditService();

  async listRecent(limit: number, offset: number): Promise<{ items: AdminPushNotificationSend[]; total: number }> {
    const repo = AppDataSource.getRepository(AdminPushNotificationSend);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async send(
    dto: SendPushNotificationDto,
    actorSub: string | undefined,
    ip: string | undefined
  ): Promise<AdminPushNotificationSend> {
    const repo = AppDataSource.getRepository(AdminPushNotificationSend);
    const detail =
      'Recorded for admin history. Wire FCM/APNs/OneSignal in push-notifications.service to deliver to devices.';
    const row = repo.create({
      targetAudience: dto.targetAudience,
      title: dto.title.trim(),
      body: dto.body.trim(),
      deepLink: dto.deepLink?.trim() || null,
      targetUserIds: dto.targetAudience === 'specific_users' ? (dto.userIds || []).map((id) => String(id).trim()).filter(Boolean) : null,
      status: 'sent',
      providerDetail: detail,
      actorSub: actorSub ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub: actorSub ?? 'unknown',
      action: 'CREATE',
      entityType: 'AdminPushNotificationSend',
      entityId: row.id,
      metadata: { title: row.title, targetAudience: row.targetAudience, targetUserIds: row.targetUserIds },
      ipAddress: ip ?? null,
    });
    return row;
  }
}

