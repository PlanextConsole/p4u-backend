import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { Vendor } from '../entities/Vendor';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
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

    const row = this.repo.create({
      ...data,
      customerId,
      status: 'pending',
    });
    return this.repo.save(row);
  }

  async getBooking(customerId: string, bookingId: string): Promise<Booking | null> {
    return this.repo.findOne({ where: { id: bookingId, customerId } });
  }

  async listMyBookings(customerId: string, limit: number, offset: number) {
    const [items, total] = await this.repo.findAndCount({
      where: { customerId },
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

  async cancelBooking(customerId: string, bookingId: string): Promise<Booking> {
    const row = await this.repo.findOne({ where: { id: bookingId, customerId } });
    if (!row) throw new Error('Booking not found');
    if (row.status === 'cancelled') throw new Error('Booking is already cancelled');
    if (row.status === 'completed') throw new Error('Cannot cancel a completed booking');
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
