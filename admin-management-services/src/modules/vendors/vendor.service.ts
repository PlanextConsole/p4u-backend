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

export class VendorAdminService {
  private audit = new AuditService();
  private vendorReferral = new VendorReferralService();

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
    if (opts?.vendorKind) {
      if (opts.vendorKind === 'service') {
        qb.andWhere(
          '(LOWER(TRIM(COALESCE(vendor.vendorKind, :empty))) = :serviceKind OR UPPER(TRIM(COALESCE(vendor.vendorType, :emptyUpper))) = :serviceType)',
          { serviceKind: 'service', serviceType: 'SERVICE', empty: '', emptyUpper: '' }
        );
      } else {
        qb.andWhere(
          '(LOWER(TRIM(COALESCE(vendor.vendorKind, :empty))) = :productKind OR UPPER(TRIM(COALESCE(vendor.vendorType, :emptyUpper))) = :productType)',
          { productKind: 'product', productType: 'PRODUCT', empty: '', emptyUpper: '' }
        );
      }
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getVendor(id: string): Promise<Vendor | null> {
    return AppDataSource.getRepository(Vendor).findOne({ where: { id } });
  }

  async createVendor(
    dto: CreateVendorDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<Vendor> {
    const repo = AppDataSource.getRepository(Vendor);
    const row = repo.create({
      businessName: dto.businessName,
      ownerName: dto.ownerName,
      age: dto.age ?? null,
      gender: dto.gender ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      gst: dto.gst ?? null,
      pan: dto.pan ?? null,
      phone: dto.phone ?? null,
      secondaryPhone: dto.secondaryPhone ?? null,
      email: dto.email ?? null,
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
      documentsJson: dto.documentsJson ?? null,
      bankJson: dto.bankJson ?? null,
      notes: dto.notes ?? null,
      keycloakUserId: dto.keycloakUserId ?? null,
      vendorKind: dto.vendorKind,
      vendorType: dto.vendorKind === 'service' ? 'SERVICE' : 'PRODUCT',
    });
    await repo.save(row);
    await this.vendorReferral.ensureReferralCode(row);
    await this.vendorReferral.applyVendorReferralReward(row);
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
    if (dto.businessName !== undefined) row.businessName = dto.businessName;
    if (dto.ownerName !== undefined) row.ownerName = dto.ownerName;
    if (dto.age !== undefined) row.age = dto.age;
    if (dto.gender !== undefined) row.gender = dto.gender;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = dto.thumbnailUrl;
    if (dto.bannerUrl !== undefined) row.bannerUrl = dto.bannerUrl;
    if (dto.gst !== undefined) row.gst = dto.gst;
    if (dto.pan !== undefined) row.pan = dto.pan;
    if (dto.phone !== undefined) row.phone = dto.phone;
    if (dto.secondaryPhone !== undefined) row.secondaryPhone = dto.secondaryPhone;
    if (dto.email !== undefined) row.email = dto.email;
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
    return AppDataSource.transaction(async (tx) => {
      const reqRepo = tx.getRepository(VendorRequest);
      const vendorRepo = tx.getRepository(Vendor);

      const request = await reqRepo.findOne({ where: { id } });
      if (!request) throw new Error('Vendor request not found');
      if (request.status !== 'pending') {
        throw new Error(`Vendor request already ${request.status}`);
      }

      const payload = (request.payload || {}) as Record<string, unknown>;
      const businessName = String(dto.businessName || payload.businessName || '').trim();
      const ownerName = String(dto.ownerName || payload.ownerName || '').trim();
      if (!businessName || !ownerName) {
        throw new Error('Request payload missing businessName/ownerName; provide them in request body');
      }

      const emailRaw = dto.email ?? payload.email;
      const phoneRaw = dto.phone ?? payload.phone;
      const keycloakRaw = dto.keycloakUserId ?? payload.keycloakUserId ?? payload.keycloak_user_id;

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
        keycloakUserId: keycloakRaw != null && String(keycloakRaw).trim() !== '' ? String(keycloakRaw).trim() : null,
        vendorKind: approvedKind,
        vendorType: approvedKind === 'service' ? 'SERVICE' : 'PRODUCT',
      });
      await vendorRepo.save(vendor);
      await this.vendorReferral.ensureReferralCode(vendor);
      const appliedCode = String(payload.appliedReferralCode ?? payload.applied_referral_code ?? '').trim();
      if (appliedCode) {
        vendor.appliedReferralCode = appliedCode;
        await vendorRepo.save(vendor);
      }
      await this.vendorReferral.applyVendorReferralReward(vendor);

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

      return { vendor, request };
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
