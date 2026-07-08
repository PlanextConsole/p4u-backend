import KcAdminClient from '@keycloak/keycloak-admin-client';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import axios, { AxiosResponse } from 'axios';
import { verifyPhoneIdToken } from '../config/firebaseAdmin';
import { ensureKeycloakAdminAuth } from '../config/keycloakAdmin';
import { CustomerProfileRepository } from '../repository/customerProfileRepository';
import { CustomerProfile } from '../entity/CustomerProfile';
import { CatalogVendorRepository } from '../repository/catalogVendorRepository';
import { CatalogVendor } from '../entity/CatalogVendor';
import { VendorRegistrationRequestRepository } from '../repository/vendorRegistrationRequestRepository';
import { VendorRegistrationRequest } from '../entity/VendorRegistrationRequest';
import { UserRepository } from '../repository/userRepository';
import { User } from '../entity/User';
import { AuthResponse } from '../dto/AuthResponse';

/**
 * Phone-OTP based auth flow. Customer/Vendor web apps use the Firebase
 * Phone Auth client SDK to send/verify SMS, then post the resulting Firebase
 * ID token here. We translate that into either:
 *
 *   - immediate Keycloak login (existing user, "phone-claim" path), or
 *   - a short-lived registration token the FE then posts back with profile
 *     data to actually create the account.
 *
 * Vendor flow reuses the same `/phone/exchange` entry point but the FE
 * routes new users to the vendor onboarding screen instead of the customer
 * register screen.
 */

/** After OTP, the browser has this long to POST `/register-by-phone`. Env: PHONE_REG_TOKEN_TTL_SECONDS (60–86400). Default 1h. */
const REG_TOKEN_TTL_SECONDS = (() => {
  const raw = parseInt(process.env.PHONE_REG_TOKEN_TTL_SECONDS || '', 10);
  const n = Number.isFinite(raw) && raw > 0 ? raw : 60 * 60;
  return Math.min(Math.max(n, 60), 24 * 60 * 60);
})();

/** Shown when a vendor whose registration is not yet approved tries to log in. */
export const VENDOR_PENDING_MESSAGE =
  'Your registration request is still pending approval. Please wait until your account is approved.';
/** Shown when a rejected vendor tries to log in. */
export const VENDOR_REJECTED_MESSAGE =
  'Your vendor registration request was rejected. Please contact support for assistance.';

interface AccessTokenClaims {
  realm_access?: { roles?: string[] };
  permissions?: string[];
  scope?: string;
  vendor_id?: string;
  customer_id?: string;
  sub?: string;
}

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in?: number;
}

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  ADMIN: ['*'],
  VENDOR: [
    'vendor.read.self',
    'vendor.write.self',
    'customer.read.linked',
    'catalog.read.public',
    'content.read.public',
    'content.newsletter.subscribe',
    'vendor.portal.me.read',
    'vendor.portal.me.write',
    'vendor.portal.order.read',
    'vendor.portal.order.write',
    'vendor.portal.org_order.read',
    'vendor.portal.org_order.write',
    'vendor.portal.settlement.read',
    'vendor.portal.review.read',
    'vendor.portal.referral.read',
    'vendor.portal.service.read',
    'vendor.portal.service.write',
    'vendor.portal.booking.read',
    'vendor.portal.booking.write',
  ],
  CUSTOMER: [
    'customer.read.self',
    'customer.write.self',
    'vendor.read.public',
    'catalog.read.public',
    'content.read.public',
    'content.newsletter.subscribe',
  ],
};

export interface PhoneExchangeResult {
  /** When true, FE has tokens and can send the user straight to home. */
  loggedIn: boolean;
  /** Verified E.164 phone, returned in both branches. */
  phone: string;
  /** Present when loggedIn === true. */
  auth?: AuthResponse;
  /** Present when loggedIn === false (new user) — FE posts this back with the registration form. */
  registrationToken?: string;
  /** Hint for the FE: which form to show. */
  intendedRole?: 'CUSTOMER' | 'VENDOR';
}

export interface CustomerRegistrationPayload {
  registrationToken: string;
  fullName: string;
  email?: string | null;
  state?: string | null;
  district?: string | null;
  areaLocality?: string | null;
  pincode?: string | null;
  occupationId?: string | null;
  /** Free-text occupation when user does not pick a row from `customer_occupations`. Stored as `metadata.occupation` (admin UI shows this as fallback). */
  customOccupation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  referralCode?: string | null;
}

/**
 * OTP-last vendor self-registration. The vendor fills the whole 4-step wizard
 * (Details → KYC → Bank → Review) and only proves phone ownership at submit
 * time, so the Firebase ID token comes in directly with this payload — no
 * intermediate registrationToken JWT.
 *
 * Field set is aligned with the catalog_vendors columns the existing admin
 * UI already understands so admin can review the row in the
 * "Service vendors > Pending Approval" tab without translation.
 */
