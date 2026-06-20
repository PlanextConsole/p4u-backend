import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { OrganizationOrdersAdminService } from './organization-orders.service';
import { CreateOrganizationOrderDto } from './dto/create-organization-order.dto';
import { UpdateOrganizationOrderDto } from './dto/update-organization-order.dto';

export function createOrganizationOrdersAdminRoutes(): Router {
  const r = Router();
  const svc = new OrganizationOrdersAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('organization.order.admin.manage'));

  r.get('/organizationOrders/all/null', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listAll(limit, offset);
    res.json({ items, total, limit, offset });
  });

  r.get('/organizationOrders/allVendors/null', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listVendorScoped(limit, offset);
    res.json({ items, total, limit, offset });
  });

  r.post('/organizationOrders', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateOrganizationOrderDto, req.body);
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

  r.patch('/organizationOrders/individual/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateOrganizationOrderDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.update(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Organization order not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.patch('/organizationOrders/individualVendorAllUnclaimed/:vendorId', async (req: Request, res: Response) => {
    const row = await svc.markVendorUnclaimed(req.params.vendorId, getAuthSub(req), clientIp(req));
    res.json(row);
  });

  r.get('/organizationOrders/topReferrals/null', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 10, maxLimit: 100 });
    const { items } = await svc.topReferrals(limit, offset);
    res.json({ items, limit, offset });
  });

  return r;
}
