import { Router, Request, Response } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { PosAdminService } from './pos.service';
import { UpsertPosVendorDto } from './dto/upsert-pos-vendor.dto';
import { UpsertPosProductDto } from './dto/upsert-pos-product.dto';
import { UpsertPosCategoryDto } from './dto/upsert-pos-category.dto';

export function createPosAdminRoutes(): Router {
  const r = Router();
  const svc = new PosAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('pos.admin.manage'));

  const validateDto = async <T>(req: Request, res: Response, Dto: new () => T): Promise<T | null> => {
    const dto = plainToClass(Dto, req.body);
    const errors = await validate(dto as any);
    if (errors.length > 0) {
      const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
      res.status(400).json({ message: msgs.join(', ') });
      return null;
    }
    return dto;
  };

  // POS Vendors
  r.get('/posVendors', async (req, res) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listVendors(limit, offset);
    res.json({ items, total, limit, offset });
  });
  r.post('/posVendors', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosVendorDto); if (!dto) return;
    const row = await svc.createVendor(dto, getAuthSub(req), clientIp(req));
    res.status(201).json(row);
  });
  r.patch('/posVendors/individual/:id', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosVendorDto); if (!dto) return;
    try { const row = await svc.updateVendor(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.patch('/POSVendors/individual/:id', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosVendorDto); if (!dto) return;
    try { const row = await svc.updateVendor(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/posVendors/:id', async (req, res) => {
    try { await svc.deleteVendor(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // POS Products
  r.get('/posProducts', async (req, res) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listProducts(limit, offset);
    res.json({ items, total, limit, offset });
  });
  r.post('/posProducts', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosProductDto); if (!dto) return;
    const row = await svc.createProduct(dto, getAuthSub(req), clientIp(req));
    res.status(201).json(row);
  });
  r.patch('/posProducts/individual/:id', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosProductDto); if (!dto) return;
    try { const row = await svc.updateProduct(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.patch('/POSProducts/individual/:id', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosProductDto); if (!dto) return;
    try { const row = await svc.updateProduct(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/posProducts/:id', async (req, res) => {
    try { await svc.deleteProduct(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // POS Categories
  r.get('/posCategories', async (req, res) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listCategories(limit, offset);
    res.json({ items, total, limit, offset });
  });
  r.post('/posCategories', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosCategoryDto); if (!dto) return;
    const row = await svc.createCategory(dto, getAuthSub(req), clientIp(req));
    res.status(201).json(row);
  });
  r.patch('/POSCategories/:id', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosCategoryDto); if (!dto) return;
    try { const row = await svc.updateCategory(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.patch('/posCategories/:id', async (req, res) => {
    const dto = await validateDto(req, res, UpsertPosCategoryDto); if (!dto) return;
    try { const row = await svc.updateCategory(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/posCategories/:id', async (req, res) => {
    try { await svc.deleteCategory(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  return r;
}
