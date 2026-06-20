import { PlatformVariable } from './entities/PlatformVariable';

/** Controls whether admins may create new occupations; edit/view/delete stay available. */
export const OCCUPATION_ADMIN_CREATE_ENABLED_KEY = 'OCCUPATION_ADMIN_CREATE_ENABLED';

/**
 * Interprets a platform variable row as an on/off flag (matches admin UI `amount` / boolean JSON).
 * When the row is missing, returns `defaultWhenMissing` so legacy DBs stay permissive.
 */
export function isPlatformVariableRowAllowingAction(
  row: Pick<PlatformVariable, 'isActive' | 'value'> | null,
  defaultWhenMissing = true
): boolean {
  if (!row) return defaultWhenMissing;
  if (!row.isActive) return false;
  return parsePlatformJsonValueAsEnabled(row.value, defaultWhenMissing);
}

function parsePlatformJsonValueAsEnabled(value: unknown, defaultWhenMissing: boolean): boolean {
  if (value == null) return defaultWhenMissing;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return !Number.isNaN(value) && value !== 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (s === '' || s === 'null') return defaultWhenMissing;
    if (s === 'true' || s === 'yes' || s === '1') return true;
    if (s === 'false' || s === 'no' || s === '0') return false;
    const n = Number(s);
    if (!Number.isNaN(n)) return n !== 0;
    return defaultWhenMissing;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    if (typeof o.enabled === 'boolean') return o.enabled;
    if (o.amount !== undefined && o.amount !== null && o.amount !== '') {
      return parsePlatformJsonValueAsEnabled(o.amount, defaultWhenMissing);
    }
    if (o.text !== undefined && o.text !== null) {
      return parsePlatformJsonValueAsEnabled(o.text, defaultWhenMissing);
    }
  }
  return defaultWhenMissing;
}
