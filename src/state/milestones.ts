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

/** All the extra money paid so far, on top of the minimums (the paydays' extra and any "+ Extra payment"). */
export function aboveMinimums(data: Pick<AppData, 'payments'>): number {
  return data.payments.filter((p) => p.kind === 'extra').reduce((s, p) => s + p.amount, 0);
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

/** Money that really moved: debt payments and buffer payments. (Yearly bill savings are not debt progress.) */
const isRealPayment = (p: { kind: string; amount: number }) => (p.kind === 'minimum' || p.kind === 'extra' || p.kind === 'buffer') && p.amount > 0;
const isDebtPayment = (p: { kind: string; amount: number }) => (p.kind === 'minimum' || p.kind === 'extra') && p.amount > 0;

/** True once any payment was logged. An empty plan has no milestones except "plan made". */
export function hasRealPayments(data: Pick<AppData, 'payments'>): boolean {
  return data.payments.some(isRealPayment);
}

export function reachedKeys(data: AppData, result: PlanResult): Set<MilestoneKey> {
  const keys = new Set<MilestoneKey>(['plan-made']);
  if (!hasRealPayments(data)) return keys;
  const { pct } = progressStats(data);
  const debts = countedDebts(data); // archived debts are out
  // A debt counts as gone only if it had a balance and payments went to it
  const gone = debts.filter((d) => d.status === 'paid' && d.startBalance > 0 && data.payments.some((p) => p.debtId === d.id && isDebtPayment(p)));
  // Full because of paydays (a buffer that started full is not a milestone)
  if (data.settings.bufferGoal > 0 && data.buffer.amount >= data.settings.bufferGoal && data.buffer.history.some((h) => h.note === 'Payday')) keys.add('buffer-full');
  if (data.payments.some((p) => p.kind === 'extra' && p.amount > 0)) keys.add('first-extra');
  if (gone.length) keys.add('first-debt');
  for (const [key, n] of Object.entries(PCT)) if (pct >= n! && debts.length) keys.add(key as MilestoneKey);
  const base = data.settings.baseline?.debtFreeDate;
  if (base && result.debtFreeDate && monthsBetween(result.debtFreeDate, base) >= 1) keys.add('month-ahead');
  if (gone.length > 0 && !debts.some((d) => d.status === 'active')) keys.add('last-payment');
  return keys;
}

/**
 * The real date a milestone was reached, from the logs (payments, paydays, buffer history). Never later
 * than `fallback` (today). Falls back to `fallback` when the logs can't say.
 */
export function milestoneDate(key: MilestoneKey, data: AppData, fallback: string): string {
  const real = data.payments.filter(isDebtPayment);
  const latest = (list: { date: string }[]) => list.reduce((m, p) => (p.date > m ? p.date : m), '');
  let found: string | null = null;

  if (key === 'first-extra') {
    const extra = data.payments.filter((p) => p.kind === 'extra' && p.amount > 0).map((p) => p.date).sort();
    found = extra[0] ?? null;
  } else if (key === 'buffer-full') {
    let running = 0;
    for (const h of data.buffer.history) {
      running += h.amount;
      if (h.note === 'Payday' && running >= data.settings.bufferGoal) {
        found = h.date;
        break;
      }
    }
    found ??= data.buffer.history.filter((h) => h.note === 'Payday').map((h) => h.date).sort().pop() ?? null;
  } else if (key === 'first-debt') {
    const dates = countedDebts(data)
      .filter((d) => d.status === 'paid' && d.startBalance > 0)
      .map((d) => latest(data.payments.filter((p) => p.debtId === d.id && isDebtPayment(p))))
      .filter(Boolean)
      .sort();
    found = dates[0] ?? null;
  } else if (PCT[key]) {
    const { start } = progressStats(data);
    const log = [...data.paydays]
      .filter((p) => p.status === 'done')
      .sort((a, b) => a.number - b.number)
      .find((p) => start > 0 && p.debtLeft !== undefined && ((start - p.debtLeft) / start) * 100 >= PCT[key]!);
    found = log?.date ?? (latest(real) || null);
  } else if (key === 'month-ahead' || key === 'last-payment') {
    found = latest(real) || null;
  }
  return found && found < fallback ? found : fallback;
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

/** The first-time events: their date is a fact in the logs, so an older saved date can be corrected. */
const STABLE: ReadonlySet<MilestoneKey> = new Set<MilestoneKey>(['first-extra', 'first-debt', 'buffer-full', 'pct-10', 'pct-25', 'pct-50', 'pct-75']);

/**
 * Saves milestones reached since the last check, each with its real date. Also tidies older data: with no
 * payment logged, any saved milestone but "plan made" was never real and is removed; and a saved date later
 * than the logs show is moved back to the real one. Returns the data unchanged when there is nothing to do.
 */
export async function syncMilestones(db: PiyDB, data: AppData, result: PlanResult, today: string, now = Date.now()): Promise<AppData> {
  const have = new Set(data.milestones.map((m) => m.id));
  const real = hasRealPayments(data);
  const fresh: Milestone[] = [...reachedKeys(data, result)]
    .filter((k) => !have.has(k))
    .map((k) => ({ id: k, updatedAt: now, reachedOn: k === 'plan-made' ? today : milestoneDate(k, data, today) }));
  const stale = real ? [] : data.milestones.filter((m) => m.id !== 'plan-made').map((m) => m.id);
  const redated: Milestone[] = real
    ? data.milestones.flatMap((m) => {
        if (!STABLE.has(m.id)) return [];
        const d = milestoneDate(m.id, data, m.reachedOn);
        return d < m.reachedOn ? [{ ...m, reachedOn: d, updatedAt: now }] : [];
      })
    : [];
  if (!fresh.length && !stale.length && !redated.length) return data;
  return commit(db, data, { milestones: [...fresh, ...redated], remove: stale.length ? { milestones: stale } : undefined });
}
