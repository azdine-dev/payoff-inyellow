/**
 * Path, Chapters (design/path-features/Chapters): one chapter per debt, in payoff order. A chapter holds the
 * paydays from the day the debt before it is gone (or the first payday) to the day this debt is gone.
 * Done and skipped paydays come first, then the plan. Pure, so it can be tested.
 */
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { billsForPlanRow, totalOf } from '../state/billsDue';

export interface ChapterDay {
  key: string;
  date: string;
  kind: 'paid' | 'skipped' | 'next' | 'ahead';
  /** Payday log number (paid and skipped) */
  number?: number;
  /** Row of the plan (next and ahead) */
  rowIndex?: number;
  /** What the payday moves: what was paid, or what is planned */
  amount: number;
}

export interface Chapter {
  debtId: string;
  name: string;
  /** 1-based */
  index: number;
  last: boolean;
  days: ChapterDay[];
  firstDate: string;
  lastDate: string;
  /** The payday that takes the debt to zero. Null when the plan never gets there. */
  goneDate: string | null;
  /** Its minimum, which goes on to the next chapter. Null when there is nothing to roll or no next chapter. */
  rollsOn: number | null;
  /** "From Fri 4 Dec the extra goes here": the buffer fills first, then the extra starts */
  extraFrom: string | null;
  /** The chapter that holds the next payday */
  here: boolean;
  /** Other debts that reached zero during this chapter (their own minimums did it) */
  alsoGone: { name: string; date: string }[];
}

export interface ChaptersModel {
  chapters: Chapter[];
  debtFreeDate: string | null;
}

const ZERO = 0.005;

export function buildChapters(d: AppData, r: PlanResult): ChaptersModel {
  const byId = new Map(d.debts.map((x) => [x.id, x]));
  const order = r.order.filter((id) => {
    const debt = byId.get(id);
    return debt && debt.status !== 'archived' && debt.startBalance > 0;
  });
  if (!order.length) return { chapters: [], debtFreeDate: r.debtFreeDate };

  // The timeline: paydays done or skipped, then the plan. Each says what every debt owes after it.
  type Step = { day: ChapterDay; after: Map<string, number>; extraTo: Set<string>; buffer: boolean };
  const steps: Step[] = [];
  const logs = [...d.paydays].sort((a, b) => a.number - b.number);
  let last = new Map<string, number>();
  const first = logs.find((l) => l.snap)?.snap?.before.debts;
  for (const id of order) last.set(id, first?.[id]?.[0] ?? byId.get(id)!.startBalance);
  for (const l of logs) {
    const after = new Map(last);
    if (l.status === 'done' && l.snap) for (const id of order) after.set(id, l.snap.after.debts[id]?.[0] ?? after.get(id) ?? 0);
    const pays = d.payments.filter((p) => p.paydayNumber === l.number);
    steps.push({
      day: { key: `log-${l.number}`, date: l.date, kind: l.status === 'done' ? 'paid' : 'skipped', number: l.number, amount: l.status === 'done' ? l.total : 0 },
      after,
      extraTo: new Set(pays.filter((p) => p.kind === 'extra' && p.debtId).map((p) => p.debtId!)),
      buffer: pays.some((p) => p.kind === 'buffer'),
    });
    last = after;
  }
  r.rows.forEach((row, i) => {
    const after = new Map(last);
    for (const id of order) after.set(id, row.debts.find((x) => x.id === id)?.balanceAfter ?? 0);
    steps.push({
      day: { key: `row-${i}`, date: row.date, kind: i === 0 ? 'next' : 'ahead', rowIndex: i, amount: totalOf(billsForPlanRow(d, r, i), row) },
      after,
      extraTo: new Set(row.debts.filter((x) => x.extra > 0.004).map((x) => x.id)),
      buffer: row.toBuffer > 0.004,
    });
    last = after;
  });

  // Walk it: each payday belongs to the first debt that is not gone yet
  const gone = new Map<string, string>();
  for (const id of order) if ((first?.[id]?.[0] ?? byId.get(id)!.startBalance) <= ZERO) gone.set(id, steps[0]?.day.date ?? '');
  const days = new Map<string, ChapterDay[]>(order.map((id) => [id, []]));
  const extraFrom = new Map<string, string>();
  const bufferBefore = new Set<string>();
  const also = new Map<string, { name: string; date: string }[]>(order.map((id) => [id, []]));
  for (const s of steps) {
    const current = order.find((id) => !gone.has(id));
    if (!current) break;
    days.get(current)!.push(s.day);
    if (s.extraTo.has(current) && !extraFrom.has(current)) extraFrom.set(current, s.day.date);
    if (s.buffer && !extraFrom.has(current)) bufferBefore.add(current);
    for (const id of order) {
      if (gone.has(id) || (s.after.get(id) ?? 1) > ZERO) continue;
      gone.set(id, s.day.date);
      if (id !== current) also.get(current)!.push({ name: byId.get(id)!.name, date: s.day.date });
    }
  }

  const shown = order.filter((id) => days.get(id)!.length > 0);
  const hereId = shown.find((id) => days.get(id)!.some((x) => x.kind === 'next'));
  const chapters = shown.map((id, k): Chapter => {
    const list = days.get(id)!;
    const debt = byId.get(id)!;
    const isLast = k === shown.length - 1;
    const goneDate = gone.get(id) && list.some((x) => x.date === gone.get(id)) ? gone.get(id)! : null;
    return {
      debtId: id,
      name: debt.name,
      index: k + 1,
      last: isLast,
      days: list,
      firstDate: list[0]!.date,
      lastDate: list[list.length - 1]!.date,
      goneDate,
      rollsOn: !isLast && debt.minMonthly > 0 ? debt.minMonthly : null,
      extraFrom: bufferBefore.has(id) && extraFrom.has(id) && extraFrom.get(id) !== list[0]!.date ? extraFrom.get(id)! : null,
      here: id === hereId,
      alsoGone: also.get(id)!,
    };
  });
  return { chapters, debtFreeDate: r.debtFreeDate };
}
