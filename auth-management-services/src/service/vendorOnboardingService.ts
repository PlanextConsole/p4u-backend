import { VendorRegistrationRequest } from '../entity/VendorRegistrationRequest';
import { VendorRegistrationRequestRepository } from '../repository/vendorRegistrationRequestRepository';
import { UserRepository } from '../repository/userRepository';
import { CatalogVendorRepository } from '../repository/catalogVendorRepository';
import { CatalogVendor } from '../entity/CatalogVendor';

export interface VendorOnboardingPayload {
  vendorType?: string | null;
  vendorKind?: string | null;
  ownerName?: string | null;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  categoriesJson?: unknown;
  servicesJson?: unknown;
  gst?: string | null;
  pan?: string | null;
  addressJson?: Record<string, unknown> | null;
  documentsJson?: Record<string, unknown> | null;
  bankJson?: Record<string, unknown> | null;
  source?: string | null;
  [key: string]: unknown;
}

export interface VendorOnboardingTokenContext {
  /** Keycloak `sub` claim from the verified JWT. */
  keycloakUserId: string;
  /** Optional preferred username from token; used as a stable hint. */
  username?: string;
  /** Optional email from token. */
  email?: string;
}

export interface VendorOnboardingRecord {
  id: string;
  status: string;
  requestType: string;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
}

const ALLOWED_TYPES = new Set(['SERVICE', 'PRODUCT', 'BOTH']);

function normalizeVendorType(value: unknown): 'SERVICE' | 'PRODUCT' | 'BOTH' | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  return ALLOWED_TYPES.has(v) ? (v as 'SERVICE' | 'PRODUCT' | 'BOTH') : null;
}

/** Lowercase vendorKind from an uppercase vendorType. */
function kindFromType(vendorType: 'SERVICE' | 'PRODUCT' | 'BOTH'): 'service' | 'product' | 'both' {
  return vendorType === 'BOTH' ? 'both' : vendorType === 'SERVICE' ? 'service' : 'product';
}

/**
 * Onboarding flow for vendors who already have a login but no catalog vendor row.
 *
 * Persists their submitted profile in `vendor_signup_requests` (status=pending)
 * so admin can review/approve. Calling it again replaces the still-pending row
 * for the same Keycloak user, instead of stacking duplicates.
 */
export class VendorOnboardingService {
  private requestRepo: VendorRegistrationRequestRepository;
  private userRepo: UserRepository;
  private catalogVendorRepo: CatalogVendorRepository;

  constructor() {
    this.requestRepo = new VendorRegistrationRequestRepository();
    this.userRepo = new UserRepository();
    this.catalogVendorRepo = new CatalogVendorRepository();
  }

  async getMyOnboarding(
    ctx: VendorOnboardingTokenContext,
  ): Promise<VendorOnboardingRecord | null> {
    const row = await this.requestRepo.findLatestByKeycloakUserId(ctx.keycloakUserId);
    return row ? toRecord(row) : null;
  }

  async submitMyOnboarding(
    ctx: VendorOnboardingTokenContext,
    payload: VendorOnboardingPayload,
  ): Promise<VendorOnboardingRecord> {
    const vendorType = normalizeVendorType(payload.vendorType ?? payload.vendorKind);
    if (!vendorType) {
      throw new Error('vendorType is required (SERVICE, PRODUCT or BOTH)');
    }
    if (!payload.businessName || !String(payload.businessName).trim()) {
      throw new Error('businessName is required');
    }
    if (!payload.ownerName || !String(payload.ownerName).trim()) {
      throw new Error('ownerName is required');
    }

    const user = await this.userRepo.findByKeycloakId(ctx.keycloakUserId).catch(() => null);

    const existing = await this.requestRepo.findPendingByKeycloakUserId(ctx.keycloakUserId);
    const target = existing ?? new VendorRegistrationRequest();
    target.requestType = 'onboarding';
    target.status = 'pending';
    target.payload = {
      source: payload.source || 'p4u-new-vendor-web',
      keycloakUserId: ctx.keycloakUserId,
      username: ctx.username || user?.username || null,
      email: payload.email || ctx.email || user?.email || null,
      userType: 'VENDOR',
      vendorType,
      vendorKind: kindFromType(vendorType),
      ownerName: String(payload.ownerName).trim(),
      businessName: String(payload.businessName).trim(),
      phone: payload.phone ?? null,
      categoriesJson: payload.categoriesJson ?? null,
      servicesJson: payload.servicesJson ?? null,
      gst: payload.gst ?? null,
      pan: payload.pan ?? null,
      addressJson: payload.addressJson ?? null,
      documentsJson: payload.documentsJson ?? null,
      bankJson: payload.bankJson ?? null,
      vendorPayload: payload,
    };

    const saved = await this.requestRepo.save(target);

    // Mirror the submission into catalog_vendors (status=pending) so admin's
    // existing "Service vendors > Pending Approval" tab in admin-web picks it
    // up. This is the single source admin reviews / approves from. The
    // vendor_signup_requests row above continues to serve as an audit log.
    try {
      await this.upsertCatalogVendor(ctx, payload, vendorType, user?.email ?? null);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(
        '[auth-service] catalog_vendors mirror write failed for keycloakUserId=%s: %s',
        ctx.keycloakUserId,
        msg,
      );
      throw new Error(
        `Could not save vendor profile for admin review. Please try again or contact support. (${msg})`,
      );
    }

    return toRecord(saved);
  }

  /**
   * Create or update the corresponding catalog_vendors row for this Keycloak
   * user, leaving admin-only fields (commission %, vendor plan, status changes
   * after pending, etc.) untouched.
   */
  private async upsertCatalogVendor(
    ctx: VendorOnboardingTokenContext,
    payload: VendorOnboardingPayload,
    vendorType: 'SERVICE' | 'PRODUCT' | 'BOTH',
    fallbackEmail: string | null,
  ): Promise<void> {
    const existing = await this.catalogVendorRepo.findByKeycloakUserId(ctx.keycloakUserId);
    const target = existing ?? new CatalogVendor();
    target.keycloakUserId = ctx.keycloakUserId;
    target.businessName = String(payload.businessName ?? '').trim();
    target.ownerName = String(payload.ownerName ?? '').trim();
    target.email = stringOrNull(payload.email) ?? fallbackEmail ?? ctx.email ?? null;
    target.phone = stringOrNull(payload.phone);
    target.gst = stringOrNull(payload.gst);
    target.pan = stringOrNull(payload.pan);
    target.categoriesJson = payload.categoriesJson ?? null;
    target.servicesJson = payload.servicesJson ?? null;
    target.addressJson = payload.addressJson ?? null;
    target.documentsJson = payload.documentsJson ?? null;
    target.bankJson = payload.bankJson ?? null;
    target.vendorType = vendorType;
    target.vendorKind = kindFromType(vendorType);

    // Only overwrite status / kycStatus on the very first insert. Once admin
    // has touched the row we leave their decision alone — re-submitting the
    // onboarding form should never silently roll an approved vendor back to
    // pending.
    if (!existing) {
      target.status = 'pending';
      target.kycStatus = 'submitted';
    }

    await this.catalogVendorRepo.save(target);
  }
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function toRecord(row: VendorRegistrationRequest): VendorOnboardingRecord {
  return {
    id: row.id,
    status: row.status,
    requestType: row.requestType,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    payload: (row.payload as Record<string, unknown>) || {},
  };
}
