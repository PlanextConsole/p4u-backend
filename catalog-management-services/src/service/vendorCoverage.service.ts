import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Vendor } from '../entities/Vendor';
import { VendorPlan } from '../entities/VendorPlan';

export type CustomerLocation = {
  latitude?: number;
  longitude?: number;
  city?: string;
  district?: string;
  state?: string;
  stateCode?: string;
  country?: string;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function number(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addressValue(address: Record<string, unknown> | null, ...keys: string[]): string {
  for (const key of keys) {
    const value = text(address?.[key]);
    if (value) return value;
  }
  return '';
}

function matchesAny(left: unknown[], right: unknown[]): boolean {
  const leftValues = new Set(left.map(text).filter(Boolean));
  return right.map(text).filter(Boolean).some((value) => leftValues.has(value));
}

function coordinates(address: Record<string, unknown> | null): { latitude: number; longitude: number } | null {
  const latitude = number(address?.latitude ?? address?.lat);
  const longitude = number(address?.longitude ?? address?.lng ?? address?.lon);
  if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function hasLocation(location?: CustomerLocation): boolean {
  if (!location) return false;
  return coordinates(location as Record<string, unknown>) != null ||
    Boolean(text(location.city) || text(location.district) || text(location.state) || text(location.stateCode));
}

function isVisible(vendor: Vendor, plan: VendorPlan | undefined, customer: CustomerLocation): boolean {
  const address = vendor.addressJson;
  const visibility = plan?.visibilityType ?? (vendor.coverageRadiusKm != null ? 'radius' : 'country');

  if (visibility === 'country') {
    const customerCountry = text(customer.country);
    const vendorCountry = addressValue(address, 'country', 'countryName');
    return !customerCountry || !vendorCountry || customerCountry === vendorCountry;
  }

  if (visibility === 'state') {
    return matchesAny(
      [customer.stateCode, customer.state],
      [address?.stateCode, address?.state, address?.stateName],
    );
  }

  if (visibility === 'city') {
    return matchesAny(
      [customer.city, customer.district],
      [address?.city, address?.district, address?.areaLocality],
    );
  }

  const customerCoordinates = coordinates(customer as Record<string, unknown>);
  const vendorCoordinates = coordinates(address);
  const radius = number(vendor.coverageRadiusKm ?? plan?.radiusKm);
  return Boolean(customerCoordinates && vendorCoordinates && radius != null && radius > 0 &&
    distanceKm(customerCoordinates, vendorCoordinates) <= radius);
}

/** Null means no usable customer location was supplied, preserving legacy global browsing. */
export async function visibleVendorIds(location?: CustomerLocation): Promise<string[] | null> {
  if (!hasLocation(location)) return null;

  const vendors = await AppDataSource.getRepository(Vendor).find({ where: { status: 'active' } });
  const planIds = [...new Set(vendors.map((vendor) => vendor.vendorPlanId).filter(Boolean))] as string[];
  const plans = planIds.length
    ? await AppDataSource.getRepository(VendorPlan).find({ where: { id: In(planIds) } })
    : [];
  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  return vendors
    .filter((vendor) => isVisible(vendor, vendor.vendorPlanId ? planMap.get(vendor.vendorPlanId) : undefined, location!))
    .map((vendor) => vendor.id);
}
