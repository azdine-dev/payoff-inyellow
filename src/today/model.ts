/** What Today and the result screen show, worked out from the data and the plan. */
import { ZERO, type PaydayStep, type PlanResult } from '../engine';
import type { AppData, Debt } from '../data/types';
import { formatMoney, formatMoneyAuto, toCents } from '../lib/money';
import { totalOf, type BillsWindow } from '../state/billsDue';
import { addMonths, daysInMonth, parseISO, toISO } from '../engine/dates';
import { addDaysISO, dayMonth, diffDays, monthYear, nextDueDate, shortDate } from '../lib/today';

export interface PaydayLine {
  key: string;
  label: string;
  /** Debt name to highlight (the focus debt) */
  highlight?: string;
  /** Rounded to cents, so the total always equals the sum of what's shown */
  amount: number;
  /** The bill's due date (ISO), for "in 4 days" */
  due?: string;
  /** A bill: its amount is part of the label ("Car loan $285, due 28 Oct"), not in a column */
  inline?: boolean;
}

export function debtMap(data: AppData): Map<string, Debt> {
  return new Map(data.debts.map((d) => [d.id, d]));
}

/**
 * The Today card: the bills due before the next payday (each with its full monthly minimum and its
 * due date), yearly bills, buffer and extra. The total is their sum. The engine's per-payday
 * average of the minimums is not shown anywhere.
 */
export function paydayLines(row: PaydayStep, data: AppData, bills: BillsWindow): { lines: PaydayLine[]; total: number; noDueDay: BillsWindow['noDueDay'] } {
  const debts = debtMap(data);
  const cur = data.settings.currency;
  const lines: PaydayLine[] = [];
  for (const b of bills.due) {
    lines.push({
      key: `bill-${b.debtId}`,
      label: `${b.name} ${formatMoneyAuto(b.amount, cur)}, due ${dayMonth(b.due)}${b.autopay ? ', autopay' : ''}`,
      amount: b.amount,
      inline: true,
      due: b.due,
    });
  }
  if (toCents(row.toYearlyBills) > 0) lines.push({ key: 'yearly', label: 'Yearly bills', amount: toCents(row.toYearlyBills) });
  if (toCents(row.toBuffer) > 0) {
    const label = `Buffer (${formatMoney(data.buffer.amount, cur, { whole: true })} of ${formatMoney(data.settings.bufferGoal, cur, { whole: true })})`;
    lines.push({ key: 'buffer', label, amount: toCents(row.toBuffer) });
  }
  for (const d of row.debts) {
    if (toCents(d.extra) > 0) lines.push({ key: `extra-${d.id}`, label: 'Extra →', highlight: debts.get(d.id)?.name ?? '', amount: toCents(d.extra) });
  }
  return { lines, total: totalOf(bills, row), noDueDay: bills.noDueDay };
}

export interface FirstStep {
  date: string;
  kind: 'debt' | 'setaside' | 'nothing';
  /** What goes to the debt (kind 'debt'), or the whole total (kind 'setaside') */
  amount: number;
  /** Everything to move this payday: bills + yearly bills + buffer + extra */
  total: number;
  target: string;
}

/** "This payday (Fri 24 Oct): pay $150 to Store Card", or "set aside $235" when nothing goes to a debt yet. */
export function firstStep(row: PaydayStep, data: AppData, bills: BillsWindow): FirstStep {
  const debts = debtMap(data);
  const total = totalOf(bills, row);
  if (row.extraGoesTo) {
    const extra = row.debts.find((d) => d.id === row.extraGoesTo)!.extra;
    return { date: row.date, kind: 'debt', amount: extra, total, target: debts.get(row.extraGoesTo)?.name ?? '' };
  }
  return total > 0 ? { date: row.date, kind: 'setaside', amount: total, total, target: '' } : { date: row.date, kind: 'nothing', amount: 0, total: 0, target: '' };
}

export function methodReason(method: AppData['settings']['method']): string {
  if (method === 'paidinyellow') return 'Smallest first, so you see a debt disappear soon.';
  if (method === 'biggest-interest') return 'Biggest interest first, so less of your money goes to interest.';
  return 'In the order you chose.';
}

/**
 * The Today greeting. With a first name it is warmer; without one it is exactly the plain sentence.
 * `base` is the plain sentence, `kind` says which one it is.
 */
