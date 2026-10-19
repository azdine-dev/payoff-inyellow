/**
 * Bills due between one payday and the next, as the buyer sees them on Today.
 *
 * The engine plans with an average ("minimum x 12 / paydays a year") to get the payoff date.
 * That average stays inside the engine. What the buyer sets aside on a payday is real:
 * the bills whose due day falls between this payday and the next one, each with its full
 * monthly minimum, plus yearly bills, plus buffer and extra.
 */
import { addMonths, daysInMonth, paydayISO, parseISO, toISO, ZERO, type PaydayStep, type PlanResult } from '../engine';
import type { AppData, Debt, Settings } from '../data/types';
import { toCents } from '../lib/money';

export interface BillDue {
  debtId: string;
  name: string;
  /** The full monthly minimum, or less when the debt is nearly paid */
  amount: number;
  /** ISO date */
  due: string;
  autopay: boolean;
}

export interface BillNoDay {
  debtId: string;
  name: string;
  amount: number;
}

export interface BillsWindow {
  /** In order of due date */
  due: BillDue[];
  /** Debts with a minimum but no due day: shown, never counted (we can't tell which payday they belong to) */
  noDueDay: BillNoDay[];
  /** Sum of `due`, to the cent */
  total: number;
}

export interface BillDebt {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minMonthly: number;
  dueDay: number | null;
  autopay: boolean;
}

/** The first date in [from, to) that a bill with this due day is due (clamped to the month's end), or null. */
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

/** What is asked for this month: the full minimum, never more than the debt itself. */
export function billAmount(d: Pick<BillDebt, 'balance' | 'apr' | 'minMonthly'>): number {
  return toCents(Math.min(d.minMonthly, d.balance * (1 + d.apr / 1200)));
}

/** Bills due from `from` (this payday, included) up to `to` (the next payday, not included). */
export function billsBetween(debts: readonly BillDebt[], from: string, to: string): BillsWindow {
  const due: BillDue[] = [];
  const noDueDay: BillNoDay[] = [];
  for (const d of debts) {
    if (d.balance <= ZERO || d.minMonthly <= 0) continue;
    const amount = billAmount(d);
    if (!d.dueDay) {
      noDueDay.push({ debtId: d.id, name: d.name, amount });
      continue;
    }
    const date = dueDateIn(d.dueDay, from, to);
    if (date) due.push({ debtId: d.id, name: d.name, amount, due: date, autopay: d.autopay });
  }
  due.sort((x, y) => x.due.localeCompare(y.due)); // stable: debts due the same day keep the order entered
  return { due, noDueDay, total: toCents(due.reduce((s, b) => s + b.amount, 0)) };
}

const toBillDebt = (d: Debt, balance = d.balance): BillDebt => ({
  id: d.id,
  name: d.name,
  balance,
  apr: d.apr,
  minMonthly: d.minMonthly,
  dueDay: d.dueDay,
  autopay: d.autopay,
});

/** Date of the payday `ahead` paydays after the next one (0 = the next payday). */
export function paydayAhead(s: Settings, ahead: number): string {
  return paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + 1 + ahead, s.otherPayday);
}

/** The bills for the next payday: due from that payday up to the one after it. */
export function billsForNextPayday(data: AppData): BillsWindow {
  const s = data.settings;
  const debts = data.debts.filter((d) => d.status === 'active').map((d) => toBillDebt(d));
  return billsBetween(debts, paydayAhead(s, 0), paydayAhead(s, 1));
}

/** The bills for the i-th payday of the plan (0 = next), using each debt's balance at that point. */
export function billsForPlanRow(data: AppData, result: PlanResult, i: number): BillsWindow {
  const s = data.settings;
  const row = result.rows[i];
  if (!row) return { due: [], noDueDay: [], total: 0 };
  const before = new Map(row.debts.map((x) => [x.id, x.balanceBefore]));
  const debts = data.debts.filter((d) => d.status !== 'archived').map((d) => toBillDebt(d, before.get(d.id) ?? 0));
  return billsBetween(debts, paydayAhead(s, i), paydayAhead(s, i + 1));
}

/**
 * What to set aside on a payday: the bills due + yearly bills + buffer + extra. Every part is
 * rounded to the cent and the total is their sum, so it always equals what is listed.
 */
export function totalOf(bills: BillsWindow, step: Pick<PaydayStep, 'toYearlyBills' | 'toBuffer' | 'debts'>): number {
  const extras = step.debts.reduce((s, d) => s + toCents(d.extra), 0);
  return toCents(bills.total + toCents(step.toYearlyBills) + toCents(step.toBuffer) + extras);
}
