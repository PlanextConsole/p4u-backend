import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entities/CustomerProfile';

/**
 * Resolve JWT sub / profile id aliases so cart, orders, and self-checks
 * stay consistent when tokens carry `sub` but rows store profile UUID (or vice versa).
 */
export async function resolveCustomerIdAliases(customerId: string): Promise<string[]> {
  const id = String(customerId || '').trim();
  if (!id) return [];
  const ids = new Set<string>([id]);
  try {
    const profileRepo = AppDataSource.getRepository(CustomerProfile);
    const byId = await profileRepo.findOne({ where: { id } });
    const byKeycloak =
      byId ?? (await profileRepo.findOne({ where: { keycloakUserId: id } }));
    if (byKeycloak) {
      ids.add(byKeycloak.id);
      if (byKeycloak.keycloakUserId) ids.add(String(byKeycloak.keycloakUserId));
    }
  } catch {
    // DB may be unavailable during early boot; fall back to the raw id.
  }
  return [...ids];
}

/** Prefer stable profile UUID when known; otherwise first alias. */
export async function canonicalCustomerId(customerId: string): Promise<string> {
  const ids = await resolveCustomerIdAliases(customerId);
  if (!ids.length) return String(customerId || '').trim();
  const profileRepo = AppDataSource.getRepository(CustomerProfile);
  for (const id of ids) {
    const row = await profileRepo.findOne({ where: { id } });
    if (row?.id) return row.id;
  }
  return ids[0];
}
