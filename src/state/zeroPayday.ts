/**
 * A payday with nothing to move: no bill is due before the next payday, and there is no money for the buffer, the
 * yearly bills or the extra. That happens with $0 for the plan on a bill that falls every second payday. There is no
 * "Move $0" card and no "I did it" for it: the payday counts as done by itself, and Today says what comes next.
 */
import type { PlanResult } from '../engine';
import { simulatePlan } from '../engine';
import type { AppData } from '../data/types';
import { billsForPlanRow, totalOf } from './billsDue';
import { activeDebts, nextPaydayISO, toPlanInput } from './planInput';

/** What the i-th payday of a plan moves, in total (bills + yearly bills + buffer + extra) */
export function paydayTotal(data: AppData, plan: PlanResult, i: number): number {
  const row = plan.rows[i];
  return row ? totalOf(billsForPlanRow(data, plan, i), row) : 0;
}

/** The next payday has nothing to move */
export function paydayIsEmpty(data: AppData, plan: PlanResult = simulatePlan(toPlanInput(data))): boolean {
  return activeDebts(data).length > 0 && plan.rows.length > 0 && paydayTotal(data, plan, 0) === 0;
}

/** The empty payday has come (today or earlier): it counts as done by itself */
export function shouldAutoCount(data: AppData, today: string): boolean {
  return activeDebts(data).length > 0 && nextPaydayISO(data.settings) <= today && paydayIsEmpty(data);
}

export interface NextMove {
  /** The debt whose bill it is. Null when the payday moves money for the buffer, the yearly bills or the extra only. */
  name: string | null;
  amount: number;
  /** The bill's due date, or the payday itself when there is no bill */
  date: string;
}

/** The first payday from `from` on that moves something: "Visa $50 on Sat 12 Dec". Null when the plan has nothing more. */
export function nextMove(data: AppData, plan: PlanResult, from = 0): NextMove | null {
  for (let i = from; i < plan.rows.length; i++) {
    const total = paydayTotal(data, plan, i);
    if (total <= 0) continue;
    const bill = billsForPlanRow(data, plan, i).due[0];
    return bill ? { name: bill.name, amount: bill.amount, date: bill.due } : { name: null, amount: total, date: plan.rows[i]!.date };
  }
  return null;
}
