import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';
import { ProductLifecycleService } from '../service/productLifecycle.service';

async function main() {
  const id = randomUUID();
  const customerId = randomUUID();
  const vendorId = randomUUID();
  console.log("stage:init:start");
  await AppDataSource.initialize();
  console.log("stage:init:done");
  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS commerce_orders (`+
    `id varchar(36) NOT NULL PRIMARY KEY, vendor_id varchar(36) NULL, customer_id varchar(36) NULL, order_ref varchar(64) NULL,`+
    `status varchar(64) NOT NULL DEFAULT 'created', total_amount decimal(12,2) NOT NULL DEFAULT 0, metadata json NULL,`+
    `created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),`+
    `INDEX IDX_commerce_order_vendor (vendor_id), INDEX IDX_commerce_order_customer (customer_id), INDEX IDX_commerce_order_status (status)`+
  `) ENGINE=InnoDB`);
  const repo = AppDataSource.getRepository(Order);
  const service = new ProductLifecycleService();
  try {
    console.log("stage:save:start");
    await repo.save(repo.create({ id, customerId, vendorId, orderRef: `PROD-${id.slice(0, 8)}`, status: 'shipped', totalAmount: '499.00', metadata: {
      shipping_type: 'courier', courier_name: 'Test Courier', tracking_number: `AWB-${id.slice(0, 8)}`, shippedAt: new Date().toISOString(),
      productStatusHistory: [{ status: 'shipped', at: new Date().toISOString(), actor: 'vendor' }],
    } }));
    console.log("stage:save:done");
    const tracking = await service.tracking(customerId, id);
    if (tracking.trackingNumber !== `AWB-${id.slice(0, 8)}`) throw new Error('Tracking data was not preserved');
    console.log("stage:tracking:done");
    const confirmed = await service.confirmDelivery(customerId, id);
    const duplicateConfirmation: any = await service.confirmDelivery(customerId, id);
    if (confirmed.status !== 'delivered' || duplicateConfirmation.duplicate !== true) throw new Error('Delivery confirmation is not idempotent');
    console.log("stage:confirm:done", confirmed.status, duplicateConfirmation.status, (await repo.findOneByOrFail({ id })).status);
    const returnA: any = await service.requestReturn(customerId, id, { reason: 'Item arrived damaged' });
    const returnB: any = await service.requestReturn(customerId, id, { reason: 'Item arrived damaged' });
    if (returnA.id !== returnB.id) throw new Error('Concurrent return request created duplicates');
    console.log("stage:return:done");
    const row = await repo.findOneByOrFail({ id });
    const meta: any = { ...(row.metadata || {}) };
    meta.returnRequest = { ...meta.returnRequest, status: 'approved' };
    row.metadata = meta;
    row.status = 'return_approved';
    await repo.save(row);
    console.log("stage:approve:done");
    const refund = await service.applyRefundResult(id, `rfnd_${id.slice(0, 10)}`, 'processed');
    const refundReplay: any = await service.applyRefundResult(id, `rfnd_${id.slice(0, 10)}`, 'processed');
    if (refund.refundStatus !== 'completed' || refundReplay.duplicate !== true) throw new Error('Refund replay is not idempotent');
    console.log(JSON.stringify({ result: 'PASS', orderId: id, tracking: true, duplicateConfirmation: true, idempotentReturn: true, refundReplay: true }));
  } finally {
    try { await repo.delete({ id }); } finally { await AppDataSource.destroy(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });