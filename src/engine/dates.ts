/**
 * Calendar helpers on plain ISO dates (YYYY-MM-DD). No Date objects and no time
 * zones, so a payday is the same day on every phone. Ported from the reference.
 */

export type Frequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly';

export interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseISO(iso: string): Ymd {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Not an ISO date: ${iso}`);
  const ymd = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  if (ymd.m < 1 || ymd.m > 12 || ymd.d < 1 || ymd.d > daysInMonth(ymd.y, ymd.m)) {
    throw new Error(`Not a real date: ${iso}`);
  }
  return ymd;
}

export function toISO({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

/** Days since 1970-01-01 (Howard Hinnant's days_from_civil). */
export function dayNumber({ y, m, d }: Ymd): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of dayNumber (civil_from_days). */
export function fromDayNumber(z: number): Ymd {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

export function addDays(date: Ymd, days: number): Ymd {
  return fromDayNumber(dayNumber(date) + days);
}

/** Same day n months later, clamped to the month's end (Jan 31 + 1 month = Feb 28/29). */
export function addMonths({ y, m, d }: Ymd, months: number): Ymd {
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = (((total % 12) + 12) % 12) + 1;
  return { y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) };
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return dayNumber(a) - dayNumber(b);
}

/**
 * Date of payday n (n = 1 is the next payday).
 * - weekly / every 2 weeks: +7 / +14 days
 * - monthly: the same day each month, clamped to the month's end
 * - twice a month: the given day, then 15 days later capped at that month's end, alternating.
 *   Note: matches the Sheet exactly, including a start on the 31st giving two paydays on the
 *   same date (open question for Azeddin, see engine tests).
 */
export function paydayDate(first: Ymd, frequency: Frequency, n: number): Ymd {
  switch (frequency) {
    case 'weekly':
      return addDays(first, 7 * (n - 1));
    case 'biweekly':
      return addDays(first, 14 * (n - 1));
    case 'monthly':
      return addMonths(first, n - 1);
    case 'twice-monthly': {
      if (n % 2 === 1) return addMonths(first, (n - 1) / 2);
      const a = addMonths(first, (n - 2) / 2);
      const later = addDays(a, 15);
      const monthEnd = { y: a.y, m: a.m, d: daysInMonth(a.y, a.m) };
      return compareYmd(later, monthEnd) <= 0 ? later : monthEnd;
    }
  }
}

export function paydayISO(firstISO: string, frequency: Frequency, n: number): string {
  return toISO(paydayDate(parseISO(firstISO), frequency, n));
}

/**
 * The first payday number whose date is on or after `dateISO` (1 if the date is before
 * the next payday). Used for "one-off money on a date" in the what-if.
 */
export function paydayNumberOnOrAfter(
  firstISO: string,
  frequency: Frequency,
  dateISO: string,
  maxPaydays = 520,
): number | null {
  const first = parseISO(firstISO);
  const target = parseISO(dateISO);
  for (let n = 1; n <= maxPaydays; n++) {
    if (compareYmd(paydayDate(first, frequency, n), target) >= 0) return n;
  }
  return null;
}
