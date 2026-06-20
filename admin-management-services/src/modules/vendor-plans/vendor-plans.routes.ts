import { Router, Request, Response } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { VendorPlansService } from './vendor-plans.service';
import { CreateVendorPlanDto } from './dto/create-vendor-plan.dto';
import { UpdateVendorPlanDto } from './dto/update-vendor-plan.dto';

export function createVendorPlansAdminRoutes(): Router {
  const r = Router();
  const svc = new VendorPlansService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('product.admin.manage'));

  r.get('/vendor-plans', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const planTypeRaw = String(req.query.planType || '').toLowerCase();
      const planType = planTypeRaw === 'local' || planTypeRaw === 'vip' ? planTypeRaw : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const includeInactive = req.query.includeInactive === 'true';
      const { items, total } = await svc.list(limit, offset, { planType, q, includeInactive });
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/vendor-plans/:id', async (req: Request, res: Response) => {
    try {
      const item = await svc.getById(req.params.id);
      if (!item) return res.status(404).json({ message: 'Vendor plan not found' });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/vendor-plans', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateVendorPlanDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.create(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/vendor-plans/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateVendorPlanDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.update(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Vendor plan not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/vendor-plans/:id', async (req: Request, res: Response) => {
    try {
      await svc.remove(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Vendor plan not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}

