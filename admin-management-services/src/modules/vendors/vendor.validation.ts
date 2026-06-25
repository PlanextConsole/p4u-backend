import type { CreateVendorDto } from './dto/create-vendor.dto';
import type { UpdateVendorDto } from './dto/update-vendor.dto';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
const STATE_CODE_RE = /^[0-9]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePhoneDigits(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function isValidIndianMobile(phone: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(phone);
  return /^[6-9]\d{9}$/.test(digits);
}

export function isValidEmail(email: string | null | undefined): boolean {
  const v = String(email ?? '').trim();
  return v.length > 0 && EMAIL_RE.test(v);
}

export function isValidGstin(gst: string | null | undefined): boolean {
  const v = String(gst ?? '').trim().toUpperCase();
  return v.length === 0 || (v.length === 15 && GSTIN_RE.test(v));
}

export function isValidPan(pan: string | null | undefined): boolean {
  const v = String(pan ?? '').trim().toUpperCase();
  return v.length === 0 || (v.length === 10 && PAN_RE.test(v));
}

export function isValidIfsc(ifsc: string | null | undefined): boolean {
  const v = String(ifsc ?? '').trim().toUpperCase();
  return v.length === 0 || IFSC_RE.test(v);
}

function hasCategorySelection(categoriesJson: unknown): boolean {
  if (categoriesJson == null) return false;
  if (Array.isArray(categoriesJson)) return categoriesJson.some((x) => String(x ?? '').trim());
  return String(categoriesJson).trim().length > 0;
}

function hasServiceSelection(servicesJson: unknown): boolean {
  if (servicesJson == null) return false;
  if (Array.isArray(servicesJson)) return servicesJson.some((x) => String(x ?? '').trim());
  return String(servicesJson).trim().length > 0;
}

function commissionInRange(value: string | number | null | undefined): boolean {
  if (value == null || value === '') return true;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

/** Throws Error with comma-separated messages when business rules fail. */
export function assertCreateVendorRules(dto: CreateVendorDto): void {
  const errors: string[] = [];

  const businessName = String(dto.businessName ?? '').trim();
  const ownerName = String(dto.ownerName ?? '').trim();
  if (!businessName) errors.push('Business name is required');
  if (!ownerName) errors.push('Owner name is required');

  const email = String(dto.email ?? '').trim();
  const phone = String(dto.phone ?? '').trim();
  if (!email) errors.push('Email is required');
  else if (!isValidEmail(email)) errors.push('Invalid email address');
  if (!phone) errors.push('Mobile number is required');
  else if (!isValidIndianMobile(phone)) errors.push('Invalid Indian mobile number');

  if (!isValidGstin(dto.gst)) errors.push('GSTIN must be 15 characters in valid format');
  if (!isValidPan(dto.pan)) errors.push('PAN must be 10 characters in valid format');

  const bank = dto.bankJson && typeof dto.bankJson === 'object' ? dto.bankJson : null;
  if (bank?.ifscCode != null && !isValidIfsc(String(bank.ifscCode))) {
    errors.push('Invalid IFSC code');
  }

  const address = dto.addressJson && typeof dto.addressJson === 'object' ? dto.addressJson : null;
  const stateCode = address?.stateCode != null ? String(address.stateCode).trim() : '';
  if (stateCode && !STATE_CODE_RE.test(stateCode)) {
    errors.push('State code must be 2 digits');
  }

  if (!commissionInRange(dto.commissionRate)) {
    errors.push('Commission must be between 0 and 100');
  }
  if (!commissionInRange(dto.maxRedemptionPercent)) {
    errors.push('Max redemption percent must be between 0 and 100');
  }

  if (dto.vendorKind === 'product' && !hasCategorySelection(dto.categoriesJson)) {
    errors.push('Vendor category is required for product vendors');
  }
  if (dto.vendorKind === 'service' && !hasServiceSelection(dto.servicesJson)) {
    errors.push('At least one service is required for service vendors');
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
}

/** Validates fields present on update; does not require full create set. */
export function assertUpdateVendorRules(dto: UpdateVendorDto, existing: { vendorKind: string }): void {
  const errors: string[] = [];
  const kind = dto.vendorKind ?? existing.vendorKind;

  if (dto.businessName !== undefined && !String(dto.businessName ?? '').trim()) {
    errors.push('Business name cannot be empty');
  }
  if (dto.ownerName !== undefined && !String(dto.ownerName ?? '').trim()) {
    errors.push('Owner name cannot be empty');
  }
  if (dto.email !== undefined) {
    const email = String(dto.email ?? '').trim();
    if (!email) errors.push('Email is required');
    else if (!isValidEmail(email)) errors.push('Invalid email address');
  }
  if (dto.phone !== undefined) {
    const phone = String(dto.phone ?? '').trim();
    if (!phone) errors.push('Mobile number is required');
    else if (!isValidIndianMobile(phone)) errors.push('Invalid Indian mobile number');
  }
  if (dto.gst !== undefined && !isValidGstin(dto.gst)) {
    errors.push('GSTIN must be 15 characters in valid format');
  }
  if (dto.pan !== undefined && !isValidPan(dto.pan)) {
    errors.push('PAN must be 10 characters in valid format');
  }
  if (dto.commissionRate !== undefined && !commissionInRange(dto.commissionRate)) {
    errors.push('Commission must be between 0 and 100');
  }
  if (dto.maxRedemptionPercent !== undefined && !commissionInRange(dto.maxRedemptionPercent)) {
    errors.push('Max redemption percent must be between 0 and 100');
  }

  const bank = dto.bankJson && typeof dto.bankJson === 'object' ? dto.bankJson : null;
  if (bank?.ifscCode != null && !isValidIfsc(String(bank.ifscCode))) {
    errors.push('Invalid IFSC code');
  }

  const address = dto.addressJson && typeof dto.addressJson === 'object' ? dto.addressJson : null;
  const stateCode = address?.stateCode != null ? String(address.stateCode).trim() : '';
  if (stateCode && !STATE_CODE_RE.test(stateCode)) {
    errors.push('State code must be 2 digits');
  }

  if (kind === 'product' && dto.categoriesJson !== undefined && !hasCategorySelection(dto.categoriesJson)) {
    errors.push('Vendor category is required for product vendors');
  }
  if (kind === 'service' && dto.servicesJson !== undefined && !hasServiceSelection(dto.servicesJson)) {
    errors.push('At least one service is required for service vendors');
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }
}