export function greetingWithName(base: string, kind: 'payday' | 'back' | 'other', name: string | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return base;
  if (kind === 'payday') return `Hi ${n}, it’s payday.`;
  if (kind === 'back') return `Welcome back, ${n}.`;
  return `Hi ${n}. ${base}`;
}

/** One line on why this debt is the one getting the extra. */
export function whyFirst(method: AppData['settings']['method'], grows: boolean): string {
  if (grows) return 'It grows even when you pay the minimum, so it goes first.';
  if (method === 'paidinyellow') return 'Smallest balance, so it disappears first.';
  if (method === 'biggest-interest') return 'Highest rate, so it costs you the most.';
  return 'First in the order you chose.';
}

/**
 * What goes to the focus debt on this payday: its extra, plus its own bill if that falls due before the next
 * payday. Rounded to cents. Zero while the buffer is filling and no bill is due.
 */
export function payThisPayday(row: PaydayStep | undefined, bills: BillsWindow, debtId: string): number {
  const extra = row?.debts.find((x) => x.id === debtId)?.extra ?? 0;
  const bill = bills.due.find((b) => b.debtId === debtId)?.amount ?? 0;
  return toCents(extra) + toCents(bill);
}

export interface FocusInfo {
  debt: Debt;
  pctGone: number;
  left: number;
  goneBy: string | null;
}

/** The one debt getting the extra (else the first in order). */
export function focusDebt(data: AppData, result: PlanResult): FocusInfo | null {
  const debts = debtMap(data);
  // Paid debts stay in the plan at 0, so skip them
  const id = result.rows[0]?.extraGoesTo ?? result.order.find((x) => (debts.get(x)?.balance ?? 0) > ZERO);
  const debt = id ? debts.get(id) : undefined;
  if (!debt) return null;
  const pctGone = debt.startBalance > 0 ? Math.max(0, Math.min(100, (1 - debt.balance / debt.startBalance) * 100)) : 0;
  return { debt, pctGone, left: debt.balance, goneBy: result.paidOff[debt.id] ?? null };
}

export interface DueItem {
  debtId: string;
  name: string;
  date: string;
  amount: number;
  autopay: boolean;
  /** upcoming = still ahead, paid = a payday already covered it, late = past its date and not paid yet */
  state: 'upcoming' | 'paid' | 'late';
}

/** True when a payday that was recorded as done paid this bill (the bill with this due date). */
export function billPaid(data: Pick<AppData, 'paydays'>, debtId: string, due: string): boolean {
  return data.paydays.some((p) => p.status === 'done' && p.bills?.some((b) => b.debtId === debtId && b.due === due));
}

/**
 * One bill on one date: paid (a payday carried it), late (its date passed after the plan began and nobody paid it),
 * or upcoming. Debts with no minimum never show as late.
 */
export function billState(data: Pick<AppData, 'paydays'>, debt: Pick<Debt, 'id' | 'minMonthly'>, due: string, today: string): 'paid' | 'late' | 'upcoming' {
  if (billPaid(data, debt.id, due)) return 'paid';
  const firstDone = data.paydays.filter((p) => p.status === 'done').map((p) => p.date).sort()[0];
  return due < today && firstDone !== undefined && due >= firstDone && debt.minMonthly > 0 ? 'late' : 'upcoming';
}

/** The last date before `fromISO` that a debt with this due day was due (clamped to the month end). */
export function prevDueDate(dueDay: number, fromISO: string): string {
  const from = parseISO(fromISO);
  const thisMonth = { y: from.y, m: from.m, d: Math.min(dueDay, daysInMonth(from.y, from.m)) };
  if (thisMonth.d < from.d) return toISO(thisMonth);
  const prev = addMonths({ y: from.y, m: from.m, d: 1 }, -1);
  return toISO({ ...prev, d: Math.min(dueDay, daysInMonth(prev.y, prev.m)) });
}

/**
 * Due dates in the next 14 days, plus a bill from the last 14 days that no payday has paid yet.
 * A late bill only shows once a payday has been done, so a new plan never opens on "not paid".
 */
