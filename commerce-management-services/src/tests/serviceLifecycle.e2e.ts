import 'reflect-metadata';
import { createHmac, randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { BookingService } from '../service/booking.service';

const schema = `CREATE TABLE IF NOT EXISTS commerce_bookings (id varchar(36) NOT NULL PRIMARY KEY, customer_id varchar(36) NOT NULL, vendor_id varchar(36) NOT NULL, service_id varchar(36) NULL, booking_date date NOT NULL, time_slot varchar(32) NOT NULL, status varchar(32) NOT NULL DEFAULT 'pending', address_id varchar(36) NULL, notes text NULL, total_amount decimal(12,2) NOT NULL DEFAULT 0, metadata json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX IDX_booking_customer (customer_id), INDEX IDX_booking_vendor (vendor_id), INDEX IDX_booking_status (status)) ENGINE=InnoDB`;

async function main() {
  process.env.SERVICE_COMPLETION_OTP_SECRET = 'service-lifecycle-e2e-secret';
  await AppDataSource.initialize(); await AppDataSource.query(schema);
  const repo = AppDataSource.getRepository(Booking); const svc = new BookingService();
  const customerId = randomUUID(); const vendorId = randomUUID(); const ids = [randomUUID(), randomUUID()];
  try {
    const nonce = randomUUID();
    await repo.save(repo.create({ id: ids[0], customerId, vendorId, serviceId: null, bookingDate: '2026-07-21', timeSlot: '09:00-10:00', status: 'completion_pending', addressId: null, notes: null, totalAmount: '750.00', metadata: { completionProof: { status: 'awaiting_customer_otp', otpNonce: nonce, otpExpiresAt: new Date(Date.now() + 600000).toISOString(), photoUrls: ['https://example.test/proof.jpg'] } } }));
    const otp = await svc.getCompletionOtp(customerId, ids[0]);
    const hex = createHmac('sha256', process.env.SERVICE_COMPLETION_OTP_SECRET).update(`${ids[0]}:${nonce}`).digest('hex').slice(0, 12);
    const expected = String(parseInt(hex, 16) % 1000000).padStart(6, '0');
    if (otp.otp !== expected) throw new Error('Customer OTP mismatch');
    const row = await repo.findOneByOrFail({ id: ids[0] }); row.status = 'completion_pending_confirmation'; row.metadata = { completionProof: { status: 'otp_verified', otpVerifiedAt: new Date().toISOString(), photoUrls: ['https://example.test/proof.jpg'] } }; await repo.save(row);
    const confirmed: any = await svc.confirmCompletion(customerId, ids[0], true); const replay: any = await svc.confirmCompletion(customerId, ids[0], true);
    if (confirmed.status !== 'completed' || replay.duplicate !== true) throw new Error('Customer confirmation replay failed');
    await repo.save(repo.create({ id: ids[1], customerId, vendorId, serviceId: null, bookingDate: '2026-07-21', timeSlot: '10:00-11:00', status: 'completed', addressId: null, notes: null, totalAmount: '500.00', metadata: { completionProof: { customerConfirmedAt: new Date().toISOString() } } }));
    const dispute: any = await svc.openDispute(customerId, ids[1], 'Service issue remains unresolved');
    const disputeReplay: any = await svc.openDispute(customerId, ids[1], 'Service issue remains unresolved');
    const resolved: any = await svc.resolveDisputeForAdmin(ids[1], 'customer', 'Customer evidence accepted');
    if (!dispute.id || disputeReplay.duplicate !== true || resolved.status !== 'dispute_resolved') throw new Error('Dispute lifecycle failed');
    console.log(JSON.stringify({ result: 'PASS', customerOtp: true, confirmationReplay: true, disputeReplay: true, adminResolution: true }));
  } finally { try { await repo.delete(ids); } finally { await AppDataSource.destroy(); } }
}
main().catch(error => { console.error(error); process.exitCode = 1; });