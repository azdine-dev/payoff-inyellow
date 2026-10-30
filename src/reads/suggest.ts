/** Which short read to suggest, from the user's real state. The first one that fits and has not been read yet. */
import type { AppData } from '../data/types';

export interface SuggestInput {
  d: Pick<AppData, 'paydays' | 'debts' | 'buffer' | 'settings' | 'funds'>;
  today: string;
  /** The plan needs help (the minimums are more than the money for the plan) */
  needsHelp: boolean;
  /** Ids of the reads already read */
  read: string[];
}

export function suggestedRead({ d, today, needsHelp, read }: SuggestInput): string | null {
  const last = [...d.paydays].sort((a, b) => a.number - b.number).pop();
  const wants: string[] = [];
  if (d.debts.some((x) => x.status === 'paid')) wants.push('debt-zero');
  if (last?.status === 'skipped') wants.push('missed-payday');
  if (d.debts.some((x) => x.status === 'active' && x.promoApr != null && x.promoEnds && x.promoEnds > today)) wants.push('promo-trap');
  if (needsHelp) wants.push('not-enough');
  if (d.settings.bufferGoal > 0 && d.buffer.amount < d.settings.bufferGoal) wants.push('buffer');
  if (d.funds.length === 0) wants.push('not-surprises');
  if (d.paydays.length === 0) wants.push('smallest-first');
  return wants.find((id) => !read.includes(id)) ?? null;
}
