import { createHmac } from 'crypto';
import { AppDataSource } from '../config/database';
import { ensureFoodSchema } from '../config/ensureFoodSchema';
import { FoodService } from '../service/food.service';
import { FoodPhase2Service } from '../service/foodPhase2.service';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(`E2E assertion failed: ${message}`); }
async function run() {
  process.env.FOOD_PAYMENT_MODE = 'test';
  await AppDataSource.initialize(); await ensureFoodSchema();
  await AppDataSource.query('UPDATE food_riders SET is_online = false');
  const food = new FoodService(); const phase2 = new FoodPhase2Service(); const suffix = Date.now().toString();
  const vendorId = `vendor-${suffix}`; const customerId = `customer-${suffix}`; const riderUserId = `rider-${suffix}`;
  const restaurant = await food.saveVendorRestaurant(vendorId, { name: `E2E Kitchen ${suffix}`, address: 'MG Road, Bengaluru',
    latitude: 12.9716, longitude: 77.5946, status: 'open', isActive: true, cuisine: ['South Indian'], packagingFee: 10, minOrderAmount: 50 });
  const category = await food.saveCategory(vendorId, { name: 'Meals' });
  const item = await food.saveMenuItem(vendorId, { name: 'Parity Thali', categoryId: category.id, price: 180, discountedPrice: 160,
    gstRate: 5, inStock: true, isVeg: true, addons: [{ id: 'extra-curd', name: 'Extra curd', price: 20 }],
    customizations: [{ id: 'spice', name: 'Spice', options: ['mild', 'medium', 'hot'] }] });
  const combo = await phase2.saveCombo(restaurant.id, { name: 'Parity Combo', itemIds: [item.id], price: 150 });
  check(combo?.id && (await phase2.listCombos(restaurant.id)).length > 0, 'menu combo created and discoverable');
  const coupon = await phase2.saveCoupon({ code: `E2E${suffix}`, title: 'E2E discount', discountType: 'flat', discountValue: 25,
    minOrderAmount: 100, restaurantId: restaurant.id, perCustomerLimit: 2, totalUsageLimit: 5, isActive: true });
  check(coupon?.id, 'coupon created');
  const rider = await phase2.saveRiderProfile(riderUserId, { name: 'E2E Rider', phone: '9000000000', vehicleType: 'bike', vehicleNumber: 'KA01E2E' });
  await phase2.approveRider(rider.id, true); await phase2.setRiderOnline(riderUserId, true); await phase2.updateRiderLocation(riderUserId, 12.972, 77.595);

  const codOrder = await food.placeOrder(customerId, { restaurantId: restaurant.id, items: [{ menuItemId: item.id, quantity: 1,
    addonIds: ['extra-curd'], customizations: { spice: 'medium' } }], deliveryAddress: 'Brigade Road, Bengaluru',
    deliveryLat: 12.975, deliveryLng: 77.600, paymentMethod: 'cod', couponCode: coupon.code, customerName: 'E2E Customer' });
  check(Number(codOrder.discount) === 25, 'coupon applied to COD checkout');
  await food.changeVendorOrderStatus(vendorId, codOrder.id, 'accepted'); await food.changeVendorOrderStatus(vendorId, codOrder.id, 'preparing');
  await food.changeVendorOrderStatus(vendorId, codOrder.id, 'ready'); const assignment = await phase2.autoAssign(codOrder.id);
  check(assignment.rider_id === rider.id, 'nearest verified online rider assigned');
  await phase2.respondToAssignment(riderUserId, assignment.id, true); await phase2.pickup(riderUserId, assignment.id);
  let wrongOtpRejected = false; try { await phase2.deliver(riderUserId, assignment.id, '0000'); } catch { wrongOtpRejected = true; }
  check(wrongOtpRejected, 'incorrect handover OTP rejected'); await phase2.deliver(riderUserId, assignment.id, codOrder.handoverOtp);
  const delivered = await food.getCustomerOrder(customerId, codOrder.id); check(delivered?.status === 'delivered' && delivered.paymentStatus === 'paid', 'COD delivered and marked paid');
  const invoice = await phase2.getInvoice(customerId, codOrder.id); check(invoice?.invoice_no, 'invoice generated'); const invoicePdf=await phase2.getInvoicePdf(customerId,codOrder.id); check(invoicePdf.subarray(0,5).toString()==='%PDF-', 'downloadable invoice is a PDF');
  const settlements = await phase2.listRiderSettlements('pending'); const settlement = settlements.find((row: any) => row.assignment_id === assignment.id);
  check(settlement?.id, 'rider settlement accrued'); await phase2.completeRiderSettlement(settlement.id, `E2E-TXN-${suffix}`);
  const review = await food.createReview(customerId, codOrder.id, { foodRating: 5, deliveryRating: 5, comment: 'Verified E2E delivery' }); check(review.id, 'review created');

  const competing = await Promise.allSettled([
    food.placeOrder(customerId, { restaurantId: restaurant.id, items: [{ comboId: combo.id, quantity: 1 }], deliveryAddress: 'Combo address', paymentMethod: 'cod', couponCode: coupon.code }),
    food.placeOrder(customerId, { restaurantId: restaurant.id, items: [{ menuItemId: item.id, quantity: 1 }], deliveryAddress: 'Limit address', paymentMethod: 'cod', couponCode: coupon.code }),
  ]);
  check(competing.filter(result => result.status === 'fulfilled').length === 1 && competing.filter(result => result.status === 'rejected').length === 1,
    'coupon per-customer limit remains atomic under concurrent combo checkout');
  const comboOrder = (competing.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
  check(comboOrder.items[0].comboId === combo.id && Number(comboOrder.items[0].unitPrice) === 150, 'combo ordered at server price');
  await food.cancelCustomerOrder(customerId, comboOrder.id, 'E2E combo cleanup');
  const onlineOrder = await food.placeOrder(customerId, { restaurantId: restaurant.id, items: [{ menuItemId: item.id, quantity: 1 }],
    deliveryAddress: 'Church Street, Bengaluru', deliveryLat: 12.976, deliveryLng: 77.602, paymentMethod: 'upi' });
  const payment = await phase2.createPayment(customerId, onlineOrder.id); const webhook = { providerOrderId: payment.providerOrderId,
    providerPaymentId: `pay_${suffix}`, status: 'success' }; process.env.FOOD_PAYMENT_WEBHOOK_SECRET = 'food-e2e-secret';
  const signature = createHmac('sha256', process.env.FOOD_PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(webhook)).digest('hex');
  await phase2.processPaymentWebhook(webhook, signature); const duplicateWebhook = await phase2.processPaymentWebhook(webhook, signature); check(duplicateWebhook.duplicate === true, 'duplicate payment webhook is idempotent');
  const failedWebhook = { ...webhook, status: 'failed' }; const failedSignature = createHmac('sha256', process.env.FOOD_PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(failedWebhook)).digest('hex');
  const downgrade = await phase2.processPaymentWebhook(failedWebhook, failedSignature); check(downgrade.ignored === true, 'captured payment cannot be downgraded by late failure'); const paid = await food.getCustomerOrder(customerId, onlineOrder.id); check(paid?.paymentStatus === 'paid', 'online payment webhook captured');
  await food.cancelCustomerOrder(customerId, onlineOrder.id, 'E2E refund validation');
  const refundAttempts = await Promise.allSettled([
    phase2.initiateRefund(onlineOrder.id, 'e2e-admin', { reason: 'cancelled-a', refundMethod: 'original' }),
    phase2.initiateRefund(onlineOrder.id, 'e2e-admin', { reason: 'cancelled-b', refundMethod: 'original' }),
  ]);
  check(refundAttempts.filter(result => result.status === 'fulfilled').length === 1 && refundAttempts.filter(result => result.status === 'rejected').length === 1,
    'concurrent food refunds cannot exceed the paid order amount');
  const refund = (refundAttempts.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
  await phase2.completeRefund(refund.id, true, `rfnd_${suffix}`); const refunded = await food.getCustomerOrder(customerId, onlineOrder.id); check(refunded?.paymentStatus === 'refunded', 'refund completed');
  const tracking = await phase2.trackOrder(customerId, codOrder.id); check(tracking.status === 'delivered', 'tracking endpoint state');
  const scheduled = await food.placeOrder(customerId, { restaurantId: restaurant.id, items: [{ menuItemId: item.id, quantity: 1 }],
    deliveryAddress: 'Scheduled address', paymentMethod: 'cod', scheduledFor: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
  check(scheduled.scheduledFor != null, 'scheduled order timestamp stored'); await food.cancelCustomerOrder(customerId, scheduled.id, 'E2E scheduled cleanup');
  console.log(JSON.stringify({ restaurantId: restaurant.id, menuItemId: item.id, codOrderId: codOrder.id, assignmentId: assignment.id,
    invoiceNo: invoice.invoice_no, reviewId: review.id, onlineOrderId: onlineOrder.id, refundId: refund.id, result: 'PASS' }, null, 2));
  await AppDataSource.destroy();
}
run().catch(async error => { console.error(error); if (AppDataSource.isInitialized) await AppDataSource.destroy(); process.exit(1); });
