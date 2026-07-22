import { Request, Response, Router } from 'express';
import { sendBadRequest, sendSuccess } from '../middleware/responseEnvelope';
import { ProductLifecycleService } from '../service/productLifecycle.service';

export function createProductLifecyclePublicRoutes(): Router {
  const router = Router();
  const service = new ProductLifecycleService();
  router.post('/product-payments/refund-webhook', async (req: Request, res: Response) => {
    try {
      sendSuccess(res, await service.processRefundWebhook(req.body || {}, req.header('x-product-signature'), (req as any).rawBody));
    } catch (error) {
      sendBadRequest(res, error instanceof Error ? error.message : 'Product refund webhook failed');
    }
  });
  return router;
}