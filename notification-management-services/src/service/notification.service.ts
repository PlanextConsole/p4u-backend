import { AppDataSource } from '../config/database';
import { UserDevice } from '../entities/UserDevice';
import { UserNotification } from '../entities/UserNotification';

export class NotificationService {
  async getNotifications(userId: string) {
    return AppDataSource.getRepository(UserNotification).find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    const repo = AppDataSource.getRepository(UserNotification);
    const row = await repo.findOne({ where: { id, userId } });
    if (!row) return null;
    row.status = 'read';
    return repo.save(row);
  }

  async registerDevice(input: { userId: string; deviceToken: string; platform: string }) {
    const repo = AppDataSource.getRepository(UserDevice);
    const existing = await repo.findOne({ where: { userId: input.userId, deviceToken: input.deviceToken } });
    if (existing) {
      existing.platform = input.platform;
      existing.status = 'active';
      return repo.save(existing);
    }
    return repo.save(
      repo.create({
        userId: input.userId,
        deviceToken: input.deviceToken,
        platform: input.platform,
        status: 'active',
      })
    );
  }
}
