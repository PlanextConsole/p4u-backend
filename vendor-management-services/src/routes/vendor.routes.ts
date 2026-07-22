import { Router, Request, Response } from 'express';
import multer from 'multer';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireAnyRole, requirePermission } from '../middleware/authMiddleware';
import { sendSuccess, sendCreated, sendNotFound, sendBadRequest, sendForbidden, sendConflict } from '../middleware/responseEnvelope';
import { VendorPortalService } from '../service/vendorPortal.service';
import { VendorRegistrationService } from '../service/vendorRegistration.service';
import { VendorCatalogService } from '../service/vendorCatalog.service';
import { PatchVendorProfileDto } from '../dto/patch-vendor-profile.dto';
import { PatchVendorOrderDto } from '../dto/patch-order.dto';
import { CreateVendorOrganizationOrderDto } from '../dto/create-organization-order.dto';
import { UpdateVendorOrganizationOrderDto } from '../dto/update-organization-order.dto';
import { CreateVendorRegistrationDto } from '../dto/create-vendor-registration.dto';
import { CreateVendorServiceOfferingDto } from '../dto/create-vendor-service-offering.dto';
import { PatchVendorServiceOfferingDto } from '../dto/patch-vendor-service-offering.dto';
import { VendorOfferedServicesService } from '../service/vendorOfferedServices.service';
import { VendorBookingAvailabilityService } from '../service/vendorBookingAvailability.service';
import { VendorMediaService } from '../service/vendorMedia.service';
import { VendorDropshippingService } from '../service/vendorDropshipping.service';
import { VendorBookingsService } from '../service/vendorBookings.service';
import { PatchVendorBookingStatusDto } from '../dto/patch-vendor-booking-status.dto';
import { PutVendorDropshippingSettingsDto, PatchDropshippingOrderStatusDto } from '../dto/put-vendor-dropshipping-settings.dto';
import { vendorImageUpload } from '../config/vendorImageUpload';
import { createVendorMediaUpload, vendorMediaPublicUrl } from '../config/vendorMediaUpload';
import { vendorDocumentUpload, vendorDocumentPublicUrl } from '../config/vendorDocumentUpload';
import { VendorSupportService } from '../service/vendorSupport.service';

const parsePaging = (req: Request) => {
  const limitRaw = parseInt(String(req.query.limit ?? '20'), 10);
  const offsetRaw = parseInt(String(req.query.offset ?? '0'), 10);
  return {
    limit: Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100),
    offset: Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0),
  };
};

async function requireVendorId(req: Request, res: Response, svc: VendorPortalService): Promise<string | null> {
  const auth = (req as any).auth;
  const vid = await svc.resolveVendorId(auth);
  if (!vid) {
    sendBadRequest(res,
      'Vendor context missing: set vendor_id on JWT or link admin_vendors.keycloak_user_id to your Keycloak user',
    );
    return null;
  }
  return vid;
}

