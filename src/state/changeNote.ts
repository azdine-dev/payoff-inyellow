/** One calm sentence about what a change did to the debt-free date. */
import type { PlanResult } from '../engine';
import { dayMonth } from '../lib/today';

// Always with the year: this sentence is about a date far away
const full = (iso: string) => `${dayMonth(iso, iso)} ${iso.slice(0, 4)}`;

export function dateMoveSentence(before: PlanResult, after: PlanResult): string {
  const a = before.debtFreeDate;
  const b = after.debtFreeDate;
  if (a === b) return 'Your debt-free date didn’t move.';
  if (!b) return 'At this pace the plan now takes more than 20 years. The what-if on the Plan tab can help.';
  if (!a) return `Your plan now ends on ${full(b)}.`;
  const n = (after.paydaysToDebtFree ?? 0) - (before.paydaysToDebtFree ?? 0);
  if (n === 0) return `Your debt-free date moved to ${full(b)}.`;
  const count = Math.abs(n);
  return `Your debt-free date moved ${count} payday${count === 1 ? '' : 's'} ${n > 0 ? 'later' : 'sooner'} (${full(b)}).`;
}
