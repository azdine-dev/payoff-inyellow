/** What-if on the Plan tab: more money each payday, or one-off money on a date. */
import { simulatePlan, type MethodComparison, type PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { formatMoney, type Currency } from '../lib/money';
import { monthsBetween } from '../lib/today';
import { oneOffPayday, toPlanInput } from './planInput';

export function whatIfPlan(data: AppData, addPerPayday: number, oneOff: { amount: number; date: string } | null): PlanResult {
  const input = toPlanInput(data);
  input.extraPerPayday += addPerPayday;
  if (oneOff && oneOff.amount > 0 && oneOff.date) {
    const n = oneOffPayday(data.settings, oneOff.date);
    input.adjustments = { ...input.adjustments, [n]: (input.adjustments?.[n] ?? 0) + oneOff.amount };
  }
  return simulatePlan(input);
}

export interface WhatIfSummary {
  newDate: string | null;
  monthsSaved: number | null;
  interestSaved: number;
  /** The change gets a plan that never ended within 20 years to end */
  nowEnds: boolean;
}

export function whatIfSummary(base: PlanResult, next: PlanResult): WhatIfSummary {
  const both = base.debtFreeDate !== null && next.debtFreeDate !== null;
  return {
    newDate: next.debtFreeDate,
    monthsSaved: both ? monthsBetween(next.debtFreeDate!, base.debtFreeDate!) : null,
    interestSaved: base.totalInterest - next.totalInterest,
    nowEnds: base.debtFreeDate === null && next.debtFreeDate !== null,
  };
}

/** One calm sentence about Biggest interest first vs PaidInYellow order, in dollars. */
export function comparisonLine(c: MethodComparison, cur: Currency): string {
  const saved = formatMoney(c.interestSaved, cur, { whole: true });
  const piy = c.paidinyellow.debtFreeDate;
  const big = c.biggestInterest.debtFreeDate;
  if (c.suggestBiggestInterest && piy && big) {
    const m = monthsBetween(big, piy);
    return `Biggest interest first saves ${saved} and finishes ${m > 0 ? `${m} month${m === 1 ? '' : 's'} sooner` : 'the same month'}. That's a real difference here, so it's your choice.`;
  }
  if (c.suggestBiggestInterest) {
    return 'Biggest interest first finishes within 20 years and PaidInYellow order does not, so Biggest interest first fits better here.';
  }
  if (c.interestSaved >= 1) {
    return `Biggest interest first would save ${saved}, a small difference. PaidInYellow order shows you a debt disappear sooner, which helps people keep going.`;
  }
  return 'Here PaidInYellow order costs the same or less, and you see a debt disappear sooner.';
}
