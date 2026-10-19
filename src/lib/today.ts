/** Local-date helpers for the screens. Stored dates are ISO YYYY-MM-DD, no time zones. */
import { addMonths, daysInMonth, dayNumber, fromDayNumber, parseISO, toISO } from '../engine/dates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Today on this phone, in local time (not UTC). */
export function todayISO(now = new Date()): string {
  return toISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export function addDaysISO(iso: string, days: number): string {
  return toISO(fromDayNumber(dayNumber(parseISO(iso)) + days));
}

export function diffDays(fromISO: string, toDate: string): number {
  return dayNumber(parseISO(toDate)) - dayNumber(parseISO(fromISO));
}

/** Calendar months from one date to another (Oct 2026 to Mar 2028 = 17). */
export function monthsBetween(fromISO: string, toDate: string): number {
  const a = parseISO(fromISO);
  const b = parseISO(toDate);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function weekdayIndex(iso: string): number {
  return (((dayNumber(parseISO(iso)) + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)]!;
}

/** "Fri 24 Oct" */
export function shortDate(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${WEEKDAYS[weekdayIndex(iso)]!.slice(0, 3)} ${d} ${MONTHS[m - 1]!.slice(0, 3)}`;
}

/** "March 2028" */
export function monthYear(iso: string): string {
  const { y, m } = parseISO(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Mar 2028" */
export function shortMonthYear(iso: string): string {
  const { y, m } = parseISO(iso);
  return `${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
}

export function firstOfNextMonth(iso: string): string {
  const { y, m } = addMonths(parseISO(iso), 1);
  return toISO({ y, m, d: 1 });
}

/** Next date (on or after fromISO) a debt with this due day is due, clamped to the month end. */
export function nextDueDate(dueDay: number, fromISO: string): string {
  const from = parseISO(fromISO);
  const thisMonth = { y: from.y, m: from.m, d: Math.min(dueDay, daysInMonth(from.y, from.m)) };
  if (thisMonth.d >= from.d) return toISO(thisMonth);
  const next = addMonths({ y: from.y, m: from.m, d: 1 }, 1);
  return toISO({ ...next, d: Math.min(dueDay, daysInMonth(next.y, next.m)) });
}

/** "8 pm", "8:30 pm" from "20:00" / "20:30" */
export function timeLabel(hhmm: string): string {
  const [h = 20, min = 0] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min ? `${h12}:${String(min).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

/** "28 Oct" */
export function dayMonth(iso: string): string {
  const { m, d } = parseISO(iso);
  return `${d} ${MONTHS[m - 1]!.slice(0, 3)}`;
}
