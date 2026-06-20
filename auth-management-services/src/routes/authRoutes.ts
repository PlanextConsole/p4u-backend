import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AuthService } from '../service/authService';
import { VendorOnboardingService } from '../service/vendorOnboardingService';
import { PhoneAuthService } from '../service/phoneAuthService';
import { SignUpRequest } from '../dto/SignUpRequest';
import { LoginRequest } from '../dto/LoginRequest';
import { AuthResponse } from '../dto/AuthResponse';
import { ForgotPasswordRequest } from '../dto/ForgotPasswordRequest';
import { ChangePasswordRequest } from '../dto/ChangePasswordRequest';
import { PhoneExchangeRequest } from '../dto/PhoneExchangeRequest';
import { VendorRegisterByPhoneRequest } from '../dto/VendorRegisterByPhoneRequest';
import { CustomerRegisterByPhoneRequest } from '../dto/CustomerRegisterByPhoneRequest';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import {
  jwtAuth,
  requireRole,
  requireAnyRole,
  requirePermission,
  requireCustomerSelfOrAdmin,
  requireVendorSelfOrAdmin,
  requireLinkedCustomerAccessOrAdmin,
} from '../middleware/authMiddleware';
import {
  publicLoginLimiter,
  publicSignupLimiter,
  publicForgotPasswordLimiter,
  publicRefreshLimiter,
  introspectLimiter,
} from '../middleware/rateLimitMiddleware';
import { requireIntrospectSecret } from '../middleware/introspectSecretMiddleware';
import { AppDataSource } from '../config/database';
import { CustomerOccupation } from '../entity/CustomerOccupation';
import {
  bodyOptionalNumber,
  mapCaughtErrorToMessage,
  statusForPhoneExchangeFailure,
} from '../http/mapCaughtError';

