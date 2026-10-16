/**
 * Stored state → engine input. The plan is always simulated from the current state and the
 * next payday, so it never drifts (CLAUDE.md §6).
 */
import { paydayISO, paydayNumberOnOrAfter, payoffOrderIds, simulatePlan, type DebtInput, type PlanInput } from '../engine';
import type { AppData, Baseline, Debt, Settings } from '../data/types';

export function activeDebts(data: AppData): Debt[] {
  return data.debts.filter((d) => d.status === 'active');
}

/** Active and paid debts (archived ones are left out of every number). */
export function countedDebts(data: AppData): Debt[] {
  return data.debts.filter((d) => d.status !== 'archived');
}

export function toDebtInput(d: Debt): DebtInput {
  return { id: d.id, name: d.name, balance: d.balance, apr: d.apr, minMonthly: d.minMonthly, myOrder: d.myOrder };
}

/** Number of the next payday in the log. It keeps counting when the pay schedule changes. */
export function nextPaydayNumber(s: Settings): number {
  return s.numberOffset + s.paydayIndex + 1;
}

export function nextPaydayISO(s: Settings): string {
  return paydayISO(s.anchorPayday, s.frequency, s.paydayIndex + 1, s.otherPayday);
}

/** Payday (relative: 1 = next payday) a one-off on this date goes into. Past dates go into the next payday. */
export function oneOffPayday(s: Settings, date: string): number {
  const abs = paydayNumberOnOrAfter(s.anchorPayday, s.frequency, date, s.paydayIndex + 600, s.otherPayday);
  return Math.max(1, (abs ?? s.paydayIndex + 1) - s.paydayIndex);
}

/** Planned one-off money, as "+/- this payday" amounts keyed by relative payday number. */
export function oneOffAdjustments(s: Settings): Record<number, number> {
  const adj: Record<number, number> = {};
  for (const o of s.oneOffs) {
    const n = oneOffPayday(s, o.date);
    adj[n] = (adj[n] ?? 0) + o.amount;
  }
  return adj;
}

/** Money for the plan on the next payday: the usual amount plus any one-off money. */
export function plannedMoney(data: AppData): number {
  return data.settings.extraPerPayday + (oneOffAdjustments(data.settings)[1] ?? 0);
}

/**
 * @param planMoneyThisPayday "I got a different amount": the money for the plan on the next
 * payday only (replaces the usual amount and any one-off money for that payday).
 */
export function toPlanInput(data: AppData, planMoneyThisPayday?: number | null): PlanInput {
  const s = data.settings;
  const adjustments = oneOffAdjustments(s);
  if (planMoneyThisPayday != null) adjustments[1] = planMoneyThisPayday - s.extraPerPayday;
  return {
    frequency: s.frequency,
    nextPayday: s.anchorPayday,
    paydayOffset: s.paydayIndex,
    extraPerPayday: s.extraPerPayday,
    bufferNow: data.buffer.amount,
    bufferGoal: s.bufferGoal,
    method: s.method,
    otherPayday: s.otherPayday,
    // Paid debts stay in with balance 0, so their minimum keeps rolling into the extra
    debts: countedDebts(data).map(toDebtInput),
    order: s.payoffOrder,
    yearlyBills: data.funds.map((f) => ({ perYear: f.perYear })),
    adjustments,
  };
}

/** The payoff order for the debts as they are now (active and paid, not archived). */
export function orderFor(data: AppData, method = data.settings.method): string[] {
  return payoffOrderIds(countedDebts(data).map(toDebtInput), method);
}

/** Snapshot of the plan right now. Saved at setup for Progress. */
export function baselineFor(data: AppData, today: string): Baseline {
  const r = simulatePlan(toPlanInput(data));
  return {
    date: today,
    debtFreeDate: r.debtFreeDate,
    totalInterest: r.totalInterest,
    minimumsOnlyInterest: r.minimumsOnly.totalInterest,
    minimumsOnlyMonths: r.minimumsOnly.months,
    totalOwed: activeDebts(data).reduce((s, d) => s + d.balance, 0),
  };
}
