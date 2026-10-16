/** What Today and the result screen show, worked out from the data and the plan. */
import { ZERO, type PaydayStep, type PlanResult } from '../engine';
import type { AppData, Debt } from '../data/types';
import { formatMoney, toCents } from '../lib/money';
import { diffDays, nextDueDate, shortDate } from '../lib/today';

export interface PaydayLine {
  key: string;
  label: string;
  /** Debt name to highlight (the focus debt) */
  highlight?: string;
  /** Rounded to cents, so the total always equals the sum of what's shown */
  amount: number;
  details?: { name: string; amount: number }[];
}

export function debtMap(data: AppData): Map<string, Debt> {
  return new Map(data.debts.map((d) => [d.id, d]));
}

export function paydayLines(row: PaydayStep, data: AppData): { lines: PaydayLine[]; total: number } {
  const debts = debtMap(data);
  const cur = data.settings.currency;
  const lines: PaydayLine[] = [];
  const mins = row.debts.filter((d) => toCents(d.minimum) > 0);
  if (mins.length) {
    lines.push({
      key: 'minimums',
      label: `Minimums due (${mins.length})`,
      amount: toCents(row.minimums),
      details: mins.map((d) => ({ name: debts.get(d.id)?.name ?? '', amount: toCents(d.minimum) })),
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
  const total = toCents(row.totalToSetAside);
  return { lines, total };
}

export interface FirstStep {
  date: string;
  kind: 'debt' | 'buffer' | 'minimums';
  amount: number;
  target: string;
}

/** "This payday (Fri 24 Oct): pay $150 to Store Card" */
export function firstStep(row: PaydayStep, data: AppData): FirstStep {
  const debts = debtMap(data);
  if (row.extraGoesTo) {
    const extra = row.debts.find((d) => d.id === row.extraGoesTo)!.extra;
    return { date: row.date, kind: 'debt', amount: extra, target: debts.get(row.extraGoesTo)?.name ?? '' };
  }
  if (row.bufferFirst) return { date: row.date, kind: 'buffer', amount: row.totalToSetAside, target: '' };
  return { date: row.date, kind: 'minimums', amount: row.minimums, target: 'your minimums' };
}

export function methodReason(method: AppData['settings']['method']): string {
  if (method === 'paidinyellow') return 'Smallest first, so you see a debt disappear soon.';
  if (method === 'biggest-interest') return 'Biggest interest first, so less of your money goes to interest.';
  return 'In the order you chose.';
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
