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
  /** how far ahead to write events, in days. Default: 12 months. */
  days?: number;
  now?: Date;
}

/** The same date 12 months on (the 29th of February becomes the 28th) */
export function twelveMonthsOn(iso: string): string {
  const t = parseISO(iso);
  const m = addMonths({ y: t.y, m: t.m, d: 1 }, 12);
  return toISO({ ...m, d: Math.min(t.d, daysInMonth(m.y, m.m)) });
}

/** A day of the month for a payday date: the last day of the month stays "-1", so short months still match. */
function paydayMonthDay(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return d >= 29 && d === daysInMonth(y, m) ? '-1' : String(d);
}

/**
 * The repeat rule of the pay schedule, from the first two paydays on or after today:
 * every week, every 2 weeks, one day a month, or two days a month. Month-end paydays use the last day.
 */
export function paydayRule(frequency: AppData['settings']['frequency'], first: string, second: string): string {
  switch (frequency) {
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'biweekly':
      return 'FREQ=WEEKLY;INTERVAL=2';
    case 'monthly':
      return `FREQ=MONTHLY;${monthlyDay(parseISO(first).d)}`;
    default: {
      const days = [paydayMonthDay(first), paydayMonthDay(second)].sort((a, b) => (a === '-1' ? 1 : b === '-1' ? -1 : Number(a) - Number(b)));
      return `FREQ=MONTHLY;BYMONTHDAY=${[...new Set(days)].join(',')}`;
    }
  }
}

export function buildIcs(data: AppData, today: string, opts: IcsOptions = {}): string {
  const s = data.settings;
  const cur = s.currency;
  const now = opts.now ?? new Date();
  const end = opts.days !== undefined ? addDaysISO(today, opts.days) : twelveMonthsOn(today);
  const events: string[] = [];

  // Paydays and the payday check: one event each, repeating with the pay schedule for 12 months
  const upcoming: string[] = [];
  for (let i = 1; i <= 600 && upcoming.length < 2; i++) {
    const date = paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + i, s.otherPayday);
    if (date >= today) upcoming.push(date);
  }
  if (upcoming.length === 2 && upcoming[0]! <= end) {
    const first = upcoming[0]!;
    const rule = paydayRule(s.frequency, first, upcoming[1]!);
    events.push(...vevent({ uid: 'payday', summary: 'Payday', date: first, rrule: `${rule};UNTIL=${compact(end)}` }, now));
    events.push(
      ...vevent(
        {
          uid: 'check',
          summary: 'Open PaidInYellow: payday check',
          description: 'One clear step: see what to pay this payday and tick it off.',
          date: first,
          time: s.ifThen.time || '20:00',
          // a timed event ends its repeat with a time, written the same way as its start (no zone)
          rrule: `${rule};UNTIL=${compact(end)}T235959`,
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
