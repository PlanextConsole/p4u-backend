import { AppDataSource } from '../config/database';
import { Vendor } from '../entities/Vendor';

/**
 * Resolve catalog vendor UUID from JWT — same rules as vendor-management-services.
 * Bookings are keyed by catalog vendor id, not Keycloak `sub`.
 */
export async function resolveVendorIdFromAuth(auth: unknown): Promise<string | null> {
  if (!auth || typeof auth !== 'object') return null;
  const a = auth as Record<string, unknown>;
  const claim = a.vendor_id ?? a.vendorId;
  if (claim != null && String(claim).trim()) return String(claim).trim();

  const sub = a.sub != null ? String(a.sub).trim() : '';
  if (!sub) return null;

  const row = await AppDataSource.getRepository(Vendor).findOne({
    where: { keycloakUserId: sub },
    select: ['id'],
  });
  return row?.id ?? null;
}
