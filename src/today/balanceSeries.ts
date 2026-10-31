/**
 * "Balance, payday by payday": the numbers behind the small chart on Today. One point per payday: what was owed at the
 * start, after each payday that is done, then what the plan says for the paydays ahead, down to zero.
 */
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';

export interface ChartPoint {
  /** the payday: 0 is the start, 1 the first payday done, and so on */
  i: number;
  /** total owed */
  y: number;
}

export type Caption = 'dayOne' | 'lower' | 'same' | 'higher';

export interface MiniChartModel {
  /** What was owed at the start */
  start: number;
  /** What is owed now */
  owed: number;
  /** Start minus owed */
  down: number;
  /** The whole line, from the start to the end of the plan */
  line: ChartPoint[];
  /** Paydays that are done (the yellow dots) */
  paid: ChartPoint[];
  /** Where you are now (the highlighted dot) */
  here: ChartPoint;
  /** The paydays that are done */
  doneCount: number;
  xMax: number;
  yMax: number;
  /** The plan reaches zero: the last point of the line is 0 */
  endsAtZero: boolean;
  caption: Caption;
}

const MAX_AHEAD = 120;

export function miniChartModel(d: Pick<AppData, 'paydays'>, r: Pick<PlanResult, 'rows' | 'debtFreeDate'>, stats: { start: number; owed: number }): MiniChartModel {
  const done = [...d.paydays].filter((p) => p.status === 'done').sort((a, b) => a.number - b.number);
  const start = Math.max(stats.start, stats.owed);
  const line: ChartPoint[] = [{ i: 0, y: start }];
  const paid: ChartPoint[] = [];
  let carry = start;
  done.forEach((p, k) => {
    // older logs may not know what was left: keep the line where it was
    const y = p.debtLeft ?? carry;
    carry = y;
    const pt = { i: k + 1, y };
    line.push(pt);
    paid.push(pt);
  });
  const n = done.length;
  // "You are here" is after the last payday done, and after any extra money paid since
  const here: ChartPoint = { i: n, y: stats.owed };
  if (n > 0) line[line.length - 1] = { ...here };
  else if (Math.abs(stats.owed - start) > 0.005) line.push({ ...here });

  const rows = r.rows.slice(0, MAX_AHEAD);
  rows.forEach((row, k) => line.push({ i: n + 1 + k, y: row.debtLeft }));
  const endsAtZero = Boolean(r.debtFreeDate) && r.rows.length <= MAX_AHEAD;
  if (endsAtZero) {
    const last = line[line.length - 1]!;
    if (last.y > 0.005) line.push({ i: last.i, y: 0 });
    else last.y = 0;
  }

  const prev = n >= 2 ? line[n - 1]!.y : start;
  const caption: Caption = n === 0 ? 'dayOne' : stats.owed < prev - 0.005 ? 'lower' : stats.owed > prev + 0.005 ? 'higher' : 'same';
  return { start, owed: stats.owed, down: Math.max(0, stats.start - stats.owed), line, paid, here, doneCount: n, xMax: Math.max(1, line[line.length - 1]!.i), yMax: Math.max(1, start), endsAtZero, caption };
}

export const CAPTIONS: Record<Caption, string> = {
  dayOne: 'Day one. Your line starts here.',
  lower: 'Lower than last payday.',
  same: 'The same as last payday.',
  higher: 'A little higher than last payday. That happens.',
};
