import axios from 'axios';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';
import { CartService } from './cart.service';
import { CommerceQueryService } from './commerceQuery.service';

type JsonRecord = Record<string, any>;

function metaOf(order: Order): JsonRecord {
  return order.metadata && typeof order.metadata === 'object' ? { ...order.metadata } : {};
}

function history(meta: JsonRecord): JsonRecord[] {
  return Array.isArray(meta.productStatusHistory) ? meta.productStatusHistory.map((row: any) => ({ ...row })) : [];
}

export class ProductLifecycleService {
  private commerce = new CommerceQueryService();

  private async ownedOrder(customerId: string, orderId: string, lock = false, manager = AppDataSource.manager) {
    const order = await manager.getRepository(Order).findOne({
      where: { id: orderId },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!order) throw new Error('Order not found');
    const owns = await this.commerce.customerOwnsOrder(customerId, order);
    if (!owns) throw new Error('Order does not belong to this customer');
    return order;
  }

  async tracking(customerId: string, orderId: string) {
    const order = await this.ownedOrder(customerId, orderId);
    const meta = metaOf(order);
    return {
      orderId: order.id,
      orderRef: order.orderRef,
      status: order.status,
      shippingType: meta.shipping_type ?? meta.shippingType ?? null,
      courierName: meta.courier_name ?? meta.courierName ?? null,
      trackingNumber: meta.tracking_number ?? meta.trackingNumber ?? null,
      trackingUrl: meta.tracking_url ?? meta.trackingUrl ?? null,
      shippedAt: meta.shippedAt ?? meta.shipped_at ?? null,
      estimatedDeliveryAt: meta.estimatedDeliveryAt ?? meta.estimated_delivery_at ?? null,
      deliveredAt: meta.deliveredAt ?? meta.delivered_at ?? null,
      customerConfirmedAt: meta.customerConfirmedAt ?? null,
      history: history(meta),
      returnRequest: meta.returnRequest ?? null,
    };
  }

  async confirmDelivery(customerId: string, orderId: string) {
    return AppDataSource.transaction(async manager => {
      const order = await this.ownedOrder(customerId, orderId, true, manager);
      if (['cancelled', 'refunded', 'returned'].includes(order.status)) throw new Error(`Delivery cannot be confirmed from ${order.status}`);
      const meta = metaOf(order);
      if (meta.customerConfirmedAt) return { ...order, duplicate: true };
      const now = new Date().toISOString();
      const nextHistory = history(meta);
      nextHistory.push({ status: 'delivered', at: now, actor: 'customer', note: 'Delivery confirmed by customer' });
      order.status = 'delivered';
      order.metadata = { ...meta, deliveredAt: meta.deliveredAt ?? now, customerConfirmedAt: now, productStatusHistory: nextHistory };
      return manager.getRepository(Order).save(order);
    });
  }

  async requestReturn(customerId: string, orderId: string, input: JsonRecord) {
    return AppDataSource.transaction(async manager => {
      const order = await this.ownedOrder(customerId, orderId, true, manager);
      const meta = metaOf(order);
      const existing = meta.returnRequest as JsonRecord | undefined;
      if (existing && !['rejected', 'cancelled'].includes(String(existing.status))) return { ...existing, duplicate: true };
      if (!['delivered', 'completed'].includes(order.status)) throw new Error('Only delivered orders can be returned');
      const deliveredAt = new Date(meta.customerConfirmedAt ?? meta.deliveredAt ?? order.updatedAt).getTime();
      const windowDays = Math.min(30, Math.max(1, Number(meta.returnWindowDays ?? 7)));
      if (!Number.isFinite(deliveredAt) || Date.now() > deliveredAt + windowDays * 86400000) throw new Error('Return window has expired');
      const reason = String(input.reason || '').trim();
      if (reason.length < 5) throw new Error('Return reason must contain at least 5 characters');
      const request = {
        id: randomUUID(),
        status: 'requested',
        reason,
        items: Array.isArray(input.items) ? input.items : [],
        photoUrls: Array.isArray(input.photoUrls) ? input.photoUrls.map(String).slice(0, 5) : [],
        requestedAt: new Date().toISOString(),
        refundAmount: Number(input.refundAmount ?? order.totalAmount),
        refundStatus: 'not_started',
      };
      const nextHistory = history(meta);
      nextHistory.push({ status: 'return_requested', at: request.requestedAt, actor: 'customer', note: reason });
      order.status = 'return_requested';
      order.metadata = { ...meta, returnRequest: request, productStatusHistory: nextHistory };
      await manager.getRepository(Order).save(order);
      return request;
    });
  }

  async executeRefund(orderId: string, authorization?: string) {
    if (!authorization) throw new Error('Administrator authorization is required');
    const order = await AppDataSource.getRepository(Order).findOne({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    const meta = metaOf(order);
    const request = meta.returnRequest as JsonRecord | undefined;
    if (!request || !['approved', 'received', 'refund_processing'].includes(String(request.status))) {
      throw new Error('Return must be approved before refund');
    }
    if (request.refundStatus === 'completed') return { ...request, duplicate: true };
    const response = await axios.post(`${process.env.PAYMENT_SERVICE_URL || 'http://localhost:8087'}/api/v1/payments/refunds`, {
      orderId: order.id,
      amount: String(request.refundAmount ?? order.totalAmount),
      reason: request.reason || 'product_return',
    }, { headers: { Authorization: authorization }, timeout: 30000 });
    const provider = response.data?.data ?? response.data;
    return this.applyRefundResult(order.id, String(provider.providerRefundId || ''), String(provider.status || 'pending'));
  }

  async applyRefundResult(orderId: string, providerRefundId: string, providerStatus: string) {
    return AppDataSource.transaction(async manager => {
      const order = await manager.getRepository(Order).findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new Error('Order not found');
      const meta = metaOf(order);
      const request = { ...(meta.returnRequest || {}) } as JsonRecord;
      if (!request.id) throw new Error('Return request not found');
      const normalized = providerStatus === 'processed' ? 'completed' : providerStatus === 'failed' ? 'failed' : 'processing';
      if (request.refundStatus === normalized && request.providerRefundId === providerRefundId) return { ...request, duplicate: true };
      request.refundStatus = normalized;
      request.providerRefundId = providerRefundId || request.providerRefundId || null;
      request.refundUpdatedAt = new Date().toISOString();
      if (normalized === 'completed') {
        request.status = 'refunded';
        order.status = 'refunded';
      } else if (normalized === 'processing') {
        request.status = 'refund_processing';
      }
      const nextHistory = history(meta);
      nextHistory.push({ status: `refund_${normalized}`, at: request.refundUpdatedAt, actor: 'payment_provider' });
      order.metadata = { ...meta, returnRequest: request, productStatusHistory: nextHistory };
      await manager.getRepository(Order).save(order);
      return request;
    });
  }

  async processRefundWebhook(payload: JsonRecord, signature: string | undefined, rawBody?: string) {
    const secret = process.env.PRODUCT_PAYMENT_WEBHOOK_SECRET || process.env.FOOD_PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new Error('Product payment webhook secret is not configured');
    const body = rawBody || JSON.stringify(payload);
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const left = Buffer.from(expected); const right = Buffer.from(signature || '');
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('Invalid product refund webhook signature');
    const orderId = String(payload.productOrderId || payload.orderId || '');
    const providerRefundId = String(payload.providerRefundId || '');
    const status = String(payload.status || '');
    if (!orderId || !providerRefundId || !['processed', 'failed', 'pending'].includes(status)) throw new Error('Invalid product refund webhook');
    return this.applyRefundResult(orderId, providerRefundId, status);
  }

  async processPaymentWebhook(payload: JsonRecord, signature: string | undefined, rawBody?: string) {
    const secret = process.env.PRODUCT_PAYMENT_WEBHOOK_SECRET || process.env.FOOD_PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new Error('Product payment webhook secret is not configured');
    const body = rawBody || JSON.stringify(payload);
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const left = Buffer.from(expected);
    const right = Buffer.from(signature || '');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new Error('Invalid product payment webhook signature');
    }

    const orderId = String(payload.productOrderId || payload.orderId || '');
    const status = String(payload.status || '').toLowerCase();
    if (!orderId || !['success', 'failed', 'captured'].includes(status)) {
      throw new Error('Invalid product payment webhook');
    }

    return AppDataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new Error('Order not found');
      const meta = metaOf(order);
      const alreadyPaid =
        order.status === 'paid' ||
        String(meta.paymentStatus || '').toLowerCase() === 'paid';
      if (alreadyPaid && (status === 'success' || status === 'captured')) {
        return { orderId: order.id, status: order.status, paymentStatus: 'paid', idempotent: true };
      }
      if (alreadyPaid && status === 'failed') {
        return { orderId: order.id, status: order.status, paymentStatus: 'paid', idempotent: true };
      }

      const nextHistory = history(meta);
      const now = new Date().toISOString();
      if (status === 'success' || status === 'captured') {
        nextHistory.push({ status: 'paid', at: now, actor: 'payment_provider' });
        order.status = 'paid';
        order.metadata = {
          ...meta,
          paymentStatus: 'paid',
          paidAt: now,
          providerOrderId: payload.providerOrderId ?? meta.providerOrderId ?? null,
          providerPaymentId: payload.providerPaymentId ?? meta.providerPaymentId ?? null,
          paymentEventId: payload.eventId ?? meta.paymentEventId ?? null,
          productStatusHistory: nextHistory,
        };
        await manager.getRepository(Order).save(order);
        await CartService.applyDeferredCheckoutSideEffects(manager, order);

        // Mark sibling multi-vendor orders paid when a combined checkout pays primary.
        const siblings = Array.isArray(meta.siblingOrderIds) ? meta.siblingOrderIds.map(String) : [];
        for (const siblingId of siblings) {
          const sibling = await manager.getRepository(Order).findOne({
            where: { id: siblingId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!sibling) continue;
          const sm = metaOf(sibling);
          if (sibling.status === 'paid' || String(sm.paymentStatus || '').toLowerCase() === 'paid') continue;
          const sh = history(sm);
          sh.push({ status: 'paid', at: now, actor: 'payment_provider', note: 'Paid with sibling checkout' });
          sibling.status = 'paid';
          sibling.metadata = {
            ...sm,
            paymentStatus: 'paid',
            paidAt: now,
            providerOrderId: payload.providerOrderId ?? sm.providerOrderId ?? null,
            providerPaymentId: payload.providerPaymentId ?? sm.providerPaymentId ?? null,
            productStatusHistory: sh,
          };
          await manager.getRepository(Order).save(sibling);
          await CartService.applyDeferredCheckoutSideEffects(manager, sibling);
        }
      } else {
        nextHistory.push({ status: 'payment_failed', at: now, actor: 'payment_provider' });
        order.metadata = {
          ...meta,
          paymentStatus: 'failed',
          paymentFailedAt: now,
          failureReason: payload.failureReason ?? null,
          providerOrderId: payload.providerOrderId ?? meta.providerOrderId ?? null,
          productStatusHistory: nextHistory,
        };
        await manager.getRepository(Order).save(order);
      }
      return {
        orderId: order.id,
        status: order.status,
        paymentStatus: (order.metadata as JsonRecord)?.paymentStatus ?? null,
      };
    });
  }

  /** Create / retry an online payment intent for an unpaid product order. */
  async createPayment(customerId: string, orderId: string, authorization?: string) {
    const order = await this.ownedOrder(customerId, orderId);
    const meta = metaOf(order);
    const paymentMode = String(meta.paymentMode || '').toLowerCase();
    if (paymentMode === 'cod' || String(meta.paymentStatus || '').toLowerCase() === 'cod') {
      throw new Error('COD orders do not require an online payment');
    }
    if (order.status === 'paid' || String(meta.paymentStatus || '').toLowerCase() === 'paid') {
      throw new Error('Order is already paid');
    }
    if (!['created', 'pending'].includes(String(order.status || '').toLowerCase()) &&
        String(meta.paymentStatus || '').toLowerCase() !== 'pending' &&
        String(meta.paymentStatus || '').toLowerCase() !== 'failed') {
      // Allow pay-retry while still unpaid
      if (!['created'].includes(String(order.status || '').toLowerCase())) {
        const ps = String(meta.paymentStatus || '').toLowerCase();
        if (ps !== 'pending' && ps !== 'failed') {
          throw new Error(`Order cannot be paid from status ${order.status}`);
        }
      }
    }
    if (!authorization) throw new Error('Authenticated payment creation is required');
    const baseUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8087';
    const siblingIds = Array.isArray(meta.siblingOrderIds) ? meta.siblingOrderIds.map(String) : [];
    const amount = Number(order.totalAmount);
    let payAmount = amount;
    if (siblingIds.length) {
      const siblings = siblingIds.length
        ? await AppDataSource.getRepository(Order).find({ where: { id: In(siblingIds) } })
        : [];
      payAmount = amount + siblings.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    }
    const response = await axios.post(
      `${baseUrl}/api/v1/payments/intents`,
      {
        orderId: order.id,
        amount: String(Number(payAmount).toFixed(2)),
        currency: 'INR',
        metadata: {
          domain: 'product',
          orderType: 'product',
          productOrderId: order.id,
          siblingOrderIds: siblingIds,
          orderRef: order.orderRef,
        },
      },
      { headers: { Authorization: authorization }, timeout: 15000 },
    );
    const intent = response.data?.data ?? response.data;
    const providerOrderId = String(intent?.providerRef || '');
    if (!providerOrderId) throw new Error('Payment provider did not return an order reference');
    return {
      id: intent?.id ? String(intent.id) : null,
      providerIntentId: intent?.id ? String(intent.id) : null,
      providerOrderId,
      providerRef: providerOrderId,
      amount: Number(payAmount),
      currency: 'INR',
      status: 'pending',
      orderId: order.id,
    };
  }
}