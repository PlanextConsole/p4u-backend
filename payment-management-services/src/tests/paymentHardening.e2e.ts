import { AppDataSource } from '../config/database';
import { PaymentIntent } from '../entities/PaymentIntent';
import { PaymentService } from '../service/payment.service';

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Payment hardening assertion failed: ${message}`);
}

async function run() {
  process.env.PAYMENT_PROVIDER_MODE = 'test';
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(PaymentIntent);
  const suffix = Date.now().toString();
  const orderId = `hardening-${suffix}`;
  const raceOrderId = `hard-race-${suffix}`;
  const webhookOrderId = `hard-hook-${suffix}`;
  try {
    const captured = await repo.save(repo.create({ orderId, customerId: 'hardening-customer', amount: '100.00', currency: 'INR',
      status: 'captured', providerRef: `order_${suffix}`, providerPaymentId: `pay_${suffix}`, providerSignature: null,
      metadata: { foodOrderId: orderId } }));
    const service = new PaymentService();
    const retries = await Promise.all([
      service.refundPayment({ orderId, amount: '100.00', reason: 'same-request' }),
      service.refundPayment({ orderId, amount: '100.00', reason: 'same-request' }),
    ]);
    check(retries[0].providerRefundId === retries[1].providerRefundId, 'identical concurrent refunds share one provider reference');
    const afterRetry = await repo.findOneByOrFail({ id: captured.id });
    check(((afterRetry.metadata as any).refunds || []).length === 1, 'identical concurrent refund persisted once');

    const refundId = retries[0].providerRefundId;
    const refundPayload = { event: 'refund.processed', payload: { refund: { entity: {
      id: refundId, payment_id: captured.providerPaymentId, receipt: retries[0].receipt, status: 'processed', amount: 10000,
    } } } };
    const firstRefundWebhook: any = await service.handleRazorpayWebhook(refundPayload, `evt-refund-a-${suffix}`);
    const replayRefundWebhook: any = await service.handleRazorpayWebhook(refundPayload, `evt-refund-b-${suffix}`);
    check(firstRefundWebhook.updated === true && replayRefundWebhook.duplicate === true,
      'refund webhook is semantically idempotent across different event ids');

    await repo.save(repo.create({ orderId: webhookOrderId, customerId: 'hardening-customer', amount: '50.00', currency: 'INR',
      status: 'created', providerRef: `order_hook_${suffix}`, providerPaymentId: null, providerSignature: null,
      metadata: { foodOrderId: webhookOrderId } }));
    const paymentPayload = { event: 'payment.captured', payload: { payment: { entity: {
      order_id: `order_hook_${suffix}`, id: `pay_hook_${suffix}`,
    } } } };
    const firstPaymentWebhook: any = await service.handleRazorpayWebhook(paymentPayload, `evt-pay-a-${suffix}`);
    const replayPaymentWebhook: any = await service.handleRazorpayWebhook(paymentPayload, `evt-pay-b-${suffix}`);
    check(firstPaymentWebhook.updated === true && replayPaymentWebhook.duplicate === true,
      'payment webhook is semantically idempotent across different event ids');
    const lateFailure: any = await service.handleRazorpayWebhook({ event: 'payment.failed', payload: { payment: { entity: {
      order_id: `order_hook_${suffix}`, id: `pay_hook_${suffix}`,
    } } } }, `evt-pay-failed-${suffix}`);
    check(lateFailure.ignored === 'captured_payment_cannot_fail', 'late failure cannot downgrade a captured payment');

    const race = await repo.save(repo.create({ orderId: raceOrderId, customerId: 'hardening-customer', amount: '100.00', currency: 'INR',
      status: 'captured', providerRef: `order_race_${suffix}`, providerPaymentId: `pay_race_${suffix}`, providerSignature: null,
      metadata: { foodOrderId: raceOrderId } }));
    const competing = await Promise.allSettled([
      service.refundPayment({ orderId: raceOrderId, amount: '100.00', reason: 'race-a' }),
      service.refundPayment({ orderId: raceOrderId, amount: '100.00', reason: 'race-b' }),
    ]);
    check(competing.filter(result => result.status === 'fulfilled').length === 1 &&
      competing.filter(result => result.status === 'rejected').length === 1,
      'different concurrent refunds cannot exceed the captured amount');
    const afterRace = await repo.findOneByOrFail({ id: race.id });
    check(((afterRace.metadata as any).refunds || []).length === 1, 'refund race persisted a single provider refund');
    console.log(JSON.stringify({ result: 'PASS', identicalRetry: true, semanticReplay: true, refundRace: true }));
  } finally {
    await repo.createQueryBuilder().delete().where('order_id IN (:...ids)', { ids: [orderId, raceOrderId, webhookOrderId] }).execute();
    await AppDataSource.destroy();
  }
}

run().catch(async error => {
  console.error(error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exit(1);
});