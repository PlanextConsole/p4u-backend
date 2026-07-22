import 'reflect-metadata';
import { createHmac, randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { VendorBookingsService } from '../service/vendorBookings.service';
const schema = `CREATE TABLE IF NOT EXISTS commerce_bookings (id varchar(36) NOT NULL PRIMARY KEY, customer_id varchar(36) NOT NULL, vendor_id varchar(36) NOT NULL, service_id varchar(36) NULL, booking_date date NOT NULL, time_slot varchar(32) NOT NULL, status varchar(32) NOT NULL DEFAULT 'pending', address_id varchar(36) NULL, notes text NULL, total_amount decimal(12,2) NOT NULL DEFAULT 0, metadata json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)) ENGINE=InnoDB`;
async function main() {
  process.env.SERVICE_COMPLETION_OTP_SECRET = 'service-lifecycle-e2e-secret';
  await AppDataSource.initialize(); await AppDataSource.query(schema);
  const repo = AppDataSource.getRepository(Booking); const svc = new VendorBookingsService(); (svc as any).assertServiceVendor = async () => undefined;
  const id = randomUUID(); const vendorId = randomUUID();
  try {
    await repo.save(repo.create({ id, customerId: randomUUID(), vendorId, serviceId: null, bookingDate: '2026-07-21', timeSlot: '11:00-12:00', status: 'in_progress', addressId: null, notes: null, totalAmount: '900.00', metadata: {} }));
    let missingPhotoRejected = false; try { await svc.submitCompletionProof(vendorId, id, { photoUrls: [] }); } catch { missingPhotoRejected = true; }
    if (!missingPhotoRejected) throw new Error('Missing completion photo was accepted');
    await svc.submitCompletionProof(vendorId, id, { photoUrls: ['https://example.test/completion.jpg'], notes: 'Work completed' });
    const pending = await repo.findOneByOrFail({ id }); const nonce = String((pending.metadata as any).completionProof.otpNonce);
    const hex = createHmac('sha256', process.env.SERVICE_COMPLETION_OTP_SECRET).update(`${id}:${nonce}`).digest('hex').slice(0, 12); const otp = String(parseInt(hex, 16) % 1000000).padStart(6, '0');
    let invalidRejected = false; try { await svc.verifyCompletionOtp(vendorId, id, '000000' === otp ? '111111' : '000000'); } catch { invalidRejected = true; }
    const verified: any = await svc.verifyCompletionOtp(vendorId, id, otp); const replay: any = await svc.verifyCompletionOtp(vendorId, id, otp);
    if (!invalidRejected || verified.status !== 'completion_pending_confirmation' || replay.duplicate !== true) throw new Error('Vendor OTP lifecycle failed');
    console.log(JSON.stringify({ result: 'PASS', photoRequired: true, invalidOtpRejected: true, otpVerified: true, replay: true }));
  } finally { try { await repo.delete({ id }); } finally { await AppDataSource.destroy(); } }
}
main().catch(error => { console.error(error); process.exitCode = 1; });