import { Router, Request, Response } from 'express';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { SocialAdminService } from './social-admin.service';

export function createSocialAdminRoutes(): Router {
  const r = Router();
  const svc = new SocialAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('post.admin.manage'));

  r.get('/social/dashboard', async (_req: Request, res: Response) => {
    try {
      const data = await svc.getDashboard();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/social/users', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const search = String(req.query.search ?? req.query.q ?? '').trim() || undefined;
      const { items, total } = await svc.listUsers(limit, offset, search);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/social/posts', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const { items, total } = await svc.listPosts(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/social/reports', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const { items, total } = await svc.listReports(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/social/hashtags', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
      const data = await svc.listHashtags(limit);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/social/audio', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const { items, total } = await svc.listAudio(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.patch('/social/posts/:id/remove', async (req: Request, res: Response) => {
    try {
      await svc.removePost(req.params.id, getAuthSub(req), clientIp(req));
      res.json({ message: 'Post removed' });
    } catch (e: any) {
      const status = e.message === 'Social post not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
