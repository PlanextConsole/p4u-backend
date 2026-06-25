import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Vendor, type VendorKind } from './entities/Vendor';
import { VendorRequest } from './entities/VendorRequest';
import { VendorEnquiry } from './entities/VendorEnquiry';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorEnquiryDto } from './dto/update-vendor-enquiry.dto';
import { ApproveVendorRequestDto } from './dto/approve-vendor-request.dto';
import { VendorReferralService } from './vendor.referral.service';
import { assertCreateVendorRules, assertUpdateVendorRules } from './vendor.validation';
import { CatalogAdminService } from '../catalog/catalog.service';

const PENDING_VENDOR_STATUSES = ['pending', 'not_verified'] as const;

export interface VendorPendingApplication {
  id: string;
  catalogVendorId: string | null;
  signupRequestId: string | null;
  source: 'catalog' | 'signup';
  businessName: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  vendorKind: VendorKind;
  vendorType: 'PRODUCT' | 'SERVICE';
  categoryLabel: string | null;
  businessType: string | null;
  gst: string | null;
  pan: string | null;
  status: string;
  createdAt: string;
}

function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function dedupeApplicationKey(
  keycloakUserId: string | null | undefined,
  phone: string | null | undefined,
  fallback: string,
): string {
  const kc = String(keycloakUserId ?? '').trim();
  if (kc) return `kc:${kc}`;
  const digits = normalizePhoneDigits(phone);
  if (digits) return `ph:${digits}`;
  return `id:${fallback}`;
}

function resolveSignupVendorKind(payload: Record<string, unknown>): VendorKind {
  const nested =
    payload.vendorPayload && typeof payload.vendorPayload === 'object'
      ? (payload.vendorPayload as Record<string, unknown>)
      : null;
  const raw = String(
    payload.vendorType ??
      payload.vendor_type ??
      nested?.vendorType ??
      payload.vendorKind ??
      payload.vendor_kind ??
      nested?.vendorKind ??
      payload.vendorCategory ??
      payload.vendor_category ??
      '',
  )
    .trim()
    .toUpperCase();
  if (raw === 'SERVICE' || raw.includes('SERVICE')) return 'service';
  if (raw === 'PRODUCT' || raw.includes('PRODUCT')) return 'product';
  const vk = String(payload.vendorKind ?? payload.vendor_kind ?? nested?.vendorKind ?? '')
    .trim()
    .toLowerCase();
  if (vk === 'service') return 'service';
  return 'product';
}

function vendorRowKind(v: Pick<Vendor, 'vendorKind' | 'vendorType'>): VendorKind {
  const kind = String(v.vendorKind || '').trim().toLowerCase();
  const type = String(v.vendorType || '').trim().toUpperCase();
  return kind === 'service' || type === 'SERVICE' ? 'service' : 'product';
}

function firstJsonLabel(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string') return first.trim() || null;
    if (first && typeof first === 'object') {
      const o = first as Record<string, unknown>;
      const label = o.name ?? o.slug ?? o.label;
      return label != null ? String(label).trim() || null : null;
    }
  }
  return null;
}

function categoryLabelFromPayload(
  payload: Record<string, unknown>,
  vendorKind: VendorKind,
): string | null {
  if (vendorKind === 'service') {
    return (
      firstJsonLabel(payload.servicesJson ?? payload.services) ??
      (payload.serviceName != null ? String(payload.serviceName).trim() || null : null)
    );
  }
  return (
    firstJsonLabel(payload.categoriesJson ?? payload.categories) ??
    (payload.categorySlug != null ? String(payload.categorySlug).trim() || null : null) ??
    (payload.vendorCategory != null ? String(payload.vendorCategory).trim() || null : null)
  );
}

