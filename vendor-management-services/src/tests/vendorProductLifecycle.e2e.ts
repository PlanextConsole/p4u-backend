import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';
import { VendorPortalService } from '../service/vendorPortal.service';

async function main() {
  const vendorId = randomUUID();
  const shippedId = randomUUID();
  const returnId = randomUUID();
  await AppDataSource.initialize();
  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS commerce_orders (`+
    `id varchar(36) NOT NULL PRIMARY KEY, vendor_id varchar(36) NULL, customer_id varchar(36) NULL, order_ref varchar(64) NULL,`+
    `status varchar(64) NOT NULL DEFAULT 'created', total_amount decimal(12,2) NOT NULL DEFAULT 0, metadata json NULL,`+
    `created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),`+
    `INDEX IDX_commerce_order_vendor (vendor_id), INDEX IDX_commerce_order_customer (customer_id), INDEX IDX_commerce_order_status (status)`+
  `) ENGINE=InnoDB`);
  const repo = AppDataSource.getRepository(Order);
  const service = new VendorPortalService();
  try {
    await repo.save([
      repo.create({ id: shippedId, vendorId, customerId: randomUUID(), orderRef: `SHIP-${shippedId.slice(0, 8)}`, status: 'in_progress', totalAmount: '250.00', metadata: { items: [{ title: 'Test item', qty: 1 }] } }),
      repo.create({ id: returnId, vendorId, customerId: randomUUID(), orderRef: `RETURN-${returnId.slice(0, 8)}`, status: 'return_requested', totalAmount: '300.00', metadata: { returnRequest: { id: randomUUID(), status: 'requested', reason: 'Damaged product', refundAmount: 300, refundStatus: 'not_started' }, productStatusHistory: [] } }),
    ]);
    let shippingRejected = false;
    try { await service.updateOrderForVendor(shippedId, vendorId, { status: 'shipped', metadata: { shipping_type: 'courier' } }); }
    catch { shippingRejected = true; }
    if (!shippingRejected) throw new Error('Incomplete courier shipment was accepted');
    const shipped: any = await service.updateOrderForVendor(shippedId, vendorId, { status: 'shipped', metadata: { shipping_type: 'courier', courier_name: 'Test Courier', tracking_number: `AWB-${shippedId.slice(0, 8)}` } });
    if (shipped.status !== 'shipped') throw new Error('Valid shipment was not accepted');
    const approved: any = await service.updateReturnForVendor(returnId, vendorId, 'approve', 'Approved after inspection');
    const received: any = await service.updateReturnForVendor(returnId, vendorId, 'received', 'Parcel received');
    if (approved.status !== 'return_approved' || received.status !== 'returned') throw new Error('Vendor return lifecycle failed');
    console.log(JSON.stringify({ result: 'PASS', shippingValidation: true, returnApproved: true, returnReceived: true }));
  } finally {
    try { await repo.delete([shippedId, returnId]); } finally { await AppDataSource.destroy(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });