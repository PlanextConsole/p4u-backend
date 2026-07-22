import axios from 'axios';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AppDataSource } from '../config/database';
import { FoodOrder } from '../entities/FoodOrder';
import { FoodRestaurant } from '../entities/FoodRestaurant';

export type FoodActorRole = 'customer' | 'vendor' | 'rider' | 'admin';
type JsonRecord = Record<string, unknown>;
const amount = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
const bool = (value: unknown) => value === true || value === 1 || String(value).toLowerCase() === 'true';

export class FoodPhase2Service {
  async listCoupons(restaurantId?: string) {
    const now = new Date();
    const qb = AppDataSource.createQueryBuilder().select('coupon.*').from('food_coupons', 'coupon')
      .where('coupon.is_active = :active', { active: true })
      .andWhere('coupon.starts_at <= :now', { now })
      .andWhere('(coupon.expires_at IS NULL OR coupon.expires_at > :now)', { now });
    if (restaurantId) qb.andWhere('(coupon.is_platform_wide = :wide OR coupon.restaurant_id = :restaurantId)', { wide: true, restaurantId });
    return qb.orderBy('coupon.discount_value', 'DESC').getRawMany();
  }

  async validateCoupon(code: string, customerId: string, restaurantId: string, subtotal: number) {
    const coupon = await AppDataSource.createQueryBuilder().select('coupon.*').from('food_coupons', 'coupon')
      .where('UPPER(coupon.code) = UPPER(:code)', { code: code.trim() }).getRawOne();
    if (!coupon || !bool(coupon.is_active)) throw new Error('Invalid coupon code');
    const now = Date.now();
    if (new Date(coupon.starts_at).getTime() > now) throw new Error('Coupon is not active yet');
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) throw new Error('Coupon has expired');
    if (!bool(coupon.is_platform_wide) && coupon.restaurant_id && coupon.restaurant_id !== restaurantId) throw new Error('Coupon is not valid for this restaurant');
    if (subtotal < Number(coupon.min_order_amount)) throw new Error(`Minimum order amount is ${coupon.min_order_amount}`);
    if (coupon.total_usage_limit != null && Number(coupon.usage_count) >= Number(coupon.total_usage_limit)) throw new Error('Coupon usage limit reached');
    const used = await AppDataSource.createQueryBuilder().select('COUNT(*)', 'count').from('food_coupon_redemptions', 'redemption')
      .where('redemption.coupon_id = :couponId AND redemption.customer_id = :customerId', { couponId: coupon.id, customerId }).getRawOne();
    if (Number(used?.count || 0) >= Number(coupon.per_customer_limit)) throw new Error('Coupon customer usage limit reached');
    let discount = coupon.discount_type === 'percent' ? subtotal * Number(coupon.discount_value) / 100 : Number(coupon.discount_value);
    if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
    return { id: coupon.id, code: coupon.code, title: coupon.title, discount: amount(Math.min(subtotal, discount)) };
  }

  async saveCoupon(input: JsonRecord) {
    const code = String(input.code || '').trim().toUpperCase();
    const discountType = String(input.discountType ?? input.discount_type ?? 'flat');
    const discountValue = input.discountValue ?? input.discount_value;
    const maxDiscount = input.maxDiscount ?? input.max_discount;
    const minOrderAmount = input.minOrderAmount ?? input.minOrder ?? input.min_order_amount;
    const platformWide = input.isPlatformWide ?? input.platformWide ?? input.is_platform_wide;
    const perCustomerLimit = input.perCustomerLimit ?? input.per_customer_limit;
    const totalUsageLimit = input.totalUsageLimit ?? input.total_usage_limit;
    if (!code || !String(input.title || '').trim()) throw new Error('Coupon code and title are required');
    if (!['flat', 'percent'].includes(discountType)) throw new Error('Invalid discount type');
    const id = String(input.id || randomUUID());
    const values = { id, code, title: String(input.title).trim(), description: input.description ? String(input.description) : null,
      discount_type: discountType, discount_value: amount(discountValue),
      max_discount: maxDiscount == null ? null : amount(maxDiscount), min_order_amount: amount(minOrderAmount),
      restaurant_id: input.restaurantId ? String(input.restaurantId) : null, is_platform_wide: bool(platformWide),
      per_customer_limit: Math.max(1, Number(perCustomerLimit || 1)), total_usage_limit: totalUsageLimit == null ? null : Number(totalUsageLimit),
      starts_at: input.startsAt ? new Date(String(input.startsAt)) : new Date(Date.now() - 1000), expires_at: input.expiresAt ? new Date(String(input.expiresAt)) : null,
      is_active: input.isActive === undefined ? true : bool(input.isActive) };
    if (input.id) await AppDataSource.createQueryBuilder().update('food_coupons').set(values).where('id = :id', { id }).execute();
    else await AppDataSource.createQueryBuilder().insert().into('food_coupons').values(values).execute();
    return AppDataSource.createQueryBuilder().select('coupon.*').from('food_coupons', 'coupon').where('coupon.id = :id', { id }).getRawOne();
  }

  async createPayment(customerId: string, orderId: string, provider = 'razorpay', authorization?: string) {
    const order = await AppDataSource.getRepository(FoodOrder).findOne({ where: { id: orderId, customerId } });
    if (!order) throw new Error('Food order not found');
    if (order.paymentMethod.toLowerCase() === 'cod') throw new Error('COD orders do not require an online payment');
    if (order.paymentStatus === 'paid') throw new Error('Order is already paid');
    const id = randomUUID();
    let providerOrderId: string;
    let providerIntentId: string | null = null;
    if (process.env.FOOD_PAYMENT_MODE === 'test') {
      providerOrderId = `food_test_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    } else {
      if (!authorization) throw new Error('Authenticated payment creation is required');
      const baseUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8087';
      const response = await axios.post(`${baseUrl}/api/v1/payments/intents`, {
        orderId: order.id, amount: String(order.total), currency: 'INR',
        metadata: { domain: 'food', foodOrderId: order.id, orderRef: order.orderRef },
      }, { headers: { Authorization: authorization }, timeout: 15000 });
      const intent = response.data?.data ?? response.data;
      providerOrderId = String(intent?.providerRef || '');
      providerIntentId = intent?.id ? String(intent.id) : null;
      if (!providerOrderId) throw new Error('Payment provider did not return an order reference');
    }
    await AppDataSource.createQueryBuilder().insert().into('food_payments').values({ id, order_id: order.id,
      customer_id: customerId, payment_method: order.paymentMethod, payment_provider: provider, amount: order.total,
      status: 'pending', provider_order_id: providerOrderId, metadata: JSON.stringify({ orderRef: order.orderRef, providerIntentId }) }).execute();
    return { id, providerIntentId, providerOrderId, amount: Number(order.total), currency: 'INR', status: 'pending' };
  }

  async processPaymentWebhook(payload: JsonRecord, signature: string | undefined, rawBody?: string) {
    const secret = process.env.FOOD_PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new Error('Food payment webhook secret is not configured');
    const body = rawBody || JSON.stringify(payload);
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const left = Buffer.from(expected); const right = Buffer.from(signature || '');
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('Invalid payment webhook signature');
    const providerOrderId = String(payload.providerOrderId || '');
    const status = String(payload.status || '');
    if (!['success', 'failed'].includes(status)) throw new Error('Unsupported payment webhook status');
    return AppDataSource.transaction(async manager => {
      const payment = await manager.createQueryBuilder().select('payment.*').from('food_payments', 'payment')
        .where('payment.provider_order_id = :providerOrderId', { providerOrderId }).setLock('pessimistic_write').getRawOne();
      if (!payment) throw new Error('Food payment not found');
      const providerPaymentId = payload.providerPaymentId ? String(payload.providerPaymentId) : null;
      if (payment.provider_payment_id && providerPaymentId && payment.provider_payment_id !== providerPaymentId) throw new Error('Provider payment reference mismatch');
      if (payment.status === 'success') return { accepted: true, status: 'success', duplicate: status === 'success', ignored: status === 'failed' };
      if (payment.status === status) return { accepted: true, status, duplicate: true };
      await manager.createQueryBuilder().update('food_payments').set({ status, provider_payment_id: providerPaymentId,
        failure_reason: payload.failureReason ? String(payload.failureReason) : null,
        metadata: JSON.stringify({ ...(typeof payment.metadata === 'object' ? payment.metadata : {}), lastWebhookKey: String(payload.eventId || `${providerOrderId}:${providerPaymentId || ''}:${status}`), webhookAt: new Date().toISOString() })
      }).where('id = :id', { id: payment.id }).execute();
      await manager.getRepository(FoodOrder).update(payment.order_id, { paymentStatus: status === 'success' ? 'paid' : 'failed' });
      return { accepted: true, status, duplicate: false };
    });
  }

  async saveRiderProfile(userId: string, input: JsonRecord) {
    const existing = await this.getRiderByUser(userId);
    const id = existing?.id || randomUUID();
    const values = { id, user_id: userId, name: String(input.name || existing?.name || '').trim(),
      phone: String(input.phone || existing?.phone || '').trim(), vehicle_type: input.vehicleType ?? existing?.vehicle_type ?? null,
      vehicle_number: input.vehicleNumber ?? existing?.vehicle_number ?? null };
    if (!values.name || !values.phone) throw new Error('Rider name and phone are required');
    if (existing) await AppDataSource.createQueryBuilder().update('food_riders').set(values).where('id = :id', { id }).execute();
    else await AppDataSource.createQueryBuilder().insert().into('food_riders').values(values).execute();
    return this.getRiderByUser(userId);
  }

  async getRiderByUser(userId: string) {
    return AppDataSource.createQueryBuilder().select('rider.*').from('food_riders', 'rider').where('rider.user_id = :userId', { userId }).getRawOne();
  }

  async setRiderOnline(userId: string, online: boolean) {
    const rider = await this.requireRider(userId);
    if (online && (!['verified', 'approved'].includes(rider.kyc_status) || rider.status !== 'active')) throw new Error('Active, verified KYC is required to go online');
    await AppDataSource.createQueryBuilder().update('food_riders').set({ is_online: online }).where('id = :id', { id: rider.id }).execute();
    return { ...rider, is_online: online };
  }

  async updateRiderLocation(userId: string, latitude: number, longitude: number, orderId?: string) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Invalid rider coordinates');
    const rider = await this.requireRider(userId); const now = new Date();
    await AppDataSource.transaction(async manager => {
      await manager.createQueryBuilder().update('food_riders').set({ current_lat: latitude, current_lng: longitude, last_location_at: now }).where('id = :id', { id: rider.id }).execute();
      await manager.createQueryBuilder().insert().into('food_rider_locations').values({ id: randomUUID(), rider_id: rider.id,
        order_id: orderId || null, latitude, longitude, recorded_at: now }).execute();
    });
    return { riderId: rider.id, latitude, longitude, recordedAt: now };
  }

  async autoAssign(orderId: string) {
    const order = await AppDataSource.getRepository(FoodOrder).findOne({ where: { id: orderId } });
    if (!order) throw new Error('Food order not found');
    const active = await AppDataSource.createQueryBuilder().select('assignment.*').from('food_rider_assignments', 'assignment')
      .where('assignment.order_id = :orderId AND assignment.status IN (:...statuses)', { orderId, statuses: ['offered', 'accepted', 'picked_up'] }).getRawOne();
    if (active) return active;
    const restaurant = await AppDataSource.getRepository(FoodRestaurant).findOne({ where: { id: order.restaurantId } });
    if (!restaurant?.latitude || !restaurant.longitude) throw new Error('Restaurant location is required for rider assignment');
    const riders = await AppDataSource.createQueryBuilder().select('rider.*').from('food_riders', 'rider')
      .where('rider.is_online = :online AND rider.status = :status AND rider.kyc_status IN (:...kyc)', { online: true, status: 'active', kyc: ['verified', 'approved'] }).getRawMany();
    const eligible = [] as Array<{ rider: any; distance: number }>;
    for (const rider of riders) {
      if (rider.current_lat == null || rider.current_lng == null) continue;
      const count = await AppDataSource.createQueryBuilder().select('COUNT(*)', 'count').from('food_rider_assignments', 'a')
        .where('a.rider_id = :id AND a.status IN (:...statuses)', { id: rider.id, statuses: ['offered', 'accepted', 'picked_up'] }).getRawOne();
      if (Number(count?.count || 0) >= Number(rider.max_concurrent_orders || 3)) continue;
      eligible.push({ rider, distance: this.distance(Number(restaurant.latitude), Number(restaurant.longitude), Number(rider.current_lat), Number(rider.current_lng)) });
    }
    eligible.sort((a, b) => a.distance - b.distance); const selected = eligible[0];
    if (!selected) throw new Error('No available rider');
    const id = randomUUID(); const payout = amount(20 + selected.distance * 6);
    await AppDataSource.createQueryBuilder().insert().into('food_rider_assignments').values({ id, order_id: orderId,
      rider_id: selected.rider.id, distance_km: amount(selected.distance), payout_amount: payout, status: 'offered' }).execute();
    await this.notify(selected.rider.user_id, 'rider', 'food_assignment', 'New delivery offer', `Order ${order.orderRef} is ready`, `/food/rider/assignments/${id}`, { orderId, assignmentId: id });
    return { id, order_id: orderId, rider_id: selected.rider.id, status: 'offered', distance_km: amount(selected.distance), payout_amount: payout };
  }

  async listRiderAssignments(userId: string) {
    const rider = await this.requireRider(userId);
    return AppDataSource.createQueryBuilder().select('assignment.*').addSelect('food_order.order_ref', 'order_ref').addSelect('food_order.restaurant_name', 'restaurant_name').addSelect('food_order.delivery_address', 'delivery_address').addSelect('food_order.total', 'order_total').from('food_rider_assignments', 'assignment')
      .leftJoin('food_orders', 'food_order', 'food_order.id = assignment.order_id').where('assignment.rider_id = :id', { id: rider.id })
      .orderBy('assignment.offered_at', 'DESC').getRawMany();
  }

  async respondToAssignment(userId: string, assignmentId: string, accept: boolean, reason?: string) {
    const rider = await this.requireRider(userId); const assignment = await this.assignment(assignmentId, rider.id);
    if (!assignment || assignment.status !== 'offered') throw new Error('Active rider offer not found');
    await AppDataSource.createQueryBuilder().update('food_rider_assignments').set({ status: accept ? 'accepted' : 'rejected',
      responded_at: new Date(), rejection_reason: accept ? null : (reason || 'Rejected by rider') }).where('id = :id', { id: assignmentId }).execute();
    return { ...assignment, status: accept ? 'accepted' : 'rejected' };
  }

  async pickup(userId: string, assignmentId: string) {
    const rider = await this.requireRider(userId); const assignment = await this.assignment(assignmentId, rider.id);
    if (!assignment || assignment.status !== 'accepted') throw new Error('Accepted rider assignment not found');
    await AppDataSource.transaction(async manager => {
      await manager.createQueryBuilder().update('food_rider_assignments').set({ status: 'picked_up', picked_up_at: new Date() }).where('id = :id', { id: assignmentId }).execute();
      await manager.getRepository(FoodOrder).update(assignment.order_id, { status: 'out_for_delivery', pickedUpAt: new Date() });
    });
    return { ...assignment, status: 'picked_up' };
  }

  async deliver(userId: string, assignmentId: string, otp: string) {
    const rider = await this.requireRider(userId); const assignment = await this.assignment(assignmentId, rider.id);
    if (!assignment || assignment.status !== 'picked_up') throw new Error('Picked-up rider assignment not found');
    const order = await AppDataSource.getRepository(FoodOrder).findOne({ where: { id: assignment.order_id } });
    if (!order || order.handoverOtp !== otp.trim()) throw new Error('Invalid handover OTP');
    await AppDataSource.transaction(async manager => {
      await manager.createQueryBuilder().update('food_rider_assignments').set({ status: 'delivered', delivered_at: new Date() }).where('id = :id', { id: assignmentId }).execute();
      order.status = 'delivered'; order.deliveredAt = new Date(); if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
      await manager.getRepository(FoodOrder).save(order);
      await manager.createQueryBuilder().insert().into('food_order_status_history').values({ id: randomUUID(), orderId: order.id,
        status: 'delivered', changedBy: rider.id, note: 'Delivery confirmed with handover OTP' }).execute();
      const invoiceNo = `INV-FD-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Date.now().toString().slice(-8)}`;
      await manager.createQueryBuilder().insert().into('food_invoices').values({ id: randomUUID(), invoice_no: invoiceNo,
        order_id: order.id, customer_id: order.customerId, restaurant_id: order.restaurantId, subtotal: order.subtotal,
        tax: order.gst, delivery_fee: order.deliveryFee, packaging_fee: order.packagingFee, platform_fee: order.platformFee,
        discount: order.discount, total: order.total, payment_method: order.paymentMethod }).execute();
      await manager.createQueryBuilder().update('food_orders').set({ invoiceNo }).where('id = :id', { id: order.id }).execute();
      await manager.createQueryBuilder().insert().into('food_rider_settlements').values({ id: randomUUID(),
        rider_id: rider.id, assignment_id: assignmentId, amount: assignment.payout_amount, status: 'pending' }).execute();
    });
    await this.notify(order.customerId, 'customer', 'food_delivered', 'Order delivered', `${order.orderRef} was delivered`, `/food/orders/${order.id}`, { orderId: order.id });
    return order;
  }

  async trackOrder(customerId: string, orderId: string) {
    const order = await AppDataSource.getRepository(FoodOrder).findOne({ where: { id: orderId, customerId } });
    if (!order) throw new Error('Food order not found');
    const assignment = await AppDataSource.createQueryBuilder().select('a.*').from('food_rider_assignments', 'a').where('a.order_id = :orderId', { orderId }).orderBy('a.offered_at', 'DESC').getRawOne();
    let rider = null; if (assignment) rider = await AppDataSource.createQueryBuilder().select('r.*').from('food_riders', 'r').where('r.id = :id', { id: assignment.rider_id }).getRawOne();
    return { orderId, status: order.status, etaMinutes: order.etaMinutes, assignment, rider: rider ? { name: rider.name, vehicleType: rider.vehicle_type,
      vehicleNumber: rider.vehicle_number, latitude: rider.current_lat, longitude: rider.current_lng, lastLocationAt: rider.last_location_at } : null };
  }

  async getInvoice(customerId: string, orderId: string) {
    const invoice = await AppDataSource.createQueryBuilder().select('invoice.*').from('food_invoices', 'invoice')
      .where('invoice.order_id = :orderId AND invoice.customer_id = :customerId', { orderId, customerId }).getRawOne();
    if (!invoice) throw new Error('Food invoice not found'); return invoice;
  }

  async getInvoicePdf(customerId: string, orderId: string): Promise<Buffer> {
    const invoice = await this.getInvoice(customerId, orderId);
    const rows = ['PLANEXT4U FOOD INVOICE', `Invoice: ${invoice.invoice_no}`, `Order: ${invoice.order_id}`,
      `Date: ${new Date(invoice.created_at || Date.now()).toISOString()}`, '', `Subtotal: INR ${Number(invoice.subtotal).toFixed(2)}`,
      `Tax: INR ${Number(invoice.tax).toFixed(2)}`, `Delivery: INR ${Number(invoice.delivery_fee).toFixed(2)}`,
      `Packaging: INR ${Number(invoice.packaging_fee).toFixed(2)}`, `Platform fee: INR ${Number(invoice.platform_fee).toFixed(2)}`,
      `Discount: INR ${Number(invoice.discount).toFixed(2)}`, `TOTAL: INR ${Number(invoice.total).toFixed(2)}`, `Payment: ${invoice.payment_method}`];
    const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const stream = `BT /F1 12 Tf 50 790 Td 16 TL ${rows.map((row, index) => `${index ? 'T* ' : ''}(${esc(row)}) Tj`).join(' ')} ET`;
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }
  async initiateRefund(orderId: string, initiatedBy: string, input: JsonRecord) {
    const id = randomUUID();
    return AppDataSource.transaction(async manager => {
      const order = await manager.getRepository(FoodOrder).findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new Error('Food order not found');
      if (!['paid', 'partially_refunded'].includes(order.paymentStatus)) throw new Error('Only paid orders can be refunded');
      const refundAmount = amount(input.amount ?? order.total);
      const rows = await manager.createQueryBuilder().select('refund.amount', 'amount').addSelect('refund.status', 'status')
        .from('food_refunds', 'refund').where('refund.order_id = :orderId', { orderId }).setLock('pessimistic_read').getRawMany();
      const reserved = rows.filter((refund: any) => ['pending', 'processing', 'completed'].includes(String(refund.status)))
        .reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0);
      if (refundAmount <= 0 || refundAmount > Number(order.total) - reserved + 0.00001) {
        throw new Error('Refund amount exceeds remaining paid amount');
      }
      await manager.createQueryBuilder().insert().into('food_refunds').values({ id, order_id: orderId, customer_id: order.customerId,
        amount: refundAmount, reason: String(input.reason || 'order_refund'), notes: input.notes ? String(input.notes) : null,
        refund_method: String(input.refundMethod || 'original'), initiated_by: initiatedBy, status: 'pending' }).execute();
      await manager.getRepository(FoodOrder).update(orderId, { refundStatus: 'pending', refundAmount: String(reserved + refundAmount) });
      return { id, orderId, amount: refundAmount, status: 'pending' };
    });
  }

  async executeProviderRefund(refundId: string, authorization?: string) {
    if (!authorization) throw new Error('Administrator authorization is required for provider refund');
    const refund = await AppDataSource.createQueryBuilder().select('refund.*').from('food_refunds', 'refund').where('refund.id = :id', { id: refundId }).getRawOne();
    if (!refund) throw new Error('Food refund not found');
    if (refund.status === 'completed') return { ...refund, duplicate: true };
    if (refund.status === 'processing') return { ...refund, duplicate: true };
    if (refund.status !== 'pending') throw new Error(`Refund cannot be processed from ${refund.status}`);
    const response = await axios.post(`${process.env.PAYMENT_SERVICE_URL || 'http://localhost:8087'}/api/v1/payments/refunds`,
      { orderId: refund.order_id, amount: String(refund.amount), reason: refund.reason },
      { headers: { Authorization: authorization }, timeout: 30000 });
    const provider = response.data?.data ?? response.data;
    const providerRefundId = String(provider.providerRefundId || '');
    if (!providerRefundId) throw new Error('Payment provider did not return a refund reference');
    if (provider.status === 'processed') return this.completeRefund(refundId, true, providerRefundId);
    if (provider.status === 'failed') return this.completeRefund(refundId, false, providerRefundId);
    await AppDataSource.transaction(async manager => {
      await manager.createQueryBuilder().update('food_refunds').set({ status: 'processing', provider_refund_id: providerRefundId })
        .where('id = :id AND status = :status', { id: refundId, status: 'pending' }).execute();
      await manager.getRepository(FoodOrder).update(refund.order_id, { refundStatus: 'processing' });
    });
    return { ...refund, status: 'processing', provider_refund_id: providerRefundId };
  }

  async completeRefund(refundId: string, success: boolean, providerRefundId?: string) {
    return AppDataSource.transaction(async manager => {
      const refund = await manager.createQueryBuilder().select('refund.*').from('food_refunds', 'refund')
        .where('refund.id = :id', { id: refundId }).setLock('pessimistic_write').getRawOne();
      if (!refund) throw new Error('Food refund not found');
      const status = success ? 'completed' : 'failed';
      if (refund.status === status) return { ...refund, duplicate: true };
      const order = await manager.getRepository(FoodOrder).findOne({ where: { id: refund.order_id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new Error('Food order not found');
      await manager.createQueryBuilder().update('food_refunds').set({ status,
        provider_refund_id: providerRefundId || refund.provider_refund_id || null,
        completed_at: success ? new Date() : null }).where('id = :id', { id: refundId }).execute();
      const completedRows = await manager.createQueryBuilder().select('refund.amount', 'amount').from('food_refunds', 'refund')
        .where('refund.order_id = :orderId AND refund.status = :status', { orderId: refund.order_id, status: 'completed' }).getRawMany();
      const completedAmount = completedRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const paymentStatus = completedAmount >= Number(order.total) - 0.00001 ? 'refunded' : completedAmount > 0 ? 'partially_refunded' : order.paymentStatus;
      await manager.getRepository(FoodOrder).update(order.id, { refundStatus: status, paymentStatus, refundAmount: String(completedAmount) });
      return { ...refund, status, provider_refund_id: providerRefundId || refund.provider_refund_id || null };
    });
  }

  async processRefundWebhook(payload: JsonRecord, signature: string | undefined, rawBody?: string) {
    const secret = process.env.FOOD_PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new Error('Food payment webhook secret is not configured');
    const body = rawBody || JSON.stringify(payload);
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const left = Buffer.from(expected); const right = Buffer.from(signature || '');
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('Invalid refund webhook signature');
    const providerRefundId = String(payload.providerRefundId || '');
    const status = String(payload.status || '');
    if (!providerRefundId || !['processed', 'failed'].includes(status)) throw new Error('Unsupported refund webhook');
    const refund = await AppDataSource.createQueryBuilder().select('refund.*').from('food_refunds', 'refund')
      .where('refund.provider_refund_id = :providerRefundId', { providerRefundId }).getRawOne();
    if (!refund) throw new Error('Food refund not found');
    return this.completeRefund(refund.id, status === 'processed', providerRefundId);
  }

  async subscribeBackInStock(customerId: string, menuItemId: string) {
    const item = await AppDataSource.createQueryBuilder().select('item.*').from('food_menu_items', 'item').where('item.id = :id', { id: menuItemId }).getRawOne();
    if (!item) throw new Error('Menu item not found'); if (bool(item.in_stock)) throw new Error('Menu item is already in stock');
    try { await AppDataSource.createQueryBuilder().insert().into('food_stock_subscriptions').values({ id: randomUUID(), menu_item_id: menuItemId, customer_id: customerId }).execute(); } catch (error) {
      if (!/duplicate/i.test(error instanceof Error ? error.message : String(error))) throw error;
    } return { subscribed: true };
  }

  async notifyBackInStock(menuItemId: string) {
    const subscriptions = await AppDataSource.createQueryBuilder().select('s.*').from('food_stock_subscriptions', 's')
      .where('s.menu_item_id = :menuItemId AND s.notified_at IS NULL', { menuItemId }).getRawMany();
    for (const sub of subscriptions) await this.notify(sub.customer_id, 'customer', 'food_back_in_stock', 'Back in stock', 'A saved menu item is available again', `/food/menu-items/${menuItemId}`, { menuItemId });
    if (subscriptions.length) await AppDataSource.createQueryBuilder().update('food_stock_subscriptions').set({ notified_at: new Date() }).where('menu_item_id = :menuItemId AND notified_at IS NULL', { menuItemId }).execute();
    return { notified: subscriptions.length };
  }

  async listNotifications(recipientId: string) { return AppDataSource.createQueryBuilder().select('n.*').from('food_notifications', 'n').where('n.recipient_id = :recipientId', { recipientId }).orderBy('n.created_at', 'DESC').getRawMany(); }
  async listAdminOrders(status?: string) { const qb = AppDataSource.createQueryBuilder().select('o.*').from('food_orders', 'o'); if (status) qb.where('o.status = :status', { status }); return qb.orderBy('o.created_at', 'DESC').getRawMany(); }
  async listAdminRiders() { return AppDataSource.createQueryBuilder().select('r.*').from('food_riders', 'r').orderBy('r.created_at', 'DESC').getRawMany(); }
  async approveRider(riderId: string, approved: boolean) { await AppDataSource.createQueryBuilder().update('food_riders').set({ kyc_status: approved ? 'verified' : 'rejected', status: approved ? 'active' : 'suspended', is_online: false }).where('id = :id', { id: riderId }).execute(); return { riderId, approved }; }

  async listAdminRestaurants() {
    return AppDataSource.createQueryBuilder().select('restaurant.*').from('food_restaurants', 'restaurant').orderBy('restaurant.created_at', 'DESC').getRawMany();
  }

  async setAdminRestaurantState(restaurantId: string, input: JsonRecord) {
    const repo = AppDataSource.getRepository(FoodRestaurant);
    const row = await repo.findOne({ where: { id: restaurantId } });
    if (!row) throw new Error('Food restaurant not found');
    const names: Array<keyof FoodRestaurant> = ['name', 'tagline', 'description', 'address', 'phone', 'email', 'fssaiLicense', 'openingTime', 'closingTime', 'status'];
    const normalized: JsonRecord = { ...input, name: input.name ?? input.title, minOrderAmount: input.minOrderAmount ?? input.minOrder,
      vegOnly: input.vegOnly ?? input.isPureVeg, commissionRate: input.commissionRate ?? input.commissionPercent };
    for (const key of names) if (normalized[key] !== undefined) (row as any)[key] = normalized[key];
    for (const key of ['latitude', 'longitude', 'deliveryRadiusKm', 'packagingFee', 'minOrderAmount', 'commissionRate'] as const) {
      if (normalized[key] !== undefined) (row as any)[key] = String(amount(normalized[key]));
    }
    if (normalized.isActive !== undefined) row.isActive = bool(normalized.isActive);
    if (normalized.vegOnly !== undefined) row.vegOnly = bool(normalized.vegOnly);
    if (normalized.cuisine !== undefined || normalized.cuisines !== undefined) {
      const value = normalized.cuisine ?? normalized.cuisines;
      row.cuisine = Array.isArray(value) ? value.map(String) : String(value || '').split(',').map(v => v.trim()).filter(Boolean);
    }
    if (!row.name?.trim() || !row.address?.trim()) throw new Error('Restaurant name and address are required');
    return repo.save(row);
  }
  async listAdminCoupons() {
    return AppDataSource.createQueryBuilder().select('coupon.*').from('food_coupons', 'coupon').orderBy('coupon.created_at', 'DESC').getRawMany();
  }

  async listAdminRefunds(status?: string) {
    const qb = AppDataSource.createQueryBuilder().select('refund.*').from('food_refunds', 'refund');
    if (status) qb.where('refund.status = :status', { status });
    return qb.orderBy('refund.initiated_at', 'DESC').getRawMany();
  }

  async listRiderSettlements(status?: string) {
    const qb = AppDataSource.createQueryBuilder().select('settlement.*').addSelect('rider.name', 'rider_name')
      .from('food_rider_settlements', 'settlement').leftJoin('food_riders', 'rider', 'rider.id = settlement.rider_id');
    if (status) qb.where('settlement.status = :status', { status });
    return qb.orderBy('settlement.created_at', 'DESC').getRawMany();
  }

  async completeRiderSettlement(settlementId: string, transactionRef: string) {
    if (!transactionRef.trim()) throw new Error('Transaction reference is required');
    const result = await AppDataSource.createQueryBuilder().update('food_rider_settlements')
      .set({ status: 'paid', transaction_ref: transactionRef.trim(), paid_at: new Date() })
      .where('id = :id AND status = :status', { id: settlementId, status: 'pending' }).execute();
    if (!result.affected) throw new Error('Pending rider settlement not found');
    return { id: settlementId, status: 'paid', transactionRef };
  }

  async listCombos(restaurantId: string, includeInactive = false) {
    const qb = AppDataSource.createQueryBuilder().select('combo.*').from('food_combos', 'combo').where('combo.restaurant_id = :restaurantId', { restaurantId });
    if (!includeInactive) qb.andWhere('combo.is_active = :active AND combo.in_stock = :stock', { active: true, stock: true });
    const now = new Date();
    qb.andWhere('(combo.starts_at IS NULL OR combo.starts_at <= :now) AND (combo.expires_at IS NULL OR combo.expires_at > :now)', { now });
    return qb.orderBy('combo.name', 'ASC').getRawMany();
  }

  async saveCombo(restaurantId: string, input: JsonRecord) {
    const itemIds = Array.isArray(input.itemIds) ? input.itemIds.map(String) : [];
    if (!String(input.name || '').trim() || !itemIds.length || amount(input.price) <= 0) throw new Error('Combo name, items and price are required');
    const count = await AppDataSource.createQueryBuilder().select('COUNT(*)', 'count').from('food_menu_items', 'item')
      .where('item.restaurant_id = :restaurantId AND item.id IN (:...itemIds)', { restaurantId, itemIds }).getRawOne();
    if (Number(count?.count || 0) !== itemIds.length) throw new Error('Combo contains invalid menu items');
    const id = String(input.id || randomUUID());
    const values = { id, restaurant_id: restaurantId, name: String(input.name).trim(), description: input.description ? String(input.description) : null,
      item_ids: JSON.stringify(itemIds), price: amount(input.price), image_url: input.imageUrl ? String(input.imageUrl) : null,
      in_stock: input.inStock === undefined ? true : bool(input.inStock), is_active: input.isActive === undefined ? true : bool(input.isActive),
      starts_at: input.startsAt ? new Date(String(input.startsAt)) : null, expires_at: input.expiresAt ? new Date(String(input.expiresAt)) : null };
    if (input.id) await AppDataSource.createQueryBuilder().update('food_combos').set(values).where('id = :id AND restaurant_id = :restaurantId', { id, restaurantId }).execute();
    else await AppDataSource.createQueryBuilder().insert().into('food_combos').values(values).execute();
    return AppDataSource.createQueryBuilder().select('combo.*').from('food_combos', 'combo').where('combo.id = :id', { id }).getRawOne();
  }
  async updateAdminRider(riderId: string, input: JsonRecord) {
    const values: JsonRecord = {};
    if (input.name !== undefined) values.name = String(input.name);
    if (input.phone !== undefined || input.mobile !== undefined) values.phone = String(input.phone ?? input.mobile);
    if (input.vehicleType !== undefined) values.vehicle_type = String(input.vehicleType);
    if (input.vehicleNumber !== undefined || input.vehicleNo !== undefined) values.vehicle_number = String(input.vehicleNumber ?? input.vehicleNo);
    if (input.status !== undefined) values.status = String(input.status);
    if (input.approved !== undefined) { values.kyc_status = bool(input.approved) ? 'verified' : 'rejected'; values.is_online = false; }
    if (!Object.keys(values).length) throw new Error('No rider fields supplied');
    await AppDataSource.createQueryBuilder().update('food_riders').set(values).where('id = :id', { id: riderId }).execute();
    return AppDataSource.createQueryBuilder().select('r.*').from('food_riders', 'r').where('r.id = :id', { id: riderId }).getRawOne();
  }

  async deactivateCoupon(couponId: string) {
    const result = await AppDataSource.createQueryBuilder().update('food_coupons').set({ is_active: false }).where('id = :id', { id: couponId }).execute();
    if (!result.affected) throw new Error('Food coupon not found');
    return { id: couponId, isActive: false };
  }

  async adminChangeOrderStatus(orderId: string, status: string, adminId: string, note?: string) {
    const allowed = ['cancelled', 'rejected', 'accepted', 'preparing', 'ready'];
    if (!allowed.includes(status)) throw new Error('Unsupported administrative order status');
    const order = await AppDataSource.getRepository(FoodOrder).findOne({ where: { id: orderId } });
    if (!order) throw new Error('Food order not found');
    order.status = status;
    if (status === 'cancelled' || status === 'rejected') { order.cancelledAt = new Date(); order.cancellationReason = note || `Changed by administrator`; }
    await AppDataSource.transaction(async manager => {
      await manager.getRepository(FoodOrder).save(order);
      await manager.createQueryBuilder().insert().into('food_order_status_history').values({ id: randomUUID(), orderId,
        status, changedBy: adminId, note: note || 'Administrative update' }).execute();
    });
    return order;
  }
  private async notify(recipientId: string, recipientRole: FoodActorRole, type: string, title: string, body: string, deepLink: string, data: JsonRecord) {
    await AppDataSource.createQueryBuilder().insert().into('food_notifications').values({ id: randomUUID(), recipient_id: recipientId,
      recipient_role: recipientRole, type, title, body, deep_link: deepLink, data: JSON.stringify(data) }).execute();    const key = process.env.INTERNAL_API_KEY;
    if (key) await axios.post(`${process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8090'}/api/v1/notifications/internal/send`,
      { userId: recipientId, title, body, deepLink, data: { ...data, type, recipientRole } },
      { headers: { 'x-internal-api-key': key }, timeout: 5000 }).catch(error => console.error('[food] push dispatch failed', error?.message || error));
  }
  private async requireRider(userId: string) { const rider = await this.getRiderByUser(userId); if (!rider) throw new Error('Rider profile not found'); return rider; }
  private assignment(id: string, riderId: string) { return AppDataSource.createQueryBuilder().select('a.*').from('food_rider_assignments', 'a').where('a.id = :id AND a.rider_id = :riderId', { id, riderId }).getRawOne(); }
  private distance(aLat: number, aLng: number, bLat: number, bLng: number) { const rad = (x: number) => x * Math.PI / 180; const dLat = rad(bLat-aLat), dLng = rad(bLng-aLng); const a = Math.sin(dLat/2)**2 + Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLng/2)**2; return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
}
