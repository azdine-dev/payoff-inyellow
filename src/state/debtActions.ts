/** Debts tab: add, edit, archive, new charges, update from statement. */
import { ZERO } from '../engine';
import { commit, newId, type PiyDB } from '../data/db';
import type { AppData, Charge, ChargeTag, Debt } from '../data/types';
import { todayISO } from '../lib/today';
import { baselineFor, orderFor } from './planInput';

export interface DebtFields {
  name: string;
  type: string;
  balance: number;
  apr: number;
  minMonthly: number;
  /** True when the minimum was left empty (quick add) */
  minPending?: boolean;
  dueDay: number | null;
  autopay: boolean;
}

const statusFor = (balance: number, current: Debt['status']): Debt['status'] =>
  current === 'archived' ? 'archived' : balance <= ZERO ? 'paid' : 'active';

export async function addDebt(db: PiyDB, data: AppData, f: DebtFields, now = Date.now()): Promise<AppData> {
  const position = data.debts.reduce((m, d) => Math.max(m, d.position), -1) + 1;
  const debt: Debt = {
    id: newId(),
    updatedAt: now,
    ...f,
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
  return commit(db, data, {
    debts: [{ ...debt, ...f, balance, startBalance: Math.max(debt.startBalance, balance), status: statusFor(balance, debt.status), updatedAt: now }],
  });
}

/** "Update from statement": the real balance replaces the stored one. */
export async function updateBalance(db: PiyDB, data: AppData, id: string, balance: number, now = Date.now()): Promise<AppData> {
  const debt = data.debts.find((d) => d.id === id)!;
  return editDebt(db, data, id, { ...debt, balance }, now);
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
