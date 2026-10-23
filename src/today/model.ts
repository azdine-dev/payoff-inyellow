/** What Today and the result screen show, worked out from the data and the plan. */
import { ZERO, type PaydayStep, type PlanResult } from '../engine';
import type { AppData, Debt } from '../data/types';
import { formatMoney, formatMoneyAuto, toCents } from '../lib/money';
import { totalOf, type BillsWindow } from '../state/billsDue';
import { dayMonth, diffDays, nextDueDate, shortDate } from '../lib/today';

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
  name: string;
  date: string;
  amount: number;
  autopay: boolean;
}

/** Due dates in the next 14 days. */
export function comingUp(data: AppData, today: string): DueItem[] {
  return data.debts
    .filter((d) => d.status === 'active' && d.dueDay)
    .map((d) => ({ name: d.name, date: nextDueDate(d.dueDay!, today), amount: d.minMonthly, autopay: d.autopay }))
    .filter((i) => diffDays(today, i.date) <= 14)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function dueLine(i: DueItem, data: AppData): string {
  return `${i.name} due ${shortDate(i.date)} · ${formatMoney(i.amount, data.settings.currency, { whole: Number.isInteger(i.amount) })}${i.autopay ? ' (autopay)' : ''}`;
}
