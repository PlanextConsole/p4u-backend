import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { PushNotificationsAdminService } from './push-notifications.service';
import { SendPushNotificationDto } from './dto/send-push-notification.dto';

export function createPushNotificationsAdminRoutes(): Router {
  const r = Router();
  const svc = new PushNotificationsAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('banner.admin.manage'));

  r.get('/notifications/recent', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 100 });
      const { items, total } = await svc.listRecent(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/notifications/send', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(SendPushNotificationDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.send(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return r;
}
