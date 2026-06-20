import { Router, Request, Response } from 'express';
import { NotificationService } from '../service/notification.service';
import { jwtAuth, requireAnyRole, requirePermission } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from '../middleware/responseEnvelope';

export function createNotificationRoutes(): Router {
  const router = Router();
  const svc = new NotificationService();

  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'notification-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  router.use(jwtAuth);

  router.get(
    '/me',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('notification.read.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const userId = String(auth?.sub || '');
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const rows = await svc.getNotifications(userId);
      sendSuccess(res, rows);
    }
  );

  router.post(
    '/me/:id/read',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('notification.read.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const userId = String(auth?.sub || '');
      if (!userId) return sendBadRequest(res, 'user id missing in token');
      const row = await svc.markRead(userId, req.params.id);
      if (!row) return sendNotFound(res, 'Notification not found');
      sendSuccess(res, row);
    }
  );

  router.post(
    '/devices/register',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('notification.device.register'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const userId = String(auth?.sub || '');
      const { deviceToken, platform } = req.body ?? {};
      if (!userId || !deviceToken) return sendBadRequest(res, 'user and deviceToken required');
      const row = await svc.registerDevice({
        userId,
        deviceToken: String(deviceToken),
        platform: platform ? String(platform) : 'web',
      });
      sendCreated(res, row);
    }
  );

  return router;
}
