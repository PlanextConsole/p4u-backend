import { Router, Request, Response } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { ClassConstructor } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { ClassifiedAdminService } from './classified.service';
import { UpsertNameActiveDto } from './dto/upsert-name-active.dto';
import { UpsertClassifiedProductDto } from './dto/upsert-classified-product.dto';

export function createClassifiedAdminRoutes(): Router {
  const r = Router();
  const svc = new ClassifiedAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('classified.admin.manage'));

  const listHandler = (fn: (purpose: string | undefined, limit: number, offset: number) => Promise<{ items: any[]; total: number }>) =>
    async (req: Request, res: Response) => {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const purpose = req.query.purpose as string | undefined;
      const { items, total } = await fn(purpose, limit, offset);
      res.json({ items, total, limit, offset, purpose: purpose ?? 'all' });
    };

  const validateDto = async <T>(req: Request, res: Response, Dto: ClassConstructor<T>): Promise<T | null> => {
    const dto = plainToClass(Dto, req.body);
    const errors = await validate(dto as any);
    if (errors.length > 0) {
      const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
      res.status(400).json({ message: msgs.join(', ') });
      return null;
    }
    return dto;
  };

  // Cities
  r.get('/availableCities', listHandler((p, l, o) => svc.listCities(p, l, o)));
  r.post('/availableCities', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    const row = await svc.createCity(dto, getAuthSub(req), clientIp(req)); res.status(201).json(row);
  });
  r.patch('/availableCities/:id', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    try { const row = await svc.updateCity(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.patch('/availableCities/individual/:id', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    try { const row = await svc.updateCity(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/availableCities/:id', async (req, res) => {
    try { await svc.deleteCity(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // Areas
  r.get('/availableAreas', listHandler((p, l, o) => svc.listAreas(p, l, o)));
  r.post('/availableAreas', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    const row = await svc.createArea(dto, getAuthSub(req), clientIp(req)); res.status(201).json(row);
  });
  r.patch('/availableAreas/individual/:id', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    try { const row = await svc.updateArea(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/availableAreas/:id', async (req, res) => {
    try { await svc.deleteArea(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // Classified categories
  r.get('/classifiedCategories', listHandler((p, l, o) => svc.listClassifiedCategories(p, l, o)));
  r.post('/classifiedCategories', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    const row = await svc.createClassifiedCategory(dto, getAuthSub(req), clientIp(req)); res.status(201).json(row);
  });
  r.patch('/classifiedCategories/:id', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    try { const row = await svc.updateClassifiedCategory(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/classifiedCategories/:id', async (req, res) => {
    try { await svc.deleteClassifiedCategory(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // Classified services
  r.get('/classifiedServices', listHandler((p, l, o) => svc.listClassifiedServices(p, l, o)));
  r.post('/classifiedServices', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    const row = await svc.createClassifiedService(dto, getAuthSub(req), clientIp(req)); res.status(201).json(row);
  });
  r.patch('/classifiedServices/individual/:id', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    try { const row = await svc.updateClassifiedService(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/classifiedServices/:id', async (req, res) => {
    try { await svc.deleteClassifiedService(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // Classified vendors
  r.get('/classifiedVendors', listHandler((p, l, o) => svc.listClassifiedVendors(p, l, o)));
  r.post('/classifiedVendors', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    const row = await svc.createClassifiedVendor(dto, getAuthSub(req), clientIp(req)); res.status(201).json(row);
  });
  r.patch('/classifiedVendors/individual/:id', async (req, res) => {
    const dto = await validateDto<UpsertNameActiveDto>(req, res, UpsertNameActiveDto); if (!dto) return;
    try { const row = await svc.updateClassifiedVendor(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/classifiedVendors/:id', async (req, res) => {
    try { await svc.deleteClassifiedVendor(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });

  // Classified products
  r.get('/classifiedProducts', listHandler((p, l, o) => svc.listClassifiedProducts(p, l, o)));
  const createClassifiedProduct = async (req: Request, res: Response) => {
    const dto = await validateDto<UpsertClassifiedProductDto>(req, res, UpsertClassifiedProductDto); if (!dto) return;
    const row = await svc.createClassifiedProduct(dto, getAuthSub(req), clientIp(req)); res.status(201).json(row);
  };
  r.post('/classifiedProducts', createClassifiedProduct);
  r.post('/ClassifiedProducts', createClassifiedProduct);
  r.patch('/classifiedProducts/:id', async (req, res) => {
    const dto = await validateDto<UpsertClassifiedProductDto>(req, res, UpsertClassifiedProductDto); if (!dto) return;
    try { const row = await svc.updateClassifiedProduct(req.params.id, dto, getAuthSub(req), clientIp(req)); res.json(row); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/ClassifiedProducts/:id', async (req, res) => {
    try { await svc.deleteClassifiedProduct(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.delete('/classifiedProducts/:id', async (req, res) => {
    try { await svc.deleteClassifiedProduct(req.params.id, getAuthSub(req), clientIp(req)); res.status(204).send(); }
    catch (e: any) { res.status(404).json({ message: e.message }); }
  });
  r.post('/upload/ClassifiedProducts/:id', async (req, res) => {
    const imageUrls = (req.body?.imageUrls as string[]) || [];
    if (!Array.isArray(imageUrls)) return res.status(400).json({ message: 'imageUrls must be an array' });
    try {
      const row = await svc.uploadClassifiedProductImages(req.params.id, imageUrls, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      res.status(404).json({ message: e.message });
    }
  });

  return r;
}
