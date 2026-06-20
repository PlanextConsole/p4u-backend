import { Router, Request, Response } from 'express';
import { CatalogQueryService, type CategoryKind } from '../service/catalogQuery.service';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { sendSuccess, sendNotFound, sendBadRequest, sendServerError } from '../middleware/responseEnvelope';

/** Include legacy `categoryId` alias (same as service_category_id) for web clients. */
function toPublicService(s: CatalogServiceItem) {
  return {
    ...s,
    categoryId: s.serviceCategoryId,
  };
}

export function createCatalogRoutes(): Router {
  const router = Router();
  const svc = new CatalogQueryService();

  const parseKind = (req: Request): CategoryKind => {
    const k = String(req.query.kind ?? 'product').trim().toLowerCase();
    return k === 'service' ? 'service' : 'product';
  };

  const parsePaging = (req: Request) => {
    const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
    const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
    return {
      limit: Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100),
      offset: Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0),
    };
  };
  const includeInactive = (req: Request) =>
    req.query.includeInactive === 'true' || req.query.purpose === 'all';

  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'catalog-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  /** Read-only catalog browse/search — public (no JWT). Admin mutations live on admin service. */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const items = await svc.listCategories(includeInactive(req), parseKind(req));
      sendSuccess(res, items);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/categories/:id/children', async (req: Request, res: Response) => {
    try {
      const items = await svc.listCategoryChildren(req.params.id, includeInactive(req), parseKind(req));
      sendSuccess(res, items);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/vendors', async (req: Request, res: Response) => {
    try {
      const paging = parsePaging(req);
      const vendorKind =
        typeof req.query.vendorKind === 'string' ? req.query.vendorKind.trim() : undefined;
      const data = await svc.listVendors(includeInactive(req), paging, { vendorKind });
      sendSuccess(res, data.items ?? data, 200, { total: data.total, ...paging });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/vendors/:vendorId', async (req: Request, res: Response) => {
    try {
      const item = await svc.getVendor(req.params.vendorId, includeInactive(req));
      if (!item) return sendNotFound(res, 'Vendor not found');
      sendSuccess(res, item);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/vendors/:vendorId/products', async (req: Request, res: Response) => {
    try {
      const paging = parsePaging(req);
      const data = await svc.listProducts(req.params.vendorId, includeInactive(req), paging);
      sendSuccess(res, data.items ?? data, 200, { total: data.total, ...paging });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/products/:productId', async (req: Request, res: Response) => {
    try {
      const item = await svc.getProduct(req.params.productId, includeInactive(req));
      if (!item) return sendNotFound(res, 'Product not found');
      sendSuccess(res, item);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/services', async (req: Request, res: Response) => {
    try {
      const paging = parsePaging(req);
      const categoryId =
        typeof req.query.categoryId === 'string' ? req.query.categoryId.trim() : undefined;
      const subcategoryId =
        typeof req.query.subcategoryId === 'string' ? req.query.subcategoryId.trim() : undefined;
      const data = await svc.listServices(includeInactive(req), paging, {
        categoryId,
        subcategoryId,
      });
      const mapped = (data.items ?? []).map(toPublicService);
      sendSuccess(res, mapped, 200, { total: data.total, ...paging });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  /** Shop tab: products only, filtered by category/subcategory tree. */
  router.get('/browse/products', async (req: Request, res: Response) => {
    try {
      const paging = parsePaging(req);
      const categoryId =
        typeof req.query.categoryId === 'string' ? req.query.categoryId.trim() : undefined;
      const subcategoryId =
        typeof req.query.subcategoryId === 'string' ? req.query.subcategoryId.trim() : undefined;
      const data = await svc.listProductsForBrowse(includeInactive(req), paging, {
        categoryId,
        subcategoryId,
      });
      sendSuccess(res, data.items ?? data, 200, { total: data.total, ...paging });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/services/:id', async (req: Request, res: Response) => {
    try {
      const item = await svc.getService(req.params.id, includeInactive(req));
      if (!item) return sendNotFound(res, 'Service not found');
      sendSuccess(res, toPublicService(item));
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) return sendBadRequest(res, 'q is required');
      const paging = parsePaging(req);
      const items = await svc.searchAll(q, includeInactive(req), paging);
      sendSuccess(res, items);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  /** Services tab: vendors offering this catalog service (`catalog_vendor_services`). */
  router.get('/browse/services/:serviceId/vendors', async (req: Request, res: Response) => {
    try {
      const offers = await svc.listVendorOffersForService(req.params.serviceId, false);
      sendSuccess(res, offers);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  return router;
}
