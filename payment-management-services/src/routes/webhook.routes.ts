import { Router, Request, Response } from 'express';
import { PaymentService } from '../service/payment.service';
import { sendSuccess, sendBadRequest } from '../middleware/responseEnvelope';

export function createWebhookRoutes(): Router {
  const router = Router();
  const svc = new PaymentService();

  router.post('/webhooks/razorpay', async (req: Request, res: Response) => {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!signature || !rawBody) {
      return sendBadRequest(res, 'Missing webhook signature/raw body');
    }

    const valid = svc.verifyWebhookSignature(rawBody, signature);
    if (!valid) return sendBadRequest(res, 'Invalid webhook signature');

    const result = await svc.handleRazorpayWebhook(req.body ?? {});
    sendSuccess(res, result);
  });

  return router;
}
