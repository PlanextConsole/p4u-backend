/**
 * Builds bookable slot values (HH:mm-HH:mm) from vendor `booking_availability_json`
 * stored on `catalog_vendors`. Used by BookingService for shopper slot pickers.
 */

export type DayScheduleV1 = {
  enabled: boolean;
  start: string;
  end: string;
  bufferMinutes: number;
  customSlots: { start: string; end: string }[];
};

export type BookingAvailabilityV1 = {
  version: 1;
  /** When true, no slots are offered for “today” (business calendar date). */
  todayClosed?: boolean;
  defaultSlotMinutes?: number;
  weekly: Record<string, DayScheduleV1>;
  dateOffs: { date: string; reason?: string | null }[];
};

export type BuiltSlot = {
  label: string;
  value: string;
  available: boolean;
};

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6'] as const;

/** India ops timezone — availability “today” / past-slot filtering. */
export const BOOKING_BUSINESS_TZ =
  String(process.env.BOOKING_BUSINESS_TZ || 'Asia/Kolkata').trim() || 'Asia/Kolkata';

export function defaultBookingAvailabilityV1(): BookingAvailabilityV1 {
  const weekly: Record<string, DayScheduleV1> = {};
  for (const k of DAY_KEYS) {
    const d = parseInt(k, 10);
    const weekend = d === 0 || d === 6;
    weekly[k] = {
      enabled: !weekend,
      start: '09:00',
      end: '18:00',
      bufferMinutes: 30,
      customSlots: [],
    };
  }
  return { version: 1, todayClosed: false, defaultSlotMinutes: 60, weekly, dateOffs: [] };
}

export function parseBookingAvailabilityV1(raw: unknown): BookingAvailabilityV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  const weekly = o.weekly;
  if (!weekly || typeof weekly !== 'object') return null;
  return raw as BookingAvailabilityV1;
}

export function mergeWithDefaults(raw: unknown): BookingAvailabilityV1 {
  const base = defaultBookingAvailabilityV1();
  const parsed = parseBookingAvailabilityV1(raw);
  if (!parsed) return base;
  const weekly: Record<string, DayScheduleV1> = { ...base.weekly };
  for (const k of DAY_KEYS) {
    const p = parsed.weekly?.[k];
    if (!p || typeof p !== 'object') continue;
    weekly[k] = {
      enabled: Boolean(p.enabled),
      start: typeof p.start === 'string' ? p.start : weekly[k].start,
      end: typeof p.end === 'string' ? p.end : weekly[k].end,
      bufferMinutes: Number.isFinite(Number(p.bufferMinutes)) ? Number(p.bufferMinutes) : weekly[k].bufferMinutes,
      customSlots: Array.isArray(p.customSlots)
        ? p.customSlots
            .filter((s) => s && typeof s === 'object')
            .map((s: any) => ({
              start: String(s.start || '09:00'),
              end: String(s.end || '18:00'),
            }))
        : [],
    };
  }
  return {
    version: 1,
    todayClosed: Boolean(parsed.todayClosed),
    defaultSlotMinutes:
      Number.isFinite(Number(parsed.defaultSlotMinutes)) && Number(parsed.defaultSlotMinutes) > 0
        ? Math.min(480, Math.max(15, Number(parsed.defaultSlotMinutes)))
        : base.defaultSlotMinutes,
    weekly,
    dateOffs: Array.isArray(parsed.dateOffs)
      ? parsed.dateOffs
          .filter((x) => x && typeof x === 'object')
          .map((x: any) => ({ date: String(x.date || '').slice(0, 10), reason: x.reason != null ? String(x.reason) : null }))
          .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date))
      : [],
  };
}

function parseHm(s: string): number {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
  return h * 60 + min;
}

function toHm(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function slotLabel(start: string, end: string): string {
  return `${start} – ${end}`;
}

/** Weekday for a civil YYYY-MM-DD (UTC calendar math — independent of host TZ). */
export function ymdDow(ymd: string): { ymd: string; dow: number } {
  const [y, mo, d] = ymd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return { ymd, dow: dt.getUTCDay() };
}

/** Today’s YYYY-MM-DD in the booking business timezone (default Asia/Kolkata). */
export function businessTodayYmd(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOKING_BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** @deprecated Prefer businessTodayYmd — kept for existing imports. */
export function serverTodayYmdLocal(): string {
  return businessTodayYmd();
}

/** Minutes since midnight in the booking business timezone. */
export function businessNowMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BOOKING_BUSINESS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  // en-GB can emit "24" for midnight in some runtimes
  const h = hour === 24 ? 0 : hour;
  return h * 60 + minute;
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

function parseBookedRange(value: string): { a: number; b: number } | null {
  const m = String(value || '')
    .trim()
    .match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!m) return null;
  const a = parseHm(m[1]);
  const b = parseHm(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return { a, b };
}

export function slotFreeOfBookings(slotStart: number, slotEnd: number, bookedValues: string[]): boolean {
  for (const v of bookedValues) {
    const r = parseBookedRange(v);
    if (!r) continue;
    if (rangesOverlap(slotStart, slotEnd, r.a, r.b)) return false;
  }
  return true;
}

export type BuildSlotsOptions = {
  /** When true, include taken slots with available:false. Default true for pickers. */
  includeUnavailable?: boolean;
  /** Override “now” for tests. */
  now?: Date;
};

/**
 * Build schedule windows for a date.
 * - Past slots for “today” (business TZ) are omitted.
 * - Taken slots are included with available:false when includeUnavailable is true.
 */
export function buildSlotsForDate(
  cfg: BookingAvailabilityV1,
  dateYmd: string,
  bookedTimeSlots: string[],
  slotMinutes: number,
  options: BuildSlotsOptions = {},
): BuiltSlot[] {
  const includeUnavailable = options.includeUnavailable !== false;
  const now = options.now ?? new Date();
  const todayYmd = businessTodayYmd(now);

  if (cfg.todayClosed && dateYmd === todayYmd) return [];
  if ((cfg.dateOffs || []).some((o) => o.date === dateYmd)) return [];

  const { dow } = ymdDow(dateYmd);
  const day = cfg.weekly[String(dow)];
  if (!day || !day.enabled) return [];

  const buf = Math.max(0, Math.min(240, Number(day.bufferMinutes) || 0));
  const slotLen = Math.max(15, Math.min(480, slotMinutes || 60));
  const nowMin = dateYmd === todayYmd ? businessNowMinutes(now) : null;

  const out: BuiltSlot[] = [];
  const pushSlot = (start: string, end: string) => {
    const a = parseHm(start);
    const b = parseHm(end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return;
    // Drop windows that have already started (or finished) on today.
    if (nowMin != null && a < nowMin) return;
    const value = `${start}-${end}`;
    const free = slotFreeOfBookings(a, b, bookedTimeSlots);
    if (!free && !includeUnavailable) return;
    out.push({ label: slotLabel(start, end), value, available: free });
  };

  const customs = Array.isArray(day.customSlots) ? day.customSlots : [];
  if (customs.length > 0) {
    for (const c of customs) {
      pushSlot(c.start, c.end);
    }
    return out;
  }

  const ws = parseHm(day.start);
  const we = parseHm(day.end);
  if (!Number.isFinite(ws) || !Number.isFinite(we) || we <= ws) return [];

  let cur = ws;
  while (cur + slotLen <= we) {
    const s = toHm(cur);
    const e = toHm(cur + slotLen);
    pushSlot(s, e);
    cur += slotLen + buf;
  }

  return out;
}
