/** Which note shows on Today: a line for what just happened if there is one, else the line for this payday. */
import { ROTATING_NOTES, STATE_NOTES } from '../copy/notes';
import type { AppData } from '../data/types';

export interface NoteContext {
  /** A debt reached zero just now (the "debt paid" moment is on screen or was a moment ago) */
  freshPaidDebt?: boolean;
  /** The halfway milestone was reached just now */
  freshHalfway?: boolean;
}

export type NoteKind = 'debtPaid' | 'halfway' | 'firstPayday' | 'bufferUsed' | 'afterSkip' | 'rotating';

/** The latest payday log, done or skipped */
function lastLog(d: Pick<AppData, 'paydays'>) {
  return [...d.paydays].sort((a, b) => a.number - b.number).pop();
}

export type NoteData = Pick<AppData, 'paydays' | 'debts' | 'payments' | 'milestones'> & { buffer: { history: { date: string; amount: number }[] } };

export function pickNote(d: NoteData, ctx: NoteContext = {}): { kind: NoteKind; text: string } {
  const last = lastLog(d);
  const done = d.paydays.filter((p) => p.status === 'done');

  // 1 A debt was just paid: the last payday carried its final payment, or it was paid a moment ago
  const paidOnLast =
    last !== undefined &&
    d.debts.some((x) => x.status === 'paid' && d.payments.some((p) => p.debtId === x.id && p.paydayNumber === last.number && p.date >= last.date));
  if (ctx.freshPaidDebt || paidOnLast) return { kind: 'debtPaid', text: STATE_NOTES.debtPaid };

  // 2 Halfway was reached on the last payday
  const half = d.milestones.find((m) => m.id === 'pct-50');
  if (ctx.freshHalfway || (half && last !== undefined && half.reachedOn === last.date)) return { kind: 'halfway', text: STATE_NOTES.halfway };

  // 3 The first payday: nothing is done yet, or only the first one is
  if (done.length <= 1 && (last === undefined || last.status === 'done')) return { kind: 'firstPayday', text: STATE_NOTES.firstPayday };

  // 4 The buffer was used since the last payday was done
  if (last !== undefined && d.buffer.history.some((h) => h.amount < 0 && h.date >= last.date)) return { kind: 'bufferUsed', text: STATE_NOTES.bufferUsed };

  // 5 The last payday was skipped
  if (last !== undefined && last.status === 'skipped') return { kind: 'afterSkip', text: STATE_NOTES.afterSkip };

  // Otherwise a line that changes once per payday
  return { kind: 'rotating', text: ROTATING_NOTES[(last?.number ?? done.length) % ROTATING_NOTES.length]! };
}
