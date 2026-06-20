import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { parseLimitOffset } from '../../http/adminHttp';
import { ProductAttributesAdminService } from './product-attributes.service';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';

export function createProductAttributesAdminRoutes(): Router {
  const r = Router();
  const svc = new ProductAttributesAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('product.admin.manage'));

  r.get('/product-attributes', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 200, maxLimit: 500 });
      const data = await svc.list(limit, offset);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/product-attributes/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Product attribute not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/product-attributes', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateProductAttributeDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.create(dto);
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/product-attributes/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateProductAttributeDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.update(req.params.id, dto);
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Product attribute not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/product-attributes/:id', async (req: Request, res: Response) => {
    try {
      await svc.delete(req.params.id);
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Product attribute not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
