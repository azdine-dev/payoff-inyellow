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
 * The two pay days of the month for "twice a month": [first, second, day of the first payday].
 * 31 means the last day of the month. Ported from twice_a_month_days() in the reference.
 * Without `other`: a day up to the 15th pairs with day + 15, the last day of a month pairs with
 * the 15th, any other day after the 15th pairs with day - 15.
 */
export function twiceAMonthDays(first: Ymd, other?: number | null): [number, number, number] {
  const d = first.d === daysInMonth(first.y, first.m) ? 31 : first.d;
  let o = other ?? 0;
  if (!o || o === d) o = d <= 15 ? d + 15 : d === 31 ? 15 : d - 15;
  return [Math.min(d, o), Math.max(d, o), d];
}

/**
 * Date of payday n (n = 1 is the first payday of the schedule).
 * - weekly / every 2 weeks: +7 / +14 days
 * - monthly: the same day each month, clamped to the month's end
 * - twice a month: two fixed days of the month (`other` is the second one, 31 = last day),
 *   capped at the month's end, alternating
 */
export function paydayDate(first: Ymd, frequency: Frequency, n: number, other?: number | null): Ymd {
  switch (frequency) {
    case 'weekly':
      return addDays(first, 7 * (n - 1));
    case 'biweekly':
      return addDays(first, 14 * (n - 1));
    case 'monthly':
      return addMonths(first, n - 1);
    case 'twice-monthly': {
      const [lo, hi, d] = twiceAMonthDays(first, other);
      const idx = n - 1 + (d === lo ? 0 : 1);
      const month = addMonths({ y: first.y, m: first.m, d: 1 }, Math.floor(idx / 2));
      return { y: month.y, m: month.m, d: Math.min(idx % 2 === 0 ? lo : hi, daysInMonth(month.y, month.m)) };
    }
  }
}

export function paydayISO(firstISO: string, frequency: Frequency, n: number, other?: number | null): string {
  return toISO(paydayDate(parseISO(firstISO), frequency, n, other));
}

/**
 * The first payday number whose date is on or after `dateISO` (1 if the date is before
 * the first payday). Used for "one-off money on a date" in the what-if.
 */
export function paydayNumberOnOrAfter(
  firstISO: string,
  frequency: Frequency,
  dateISO: string,
  maxPaydays = 520,
  other?: number | null,
): number | null {
  const first = parseISO(firstISO);
  const target = parseISO(dateISO);
  for (let n = 1; n <= maxPaydays; n++) {
    if (compareYmd(paydayDate(first, frequency, n, other), target) >= 0) return n;
  }
  return null;
}

/** The first date in [from, to) on which a bill with this due day falls (clamped to the month's end), or null. */
export function dueDateIn(dueDay: number, from: string, to: string): string | null {
  const a = parseISO(from);
  const b = parseISO(to);
  const months = (b.y - a.y) * 12 + (b.m - a.m);
  for (let i = 0; i <= months; i++) {
    const m = addMonths({ y: a.y, m: a.m, d: 1 }, i);
    const iso = toISO({ y: m.y, m: m.m, d: Math.min(dueDay, daysInMonth(m.y, m.m)) });
    if (iso >= from && iso < to) return iso;
  }
  return null;
}
