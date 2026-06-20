import { Router, Request, Response } from 'express';
import { ContentQueryService } from '../service/contentQuery.service';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendServerError } from '../middleware/responseEnvelope';

export function createContentRoutes(): Router {
  const router = Router();
  const svc = new ContentQueryService();

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

  router.get('/classified', async (req: Request, res: Response) => {
    try {
      const data = await svc.listClassified(includeInactive(req), parsePaging(req));
      sendSuccess(res, data);
    } catch (e: any) {
      sendServerError(res, e.message);
    }
  });

  router.get('/home', async (req: Request, res: Response) => {
    try {
      const paging = parsePaging(req);
      const [banners, popups, reels, classified, brands, featuredProducts, serviceHighlights] = await Promise.all([
        svc.listBanners(false, { limit: Math.min(paging.limit, 10), offset: 0 }),
        svc.listPopups(false, { limit: 5, offset: 0 }),
        svc.listReels({ limit: Math.min(paging.limit, 10), offset: 0 }),
        svc.listClassified(false, { limit: Math.min(paging.limit, 10), offset: 0 }),
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
