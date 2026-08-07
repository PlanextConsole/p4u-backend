import { AppDataSource, isPostgresDbType } from '../config/database';
import { CustomerProfile } from '../entities/CustomerProfile';
import { Order } from '../entities/Order';

/**
 * Resolve JWT sub / profile id aliases so cart, orders, and self-checks
 * stay consistent when tokens carry `sub` but rows store profile UUID (or vice versa).
 */
export async function resolveCustomerIdAliases(
  customerId: string,
  extraIds: string[] = [],
): Promise<string[]> {
  const id = String(customerId || '').trim();
  const seed = [id, ...extraIds.map((v) => String(v || '').trim()).filter(Boolean)];
  if (!seed.length) return [];
  const ids = new Set<string>(seed);
  try {
    const profileRepo = AppDataSource.getRepository(CustomerProfile);
    for (const candidate of [...ids]) {
      const byId = await profileRepo.findOne({ where: { id: candidate } });
      const byKeycloak =
        byId ?? (await profileRepo.findOne({ where: { keycloakUserId: candidate } }));
      if (!byKeycloak) continue;
      ids.add(byKeycloak.id);
      if (byKeycloak.keycloakUserId) ids.add(String(byKeycloak.keycloakUserId));
      // Prefer linking the Keycloak subject (not a profile UUID) when repairing.
      const subject = seed.find((s) => s && s !== byKeycloak.id) || candidate;
      if (!byKeycloak.keycloakUserId && subject && subject !== byKeycloak.id) {
        byKeycloak.keycloakUserId = subject;
        await profileRepo.save(byKeycloak).catch(() => undefined);
        ids.add(subject);
      }
    }

    // Recover orders written under a profile UUID while the token only has `sub`
    // (or the reverse) by reading identity stamps from order metadata.
    const orderRepo = AppDataSource.getRepository(Order);
    const authIds = [...ids];
    if (authIds.length) {
      const metaAuth = isPostgresDbType()
        ? `(o.metadata ->> 'customerAuthId' IN (:...authIds) OR o.metadata ->> 'customerKeycloakUserId' IN (:...authIds) OR o.metadata ->> 'customerProfileId' IN (:...authIds))`
        : `(JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.customerAuthId')) IN (:...authIds) OR JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.customerKeycloakUserId')) IN (:...authIds) OR JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.customerProfileId')) IN (:...authIds))`;
      const bridged = await orderRepo
        .createQueryBuilder('o')
        .select('DISTINCT o.customer_id', 'customerId')
        .where(metaAuth, { authIds })
        .limit(100)
        .getRawMany<{ customerId?: string; customer_id?: string }>();
      for (const row of bridged) {
        const cid = String(row.customerId ?? row.customer_id ?? '').trim();
        if (cid) ids.add(cid);
      }
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
  for (const candidate of ids) {
    const row = await profileRepo.findOne({ where: { id: candidate } });
    if (row?.id) return row.id;
  }
  return ids[0];
}

/** Portable JSON text extract equality for order metadata identity fields. */
export function orderMetadataIdentitySql(alias: string, paramName: string): string {
  if (isPostgresDbType()) {
    return (
      `(${alias}.metadata ->> 'customerAuthId' IN (:...${paramName})` +
      ` OR ${alias}.metadata ->> 'customerProfileId' IN (:...${paramName})` +
      ` OR ${alias}.metadata ->> 'customerKeycloakUserId' IN (:...${paramName}))`
    );
  }
  return (
    `(JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.customerAuthId')) IN (:...${paramName})` +
    ` OR JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.customerProfileId')) IN (:...${paramName})` +
    ` OR JSON_UNQUOTE(JSON_EXTRACT(${alias}.metadata, '$.customerKeycloakUserId')) IN (:...${paramName}))`
  );
}
