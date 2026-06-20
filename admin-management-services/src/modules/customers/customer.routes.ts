import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { CustomerAdminService } from './customer.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateOccupationDto } from './dto/create-occupation.dto';
import { UpdateOccupationDto } from './dto/update-occupation.dto';

export function createCustomerAdminRoutes(): Router {
  const r = Router();
  const svc = new CustomerAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('customer.admin.manage'));

  r.get('/customerReferrals', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listCustomerReferralsReport(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/customers', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listCustomers(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/customers/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getCustomer(req.params.id);
      if (!row) return res.status(404).json({ message: 'Customer not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/customers', async (req: Request, res: Response) => {
    try {
      const row = await svc.createCustomer(req.body, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/customers/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateCustomerDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateCustomer(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Customer not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/customers/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteCustomer(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Customer not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  /** Legacy UI path: list all coupons (including inactive). */
  const listCouponsHandler = async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const { items, total } = await svc.listAllCoupons(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  r.get('/coupons/all/null', listCouponsHandler);
  r.get('/coupons', listCouponsHandler);

  const listOccupationsHandler = async (req: Request, res: Response) => {
    try {
      const all = req.query.purpose === 'all' || req.query.includeInactive === 'true';
      const { items, totalCustomers } = await svc.listOccupationsWithCustomerCounts(all);
      res.json({ items, totalCustomers });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  r.get('/Occupations', listOccupationsHandler);
  r.get('/occupations', listOccupationsHandler);

  const createOccupation = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateOccupationDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createOccupation(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      if (e.message === 'OCCUPATION_CREATE_DISABLED') {
        return res.status(403).json({
          message:
            'Creating occupations is disabled. Set OCCUPATION_ADMIN_CREATE_ENABLED to 1 under Platform Variables (or re-enable that variable).',
        });
      }
      res.status(400).json({ message: e.message });
    }
  };

  r.post('/occupations', createOccupation);
  r.post('/Occupations', createOccupation);

  const patchOccupation = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateOccupationDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateOccupation(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Occupation not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };

  r.patch('/occupations/individual/:id', patchOccupation);
  r.patch('/Occupations/individual/:id', patchOccupation);
  r.patch('/occupations/:id', patchOccupation);

  r.post('/coupons', async (req: Request, res: Response) => {
    try {
      const row = await svc.createCoupon(req.body, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/coupons/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.updateCoupon(req.params.id, req.body, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Coupon not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/coupons/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteCoupon(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Coupon not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.get('/occupations/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getOccupationWithCustomerCount(req.params.id);
      if (!row) return res.status(404).json({ message: 'Occupation not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/occupations/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteOccupation(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Occupation not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
