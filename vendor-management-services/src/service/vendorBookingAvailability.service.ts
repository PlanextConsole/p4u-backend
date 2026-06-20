import { AppDataSource } from '../config/database';
import { Vendor } from '../entities/Vendor';
import { VendorOfferedServicesService } from './vendorOfferedServices.service';

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

function validateAvailability(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') throw new Error('Invalid payload');
  const o = body as Record<string, unknown>;
  if (Number(o.version) !== 1) throw new Error('availability.version must be 1');
  if (!o.weekly || typeof o.weekly !== 'object') throw new Error('availability.weekly is required');
  for (const k of DAY_KEYS) {
    const d = (o.weekly as Record<string, unknown>)[k];
    if (!d || typeof d !== 'object') throw new Error(`weekly.${k} is required`);
  }
  if (!Array.isArray(o.dateOffs)) throw new Error('availability.dateOffs must be an array');
  if (o.todayClosed !== undefined && typeof o.todayClosed !== 'boolean') {
    throw new Error('availability.todayClosed must be a boolean');
  }
  if (o.defaultSlotMinutes !== undefined) {
    const n = Number(o.defaultSlotMinutes);
    if (!Number.isFinite(n) || n < 15 || n > 480) throw new Error('defaultSlotMinutes must be between 15 and 480');
  }
  return o;
}

export class VendorBookingAvailabilityService {
  private offered = new VendorOfferedServicesService();

  async getForVendor(vendorId: string): Promise<{ availability: Record<string, unknown> | null }> {
    await this.offered.assertServiceVendor(vendorId);
    const v = await AppDataSource.getRepository(Vendor).findOne({
      where: { id: vendorId },
      select: ['id', 'bookingAvailabilityJson'],
    });
    if (!v) throw new Error('Vendor not found');
    return { availability: (v.bookingAvailabilityJson as Record<string, unknown> | null) ?? null };
  }

  async saveForVendor(vendorId: string, body: unknown): Promise<{ availability: Record<string, unknown> }> {
    await this.offered.assertServiceVendor(vendorId);
    const json = validateAvailability(body);
    const repo = AppDataSource.getRepository(Vendor);
    const row = await repo.findOne({ where: { id: vendorId } });
    if (!row) throw new Error('Vendor not found');
    row.bookingAvailabilityJson = json;
    await repo.save(row);
    return { availability: json };
  }
}
