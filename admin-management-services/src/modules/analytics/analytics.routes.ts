import { Router, Request, Response } from 'express';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { AnalyticsAdminService } from './analytics.service';

export function createAnalyticsAdminRoutes(): Router {
  const r = Router();
  const svc = new AnalyticsAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('analytics.admin.read'));

  r.get('/metadata/all/null', async (_req: Request, res: Response) => {
    try {
      const data = await svc.metadataBundle();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/usersJoined/customers', async (req: Request, res: Response) => {
    try {
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const data = await svc.usersJoined('customers', dateFrom, dateTo);
      res.json({ type: 'customers', dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, ...data });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/usersJoined/vendors', async (req: Request, res: Response) => {
    try {
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const data = await svc.usersJoined('vendors', dateFrom, dateTo);
      res.json({ type: 'vendors', dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, ...data });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return r;
}
