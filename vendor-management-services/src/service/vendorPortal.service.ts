import axios from 'axios';
import * as crypto from 'crypto';
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
import { normalizeDocumentsJson, normalizeMediaUrl } from '../util/normalizeMediaUrl';
import { PatchVendorOrderDto } from '../dto/patch-order.dto';
import { CreateVendorOrganizationOrderDto } from '../dto/create-organization-order.dto';
import { UpdateVendorOrganizationOrderDto } from '../dto/update-organization-order.dto';
import { enrichOrderForVendorPortal, enrichOrdersForVendorPortal } from './vendorOrderEnrichment';
import { VendorNotificationEmitter } from './vendorNotificationEmitter';
import { jsonText } from '../util/jsonPathSql';

function metaRecord(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  return m as Record<string, unknown>;
}

function normalizeSettlementRow(row: Settlement): Settlement {
  const meta = metaRecord(row.metadata);
  const displayRef =
    (typeof meta.displayRef === 'string' && meta.displayRef.trim()) ||
    (typeof meta.settlementCode === 'string' && meta.settlementCode.trim()) ||
    `STL-${String(row.id).slice(0, 8).toUpperCase()}`;
  const orderRef =
    (typeof meta.orderRef === 'string' && meta.orderRef.trim()) ||
    (typeof meta.order_ref === 'string' && meta.order_ref.trim()) ||
    (row.orderId ? `ORD-${String(row.orderId).slice(0, 8).toUpperCase()}` : '');
  const gross = meta.gross ?? meta.grossAmount ?? meta.orderTotal;
  const commission = meta.commission ?? meta.commissionAmount ?? meta.platformFee;
  row.metadata = {
    ...meta,
    displayRef,
    settlementCode: displayRef,
    orderRef: orderRef || meta.orderRef,
    gross: gross ?? meta.gross,
    commission: commission ?? meta.commission,
  };
  return row;
}

