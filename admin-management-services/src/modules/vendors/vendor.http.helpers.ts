import { Request } from 'express';
import { Vendor } from './entities/Vendor';

/** Supports GET /vendors?type=PRODUCT|SERVICE and ?vendorKind=product|service (legacy). */
export function parseVendorKindFilter(req: Request): 'product' | 'service' | undefined {
  const tryParse = (raw: unknown): 'product' | 'service' | undefined => {
    if (raw == null || raw === '') return undefined;
    const s = String(raw).trim();
    const u = s.toUpperCase();
    if (u === 'PRODUCT' || u === 'PRODUCT_VENDOR') return 'product';
    if (u === 'SERVICE' || u === 'SERVICE_VENDOR') return 'service';
    const l = s.toLowerCase();
    if (l === 'product') return 'product';
    if (l === 'service') return 'service';
    return undefined;
  };
  return tryParse(req.query.type) ?? tryParse(req.query.vendorKind);
}

/** Maps body.vendorType / vendor_type (uppercase) onto vendorKind before DTO validation. */
export function normalizeVendorWriteBody(body: Record<string, unknown>): Record<string, unknown> {
  const b = { ...(body || {}) };
  if (b.vendorKind !== 'product' && b.vendorKind !== 'service') {
    const u = String(b.vendorType ?? b.vendor_type ?? '').trim().toUpperCase();
    if (u === 'PRODUCT') b.vendorKind = 'product';
    else if (u === 'SERVICE') b.vendorKind = 'service';
  }
  return b;
}

export function serializeVendorRow(v: Vendor): Record<string, unknown> {
  const normalizedKind = String(v.vendorKind || '').trim().toLowerCase();
  const normalizedType = String(v.vendorType || '').trim().toUpperCase();
  const vendorKind = normalizedKind === 'service' || normalizedType === 'SERVICE' ? 'service' : 'product';
  const vendorType = vendorKind === 'service' ? 'SERVICE' : 'PRODUCT';
  return {
    ...v,
    vendorKind,
    vendorType,
  };
}
