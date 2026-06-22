import { AppDataSource } from '../config/database';
import { Vendor } from '../entities/Vendor';
import { Order } from '../entities/Order';
import { OrganizationOrder } from '../entities/OrganizationOrder';
import { VendorReview } from '../entities/VendorReview';
import { VendorPlan } from '../entities/VendorPlan';
import { Product } from '../entities/Product';
import { ProductCategory } from '../entities/ProductCategory';
import { Settlement } from '../entities/Settlement';
import { PatchVendorProfileDto } from '../dto/patch-vendor-profile.dto';
import { PatchVendorOrderDto } from '../dto/patch-order.dto';
import { CreateVendorOrganizationOrderDto } from '../dto/create-organization-order.dto';
import { UpdateVendorOrganizationOrderDto } from '../dto/update-organization-order.dto';

export class VendorPortalService {
  async resolveVendorId(auth: any): Promise<string | null> {
    const sub = auth?.sub ? String(auth.sub) : '';
    if (sub) {
      const repo = AppDataSource.getRepository(Vendor);
      const v = await repo.findOne({ where: { keycloakUserId: sub } });
      if (v?.id) return v.id;
    }
    const claim = auth?.vendor_id;
    return claim ? String(claim) : null;
  }

  async getVendorById(vendorId: string): Promise<Vendor | null> {
    return AppDataSource.getRepository(Vendor).findOne({ where: { id: vendorId } });
  }

  async patchVendorProfile(vendorId: string, dto: PatchVendorProfileDto): Promise<Vendor> {
    const repo = AppDataSource.getRepository(Vendor);
    const row = await repo.findOne({ where: { id: vendorId } });
    if (!row) throw new Error('Vendor not found');
    if (dto.businessName !== undefined) row.businessName = dto.businessName;
    if (dto.ownerName !== undefined) row.ownerName = dto.ownerName;
    if (dto.age !== undefined) row.age = dto.age;
    if (dto.gender !== undefined) row.gender = dto.gender;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = dto.thumbnailUrl;
    if (dto.bannerUrl !== undefined) row.bannerUrl = dto.bannerUrl;
    if (dto.gst !== undefined) row.gst = dto.gst;
    if (dto.pan !== undefined) row.pan = dto.pan;
    if (dto.email !== undefined) row.email = dto.email;
    if (dto.phone !== undefined) row.phone = dto.phone;
    if (dto.secondaryPhone !== undefined) row.secondaryPhone = dto.secondaryPhone;
    if (dto.membershipStatus !== undefined) row.membershipStatus = dto.membershipStatus;
    if (dto.experience !== undefined) row.experience = dto.experience;
    if (dto.trending !== undefined) row.trending = dto.trending;
    if (dto.appliedReferralCode !== undefined) row.appliedReferralCode = dto.appliedReferralCode;
    if (dto.aboutBusiness !== undefined) row.aboutBusiness = dto.aboutBusiness;
    if (dto.addressJson !== undefined) row.addressJson = dto.addressJson;
    if (dto.categoriesJson !== undefined) row.categoriesJson = dto.categoriesJson;
    if (dto.servicesJson !== undefined) row.servicesJson = dto.servicesJson;
    if (dto.commissionRate !== undefined) row.commissionRate = dto.commissionRate;
    if (dto.documentsJson !== undefined) row.documentsJson = dto.documentsJson;
    if (dto.bankJson !== undefined) row.bankJson = dto.bankJson;
    if (dto.notes !== undefined) row.notes = dto.notes;
    return repo.save(row);
  }