export interface VendorRegistrationPayload {
  /** Firebase Phone Auth ID token from the browser SDK. */
  firebaseIdToken: string;
  vendorKind: 'service' | 'product';
  vendorType: 'SERVICE' | 'PRODUCT';
  ownerName: string;
  businessName: string;
  email?: string | null;
  /** Display phone — must match the verified Firebase phone (any common format). */
  phone?: string | null;
  gst?: string | null;
  pan?: string | null;
  categoriesJson?: unknown;
  servicesJson?: unknown;
  addressJson?: Record<string, unknown> | null;
  documentsJson?: Record<string, unknown> | null;
  bankJson?: Record<string, unknown> | null;
}

/**
 * No-OTP vendor registration. Business details only — no Firebase token, no
 * Keycloak user. We persist a pending vendor_signup_requests row that admin
 * reviews; the Keycloak user is provisioned lazily at the vendor's first OTP
 * login after approval.
 */
export interface VendorPendingRegistrationPayload {
  vendorKind: 'service' | 'product';
  vendorType: 'SERVICE' | 'PRODUCT';
  ownerName: string;
  businessName: string;
  email?: string | null;
  phone: string;
  gst?: string | null;
  pan?: string | null;
  categoriesJson?: unknown;
  servicesJson?: unknown;
  addressJson?: Record<string, unknown> | null;
  documentsJson?: Record<string, unknown> | null;
  bankJson?: Record<string, unknown> | null;
}

export type VendorAccountStatus = 'not_registered' | 'pending' | 'approved' | 'rejected';

function parseOptionalCoord(v: unknown): string | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  return n.toFixed(7);
}

export class PhoneAuthService {
  private keycloakAdmin: KcAdminClient;
  private customerProfileRepo: CustomerProfileRepository;
  private catalogVendorRepo: CatalogVendorRepository;
  private vendorRequestRepo: VendorRegistrationRequestRepository;
  private userRepo: UserRepository;
  private serverUrl: string;
  private realm: string;
  private clientId: string;
  private clientSecret: string;

  private async ensureKcAdmin(): Promise<void> {
    await ensureKeycloakAdminAuth(this.keycloakAdmin);
  }

  constructor(keycloakAdmin: KcAdminClient) {
    this.keycloakAdmin = keycloakAdmin;
    this.customerProfileRepo = new CustomerProfileRepository();
    this.catalogVendorRepo = new CatalogVendorRepository();
    this.vendorRequestRepo = new VendorRegistrationRequestRepository();
    this.userRepo = new UserRepository();
    this.serverUrl = process.env.KEYCLOAK_SERVER_URL || 'http://localhost:8180';
    this.realm = process.env.KEYCLOAK_REALM || 'p4u-realm';
    this.clientId = process.env.KEYCLOAK_CLIENT_ID || 'auth-management-client';
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || '';
  }

  /**
   * Step 1 of OTP login: verify a Firebase phone-auth ID token, look up an
   * existing customer/vendor by phone, and return either Keycloak tokens or a
   * short-lived registration token the caller will post back with profile
   * data.
   *
   * `intendedRole` — caller (customer-web vs vendor-web) selects which store
   * we check first: `customer_profiles` vs `catalog_vendors`. If that row is
   * missing we issue a registration token (customer register-by-phone or
   * vendor wizard). The same phone may later hold both roles on one Keycloak user.
   */
  async phoneExchange(
    firebaseIdToken: string,
    intendedRole: 'CUSTOMER' | 'VENDOR',
  ): Promise<PhoneExchangeResult> {
    await this.ensureKcAdmin();
    const claims = await verifyPhoneIdToken(firebaseIdToken);
    const phone = claims.phoneNumber; // E.164

    // 1) Customer claim: existing customer_profiles row already linked to a
    //    Keycloak user → just mint tokens for that user.
    if (intendedRole === 'CUSTOMER') {
      const existing = await this.customerProfileRepo.findByPhone(phone);
      if (existing && existing.keycloakUserId) {
        const auth = await this.loginAsKeycloakUser(existing.keycloakUserId);
        return { loggedIn: true, phone, auth, intendedRole };
      }
    }

    // 2) Vendor login. Only APPROVED vendors may sign in. A vendor that already
    //    has a Keycloak user (returning login, or legacy OTP-flow signup) takes
    //    the fast path; an approved vendor without a Keycloak user yet gets one
    //    provisioned lazily on this first login. Pending / rejected vendors are
    //    rejected with a clear message (vendor-web also gates this before
    //    sending an OTP, so this is a backstop).
    if (intendedRole === 'VENDOR') {
      const existing = await this.catalogVendorRepo.findByPhone(phone);
      if (existing?.keycloakUserId) {
        const auth = await this.loginAsKeycloakUser(existing.keycloakUserId);
        return { loggedIn: true, phone, auth, intendedRole };
      }
      if (existing) {
        const st = (existing.status || '').toLowerCase();
        if (st === 'active' || st === 'approved') {
          const kcId = await this.ensureVendorKeycloakUser(existing, claims);
          const auth = await this.loginAsKeycloakUser(kcId);
          return { loggedIn: true, phone, auth, intendedRole };
        }
        if (st === 'rejected' || st === 'suspended') throw new Error(VENDOR_REJECTED_MESSAGE);
        throw new Error(VENDOR_PENDING_MESSAGE);
      }

      // No catalog row. Legacy OTP-flow vendors may have a Keycloak id stashed
      // in their signup payload — honour it so existing accounts still log in.
      const signup = await this.vendorRequestRepo.findLatestByFirebaseUid(claims.uid);
      const sp = (signup?.payload || {}) as Record<string, unknown>;
      const kcFromSignup =
        typeof sp.keycloakUserId === 'string' ? sp.keycloakUserId.trim() : '';
      if (kcFromSignup) {
        const auth = await this.loginAsKeycloakUser(kcFromSignup);
        return { loggedIn: true, phone, auth, intendedRole };
      }

      // No catalog row yet → use the signup request status so a pending/rejected
      // applicant gets the right message instead of being sent to re-register.
      const req = await this.vendorRequestRepo.findLatestByPhone(phone);
      if (req) {
        const rs = (req.status || '').toLowerCase();
        if (rs === 'pending') throw new Error(VENDOR_PENDING_MESSAGE);
        if (rs === 'rejected') throw new Error(VENDOR_REJECTED_MESSAGE);
      }
      // Truly unknown vendor → fall through to the registration-token path below.
    }

    // 3) New user → issue a registration token. Customer-web FE posts this
    //    back to /register-by-phone with profile fields. Vendor-web flow is
    //    OTP-LAST (the user has already filled the whole wizard before we
    //    send the OTP), so vendor-web never round-trips this token — it
    //    posts the Firebase ID token directly to /vendor/register-by-phone.
    //    We still return the token here so vendor-web has the option to
    //    pre-OTP later, and so this endpoint stays symmetrical.
    const registrationToken = this.signRegistrationToken({
      phone,
      firebaseUid: claims.uid,
      role: intendedRole,
    });
    return { loggedIn: false, phone, registrationToken, intendedRole };
  }

