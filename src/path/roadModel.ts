/**
 * The Road on Path: one square per payday from the bottom (the start) to the top (the finish).
 * This file works out what goes where; Road.tsx draws it. Pure, so it can be tested.
 */
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { shortDate } from '../lib/today';

/** Squares drawn at most, like the old payday grid. Longer plans say how many paydays come after. */
export const MAX_SQUARES = 156;

export type SquareKind = 'start' | 'paid' | 'skipped' | 'next' | 'ahead';

export interface RoadSquare {
  index: number;
  kind: SquareKind;
  /** Spoken name: "Fri 6 Nov, next payday" */
  label: string;
  date?: string;
  /** Payday log number, for the paid and skipped ones */
  number?: number;
}

export interface RoadFlag {
  key: string;
  kind: 'debt' | 'half' | 'finish';
  /** The square it stands on */
  index: number;
  title: string;
  date: string | null;
  /** What was paid off (debt flags) */
  amount?: number;
  paid: boolean;
  debtId?: string;
  /** A debt flag on the finish square: the finish flag is drawn, this one is only kept for the sheet and the tests */
  merged?: boolean;
}

export interface RoadModel {
  squares: RoadSquare[];
  flags: RoadFlag[];
  /** The next payday square, where "You are here" stands. Null when there is nothing ahead. */
  pinIndex: number | null;
  /** The square the finish flag stands on. Null when the plan does not end within 20 years. */
  finishIndex: number | null;
  /** The first square after the paydays already done or skipped */
  firstAhead: number;
  /** Paydays in the plan that are not drawn */
  hiddenAhead: number;
}

export function buildRoad(d: AppData, r: PlanResult, startTotal: number, pctGone: number, today: string): RoadModel {
  const past = [...d.paydays].sort((a, b) => a.number - b.number);
  const squares: RoadSquare[] = [
    { index: 0, kind: 'start', label: 'Debts listed' },
    { index: 1, kind: 'start', label: 'Plan made' },
  ];
  past.forEach((p, i) =>
    squares.push({ index: 2 + i, kind: p.status === 'done' ? 'paid' : 'skipped', label: `${shortDate(p.date, today)}, ${p.status === 'done' ? 'paid' : 'skipped'}`, date: p.date, number: p.number }),
  );
  const firstAhead = squares.length;
  const room = Math.max(0, MAX_SQUARES - firstAhead);
  const shown = Math.min(r.rows.length, room);
  for (let i = 0; i < shown; i++) {
    const row = r.rows[i]!;
    squares.push({ index: firstAhead + i, kind: i === 0 ? 'next' : 'ahead', label: `${shortDate(row.date, today)}, ${i === 0 ? 'next payday' : 'to come'}`, date: row.date });
  }

  const flags: RoadFlag[] = [];
  const finishIndex = r.debtFreeDate && r.rows.length > 0 && r.rows.length <= shown ? firstAhead + r.rows.length - 1 : null;

  // Debts still to pay: a flag on the payday that takes them to zero
  const rowOf = (id: string) => r.rows.findIndex((row) => row.debts.some((x) => x.id === id && x.balanceAfter <= 0.005));
  for (const debt of d.debts) {
    if (debt.status === 'active') {
      const i = rowOf(debt.id);
      if (i < 0 || i >= shown) continue;
      const index = firstAhead + i;
      flags.push({ key: `debt-${debt.id}`, kind: 'debt', index, title: debt.name, date: r.rows[i]!.date, amount: debt.startBalance, paid: false, debtId: debt.id, merged: index === finishIndex });
    } else if (debt.status === 'paid') {
      // Paid: the square of the payday that carried its last payment, else the latest payday done
      const last = [...d.payments].filter((p) => p.debtId === debt.id).sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt).pop();
      const at = last?.paydayNumber != null ? past.findIndex((p) => p.number === last.paydayNumber) : -1;
      const pastDone = past.map((p, i) => (p.status === 'done' ? i : -1)).filter((i) => i >= 0);
      const i = at >= 0 ? at : pastDone.length ? pastDone[pastDone.length - 1]! : -1;
      flags.push({ key: `debt-${debt.id}`, kind: 'debt', index: i >= 0 ? 2 + i : 1, title: debt.name, date: last?.date ?? null, amount: debt.startBalance, paid: true, debtId: debt.id });
    }
  }

  // Halfway: the payday where half of what was owed at the start is gone
  if (startTotal > 0) {
    const reached = d.milestones.find((m) => m.id === 'pct-50');
    if (reached || pctGone >= 50) {
      const on = reached?.reachedOn;
      const i = on ? past.findIndex((p) => p.date >= on) : -1;
      const idx = i >= 0 ? 2 + i : Math.max(1, firstAhead - 1);
      flags.push({ key: 'half', kind: 'half', index: idx, title: 'Halfway', date: on ?? null, paid: true });
    } else {
      const i = r.rows.findIndex((row) => row.debtLeft <= startTotal / 2);
      if (i >= 0 && i < shown) flags.push({ key: 'half', kind: 'half', index: firstAhead + i, title: 'Halfway', date: r.rows[i]!.date, paid: false });
    }
  }

  if (finishIndex !== null) flags.push({ key: 'finish', kind: 'finish', index: finishIndex, title: 'Debt-free', date: r.debtFreeDate, paid: false });

  return { squares, flags, pinIndex: shown > 0 ? firstAhead : null, finishIndex, firstAhead, hiddenAhead: Math.max(0, r.rows.length - shown) };
}

/** Where the finish flag would stand if the plan took `rows` paydays (the "Pay a bit more?" preview). */
export function finishIndexFor(model: Pick<RoadModel, 'firstAhead'>, rows: number): number {
  return model.firstAhead + Math.max(0, rows - 1);
}
