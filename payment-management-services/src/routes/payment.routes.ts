import { Router, Request, Response } from 'express';
import { PaymentService } from '../service/payment.service';
import { jwtAuth, requireAnyRole, requirePermission } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest } from '../middleware/responseEnvelope';

export function createPaymentRoutes(): Router {
  const router = Router();
  const svc = new PaymentService();

  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'payment-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  router.use(jwtAuth);

  router.post(
    '/intents',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('payment.intent.create'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const customerId = String(auth?.customer_id || auth?.sub || '');
      const { orderId, amount, currency, metadata } = req.body ?? {};
      if (!orderId || !amount) return sendBadRequest(res, 'orderId and amount are required');
      const row = await svc.createIntent({
        orderId: String(orderId),
        amount: String(amount),
        currency: currency ? String(currency) : 'INR',
        metadata: metadata ?? null,
        customerId: customerId || null,
      });
      sendCreated(res, row);
    }
  );

  router.get(
    '/intents/:id',
    requireAnyRole(['ADMIN', 'CUSTOMER', 'VENDOR']),
    requirePermission('payment.read.self'),
    async (req: Request, res: Response) => {
      const row = await svc.getIntent(req.params.id);
      if (!row) return sendNotFound(res, 'Payment intent not found');
      sendSuccess(res, row);
    }
  );

  router.post(
    '/verify',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('payment.verify.self'),
    async (req: Request, res: Response) => {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return sendBadRequest(res, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
      }
      const result = await svc.verifyPayment({
        orderId: String(razorpay_order_id),
        paymentId: String(razorpay_payment_id),
        signature: String(razorpay_signature),
      });
      if (!result.verified) return sendBadRequest(res, 'Invalid payment signature');
      sendSuccess(res, result);
    }
  );

  return router;
}
