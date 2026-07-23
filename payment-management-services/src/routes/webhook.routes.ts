import { Router, Request, Response } from 'express';
import { createHmac } from 'crypto';
import axios from 'axios';
import { PaymentService } from '../service/payment.service';
import { sendSuccess, sendBadRequest } from '../middleware/responseEnvelope';

export function createWebhookRoutes(): Router {
  const router = Router();
  const svc = new PaymentService();
  router.post('/webhooks/razorpay', async (req: Request, res: Response) => {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!signature || !rawBody) return sendBadRequest(res, 'Missing webhook signature/raw body');
    if (!svc.verifyWebhookSignature(rawBody, signature)) return sendBadRequest(res, 'Invalid webhook signature');
    let payload: any;
    try { payload = JSON.parse(rawBody.toString('utf8')); }
    catch { return sendBadRequest(res, 'Invalid webhook JSON'); }
    const result: any = await svc.handleRazorpayWebhook(payload, String(req.header('x-razorpay-event-id') || ''));
    if (result.updated && (result.foodOrderId || result.productOrderId)) {
      const isRefund = result.eventType === 'refund';
      const isProduct = Boolean(result.productOrderId) && !result.foodOrderId;
      const isProductRefund = isRefund && isProduct;
      const isProductPayment = !isRefund && isProduct;
      const secret = isProduct
        ? (process.env.PRODUCT_PAYMENT_WEBHOOK_SECRET || process.env.FOOD_PAYMENT_WEBHOOK_SECRET || '')
        : (process.env.FOOD_PAYMENT_WEBHOOK_SECRET || '');
      if (!secret) throw new Error('Payment callback secret is required');

      let callback: string;
      let path: string;
      let signatureHeader: string;

      if (isProductRefund) {
        callback = JSON.stringify({
          eventId: result.eventId,
          productOrderId: result.productOrderId,
          providerRefundId: result.providerRefundId,
          status: result.status,
        });
        path = '/api/v1/commerce/product-payments/refund-webhook';
        signatureHeader = 'x-product-signature';
      } else if (isProductPayment) {
        callback = JSON.stringify({
          eventId: result.eventId,
          productOrderId: result.productOrderId,
          providerOrderId: result.providerOrderId,
          providerPaymentId: result.providerPaymentId,
          status: result.status === 'captured' || result.status === 'succeeded' ? 'success' : 'failed',
          failureReason: payload?.payload?.payment?.entity?.error_description || null,
        });
        path = '/api/v1/commerce/product-payments/webhook';
        signatureHeader = 'x-product-signature';
      } else if (isRefund) {
        callback = JSON.stringify({
          eventId: result.eventId,
          foodOrderId: result.foodOrderId,
          providerRefundId: result.providerRefundId,
          status: result.status,
        });
        path = '/api/v1/commerce/food/payments/refund-webhook';
        signatureHeader = 'x-food-signature';
      } else {
        callback = JSON.stringify({
          eventId: result.eventId,
          foodOrderId: result.foodOrderId,
          providerOrderId: result.providerOrderId,
          providerPaymentId: result.providerPaymentId,
          status: result.status === 'captured' ? 'success' : 'failed',
          failureReason: payload?.payload?.payment?.entity?.error_description || null,
        });
        path = '/api/v1/commerce/food/payments/webhook';
        signatureHeader = 'x-food-signature';
      }

      await axios.post(`${process.env.COMMERCE_SERVICE_URL || 'http://localhost:8086'}${path}`, callback, {
        headers: {
          'Content-Type': 'application/json',
          [signatureHeader]: createHmac('sha256', secret).update(callback).digest('hex'),
        },
        timeout: 15000,
      });
    }
    sendSuccess(res, result);
  });
  return router;
}
