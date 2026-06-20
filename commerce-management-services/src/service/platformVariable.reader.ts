import { AppDataSource } from '../config/database';
import { PlatformVariable } from '../entities/PlatformVariable';

export const PLATFORM_VAR_KEYS = {
  WELCOME_BONUS: 'WELCOME_BONUS',
  REFERRAL_BONUS: 'REFERRAL_BONUS',
  VENDOR_REFERRAL_BONUS: 'VENDOR_REFERRAL_BONUS',
  POST_SHARE_POINTS: 'POST_SHARE_POINTS',
  POST_LIKE_POINTS: 'POST_LIKE_POINTS',
  STORY_LIKE_POINTS: 'STORY_LIKE_POINTS',
  PLATFORM_FEE: 'PLATFORM_FEE',
  GST_ON_PLATFORM_FEE_PERCENT: 'GST_ON_PLATFORM_FEE_PERCENT',
  MIN_CART_VALUE: 'MIN_CART_VALUE',
  SURGE_COST: 'SURGE_COST',
  DELIVERY_FEE: 'DELIVERY_FEE',
} as const;

export type PlatformVarKey = (typeof PLATFORM_VAR_KEYS)[keyof typeof PLATFORM_VAR_KEYS];

export const PLATFORM_VAR_DEFAULTS: Record<PlatformVarKey, number> = {
  WELCOME_BONUS: 300,
  REFERRAL_BONUS: 100,
  VENDOR_REFERRAL_BONUS: 200,
  POST_SHARE_POINTS: 1,
  POST_LIKE_POINTS: 1,
  STORY_LIKE_POINTS: 1,
  PLATFORM_FEE: 10,
  GST_ON_PLATFORM_FEE_PERCENT: 18,
  MIN_CART_VALUE: 0,
  SURGE_COST: 0,
  DELIVERY_FEE: 0,
};

function parseNumeric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (o.amount !== undefined && o.amount !== null && o.amount !== '') return parseNumeric(o.amount);
    if (o.value !== undefined && o.value !== null && o.value !== '') return parseNumeric(o.value);
  }
  return null;
}

const TTL_MS = 5 * 60 * 1000;
const cache = new Map<PlatformVarKey, { value: number; expiresAt: number }>();

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
    const parsed = parseNumeric(row.value);
    if (parsed != null) resolved = parsed;
  }
  cache.set(key, { value: resolved, expiresAt: now + TTL_MS });
  return resolved;
}

export function invalidatePlatformVarCache(): void {
  cache.clear();
}
