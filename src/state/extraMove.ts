/**
 * "Move $X" on this payday (design/today-extra): money on top of the usual amount for the next payday only. It goes the
 * engine's way, as the adjust of engine_v2.py: the yearly bills' share, then the buffer until its goal, then the focus
 * debt (and the next one when the focus debt is done). Pure, so it can be tested.
 */
import { simulatePlan, type PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { plannedMoney, toPlanInput } from './planInput';

export interface ExtraMove {
  amount: number;
  /** The money for the plan on this payday, with the amount on top: what "Move" passes to the payday */
  planMoney: number;
  plan: PlanResult;
  /** Where the amount goes on this payday */
  toYearly: number;
  toBuffer: number;
  toDebts: { id: string; name: string; amount: number; owedAfter: number }[];
  /** The buffer after this payday, and its goal */
  bufferAfter: number;
  bufferGoal: number;
  /** The debt-free day before and with the amount (null: more than 20 years) */
  before: string | null;
  after: string | null;
}

const CENT = 0.005;

/** `base`: the money for the plan this payday without the amount (the usual amount, or "I got a different amount") */
export function extraMove(d: AppData, amount: number, current: PlanResult, base: number = plannedMoney(d)): ExtraMove {
  const planMoney = base + amount;
  const plan = simulatePlan(toPlanInput(d, planMoney));
  const row = plan.rows[0];
  const was = current.rows[0];
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const extraOf = (r: typeof row, id: string) => r?.debts.find((x) => x.id === id)?.extra ?? 0;
  const toDebts = (row?.debts ?? [])
    .map((x) => ({ id: x.id, name: nameOf(x.id), amount: x.extra - extraOf(was, x.id), owedAfter: x.balanceAfter }))
    .filter((x) => x.amount > CENT);
  return {
    amount,
    planMoney,
    plan,
    toYearly: Math.max(0, (row?.toYearlyBills ?? 0) - (was?.toYearlyBills ?? 0)),
    toBuffer: Math.max(0, (row?.toBuffer ?? 0) - (was?.toBuffer ?? 0)),
    toDebts,
    bufferAfter: d.buffer.amount + (row?.toBuffer ?? 0),
    bufferGoal: d.settings.bufferGoal,
    before: current.debtFreeDate,
    after: plan.debtFreeDate,
  };
}

/**
 * In the engine's order: "$50 goes to your safety net first." / "$30 goes to your safety net first, then $20 to Visa." /
 * "$10 goes to your yearly bills, then $40 to your safety net." / "$50 goes to Visa."
 */
export function whereItGoes(m: ExtraMove, money: (n: number) => string): string {
  const parts: { to: string; n: number }[] = [];
  if (m.toYearly > CENT) parts.push({ to: 'your yearly bills', n: m.toYearly });
  if (m.toBuffer > CENT) parts.push({ to: 'your safety net', n: m.toBuffer });
  for (const x of m.toDebts) parts.push({ to: x.name, n: x.amount });
  if (!parts.length) return `${money(m.amount)} has nowhere to go this payday.`;
  const [first, ...rest] = parts;
  const lead = `${money(first!.n)} goes to ${first!.to}${first!.to === 'your safety net' ? ' first' : ''}`;
  return rest.length ? `${lead}, then ${rest.map((x) => `${money(x.n)} to ${x.to}`).join(', then ')}.` : `${lead}.`;
}