export const createAuthRoutes = (
  authService: AuthService,
  keycloakAdmin: KcAdminClient,
): Router => {
  const router = Router();
  const vendorOnboardingService = new VendorOnboardingService();
  const phoneAuthService = new PhoneAuthService(keycloakAdmin);

  router.get('/public/health', (req: Request, res: Response) => {
    res.json({ message: 'Auth Management Service is running' });
  });

  /**
   * Customer occupations — same table and ordering as admin `GET /api/admin/occupations`.
   * Query: `purpose=all` or `includeInactive=true` matches admin customer screens
   * (`listOccupations({ purpose: 'all' })`), including inactive rows. Omit for active-only.
   */
  router.get('/public/occupations', async (req: Request, res: Response) => {
    try {
      const purpose = String(req.query.purpose || '').toLowerCase();
      const includeInactive =
        purpose === 'all' || String(req.query.includeInactive || '').toLowerCase() === 'true';
      const repo = AppDataSource.getRepository(CustomerOccupation);
      const rows = includeInactive
        ? await repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } })
        : await repo.find({
            where: { isActive: true },
            order: { sortOrder: 'ASC', name: 'ASC' },
          });
      res.json({
        items: rows.map(r => ({
          id: r.id,
          name: r.name,
          isActive: r.isActive,
          sortOrder: r.sortOrder,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || 'Failed to list occupations' });
    }
  });

  router.post('/public/signup', publicSignupLimiter, async (req: Request, res: Response) => {
    try {
      const signUpRequest = plainToClass(SignUpRequest, req.body);
      const errors = await validate(signUpRequest);

      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
        return res.status(400).json({ message: errorMessages.join(', ') });
      }

      const response = await authService.signUp(signUpRequest);
      res.status(201).json(response);
    } catch (error: any) {
      res.status(400).json({ message: mapCaughtErrorToMessage(error) });
    }
  });

  router.post('/public/login', publicLoginLimiter, async (req: Request, res: Response) => {
    try {
      const loginRequest = plainToClass(LoginRequest, req.body);
      const errors = await validate(loginRequest);

      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
        return res.status(400).json({ message: errorMessages.join(', ') });
      }

      const response = await authService.login(loginRequest);
      res.json(response);
    } catch (error: any) {
      res.status(401).json({ message: mapCaughtErrorToMessage(error) });
    }
  });

  /**
   * Phone-OTP login entry point. The customer/vendor web app posts a Firebase
   * Phone Auth ID token here after a successful client-side
   * `signInWithPhoneNumber` confirmation. We respond with either Keycloak
   * tokens (for an existing user — phone-claim) or a short-lived registration
   * token the FE then posts back with profile fields.
   *
   * Body: { idToken: string, intendedRole?: 'CUSTOMER' | 'VENDOR' }
   */
  router.post(
    '/public/phone/exchange',
    publicLoginLimiter,
    async (req: Request, res: Response) => {
      try {
        const dto = plainToClass(PhoneExchangeRequest, req.body);
        const errors = await validate(dto);
        if (errors.length > 0) {
          const errorMessages = errors.map(e => Object.values(e.constraints || {})).flat();
          return res.status(400).json({ message: errorMessages.join(', ') });
        }
        const idToken = dto.idToken.trim();
        const role = String(dto.intendedRole || 'CUSTOMER').toUpperCase() as 'CUSTOMER' | 'VENDOR';
        const result = await phoneAuthService.phoneExchange(idToken, role);
        return res.json(result);
      } catch (error: any) {
        const message = mapCaughtErrorToMessage(error);
        const status = statusForPhoneExchangeFailure(message);
        return res.status(status).json({ message });
      }
    },
  );

  /**
   * OTP-LAST vendor signup. The vendor-web wizard collects every business
   * field first, runs Firebase phone verification at submit time, then posts
   * the resulting ID token alongside the full payload here. We create the
   * Keycloak VENDOR user, the catalog_vendors row (status=pending) and the
   * vendor_signup_requests audit row in one shot, then return Keycloak
   * tokens so the vendor lands inside their dashboard immediately.
   */
  router.post(
    '/public/vendor/register-by-phone',
    publicSignupLimiter,
    async (req: Request, res: Response) => {
      try {
        const dto = plainToClass(VendorRegisterByPhoneRequest, req.body);
        const errors = await validate(dto);
        if (errors.length > 0) {
          const errorMessages = errors.map(e => Object.values(e.constraints || {})).flat();
          return res.status(400).json({ message: errorMessages.join(', ') });
        }
        const auth = await phoneAuthService.registerVendor({
          firebaseIdToken: dto.firebaseIdToken,
          vendorKind:
            String(dto.vendorKind || 'product').toLowerCase() === 'service'
              ? 'service'
              : 'product',
          vendorType:
            String(dto.vendorType || 'PRODUCT').toUpperCase() === 'SERVICE'
              ? 'SERVICE'
              : 'PRODUCT',
          ownerName: dto.ownerName,
          businessName: dto.businessName,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          gst: dto.gst ?? null,
          pan: dto.pan ?? null,
          categoriesJson: dto.categoriesJson ?? null,
          servicesJson: dto.servicesJson ?? null,
          addressJson: dto.addressJson ?? null,
          documentsJson: dto.documentsJson ?? null,
          bankJson: dto.bankJson ?? null,
        });
        return res.status(201).json(auth);
      } catch (error: any) {
        return res.status(400).json({ message: mapCaughtErrorToMessage(error) });
      }
    },
  );

  /**
   * Step 2 of customer phone-OTP signup. Consumes the registrationToken from
   * `/phone/exchange`, creates the Keycloak user + customer_profiles row,
   * and returns Keycloak tokens. The FE stores tokens and routes the user to
   * the customer dashboard.
   */
  router.post(
    '/public/customer/register-by-phone',
    publicSignupLimiter,
    async (req: Request, res: Response) => {
      try {
        const dto = plainToClass(CustomerRegisterByPhoneRequest, req.body);
        const errors = await validate(dto);
        if (errors.length > 0) {
          const errorMessages = errors.map(e => Object.values(e.constraints || {})).flat();
          return res.status(400).json({ message: errorMessages.join(', ') });
        }
        const auth = await phoneAuthService.registerCustomer({
          registrationToken: dto.registrationToken,
          fullName: dto.fullName,
          email: dto.email ?? null,
          state: dto.state ?? null,
          district: dto.district ?? null,
          areaLocality: dto.areaLocality ?? null,
          pincode: dto.pincode ?? null,
          occupationId: dto.occupationId ?? null,
          customOccupation: dto.customOccupation ?? null,
          latitude: bodyOptionalNumber(dto.latitude),
          longitude: bodyOptionalNumber(dto.longitude),
          referralCode: dto.referralCode ?? null,
        });
        return res.status(201).json(auth);
      } catch (error: any) {
        return res.status(400).json({ message: mapCaughtErrorToMessage(error) });
      }
    },
  );

  router.post('/public/refresh', publicRefreshLimiter, async (req: Request, res: Response) => {
    try {
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';

      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required in request body' });
      }

      const response = await authService.refreshToken(refreshToken);
      res.json(response);
    } catch (error: any) {
      res.status(401).json({ message: mapCaughtErrorToMessage(error) });
    }
  });

  router.post('/logout', jwtAuth, async (req: Request, res: Response) => {
    try {
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';

      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required in request body' });
      }

      await authService.logout(refreshToken);
      res.json({ message: 'Logout successful' });
    } catch (error: any) {
      res.status(400).json({ message: mapCaughtErrorToMessage(error) });
    }
  });

  router.post(
    '/introspect',
    introspectLimiter,
    requireIntrospectSecret,
    async (req: Request, res: Response) => {
      try {
        const token = req.body.token || req.query.token as string;
        const tokenType = (req.body.tokenType || req.query.tokenType || 'access_token') as
          | 'access_token'
          | 'refresh_token';

        if (!token) {
          return res.status(400).json({ message: 'Token is required' });
        }

        const introspection = await authService.introspectToken(token, tokenType);
        res.json(introspection);
      } catch (error: any) {
        res.status(400).json({ message: mapCaughtErrorToMessage(error) });
      }
    }
  );

  router.post('/public/forgot-password', publicForgotPasswordLimiter, async (req: Request, res: Response) => {
    try {
      const forgotPasswordRequest = plainToClass(ForgotPasswordRequest, req.body);
      const errors = await validate(forgotPasswordRequest);

      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
        return res.status(400).json({ message: errorMessages.join(', ') });
      }

      await authService.forgotPassword(forgotPasswordRequest);
    } catch (error: any) {
      // Log the real failure for ops visibility (KC SMTP down, DB unreachable, etc.)
      // but still return the generic 200 below to avoid email enumeration.
      console.error('forgot-password failed:', error?.message || error);
    }
    res.json({ message: 'If the email exists, a password reset link has been sent' });
  });

  router.post('/public/reset-password', publicForgotPasswordLimiter, (_req: Request, res: Response) => {
    res.status(501).json({
      message:
        'Password reset is completed only in the Keycloak flow: use POST /public/forgot-password, then open the link in the email. No API body reset is implemented here.',
    });
  });

  router.post('/change-password', jwtAuth, async (req: Request, res: Response) => {
    try {
      const changePasswordRequest = plainToClass(ChangePasswordRequest, req.body);
      const errors = await validate(changePasswordRequest);

      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
        return res.status(400).json({ message: errorMessages.join(', ') });
      }

      const auth = (req as any).auth;
      const keycloakUserId = auth.sub; // Keycloak user ID from JWT token

      if (!keycloakUserId) {
        return res.status(401).json({ message: 'User ID not found in token' });
      }

      await authService.changePassword(keycloakUserId, changePasswordRequest);
      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      res.status(400).json({ message: mapCaughtErrorToMessage(error) });
    }
  });

  router.get('/vendor/info', jwtAuth, requireRole('VENDOR'), (req: Request, res: Response) => {
    const auth = (req as any).auth;
    res.json(auth);
  });

  /**
   * Vendor self-onboarding (post-login). Lets a logged-in VENDOR-role user
   * submit / fetch their profile request that lives in vendor_signup_requests.
   * Used by the vendor portal when an authenticated user has no catalog
   * vendor row yet.
   */
  router.get(
    '/vendor/me/onboarding',
    jwtAuth,
    requireRole('VENDOR'),
    async (req: Request, res: Response) => {
      try {
        const auth = (req as any).auth;
        const sub = String(auth?.sub || '');
        if (!sub) return res.status(401).json({ message: 'Missing user context in token' });
        const record = await vendorOnboardingService.getMyOnboarding({
          keycloakUserId: sub,
          username: auth?.preferred_username,
          email: auth?.email,
        });
        if (!record) return res.status(404).json({ message: 'No onboarding request found' });
        res.json(record);
      } catch (error: any) {
        res.status(400).json({ message: mapCaughtErrorToMessage(error) });
      }
    },
  );

  router.post(
    '/vendor/me/onboarding',
    jwtAuth,
    requireRole('VENDOR'),
    async (req: Request, res: Response) => {
      try {
        const auth = (req as any).auth;
        const sub = String(auth?.sub || '');
        if (!sub) return res.status(401).json({ message: 'Missing user context in token' });
        const record = await vendorOnboardingService.submitMyOnboarding(
          {
            keycloakUserId: sub,
            username: auth?.preferred_username,
            email: auth?.email,
          },
          req.body || {},
        );
        res.status(201).json(record);
      } catch (error: any) {
        res.status(400).json({ message: mapCaughtErrorToMessage(error) });
      }
    },
  );

  router.get('/customer/info', jwtAuth, requireRole('CUSTOMER'), (req: Request, res: Response) => {
    const auth = (req as any).auth;
    res.json(auth);
  });

  router.get('/admin/info', jwtAuth, requireRole('ADMIN'), (req: Request, res: Response) => {
    const auth = (req as any).auth;
    res.json(auth);
  });

  // Ownership-based self access examples (admin override allowed)
  router.get(
    '/customer/:customerId/info',
    jwtAuth,
    requireAnyRole(['ADMIN', 'CUSTOMER']),
    requirePermission('customer.read.self'),
    requireCustomerSelfOrAdmin('customerId'),
    (req: Request, res: Response) => {
      res.json({ customerId: req.params.customerId, auth: (req as any).auth });
    }
  );

  router.get(
    '/vendor/:vendorId/info',
    jwtAuth,
    requireAnyRole(['ADMIN', 'VENDOR']),
    requirePermission('vendor.read.self'),
    requireVendorSelfOrAdmin('vendorId'),
    (req: Request, res: Response) => {
      res.json({ vendorId: req.params.vendorId, auth: (req as any).auth });
    }
  );

  // Relationship-based access example for vendor -> linked customer read
  router.get(
    '/vendor/customers/:customerId/info',
    jwtAuth,
    requireAnyRole(['ADMIN', 'VENDOR']),
    requirePermission('customer.read.linked'),
    requireLinkedCustomerAccessOrAdmin('customerId'),
    (req: Request, res: Response) => {
      res.json({ customerId: req.params.customerId, auth: (req as any).auth });
    }
  );

  return router;
};

