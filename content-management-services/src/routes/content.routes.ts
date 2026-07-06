import { Router, Request, Response } from 'express';
import { ContentQueryService } from '../service/contentQuery.service';
import { ClassifiedPublicService } from '../service/classifiedPublic.service';
import { jwtAuth, requireAnyRole } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendServerError } from '../middleware/responseEnvelope';

export function createContentRoutes(): Router {
  const router = Router();
  const svc = new ContentQueryService();
  const classifiedSvc = new ClassifiedPublicService();

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
      service: 'content-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  /** Storefront content reads + newsletter — public (admin mutations use contentAdmin routes). */
  router.get('/banners', async (req: Request, res: Response) => {
    try {
      const data = await svc.listBanners(includeInactive(req), parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/popups', async (req: Request, res: Response) => {
    try {
      const data = await svc.listPopups(includeInactive(req), parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/reels', async (req: Request, res: Response) => {
    try {
      const data = await svc.listReels(parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/classified/categories', async (_req: Request, res: Response) => {
    try {
      const items = await classifiedSvc.listCategories();
      sendSuccess(res, { items, total: items.length });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/classified/:id', async (req: Request, res: Response) => {
    try {
      const row = await classifiedSvc.getPublicById(req.params.id);
      if (!row) return sendNotFound(res, 'Classified ad not found');
      sendSuccess(res, row);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/classified', async (req: Request, res: Response) => {
    try {
      if (includeInactive(req)) {
        const data = await svc.listClassified(true, parsePaging(req));
        sendSuccess(res, data);
        return;
      }
      const paging = parsePaging(req);
      const q = req.query.q ? String(req.query.q) : undefined;
      const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
      const data = await classifiedSvc.listPublic(paging, { q, categoryId });
      sendSuccess(res, data, 200, { total: data.total, limit: paging.limit, offset: paging.offset });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.post('/classified', jwtAuth, requireAnyRole(['CUSTOMER', 'ADMIN']), async (req: Request, res: Response) => {
    try {
      const auth = (req as any).auth;
      const customerId = String(auth?.sub || '').trim();
      if (!customerId) return sendBadRequest(res, 'User id missing in token');

      const body = req.body ?? {};
      const name = String(body.name || body.title || '').trim();
      if (!name) return sendBadRequest(res, 'Title is required');

      const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : '';
      if (!categoryId) return sendBadRequest(res, 'Category is required');

      const row = await classifiedSvc.createFromCustomer({
        customerId,
        customerName: typeof body.postedBy === 'string' ? body.postedBy : auth?.name || auth?.preferred_username || null,
        customerPhone: typeof body.contactPhone === 'string' ? body.contactPhone : typeof body.phone === 'string' ? body.phone : null,
        name,
        description: typeof body.description === 'string' ? body.description : null,
        price: body.price,
        categoryId,
        city: typeof body.city === 'string' ? body.city : null,
        area: typeof body.area === 'string' ? body.area : null,
        imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : null,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : typeof body.phone === 'string' ? body.phone : null,
      });
      sendCreated(res, row, { message: 'Ad submitted for admin review' });
    } catch (e: any) {
      sendBadRequest(res, e?.message || 'Failed to submit classified ad');
    }
  });

  router.get('/home', async (req: Request, res: Response) => {
    try {
      const paging = parsePaging(req);
      const [banners, popups, reels, classified, brands, featuredProducts, serviceHighlights] = await Promise.all([
        svc.listBanners(false, { limit: Math.min(paging.limit, 10), offset: 0 }),
        svc.listPopups(false, { limit: 5, offset: 0 }),
        svc.listReels({ limit: Math.min(paging.limit, 10), offset: 0 }),
        classifiedSvc.listPublic({ limit: Math.min(paging.limit, 10), offset: 0 }),
        svc.listBrands(false, { limit: 20, offset: 0 }),
        svc.listFeaturedProducts(false, { limit: 30, offset: 0 }),
        svc.listServiceHighlights(false, { limit: 10, offset: 0 }),
      ]);
      sendSuccess(res, {
        banners: banners.items,
        popups: popups.items,
        reels: reels.items,
        classified: classified.items,
        brands: brands.items,
        featuredProducts: featuredProducts.items,
        serviceHighlights: serviceHighlights.items,
      });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/brands', async (req: Request, res: Response) => {
    try {
      const data = await svc.listBrands(includeInactive(req), parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/featured-products', async (req: Request, res: Response) => {
    try {
      const data = await svc.listFeaturedProducts(includeInactive(req), parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/service-highlights', async (req: Request, res: Response) => {
    try {
      const data = await svc.listServiceHighlights(includeInactive(req), parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.post('/newsletter/subscribe', async (req: Request, res: Response) => {
    try {
      const { fullName, email, phone } = req.body ?? {};
      if (!email && !phone) {
        return sendBadRequest(res, 'email or phone is required');
      }
      const row = await svc.createNewsletterSubscription({ fullName, email, phone });
      sendCreated(res, {
        id: row.id,
        message: 'Subscription received',
      });
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  return router;
}
