/**
 * "Balance, payday by payday": the numbers behind the small chart on Today. A line of what was owed at each payday
 * done, then what the plan says for the paydays ahead, down to zero on the debt-free date.
 */
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { diffDays } from '../lib/today';

export interface Pt {
  /** days since the start of the chart */
  x: number;
  /** total owed */
  y: number;
}

export interface MiniChartModel {
  /** What was owed at the start */
  start: number;
  /** What is owed now */
  owed: number;
  /** Start minus owed: "Down $X since you started" */
  down: number;
  /** From the start to now: the paydays that are done */
  history: Pt[];
  /** From now to the end of the plan */
  ahead: Pt[];
  /** Where "you are here" is */
  here: Pt;
  xMax: number;
  yMax: number;
  /** The plan reaches zero: the last point of `ahead` is 0 */
  endsAtZero: boolean;
}

const MAX_AHEAD = 120;

export function miniChartModel(d: AppData, r: PlanResult, stats: { start: number; owed: number }, today: string): MiniChartModel {
  const done = [...d.paydays].filter((p) => p.status === 'done' && p.debtLeft !== undefined).sort((a, b) => a.number - b.number);
  const origin = done.length ? done[0]!.date : today;
  const dayOf = (iso: string) => Math.max(0, diffDays(origin, iso));
  const start = Math.max(stats.start, stats.owed);

  const history: Pt[] = [{ x: 0, y: start }];
  for (const p of done) history.push({ x: dayOf(p.date), y: p.debtLeft! });
  const hereX = Math.max(dayOf(today), history[history.length - 1]!.x);
  const here: Pt = { x: hereX, y: stats.owed };
  if (history[history.length - 1]!.x !== hereX || history[history.length - 1]!.y !== stats.owed) history.push(here);

  const ahead: Pt[] = [here];
  const rows = r.rows.slice(0, MAX_AHEAD);
  for (const row of rows) ahead.push({ x: Math.max(hereX, dayOf(row.date)), y: row.debtLeft });
  const endsAtZero = Boolean(r.debtFreeDate) && r.rows.length <= MAX_AHEAD;
  if (endsAtZero) {
    const last = ahead[ahead.length - 1]!;
    if (last.y > 0.005) ahead.push({ x: last.x, y: 0 });
    else last.y = 0;
  }

  return { start, owed: stats.owed, down: Math.max(0, stats.start - stats.owed), history, ahead, here, xMax: Math.max(1, ahead[ahead.length - 1]!.x), yMax: Math.max(1, start), endsAtZero };
}
