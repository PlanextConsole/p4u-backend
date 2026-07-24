import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { Vendor } from '../entities/Vendor';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { CustomerProfile } from '../entities/CustomerProfile';
import {
  buildSlotsForDate,
  mergeWithDefaults,
} from './bookingAvailabilitySlots';
import { enrichBookingForVendorPortal, enrichBookingsForVendorPortal } from './bookingEnrichment';

const LEGACY_TIME_SLOTS = [
  { label: 'Morning 9-11 AM', value: '09:00-11:00' },
  { label: 'Afternoon 12-3 PM', value: '12:00-15:00' },
  { label: 'Evening 4-6 PM', value: '16:00-18:00' },
];

function extractDurationMinutesFromServiceMeta(meta: Record<string, unknown> | null | undefined): number | null {
  if (!meta || typeof meta !== 'object') return null;
  const raw = meta.duration ?? meta.serviceDurationMinutes;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.min(480, Math.max(15, raw));
  const s = String(raw || '').trim();
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return Math.min(480, Math.max(15, n));
  return null;
}

function bookingMeta(row: Booking): Record<string, any> {
  return row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
}

function completionOtp(bookingId: string, nonce: string): string {
  const secret = process.env.SERVICE_COMPLETION_OTP_SECRET;
  if (!secret) throw new Error('Service completion OTP secret is not configured');
  const hex = createHmac('sha256', secret).update(`${bookingId}:${nonce}`).digest('hex').slice(0, 12);
  return String(parseInt(hex, 16) % 1000000).padStart(6, '0');
}
export class BookingService {
  private repo = AppDataSource.getRepository(Booking);
  private readonly approvableStatuses = new Set(['pending']);
  private readonly terminalStatuses = new Set(['cancelled', 'completed', 'rejected']);

  private async slotMinutesForService(serviceId: string | null | undefined, fallback: number): Promise<number> {
    const sid = String(serviceId || '').trim();
    if (!sid) return fallback;
    const row = await AppDataSource.getRepository(CatalogServiceItem).findOne({
      where: { id: sid },
      select: ['metadata'],
    });
    const m = extractDurationMinutesFromServiceMeta(row?.metadata ?? null);
    return m ?? fallback;
  }

  private async loadVendorAvailabilityRow(vendorId: string) {
    return AppDataSource.getRepository(Vendor).findOne({
      where: { id: vendorId },
      select: ['id', 'bookingAvailabilityJson'],
    });
  }

  async buildCandidateSlots(vendorId: string, date: string, serviceId?: string | null) {
    const v = await this.loadVendorAvailabilityRow(vendorId);
    const hasJson = v?.bookingAvailabilityJson != null && typeof v.bookingAvailabilityJson === 'object';
    const cfg = mergeWithDefaults(v?.bookingAvailabilityJson);
    const slotMin = await this.slotMinutesForService(serviceId, cfg.defaultSlotMinutes ?? 60);
    const existing = await this.repo.find({
      where: {
        vendorId,
        bookingDate: date,
        status: In(['pending', 'approved']),
      },
      select: ['timeSlot'],
    });
    const booked = existing.map((b) => b.timeSlot);
    const built = buildSlotsForDate(cfg, date, booked, slotMin);
    if (built.length > 0) return built;
    if (hasJson) return [];
    return LEGACY_TIME_SLOTS.map((s) => ({ label: s.label, value: s.value }));
  }

  async createBooking(customerId: string, data: Partial<Booking>): Promise<Booking> {
    const vendorId = String(data.vendorId || '');
    const bookingDate = String(data.bookingDate || '');
    const timeSlot = String(data.timeSlot || '');
    if (!vendorId || !bookingDate || !timeSlot) throw new Error('vendorId, bookingDate, timeSlot are required');

    const candidates = await this.buildCandidateSlots(vendorId, bookingDate, data.serviceId ?? null);
    const allowedValues = new Set(candidates.map((c) => c.value));
    if (!allowedValues.has(timeSlot)) throw new Error('Selected time slot is not available');

    const dup = await this.repo.count({
      where: { vendorId, bookingDate, timeSlot, status: In(['pending', 'approved']) },
    });
    if (dup > 0) throw new Error('That time slot is no longer available');

    const meta: Record<string, unknown> =
      data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
        ? { ...(data.metadata as Record<string, unknown>) }
        : {};
    const sid = String(data.serviceId || '').trim();
    if (sid) {
      const item = await AppDataSource.getRepository(CatalogServiceItem).findOne({
        where: { id: sid },
        select: ['id', 'name', 'metadata'],
      });
      if (item?.name && !meta.serviceName) meta.serviceName = item.name;
      if (!meta.serviceImage) {
        const m = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
        const img =
          (typeof (m as Record<string, unknown>).imageUrl === 'string'
            ? String((m as Record<string, unknown>).imageUrl)
            : null) ||
          (typeof (m as Record<string, unknown>).iconUrl === 'string'
            ? String((m as Record<string, unknown>).iconUrl)
            : null);
        if (img) meta.serviceImage = img;
      }
    }

    const row = this.repo.create({
      id: randomUUID(),
      ...data,
      customerId,
      status: 'pending',
      metadata: Object.keys(meta).length ? meta : null,
    });
    const saved = await this.repo.save(row);
    void BookingService.notifyVendorOfNewBooking(saved).catch(() => undefined);
    return saved;
  }

