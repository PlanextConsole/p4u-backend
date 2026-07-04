import { Router, Request, Response } from 'express';
import { jwtAuth, requirePermission, requireRole } from '../../middleware/authMiddleware';
import { clientIp, getAuthSub, parseLimitOffset } from '../../http/adminHttp';
import { FoodService } from './food.service';

type Kind = 'restaurants' | 'riders' | 'orders' | 'coupons' | 'settlements';

function sendError(res: Response, e: any): void {
  const msg = e instanceof Error ? e.message : String(e);
  res.status(msg.includes('not found') ? 404 : 400).json({ message: msg });
}

export function createFoodAdminRoutes(): Router {
  const r = Router();
  const svc = new FoodService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('product.admin.manage'));

  const mountCrud = (path: string, kind: Kind) => {
    r.get(path, async (req: Request, res: Response) => {
      try {
        const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 500 });
        const result = await svc.list(kind, { limit, offset, q: typeof req.query.q === 'string' ? req.query.q : undefined, status: typeof req.query.status === 'string' ? req.query.status : undefined, includeInactive: req.query.includeInactive === 'true' });
        res.json({ ...result, limit, offset });
      } catch (e) { sendError(res, e); }
    });
    r.post(path, async (req: Request, res: Response) => {
      try { res.status(201).json(await svc.create(kind, req.body || {}, getAuthSub(req), clientIp(req))); }
      catch (e) { sendError(res, e); }
    });
    r.patch(`${path}/:id`, async (req: Request, res: Response) => {
      try { res.json(await svc.update(kind, req.params.id, req.body || {}, getAuthSub(req), clientIp(req))); }
      catch (e) { sendError(res, e); }
    });
    r.delete(`${path}/:id`, async (req: Request, res: Response) => {
      try { await svc.remove(kind, req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
      catch (e) { sendError(res, e); }
    });
  };

  mountCrud('/food/restaurants', 'restaurants');
  mountCrud('/food/riders', 'riders');
  mountCrud('/food/orders', 'orders');
  mountCrud('/food/coupons', 'coupons');
  mountCrud('/food/rider-settlements', 'settlements');

  r.post('/food/riders/:id/kyc', async (req: Request, res: Response) => {
    try {
      const status = String(req.body?.status || '').toLowerCase();
      if (!['pending', 'verified', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid KYC status' });
      res.json(await svc.updateRiderKyc(req.params.id, status, getAuthSub(req), clientIp(req)));
    } catch (e) { sendError(res, e); }
  });

  r.post('/food/rider-settlements/:id/pay', async (req: Request, res: Response) => {
    try { res.json(await svc.payRiderSettlement(req.params.id, getAuthSub(req), clientIp(req))); }
    catch (e) { sendError(res, e); }
  });

  return r;
}