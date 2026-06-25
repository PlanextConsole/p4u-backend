import { Router, Request, Response } from 'express';
import { CommerceQueryService } from '../service/commerceQuery.service';
import { CartService } from '../service/cart.service';
import { CouponService } from '../service/coupon.service';
import { BookingService } from '../service/booking.service';
import { ReviewService } from '../service/review.service';
import {
  jwtAuth,
  requireShopperRole,
  requirePermission,
  requireCustomerSelfOrAdmin,
} from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendServerError, sendUnauthorized, sendForbidden } from '../middleware/responseEnvelope';
import { resolveVendorIdFromAuth } from '../service/vendorContext.service';

function customerIdFromAuth(req: Request): string | null {
  const auth = (req as any).auth;
  const id = String(auth?.customer_id || auth?.sub || '').trim();
  return id || null;
}

export function createCommerceRoutes(): Router {
  const router = Router();
  const svc = new CommerceQueryService();
  const cartSvc = new CartService();
  const couponSvc = new CouponService();
  const bookingSvc = new BookingService();
  const reviewSvc = new ReviewService();

  const parsePaging = (req: Request) => {
    const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
    const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
    return {
      limit: Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100),
      offset: Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0),
    };
  };

  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'commerce-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  /** Quote is arithmetic only — allow guests to preview checkout totals. */
  router.post('/checkout/quote', (req: Request, res: Response) => {
    const itemTotal = Number(req.body?.itemTotal ?? 0);
    const platformFee = Number(req.body?.platformFee ?? 0);
    const discount = Number(req.body?.discount ?? 0);
    const total = Math.max(itemTotal + platformFee - discount, 0);
    sendSuccess(res, { itemTotal, platformFee, discount, total, currency: 'INR' });
  });

  router.use(jwtAuth);

  router.get(
    '/cart',
    requireShopperRole,
    requirePermission('cart.read.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const data = await cartSvc.getCartResponse(customerId);
        sendSuccess(res, data);
      } catch (e: any) {
        sendServerError(res, e.message);
      }
    }
  );

  router.put(
    '/cart',
    requireShopperRole,
    requirePermission('cart.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      try {
        const data = await cartSvc.replaceCart(customerId, items);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.post(
    '/cart/items',
    requireShopperRole,
    requirePermission('cart.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const body = req.body ?? {};
      if (!body.productId) return sendBadRequest(res, 'productId required');
      try {
        const data = await cartSvc.addItem(customerId, {
          productId: String(body.productId),
          vendorId: body.vendorId ?? null,
          variationId: body.variationId ?? null,
          quantity: body.quantity ?? 1,
          unitPrice: body.unitPrice ?? '0',
          metadata: body.metadata ?? null,
        });
        sendCreated(res, data);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.patch(
    '/cart/items/:itemId',
    requireShopperRole,
    requirePermission('cart.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const data = await cartSvc.updateItem(customerId, req.params.itemId, {
          quantity: req.body?.quantity,
          unitPrice: req.body?.unitPrice,
        });
        sendSuccess(res, data);
      } catch (e: any) {
        if (e.message === 'Cart item not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  router.delete(
    '/cart/items/:itemId',
    requireShopperRole,
    requirePermission('cart.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const data = await cartSvc.removeItem(customerId, req.params.itemId);
        sendSuccess(res, data);
      } catch (e: any) {
        if (e.message === 'Cart item not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  router.delete(
    '/cart',
    requireShopperRole,
    requirePermission('cart.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const data = await cartSvc.clearCart(customerId);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.post(
    '/cart/merge',
    requireShopperRole,
    requirePermission('cart.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      try {
        const data = await cartSvc.mergeItems(customerId, items);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.post(
    '/orders/from-cart',
    requireShopperRole,
    requirePermission('order.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const redeemPoints = Number(req.body?.redeemPoints ?? 0);
        const order = await cartSvc.createOrderFromCart(customerId, req.body?.vendorId ?? undefined, {
          redeemPoints: Number.isFinite(redeemPoints) && redeemPoints > 0 ? redeemPoints : 0,
        });
        sendCreated(res, order);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.post(
    '/cart/quote',
    requireShopperRole,
    requirePermission('cart.read.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const redeemPoints = Number(req.body?.redeemPoints ?? 0);
        const quote = await cartSvc.quoteCart(customerId, {
          redeemPoints: Number.isFinite(redeemPoints) && redeemPoints > 0 ? redeemPoints : 0,
        });
        sendSuccess(res, quote);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.get(
    '/customers/:customerId/orders',
    requireShopperRole,
    requirePermission('order.read.self'),
    requireCustomerSelfOrAdmin('customerId'),
    async (req: Request, res: Response) => {
      const { limit, offset } = parsePaging(req);
      const [items, total] = await svc.listCustomerOrders(req.params.customerId, limit, offset);
      sendSuccess(res, items, 200, { total, limit, offset });
    }
  );

  router.get(
    '/orders/:orderId',
    requireShopperRole,
    requirePermission('order.read.self'),
    async (req: Request, res: Response) => {
      const row = await svc.getOrderById(req.params.orderId);
      if (!row) return sendNotFound(res, 'Order not found');
      const auth = (req as any).auth;
      const isAdmin = (auth?.realm_access?.roles || []).map((r: string) => r.toUpperCase()).includes('ADMIN');
      const tokenCustomerId = String(auth?.customer_id || auth?.sub || '');
      if (!isAdmin && row.customerId !== tokenCustomerId) {
        return sendForbidden(res, 'Forbidden: customer self access required');
      }
      sendSuccess(res, row);
    }
  );

  router.post(
    '/orders',
    requireShopperRole,
    requirePermission('order.write.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const customerId = String(auth?.customer_id || auth?.sub || '');
      if (!customerId) return sendUnauthorized(res, 'Invalid token subject');
      const row = await svc.createOrder({
        customerId,
        vendorId: req.body?.vendorId ?? null,
        totalAmount: req.body?.totalAmount ?? '0',
        metadata: req.body?.metadata ?? null,
      });
      sendCreated(res, row);
    }
  );

  router.post(
    '/orders/:orderId/cancel',
    requireShopperRole,
    requirePermission('order.write.self'),
    async (req: Request, res: Response) => {
      const row = await svc.getOrderById(req.params.orderId);
      if (!row) return sendNotFound(res, 'Order not found');
      const auth = (req as any).auth;
      const isAdmin = (auth?.realm_access?.roles || []).map((r: string) => r.toUpperCase()).includes('ADMIN');
      const tokenCustomerId = String(auth?.customer_id || auth?.sub || '');
      if (!isAdmin && row.customerId !== tokenCustomerId) {
        return sendForbidden(res, 'Forbidden: customer self access required');
      }
      const updated = await svc.updateOrderStatus(req.params.orderId, 'cancelled');
      sendSuccess(res, updated);
    }
  );

  // ── Coupons ──────────────────────────────────────────────

  router.post(
    '/coupons/validate',
    requireShopperRole,
    requirePermission('coupon.validate'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const { code, cartTotal, vendorId } = req.body ?? {};
      if (!code) return sendBadRequest(res, 'code is required');
      if (cartTotal === undefined) return sendBadRequest(res, 'cartTotal is required');
      try {
        const result = await couponSvc.validateCoupon(String(code), customerId, Number(cartTotal), vendorId);
        sendSuccess(res, result);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  // ── Bookings ──────────────────────────────────────────────

  router.get(
    '/bookings/available-slots',
    requireShopperRole,
    requirePermission('booking.read.self'),
    async (req: Request, res: Response) => {
      const vendorId = String(req.query.vendorId || '');
      const date = String(req.query.date || '');
      const serviceId = String(req.query.serviceId || '').trim() || undefined;
      if (!vendorId || !date) return sendBadRequest(res, 'vendorId and date query params required');
      try {
        const slots = await bookingSvc.getAvailableSlots(vendorId, date, serviceId);
        sendSuccess(res, { vendorId, date, slots });
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.post(
    '/bookings',
    requireShopperRole,
    requirePermission('booking.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const body = req.body ?? {};
      if (!body.vendorId || !body.bookingDate || !body.timeSlot) {
        return sendBadRequest(res, 'vendorId, bookingDate, timeSlot are required');
      }
      try {
        const row = await bookingSvc.createBooking(customerId, {
          vendorId: body.vendorId,
          serviceId: body.serviceId ?? null,
          bookingDate: body.bookingDate,
          timeSlot: body.timeSlot,
          addressId: body.addressId ?? null,
          notes: body.notes ?? null,
          totalAmount: body.totalAmount ?? '0',
          metadata: body.metadata ?? null,
        });
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.get(
    '/bookings',
    requireShopperRole,
    requirePermission('booking.read.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const { limit, offset } = parsePaging(req);
      const data = await bookingSvc.listMyBookings(customerId, limit, offset);
      sendSuccess(res, data);
    }
  );

  router.get(
    '/bookings/vendor',
    requireShopperRole,
    requirePermission('booking.read.self'),
    async (req: Request, res: Response) => {
      const vendorId = await resolveVendorIdFromAuth((req as any).auth);
      if (!vendorId) {
        return sendUnauthorized(
          res,
          'Vendor context missing: link catalog_vendors.keycloak_user_id to your Keycloak user or set vendor_id on the token',
        );
      }
      const { limit, offset } = parsePaging(req);
      const status = String(req.query.status || '').trim() || undefined;
      const data = await bookingSvc.listVendorBookings(vendorId, limit, offset, status);
      sendSuccess(res, data);
    }
  );

  router.get(
    '/bookings/vendor/:bookingId',
    requireShopperRole,
    requirePermission('booking.read.self'),
    async (req: Request, res: Response) => {
      const vendorId = await resolveVendorIdFromAuth((req as any).auth);
      if (!vendorId) {
        return sendUnauthorized(
          res,
          'Vendor context missing: link catalog_vendors.keycloak_user_id to your Keycloak user or set vendor_id on the token',
        );
      }
      const row = await bookingSvc.getBookingForVendor(vendorId, req.params.bookingId);
      if (!row) return sendNotFound(res, 'Booking not found');
      sendSuccess(res, row);
    }
  );

  router.get(
    '/bookings/admin',
    requireShopperRole,
    requirePermission('booking.read.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const roles = (auth?.realm_access?.roles || []).map((r: string) => String(r).toUpperCase());
      if (!roles.includes('ADMIN')) return sendForbidden(res, 'Admin access required');
      const { limit, offset } = parsePaging(req);
      const status = String(req.query.status || '').trim() || undefined;
      const vendorId = String(req.query.vendorId || '').trim() || undefined;
      const data = await bookingSvc.listAllBookings(limit, offset, { status, vendorId });
      sendSuccess(res, data);
    }
  );

  router.get(
    '/bookings/:bookingId',
    requireShopperRole,
    requirePermission('booking.read.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const row = await bookingSvc.getBooking(customerId, req.params.bookingId);
      if (!row) return sendNotFound(res, 'Booking not found');
      sendSuccess(res, row);
    }
  );

  router.post(
    '/bookings/:bookingId/cancel',
    requireShopperRole,
    requirePermission('booking.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      try {
        const row = await bookingSvc.cancelBooking(customerId, req.params.bookingId);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Booking not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  router.patch(
    '/bookings/:bookingId/status',
    requireShopperRole,
    requirePermission('booking.write.self'),
    async (req: Request, res: Response) => {
      const decision = String(req.body?.status || '').trim().toLowerCase();
      const vendorStatuses = new Set(['approved', 'rejected', 'in_progress', 'completed', 'cancelled']);
      if (!vendorStatuses.has(decision)) {
        return sendBadRequest(res, 'status must be one of: approved, rejected, in_progress, completed, cancelled');
      }

      const auth = (req as any).auth;
      const roles = (auth?.realm_access?.roles || []).map((r: string) => String(r).toUpperCase());
      try {
        if (roles.includes('ADMIN')) {
          if (decision !== 'approved' && decision !== 'rejected') {
            return sendBadRequest(res, 'Admin can only set approved or rejected via this route');
          }
          const row = await bookingSvc.reviewBookingForAdmin(req.params.bookingId, decision as 'approved' | 'rejected');
          return sendSuccess(res, row);
        }
        const vendorId = await resolveVendorIdFromAuth(auth);
        if (!vendorId) {
          return sendUnauthorized(
            res,
            'Vendor context missing: link catalog_vendors.keycloak_user_id to your Keycloak user or set vendor_id on the token',
          );
        }
        const row = await bookingSvc.updateBookingStatusForVendor(vendorId, req.params.bookingId, decision);
        return sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Booking not found') return sendNotFound(res, e.message);
        return sendBadRequest(res, e.message);
      }
    }
  );

  router.delete(
    '/bookings/:bookingId',
    requireShopperRole,
    requirePermission('booking.write.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const roles = (auth?.realm_access?.roles || []).map((r: string) => String(r).toUpperCase());
      if (!roles.includes('ADMIN')) return sendForbidden(res, 'Admin access required');
      try {
        await bookingSvc.deleteBookingForAdmin(req.params.bookingId);
        sendSuccess(res, { deleted: true });
      } catch (e: any) {
        if (e.message === 'Booking not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  // ── Reviews ──────────────────────────────────────────────

  router.post(
    '/reviews',
    requireShopperRole,
    requirePermission('review.write.self'),
    async (req: Request, res: Response) => {
      const customerId = customerIdFromAuth(req);
      if (!customerId) return sendUnauthorized(res, 'customer_id or sub required on token');
      const body = req.body ?? {};
      if (!body.targetType || !body.targetId || !body.rating) {
        return sendBadRequest(res, 'targetType, targetId, rating are required');
      }
      if (body.rating < 1 || body.rating > 5) {
        return sendBadRequest(res, 'rating must be between 1 and 5');
      }
      try {
        const row = await reviewSvc.createOrUpdateReview(customerId, {
          targetType: body.targetType,
          targetId: body.targetId,
          rating: body.rating,
          title: body.title ?? null,
          reviewText: body.reviewText ?? null,
          imagesJson: body.imagesJson ?? null,
          metadata: body.metadata ?? null,
        });
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.get(
    '/reviews',
    requireShopperRole,
    requirePermission('review.read'),
    async (req: Request, res: Response) => {
      const targetType = String(req.query.targetType || '');
      const targetId = String(req.query.targetId || '');
      if (!targetType || !targetId) {
        return sendBadRequest(res, 'targetType and targetId query params required');
      }
      const { limit, offset } = parsePaging(req);
      const data = await reviewSvc.listReviews(targetType, targetId, limit, offset);
      sendSuccess(res, data);
    }
  );

  router.get(
    '/reviews/summary',
    requireShopperRole,
    requirePermission('review.read'),
    async (req: Request, res: Response) => {
      const targetType = String(req.query.targetType || '');
      const targetId = String(req.query.targetId || '');
      if (!targetType || !targetId) {
        return sendBadRequest(res, 'targetType and targetId query params required');
      }
      const data = await reviewSvc.getAverageRating(targetType, targetId);
      sendSuccess(res, data);
    }
  );

  return router;
}