  /** Best-effort push when a customer books a service (mirrors CartService.notifyVendorsOfNewOrders). */
  static async notifyVendorOfNewBooking(booking: Booking) {
    const base = process.env.NOTIFICATION_SERVICE_URL || process.env.GATEWAY_INTERNAL_URL || '';
    if (!base || !booking.vendorId) return;
    const meta = bookingMeta(booking);
    const serviceName =
      (typeof meta.serviceName === 'string' && meta.serviceName.trim()) ||
      'Service booking';
    try {
      await fetch(`${String(base).replace(/\/$/, '')}/api/v1/notifications/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: booking.vendorId,
          title: 'New booking received',
          body: `${serviceName} · ${booking.bookingDate} ${booking.timeSlot || ''} — ₹${booking.totalAmount ?? ''}`.trim(),
          data: {
            type: 'service_booking',
            bookingId: booking.id,
            serviceId: booking.serviceId,
            bookingDate: booking.bookingDate,
            timeSlot: booking.timeSlot,
          },
        }),
      }).catch(() => undefined);
    } catch {
      // ignore
    }
  }

  async getBooking(customerId: string, bookingId: string): Promise<Booking | null> {
    const ids = await this.customerIdAliases(customerId);
    if (!ids.length) return null;
    return this.repo.findOne({ where: { id: bookingId, customerId: In(ids) } });
  }

  private async customerIdAliases(customerId: string): Promise<string[]> {
    const id = String(customerId || '').trim();
    if (!id) return [];
    const ids = new Set<string>([id]);
    const profileRepo = AppDataSource.getRepository(CustomerProfile);
    const byId = await profileRepo.findOne({ where: { id } });
    const byKeycloak =
      byId ?? (await profileRepo.findOne({ where: { keycloakUserId: id } }));
    if (byKeycloak) {
      ids.add(byKeycloak.id);
      if (byKeycloak.keycloakUserId) ids.add(String(byKeycloak.keycloakUserId));
    }
    return [...ids];
  }

  async listMyBookings(customerId: string, limit: number, offset: number) {
    const ids = await this.customerIdAliases(customerId);
    if (!ids.length) return { items: [], total: 0, limit, offset };
    const [items, total] = await this.repo.findAndCount({
      where: { customerId: In(ids) },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async listVendorBookings(vendorId: string, limit: number, offset: number, status?: string) {
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

  async getBookingForVendor(vendorId: string, bookingId: string): Promise<Booking | null> {
    const row = await this.repo.findOne({ where: { id: bookingId, vendorId } });
    if (!row) return null;
    return enrichBookingForVendorPortal(row);
  }

  async listAllBookings(limit: number, offset: number, filters?: { vendorId?: string; status?: string }) {
    const where: Record<string, string> = {};
    if (filters?.vendorId?.trim()) where.vendorId = filters.vendorId.trim();
    if (filters?.status?.trim()) where.status = filters.status.trim();
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getCompletionOtp(customerId: string, bookingId: string) {
    const row = await this.repo.findOne({ where: { id: bookingId, customerId } });
    if (!row) throw new Error('Booking not found');
    const proof = bookingMeta(row).completionProof as Record<string, any> | undefined;
    if (!proof?.otpNonce || row.status !== 'completion_pending') throw new Error('Completion OTP is not available');
    if (Date.now() > new Date(proof.otpExpiresAt).getTime()) throw new Error('Completion OTP has expired');
    return { bookingId, otp: completionOtp(bookingId, String(proof.otpNonce)), expiresAt: proof.otpExpiresAt };
  }

  async confirmCompletion(customerId: string, bookingId: string, accept: boolean, reason?: string) {
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Booking);
      const row = await repo.findOne({ where: { id: bookingId, customerId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new Error('Booking not found');
      const meta = bookingMeta(row);
      const proof = { ...(meta.completionProof || {}) } as Record<string, any>;
      if (accept && row.status === 'completed' && proof.customerConfirmedAt) return { ...row, duplicate: true };
      if (row.status !== 'completion_pending_confirmation') throw new Error('Vendor OTP verification is required before confirmation');
      const now = new Date().toISOString();
      if (accept) {
        proof.status = 'customer_confirmed'; proof.customerConfirmedAt = now; row.status = 'completed';
      } else {
        const detail = String(reason || '').trim();
        if (detail.length < 5) throw new Error('Dispute reason must contain at least 5 characters');
        proof.status = 'customer_disputed';
        meta.dispute = { id: randomUUID(), status: 'open', reason: detail, openedAt: now, openedBy: 'customer' };
        row.status = 'disputed';
      }
      row.metadata = { ...meta, completionProof: proof };
      return repo.save(row);
    });
  }

  async openDispute(customerId: string, bookingId: string, reason: string, photoUrls: string[] = []) {
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Booking);
      const row = await repo.findOne({ where: { id: bookingId, customerId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new Error('Booking not found');
      const meta = bookingMeta(row);
      if (meta.dispute && String(meta.dispute.status) === 'open') return { ...meta.dispute, duplicate: true };
      if (!['completed', 'completion_pending_confirmation'].includes(row.status)) throw new Error('Only completed services can be disputed');
      const detail = String(reason || '').trim();
      if (detail.length < 5) throw new Error('Dispute reason must contain at least 5 characters');
      const completedAt = new Date((meta.completionProof as any)?.customerConfirmedAt ?? row.updatedAt).getTime();
      if (Date.now() > completedAt + 7 * 86400000) throw new Error('Dispute window has expired');
      const dispute = { id: randomUUID(), status: 'open', reason: detail, photoUrls: photoUrls.map(String).slice(0, 5), openedAt: new Date().toISOString(), openedBy: 'customer' };
      row.status = 'disputed'; row.metadata = { ...meta, dispute };
      await repo.save(row); return dispute;
    });
  }

  async resolveDisputeForAdmin(bookingId: string, resolution: string, note: string) {
    return AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Booking);
      const row = await repo.findOne({ where: { id: bookingId }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new Error('Booking not found');
      const meta = bookingMeta(row); const dispute = { ...(meta.dispute || {}) } as Record<string, any>;
      if (!dispute.id) throw new Error('Dispute not found');
      if (dispute.status === 'resolved') return { ...row, duplicate: true };
      if (!['customer', 'vendor'].includes(resolution)) throw new Error('Resolution must be customer or vendor');
      dispute.status = 'resolved'; dispute.resolution = resolution; dispute.note = String(note || '').trim(); dispute.resolvedAt = new Date().toISOString();
      row.status = resolution === 'vendor' ? 'completed' : 'dispute_resolved'; row.metadata = { ...meta, dispute };
      return repo.save(row);
    });
  }
  async cancelBooking(customerId: string, bookingId: string): Promise<Booking> {
    const ids = await this.customerIdAliases(customerId);
    const row = await this.repo.findOne({
      where: { id: bookingId, customerId: In(ids.length ? ids : [customerId]) },
    });
    if (!row) throw new Error('Booking not found');
    const current = String(row.status || '').trim().toLowerCase();
    if (current === 'cancelled' || current === 'canceled') throw new Error('Booking is already cancelled');
    const cancellable = new Set(['pending', 'approved', 'confirmed', 'in_progress']);
    if (!cancellable.has(current)) {
      throw new Error('This booking can no longer be cancelled');
    }
    row.status = 'cancelled';
    return this.repo.save(row);
  }

  async reviewBookingForVendor(vendorId: string, bookingId: string, decision: 'approved' | 'rejected'): Promise<Booking> {
    const row = await this.updateBookingStatusForVendor(vendorId, bookingId, decision);
    return row;
  }

  async updateBookingStatusForVendor(vendorId: string, bookingId: string, nextStatus: string): Promise<Booking> {
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

  async reviewBookingForAdmin(bookingId: string, decision: 'approved' | 'rejected'): Promise<Booking> {
    const row = await this.repo.findOne({ where: { id: bookingId } });
    if (!row) throw new Error('Booking not found');
    if (this.terminalStatuses.has(row.status)) {
      throw new Error(`Cannot ${decision} booking from status ${row.status}`);
    }
    row.status = decision;
    return this.repo.save(row);
  }

  /** Admin can set any valid booking lifecycle status (same rules as vendor, without vendor scope). */
  async updateBookingStatusForAdmin(bookingId: string, nextStatus: string): Promise<Booking> {
    const row = await this.repo.findOne({ where: { id: bookingId } });
    if (!row) throw new Error('Booking not found');
    return this.updateBookingStatusForVendor(row.vendorId, bookingId, nextStatus);
  }

  async deleteBookingForAdmin(bookingId: string): Promise<void> {
    const result = await this.repo.delete({ id: bookingId });
    if (!result.affected) throw new Error('Booking not found');
  }

  async getAvailableSlots(vendorId: string, date: string, serviceId?: string | null) {
    const candidates = await this.buildCandidateSlots(vendorId, date, serviceId);
    const existing = await this.repo.find({
      where: {
        vendorId,
        bookingDate: date,
        status: In(['pending', 'approved']),
      },
      select: ['timeSlot'],
    });
    const booked = new Set(existing.map((b) => b.timeSlot));
    return candidates.map((slot) => ({
      label: slot.label,
      value: slot.value,
      available: !booked.has(slot.value),
    }));
  }
}