  /**
   * Lightweight pre-OTP check for vendor-web: does a registered vendor account
   * already exist for this phone? Lets the login screen avoid sending an SMS OTP
   * to a number that has no vendor account (it routes them to registration
   * instead). DB-only — no Firebase / Keycloak round-trip.
   */
  async vendorPhoneStatus(
    phone: string,
  ): Promise<{ registered: boolean; status: VendorAccountStatus }> {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) return { registered: false, status: 'not_registered' };
    const e164 = `+91${digits.slice(-10)}`;

    // An approved vendor always has a catalog_vendors row (created at approval).
    const vendor = await this.catalogVendorRepo.findByPhone(e164);
    if (vendor) {
      const st = (vendor.status || '').toLowerCase();
      if (st === 'active' || st === 'approved') return { registered: true, status: 'approved' };
      if (st === 'rejected' || st === 'suspended') return { registered: false, status: 'rejected' };
      return { registered: false, status: 'pending' };
    }

    // Otherwise fall back to the signup request (pending review / rejected).
    const req = await this.vendorRequestRepo.findLatestByPhone(e164);
    if (req) {
      const rs = (req.status || '').toLowerCase();
      if (rs === 'approved') return { registered: true, status: 'approved' };
      if (rs === 'rejected') return { registered: false, status: 'rejected' };
      return { registered: false, status: 'pending' };
    }

