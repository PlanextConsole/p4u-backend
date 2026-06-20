/**
 * Canonical platform-variable keys consumed by services for wallet, fee, and bonus computation.
 * Admin UI may show extra/legacy keys; the constants below are the keys with code-side meaning.
 */
export const PLATFORM_VAR_KEYS = {
  // Wallet earn-on-event
  WELCOME_BONUS: 'WELCOME_BONUS',
  REFERRAL_BONUS: 'REFERRAL_BONUS',
  VENDOR_REFERRAL_BONUS: 'VENDOR_REFERRAL_BONUS',
  POST_SHARE_POINTS: 'POST_SHARE_POINTS',
  POST_LIKE_POINTS: 'POST_LIKE_POINTS',
  STORY_LIKE_POINTS: 'STORY_LIKE_POINTS',

  // Checkout fees
  PLATFORM_FEE: 'PLATFORM_FEE',
  GST_ON_PLATFORM_FEE_PERCENT: 'GST_ON_PLATFORM_FEE_PERCENT',
  MIN_CART_VALUE: 'MIN_CART_VALUE',
  SURGE_COST: 'SURGE_COST',
  DELIVERY_FEE: 'DELIVERY_FEE',
} as const;

export type PlatformVarKey = (typeof PLATFORM_VAR_KEYS)[keyof typeof PLATFORM_VAR_KEYS];

/** Defaults applied when DB row is missing or inactive — mirrors the spreadsheet baseline. */
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

/**
 * Extract the numeric value from a platform-variable JSON payload.
 * Accepts plain number, string, or `{ amount, valueType, ... }` shape used by the admin UI.
 */
export function parsePlatformVarNumeric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (o.amount !== undefined && o.amount !== null && o.amount !== '') {
      return parsePlatformVarNumeric(o.amount);
    }
    if (o.value !== undefined && o.value !== null && o.value !== '') {
      return parsePlatformVarNumeric(o.value);
    }
  }
  return null;
}
