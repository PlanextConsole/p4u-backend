import { NetworkError } from '@keycloak/keycloak-admin-client';

const MAX = 900;

/** JSON body may send coordinates as numbers or strings. */
export function bodyOptionalNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function truncate(s: string): string {
  return s.length <= MAX ? s : `${s.slice(0, MAX)}…`;
}

/**
 * Maps phone-OTP `/public/phone/exchange` failures to HTTP status.
 * Avoids 401 (implies missing caller credentials); OTP was already verified in the browser.
 */
export function statusForPhoneExchangeFailure(message: string): number {
  const m = message.toLowerCase();
  if (
    m.includes('registration token secret') ||
    m.includes('role vendor not found') ||
    m.includes('role customer not found')
  ) {
    return 500;
  }
  if (
    m.includes('otp login failed') ||
    m.includes('identity server rejected') ||
    m.includes('keycloak user not found while issuing') ||
    /\bhttp\s*401\b|\bstatus code 401\b/i.test(message)
  ) {
    return 503;
  }
  return 400;
}

/**
 * Keycloak admin client throws {@link NetworkError} with a fixed message
 * "Network response was not OK." — real detail is in `responseData`.
 * Use this for public API JSON `{ message }` instead of `error.message`.
 */
export function mapCaughtErrorToMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    const rd = error.responseData;
    if (typeof rd === 'string' && rd.trim()) return truncate(rd.trim());
    if (rd && typeof rd === 'object') {
      const o = rd as Record<string, unknown>;
      if (typeof o.errorMessage === 'string' && o.errorMessage.trim()) {
        return truncate(String(o.errorMessage).trim());
      }
      const nested = o.error;
      if (typeof nested === 'string' && nested.trim()) return truncate(nested.trim());
      if (nested && typeof nested === 'object') {
        const n = nested as Record<string, unknown>;
        if (typeof n.errorMessage === 'string' && n.errorMessage.trim()) {
          return truncate(String(n.errorMessage).trim());
        }
      }
      try {
        return truncate(JSON.stringify(rd));
      } catch {
        /* ignore */
      }
    }
    const status =
      error.response && typeof (error.response as Response).status === 'number'
        ? (error.response as Response).status
        : undefined;
    return status != null
      ? `Identity server rejected the request (HTTP ${status}).`
      : 'Identity server rejected the request.';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}