    return { registered: false, status: 'not_registered' };
  }

  /**
   * No-OTP vendor self-registration. Records a pending vendor_signup_requests
   * row that admin reviews. Deliberately creates no Keycloak user (that happens
   * lazily at first OTP login after approval), which is also why the legacy
   * "User exists with same username" failure can no longer occur at signup.
   */
  async registerVendorPending(
    payload: VendorPendingRegistrationPayload,
  ): Promise<{ status: 'pending'; message: string }> {
    const ownerName = (payload.ownerName || '').trim();
    const businessName = (payload.businessName || '').trim();
    if (!ownerName) throw new Error('Owner name is required');
    if (!businessName) throw new Error('Business name is required');

    const digits = String(payload.phone || '').replace(/\D/g, '');
    if (digits.length < 10) throw new Error('A valid 10-digit mobile number is required');
    const e164 = `+91${digits.slice(-10)}`;

    // Already a real vendor (approved or in catalog)?
    const existingVendor = await this.catalogVendorRepo.findByPhone(e164);
    if (existingVendor) {
      const st = (existingVendor.status || '').toLowerCase();
      if (st === 'rejected' || st === 'suspended') throw new Error(VENDOR_REJECTED_MESSAGE);
      throw new Error('A vendor account already exists for this phone. Please sign in instead.');
    }

    const requestPayload = this.buildVendorRequestPayload(payload, e164);

    // Re-submission of an existing request for this phone: update in place
    // rather than stacking duplicates in the admin queue.
    const existingReq = await this.vendorRequestRepo.findLatestByPhone(e164);
    if (existingReq) {
      const rs = (existingReq.status || '').toLowerCase();
      if (rs === 'rejected') throw new Error(VENDOR_REJECTED_MESSAGE);
      if (rs === 'approved') {
        throw new Error('A vendor account already exists for this phone. Please sign in instead.');
      }
      existingReq.payload = requestPayload;
      await this.vendorRequestRepo.save(existingReq);
      return { status: 'pending', message: 'Registration request updated.' };
    }

    const row = new VendorRegistrationRequest();
    row.requestType = 'vendor-web-signup';
    row.status = 'pending';
    row.payload = requestPayload;
    await this.vendorRequestRepo.save(row);
    return { status: 'pending', message: 'Registration request submitted.' };
  }

  private buildVendorRequestPayload(
    payload: VendorPendingRegistrationPayload,
    e164: string,
  ): Record<string, unknown> {
    const vendorKind = payload.vendorKind === 'service' ? 'service' : 'product';
    const vendorType = payload.vendorType === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
    return {
      source: 'vendor-web-no-otp',
      ownerName: (payload.ownerName || '').trim(),
      businessName: (payload.businessName || '').trim(),
      email: (payload.email || '')?.toString().trim() || null,
      phone: e164,
      vendorKind,
      vendorType,
      gst: nullableTrim(payload.gst),
      pan: nullableTrim(payload.pan),
      categoriesJson: payload.categoriesJson ?? null,
      servicesJson: payload.servicesJson ?? null,
      addressJson: payload.addressJson ?? null,
      documentsJson: payload.documentsJson ?? null,
      bankJson: payload.bankJson ?? null,
    };
  }

  /**
   * Provision (or reuse) the Keycloak VENDOR user for an approved vendor on
   * their first OTP login, then link it to the catalog_vendors row. Reusing an
   * existing user by phone-username is what prevents the legacy
   * "User exists with same username" error.
   */
  private async ensureVendorKeycloakUser(
    vendor: CatalogVendor,
    claims: { uid: string; phoneNumber: string },
  ): Promise<string> {
    if (vendor.keycloakUserId) return vendor.keycloakUserId;
    await this.ensureKcAdmin();

    const keycloakUsername = claims.phoneNumber.replace(/\D/g, '');
    const existingKcList = await this.keycloakAdmin.users.find({
      username: keycloakUsername,
      exact: true,
    });
    let keycloakUserId =
      existingKcList && existingKcList.length > 0 ? existingKcList[0].id ?? '' : '';

    if (!keycloakUserId) {
      const created = await this.keycloakAdmin.users.create({
        username: keycloakUsername,
        email: vendor.email ?? undefined,
        firstName: (vendor.ownerName || '').split(/\s+/)[0] || undefined,
        lastName: (vendor.ownerName || '').split(/\s+/).slice(1).join(' ') || undefined,
        enabled: true,
        emailVerified: false,
        attributes: {
          phone: [claims.phoneNumber],
          firebase_uid: [claims.uid],
          vendor_type: [vendor.vendorType || 'PRODUCT'],
        },
        credentials: [
          { type: 'password', value: crypto.randomBytes(32).toString('hex'), temporary: false },
        ],
      });
      if (!created.id) throw new Error('Failed to create Keycloak vendor user');
      keycloakUserId = created.id;
    }

    const role = await this.keycloakAdmin.roles.findOneByName({ name: 'VENDOR' });
    if (!role || !role.id) throw new Error('Role VENDOR not found in Keycloak');
    const currentRoles = await this.keycloakAdmin.users.listRealmRoleMappings({
      id: keycloakUserId,
    });
    if (!(currentRoles || []).some((r) => r.name === 'VENDOR')) {
      await this.keycloakAdmin.users.addRealmRoleMappings({
        id: keycloakUserId,
        roles: [{ id: role.id, name: role.name! }],
      });
    }

    let userRow = await this.userRepo.findByKeycloakId(keycloakUserId);
    if (!userRow) {
      userRow = new User();
      userRow.keycloakId = keycloakUserId;
    }
    userRow.username = keycloakUsername;
    if ((userRow.userType || '') !== 'CUSTOMER') userRow.userType = 'VENDOR';
    userRow.email = userRow.email || vendor.email || `${keycloakUsername}@phone.local`;
    await this.userRepo.save(userRow);

    vendor.keycloakUserId = keycloakUserId;
    await this.catalogVendorRepo.save(vendor);

    // Let role mapping propagate before the password-grant token issue.
    await new Promise((r) => setTimeout(r, 400));
    return keycloakUserId;
  }

  /**
   * Step 2 (customer): consume the registration token + profile fields, create
   * a Keycloak user (no real password), insert customer_profiles row, mint
   * tokens.
   */
  async registerCustomer(payload: CustomerRegistrationPayload): Promise<AuthResponse> {
    await this.ensureKcAdmin();
    const decoded = this.verifyRegistrationToken(payload.registrationToken);
    if (decoded.role !== 'CUSTOMER') {
      throw new Error('Registration token role mismatch');
    }
    const phone = decoded.phone;

    const fullName = (payload.fullName || '').trim();
    if (!fullName) throw new Error('Full name is required');

    // Race-protection: re-check claim path before creating a duplicate user.
    const existing = await this.customerProfileRepo.findByPhone(phone);
    if (existing && existing.keycloakUserId) {
      return this.loginAsKeycloakUser(existing.keycloakUserId);
    }

    const email = (payload.email || '').trim() || null;

    // Username for Keycloak: phone (no plus, e.g. "919876543210") — unique
    // and stable. Email is a separate optional attribute.
    const keycloakUsername = phone.replace(/\D/g, '');
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(' ').trim() || undefined;

    const existingKcList = await this.keycloakAdmin.users.find({
      username: keycloakUsername,
      exact: true,
    });
    const existingKcId =
      existingKcList && existingKcList.length > 0 ? existingKcList[0].id : undefined;

    // Conflict checks: someone may have signed up via legacy username/password
    // earlier with the same email. Allow the row we are (re)using by username.
    if (email) {
      const byEmail = await this.keycloakAdmin.users.find({ email, exact: true });
      const conflicts = (byEmail || []).filter((u) => u.id && u.id !== existingKcId);
      if (conflicts.length > 0) {
        throw new Error(
          'An account with this email already exists. Sign in with your existing credentials.',
        );
      }
    }

    let keycloakUserId: string;

    if (existingKcId) {
      keycloakUserId = existingKcId;
      const rep = await this.keycloakAdmin.users.findOne({ id: keycloakUserId });
      if (!rep?.username) {
        throw new Error('Keycloak user not found');
      }

      const profileByKc = await this.customerProfileRepo.findByKeycloakUserId(keycloakUserId);
      if (profileByKc?.phone) {
        const sameLast10 =
          profileByKc.phone.replace(/\D/g, '').slice(-10) === keycloakUsername.slice(-10);
        if (sameLast10 && profileByKc.keycloakUserId) {
          return this.loginAsKeycloakUser(keycloakUserId);
        }
        if (!sameLast10) {
          throw new Error(
            'This phone number is already linked to another account. Sign in or contact support.',
          );
        }
      }

      const kcPhoneAttr = (rep.attributes?.phone?.[0] || '').trim();
      const tokenDigits = phone.replace(/\D/g, '');
      const kcDigits = kcPhoneAttr.replace(/\D/g, '');
      const phoneAttrsAlign =
        !kcPhoneAttr ||
        kcDigits === tokenDigits ||
        kcDigits.slice(-10) === tokenDigits.slice(-10);
      if (!phoneAttrsAlign) {
        throw new Error(
          'This phone number conflicts with an existing account. Contact support if you did not create it.',
        );
      }

      const kcFb = (rep.attributes?.firebase_uid?.[0] || '').trim();
      if (kcFb && kcFb !== decoded.firebaseUid) {
        throw new Error(
          'This phone was verified with a different sign-in session. Request a new code or sign in.',
        );
      }

      const realmRoles = await this.keycloakAdmin.users.listRealmRoleMappings({
        id: keycloakUserId,
      });
      const roleNames = new Set((realmRoles || []).map((r) => r.name).filter(Boolean));
      const alreadyVendor = roleNames.has('VENDOR');

      const mergedAttrs: Record<string, string[]> = {
        ...(rep.attributes as Record<string, string[]> | undefined),
        phone: [phone],
        firebase_uid: [decoded.firebaseUid],
      };
      // Same Keycloak user can be both vendor and customer (one phone). Do not
      // overwrite vendor display name / business email on the realm user when
      // linking a customer profile — customer name & email live on customer_profiles.
      await this.keycloakAdmin.users.update(
        { id: keycloakUserId },
        alreadyVendor
          ? { enabled: true, attributes: mergedAttrs }
          : {
              email: email ?? undefined,
              firstName,
              lastName,
              enabled: true,
              attributes: mergedAttrs,
            },
      );

      await this.persistPhoneSignupCustomerRecords({
        keycloakUserId,
        keycloakUsername,
        phone,
        fullName,
        email,
        decoded,
        payload,
        existingProfile: existing,
      });
    } else {
      const created = await this.keycloakAdmin.users.create({
        username: keycloakUsername,
        email: email ?? undefined,
        firstName,
        lastName,
        enabled: true,
        emailVerified: false,
        attributes: { phone: [phone], firebase_uid: [decoded.firebaseUid] },
        credentials: [
          {
            type: 'password',
            // 64 random hex chars — never exposed to the user, never used to
            // log in. We rely on Keycloak admin-issued tokens via direct grant
            // below for this account.
            value: crypto.randomBytes(32).toString('hex'),
            temporary: false,
          },
        ],
      });
      if (!created.id) throw new Error('Failed to create Keycloak user');
      keycloakUserId = created.id;

      try {
        await this.persistPhoneSignupCustomerRecords({
          keycloakUserId,
          keycloakUsername,
          phone,
          fullName,
          email,
          decoded,
          payload,
          existingProfile: existing,
        });
      } catch (err) {
        try {
          await this.keycloakAdmin.users.del({ id: keycloakUserId });
        } catch {
          // best-effort rollback
        }
        throw err;
      }
    }

    // Wait briefly for Keycloak's role mapping to propagate before issuing tokens.
    await new Promise((r) => setTimeout(r, 500));

    return this.loginAsKeycloakUser(keycloakUserId);
  }

  /**
   * After a Keycloak realm user exists for this phone (newly created or reused),
   * assign CUSTOMER role and persist `users` + `customer_profiles`.
   */
  private async persistPhoneSignupCustomerRecords(args: {
    keycloakUserId: string;
    keycloakUsername: string;
    phone: string;
    fullName: string;
    email: string | null;
    decoded: { firebaseUid: string };
    payload: CustomerRegistrationPayload;
    existingProfile: CustomerProfile | null;
  }): Promise<void> {
    const {
      keycloakUserId,
      keycloakUsername,
      phone,
      fullName,
      email,
      decoded,
      payload,
      existingProfile,
    } = args;

    const role = await this.keycloakAdmin.roles.findOneByName({ name: 'CUSTOMER' });
    if (!role || !role.id) {
      throw new Error('Role CUSTOMER not found in Keycloak');
    }
    const currentRoles = await this.keycloakAdmin.users.listRealmRoleMappings({
      id: keycloakUserId,
    });
    const alreadyCustomer = (currentRoles || []).some((r) => r.name === 'CUSTOMER');
    if (!alreadyCustomer) {
      await this.keycloakAdmin.users.addRealmRoleMappings({
        id: keycloakUserId,
        roles: [{ id: role.id, name: role.name! }],
      });
    }

    let user = await this.userRepo.findByKeycloakId(keycloakUserId);
    if (!user) {
      user = new User();
      user.keycloakId = keycloakUserId;
    }
    user.username = keycloakUsername;
    if ((user.userType || '') !== 'VENDOR') {
      user.email = email || `${keycloakUsername}@phone.local`;
      user.userType = 'CUSTOMER';
    }
    await this.userRepo.save(user);

    const profile = existingProfile ?? new CustomerProfile();
    profile.fullName = fullName;
    profile.email = email;
    profile.phone = phone;
    profile.status = 'active';
    const customOcc = (payload.customOccupation || '').trim().slice(0, 255);
    if (customOcc) {
      profile.occupationId = null;
    } else {
      profile.occupationId = (payload.occupationId || '').trim() || null;
    }
    profile.keycloakUserId = keycloakUserId;
    profile.state = (payload.state || '').trim() || null;
    profile.district = (payload.district || '').trim() || null;
    profile.areaLocality = (payload.areaLocality || '').trim() || null;
    profile.pincode = (payload.pincode || '').trim() || null;
    profile.latitude = parseOptionalCoord(payload.latitude);
    profile.longitude = parseOptionalCoord(payload.longitude);
    profile.referralCode = (payload.referralCode || '').trim() || null;
    profile.metadata = {
      signupSource: 'phone-otp',
      firebaseUid: decoded.firebaseUid,
      ...(customOcc ? { occupation: customOcc } : {}),
    };
    await this.customerProfileRepo.save(profile);
  }

  /**
   * Step 2 (vendor): OTP-last vendor signup. Verifies the Firebase ID token
   * fresh (no intermediate JWT), creates a Keycloak VENDOR user, persists
   * both the catalog_vendors row (status=pending) and a vendor_signup_requests
   * audit row, then mints Keycloak tokens.
   */
  async registerVendor(payload: VendorRegistrationPayload): Promise<AuthResponse> {
    await this.ensureKcAdmin();
    if (!payload.firebaseIdToken) {
      throw new Error('Firebase ID token is required to register a vendor');
    }
    const claims = await verifyPhoneIdToken(payload.firebaseIdToken);
    const phone = claims.phoneNumber; // E.164

    const ownerName = (payload.ownerName || '').trim();
    const businessName = (payload.businessName || '').trim();
    if (!ownerName) throw new Error('Owner name is required');
    if (!businessName) throw new Error('Business name is required');

    const vendorKind = payload.vendorKind === 'service' ? 'service' : 'product';
    const vendorType = payload.vendorType === 'SERVICE' ? 'SERVICE' : 'PRODUCT';

    // Race-protection: if a vendor with this phone already exists and is
    // linked to a Keycloak user, we treat this as "already registered" and
    // return a friendlier error so the FE can route them to login instead
    // of stacking duplicate Keycloak users.
    const existingVendor = await this.catalogVendorRepo.findByPhone(phone);
    if (existingVendor && existingVendor.keycloakUserId) {
      throw new Error(
        'A vendor account already exists for this phone. Please sign in instead.',
      );
    }

    const email = (payload.email || '').trim() || null;
    if (email) {
      const byEmail = await this.keycloakAdmin.users.find({ email, exact: true });
      if (byEmail && byEmail.length > 0) {
        throw new Error(
          'An account with this email already exists. Sign in with your existing credentials.',
        );
      }
    }

    // Username for Keycloak: phone digits — unique and stable across users.
    const keycloakUsername = phone.replace(/\D/g, '');

    const created = await this.keycloakAdmin.users.create({
      username: keycloakUsername,
      email: email ?? undefined,
      firstName: ownerName.split(/\s+/)[0],
      lastName: ownerName.split(/\s+/).slice(1).join(' ') || undefined,
      enabled: true,
      emailVerified: false,
      attributes: {
        phone: [phone],
        firebase_uid: [claims.uid],
        vendor_type: [vendorType],
      },
      credentials: [
        {
          type: 'password',
          value: crypto.randomBytes(32).toString('hex'),
          temporary: false,
        },
      ],
    });
    if (!created.id) throw new Error('Failed to create Keycloak vendor user');
    const keycloakUserId = created.id;

    try {
      const role = await this.keycloakAdmin.roles.findOneByName({ name: 'VENDOR' });
      if (!role || !role.id) {
        throw new Error('Role VENDOR not found in Keycloak');
      }
      await this.keycloakAdmin.users.addRealmRoleMappings({
        id: keycloakUserId,
        roles: [{ id: role.id, name: role.name! }],
      });

      const userRow = new User();
      userRow.username = keycloakUsername;
      userRow.email = email || `${keycloakUsername}@phone.local`;
      userRow.keycloakId = keycloakUserId;
      userRow.userType = 'VENDOR';
      await this.userRepo.save(userRow);

      // Catalog row — single source of truth admin reviews from the
      // "Pending Approval" tab.
      const vendor = existingVendor ?? new CatalogVendor();
      vendor.businessName = businessName;
      vendor.ownerName = ownerName;
      vendor.email = email;
      vendor.phone = phone;
      vendor.gst = nullableTrim(payload.gst);
      vendor.pan = nullableTrim(payload.pan);
      vendor.categoriesJson = payload.categoriesJson ?? null;
      vendor.servicesJson = payload.servicesJson ?? null;
      vendor.addressJson = payload.addressJson ?? null;
      vendor.documentsJson = payload.documentsJson ?? null;
      vendor.bankJson = payload.bankJson ?? null;
      vendor.vendorKind = vendorKind;
      vendor.vendorType = vendorType;
      vendor.keycloakUserId = keycloakUserId;
      // First insert: starts pending so admin's existing approval flow
      // picks it up. Don't overwrite status on a re-attempt (existingVendor
      // path).
      if (!existingVendor) {
        vendor.status = 'pending';
        vendor.kycStatus = 'submitted';
      }
      await this.catalogVendorRepo.save(vendor);

      // Audit row — kept for ops traceability and the in-portal onboarding
      // GET /vendor/me/onboarding endpoint.
      const auditRow = new VendorRegistrationRequest();
      auditRow.requestType = 'phone-signup';
      auditRow.status = 'pending';
      auditRow.payload = {
        source: 'phone-otp-vendor-web',
        keycloakUserId,
        firebaseUid: claims.uid,
        ownerName,
        businessName,
        email,
        phone,
        vendorKind,
        vendorType,
        gst: vendor.gst,
        pan: vendor.pan,
        categoriesJson: payload.categoriesJson ?? null,
        servicesJson: payload.servicesJson ?? null,
        addressJson: payload.addressJson ?? null,
        documentsJson: payload.documentsJson ?? null,
        bankJson: payload.bankJson ?? null,
      };
      await this.vendorRequestRepo.save(auditRow);
    } catch (err) {
      try {
        await this.keycloakAdmin.users.del({ id: keycloakUserId });
      } catch {
        // best-effort rollback
      }
      throw err;
    }

    await new Promise((r) => setTimeout(r, 500));
    return this.loginAsKeycloakUser(keycloakUserId);
  }

  // ──────────────────── helpers ────────────────────

  private signRegistrationToken(payload: {
    phone: string;
    firebaseUid: string;
    role: 'CUSTOMER' | 'VENDOR';
  }): string {
    const secret = this.registrationTokenSecret();
    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: REG_TOKEN_TTL_SECONDS,
      issuer: 'p4u-auth-service',
      audience: 'p4u-registration',
    });
  }

  private verifyRegistrationToken(token: string): {
    phone: string;
    firebaseUid: string;
    role: 'CUSTOMER' | 'VENDOR';
  } {
    if (!token) throw new Error('Registration token required');
    const secret = this.registrationTokenSecret();
    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'p4u-auth-service',
        audience: 'p4u-registration',
      }) as jwt.JwtPayload;
      const phone = String(decoded.phone || '');
      const firebaseUid = String(decoded.firebaseUid || '');
      const role = String(decoded.role || '') as 'CUSTOMER' | 'VENDOR';
      if (!phone || !firebaseUid || (role !== 'CUSTOMER' && role !== 'VENDOR')) {
        throw new Error('Registration token is malformed');
      }
      return { phone, firebaseUid, role };
    } catch (e: any) {
      throw new Error(`Registration token invalid or expired: ${e?.message || e}`);
    }
  }

  private registrationTokenSecret(): string {
    // We sign with INTROSPECT_API_KEY (already required to be a long random
    // value in production) to avoid introducing yet another env var. Falls
    // back to KEYCLOAK_CLIENT_SECRET for local dev convenience.
    const candidate =
      process.env.PHONE_REG_TOKEN_SECRET ||
      process.env.INTROSPECT_API_KEY ||
      process.env.KEYCLOAK_CLIENT_SECRET ||
      '';
    if (candidate.length < 16) {
      throw new Error(
        'Registration token secret is too short. Set PHONE_REG_TOKEN_SECRET (or INTROSPECT_API_KEY) to at least 16 chars.',
      );
    }
    return candidate;
  }

  /**
   * Mint Keycloak tokens for a user we've already authenticated by phone OTP,
   * without knowing or asking for their password.
   *
   * Strategy: rotate the user's password to a fresh random value via admin
   * API, then use it to do a normal direct-grant login, then return the
   * tokens. The rotated password is never exposed to the user; it gets
   * rotated again on their next OTP login. This sidesteps the need to enable
   * Keycloak's token-exchange feature (which requires extra realm + client
   * config that varies by deployment).
   *
   * Side-effect: any password the user might have set previously is
   * invalidated. That's intentional — these accounts are OTP-only.
   */
  private async loginAsKeycloakUser(keycloakUserId: string): Promise<AuthResponse> {
    await this.ensureKcAdmin();
    const user = await this.keycloakAdmin.users.findOne({ id: keycloakUserId });
    if (!user || !user.username) {
      throw new Error('Keycloak user not found while issuing tokens');
    }

    const oneTimePassword = crypto.randomBytes(32).toString('hex');
    await this.keycloakAdmin.users.resetPassword({
      id: keycloakUserId,
      credential: { type: 'password', value: oneTimePassword, temporary: false },
    });

    const tokenUrl = `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    // Request an OFFLINE refresh token so the phone-OTP session persists across
    // browser close (same rationale as authService.getToken). Requires the
    // Keycloak client to expose `offline_access` as a default/optional scope.
    params.append('scope', 'openid offline_access');
    params.append('username', user.username);
    params.append('password', oneTimePassword);

    try {
      const response: AxiosResponse<KeycloakTokenResponse> = await axios.post(
        tokenUrl,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const auth = this.toAuthResponse(response.data);
      const vendor = await this.catalogVendorRepo.findByKeycloakUserId(keycloakUserId);
      if (vendor?.id) auth.vendorId = vendor.id;
      return auth;
    } catch (err: any) {
      const status = err?.response?.status as number | undefined;
      const data = err?.response?.data as Record<string, unknown> | undefined;
      const desc =
        (typeof data?.error_description === 'string' && data.error_description) ||
        (typeof data?.error === 'string' && data.error) ||
        err?.message ||
        String(err);
      let hint = '';
      if (status === 401 || /401|invalid.?client|unauthorized/i.test(String(desc))) {
        hint =
          ` In Keycloak Admin → Clients → "${this.clientId}" → Settings: turn **Direct access grants** ON (required for phone-OTP token exchange). ` +
          `Also confirm KEYCLOAK_CLIENT_SECRET in auth-management-services/.env matches **Credentials** for that client.`;
      }
      throw new Error(`OTP login failed at the Keycloak password-grant step (${desc}).${hint}`);
    }
  }

  private toAuthResponse(token: KeycloakTokenResponse): AuthResponse {
    const claims = this.decodeAccessToken(token.access_token);
    const roles = (claims.realm_access?.roles || []).map((r) => String(r).toUpperCase());
    const permissions = this.resolvePermissions(claims, roles);
    return new AuthResponse(
      token.access_token,
      token.refresh_token,
      token.token_type,
      token.expires_in,
      token.refresh_expires_in,
      roles,
      permissions,
      claims.vendor_id ?? null,
      claims.customer_id ?? null,
    );
  }

  private decodeAccessToken(token: string): AccessTokenClaims {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return {};
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      return JSON.parse(decoded) as AccessTokenClaims;
    } catch {
      return {};
    }
  }

  private resolvePermissions(claims: AccessTokenClaims, roles: string[]): string[] {
    const derived = new Set<string>();
    if (Array.isArray(claims.permissions)) {
      for (const p of claims.permissions) derived.add(String(p));
    }
    for (const s of String(claims.scope || '')
      .split(' ')
      .map((x) => x.trim())
      .filter(Boolean)) {
      derived.add(s);
    }
    for (const role of roles) {
      for (const p of ROLE_PERMISSION_MAP[role] || []) derived.add(p);
    }
    return [...derived];
  }
}

function nullableTrim(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}
