import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { Vendor } from '../entities/Vendor';
import { enrichBookingForVendorPortal, enrichBookingsForVendorPortal } from './bookingEnrichment';

function bookingMeta(row: Booking): Record<string, any> {
  return row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
}

function completionOtp(bookingId: string, nonce: string): string {
  const secret = process.env.SERVICE_COMPLETION_OTP_SECRET;
  if (!secret) throw new Error('Service completion OTP secret is not configured');
  const hex = createHmac('sha256', secret).update(`${bookingId}:${nonce}`).digest('hex').slice(0, 12);
  return String(parseInt(hex, 16) % 1000000).padStart(6, '0');
}
export class VendorBookingsService {
  private repo = AppDataSource.getRepository(Booking);
  private readonly approvableStatuses = new Set(['pending']);
  private readonly terminalStatuses = new Set(['cancelled', 'completed', 'rejected']);

  private async assertServiceVendor(vendorId: string): Promise<void> {
    const v = await AppDataSource.getRepository(Vendor).findOne({ where: { id: vendorId } });
    if (!v) throw new Error('Vendor not found');
    const vk = String(v.vendorKind || '').toLowerCase();
    const vt = String(v.vendorType || '').toUpperCase();
    if (vk !== 'service' && vt !== 'SERVICE') {
      throw new Error('Bookings are only available for service vendors');
    }
  }

  async listForVendor(vendorId: string, limit: number, offset: number, status?: string) {
    await this.assertServiceVendor(vendorId);
    const where: Record<string, string> = { vendorId };
    if (status?.trim()) where.status = status.trim();
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    const enriched = await enrichBookingsForVendorPortal(items);
    return { items: enriched, total, limit, offset };
  }

  async getForVendor(vendorId: string, bookingId: string): Promise<Booking | null> {
    await this.assertServiceVendor(vendorId);
    const row = await this.repo.findOne({ where: { id: bookingId, vendorId } });
    if (!row) return null;
    return enrichBookingForVendorPortal(row);
  }

  async updateStatusForVendor(vendorId: string, bookingId: string, nextStatus: string): Promise<Booking> {
    await this.assertServiceVendor(vendorId);
    const status = String(nextStatus || '').trim().toLowerCase();
    const allowed = new Set(['approved', 'rejected', 'in_progress', 'completed', 'cancelled']);
    if (!allowed.has(status)) throw new Error(`Invalid status: ${status}`);

    const row = await this.repo.findOne({ where: { id: bookingId, vendorId } });
    if (!row) throw new Error('Booking not found');

    const current = String(row.status || '').toLowerCase();
    if (this.terminalStatuses.has(current)) {
      throw new Error(`Cannot change booking from status ${current}`);
    }

    if (status === 'approved' || status === 'rejected') {
      if (!this.approvableStatuses.has(current)) {
        throw new Error(`Cannot ${status} booking from status ${current}`);
      }
    } else if (status === 'in_progress') {
      if (current !== 'approved') throw new Error('Only approved bookings can move to in_progress');
    } else if (status === 'completed') {
      if (current !== 'approved' && current !== 'in_progress') {
        throw new Error('Only approved or in_progress bookings can be completed');
      }
    } else if (status === 'cancelled') {
      if (current === 'pending') throw new Error('Reject pending bookings instead of cancelling');
      if (current !== 'approved' && current !== 'in_progress') {
        throw new Error('Only approved or in_progress bookings can be cancelled');
      }
    }

    row.status = status;
    const saved = await this.repo.save(row);
    return enrichBookingForVendorPortal(saved);
  }

  async submitCompletionProof(vendorId: string, bookingId: string, input: Record<string, any>) {
    await this.assertServiceVendor(vendorId);
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Booking);
      const row = await repo.findOne({ where: { id: bookingId, vendorId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new Error('Booking not found');
      const meta = bookingMeta(row); const existing = meta.completionProof as Record<string, any> | undefined;
      if (row.status === 'completion_pending' && existing?.otpNonce) return { ...row, duplicate: true };
      if (row.status !== 'in_progress') throw new Error('Only in-progress bookings can submit completion proof');
      const photoUrls = Array.isArray(input.photoUrls) ? input.photoUrls.map(String).filter(Boolean).slice(0, 5) : [];
      if (!photoUrls.length) throw new Error('At least one completion photo is required');
      const nonce = randomUUID(); const now = new Date();
      meta.completionProof = { status: 'awaiting_customer_otp', photoUrls, notes: String(input.notes || '').trim(), submittedAt: now.toISOString(), otpNonce: nonce, otpExpiresAt: new Date(now.getTime() + 15 * 60000).toISOString(), attempts: 0 };
      row.status = 'completion_pending'; row.metadata = meta;
      const saved = await repo.save(row); return { ...saved, metadata: { ...meta, completionProof: { ...(meta.completionProof as any), otpNonce: undefined } } };
    });
  }

  async verifyCompletionOtp(vendorId: string, bookingId: string, otp: string) {
    await this.assertServiceVendor(vendorId);
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Booking);
      const row = await repo.findOne({ where: { id: bookingId, vendorId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new Error('Booking not found');
      const meta = bookingMeta(row); const proof = { ...(meta.completionProof || {}) } as Record<string, any>;
      if (row.status === 'completion_pending_confirmation' && proof.otpVerifiedAt) return { ...row, duplicate: true };
      if (row.status !== 'completion_pending' || !proof.otpNonce) throw new Error('Completion proof must be submitted first');
      if (Date.now() > new Date(proof.otpExpiresAt).getTime()) throw new Error('Completion OTP has expired');
      const attempts = Number(proof.attempts || 0);
      if (attempts >= 5) throw new Error('Too many invalid OTP attempts');
      const expected = Buffer.from(completionOtp(bookingId, String(proof.otpNonce)));
      const supplied = Buffer.from(String(otp || '').trim());
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        proof.attempts = attempts + 1; row.metadata = { ...meta, completionProof: proof }; await repo.save(row); throw new Error('Invalid completion OTP');
      }
      proof.status = 'otp_verified'; proof.otpVerifiedAt = new Date().toISOString(); delete proof.otpNonce;
      row.status = 'completion_pending_confirmation'; row.metadata = { ...meta, completionProof: proof };
      return repo.save(row);
    });
  }}
