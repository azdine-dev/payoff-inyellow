/** Chart data for Progress: your plan against minimums only. */
import { dayNumber, parseISO } from '../engine/dates';
import type { PlanResult } from '../engine';

export interface Point {
  /** days from today */
  x: number;
  /** total debt left */
  y: number;
}

/** Total owed after each month if only the monthly minimums are paid. Index 0 = now. */
export function minimumsOnlySeries(
  debts: readonly { balance: number; apr: number; minMonthly: number }[],
  months: number,
): number[] {
  const bal = debts.map((d) => d.balance);
  const out = [bal.reduce((a, b) => a + b, 0)];
  for (let m = 1; m <= months; m++) {
    for (let i = 0; i < bal.length; i++) {
      const d = debts[i]!;
      bal[i] = Math.max(0, bal[i]! * (1 + d.apr / 1200) - d.minMonthly);
    }
    out.push(bal.reduce((a, b) => a + b, 0));
  }
  return out;
}

export interface ChartData {
  plan: Point[];
  minimums: Point[];
  xMax: number;
  yMax: number;
  /** months until minimums-only ends, null = never */
  minimumsMonths: number | null;
}

export function chartData(
  today: string,
  debts: readonly { balance: number; apr: number; minMonthly: number }[],
  result: PlanResult,
  owed: number,
): ChartData {
  const t0 = dayNumber(parseISO(today));
  const plan: Point[] = [{ x: 0, y: owed }];
  for (const row of result.rows) {
    plan.push({ x: Math.max(0, dayNumber(parseISO(row.date)) - t0), y: row.debtLeft });
  }
  const planEnd = plan[plan.length - 1]!.x;
  const planMonths = Math.max(1, Math.ceil(planEnd / 30.44));
  const minMonths = result.minimumsOnly.months;
  const horizon = Math.min(240, Math.max(planMonths, minMonths ?? Math.ceil(planMonths * 1.6), 6));
  const series = minimumsOnlySeries(debts, horizon);
  const all = series.map((y, m) => ({ x: Math.round(m * 30.44), y }));
  // Keep the chart readable: show up to 1.6x the plan, and say in words when minimums-only ends
  const xMax = Math.max(planEnd, Math.min(all[all.length - 1]!.x, Math.round(planEnd * 1.6)), 1);
  const minimums = all.filter((p) => p.x <= xMax);
  const next = all.find((p) => p.x > xMax);
  const last = minimums[minimums.length - 1]!;
  if (next && last.x < xMax) {
    minimums.push({ x: xMax, y: last.y + ((next.y - last.y) * (xMax - last.x)) / (next.x - last.x) });
  }
  return { plan, minimums, xMax, yMax: Math.max(owed, 1), minimumsMonths: minMonths };
}
