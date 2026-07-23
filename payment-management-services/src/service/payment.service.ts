import { AppDataSource } from '../config/database';
import { PaymentIntent } from '../entities/PaymentIntent';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import axios from 'axios';

export class PaymentService {
  private readonly razorpay: Razorpay | null;

  constructor() {
    const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
    const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (key_id && key_secret) {
      this.razorpay = new Razorpay({ key_id, key_secret });
    } else {
      this.razorpay = null;
      console.warn(
        '[payment] Razorpay disabled: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable intents (see .env.example).'
      );
    }
  }

  private getRazorpay(): Razorpay {
    if (!this.razorpay) {
      throw new Error(
        'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment.'
      );
    }
    return this.razorpay;
  }

  private toSubunits(amount: string): number {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid amount');
    return Math.round(parsed * 100);
  }

  async createIntent(input: {
    orderId: string;
    customerId?: string | null;
    amount: string;
    currency?: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const repo = AppDataSource.getRepository(PaymentIntent);
    const currency = input.currency || 'INR';
    const razorpayOrder: any = process.env.PAYMENT_PROVIDER_MODE === 'test'
      ? { id: `order_test_${crypto.randomBytes(10).toString('hex')}` }
      : await this.getRazorpay().orders.create({ amount: this.toSubunits(input.amount), currency, receipt: input.orderId,
          notes: { orderId: input.orderId, customerId: input.customerId || '' } });
    const row = repo.create({
      orderId: input.orderId,
      customerId: input.customerId ?? null,
      amount: input.amount,
      currency,
      status: 'created',
      providerRef: razorpayOrder.id,
      providerPaymentId: null,
      providerSignature: null,
      metadata: input.metadata ?? null,
    });
    return repo.save(row);
  }

  async getIntent(id: string) {
    return AppDataSource.getRepository(PaymentIntent).findOne({ where: { id } });
  }

  async verifyPayment(input: { orderId: string; paymentId: string; signature: string }) {
    const generated = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

    const verified = generated === input.signature;
    if (!verified) return { verified: false };

    const repo = AppDataSource.getRepository(PaymentIntent);
    const row = await repo.findOne({ where: { providerRef: input.orderId } });
    if (row) {
      row.status = 'captured';
      row.providerPaymentId = input.paymentId;
      row.providerSignature = input.signature;
      await repo.save(row);

      const metadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, any>;
      const productOrderId = String(
        metadata.productOrderId || (metadata.orderType === 'product' || metadata.domain === 'product' ? row.orderId : '') || '',
      ).trim();
      if (productOrderId) {
        const secret =
          process.env.PRODUCT_PAYMENT_WEBHOOK_SECRET || process.env.FOOD_PAYMENT_WEBHOOK_SECRET || '';
        if (secret) {
          const callback = JSON.stringify({
            eventId: `verify_${row.id}`,
            productOrderId,
            providerOrderId: input.orderId,
            providerPaymentId: input.paymentId,
            status: 'success',
          });
          try {
            await axios.post(
              `${process.env.COMMERCE_SERVICE_URL || 'http://localhost:8086'}/api/v1/commerce/product-payments/webhook`,
              callback,
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-product-signature': crypto.createHmac('sha256', secret).update(callback).digest('hex'),
                },
                timeout: 15000,
              },
            );
          } catch (error) {
            console.error('[payment] product paid callback after verify failed:', error);
          }
        }
      }
    }
    return { verified: true, intentId: row?.id ?? null };
  }

  async refundPayment(input: { orderId: string; amount: string; reason?: string }) {
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(PaymentIntent);
      const row = await repo.findOne({
        where: { orderId: input.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || !row.providerPaymentId) throw new Error('Captured payment not found for refund');
      const requested = Number(input.amount);
      const paid = Number(row.amount);
      if (!Number.isFinite(requested) || requested <= 0) throw new Error('Invalid refund amount');
      const existing = Array.isArray((row.metadata as any)?.refunds) ? (row.metadata as any).refunds : [];
      const key = `${input.orderId}:${requested.toFixed(2)}:${input.reason || ''}`;
      const duplicate = existing.find((refund: any) => refund.idempotencyKey === key);
      if (duplicate) return { ...duplicate, duplicate: true };
      if (!['captured', 'partially_refunded'].includes(row.status)) throw new Error('Captured payment not found for refund');
      const reserved = existing.filter((refund: any) => ['pending', 'processed'].includes(String(refund.status)))
        .reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0);
      if (requested > paid - reserved + 0.00001) throw new Error('Refund amount exceeds remaining captured amount');
      const receipt = `p4u_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
      let providerRefund: any;
      if (process.env.PAYMENT_PROVIDER_MODE === 'test') {
        providerRefund = { id: `rfnd_test_${crypto.randomBytes(10).toString('hex')}`, status: 'processed', receipt };
      } else {
        const razorpay = this.getRazorpay();
        const prior: any = await razorpay.payments.fetchMultipleRefund(row.providerPaymentId, { count: 100 });
        providerRefund = (prior?.items || []).find((refund: any) => refund.receipt === receipt);
        if (!providerRefund) {
          providerRefund = await razorpay.payments.refund(row.providerPaymentId, {
            amount: this.toSubunits(input.amount),
            speed: 'normal',
            receipt,
            notes: { orderId: input.orderId, reason: input.reason || 'food_refund' },
          });
        }
      }
      const status = ['processed', 'pending', 'failed'].includes(String(providerRefund.status))
        ? String(providerRefund.status)
        : 'pending';
      const result = {
        providerRefundId: String(providerRefund.id),
        receipt,
        amount: requested,
        status,
        idempotencyKey: key,
        createdAt: new Date().toISOString(),
      };
      const refunds = [...existing, result];
      row.metadata = { ...(row.metadata || {}), refunds };
      const processed = refunds.filter((refund: any) => refund.status === 'processed')
        .reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0);
      if (processed >= paid - 0.00001) row.status = 'refunded';
      else if (processed > 0) row.status = 'partially_refunded';
      await repo.save(row);
      return result;
    });
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!secret || !signature) return false;
    const generated = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return generated === signature;
  }

  async handleRazorpayWebhook(payload: any, eventId?: string) {
    const event = String(payload?.event || '');
    const paymentEntity = payload?.payload?.payment?.entity;
    const refundEntity = payload?.payload?.refund?.entity;
    if (event.startsWith('refund.')) {
      const refundId = String(refundEntity?.id || '');
      const paymentId = String(refundEntity?.payment_id || '');
      const refundStatus = event === 'refund.processed' ? 'processed' : event === 'refund.failed' ? 'failed' : '';
      if (!refundId || !paymentId || !refundStatus) return { received: true, updated: false };
      return AppDataSource.transaction(async manager => {
        const repo = manager.getRepository(PaymentIntent);
        const row = await repo.findOne({ where: { providerPaymentId: paymentId }, lock: { mode: 'pessimistic_write' } });
        if (!row) return { received: true, updated: false };
        const metadata: any = row.metadata || {};
        const processedKeys = Array.isArray(metadata.processedWebhookIds) ? metadata.processedWebhookIds : [];
        const eventKey = eventId ? `event:${eventId}` : '';
        const semanticKey = `semantic:${event}:${refundId}:${refundStatus}`;
        if ((eventKey && processedKeys.includes(eventKey)) || processedKeys.includes(semanticKey)) {
          return { received: true, updated: false, duplicate: true };
        }
        const refunds = Array.isArray(metadata.refunds) ? metadata.refunds.map((refund: any) => ({ ...refund })) : [];
        const refund = refunds.find((candidate: any) => candidate.providerRefundId === refundId ||
          (refundEntity?.receipt && candidate.receipt === refundEntity.receipt));
        if (!refund) return { received: true, updated: false, ignored: 'refund_not_tracked' };
        refund.providerRefundId = refundId;
        refund.status = refundStatus;
        refund.updatedAt = new Date().toISOString();
        const keys = [...processedKeys, ...(eventKey ? [eventKey] : []), semanticKey].slice(-200);
        row.metadata = { ...metadata, refunds, processedWebhookIds: keys, lastWebhookEvent: event, webhookReceivedAt: new Date().toISOString() };
        const paid = Number(row.amount);
        const refunded = refunds.filter((candidate: any) => candidate.status === 'processed')
          .reduce((sum: number, candidate: any) => sum + Number(candidate.amount || 0), 0);
        row.status = refunded >= paid - 0.00001 ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'captured';
        await repo.save(row);
        return { received: true, updated: true, eventType: 'refund', intentId: row.id,
          providerRefundId: refundId, status: refundStatus, foodOrderId: metadata.foodOrderId || null,
          productOrderId: metadata.productOrderId || (metadata.orderType === 'product' ? row.orderId : null),
          eventId: eventId || null };
      });
    }
    const orderId = String(paymentEntity?.order_id || '');
    const paymentId = String(paymentEntity?.id || '');
    if (!orderId || !['payment.captured', 'payment.failed'].includes(event)) return { received: true, updated: false };
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(PaymentIntent);
      const row = await repo.findOne({ where: { providerRef: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!row) return { received: true, updated: false };
      const metadata: any = row.metadata || {};
      const processedKeys = Array.isArray(metadata.processedWebhookIds) ? metadata.processedWebhookIds : [];
      const eventKey = eventId ? `event:${eventId}` : '';
      const semanticKey = `semantic:${event}:${orderId}:${paymentId}`;
      if ((eventKey && processedKeys.includes(eventKey)) || processedKeys.includes(semanticKey)) {
        return { received: true, updated: false, duplicate: true };
      }
      if (row.status === 'captured' && event === 'payment.failed') {
        return { received: true, updated: false, ignored: 'captured_payment_cannot_fail' };
      }
      if (row.providerPaymentId && paymentId && row.providerPaymentId !== paymentId) throw new Error('Payment reference mismatch');
      row.status = event === 'payment.captured' ? 'captured' : 'failed';
      row.providerPaymentId = paymentId || row.providerPaymentId;
      row.metadata = { ...metadata, lastWebhookEvent: event, webhookReceivedAt: new Date().toISOString(),
        processedWebhookIds: [...processedKeys, ...(eventKey ? [eventKey] : []), semanticKey].slice(-200) };
      await repo.save(row);
      return { received: true, updated: true, eventType: 'payment', intentId: row.id, providerOrderId: orderId,
        providerPaymentId: paymentId, status: row.status, foodOrderId: metadata.foodOrderId || null,
        productOrderId: metadata.productOrderId || (metadata.orderType === 'product' ? row.orderId : null),
        eventId: eventId || null };
    });
  }
}