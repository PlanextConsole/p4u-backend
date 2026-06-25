import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { Vendor } from '../entities/Vendor';
import { enrichBookingForVendorPortal, enrichBookingsForVendorPortal } from './bookingEnrichment';

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
}
