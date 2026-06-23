import { AppDataSource } from '../config/database';
import { UserNotification } from '../entities/UserNotification';
import { Vendor } from '../entities/Vendor';

export class VendorNotificationEmitter {
  async notifyVendorById(
    vendorId: string,
    payload: { title: string; body?: string; type?: string; deepLink?: string },
  ): Promise<void> {
    const vendor = await AppDataSource.getRepository(Vendor).findOne({ where: { id: vendorId } });
    const userId = String(vendor?.keycloakUserId || '').trim();
    if (!userId) return;
    await this.notifyUser(userId, payload);
  }

  async notifyUser(
    userId: string,
    payload: { title: string; body?: string; type?: string; deepLink?: string },
  ): Promise<UserNotification> {
    const repo = AppDataSource.getRepository(UserNotification);
    const row = repo.create({
      userId,
      title: payload.title.slice(0, 255),
      body: payload.body?.slice(0, 4000) || null,
      status: 'unread',
      metadata: {
        type: payload.type || 'system',
        deepLink: payload.deepLink || null,
      },
    });
    return repo.save(row);
  }
}
