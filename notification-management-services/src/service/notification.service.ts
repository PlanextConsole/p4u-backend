import { AppDataSource } from '../config/database';
import { UserDevice } from '../entities/UserDevice';
import { UserNotification } from '../entities/UserNotification';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export class NotificationService {
  async getNotifications(userId: string) { return AppDataSource.getRepository(UserNotification).find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }); }
  async markRead(userId: string, id: string) { const repo=AppDataSource.getRepository(UserNotification);const row=await repo.findOne({where:{id,userId}});if(!row)return null;row.status='read';return repo.save(row); }
  async registerDevice(input: { userId: string; deviceToken: string; platform: string }) { const repo=AppDataSource.getRepository(UserDevice);const existing=await repo.findOne({where:{userId:input.userId,deviceToken:input.deviceToken}});if(existing){existing.platform=input.platform;existing.status='active';return repo.save(existing);}return repo.save(repo.create({...input,status:'active'})); }
  async send(input: { userId: string; title: string; body?: string; deepLink?: string; data?: Record<string, unknown> }) {
    const notification = await AppDataSource.getRepository(UserNotification).save({ userId: input.userId, title: input.title,
      body: input.body || null, status: 'unread', metadata: { ...(input.data || {}), deepLink: input.deepLink || null } });
    const devices = await AppDataSource.getRepository(UserDevice).find({ where: { userId: input.userId, status: 'active' } });
    if (!devices.length) return { notification, pushed: 0, failed: 0 };
    try {
      if (!getApps().length) {
        const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const projectId = process.env.FIREBASE_PROJECT_ID; const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const credential = json ? cert(JSON.parse(json)) : projectId && clientEmail && privateKey
          ? cert({ projectId, clientEmail, privateKey }) : applicationDefault();
        initializeApp({ credential });
      }
      const data = Object.fromEntries(Object.entries({ ...(input.data || {}), deepLink: input.deepLink || '' }).map(([k,v])=>[k,String(v)]));
      const result = await getMessaging().sendEachForMulticast({ tokens: devices.map(d=>d.deviceToken), notification: { title: input.title, body: input.body || '' }, data });
      const invalid = result.responses.map((response,index)=>!response.success && ['messaging/invalid-registration-token','messaging/registration-token-not-registered'].includes((response.error as any)?.code) ? devices[index].id : null).filter(Boolean) as string[];
      if (invalid.length) await AppDataSource.getRepository(UserDevice).createQueryBuilder().update().set({status:'invalid'}).whereInIds(invalid).execute();
      return { notification, pushed: result.successCount, failed: result.failureCount };
    } catch (error) { console.error('[notification] FCM delivery failed', error); return { notification, pushed: 0, failed: devices.length }; }
  }
}
