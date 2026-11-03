/**
 * Your whole plan (design/path-features/WholePlan): what you will pay to your debts in total, plan against
 * minimums only, the next 30 days split, and totals by year. Pure, so it can be tested.
 */
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { diffDays } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { activeDebts } from '../state/planInput';

export interface WholePlan {
  debtCount: number;
  owed: number;
  interest: number;
  /** Debts and their interest, in total */
  total: number;
  /** Interest with minimums only. Null when it never ends. */
  minimumsInterest: number | null;
  /** Interest you keep. Null when there is no comparison. */
  kept: number | null;
  paydays: number;
  from: string | null;
  to: string | null;
  next30: { paydays: number; debts: number; buffer: number; yearly: number; total: number };
  byYear: { year: number; paydays: number; total: number }[];
}

export function buildWholePlan(d: AppData, r: PlanResult, today: string): WholePlan {
  const debts = activeDebts(d);
  const owed = debts.reduce((s, x) => s + x.balance, 0);
  const interest = r.totalInterest;
  const min = r.minimumsOnly.neverEnds ? null : r.minimumsOnly.totalInterest;

  const next30 = { paydays: 0, debts: 0, buffer: 0, yearly: 0, total: 0 };
  const years = new Map<number, { paydays: number; total: number }>();
  r.rows.forEach((row, i) => {
    const bills = billsForPlanRow(d, r, i);
    const total = totalOf(bills, row);
    const y = Number(row.date.slice(0, 4));
    const cur = years.get(y) ?? { paydays: 0, total: 0 };
    years.set(y, { paydays: cur.paydays + 1, total: cur.total + total });
    const days = diffDays(today, row.date);
    if (days >= 0 && days <= 30) {
      next30.paydays += 1;
      next30.debts += bills.total + row.debts.reduce((s, x) => s + x.extra, 0);
      next30.buffer += row.toBuffer;
      next30.yearly += row.toYearlyBills;
      next30.total += total;
    }
  });

  return {
    debtCount: debts.length,
    owed,
    interest,
    total: owed + interest,
    minimumsInterest: min,
    kept: min === null ? null : Math.max(0, min - interest),
    paydays: r.rows.length,
    from: r.rows[0]?.date ?? null,
    to: r.rows[r.rows.length - 1]?.date ?? null,
    next30,
    byYear: [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, ...v })),
  };
}
