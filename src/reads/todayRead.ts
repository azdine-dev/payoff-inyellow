/**
 * The one short read Today suggests, by the state of the plan. The first of these that fits and has not been read:
 * a payday was missed, the buffer was used, a debt is almost gone, the first payday. Then the usual suggestion.
 */
import type { AppData } from '../data/types';
import { suggestedRead, type SuggestInput } from './suggest';

export interface TodayReadInput {
  d: SuggestInput['d'] & Pick<AppData, 'paydays' | 'buffer'>;
  today: string;
  /** Paydays that went by with nothing marked */
  missed: number;
  /** How much of the focus debt is gone, 0 to 100 (null when there is none) */
  focusPct: number | null;
  needsHelp: boolean;
  /** Ids of the reads already read */
  read: string[];
}

export function readForToday(i: TodayReadInput): string | null {
  const logs = [...i.d.paydays].sort((a, b) => a.number - b.number);
  const last = logs[logs.length - 1];
  const done = logs.filter((p) => p.status === 'done').length;
  const wants: string[] = [];
  if (i.missed > 0 || last?.status === 'skipped') wants.push('missed-payday');
  // buffer money was used since the last payday
  if (last && i.d.buffer.history.some((h) => h.amount < 0 && h.date >= last.date)) wants.push('buffer');
  // a debt is almost gone
  if (i.focusPct !== null && i.focusPct >= 75) wants.push('debt-zero');
  // the first payday
  if (done <= 1) wants.push('smallest-first');
  return wants.find((id) => !i.read.includes(id)) ?? suggestedRead({ d: i.d, today: i.today, needsHelp: i.needsHelp, read: i.read });
}
