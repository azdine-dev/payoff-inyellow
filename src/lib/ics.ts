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
}

function vevent(e: EventInit, now: Date): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}@paidinyellow`, `DTSTAMP:${stamp(now)}`];
  if (e.time) {
    const hhmm = e.time.replace(':', '').padEnd(4, '0').slice(0, 4);
    lines.push(`DTSTART:${compact(e.date)}T${hhmm}00`, 'DURATION:PT15M');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDaysISO(e.date, 1))}`);
  }
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
    const date = paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + i);
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

  // Due dates, with a reminder 3 days before
  const from = parseISO(today);
  const to = parseISO(end);
  const monthsSpan = (to.y - from.y) * 12 + (to.m - from.m);
  for (const debt of data.debts) {
    if (debt.status !== 'active' || !debt.dueDay) continue;
    for (let m = 0; m <= monthsSpan + 1; m++) {
      const month = addMonths({ y: from.y, m: from.m, d: 1 }, m);
      const date = toISO({ ...month, d: Math.min(debt.dueDay, daysInMonth(month.y, month.m)) });
      if (date < today || date > end) continue;
      const amount = debt.minMonthly > 0 ? ` (minimum ${formatMoneyAuto(debt.minMonthly, cur)})` : '';
      events.push(
        ...vevent(
          {
            uid: `due-${debt.id}-${date}`,
            summary: `${debt.name} due${amount}${debt.autopay ? ', autopay' : ''}`,
            date,
            alarmBeforeDays: 3,
          },
          now,
        ),
      );
    }
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