function mapVendorToPendingApplication(v: Vendor): VendorPendingApplication {
  const kind = vendorRowKind(v);
  return {
    id: v.id,
    catalogVendorId: v.id,
    signupRequestId: null,
    source: 'catalog',
    businessName: v.businessName,
    ownerName: v.ownerName,
    email: v.email,
    phone: v.phone,
    vendorKind: kind,
    vendorType: kind === 'service' ? 'SERVICE' : 'PRODUCT',
    categoryLabel:
      kind === 'service'
        ? firstJsonLabel(v.servicesJson)
        : firstJsonLabel(v.categoriesJson),
    businessType: null,
    gst: v.gst,
    pan: v.pan,
    status: v.status,
    createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
  };
}

function mapSignupToPendingApplication(
  row: VendorRequest,
  vendorKind: VendorKind,
): VendorPendingApplication {
  const payload = (row.payload || {}) as Record<string, unknown>;
  const nested =
    payload.vendorPayload && typeof payload.vendorPayload === 'object'
      ? (payload.vendorPayload as Record<string, unknown>)
      : null;
  return {
    id: `signup-${row.id}`,
    catalogVendorId: null,
    signupRequestId: row.id,
    source: 'signup',
    businessName: String(payload.businessName ?? nested?.businessName ?? '—').trim() || '—',
    ownerName: String(payload.ownerName ?? nested?.ownerName ?? '—').trim() || '—',
    email: payload.email != null ? String(payload.email).trim() || null : null,
    phone: payload.phone != null ? String(payload.phone).trim() || null : null,
    vendorKind,
    vendorType: vendorKind === 'service' ? 'SERVICE' : 'PRODUCT',
    categoryLabel: categoryLabelFromPayload(payload, vendorKind),
    businessType:
      payload.businessType != null
        ? String(payload.businessType).trim() || null
        : nested?.businessType != null
          ? String(nested.businessType).trim() || null
          : null,
    gst: payload.gst != null ? String(payload.gst).trim() || null : null,
    pan: payload.pan != null ? String(payload.pan).trim() || null : null,
    status: 'pending',
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export class VendorAdminService {
  private audit = new AuditService();
  private vendorReferral = new VendorReferralService();
  private catalog = new CatalogAdminService();

  async listVendors(
    limit: number,
    offset: number,
    opts?: { status?: string; vendorKind?: VendorKind }
  ): Promise<{ items: Vendor[]; total: number }> {
    const repo = AppDataSource.getRepository(Vendor);
    const qb = repo.createQueryBuilder('vendor').orderBy('vendor.createdAt', 'DESC').take(limit).skip(offset);
    if (opts?.status) {
      qb.andWhere('vendor.status = :status', { status: opts.status });
    }
    if (opts?.vendorKind === 'service') {
      qb.andWhere(
        `(LOWER(TRIM(COALESCE(vendor.vendorKind, ''))) = :serviceKind OR UPPER(TRIM(COALESCE(vendor.vendorType, ''))) = :serviceType)`,
        { serviceKind: 'service', serviceType: 'SERVICE' },
      );
    } else if (opts?.vendorKind === 'product') {
      // Product list includes legacy rows with empty kind/type (defaults to product).
      qb.andWhere(
        `NOT (
          LOWER(TRIM(COALESCE(vendor.vendorKind, ''))) = :serviceKind
          OR UPPER(TRIM(COALESCE(vendor.vendorType, ''))) = :serviceType
        )`,
        { serviceKind: 'service', serviceType: 'SERVICE' },
      );
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  private async findVendorByPhoneDigits(phone: string | null | undefined): Promise<Vendor | null> {
    const digits = normalizePhoneDigits(phone);
    if (!digits) return null;
    const repo = AppDataSource.getRepository(Vendor);
    return repo
      .createQueryBuilder('vendor')
      .where(`RIGHT(REGEXP_REPLACE(COALESCE(vendor.phone, ''), '[^0-9]', ''), 10) = :digits`, {
        digits,
      })
      .getOne();
  }

  private async findVendorByEmail(email: string | null | undefined): Promise<Vendor | null> {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized) return null;
    return AppDataSource.getRepository(Vendor)
      .createQueryBuilder('vendor')
      .where('LOWER(TRIM(COALESCE(vendor.email, ""))) = :email', { email: normalized })
      .getOne();
  }

  private async assertUniqueVendorContact(
    phone: string | null | undefined,
    email: string | null | undefined,
    excludeVendorId?: string,
  ): Promise<void> {
    const byPhone = await this.findVendorByPhoneDigits(phone);
    if (byPhone && byPhone.id !== excludeVendorId) {
      throw new Error('A vendor with this mobile number already exists');
    }
    const byEmail = await this.findVendorByEmail(email);
    if (byEmail && byEmail.id !== excludeVendorId) {
      throw new Error('A vendor with this email already exists');
    }
  }

  private vendorRefFromRow(row: Vendor): string | null {
    const docs = row.documentsJson && typeof row.documentsJson === 'object' ? row.documentsJson : {};
    const ref = (docs as Record<string, unknown>).vendorRef;
    return ref != null && String(ref).trim() ? String(ref).trim() : null;
  }

  private async generateVendorRef(): Promise<string> {
    const repo = AppDataSource.getRepository(Vendor);
    const baseCount = await repo.count();
    for (let i = 0; i < 25; i++) {
      const candidate = `VEND${String(baseCount + 1 + i).padStart(7, '0')}`;
      const clash = await repo
        .createQueryBuilder('vendor')
        .where(`JSON_UNQUOTE(JSON_EXTRACT(vendor.documents_json, '$.vendorRef')) = :ref`, { ref: candidate })
        .getCount();
      if (!clash) return candidate;
    }
    throw new Error('Could not generate vendor ID');
  }

  /**
   * Unified pending queue for admin approval: catalog rows awaiting review plus
   * signup requests that never received a catalog mirror row.
   */
  async listPendingApplications(vendorKind?: VendorKind): Promise<{ items: VendorPendingApplication[] }> {
    const vendorRepo = AppDataSource.getRepository(Vendor);
    const reqRepo = AppDataSource.getRepository(VendorRequest);

    const catalogQb = vendorRepo
      .createQueryBuilder('vendor')
      .where('vendor.status IN (:...statuses)', { statuses: [...PENDING_VENDOR_STATUSES] })
      .orderBy('vendor.createdAt', 'DESC');
    if (vendorKind === 'service') {
      catalogQb.andWhere(
        `(LOWER(TRIM(COALESCE(vendor.vendorKind, ''))) = :serviceKind OR UPPER(TRIM(COALESCE(vendor.vendorType, ''))) = :serviceType)`,
        { serviceKind: 'service', serviceType: 'SERVICE' },
      );
    } else if (vendorKind === 'product') {
      catalogQb.andWhere(
        `NOT (
          LOWER(TRIM(COALESCE(vendor.vendorKind, ''))) = :serviceKind
          OR UPPER(TRIM(COALESCE(vendor.vendorType, ''))) = :serviceType
        )`,
        { serviceKind: 'service', serviceType: 'SERVICE' },
      );
    }
    const catalogRows = await catalogQb.getMany();

    const items: VendorPendingApplication[] = [];
    const seen = new Set<string>();

    for (const v of catalogRows) {
      seen.add(dedupeApplicationKey(v.keycloakUserId, v.phone, v.id));
      items.push(mapVendorToPendingApplication(v));
    }

    const signups = await reqRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' },
      take: 500,
    });

    for (const row of signups) {
      const payload = (row.payload || {}) as Record<string, unknown>;
      const rowKind = resolveSignupVendorKind(payload);
      if (vendorKind && rowKind !== vendorKind) continue;

      const kc = String(payload.keycloakUserId ?? payload.keycloak_user_id ?? '').trim();
      const phoneRaw = String(payload.phone ?? '').trim();
      const key = dedupeApplicationKey(kc || null, phoneRaw || null, row.id);
      if (seen.has(key)) continue;

      let linked: Vendor | null = null;
      if (kc) {
        linked = await vendorRepo.findOne({ where: { keycloakUserId: kc } });
      }
      if (!linked && phoneRaw) {
        linked = await this.findVendorByPhoneDigits(phoneRaw);
      }

      if (linked) {
        if (vendorKind && vendorRowKind(linked) !== vendorKind) continue;
        if (PENDING_VENDOR_STATUSES.includes(linked.status as (typeof PENDING_VENDOR_STATUSES)[number])) {
          continue;
        }
        if (linked.status === 'active') continue;
        continue;
      }

      items.push(mapSignupToPendingApplication(row, rowKind));
      seen.add(key);
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { items };
  }

  /**
   * Pending vendor_signup_requests with no matching catalog_vendors row yet
   * (registration succeeded in auth but catalog mirror failed, or legacy flow).
   */
  async listPendingSignupsWithoutCatalog(vendorKind?: VendorKind): Promise<VendorRequest[]> {
    const reqRepo = AppDataSource.getRepository(VendorRequest);
    const rows = await reqRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const out: VendorRequest[] = [];
    for (const row of rows) {
      const payload = (row.payload || {}) as Record<string, unknown>;
      const rowKind = resolveSignupVendorKind(payload);
      if (vendorKind && rowKind !== vendorKind) continue;

      const kc = String(payload.keycloakUserId ?? payload.keycloak_user_id ?? '').trim();
      const phone = String(payload.phone ?? '').trim();
      let linked = false;
      if (kc) {
        linked = !!(await AppDataSource.getRepository(Vendor).findOne({ where: { keycloakUserId: kc } }));
      }
      if (!linked && phone) {
        linked = !!(await this.findVendorByPhoneDigits(phone));
      }
      if (!linked) out.push(row);
    }
    return out;
  }

  async getVendor(id: string): Promise<Vendor | null> {
    return AppDataSource.getRepository(Vendor).findOne({ where: { id } });
  }

  async createVendor(
    dto: CreateVendorDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<Vendor> {
    assertCreateVendorRules(dto);
    await this.assertUniqueVendorContact(dto.phone, dto.email);
    const vendorRef = await this.generateVendorRef();
    const documentsJson = {
      ...(dto.documentsJson && typeof dto.documentsJson === 'object' ? dto.documentsJson : {}),
      vendorRef,
    };
    const repo = AppDataSource.getRepository(Vendor);
    const row = repo.create({
      businessName: String(dto.businessName).trim(),
      ownerName: String(dto.ownerName).trim(),
      age: dto.age ?? null,
      gender: dto.gender ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      gst: dto.gst ?? null,
      pan: dto.pan ?? null,
      phone: String(dto.phone).trim(),
      secondaryPhone: dto.secondaryPhone ?? null,
      email: String(dto.email).trim(),
      membershipStatus: dto.membershipStatus ?? null,
      status: dto.status ?? 'not_verified',
      experience: dto.experience ?? null,
      trending: dto.trending ?? false,
      appliedReferralCode: dto.appliedReferralCode ?? null,
      aboutBusiness: dto.aboutBusiness ?? null,
      kycStatus: dto.kycStatus ?? 'not_started',
      categoriesJson: dto.categoriesJson ?? null,
      servicesJson: dto.servicesJson ?? null,
      addressJson: dto.addressJson ?? null,
      commissionRate: dto.commissionRate ?? null,
      maxRedemptionPercent: dto.maxRedemptionPercent ?? null,
      vendorPlanId: dto.vendorPlanId ?? null,
      enrollmentCost: dto.enrollmentCost ?? null,
      coverageRadiusKm: dto.coverageRadiusKm ?? null,
      restriction: dto.restriction ?? null,
      selfDelivery: dto.selfDelivery ?? false,
      documentsJson,
      bankJson: dto.bankJson ?? null,
      notes: dto.notes ?? null,
      keycloakUserId: dto.keycloakUserId ?? null,
      vendorKind: dto.vendorKind,
      vendorType: dto.vendorKind === 'service' ? 'SERVICE' : 'PRODUCT',
    });
    await repo.save(row);
    await this.vendorReferral.ensureReferralCode(row);
    await this.vendorReferral.applyVendorReferralReward(row);
    if (row.servicesJson) {
      await this.catalog.syncVendorOfferingsFromServicesJson(row.id, row.servicesJson);
    }
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'Vendor',
      entityId: row.id,
      metadata: { businessName: row.businessName },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateVendor(
    id: string,
    dto: UpdateVendorDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<Vendor> {
    const repo = AppDataSource.getRepository(Vendor);
    const row = await repo.findOne({ where: { id } });
    if (!row) {
      throw new Error('Vendor not found');
    }
    assertUpdateVendorRules(dto, { vendorKind: vendorRowKind(row) });
    const nextPhone = dto.phone !== undefined ? dto.phone : row.phone;
    const nextEmail = dto.email !== undefined ? dto.email : row.email;
    await this.assertUniqueVendorContact(nextPhone, nextEmail, row.id);
    if (dto.businessName !== undefined) row.businessName = String(dto.businessName).trim();
    if (dto.ownerName !== undefined) row.ownerName = String(dto.ownerName).trim();
    if (dto.age !== undefined) row.age = dto.age;
    if (dto.gender !== undefined) row.gender = dto.gender;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = dto.thumbnailUrl;
    if (dto.bannerUrl !== undefined) row.bannerUrl = dto.bannerUrl;
    if (dto.gst !== undefined) row.gst = dto.gst;
    if (dto.pan !== undefined) row.pan = dto.pan;
    if (dto.phone !== undefined) row.phone = String(dto.phone).trim();
    if (dto.secondaryPhone !== undefined) row.secondaryPhone = dto.secondaryPhone;
    if (dto.email !== undefined) row.email = String(dto.email).trim();
    if (dto.membershipStatus !== undefined) row.membershipStatus = dto.membershipStatus;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.experience !== undefined) row.experience = dto.experience;
    if (dto.trending !== undefined) row.trending = dto.trending;
    if (dto.appliedReferralCode !== undefined) row.appliedReferralCode = dto.appliedReferralCode;
    if (dto.aboutBusiness !== undefined) row.aboutBusiness = dto.aboutBusiness;
    if (dto.kycStatus !== undefined) row.kycStatus = dto.kycStatus;
    if (dto.categoriesJson !== undefined) row.categoriesJson = dto.categoriesJson;
    if (dto.servicesJson !== undefined) row.servicesJson = dto.servicesJson;
    if (dto.addressJson !== undefined) row.addressJson = dto.addressJson;
    if (dto.commissionRate !== undefined) row.commissionRate = dto.commissionRate;
    if (dto.maxRedemptionPercent !== undefined) row.maxRedemptionPercent = dto.maxRedemptionPercent;
    if (dto.vendorPlanId !== undefined) row.vendorPlanId = dto.vendorPlanId;
    if (dto.enrollmentCost !== undefined) row.enrollmentCost = dto.enrollmentCost;
    if (dto.coverageRadiusKm !== undefined) row.coverageRadiusKm = dto.coverageRadiusKm;
    if (dto.restriction !== undefined) row.restriction = dto.restriction;
    if (dto.selfDelivery !== undefined) row.selfDelivery = dto.selfDelivery;
    if (dto.documentsJson !== undefined) row.documentsJson = dto.documentsJson;
    if (dto.bankJson !== undefined) row.bankJson = dto.bankJson;
    if (dto.notes !== undefined) row.notes = dto.notes;
    if (dto.keycloakUserId !== undefined) row.keycloakUserId = dto.keycloakUserId;
    if (dto.vendorKind !== undefined) {
      row.vendorKind = dto.vendorKind;
      row.vendorType = dto.vendorKind === 'service' ? 'SERVICE' : 'PRODUCT';
    }
    await repo.save(row);
    if (dto.servicesJson !== undefined) {
      await this.catalog.syncVendorOfferingsFromServicesJson(row.id, row.servicesJson);
    }
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'Vendor',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteVendor(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Vendor);
    const row = await repo.findOne({ where: { id } });
    if (!row) {
      throw new Error('Vendor not found');
    }
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'Vendor',
      entityId: id,
      metadata: { businessName: row.businessName },
      ipAddress: ip ?? null,
    });
  }

  async listVendorRequests(limit: number, offset: number): Promise<{ items: VendorRequest[]; total: number }> {
    const repo = AppDataSource.getRepository(VendorRequest);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async deleteVendorRequest(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(VendorRequest);
    const row = await repo.findOne({ where: { id } });
    if (!row) {
      throw new Error('Vendor request not found');
    }
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'VendorRequest',
      entityId: id,
      ipAddress: ip ?? null,
    });
  }

  async approveVendorRequest(
    id: string,
    dto: ApproveVendorRequestDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<{ vendor: Vendor; request: VendorRequest }> {
    const result = await AppDataSource.transaction(async (tx) => {
      const reqRepo = tx.getRepository(VendorRequest);
      const vendorRepo = tx.getRepository(Vendor);

      const request = await reqRepo.findOne({ where: { id } });
      if (!request) throw new Error('Vendor request not found');
      if (request.status !== 'pending') {
        throw new Error(`Vendor request already ${request.status}`);
      }

      const payload = (request.payload || {}) as Record<string, unknown>;
      const keycloakRaw = payload.keycloakUserId ?? payload.keycloak_user_id;
      const kcId = keycloakRaw != null && String(keycloakRaw).trim() !== '' ? String(keycloakRaw).trim() : null;
      if (kcId) {
        const existing = await vendorRepo.findOne({ where: { keycloakUserId: kcId } });
        if (existing) {
          existing.status = 'active';
          existing.kycStatus = existing.kycStatus || 'submitted';
          await vendorRepo.save(existing);
          request.status = 'approved';
          await reqRepo.save(request);
          await this.audit.log({
            actorSub,
            action: 'APPROVE',
            entityType: 'VendorRequest',
            entityId: request.id,
            metadata: { vendorId: existing.id, linkedExisting: true },
            ipAddress: ip ?? null,
          });
          return { vendor: existing, request, isNew: false };
        }
      }
      const businessName = String(dto.businessName || payload.businessName || '').trim();
      const ownerName = String(dto.ownerName || payload.ownerName || '').trim();
      if (!businessName || !ownerName) {
        throw new Error('Request payload missing businessName/ownerName; provide them in request body');
      }

      const emailRaw = dto.email ?? payload.email;
      const phoneRaw = dto.phone ?? payload.phone;
      const keycloakForCreate = dto.keycloakUserId ?? payload.keycloakUserId ?? payload.keycloak_user_id;

      const vt = String(payload.vendorType ?? payload.vendor_type ?? '').trim().toUpperCase();
      const kindRaw =
        vt === 'SERVICE'
          ? 'service'
          : vt === 'PRODUCT'
            ? 'product'
            : String(payload.vendorKind ?? payload.vendor_kind ?? 'product').toLowerCase();
      const approvedKind = kindRaw === 'service' ? 'service' : 'product';

      const vendor = vendorRepo.create({
        businessName,
        ownerName,
        email: emailRaw != null && String(emailRaw).trim() !== '' ? String(emailRaw).trim() : null,
        phone: phoneRaw != null && String(phoneRaw).trim() !== '' ? String(phoneRaw).trim() : null,
        status: 'active',
        kycStatus: 'not_started',
        categoriesJson: payload.categoriesJson ?? payload.categories ?? null,
        addressJson: (payload.addressJson as Record<string, unknown> | null) ?? (payload.address as Record<string, unknown> | null) ?? null,
        notes: dto.notes != null ? String(dto.notes) : null,
        keycloakUserId: keycloakForCreate != null && String(keycloakForCreate).trim() !== '' ? String(keycloakForCreate).trim() : null,
        vendorKind: approvedKind,
        vendorType: approvedKind === 'service' ? 'SERVICE' : 'PRODUCT',
      });
      await vendorRepo.save(vendor);
      const appliedCode = String(payload.appliedReferralCode ?? payload.applied_referral_code ?? '').trim();
      if (appliedCode) {
        vendor.appliedReferralCode = appliedCode;
        await vendorRepo.save(vendor);
      }

      request.status = 'approved';
      await reqRepo.save(request);

      await this.audit.log({
        actorSub,
        action: 'APPROVE',
        entityType: 'VendorRequest',
        entityId: request.id,
        metadata: { vendorId: vendor.id },
        ipAddress: ip ?? null,
      });

      return { vendor, request, isNew: true };
    });

    // Referral side-effects run AFTER the transaction commits. Running them
    // inside the transaction made them update the just-inserted vendor row over
    // a second pooled connection, which blocked on the open transaction's row
    // lock and hung the approve request until the DB lock-wait timeout.
    if (result.isNew) {
      try {
        await this.vendorReferral.ensureReferralCode(result.vendor);
        await this.vendorReferral.applyVendorReferralReward(result.vendor);
      } catch (e) {
        console.error('Vendor referral post-approve step failed (approval still succeeded):', e);
      }
    }

    return { vendor: result.vendor, request: result.request };
  }

  /**
   * Reject a pending vendor signup request. Unlike delete, this preserves the
   * row with status='rejected' so the vendor login flow can show a clear
   * "your request was rejected" message and block re-registration. If a catalog
   * vendor row is already linked, it is marked rejected too.
   */
  async rejectVendorRequest(
    id: string,
    dto: ApproveVendorRequestDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<{ request: VendorRequest }> {
    return AppDataSource.transaction(async (tx) => {
      const reqRepo = tx.getRepository(VendorRequest);
      const vendorRepo = tx.getRepository(Vendor);

      const request = await reqRepo.findOne({ where: { id } });
      if (!request) throw new Error('Vendor request not found');
      if (request.status !== 'pending') {
        throw new Error(`Vendor request already ${request.status}`);
      }

      const payload = (request.payload || {}) as Record<string, unknown>;
      request.status = 'rejected';
      if (dto.notes != null && String(dto.notes).trim()) {
        request.payload = { ...payload, rejectionReason: String(dto.notes).trim() };
      }
      await reqRepo.save(request);

      // Mark any linked catalog row rejected so the login pre-check agrees.
      const kc = String(payload.keycloakUserId ?? payload.keycloak_user_id ?? '').trim();
      const phone = String(payload.phone ?? '').trim();
      let linked: Vendor | null = null;
      if (kc) linked = await vendorRepo.findOne({ where: { keycloakUserId: kc } });
      if (!linked && phone) linked = await this.findVendorByPhoneDigits(phone);
      if (linked) {
        linked.status = 'rejected';
        await vendorRepo.save(linked);
      }

      await this.audit.log({
        actorSub,
        action: 'REJECT',
        entityType: 'VendorRequest',
        entityId: request.id,
        metadata: { linkedVendorId: linked?.id ?? null },
        ipAddress: ip ?? null,
      });

      return { request };
    });
  }

  async listVendorEnquiries(
    limit: number,
    offset: number
  ): Promise<{ items: VendorEnquiry[]; total: number }> {
    const repo = AppDataSource.getRepository(VendorEnquiry);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async getVendorEnquiry(id: string): Promise<VendorEnquiry | null> {
    return AppDataSource.getRepository(VendorEnquiry).findOne({ where: { id } });
  }

  async updateVendorEnquiry(
    id: string,
    dto: UpdateVendorEnquiryDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<VendorEnquiry> {
    const repo = AppDataSource.getRepository(VendorEnquiry);
    const row = await repo.findOne({ where: { id } });
    if (!row) {
      throw new Error('Vendor enquiry not found');
    }
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.contactName !== undefined) row.contactName = dto.contactName;
    if (dto.phone !== undefined) row.phone = dto.phone;
    if (dto.email !== undefined) row.email = dto.email;
    if (dto.message !== undefined) row.message = dto.message;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.workflowStage !== undefined) row.workflowStage = dto.workflowStage;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'VendorEnquiry',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }
}