export function comingUp(data: AppData, today: string): DueItem[] {
  const items: DueItem[] = [];
  const firstDone = data.paydays.filter((p) => p.status === 'done').map((p) => p.date).sort()[0];
  for (const d of data.debts) {
    if (d.status !== 'active' || !d.dueDay) continue;
    const base = { debtId: d.id, name: d.name, amount: d.minMonthly, autopay: d.autopay };
    const next = nextDueDate(d.dueDay, today);
    if (diffDays(today, next) <= 14) items.push({ ...base, date: next, state: billPaid(data, d.id, next) ? 'paid' : 'upcoming' });
    const prev = prevDueDate(d.dueDay, today);
    if (firstDone && prev >= firstDone && d.minMonthly > 0 && diffDays(prev, today) <= 14 && !billPaid(data, d.id, prev)) items.push({ ...base, date: prev, state: 'late' });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function dueLine(i: DueItem, data: AppData): string {
  return `${i.name} due ${shortDate(i.date)} · ${formatMoney(i.amount, data.settings.currency, { whole: Number.isInteger(i.amount) })}${i.autopay ? ' (autopay)' : ''}`;
}


// ------------------------------------------------------------------ the payday card (docs/ux-v2/ux-v2.md section 3)

export interface PayRow {
  key: string;
  kind: 'debt' | 'yearly' | 'buffer';
  /** "Store Card" */
  title: string;
  /** The small labels: Bill, Extra, Buffer, Yearly */
  tags: ('Bill' | 'Extra' | 'Buffer' | 'Yearly')[];
  /** "Bill $35 + extra $250 · due Sun 2 Nov" */
  sub: string;
  /** What the card says once it is paid: "Store Card, bill + extra" */
  paidLabel: string;
  /** Rounded to cents, so the total always equals the sum of the rows */
  amount: number;
  debtId?: string;
}

/**
 * One row per debt (its bill and its extra together), then the yearly bills pot, then the buffer. The amounts
 * add up to the total of the payday exactly: bills + yearly bills + buffer + extra.
 */
export function mergedRows(row: PaydayStep, data: AppData, bills: BillsWindow): { rows: PayRow[]; total: number; noDueDay: BillsWindow['noDueDay'] } {
  const debts = debtMap(data);
  const cur = data.settings.currency;
  const money = (n: number) => formatMoneyAuto(n, cur);
  const extras = new Map<string, number>();
  for (const d of row.debts) if (toCents(d.extra) > 0) extras.set(d.id, toCents(d.extra));

  const rows: PayRow[] = [];
  const done = new Set<string>();
  for (const b of bills.due) {
    const extra = extras.get(b.debtId) ?? 0;
    done.add(b.debtId);
    const auto = b.autopay ? ' · autopay' : '';
    rows.push({
      key: `debt-${b.debtId}`,
      kind: 'debt',
      title: b.name,
      tags: extra > 0 ? ['Bill', 'Extra'] : ['Bill'],
      sub: extra > 0 ? `Bill ${money(b.amount)} + extra ${money(extra)} · due ${shortDate(b.due)}${auto}` : `Bill, due ${shortDate(b.due)}${auto}`,
      paidLabel: extra > 0 ? `${b.name}, bill + extra` : `${b.name} bill`,
      amount: toCents(b.amount) + extra,
      debtId: b.debtId,
    });
  }
  for (const d of row.debts) {
    const extra = extras.get(d.id);
    if (!extra || done.has(d.id)) continue;
    const name = debts.get(d.id)?.name ?? '';
    rows.push({ key: `debt-${d.id}`, kind: 'debt', title: name, tags: ['Extra'], sub: `Extra ${money(extra)}`, paidLabel: `${name}, extra`, amount: extra, debtId: d.id });
  }
  if (toCents(row.toYearlyBills) > 0) {
    const names = data.funds.map((f) => f.name);
    const shown = names.length > 3 ? `${names.slice(0, 3).join(', ')}…` : names.join(', ');
    rows.push({ key: 'yearly', kind: 'yearly', title: 'Yearly bills pot', tags: ['Yearly'], sub: shown, paidLabel: 'Yearly bills pot', amount: toCents(row.toYearlyBills) });
  }
  if (toCents(row.toBuffer) > 0) {
    const sub = `${formatMoney(data.buffer.amount, data.settings.currency, { whole: true })} of ${formatMoney(data.settings.bufferGoal, data.settings.currency, { whole: true })}`;
    rows.push({ key: 'buffer', kind: 'buffer', title: 'Buffer', tags: ['Buffer'], sub, paidLabel: 'Buffer', amount: toCents(row.toBuffer) });
  }
  return { rows, total: totalOf(bills, row), noDueDay: bills.noDueDay };
}

/** "The extra $250 goes to Store Card": the extra that goes to debts this payday, and where. Null when the buffer takes it. */
export function extraSummary(row: PaydayStep, data: AppData): { amount: number; target: string } | null {
  const amount = row.debts.reduce((sum, d) => sum + toCents(d.extra), 0);
  if (amount <= 0 || !row.extraGoesTo) return null;
  return { amount, target: debtMap(data).get(row.extraGoesTo)?.name ?? '' };
}

/** True when the payday that matters is far enough ahead that the last one is done: the card is a countdown, not a button. */
export function betweenPaydays(data: AppData, nextDate: string, nextNumber: number, today: string): boolean {
  if (nextDate <= today) return false;
  return data.paydays.some((p) => p.number === nextNumber - 1 && p.status === 'done');
}

/** "64% gone. After today, one payday left." for the focus debt. */
export function focusSentence(pctGone: number, paydaysAfterToday: number | null, isPayday = true): string {
  const gone = `${Math.floor(pctGone)}% gone.`;
  if (paydaysAfterToday === null) return `${gone} Not gone within 20 years at this pace.`;
  if (!isPayday) {
    // Not a payday: count the next payday too, with no "after today"
    const left = paydaysAfterToday + 1;
    return left === 1 ? `${gone} The next payday pays it off.` : `${gone} ${left} paydays left.`;
  }
  if (paydaysAfterToday === 0) return `${gone} This payday pays it off.`;
  if (paydaysAfterToday === 1) return `${gone} After today, one payday left.`;
  return `${gone} After today, ${paydaysAfterToday} paydays left.`;
}

/**
 * The sentence after "I did it": "Store Card has $35 left. It's gone next payday. Then its $16.15 rolls to Visa."
 * `paydaysUntilGone` counts from the next payday (0 = the next payday pays it off). Null focus = every debt is paid.
 */
export function afterPaySentence(
  focus: { name: string; left: string; goneBy: string | null } | null,
  paydaysUntilGone: number | null,
  rollover: { amount: string; to: string } | null,
): string {
  if (!focus) return 'That was your last payment. You’re debt-free.';
  if (paydaysUntilGone === 0) {
    return `${focus.name} has ${focus.left} left. It’s gone next payday.${rollover ? ` Then its ${rollover.amount} rolls to ${rollover.to}.` : ''}`;
  }
  return `${focus.name} has ${focus.left} left.${focus.goneBy ? ` It’s gone by ${monthYear(focus.goneBy)}.` : ''}`;
}

/** What the debt cost per day about a month ago, from the paydays done then. Null until there is one. */
export function dailyCostLastMonth(data: Pick<AppData, 'paydays'>, today: string): number | null {
  const target = addDaysISO(today, -30);
  const near = data.paydays
    .filter((p) => p.status === 'done' && p.dailyCost !== undefined && p.date <= addDaysISO(today, -21) && p.date >= addDaysISO(today, -45))
    .sort((a, b) => Math.abs(diffDays(a.date, target)) - Math.abs(diffDays(b.date, target)));
  return near[0]?.dailyCost ?? null;
}


/** The paid card for a payday that is already done (after a reload, or coming back to Today): rebuilt from the logs. */
export function paidFromLog(data: AppData, number: number): { date: string; total: number; rows: { key: string; label: string; amount: number }[] } | null {
  const log = data.paydays.find((p) => p.number === number && p.status === 'done');
  if (!log) return null;
  const name = (id: string | null | undefined) => data.debts.find((x) => x.id === id)?.name ?? '';
  const pays = data.payments.filter((p) => p.paydayNumber === number);
  const rows: { key: string; label: string; amount: number }[] = [];
  if (log.bills) for (const b of log.bills) rows.push({ key: `b${b.debtId}`, label: `${b.name} bill`, amount: b.amount });
  for (const p of pays) {
    if (p.kind === 'minimum' && !log.bills) rows.push({ key: p.id, label: `${name(p.debtId)} bill`, amount: p.amount });
    if (p.kind === 'extra') rows.push({ key: p.id, label: `${name(p.debtId)}, extra`, amount: p.amount });
  }
  const fund = pays.filter((p) => p.kind === 'fund').reduce((sum, p) => sum + p.amount, 0);
  if (fund > 0) rows.push({ key: 'yearly', label: 'Yearly bills pot', amount: fund });
  const buffer = pays.filter((p) => p.kind === 'buffer').reduce((sum, p) => sum + p.amount, 0);
  if (buffer > 0) rows.push({ key: 'buffer', label: 'Buffer', amount: buffer });
  return { date: log.date, total: log.total, rows };
}