  async listOrdersForVendor(vendorId: string, status: string | undefined, limit: number, offset: number) {
    const repo = AppDataSource.getRepository(Order);
    const where: Record<string, unknown> = { vendorId };
    if (status) where.status = status;
    const [items, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getOrderForVendor(orderId: string, vendorId: string): Promise<Order | null> {
    const row = await AppDataSource.getRepository(Order).findOne({ where: { id: orderId } });
    if (!row || row.vendorId !== vendorId) return null;
    return row;
  }

  async updateOrderForVendor(orderId: string, vendorId: string, dto: PatchVendorOrderDto): Promise<Order> {
    const repo = AppDataSource.getRepository(Order);
    const row = await this.getOrderForVendor(orderId, vendorId);
    if (!row) throw new Error('Order not found');
    if (dto.customerId !== undefined) row.customerId = dto.customerId;
    if (dto.orderRef !== undefined) row.orderRef = dto.orderRef;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.totalAmount !== undefined) row.totalAmount = dto.totalAmount;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    return repo.save(row);
  }

  async listOrganizationOrders(vendorId: string, limit: number, offset: number) {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const [items, total] = await repo.findAndCount({
      where: { vendorId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async createOrganizationOrder(vendorId: string, dto: CreateVendorOrganizationOrderDto): Promise<OrganizationOrder> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const row = repo.create({
      vendorId,
      customerId: dto.customerId ?? null,
      referralCode: dto.referralCode ?? null,
      status: dto.status ?? 'created',
      isClaimed: dto.isClaimed ?? false,
      totalAmount: dto.totalAmount ?? '0',
      metadata: dto.metadata ?? null,
    });
    return repo.save(row);
  }

  async updateOrganizationOrder(
    id: string,
    vendorId: string,
    dto: UpdateVendorOrganizationOrderDto
  ): Promise<OrganizationOrder> {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const row = await repo.findOne({ where: { id } });
    if (!row || row.vendorId !== vendorId) throw new Error('Organization order not found');
    if (dto.customerId !== undefined) row.customerId = dto.customerId;
    if (dto.referralCode !== undefined) row.referralCode = dto.referralCode;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.isClaimed !== undefined) row.isClaimed = dto.isClaimed;
    if (dto.totalAmount !== undefined) row.totalAmount = dto.totalAmount;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    return repo.save(row);
  }

  async listReviewsForOrder(vendorId: string, orderId: string): Promise<VendorReview[]> {
    const repo = AppDataSource.getRepository(VendorReview);
    return repo
      .createQueryBuilder('r')
      .where('r.vendorId = :vid', { vid: vendorId })
      .andWhere(
        "(JSON_UNQUOTE(JSON_EXTRACT(r.metadata, '$.orderId')) = :oid OR JSON_UNQUOTE(JSON_EXTRACT(r.metadata, '$.order_id')) = :oid)",
        { oid: orderId }
      )
      .orderBy('r.createdAt', 'DESC')
      .getMany();
  }

  async countReferralCodeUsage(code: string): Promise<number> {
    return AppDataSource.getRepository(OrganizationOrder).count({
      where: { referralCode: code },
    });
  }

  async listOrgOrdersByReferralForVendor(vendorId: string, code: string, limit: number, offset: number) {
    const repo = AppDataSource.getRepository(OrganizationOrder);
    const [items, total] = await repo.findAndCount({
      where: { vendorId, referralCode: code },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  /** Returns the linked plan + the effective per-vendor commission/redemption defaults. */
  async getVendorPlanInfo(vendorId: string): Promise<{
    vendor: Vendor;
    plan: VendorPlan | null;
    effective: { commissionPercent: string; maxRedemptionPercent: string };
  } | null> {
    const v = await this.getVendorById(vendorId);
    if (!v) return null;
    const plan = v.vendorPlanId
      ? await AppDataSource.getRepository(VendorPlan).findOne({ where: { id: v.vendorPlanId } })
      : null;
    const effective = {
      commissionPercent: v.commissionRate ?? plan?.commissionPercent ?? '0',
      maxRedemptionPercent: v.maxRedemptionPercent ?? plan?.maxUserRedemptionPercent ?? '0',
    };
    return { vendor: v, plan, effective };
  }

  async listSettlementsForVendor(vendorId: string, limit: number, offset: number) {
    const [items, total] = await AppDataSource.getRepository(Settlement).findAndCount({
      where: { vendorId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  /**
   * Sets a per-vendor override for a category in `category.metadata.vendorOverrides[vendorId]`.
   * Does NOT touch the global category column — that's admin-only. The pricing engine reads
   * vendorOverrides first when present, otherwise falls back to the global override.
   */
  async setCategoryOverride(vendorId: string, categoryId: string, percent: number | null): Promise<ProductCategory> {
    const repo = AppDataSource.getRepository(ProductCategory);
    const row = await repo.findOne({ where: { id: categoryId } });
    if (!row) throw new Error('Category not found');
    const meta = (row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}) as Record<string, unknown>;
    const overrides = (meta.vendorOverrides && typeof meta.vendorOverrides === 'object' ? { ...meta.vendorOverrides } : {}) as Record<string, unknown>;
    if (percent == null) delete overrides[vendorId];
    else overrides[vendorId] = String(percent);
    meta.vendorOverrides = overrides;
    row.metadata = meta;
    await repo.save(row);
    return row;
  }

  async setProductOverride(vendorId: string, productId: string, percent: number | null): Promise<Product> {
    const repo = AppDataSource.getRepository(Product);
    const row = await repo.findOne({ where: { id: productId } });
    if (!row) throw new Error('Product not found');
    if (row.vendorId !== vendorId) throw new Error('Product does not belong to vendor');
    row.commissionOverridePercent = percent == null ? null : String(percent);
    await repo.save(row);
    return row;
  }
}
