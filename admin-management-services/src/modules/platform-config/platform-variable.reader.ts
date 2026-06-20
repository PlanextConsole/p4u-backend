import { AppDataSource } from '../../config/database';
import { PlatformVariable } from './entities/PlatformVariable';
import {
  PLATFORM_VAR_DEFAULTS,
  PLATFORM_VAR_KEYS,
  type PlatformVarKey,
  parsePlatformVarNumeric,
} from './platform-variable-keys';

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = { value: number; expiresAt: number };
const cache = new Map<PlatformVarKey, CacheEntry>();

/**
 * Reads a numeric platform variable, falling back to the in-code default when the row is
 * missing, inactive, or non-numeric. Cached for 5 minutes per key (in-process).
 */
export async function getPlatformVarNumber(key: PlatformVarKey): Promise<number> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const repo = AppDataSource.getRepository(PlatformVariable);
  const row = await repo
    .createQueryBuilder('p')
    .where('LOWER(TRIM(p.key)) = :k', { k: key.toLowerCase() })
    .andWhere('p.isActive = :a', { a: true })
    .getOne();

  let resolved = PLATFORM_VAR_DEFAULTS[key];
  if (row) {
    const parsed = parsePlatformVarNumeric(row.value);
    if (parsed != null) resolved = parsed;
  }
  cache.set(key, { value: resolved, expiresAt: now + TTL_MS });
  return resolved;
}

/** Invalidate the in-process cache. Call from the platform-variable update path. */
export function invalidatePlatformVarCache(key?: PlatformVarKey): void {
  if (key) cache.delete(key);
  else cache.clear();
}

export { PLATFORM_VAR_KEYS, PLATFORM_VAR_DEFAULTS };
