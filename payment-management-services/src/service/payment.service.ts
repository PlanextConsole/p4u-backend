import { AppDataSource } from '../config/database';
import { PaymentIntent } from '../entities/PaymentIntent';
import Razorpay from 'razorpay';
import crypto from 'crypto';

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
    const razorpayOrder = await this.getRazorpay().orders.create({
      amount: this.toSubunits(input.amount),
      currency,
      receipt: input.orderId,
      notes: {
        orderId: input.orderId,
        customerId: input.customerId || '',
      },
    });

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
    }
    return { verified: true, intentId: row?.id ?? null };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const generated = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return generated === signature;
  }

  async handleRazorpayWebhook(payload: any) {
    const event = String(payload?.event || '');
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = String(paymentEntity?.order_id || '');
    const paymentId = String(paymentEntity?.id || '');

    if (!orderId) return { received: true, updated: false };

    const repo = AppDataSource.getRepository(PaymentIntent);
    const row = await repo.findOne({ where: { providerRef: orderId } });
    if (!row) return { received: true, updated: false };

    if (event === 'payment.captured') row.status = 'captured';
    else if (event === 'payment.failed') row.status = 'failed';
    else row.status = row.status || 'created';

    row.providerPaymentId = paymentId || row.providerPaymentId;
    row.metadata = {
      ...(row.metadata || {}),
      lastWebhookEvent: event,
      webhookReceivedAt: new Date().toISOString(),
    };
    await repo.save(row);

    return { received: true, updated: true, intentId: row.id };
  }
}
