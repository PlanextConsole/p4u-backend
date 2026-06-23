import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp } from '../../http/adminHttp';
import { CatalogAdminService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateCatalogServiceDto } from './dto/create-catalog-service.dto';
import { UpdateCatalogServiceDto } from './dto/update-catalog-service.dto';
import { CreateVendorServiceDto } from './dto/create-vendor-service.dto';
import { UpdateVendorServiceDto } from './dto/update-vendor-service.dto';

export function createCatalogAdminRoutes(): Router {
  const r = Router();
  const svc = new CatalogAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('catalog.admin.manage'));

  const listFlag = (req: Request) => req.query.purpose === 'all' || req.query.includeInactive === 'true';

  // ─── Product categories (shop roots) ───
  const listProductCategories = async (req: Request, res: Response) => {
    try {
      const items = await svc.listProductCategories(listFlag(req));
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/product-categories/all', listProductCategories);
  r.get('/product-categories', listProductCategories);

  r.get('/product-categories/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getProductCategory(req.params.id);
      if (!row) return res.status(404).json({ message: 'Product category not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/product-categories/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteProductCategory(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Product category not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  const createProductCategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createProductCategory(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/product-categories', createProductCategory);

  const patchProductCategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateProductCategory(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Product category not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/product-categories/:id', patchProductCategory);

  // ─── Product subcategories ───
  const listProductSubcategories = async (req: Request, res: Response) => {
    try {
      const items = await svc.listProductSubcategories(listFlag(req));
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/product-subcategories/all', listProductSubcategories);
  r.get('/product-subcategories', listProductSubcategories);

  r.get('/product-subcategories/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getProductSubcategory(req.params.id);
      if (!row) return res.status(404).json({ message: 'Product subcategory not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/product-subcategories/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteProductSubcategory(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Product subcategory not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  const createProductSubcategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createProductSubcategory(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/product-subcategories', createProductSubcategory);

  const patchProductSubcategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateProductSubcategory(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Product subcategory not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/product-subcategories/:id', patchProductSubcategory);

  // ─── Service categories (booking) ───
  const listServiceCategories = async (req: Request, res: Response) => {
    try {
      const items = await svc.listServiceCategories(listFlag(req));
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/service-categories/all', listServiceCategories);
  r.get('/service-categories', listServiceCategories);

  r.get('/service-categories/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getServiceCategory(req.params.id);
      if (!row) return res.status(404).json({ message: 'Service category not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/service-categories/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteServiceCategory(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Service category not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  const createServiceCategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createServiceCategory(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/service-categories', createServiceCategory);

  const patchServiceCategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateServiceCategory(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Service category not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/service-categories/:id', patchServiceCategory);

  // ─── Service subcategories ───
  const listServiceSubcategories = async (req: Request, res: Response) => {
    try {
      const items = await svc.listServiceSubcategories(listFlag(req));
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/service-subcategories/all', listServiceSubcategories);
  r.get('/service-subcategories', listServiceSubcategories);

  r.get('/service-subcategories/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getServiceSubcategory(req.params.id);
      if (!row) return res.status(404).json({ message: 'Service subcategory not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/service-subcategories/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteServiceSubcategory(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Service subcategory not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  const createServiceSubcategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createServiceSubcategory(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/service-subcategories', createServiceSubcategory);

  const patchServiceSubcategory = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateCategoryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateServiceSubcategory(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Service subcategory not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/service-subcategories/:id', patchServiceSubcategory);

  const listServices = async (req: Request, res: Response) => {
    try {
      const all = req.query.purpose === 'all' || req.query.includeInactive === 'true';
      const items = await svc.listServices(all);
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/services/all', listServices);
  r.get('/services', listServices);

  r.get('/services/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getService(req.params.id);
      if (!row) return res.status(404).json({ message: 'Service not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  const createService = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateCatalogServiceDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createService(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/add_services', createService);
  r.post('/services', createService);

  r.patch('/services/batch/:categoryId', async (req: Request, res: Response) => {
    try {
      const body = await svc.batchUnlinkServicesForCategory(req.params.categoryId, getAuthSub(req), clientIp(req));
      res.json(body);
    } catch (e: any) {
      const status = e.message === 'Service category not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  const patchService = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateCatalogServiceDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateService(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Service not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/services/individual/:id', patchService);
  r.patch('/services/:id', patchService);

  const deleteService = async (req: Request, res: Response) => {
    try {
      await svc.deleteService(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Service not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.delete('/service/:id', deleteService);
  r.delete('/services/:id', deleteService);

  r.patch('/products/batchCategory/:categoryId', async (req: Request, res: Response) => {
    try {
      const body = await svc.batchUnlinkProductsForCategory(req.params.categoryId, getAuthSub(req), clientIp(req));
      res.json(body);
    } catch (e: any) {
      const status = e.message === 'Product category not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.get('/vendor-services', async (req: Request, res: Response) => {
    try {
      const vendorId = String(req.query.vendorId ?? '').trim() || undefined;
      const serviceId = String(req.query.serviceId ?? '').trim() || undefined;
      const moderationStatus = String(req.query.moderationStatus ?? '').trim() || undefined;
      if (!vendorId && !serviceId && !moderationStatus) {
        return res.status(400).json({ message: 'vendorId, serviceId, or moderationStatus is required' });
      }
      const items = await svc.listVendorServiceLinks({ vendorId, serviceId, moderationStatus });
      res.json({ items });
    } catch (e: any) {
      const status = e.message?.includes('required') ? 400 : 500;
      res.status(status).json({ message: e.message });
    }
  });

  r.post('/vendor-services', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateVendorServiceDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.upsertVendorServiceLink(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/vendor-services/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateVendorServiceDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateVendorServiceLink(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Vendor service offer not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/vendor-services/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteVendorServiceLink(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Vendor service offer not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