export function createVendorRoutes(): Router {
  const router = Router();
  const svc = new VendorPortalService();
  const regSvc = new VendorRegistrationService();
  const catalogSvc = new VendorCatalogService();
  const offeredSvc = new VendorOfferedServicesService();
  const bookingAvailSvc = new VendorBookingAvailabilityService();
  const mediaSvc = new VendorMediaService();
  const dropshipSvc = new VendorDropshippingService();
  const bookingSvc = new VendorBookingsService();
  const supportSvc = new VendorSupportService();

  router.get('/public/health', (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'UP',
      service: 'vendor-management-service',
      timestamp: new Date().toISOString(),
    });
  });

  router.use(jwtAuth);

  // --- Registration routes (CUSTOMER role) - must be before VENDOR role gate ---

  router.post(
    '/register',
    requireAnyRole(['CUSTOMER']),
    requirePermission('vendor.register'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const customerId = String(auth?.sub || auth?.customer_id || '');
      if (!customerId) return sendBadRequest(res, 'Customer context missing');

      const dto = plainToClass(CreateVendorRegistrationDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }

      try {
        const row = await regSvc.submitRegistration(customerId, dto);
        sendCreated(res, row);
      } catch (e: any) {
        if (e.message.includes('already exists')) return sendConflict(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  router.get(
    '/register/status',
    requireAnyRole(['CUSTOMER']),
    requirePermission('vendor.register'),
    async (req: Request, res: Response) => {
      const auth = (req as any).auth;
      const customerId = String(auth?.sub || auth?.customer_id || '');
      if (!customerId) return sendBadRequest(res, 'Customer context missing');

      const row = await regSvc.getRegistrationStatus(customerId);
      if (!row) return sendNotFound(res, 'No registration request found');
      sendSuccess(res, row);
    }
  );

  // Registration document upload for authenticated customers who do not yet
  // have a vendor context. Supports the same PDF/image fields as the vendor
  // registration wizard without requiring the VENDOR role.
  router.post(
    '/register/upload',
    requireAnyRole(['CUSTOMER']),
    requirePermission('vendor.register'),
    (req: Request, res: Response, next) => {
      const auth = (req as any).auth;
      const customerId = String(auth?.sub || auth?.customer_id || '').trim();
      if (!customerId) return sendBadRequest(res, 'Customer context missing');
      (req as any).vendorUploadId = `registration-${customerId}`;
      vendorDocumentUpload.single('file')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendBadRequest(res, 'File too large (max 12 MB)');
          }
          return sendBadRequest(res, err.message);
        }
        if (err) {
          return sendBadRequest(res, err instanceof Error ? err.message : String(err));
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      const uploadId = String((req as any).vendorUploadId || '');
      const file = req.file;
      if (!file || !uploadId) return sendBadRequest(res, 'No file uploaded');
      sendCreated(res, {
        url: vendorDocumentPublicUrl(uploadId, file.filename),
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
      });
    },
  );

  // --- End registration routes ---

  router.use(requireAnyRole(['VENDOR']));

  const chain = [requirePermission('vendor.portal.me.read')];

  router.get('/me', ...chain, async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    const row = await svc.getVendorById(vendorId);
    if (!row) return sendNotFound(res, 'Vendor not found');
    sendSuccess(res, row);
  });

  /** Legacy: PATCH /providers/{mobile} — only when it matches the authenticated vendor row phone. */
  router.patch(
    '/providers/:phoneNumber',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const row = await svc.getVendorById(vendorId);
      if (!row) return sendNotFound(res, 'Vendor not found');
      const param = decodeURIComponent(req.params.phoneNumber || '').replace(/\s/g, '');
      const phone = (row.phone || '').replace(/\s/g, '');
      if (!param || param !== phone) {
        return sendForbidden(res, 'Forbidden: phone does not match vendor profile');
      }
      const dto = plainToClass(PatchVendorProfileDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const updated = await svc.patchVendorProfile(vendorId, dto);
        sendSuccess(res, updated);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  router.patch(
    '/me',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const dto = plainToClass(PatchVendorProfileDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const row = await svc.patchVendorProfile(vendorId, dto);
        sendSuccess(res, row);
      } catch (e: any) {
        sendBadRequest(res, e.message);
      }
    }
  );

  /** Image upload for product thumbnails and service icons (field name: `file`). */
  router.post(
    '/me/upload',
    requirePermission('vendor.portal.me.write'),
    (req: Request, res: Response, next) => {
      vendorImageUpload.single('file')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendBadRequest(res, 'File too large (max 8 MB)');
          }
          return sendBadRequest(res, err.message);
        }
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return sendBadRequest(res, msg);
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      const file = req.file;
      if (!file) return sendBadRequest(res, 'No file uploaded');
      const url = `/vendor-uploads/${file.filename}`;
      sendCreated(res, { url });
    },
  );

  const orderRead = [requirePermission('vendor.portal.order.read')];
  const orderWrite = [requirePermission('vendor.portal.order.write')];

  const getOrder = async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    const row = await svc.getOrderForVendor(req.params.orderId, vendorId);
    if (!row) return sendNotFound(res, 'Order not found');
    sendSuccess(res, row);
  };

  router.get(
    '/orders',
    ...orderRead,
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const { limit, offset } = parsePaging(req);
      const status = req.query.status ? String(req.query.status) : undefined;
      const data = await svc.listOrdersForVendor(vendorId, status, limit, offset);
      sendSuccess(res, data);
    }
  );

  router.get('/orders/individualOrder/:orderId', ...orderRead, getOrder);
  router.get('/orders/:orderId', ...orderRead, getOrder);

  const patchOrderHandler = async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    const dto = plainToClass(PatchVendorOrderDto, req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
      return sendBadRequest(res, msgs.join(', '));
    }
    try {
      const row = await svc.updateOrderForVendor(req.params.orderId, vendorId, dto);
      sendSuccess(res, row);
    } catch (e: any) {
      if (e.message === 'Order not found') return sendNotFound(res, e.message);
      sendBadRequest(res, e.message);
    }
  };

  router.patch('/orders/individual/:orderId', ...orderWrite, patchOrderHandler);
  router.patch('/orders/:orderId', ...orderWrite, patchOrderHandler);

  router.patch('/orders/:orderId/return', ...orderWrite, async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    try {
      const row = await svc.updateReturnForVendor(req.params.orderId, vendorId, String(req.body?.action || ''), req.body?.note);
      sendSuccess(res, row);
    } catch (e: any) {
      if (e.message === 'Order not found' || e.message === 'Return request not found') return sendNotFound(res, e.message);
      sendBadRequest(res, e.message);
    }
  });

  const bookingRead = [requirePermission('vendor.portal.booking.read')];
  const bookingWrite = [requirePermission('vendor.portal.booking.write')];

  const getBooking = async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    try {
      const row = await bookingSvc.getForVendor(vendorId, req.params.bookingId);
      if (!row) return sendNotFound(res, 'Booking not found');
      sendSuccess(res, row);
    } catch (e: any) {
      sendBadRequest(res, e.message || 'Failed to load booking');
    }
  };

  router.get(
    '/bookings',
    ...bookingRead,
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const { limit, offset } = parsePaging(req);
      const status = req.query.status ? String(req.query.status) : undefined;
      try {
        const data = await bookingSvc.listForVendor(vendorId, limit, offset, status);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e.message || 'Failed to list bookings');
      }
    },
  );

  router.get('/bookings/:bookingId', ...bookingRead, getBooking);

  router.post('/bookings/:bookingId/completion-proof', ...bookingWrite, async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc); if (!vendorId) return;
    try { sendSuccess(res, await bookingSvc.submitCompletionProof(vendorId, req.params.bookingId, req.body || {})); }
    catch (e: any) { if (e.message === 'Booking not found') return sendNotFound(res, e.message); sendBadRequest(res, e.message); }
  });

  router.post('/bookings/:bookingId/completion-otp', ...bookingWrite, async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc); if (!vendorId) return;
    try { sendSuccess(res, await bookingSvc.verifyCompletionOtp(vendorId, req.params.bookingId, String(req.body?.otp || ''))); }
    catch (e: any) { if (e.message === 'Booking not found') return sendNotFound(res, e.message); sendBadRequest(res, e.message); }
  });

  router.patch(
    '/bookings/:bookingId',
    ...bookingWrite,
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const dto = plainToClass(PatchVendorBookingStatusDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const row = await bookingSvc.updateStatusForVendor(vendorId, req.params.bookingId, dto.status);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Booking not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    },
  );

  const orgRead = [requirePermission('vendor.portal.org_order.read')];
  const orgWrite = [requirePermission('vendor.portal.org_order.write')];

  const listOrg = async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    const { limit, offset } = parsePaging(req);
    const data = await svc.listOrganizationOrders(vendorId, limit, offset);
    sendSuccess(res, data);
  };

  router.get('/organization-orders', ...orgRead, listOrg);
  router.get('/organizationOrders/individualVendors/:keycloakSub', ...orgRead, async (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const sub = String(auth?.sub || '');
    if (!sub || sub !== req.params.keycloakSub) {
      return sendForbidden(res, 'Forbidden: user context mismatch');
    }
    return listOrg(req, res);
  });

  const postOrg = async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    const dto = plainToClass(CreateVendorOrganizationOrderDto, req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
      return sendBadRequest(res, msgs.join(', '));
    }
    try {
      const row = await svc.createOrganizationOrder(vendorId, dto);
      sendCreated(res, row);
    } catch (e: any) {
      sendBadRequest(res, e.message);
    }
  };

  router.post('/organization-orders', ...orgWrite, postOrg);
  router.post('/organizationOrders', ...orgWrite, postOrg);

  const patchOrg = async (req: Request, res: Response) => {
    const vendorId = await requireVendorId(req, res, svc);
    if (!vendorId) return;
    const dto = plainToClass(UpdateVendorOrganizationOrderDto, req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
      return sendBadRequest(res, msgs.join(', '));
    }
    try {
      const row = await svc.updateOrganizationOrder(req.params.id, vendorId, dto);
      sendSuccess(res, row);
    } catch (e: any) {
      if (e.message === 'Organization order not found') return sendNotFound(res, e.message);
      sendBadRequest(res, e.message);
    }
  };

  router.patch('/organization-orders/:id', ...orgWrite, patchOrg);
  router.patch('/organizationOrders/individual/:id', ...orgWrite, patchOrg);

  router.get(
    '/reviews/by-order/:orderId',
    requirePermission('vendor.portal.review.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const order = await svc.getOrderForVendor(req.params.orderId, vendorId);
      if (!order) return sendNotFound(res, 'Order not found');
      const items = await svc.listReviewsForOrder(vendorId, req.params.orderId);
      sendSuccess(res, { orderId: req.params.orderId, items });
    }
  );

  router.get(
    '/vendorReviews/individualOrder/:orderId',
    requirePermission('vendor.portal.review.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const order = await svc.getOrderForVendor(req.params.orderId, vendorId);
      if (!order) return sendNotFound(res, 'Order not found');
      const items = await svc.listReviewsForOrder(vendorId, req.params.orderId);
      sendSuccess(res, { orderId: req.params.orderId, items });
    }
  );

  router.get(
    '/referrals/code-usage/:code',
    requirePermission('vendor.portal.referral.read'),
    async (req: Request, res: Response) => {
      const code = decodeURIComponent(req.params.code || '');
      if (!code) return sendBadRequest(res, 'code required');
      const count = await svc.countReferralCodeUsage(code);
      sendSuccess(res, { referralCode: code, organizationOrderCount: count });
    }
  );

  router.get(
    '/referrals/my-organization-orders/:code',
    requirePermission('vendor.portal.referral.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const code = decodeURIComponent(req.params.code || '');
      if (!code) return sendBadRequest(res, 'code required');
      const { limit, offset } = parsePaging(req);
      const data = await svc.listOrgOrdersByReferralForVendor(vendorId, code, limit, offset);
      sendSuccess(res, data);
    }
  );

  const pushHint = (_req: Request, res: Response) => {
    sendSuccess(res, {
      message:
        'Register device tokens via notification service: POST /api/v1/notifications/devices/register with the same Bearer token.',
      notificationServiceBase: '/api/v1/notifications',
    });
  };

  router.get('/integrations/push-notification', pushHint);

  // ─── Pricing engine: vendor's plan tier + effective rates ───
  router.get(
    '/me/plan',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const data = await svc.getVendorPlanInfo(vendorId);
      if (!data) return sendNotFound(res, 'Vendor not found');
      sendSuccess(res, data);
    }
  );

  // List selectable plans for the Plans & Payments screen (radio options).
  router.get(
    '/me/plans',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const items = await svc.listSelectablePlans();
      sendSuccess(res, { items });
    }
  );

  // Start a plan purchase: free plans are assigned immediately; paid plans
  // return a Razorpay order the browser opens in Checkout.
  router.post(
    '/me/plan/checkout',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const planId = String(req.body?.planId || '').trim();
      if (!planId) return sendBadRequest(res, 'planId is required');
      try {
        const result = await svc.createPlanOrder(vendorId, planId);
        sendSuccess(res, result);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to start checkout');
      }
    }
  );

  // Verify a Razorpay payment and assign the plan on success.
  router.post(
    '/me/plan/verify',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const planId = String(req.body?.planId || '').trim();
      const razorpay_order_id = String(req.body?.razorpay_order_id || '').trim();
      const razorpay_payment_id = String(req.body?.razorpay_payment_id || '').trim();
      const razorpay_signature = String(req.body?.razorpay_signature || '').trim();
      if (!planId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return sendBadRequest(res, 'planId and Razorpay order/payment/signature are required');
      }
      try {
        const result = await svc.verifyPlanPayment(
          vendorId,
          planId,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        );
        if (!result.verified) return sendBadRequest(res, 'Payment verification failed');
        sendSuccess(res, result);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to verify payment');
      }
    }
  );

  // ─── Service vendor: catalog taxonomy + per-vendor offerings (catalog_vendor_services) ───
  router.get(
    '/me/catalog/service-categories',
    requirePermission('vendor.portal.service.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const items = await offeredSvc.listServiceCategories();
        sendSuccess(res, { items });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to list service categories');
      }
    },
  );

  router.get(
    '/me/catalog/service-items',
    requirePermission('vendor.portal.service.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const items = await offeredSvc.listCatalogServiceItems();
        sendSuccess(res, { items });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to list catalog services');
      }
    },
  );

  router.get(
    '/me/vendor-services',
    requirePermission('vendor.portal.service.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const items = await offeredSvc.listOfferings(vendorId);
        sendSuccess(res, { items });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to list vendor services');
      }
    },
  );

  router.post(
    '/me/vendor-services',
    requirePermission('vendor.portal.service.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const dto = plainToClass(CreateVendorServiceOfferingDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const row = await offeredSvc.createOffering(vendorId, dto as unknown as CreateVendorServiceOfferingDto);
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Create failed');
      }
    },
  );

  router.patch(
    '/me/vendor-services/:linkId',
    requirePermission('vendor.portal.service.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const dto = plainToClass(PatchVendorServiceOfferingDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const row = await offeredSvc.updateOffering(vendorId, req.params.linkId, dto);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Vendor service offer not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Update failed');
      }
    },
  );

  router.delete(
    '/me/vendor-services/:linkId',
    requirePermission('vendor.portal.service.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        await offeredSvc.deleteOffering(vendorId, req.params.linkId);
        sendSuccess(res, { ok: true });
      } catch (e: any) {
        if (e.message === 'Vendor service offer not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Delete failed');
      }
    },
  );

  router.get(
    '/me/booking-availability',
    requirePermission('vendor.portal.service.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const data = await bookingAvailSvc.getForVendor(vendorId);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to load availability');
      }
    },
  );

  router.put(
    '/me/booking-availability',
    requirePermission('vendor.portal.service.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const data = await bookingAvailSvc.saveForVendor(vendorId, req.body);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to save availability');
      }
    },
  );

  // ─── Product catalog (same DB tables as admin product form) ───
  router.get(
    '/me/catalog/categories-for-products',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const items = await catalogSvc.getCategoriesForProducts();
        sendSuccess(res, { items });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to load categories');
      }
    },
  );

  router.get(
    '/me/catalog/tax-configurations',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const items = await catalogSvc.listTaxConfigurations();
        sendSuccess(res, { items });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to load tax configurations');
      }
    },
  );

  router.get(
    '/me/catalog/product-attributes',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const items = await catalogSvc.listProductAttributes();
        sendSuccess(res, { items });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to load attributes');
      }
    },
  );

  router.get(
    '/me/products',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const { limit, offset } = parsePaging(req);
      const q = req.query.q ? String(req.query.q) : undefined;
      const status = req.query.status ? String(req.query.status) : 'all';
      const moderation = req.query.moderation ? String(req.query.moderation) : 'all';
      try {
        const { items, total } = await catalogSvc.listProductsForVendor(vendorId, {
          q,
          status,
          moderation,
          limit,
          offset,
        });
        const withSold = await catalogSvc.attachUnitsSold(vendorId, items);
        sendSuccess(res, { items: withSold, total, limit, offset });
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Failed to list products');
      }
    },
  );

  router.post(
    '/me/products',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const row = await catalogSvc.createProductForVendor(vendorId, (req.body || {}) as Record<string, unknown>);
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Create failed');
      }
    },
  );

  router.get(
    '/me/products/:productId',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const row = await catalogSvc.getProductForVendor(vendorId, req.params.productId);
      if (!row) return sendNotFound(res, 'Product not found');
      sendSuccess(res, row);
    },
  );

  router.patch(
    '/me/products/:productId',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const row = await catalogSvc.updateProductForVendor(
          vendorId,
          req.params.productId,
          (req.body || {}) as Record<string, unknown>,
        );
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Product not found') return sendNotFound(res, e.message);
        if (e.message === 'Product does not belong to vendor') return sendForbidden(res, e.message);
        sendBadRequest(res, e?.message || 'Update failed');
      }
    },
  );

  router.delete(
    '/me/products/:productId',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        await catalogSvc.deleteProductForVendor(vendorId, req.params.productId);
        sendSuccess(res, { ok: true });
      } catch (e: any) {
        if (e.message === 'Product not found') return sendNotFound(res, e.message);
        if (e.message === 'Product does not belong to vendor') return sendForbidden(res, e.message);
        sendBadRequest(res, e?.message || 'Delete failed');
      }
    },
  );

  // ─── Vendor settlement payouts ───
  router.get(
    '/me/settlements',
    requirePermission('vendor.portal.settlement.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const { limit, offset } = parsePaging(req);
      const q = req.query.q ? String(req.query.q) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;
      const data = await svc.listSettlementsForVendor(vendorId, limit, offset, { q, status, from, to });
      sendSuccess(res, data);
    }
  );

  router.get(
    '/me/settlements/:settlementId',
    requirePermission('vendor.portal.settlement.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const row = await svc.getSettlementForVendor(vendorId, req.params.settlementId);
      if (!row) return sendNotFound(res, 'Settlement not found');
      sendSuccess(res, row);
    }
  );

  router.get(
    '/me/rating-summary',
    requirePermission('vendor.portal.review.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const data = await svc.getRatingSummaryForVendor(vendorId);
      sendSuccess(res, data);
    }
  );

  router.post(
    '/me/documents/upload',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response, next) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      (req as any).vendorUploadId = vendorId;
      vendorDocumentUpload.single('file')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') return sendBadRequest(res, 'File too large (max 12 MB)');
          return sendBadRequest(res, err.message);
        }
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return sendBadRequest(res, msg);
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      const vendorId = String((req as any).vendorUploadId || '');
      const file = req.file;
      if (!file || !vendorId) return sendBadRequest(res, 'No file uploaded');
      const url = vendorDocumentPublicUrl(vendorId, file.filename);
      sendCreated(res, { url, mimeType: file.mimetype, size: file.size, originalName: file.originalname });
    },
  );

  // ─── Vendor media library ───
  router.get(
    '/me/media/folders',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const data = await mediaSvc.listFolders(vendorId);
      sendSuccess(res, data);
    },
  );

  router.post(
    '/me/media/folders',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const row = await mediaSvc.createFolder(vendorId, String(req.body?.name || ''));
        sendCreated(res, row);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Create folder failed');
      }
    },
  );

  router.get(
    '/me/media/folders/:folderId/assets',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const data = await mediaSvc.listFolderAssets(vendorId, req.params.folderId);
        sendSuccess(res, data);
      } catch (e: any) {
        if (e.message === 'Folder not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Failed to list assets');
      }
    },
  );

  router.get(
    '/me/media/assets',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const { limit, offset } = parsePaging(req);
      const q = req.query.q ? String(req.query.q) : undefined;
      const typeRaw = String(req.query.type || 'all').toLowerCase();
      const type = typeRaw === 'images' || typeRaw === 'documents' ? typeRaw : 'all';
      const data = await mediaSvc.searchAssets(vendorId, { q, type, limit, offset });
      sendSuccess(res, data);
    },
  );

  router.post(
    '/me/media/folders/:folderId/upload',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const folderId = req.params.folderId;
      const upload = createVendorMediaUpload(vendorId, folderId);
      upload.single('file')(req, res, async (err: unknown) => {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') return sendBadRequest(res, 'File too large (max 12 MB)');
          return sendBadRequest(res, err.message);
        }
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return sendBadRequest(res, msg);
        }
        const file = req.file;
        if (!file) return sendBadRequest(res, 'No file uploaded');
        try {
          const url = vendorMediaPublicUrl(vendorId, folderId, file.filename);
          const row = await mediaSvc.createAssetFromUpload(vendorId, folderId, file, url);
          sendCreated(res, row);
        } catch (e: any) {
          if (e.message === 'Folder not found') return sendNotFound(res, e.message);
          sendBadRequest(res, e?.message || 'Upload failed');
        }
      });
    },
  );

  router.patch(
    '/me/media/assets/:assetId',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const folderId = String((req.body as { folderId?: string })?.folderId || '').trim();
      if (!folderId) return sendBadRequest(res, 'folderId is required');
      try {
        const row = await mediaSvc.moveAsset(vendorId, req.params.assetId, folderId);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Asset not found' || e.message === 'Folder not found') {
          return sendNotFound(res, e.message);
        }
        sendBadRequest(res, e?.message || 'Move failed');
      }
    },
  );

  router.delete(
    '/me/media/assets/:assetId',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        await mediaSvc.deleteAsset(vendorId, req.params.assetId);
        sendSuccess(res, { ok: true });
      } catch (e: any) {
        if (e.message === 'Asset not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Delete failed');
      }
    },
  );

  router.delete(
    '/me/media/folders/:folderId',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        await mediaSvc.deleteFolder(vendorId, req.params.folderId);
        sendSuccess(res, { ok: true });
      } catch (e: any) {
        if (e.message === 'Folder not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Delete folder failed');
      }
    },
  );

  // ─── Per-vendor category commission override ───
  router.patch(
    '/me/categories/:categoryId/override',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const raw = req.body?.commissionOverridePercent;
      const pct = raw === null || raw === '' || raw === undefined ? null : Number(raw);
      if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
        return sendBadRequest(res, 'commissionOverridePercent must be a number between 0 and 100, or null');
      }
      try {
        const row = await svc.setCategoryOverride(vendorId, req.params.categoryId, pct);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Category not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  // ─── Per-product commission override (vendor's own products only) ───
  router.patch(
    '/me/products/:productId/override',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const raw = req.body?.commissionOverridePercent;
      const pct = raw === null || raw === '' || raw === undefined ? null : Number(raw);
      if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
        return sendBadRequest(res, 'commissionOverridePercent must be a number between 0 and 100, or null');
      }
      try {
        const row = await svc.setProductOverride(vendorId, req.params.productId, pct);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Product not found') return sendNotFound(res, e.message);
        if (e.message === 'Product does not belong to vendor') return sendForbidden(res, e.message);
        sendBadRequest(res, e.message);
      }
    }
  );

  // ─── Dropshipping ───
  router.get(
    '/me/dropshipping/settings',
    requirePermission('vendor.portal.me.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const data = await dropshipSvc.getSettingsBundle(vendorId);
      sendSuccess(res, data);
    },
  );

  router.put(
    '/me/dropshipping/settings',
    requirePermission('vendor.portal.me.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const dto = plainToClass(PutVendorDropshippingSettingsDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const data = await dropshipSvc.saveSettings(vendorId, dto);
        sendSuccess(res, data);
      } catch (e: any) {
        sendBadRequest(res, e?.message || 'Save failed');
      }
    },
  );

  router.get(
    '/me/dropshipping/suppliers',
    requirePermission('vendor.portal.me.read'),
    async (_req: Request, res: Response) => {
      const data = await dropshipSvc.listActiveSuppliers();
      sendSuccess(res, data);
    },
  );

  router.get(
    '/me/dropshipping/orders',
    requirePermission('vendor.portal.order.read'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const { limit, offset } = parsePaging(req);
      const data = await dropshipSvc.listOrders(vendorId, limit, offset);
      sendSuccess(res, data);
    },
  );

  router.post(
    '/me/dropshipping/orders/from-commerce/:orderId',
    requirePermission('vendor.portal.order.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const row = await dropshipSvc.ensureDropshipOrderForCommerceOrder(vendorId, req.params.orderId);
        sendCreated(res, row);
      } catch (e: any) {
        if (e.message === 'Order not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Create failed');
      }
    },
  );

  router.post(
    '/me/dropshipping/orders/:id/forward',
    requirePermission('vendor.portal.order.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      try {
        const row = await dropshipSvc.forwardOrder(vendorId, req.params.id);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Dropshipping order not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Forward failed');
      }
    },
  );

  router.patch(
    '/me/dropshipping/orders/:id/status',
    requirePermission('vendor.portal.order.write'),
    async (req: Request, res: Response) => {
      const vendorId = await requireVendorId(req, res, svc);
      if (!vendorId) return;
      const dto = plainToClass(PatchDropshippingOrderStatusDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map((e) => Object.values(e.constraints || {})).flat();
        return sendBadRequest(res, msgs.join(', '));
      }
      try {
        const row = await dropshipSvc.updateOrderStatus(vendorId, req.params.id, dto.status);
        sendSuccess(res, row);
      } catch (e: any) {
        if (e.message === 'Dropshipping order not found') return sendNotFound(res, e.message);
        sendBadRequest(res, e?.message || 'Update failed');
      }
    },
  );

  router.get('/support/tickets', requirePermission('vendor.portal.me.read'), async(req:Request,res:Response)=>{const id=await requireVendorId(req,res,svc);if(!id)return;sendSuccess(res,await supportSvc.list(id));});
  router.post('/support/tickets', requirePermission('vendor.portal.me.write'), async(req:Request,res:Response)=>{const id=await requireVendorId(req,res,svc);if(!id)return;try{sendCreated(res,await supportSvc.create(id,req.body||{}));}catch(e:any){sendBadRequest(res,e.message);}});
  router.get('/support/tickets/:id', requirePermission('vendor.portal.me.read'), async(req:Request,res:Response)=>{const id=await requireVendorId(req,res,svc);if(!id)return;try{sendSuccess(res,await supportSvc.get(id,req.params.id));}catch(e:any){sendNotFound(res,e.message);}});
  router.post('/support/tickets/:id/messages', requirePermission('vendor.portal.me.write'), async(req:Request,res:Response)=>{const id=await requireVendorId(req,res,svc);if(!id)return;try{sendCreated(res,await supportSvc.message(id,req.params.id,req.body||{}));}catch(e:any){e.message.includes('not found')?sendNotFound(res,e.message):sendBadRequest(res,e.message);}});
  router.patch('/support/tickets/:id/close', requirePermission('vendor.portal.me.write'), async(req:Request,res:Response)=>{const id=await requireVendorId(req,res,svc);if(!id)return;try{sendSuccess(res,await supportSvc.close(id,req.params.id));}catch(e:any){sendNotFound(res,e.message);}});
  return router;
}
