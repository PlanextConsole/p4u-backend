import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';

function metaRecord(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  return m as Record<string, unknown>;
}

async function loadServiceNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const rows = await AppDataSource.getRepository(CatalogServiceItem).find({
    where: { id: In(uniq) },
    select: ['id', 'name'],
  });
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.id, r.name || 'Service');
  return map;
}

export async function enrichBookingsForVendorPortal(bookings: Booking[]): Promise<Booking[]> {
  const serviceIds = bookings.map((b) => String(b.serviceId || '').trim()).filter(Boolean);
  const services = await loadServiceNames(serviceIds);
  return bookings.map((booking) => enrichOne(booking, services));
}

export async function enrichBookingForVendorPortal(booking: Booking): Promise<Booking> {
  const sid = String(booking.serviceId || '').trim();
  const services = sid ? await loadServiceNames([sid]) : new Map();
  return enrichOne(booking, services);
}

function enrichOne(booking: Booking, services: Map<string, string>): Booking {
  const meta = metaRecord(booking.metadata);
  const displayId =
    (typeof meta.displayId === 'string' && meta.displayId.trim()) ||
    `BKG-${String(booking.id).slice(0, 8).toUpperCase()}`;
  const serviceName =
    (typeof meta.serviceName === 'string' && meta.serviceName.trim()) ||
    (booking.serviceId ? services.get(booking.serviceId) : '') ||
    'General service';
  booking.metadata = {
    ...meta,
    displayId,
    serviceName,
  };
  return booking;
}