export class VendorPortalService {
  private readonly notifier = new VendorNotificationEmitter();
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
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = normalizeMediaUrl(dto.thumbnailUrl);
    if (dto.bannerUrl !== undefined) row.bannerUrl = normalizeMediaUrl(dto.bannerUrl);
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
    if (dto.documentsJson !== undefined) row.documentsJson = normalizeDocumentsJson(dto.documentsJson);
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
    const enriched = await enrichOrdersForVendorPortal(items);
    return { items: enriched, total, limit, offset };
  }

  async getOrderForVendor(orderId: string, vendorId: string): Promise<Order | null> {
    const row = await AppDataSource.getRepository(Order).findOne({ where: { id: orderId } });
    if (!row || row.vendorId !== vendorId) return null;
    return enrichOrderForVendorPortal(row);
  }

  async updateOrderForVendor(orderId: string, vendorId: string, dto: PatchVendorOrderDto): Promise<Order> {
    const saved = await AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Order);
      const row = await repo.findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!row || row.vendorId !== vendorId) throw new Error('Order not found');
      const prevStatus = String(row.status || 'created').toLowerCase();
      const nextStatus = dto.status === undefined ? prevStatus : String(dto.status).toLowerCase();
      if (['completed', 'cancelled', 'refunded', 'returned'].includes(prevStatus) && nextStatus !== prevStatus) {
        throw new Error(`Order cannot be changed from terminal status ${prevStatus}`);
      }
      const allowedStatuses = new Set(['placed', 'created', 'pending', 'paid', 'accepted', 'in_progress', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled']);
      if (!allowedStatuses.has(nextStatus)) throw new Error(`Unsupported order status ${nextStatus}`);
      const previousMeta = metaRecord(row.metadata);
      const suppliedMeta = metaRecord(dto.metadata);
      const nextMeta: Record<string, unknown> = { ...previousMeta, ...suppliedMeta };
      if (nextStatus === 'shipped' && prevStatus !== 'shipped') {
        const shippingType = String(nextMeta.shipping_type ?? nextMeta.shippingType ?? '').trim().toLowerCase();
        if (!['own', 'courier'].includes(shippingType)) throw new Error('Shipping type must be own or courier');
        if (shippingType === 'courier') {
          if (!String(nextMeta.courier_name ?? nextMeta.courierName ?? '').trim()) throw new Error('Courier name is required');
          if (!String(nextMeta.tracking_number ?? nextMeta.trackingNumber ?? '').trim()) throw new Error('Tracking number is required');
        }
        nextMeta.shipping_type = shippingType;
        nextMeta.shippedAt = nextMeta.shippedAt ?? new Date().toISOString();
      }
      if (nextStatus === 'delivered' && prevStatus !== 'delivered') nextMeta.deliveredAt = nextMeta.deliveredAt ?? new Date().toISOString();
      if (nextStatus !== prevStatus) {
        const statusHistory = Array.isArray(nextMeta.productStatusHistory) ? [...nextMeta.productStatusHistory] : [];
        statusHistory.push({ status: nextStatus, at: new Date().toISOString(), actor: 'vendor' });
        nextMeta.productStatusHistory = statusHistory;
      }
      row.status = nextStatus;
      row.metadata = nextMeta;
      return repo.save(row);
    });
    if (dto.status !== undefined && dto.status !== saved.status) {
      // Normalisation only; notifications are emitted below for actual changes.
    }
    const meta = metaRecord(saved.metadata);
    const displayId = (typeof meta.displayId === 'string' && meta.displayId) || saved.orderRef || saved.id.slice(0, 8).toUpperCase();
    void this.notifier.notifyVendorById(vendorId, {
      type: 'order', title: `Order ${displayId} updated`, body: `Status is now ${saved.status}.`, deepLink: '/dashboard/product/orders',
    }).catch(() => undefined);
    return enrichOrderForVendorPortal(saved);
  }

  async updateReturnForVendor(orderId: string, vendorId: string, action: string, note?: string): Promise<Order> {
    const normalized = String(action || '').trim().toLowerCase();
    if (!['approve', 'reject', 'received'].includes(normalized)) throw new Error('Return action must be approve, reject, or received');
    const saved = await AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Order);
      const row = await repo.findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!row || row.vendorId !== vendorId) throw new Error('Order not found');
      const meta = metaRecord(row.metadata);
      const request = metaRecord(meta.returnRequest);
      if (!request.id) throw new Error('Return request not found');
      const current = String(request.status || 'requested');
      if (normalized === 'approve' && current === 'approved') return row;
      if (normalized === 'reject' && current === 'rejected') return row;
      if (normalized === 'received' && current === 'received') return row;
      if (normalized !== 'received' && current !== 'requested') throw new Error(`Return cannot be ${normalized}d from ${current}`);
      if (normalized === 'received' && current !== 'approved') throw new Error('Return must be approved before it can be received');
      const now = new Date().toISOString();
      request.status = normalized === 'approve' ? 'approved' : normalized === 'reject' ? 'rejected' : 'received';
      request.vendorNote = String(note || '').trim() || null;
      request.vendorUpdatedAt = now;
      const statusHistory = Array.isArray(meta.productStatusHistory) ? [...meta.productStatusHistory] : [];
      statusHistory.push({ status: `return_${request.status}`, at: now, actor: 'vendor', note: request.vendorNote });
      row.status = normalized === 'reject' ? 'delivered' : normalized === 'approve' ? 'return_approved' : 'returned';
      row.metadata = { ...meta, returnRequest: request, productStatusHistory: statusHistory };
      return repo.save(row);
    });
    return enrichOrderForVendorPortal(saved);
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
        `(${jsonText('r.metadata', 'orderId')} = :oid OR ${jsonText('r.metadata', 'order_id')} = :oid)`,
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

  // ─── Plan selection + Razorpay checkout ───

  private razorpayConfig(): { keyId: string; keySecret: string } {
    const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keyId || !keySecret) {
      throw new Error(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment.',
      );
    }
    return { keyId, keySecret };
  }

  /** All selectable plans for the Plans & Payments screen, cheapest tier first. */
  async listSelectablePlans(): Promise<VendorPlan[]> {
    return AppDataSource.getRepository(VendorPlan).find({
      order: { tier: 'ASC', price: 'ASC' },
    });
  }

  private async assignPlan(vendorId: string, planId: string, paid: boolean): Promise<Vendor> {
    const repo = AppDataSource.getRepository(Vendor);
    const row = await repo.findOne({ where: { id: vendorId } });
    if (!row) throw new Error('Vendor not found');
    row.vendorPlanId = planId;
    row.membershipStatus = paid ? 'paid' : 'active';
    return repo.save(row);
  }

  /**
   * Begin a plan purchase. Free plans (price <= 0) are assigned immediately.
   * Paid plans return a Razorpay order the browser opens in Checkout; the plan
   * id is stored in the order notes so it can't be swapped at verify time.
   */
  async createPlanOrder(
    vendorId: string,
    planId: string,
  ): Promise<
    | { free: true; plan: VendorPlan }
    | { free: false; keyId: string; orderId: string; amount: number; currency: string; plan: VendorPlan }
  > {
    const plan = await AppDataSource.getRepository(VendorPlan).findOne({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const price = Number(plan.price);
    if (!Number.isFinite(price) || price <= 0) {
      await this.assignPlan(vendorId, planId, false);
      return { free: true, plan };
    }

    const { keyId, keySecret } = this.razorpayConfig();
    const amount = Math.round(price * 100); // paise
    const receipt = `plan_${planId.slice(0, 8)}_${Date.now()}`.slice(0, 40);
    const resp = await axios.post(
      'https://api.razorpay.com/v1/orders',
      { amount, currency: 'INR', receipt, notes: { planId, vendorId } },
      { auth: { username: keyId, password: keySecret } },
    );
    const orderId = String(resp.data?.id || '');
    if (!orderId) throw new Error('Failed to create payment order');
    return { free: false, keyId, orderId, amount, currency: 'INR', plan };
  }

  /**
   * Verify a Razorpay payment and, only if the signature and the server-side
   * order (amount + plan id from notes) check out, assign the plan to the vendor.
   */
  async verifyPlanPayment(
    vendorId: string,
    planId: string,
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<{ verified: boolean; planInfo?: unknown }> {
    const { keyId, keySecret } = this.razorpayConfig();

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    if (expected !== signature) return { verified: false };

    // Re-fetch the order so the amount and plan id can't be tampered with client-side.
    const orderResp = await axios.get(`https://api.razorpay.com/v1/orders/${orderId}`, {
      auth: { username: keyId, password: keySecret },
    });
    const order = orderResp.data || {};
    const notesPlanId = String(order?.notes?.planId || '');
    if (notesPlanId !== planId) return { verified: false };

    const plan = await AppDataSource.getRepository(VendorPlan).findOne({ where: { id: planId } });
    if (!plan) return { verified: false };
    if (Math.round(Number(plan.price) * 100) !== Number(order.amount)) return { verified: false };

    await this.assignPlan(vendorId, planId, true);
    const planInfo = await this.getVendorPlanInfo(vendorId);
    return { verified: true, planInfo };
  }

  async listSettlementsForVendor(
    vendorId: string,
    limit: number,
    offset: number,
    filters?: { q?: string; status?: string; from?: string; to?: string },
  ) {
    const qb = AppDataSource.getRepository(Settlement)
      .createQueryBuilder('s')
      .where('s.vendorId = :vendorId', { vendorId });

    const status = (filters?.status || '').trim();
    if (status && status !== 'all') qb.andWhere('s.status = :status', { status });

    const from = (filters?.from || '').trim();
    if (from) qb.andWhere('DATE(s.createdAt) >= :from', { from });

    const to = (filters?.to || '').trim();
    if (to) qb.andWhere('DATE(s.createdAt) <= :to', { to });

    const q = (filters?.q || '').trim();
    if (q) {
      const like = `%${q}%`;
      qb.andWhere(
        `(s.id LIKE :like OR s.orderId LIKE :like OR ${jsonText('s.metadata', 'orderRef')} LIKE :like OR ${jsonText('s.metadata', 'settlementCode')} LIKE :like)`,
        { like },
      );
    }

    qb.orderBy('s.createdAt', 'DESC').take(limit).skip(offset);
    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(normalizeSettlementRow), total, limit, offset };
  }

  async getSettlementForVendor(vendorId: string, settlementId: string): Promise<Settlement | null> {
    const row = await AppDataSource.getRepository(Settlement).findOne({ where: { id: settlementId } });
    if (!row || row.vendorId !== vendorId) return null;
    return normalizeSettlementRow(row);
  }

  async getRatingSummaryForVendor(vendorId: string): Promise<{
    averageRating: number;
    reviewCount: number;
    distribution: Record<string, number>;
  }> {
    const repo = AppDataSource.getRepository(VendorReview);
    const rows = await repo.find({
      where: { vendorId, status: 'published' },
      select: ['rating'],
    });
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let sum = 0;
    for (const r of rows) {
      const n = Math.min(5, Math.max(1, Number(r.rating) || 0));
      sum += n;
      distribution[String(n)] = (distribution[String(n)] || 0) + 1;
    }
    const reviewCount = rows.length;
    const averageRating = reviewCount ? Math.round((sum / reviewCount) * 10) / 10 : 0;
    return { averageRating, reviewCount, distribution };
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
