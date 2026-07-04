import { Router, Request, Response } from 'express';
import { jwtAuth, requirePermission, requireRole } from '../../middleware/authMiddleware';
import { clientIp, getAuthSub, parseLimitOffset } from '../../http/adminHttp';
import { HomesService } from './homes.service';

type Kind = 'amenities' | 'filterOptions' | 'localities' | 'plans' | 'properties';

function sendError(res: Response, e: any): void {
  const msg = e instanceof Error ? e.message : String(e);
  res.status(msg.includes('not found') ? 404 : 400).json({ message: msg });
}

export function createHomesAdminRoutes(): Router {
  const r = Router();
  const svc = new HomesService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('product.admin.manage'));

  const mountCrud = (path: string, kind: Kind) => {
    r.get(path, async (req: Request, res: Response) => {
      try {
        const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 500 });
        const result = await svc.list(kind, {
          limit,
          offset,
          q: typeof req.query.q === 'string' ? req.query.q : undefined,
          type: typeof req.query.type === 'string' ? req.query.type : undefined,
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          includeInactive: req.query.includeInactive === 'true',
        });
        res.json({ ...result, limit, offset });
      } catch (e) { sendError(res, e); }
    });

    r.get(`${path}/:id`, async (req: Request, res: Response) => {
      try {
        const row = await svc.get(kind, req.params.id);
        if (!row) return res.status(404).json({ message: 'Homes record not found' });
        res.json(row);
      } catch (e) { sendError(res, e); }
    });

    r.post(path, async (req: Request, res: Response) => {
      try {
        const row = await svc.create(kind, req.body || {}, getAuthSub(req), clientIp(req));
        res.status(201).json(row);
      } catch (e) { sendError(res, e); }
    });

    r.patch(`${path}/:id`, async (req: Request, res: Response) => {
      try {
        const row = await svc.update(kind, req.params.id, req.body || {}, getAuthSub(req), clientIp(req));
        res.json(row);
      } catch (e) { sendError(res, e); }
    });

    r.delete(`${path}/:id`, async (req: Request, res: Response) => {
      try {
        await svc.remove(kind, req.params.id, getAuthSub(req), clientIp(req));
        res.status(204).send();
      } catch (e) { sendError(res, e); }
    });
  };

  mountCrud('/homes/amenities', 'amenities');
  mountCrud('/homes/filter-options', 'filterOptions');
  mountCrud('/homes/localities', 'localities');
  mountCrud('/homes/plans', 'plans');
  mountCrud('/homes/properties', 'properties');

  r.get('/homes/property-users', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 500 });
      const result = await svc.listPropertyUsers({
        limit,
        offset,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
      });
      res.json({ ...result, limit, offset });
    } catch (e) { sendError(res, e); }
  });

  r.get('/homes/reports/analytics', async (req: Request, res: Response) => {
    try {
      const range = typeof req.query.range === 'string' ? req.query.range : '90d';
      res.json(await svc.getPropertyAnalytics(range));
    } catch (e) { sendError(res, e); }
  });

  r.get('/homes/cms-content', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 500 });
      const result = await svc.listCmsContent({
        limit,
        offset,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        type: typeof req.query.type === 'string' ? req.query.type : undefined,
        includeInactive: req.query.includeInactive === 'true',
      });
      res.json({ ...result, limit, offset });
    } catch (e) { sendError(res, e); }
  });

  r.post('/homes/cms-content', async (req: Request, res: Response) => {
    try {
      const row = await svc.createCmsContent(req.body || {}, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e) { sendError(res, e); }
  });

  r.patch('/homes/cms-content/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.updateCmsContent(req.params.id, req.body || {}, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e) { sendError(res, e); }
  });

  r.delete('/homes/cms-content/:id', async (req: Request, res: Response) => {
    try {
      await svc.removeCmsContent(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e) { sendError(res, e); }
  });

  r.post('/homes/properties/:id/moderate', async (req: Request, res: Response) => {
    try {
      const status = String(req.body?.status || '').trim().toLowerCase();
      if (!['approved', 'rejected', 'verified', 'pending'].includes(status)) return res.status(400).json({ message: 'Invalid moderation status' });
      const row = await svc.moderateProperty(req.params.id, status, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e) { sendError(res, e); }
  });

  return r;
}