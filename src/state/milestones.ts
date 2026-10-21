/** Progress numbers and milestones. A milestone is saved once and never un-reached. */
import { commit, type PiyDB } from '../data/db';
import type { AppData, Milestone, MilestoneKey } from '../data/types';
import { ZERO, type PlanResult } from '../engine';
import { monthsBetween } from '../lib/today';
import { countedDebts } from './planInput';

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  'plan-made': 'Plan made',
  'buffer-full': 'Buffer full',
  'first-extra': 'First extra payment',
  'first-debt': 'First debt gone',
  'pct-10': '10% of all debt gone',
  'pct-25': '25% of all debt gone',
  'pct-50': 'Halfway there',
  'pct-75': '75% of all debt gone',
  'month-ahead': 'One month ahead of plan',
  'last-payment': 'Last payment',
};

export const MILESTONE_ORDER = Object.keys(MILESTONE_LABELS) as MilestoneKey[];

const PCT: Partial<Record<MilestoneKey, number>> = { 'pct-10': 10, 'pct-25': 25, 'pct-50': 50, 'pct-75': 75 };

/** "about 2 years", "about 21 months", "less than a month": how long the paydays left are in plain words. */
export function horizonText(paydaysLeft: number, paydaysPerYear: number): string {
  const months = Math.round((paydaysLeft * 12) / paydaysPerYear);
  if (months < 1) return 'less than a month';
  if (months === 1) return 'about 1 month';
  if (months < 24) return `about ${months} months`;
  const years = Math.round((months / 12) * 2) / 2; // to the nearest half year
  return `about ${years} years`;
}

export interface ProgressStats {
  start: number;
  owed: number;
  paid: number;
  /** 0 to 100 */
  pct: number;
}

export function progressStats(data: AppData): ProgressStats {
  const debts = countedDebts(data);
  const start = debts.reduce((s, d) => s + d.startBalance, 0);
  const owed = debts.reduce((s, d) => s + d.balance, 0);
  const paid = Math.max(0, start - owed);
  return { start, owed, paid, pct: start > 0 ? Math.min(100, (paid / start) * 100) : 0 };
}

export function reachedKeys(data: AppData, result: PlanResult): Set<MilestoneKey> {
  const keys = new Set<MilestoneKey>(['plan-made']);
  const { pct } = progressStats(data);
  const debts = countedDebts(data);
  // Full because of paydays (a buffer that started full is not a milestone)
  if (data.settings.bufferGoal > 0 && data.buffer.amount >= data.settings.bufferGoal && data.buffer.history.some((h) => h.note === 'Payday')) keys.add('buffer-full');
  if (data.payments.some((p) => p.kind === 'extra')) keys.add('first-extra');
  if (debts.some((d) => d.status === 'paid')) keys.add('first-debt');
  for (const [key, n] of Object.entries(PCT)) if (pct >= n! && debts.length) keys.add(key as MilestoneKey);
  const base = data.settings.baseline?.debtFreeDate;
  if (base && result.debtFreeDate && monthsBetween(result.debtFreeDate, base) >= 1) keys.add('month-ahead');
  if (debts.length > 0 && !debts.some((d) => d.status === 'active') && debts.some((d) => d.status === 'paid')) {
    keys.add('last-payment');
  }
  return keys;
}

/** The short sentence for a milestone reached today. Null for the ones that have their own moment (plan made, first debt gone). */
export function momentText(key: MilestoneKey, focusName: string | null, firstExtraTo: string | null): string | null {
  switch (key) {
    case 'buffer-full':
      return focusName ? `Your buffer is full. From now on the extra goes to ${focusName}.` : 'Your buffer is full.';
    case 'first-extra':
      return firstExtraTo ? `Your first extra payment went to ${firstExtraTo}.` : 'Your first extra payment is done.';
    case 'pct-10':
      return '10% of your debt is gone.';
    case 'pct-25':
      return 'A quarter of your debt is gone.';
    case 'pct-50':
      return 'Halfway there.';
    case 'pct-75':
      return 'Three quarters of your debt is gone.';
    case 'month-ahead':
      return 'You are a month ahead of your plan.';
    case 'last-payment':
      return 'That was your last payment.';
    default:
      return null;
  }
}

/** When a milestone not yet reached is expected, from the current plan. */
export function projectedDate(key: MilestoneKey, data: AppData, result: PlanResult): string | null {
  const { start } = progressStats(data);
  const n = PCT[key];
  if (n && start > 0) {
    const row = result.rows.find((r) => ((start - r.debtLeft) / start) * 100 >= n);
    return row?.date ?? null;
  }
  if (key === 'first-debt') {
    const dates = Object.values(result.paidOff).sort();
    return dates[0] ?? null;
  }
  if (key === 'first-extra') return result.rows.find((r) => r.extra > ZERO)?.date ?? null;
  if (key === 'last-payment') return result.debtFreeDate;
  return null;
}

/** Saves milestones reached since the last check. Returns the data unchanged if there are none. */
export async function syncMilestones(db: PiyDB, data: AppData, result: PlanResult, today: string, now = Date.now()): Promise<AppData> {
  const have = new Set(data.milestones.map((m) => m.id));
  const fresh: Milestone[] = [...reachedKeys(data, result)]
    .filter((k) => !have.has(k))
    .map((k) => ({ id: k, updatedAt: now, reachedOn: today }));
  return fresh.length ? commit(db, data, { milestones: fresh }) : data;
}
