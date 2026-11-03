/** Debts tab: add, edit, archive, new charges, update from statement. */
import { capFirst } from '../lib/text';
import { ZERO } from '../engine';
import { commit, newId, type PiyDB } from '../data/db';
import type { AppData, Charge, ChargeTag, Debt } from '../data/types';
import { todayISO } from '../lib/today';
import { baselineFor, orderFor } from './planInput';

/** Used when the buyer doesn't know the rate. The debt is marked "rate missing" until the real one is added. */
export const DEFAULT_RATE = 24;

export interface DebtFields {
  name: string;
  type: string;
  balance: number;
  apr: number;
  minMonthly: number;
  /** True when the minimum was left empty (quick add) */
  minPending?: boolean;
  /** True when the rate was left empty (24% is used) */
  rateMissing?: boolean;
  dueDay: number | null;
  autopay: boolean;
  /** Optional: who the debt is with, and notes. Pass undefined to clear. */
  lender?: string;
  notes?: string;
  /** A promo rate until a date, optionally with deferred interest. Pass undefined to clear it. */
  promoApr?: number;
  promoEnds?: string;
  deferredInterest?: boolean;
}

const statusFor = (balance: number, current: Debt['status']): Debt['status'] =>
  current === 'archived' ? 'archived' : balance <= ZERO ? 'paid' : 'active';

export async function addDebt(db: PiyDB, data: AppData, f: DebtFields, now = Date.now()): Promise<AppData> {
  const position = data.debts.reduce((m, d) => Math.max(m, d.position), -1) + 1;
  const debt: Debt = {
    id: newId(),
    updatedAt: now,
    ...f,
    name: capFirst(f.name),
    myOrder: data.settings.method === 'my-order' ? position + 1 : null,
    startBalance: f.balance,
    status: f.balance > ZERO ? 'active' : 'paid',
    position,
  };
  // A new debt changes the order: make it again
  const withNew: AppData = { ...data, debts: [...data.debts, debt] };
  return commit(db, data, { debts: [debt], settings: { ...data.settings, payoffOrder: orderFor(withNew), baseline: baselineFor(withNew, todayISO()), updatedAt: now } });
}

/**
 * Edit a debt. A new balance here works like "Update from statement". If it's higher than the
 * starting balance, the start moves up too, so "% gone" never goes below zero.
 */
export async function editDebt(db: PiyDB, data: AppData, id: string, f: DebtFields, now = Date.now()): Promise<AppData> {
  const debt = data.debts.find((d) => d.id === id)!;
  const balance = f.balance <= ZERO ? 0 : f.balance;
  const edited: Debt = {
    ...debt,
    ...f,
    name: capFirst(f.name),
    balance,
    // A balance typed in here is a correction, not a payment: the debt's starting point moves with it
    startBalance: baselineAfterCorrection(data, debt, balance),
    status: statusFor(balance, debt.status),
    updatedAt: now,
  };
  // The rate, the minimum and the balance decide the order: make it again from the chosen method
  const after: AppData = { ...data, debts: data.debts.map((d) => (d.id === id ? edited : d)) };
  return commit(db, data, { debts: [edited], ...orderChange(data, after, now) });
}

/** The settings to save when the payoff order is not the stored one any more. Nothing when it is the same (so nothing is written or synced for nothing). */
function orderChange(before: AppData, after: AppData, now: number): { settings?: AppData['settings'] } {
  const next = orderFor(after);
  const same = next.length === before.settings.payoffOrder.length && next.every((id, i) => id === before.settings.payoffOrder[i]);
  return same ? {} : { settings: { ...after.settings, payoffOrder: next, updatedAt: now } };
}

/** What was really paid to a debt (bills and extras). Corrections and statement updates are not in it. */
export function paidToDebt(data: Pick<AppData, 'payments'>, debtId: string): number {
  return data.payments.filter((p) => p.debtId === debtId && (p.kind === 'minimum' || p.kind === 'extra') && p.amount > 0).reduce((sum, p) => sum + p.amount, 0);
}

/**
 * The starting balance of a debt after its balance was typed in by hand (Edit, or "Update from statement").
 * It becomes the new balance plus what was really paid so far, so progress and milestones come from real payments only
 * and a correction moves the progress neither forward nor back. An unchanged balance keeps its starting point.
 */
export function baselineAfterCorrection(data: Pick<AppData, 'payments'>, debt: Debt, to: number): number {
  if (Math.abs(to - debt.balance) <= ZERO) return debt.startBalance;
  return to + paidToDebt(data, debt.id);
}

/** "Update from statement": the real balance replaces the stored one. */
export async function updateBalance(db: PiyDB, data: AppData, id: string, balance: number, now = Date.now(), today = todayISO()): Promise<AppData> {
  const debt = data.debts.find((d) => d.id === id)!;
  const to = balance <= ZERO ? 0 : balance;
  // The change is written down for the debt's History list
  const statements = Math.abs(to - debt.balance) > ZERO ? [...(debt.statements ?? []), { date: today, from: debt.balance, to }] : debt.statements;
  const corrected: Debt = { ...debt, balance: to, startBalance: baselineAfterCorrection(data, debt, to), status: statusFor(to, debt.status), ...(statements ? { statements } : {}), updatedAt: now };
  const after: AppData = { ...data, debts: data.debts.map((d) => (d.id === id ? corrected : d)) };
  // A new balance can change which debt is the smallest: make the order again
  return commit(db, data, { debts: [corrected], ...orderChange(data, after, now) });
}

/** "Log a new charge or fee": the balance goes up and the plan updates. A paid debt becomes active again. */
export async function logCharge(
  db: PiyDB,
  data: AppData,
  debtId: string,
  amount: number,
  tag: ChargeTag,
  note: string,
  today: string,
  now = Date.now(),
): Promise<AppData> {
  const debt = data.debts.find((d) => d.id === debtId)!;
  const balance = debt.balance + amount;
  const charge: Charge = { id: newId(), updatedAt: now, date: today, debtId, amount, tag, note };
  return commit(db, data, {
    charges: [charge],
    debts: [{ ...debt, balance, startBalance: Math.max(debt.startBalance, balance), status: statusFor(balance, debt.status), updatedAt: now }],
  });
}

export async function archiveDebt(db: PiyDB, data: AppData, id: string, now = Date.now()): Promise<AppData> {
  const debt = data.debts.find((d) => d.id === id)!;
  const archived = { ...debt, status: 'archived' as const, updatedAt: now };
  const after: AppData = { ...data, debts: data.debts.map((d) => (d.id === id ? archived : d)) };
  return commit(db, data, { debts: [archived], settings: { ...data.settings, payoffOrder: orderFor(after), baseline: baselineFor(after, todayISO()), updatedAt: now } });
}

export async function restoreDebt(db: PiyDB, data: AppData, id: string, now = Date.now()): Promise<AppData> {
  const debt = data.debts.find((d) => d.id === id)!;
  const back = { ...debt, status: debt.balance <= ZERO ? ('paid' as const) : ('active' as const), updatedAt: now };
  const after: AppData = { ...data, debts: data.debts.map((d) => (d.id === id ? back : d)) };
  return commit(db, data, { debts: [back], settings: { ...data.settings, payoffOrder: orderFor(after), baseline: baselineFor(after, todayISO()), updatedAt: now } });
}
