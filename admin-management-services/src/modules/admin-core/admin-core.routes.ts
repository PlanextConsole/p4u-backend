import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import rateLimit from 'express-rate-limit';
import { jwtAuth, requireRole } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp } from '../../http/adminHttp';
import { createVendorAdminRoutes } from '../vendors/vendor.routes';
import { createCustomerAdminRoutes } from '../customers/customer.routes';
import { createCatalogAdminRoutes } from '../catalog/catalog.routes';
import { createProductsAdminRoutes } from '../products/products.routes';
import { createProductAttributesAdminRoutes } from '../product-attributes/product-attributes.routes';
import { createOrdersAdminRoutes } from '../orders/orders.routes';
import { createOrganizationOrdersAdminRoutes } from '../organization-orders/organization-orders.routes';
import { createPlatformConfigAdminRoutes } from '../platform-config/platform-config.routes';
import { createBannersAdminRoutes } from '../banners/banners.routes';
import { createPostsAdminRoutes } from '../posts/posts.routes';
import { createSocialAdminRoutes } from '../social/social-admin.routes';
import { createVendorReviewsAdminRoutes } from '../vendor-reviews/vendor-reviews.routes';
import { createClassifiedAdminRoutes } from '../classified/classified.routes';
import { createPosAdminRoutes } from '../pos/pos.routes';
import { createAnalyticsAdminRoutes } from '../analytics/analytics.routes';
import { createVendorPlansAdminRoutes } from '../vendor-plans/vendor-plans.routes';
import { createPushNotificationsAdminRoutes } from '../push-notifications/push-notifications.routes';
import { createMediaLibraryAdminRoutes } from '../media-library/media-library.routes';
import { createFileUploadsAdminRoutes } from '../file-uploads/file-uploads.routes';
import { HierarchyService } from './services/hierarchy.service';
import { LayoutService } from './services/layout.service';
import { AuditService } from './services/audit.service';
import { CreateHierarchyNodeDto } from './dto/CreateHierarchyNodeDto';
import { UpdateHierarchyNodeDto } from './dto/UpdateHierarchyNodeDto';
import { CreateAppLayoutDto } from './dto/CreateAppLayoutDto';
import { UpdateAppLayoutDto } from './dto/UpdateAppLayoutDto';

const publicLayoutReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { message: 'Too many layout requests. Try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createAdminRoutes = (): Router => {
  const router = Router();
  const hierarchyService = new HierarchyService();
  const layoutService = new LayoutService();
  const auditService = new AuditService();

  router.get('/public/health', (_req: Request, res: Response) => {
    res.json({ message: 'Admin Management Service is running', service: 'admin-management-service' });
  });

  /** Published layouts for mobile/web (no admin JWT). Rate-limited. */
  router.get('/public/layouts/screen/:screenKey', publicLayoutReadLimiter, async (req: Request, res: Response) => {
    try {
      const layouts = await layoutService.listPublishedForScreen(req.params.screenKey);
      res.json({ screenKey: req.params.screenKey, layouts });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.use(createVendorAdminRoutes());
  router.use(createCustomerAdminRoutes());
  router.use(createCatalogAdminRoutes());
  router.use(createProductsAdminRoutes());
  router.use(createProductAttributesAdminRoutes());
  router.use(createOrdersAdminRoutes());
  router.use(createOrganizationOrdersAdminRoutes());
  router.use(createPlatformConfigAdminRoutes());
  router.use(createBannersAdminRoutes());
  router.use(createPostsAdminRoutes());
  router.use(createSocialAdminRoutes());
  router.use(createVendorReviewsAdminRoutes());
  router.use(createClassifiedAdminRoutes());
  router.use(createPosAdminRoutes());
  router.use(createAnalyticsAdminRoutes());
  router.use(createVendorPlansAdminRoutes());
  router.use(createPushNotificationsAdminRoutes());
  router.use(createMediaLibraryAdminRoutes());
  router.use(createFileUploadsAdminRoutes());

  const secured = Router();
  secured.use(jwtAuth);
  secured.use(requireRole('ADMIN'));

  secured.get('/me', (req: Request, res: Response) => {
    res.json({ auth: (req as any).auth });
  });

  secured.get('/hierarchy/nodes', async (req: Request, res: Response) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const nodes = await hierarchyService.list(includeInactive);
      res.json({ nodes });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  secured.get('/hierarchy/nodes/:id', async (req: Request, res: Response) => {
    try {
      const node = await hierarchyService.getById(req.params.id);
      if (!node) {
        return res.status(404).json({ message: 'Node not found' });
      }
      res.json(node);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  secured.post('/hierarchy/nodes', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateHierarchyNodeDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const node = await hierarchyService.create(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(node);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  secured.patch('/hierarchy/nodes/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateHierarchyNodeDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const node = await hierarchyService.update(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(node);
    } catch (e: any) {
      const status = e.message === 'Node not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  secured.get('/layouts', async (req: Request, res: Response) => {
    try {
      const screenKey = req.query.screenKey as string | undefined;
      const layouts = await layoutService.list(screenKey);
      res.json({ layouts });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  secured.get('/layouts/published/screen/:screenKey', async (req: Request, res: Response) => {
    try {
      const layouts = await layoutService.listPublishedForScreen(req.params.screenKey);
      res.json({ screenKey: req.params.screenKey, layouts });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  secured.get('/layouts/:id', async (req: Request, res: Response) => {
    try {
      const layout = await layoutService.getById(req.params.id);
      if (!layout) {
        return res.status(404).json({ message: 'Layout not found' });
      }
      res.json(layout);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  secured.post('/layouts', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateAppLayoutDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const layout = await layoutService.create(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(layout);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  secured.patch('/layouts/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateAppLayoutDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const layout = await layoutService.update(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(layout);
    } catch (e: any) {
      const status = e.message === 'Layout not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  secured.post('/layouts/:id/publish', async (req: Request, res: Response) => {
    try {
      const layout = await layoutService.publish(req.params.id, getAuthSub(req), clientIp(req));
      res.json(layout);
    } catch (e: any) {
      const status = e.message === 'Layout not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  secured.post('/layouts/:id/unpublish', async (req: Request, res: Response) => {
    try {
      const layout = await layoutService.unpublish(req.params.id, getAuthSub(req), clientIp(req));
      res.json(layout);
    } catch (e: any) {
      const status = e.message === 'Layout not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  secured.get('/audit-logs', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
      const entityType = req.query.entityType as string | undefined;
      const actorSub = req.query.actorSub as string | undefined;
      const { items, total } = await auditService.list({ page, limit, entityType, actorSub });
      res.json({ items, total, page, limit });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.use('/', secured);
  return router;
};
