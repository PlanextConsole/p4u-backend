import { Router, Request, Response } from 'express';
import { jwtAuth, requireAnyRole, requirePermission } from '../middleware/authMiddleware';
import {
  sendSuccess,
  sendCreated,
  sendNotFound,
  sendServerError,
} from '../middleware/responseEnvelope';
import { validateBody, validateBodyPartial } from '../middleware/validateDto';
import {
  CreateBrandDto,
  CreateFeaturedProductDto,
  CreateServiceHighlightDto,
  UpdateBrandDto,
  UpdateFeaturedProductDto,
  UpdateServiceHighlightDto,
} from '../dto/contentAdmin.dto';
import { ContentAdminService } from '../service/contentAdmin.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseId(req: Request, res: Response): string | null {
  const id = String(req.params.id || '');
  if (!UUID_RE.test(id)) {
    sendNotFound(res, 'Invalid id');
    return null;
  }
  return id;
}

export function createContentAdminRoutes(): Router {
  const router = Router();
  const svc = new ContentAdminService();

  router.use(jwtAuth);
  router.use(requireAnyRole(['ADMIN']));
  router.use(requirePermission('content.admin.manage'));

  // --- Brands ---
  router.post('/brands', validateBody(CreateBrandDto), async (req: Request, res: Response) => {
    try {
      const row = await svc.createBrand(req.body as CreateBrandDto);
      sendCreated(res, row);
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Create failed');
    }
  });

  router.get('/brands/:id', async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const row = await svc.getBrandById(id);
      if (!row) return sendNotFound(res, 'Brand not found');
      sendSuccess(res, row);
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Load failed');
    }
  });

  router.patch('/brands/:id', validateBodyPartial(UpdateBrandDto), async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const row = await svc.updateBrand(id, req.body as UpdateBrandDto);
      if (!row) return sendNotFound(res, 'Brand not found');
      sendSuccess(res, row);
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Update failed');
    }
  });

  router.delete('/brands/:id', async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const ok = await svc.deleteBrand(id);
      if (!ok) return sendNotFound(res, 'Brand not found');
      sendSuccess(res, { deleted: true });
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Delete failed');
    }
  });

  // --- Featured products ---
  router.post(
    '/featured-products',
    validateBody(CreateFeaturedProductDto),
    async (req: Request, res: Response) => {
      try {
        const row = await svc.createFeaturedProduct(req.body as CreateFeaturedProductDto);
        sendCreated(res, row);
      } catch (e: unknown) {
        sendServerError(res, e instanceof Error ? e.message : 'Create failed');
      }
    }
  );

  router.get('/featured-products/:id', async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const row = await svc.getFeaturedProductById(id);
      if (!row) return sendNotFound(res, 'Featured product not found');
      sendSuccess(res, row);
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Load failed');
    }
  });

  router.patch(
    '/featured-products/:id',
    validateBodyPartial(UpdateFeaturedProductDto),
    async (req: Request, res: Response) => {
      const id = parseId(req, res);
      if (!id) return;
      try {
        const row = await svc.updateFeaturedProduct(id, req.body as UpdateFeaturedProductDto);
        if (!row) return sendNotFound(res, 'Featured product not found');
        sendSuccess(res, row);
      } catch (e: unknown) {
        sendServerError(res, e instanceof Error ? e.message : 'Update failed');
      }
    }
  );

  router.delete('/featured-products/:id', async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const ok = await svc.deleteFeaturedProduct(id);
      if (!ok) return sendNotFound(res, 'Featured product not found');
      sendSuccess(res, { deleted: true });
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Delete failed');
    }
  });

  // --- Service highlights ---
  router.post(
    '/service-highlights',
    validateBody(CreateServiceHighlightDto),
    async (req: Request, res: Response) => {
      try {
        const row = await svc.createServiceHighlight(req.body as CreateServiceHighlightDto);
        sendCreated(res, row);
      } catch (e: unknown) {
        sendServerError(res, e instanceof Error ? e.message : 'Create failed');
      }
    }
  );

  router.get('/service-highlights/:id', async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const row = await svc.getServiceHighlightById(id);
      if (!row) return sendNotFound(res, 'Service highlight not found');
      sendSuccess(res, row);
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Load failed');
    }
  });

  router.patch(
    '/service-highlights/:id',
    validateBodyPartial(UpdateServiceHighlightDto),
    async (req: Request, res: Response) => {
      const id = parseId(req, res);
      if (!id) return;
      try {
        const row = await svc.updateServiceHighlight(id, req.body as UpdateServiceHighlightDto);
        if (!row) return sendNotFound(res, 'Service highlight not found');
        sendSuccess(res, row);
      } catch (e: unknown) {
        sendServerError(res, e instanceof Error ? e.message : 'Update failed');
      }
    }
  );

  router.delete('/service-highlights/:id', async (req: Request, res: Response) => {
    const id = parseId(req, res);
    if (!id) return;
    try {
      const ok = await svc.deleteServiceHighlight(id);
      if (!ok) return sendNotFound(res, 'Service highlight not found');
      sendSuccess(res, { deleted: true });
    } catch (e: unknown) {
      sendServerError(res, e instanceof Error ? e.message : 'Delete failed');
    }
  });

  return router;
}
