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
  if (b.phone != null && String(b.phone).trim()) {
    const digits = String(b.phone).replace(/\D/g, '');
    if (digits.length >= 10) b.phone = digits.slice(-10);
  }
  if (b.email != null) b.email = String(b.email).trim().toLowerCase();
  if (b.gst != null && String(b.gst).trim()) b.gst = String(b.gst).trim().toUpperCase();
  if (b.pan != null && String(b.pan).trim()) b.pan = String(b.pan).trim().toUpperCase();
  return b;
}

export function serializeVendorRow(v: Vendor): Record<string, unknown> {
  const normalizedKind = String(v.vendorKind || '').trim().toLowerCase();
  const normalizedType = String(v.vendorType || '').trim().toUpperCase();
  const vendorKind = normalizedKind === 'service' || normalizedType === 'SERVICE' ? 'service' : 'product';
  const vendorType = vendorKind === 'service' ? 'SERVICE' : 'PRODUCT';
  const docs = v.documentsJson && typeof v.documentsJson === 'object' ? v.documentsJson : {};
  const vendorRef =
    typeof (docs as Record<string, unknown>).vendorRef === 'string'
      ? String((docs as Record<string, unknown>).vendorRef).trim() || null
      : null;
  return {
    ...v,
    vendorKind,
    vendorType,
    vendorRef,
    catalogVendorId: v.id,
  };
}
