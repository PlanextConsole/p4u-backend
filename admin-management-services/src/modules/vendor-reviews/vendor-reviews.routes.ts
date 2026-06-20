import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { VendorReviewsAdminService } from './vendor-reviews.service';
import { CreateVendorReviewDto } from './dto/create-vendor-review.dto';

export function createVendorReviewsAdminRoutes(): Router {
  const r = Router();
  const svc = new VendorReviewsAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('vendor.review.admin.manage'));

  const list = async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.list(limit, offset);
    res.json({ items, total, limit, offset });
  };

  r.get('/vendorReviews/all/null', list);
  r.get('/vendorReviews', list);

  r.post('/vendorReviews', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateVendorReviewDto, req.body);
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

  r.patch('/vendorReviews/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.update(req.params.id, req.body, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Vendor review not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/vendorReviews/:id', async (req: Request, res: Response) => {
    try {
      await svc.delete(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Vendor review not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
