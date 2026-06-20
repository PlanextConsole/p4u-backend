import { Router, Request, Response } from 'express';
import { ProfileQueryService } from '../service/profileQuery.service';
import { AddressService } from '../service/address.service';
import { WishlistService } from '../service/wishlist.service';
import { ReferralService } from '../service/referral.service';
import {
  jwtAuth,
  requireAnyRole,
  requirePermission,
  requireCustomerSelfOrAdmin,
} from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendServerError, sendUnauthorized } from '../middleware/responseEnvelope';

export function createProfileRoutes(): Router {
  const router = Router();
  const svc = new ProfileQueryService();
  const addressSvc = new AddressService();
  const referralSvc = new ReferralService();
  const wishlistSvc = new WishlistService();

  const parsePaging = (req: Request) => {
    const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
    const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
    return {
      limit: Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100),
      offset: Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0),
    };
  };

  async function resolveCustomerId(req: Request, res: Response): Promise<string | null> {
    const auth = (req as any).auth;
    const sub = String(auth?.sub || '');
    if (!sub) { sendUnauthorized(res, 'Invalid token subject'); return null; }
    const me = await svc.getCustomerByKeycloakSub(sub);
    if (!me) { sendNotFound(res, 'Customer profile not found'); return null; }
    return me.id;
  }

  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'profile-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  router.use(jwtAuth);

  router.get(
    '/me',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.read.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const sub = String(auth?.sub || '');
      if (!sub) return sendUnauthorized(res, 'Invalid token subject');
      const row = await svc.getCustomerByKeycloakSub(sub);
      if (!row) return sendNotFound(res, 'Customer profile not found');
      sendSuccess(res, row);
    }
  );

  router.patch(
    '/me',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.write.self'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const sub = String(auth?.sub || '');
      if (!sub) return sendUnauthorized(res, 'Invalid token subject');
      const me = await svc.getCustomerByKeycloakSub(sub);
      if (!me) return sendNotFound(res, 'Customer profile not found');
      const row = await svc.updateCustomerById(me.id, req.body ?? {});
      sendSuccess(res, row);
    }
  );

  router.get(
    '/customers/:customerId',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('customer.read.self'),
    requireCustomerSelfOrAdmin('customerId'),
    async (req: Request, res: Response) => {
      const row = await svc.getCustomerById(req.params.customerId);
      if (!row) return sendNotFound(res, 'Customer not found');
      sendSuccess(res, row);
    }
  );

  // ── Addresses ──────────────────────────────────────────────

  router.get(
    '/me/addresses',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.read.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      const items = await addressSvc.listAddresses(customerId);
      sendSuccess(res, { items });
    }
  );

  router.post(
    '/me/addresses',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.write.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      const body = req.body ?? {};
      if (!body.addressLine1 || !body.city || !body.state || !body.postalCode) {
        return sendBadRequest(res, 'addressLine1, city, state, postalCode are required');
      }
      try {
        const row = await addressSvc.createAddress(customerId, body);
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.put(
    '/me/addresses/:addressId',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.write.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      try {
        const row = await addressSvc.updateAddress(customerId, req.params.addressId, req.body ?? {});
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Address not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  router.delete(
    '/me/addresses/:addressId',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.write.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      try {
        await addressSvc.deleteAddress(customerId, req.params.addressId);
        sendSuccess(res, { message: 'Address deleted' });
      } catch (e: any) {
        if (e.message === 'Address not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  // ── Wishlist ──────────────────────────────────────────────

  router.get(
    '/me/wishlist',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.read.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      const { limit, offset } = parsePaging(req);
      const data = await wishlistSvc.listWishlist(customerId, limit, offset);
      sendSuccess(res, data);
    }
  );

  router.post(
    '/me/wishlist',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.write.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      const body = req.body ?? {};
      if (!body.productId) return sendBadRequest(res, 'productId required');
      try {
        const row = await wishlistSvc.addToWishlist(customerId, String(body.productId), body.vendorId);
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.delete(
    '/me/wishlist/:productId',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.write.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      try {
        await wishlistSvc.removeFromWishlist(customerId, req.params.productId);
        sendSuccess(res, { message: 'Removed from wishlist' });
      } catch (e: any) {
        if (e.message === 'Wishlist item not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  // ── Referrals & Reward Points ─────────────────────────────

  router.get(
    '/me/referral-code',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.read.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      try {
        const referralCode = await referralSvc.getOrCreateReferralCode(customerId);
        sendSuccess(res, { referralCode });
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.get(
    '/me/referrals',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.read.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      const { limit, offset } = parsePaging(req);
      const data = await referralSvc.listMyReferrals(customerId, limit, offset);
      sendSuccess(res, data);
    }
  );

  router.get(
    '/me/reward-points',
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('profile.read.self'),
    async (req: Request, res: Response) => {
      const customerId = await resolveCustomerId(req, res);
      if (!customerId) return;
      const data = await referralSvc.getRewardBalance(customerId);
      sendSuccess(res, data);
    }
  );

  return router;
}
