/**
 * Calendar file (.ics): paydays, the if-then payday check, and due dates with a reminder
 * 3 days before. Works in Apple, Google and Outlook calendars.
 */
import { addMonths, daysInMonth, paydayISO, parseISO, toISO } from '../engine/dates';
import type { AppData } from '../data/types';
import { formatMoneyAuto } from './money';
import { addDaysISO } from './today';

const CRLF = '\r\n';

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a line at 75 bytes, as the format requires (never inside a multi-byte character). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // continuation lines start with a space
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join(CRLF + ' ');
}

const compact = (iso: string) => iso.replace(/-/g, '');
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`;

interface EventInit {
  uid: string;
  summary: string;
  description?: string;
  /** all-day date, ISO */
  date: string;
  /** "HH:MM" local time. Without it the event is all-day. */
  time?: string;
  alarmBeforeDays?: number;
  /** a repeat rule, like FREQ=MONTHLY;BYMONTHDAY=12 */
  rrule?: string;
}

function vevent(e: EventInit, now: Date): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}@paidinyellow`, `DTSTAMP:${stamp(now)}`];
  if (e.time) {
    const hhmm = e.time.replace(':', '').padEnd(4, '0').slice(0, 4);
    lines.push(`DTSTART:${compact(e.date)}T${hhmm}00`, 'DURATION:PT15M');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDaysISO(e.date, 1))}`);
  }
  if (e.rrule) lines.push(`RRULE:${e.rrule}`);
  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  lines.push('TRANSP:TRANSPARENT');
  if (e.time || e.alarmBeforeDays) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.summary)}`,
      `TRIGGER:${e.alarmBeforeDays ? `-P${e.alarmBeforeDays}D` : 'PT0S'}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/**
 * BYMONTHDAY for a due day. Days 29 to 31 also allow the last day of the month and keep the first match,
 * so a bill due on the 31st falls on the 30th, 28th or 29th in shorter months.
 */
export function monthlyDay(day: number): string {
  if (day <= 28) return `BYMONTHDAY=${day}`;
  const days = [];
  for (let d = day; d <= 31; d++) days.push(d);
  return `BYMONTHDAY=${days.join(',')},-1;BYSETPOS=1`;
}

/**
 * A link that opens Google Calendar with the payday check filled in. Title and time only:
 * no amounts and no debt names go into the link.
 */
export function googleCalendarUrl(data: AppData, today: string): string | null {
  const s = data.settings;
  let date = '';
  let second = '';
  for (let i = 1; i <= 3 && !date; i++) {
    const c = paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + i, s.otherPayday);
    if (c >= today) {
      date = c;
      second = paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + i + 1, s.otherPayday);
    }
  }
  if (!date) return null;
  const hhmm = (s.ifThen.time || '20:00').replace(':', '').padEnd(4, '0').slice(0, 4);
  const start = `${compact(date)}T${hhmm}00`;
  const end = `${compact(date)}T${String(Math.min(23, Number(hhmm.slice(0, 2)))).padStart(2, '0')}${String(Math.min(59, Number(hhmm.slice(2)) + 15)).padStart(2, '0')}00`;
  const dayOf = (iso: string) => parseISO(iso).d;
  const recur: Record<string, string | null> = {
    weekly: 'FREQ=WEEKLY',
    biweekly: 'FREQ=WEEKLY;INTERVAL=2',
    monthly: dayOf(date) <= 28 ? 'FREQ=MONTHLY' : null,
    'twice-monthly': dayOf(date) <= 28 && dayOf(second) <= 28 ? `FREQ=MONTHLY;BYMONTHDAY=${[dayOf(date), dayOf(second)].sort((a, b) => a - b).join(',')}` : null,
  };
  const q = new URLSearchParams({ action: 'TEMPLATE', text: 'Open PaidInYellow: payday check', dates: `${start}/${end}` });
  const rule = recur[s.frequency];
  if (rule) q.set('recur', `RRULE:${rule}`);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export interface IcsOptions {
  /** how far ahead to write events, in days. Default 365. */
  days?: number;
  now?: Date;
}

export function buildIcs(data: AppData, today: string, opts: IcsOptions = {}): string {
  const s = data.settings;
  const cur = s.currency;
  const now = opts.now ?? new Date();
  const end = addDaysISO(today, opts.days ?? 365);
  const events: string[] = [];

  // Paydays and the payday check (from the next payday on)
  for (let i = 1; i <= 600; i++) {
    const date = paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + i, s.otherPayday);
    if (date > end) break;
    if (date < today) continue;
    events.push(...vevent({ uid: `payday-${date}`, summary: 'Payday', date }, now));
    events.push(
      ...vevent(
        {
          uid: `check-${date}`,
          summary: 'Open PaidInYellow: payday check',
          description: 'One clear step: see what to pay this payday and tick it off.',
          date,
          time: s.ifThen.time || '20:00',
        },
        now,
      ),
    );
  }

  // One reminder per debt that repeats every month, with an alert 3 days before
  const from = parseISO(today);
  for (const debt of data.debts) {
    if (debt.status !== 'active' || !debt.dueDay) continue;
    // The first due date on or after today (short months use their last day)
    let date = '';
    for (let m = 0; m <= 1 && !date; m++) {
      const month = addMonths({ y: from.y, m: from.m, d: 1 }, m);
      const c = toISO({ ...month, d: Math.min(debt.dueDay, daysInMonth(month.y, month.m)) });
      if (c >= today) date = c;
    }
    const amount = debt.minMonthly > 0 ? ` (minimum ${formatMoneyAuto(debt.minMonthly, cur)})` : '';
    events.push(
      ...vevent(
        {
          uid: `due-${debt.id}`,
          summary: `${debt.name} due${amount}${debt.autopay ? ', autopay' : ''}`,
          date,
          alarmBeforeDays: 3,
          rrule: `FREQ=MONTHLY;${monthlyDay(debt.dueDay)};UNTIL=${compact(end)}`,
        },
        now,
      ),
    );
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PaidInYellow//Paycheck Payoff Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PaidInYellow',
    ...events,
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
