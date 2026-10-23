/**
 * Everything that changes stored data. Each action writes IndexedDB in one transaction and
 * returns the new AppData. The screens call these through store.ts.
 */
import {
  dailyInterestCost,
  paydayNumberOnOrAfter,
  payoffOrderIds,
  preparePlan,
  stepPayday,
  ZERO,
  type Frequency,
  type PaydayStep,
  type PayoffMethod,
} from '../engine';
import { commit, newId, type PiyDB } from '../data/db';
import type { AppData, BufferRecord, Debt, Fund, Milestone, Payment, PaydayLog, PaydaySnap, Settings, StartMode } from '../data/types';
import type { Currency } from '../lib/money';
import { firstOfNextMonth } from '../lib/today';
import { billsForNextPayday, totalOf } from './billsDue';
import {
  activeDebts,
  baselineFor,
  nextPaydayISO,
  nextPaydayNumber,
  oneOffPayday,
  plannedMoney,
  toDebtInput,
  toPlanInput,
} from './planInput';

export interface SetupValues {
  currency: Currency;
  frequency: Frequency;
  nextPayday: string;
  /** Twice a month only: the second pay day of the month (31 = last day) */
  otherPayday?: number | null;
  paycheckAmount: number | null;
  debts: {
    name: string;
    type: string;
    balance: number;
    apr: number;
    minMonthly: number;
    dueDay: number | null;
    autopay: boolean;
    myOrder: number | null;
    /** The rate was left empty: `apr` is the default and the debt is marked "rate missing" */
    rateMissing?: boolean;
  }[];
  bufferNow: number;
  bufferGoal: number;
  extraPerPayday: number;
  funds: { name: string; perYear: number; month: string }[];
  method: PayoffMethod;
  startMode: StartMode;
  ifThen: { day: string; time: string };
}

/** Paydays before the plan starts ("on the 1st of next month") are counted as already passed. */
export function startIndex(v: Pick<SetupValues, 'frequency' | 'nextPayday' | 'startMode' | 'otherPayday'>, today: string): number {
  if (v.startMode === 'this-payday') return 0;
  const n = paydayNumberOnOrAfter(v.nextPayday, v.frequency, firstOfNextMonth(today), 520, v.otherPayday);
  return n === null ? 0 : n - 1;
}

/**
 * "Start on the 1st of next month" (or back to "this payday"), chosen on the result screen. Only before the
 * first payday is done. The plan and its starting point are made again from the new start.
 */
export async function setStartMode(db: PiyDB, data: AppData, mode: StartMode, today: string, now = Date.now()): Promise<AppData> {
  if (data.paydays.length > 0 || data.settings.startMode === mode) return data;
  const s = data.settings;
  const paydayIndex = startIndex({ frequency: s.frequency, nextPayday: s.anchorPayday, startMode: mode, otherPayday: s.otherPayday }, today);
  const next: AppData = { ...data, settings: { ...s, startMode: mode, paydayIndex, updatedAt: now } };
  return commit(db, data, { settings: { ...next.settings, baseline: baselineFor(next, today) } });
}

/** What to keep when numbers are redone ("Change my numbers"). */
export type SetupCarry = Partial<Pick<Settings, 'theme' | 'textSize' | 'license'>>;

/** The records a finished setup makes (nothing is stored here). Used for the saved plan and for the example. */
export function buildSetupData(v: SetupValues, today: string, now = Date.now(), carry: SetupCarry = {}): AppData {
  const settings: Settings = {
    id: 'settings',
    updatedAt: now,
    currency: v.currency,
    frequency: v.frequency,
    anchorPayday: v.nextPayday,
    otherPayday: v.frequency === 'twice-monthly' ? (v.otherPayday ?? null) : null,
    payoffOrder: [],
    paydayIndex: startIndex(v, today),
    paycheckAmount: v.paycheckAmount,
    extraPerPayday: v.extraPerPayday,
    bufferGoal: v.bufferGoal,
    method: v.method,
    ifThen: v.ifThen,
    startMode: v.startMode,
    setupDoneAt: now,
    oneOffs: [],
    baseline: null,
    numberOffset: 0,
    lastBackupAt: null,
    theme: carry.theme ?? 'auto',
    textSize: carry.textSize ?? 1,
    license: carry.license ?? null,
  };
  const debts: Debt[] = v.debts.map((d, i) => ({
    id: newId(),
    updatedAt: now,
    ...d,
    startBalance: d.balance,
    status: d.balance > ZERO ? 'active' : 'paid',
    position: i,
  }));
  const buffer: BufferRecord = {
    id: 'buffer',
    updatedAt: now,
    amount: v.bufferNow,
    history: v.bufferNow > 0 ? [{ date: today, amount: v.bufferNow, note: 'Set aside before the plan' }] : [],
  };
  const funds: Fund[] = v.funds.map((f, i) => ({ id: newId(), updatedAt: now, ...f, saved: 0, position: i }));

  // The payoff order is made once, here, and kept (see Settings.payoffOrder)
  settings.payoffOrder = payoffOrderIds(debts.map(toDebtInput), v.method);
  const fresh: AppData = { settings, debts, buffer, funds, payments: [], charges: [], paydays: [], milestones: [], findMoney: null };
  settings.baseline = baselineFor(fresh, today);
  const milestone: Milestone = { id: 'plan-made', updatedAt: now, reachedOn: today };
  return { ...fresh, milestones: [milestone] };
}

export async function completeSetup(
  db: PiyDB,
  v: SetupValues,
  today: string,
  now = Date.now(),
  carry: SetupCarry = {},
): Promise<AppData> {
  const built = buildSetupData(v, today, now, carry);
  const { settings, debts, buffer, funds } = built;
  const milestone = built.milestones[0]!;

  const stores = ['settings', 'debts', 'payments', 'charges', 'buffer', 'funds', 'paydays', 'draft', 'milestones', 'findMoney'] as const;
  const tx = db.transaction([...stores], 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.objectStore('settings').put(settings);
  await tx.objectStore('milestones').put(milestone);
  await tx.objectStore('buffer').put(buffer);
  for (const d of debts) await tx.objectStore('debts').put(d);
  for (const f of funds) await tx.objectStore('funds').put(f);
  await tx.done;
  return built;
}

export interface PaydayDone {
  data: AppData;
  step: PaydayStep;
  /** Debts that reached zero on this payday */
  newlyPaid: string[];
}

/**
 * "I did it": one engine step with the real numbers, saved. Balances, buffer and yearly-bill
 * savings move forward, payments are logged and the next payday advances.
 * @param planMoney money for the plan this payday ("I got a different amount"); default = usual.
 */
export async function didPayday(
  db: PiyDB,
  data: AppData,
  opts: { planMoney?: number | null; now?: number } = {},
): Promise<PaydayDone> {
  const now = opts.now ?? Date.now();
  const s = data.settings;
  const input = toPlanInput(data);
  const plan = preparePlan(input);
  const byId = new Map(data.debts.map((d) => [d.id, d]));
  const number = nextPaydayNumber(s);
  const date = nextPaydayISO(s);
  const usual = plannedMoney(data);
  const planMoney = opts.planMoney ?? usual;
  const state = { balances: plan.ids.map((id) => byId.get(id)!.balance), buffer: data.buffer.amount, bufferGoal: s.bufferGoal };
  const step = stepPayday(plan, state, planMoney, 0, number, date);
  const usualStep = planMoney === usual ? step : stepPayday(plan, state, usual, 0, number, date);
  // What the buyer saw and set aside: the bills due before the next payday + yearly bills + buffer + extra.
  // (The balances still move by the engine's step: its per-payday average decides the payoff date.)
  const bills = billsForNextPayday(data);
  const total = totalOf(bills, step);
  const plannedTotal = totalOf(bills, usualStep);

  const newlyPaid: string[] = [];
  const changedDebts = step.debts
    .filter((d) => byId.get(d.id)!.status !== 'paid') // paid debts stay in the plan at 0, nothing to save
    .map((d) => {
      const debt = byId.get(d.id)!;
      const paid = d.balanceAfter <= ZERO;
      if (paid) newlyPaid.push(d.id);
      return { ...debt, balance: paid ? 0 : d.balanceAfter, status: paid ? 'paid' : debt.status, updatedAt: now } as Debt;
    });
  const changedById = new Map(changedDebts.map((d) => [d.id, d]));

  // Yearly bills: each fund gets its share (perYear / ppy), scaled down if money was short
  const share = plan.yearlyPerPayday > 0 ? step.toYearlyBills / plan.yearlyPerPayday : 0;
  const funds = data.funds.map((f) => ({ ...f, saved: f.saved + (f.perYear / plan.ppy) * share, updatedAt: now }));

  const buffer: BufferRecord = {
    ...data.buffer,
    amount: step.bufferAfter,
    history: step.toBuffer > 0 ? [...data.buffer.history, { date, amount: step.toBuffer, note: 'Payday' }] : data.buffer.history,
    updatedAt: now,
  };

  // Stable ids (payday number + what it was for): two synced phones that both tap "I did it" for the
  // same payday write the same records, so they merge into one instead of doubling.
  const pay = (p: Omit<Payment, 'id' | 'updatedAt' | 'date' | 'planned' | 'paydayNumber'>): Payment => ({
    id: `pay-${number}-${p.kind}-${p.debtId ?? p.fundId ?? 'buffer'}`,
    updatedAt: now,
    date,
    planned: true,
    paydayNumber: number,
    ...p,
  });
  const payments: Payment[] = [];
  for (const d of step.debts) {
    if (d.minimum > 0) payments.push(pay({ debtId: d.id, fundId: null, amount: d.minimum, kind: 'minimum' }));
    if (d.extra > 0) payments.push(pay({ debtId: d.id, fundId: null, amount: d.extra, kind: 'extra' }));
  }
  if (step.toBuffer > 0) payments.push(pay({ debtId: null, fundId: null, amount: step.toBuffer, kind: 'buffer' }));
  if (share > 0) {
    for (const f of data.funds) {
      payments.push(pay({ debtId: null, fundId: f.id, amount: (f.perYear / plan.ppy) * share, kind: 'fund' }));
    }
  }

  const snapOf = (debts: Debt[], bufferAmount: number, fundList: { id: string; saved: number }[]): PaydaySnap => ({
    debts: Object.fromEntries(debts.map((d) => [d.id, [d.balance, d.status] as [number, string]])),
    buffer: bufferAmount,
    funds: Object.fromEntries(fundList.map((f) => [f.id, f.saved])),
  });
  const afterDebts = data.debts.map((d) => changedById.get(d.id) ?? d);
  const snap = {
    before: { ...snapOf(data.debts, data.buffer.amount, data.funds), historyLen: data.buffer.history.length, oneOffs: s.oneOffs },
    after: snapOf(afterDebts, buffer.amount, funds),
  };
  const log: PaydayLog = { id: `payday-${number}`, snap, updatedAt: now, number, date, status: 'done', planMoney, total, plannedTotal, debtLeft: step.debtLeft, dailyCost: dailyInterestCost(activeDebts(data)), bills: bills.due.map(({ debtId, name, amount, due }) => ({ debtId, name, amount, due })) };
  // One-off money planned for this payday is used now
  const oneOffs = s.oneOffs.filter((o) => oneOffPayday(s, o.date) !== 1);
  const settings: Settings = { ...s, oneOffs, paydayIndex: s.paydayIndex + 1, updatedAt: now };

  const tx = db.transaction(['settings', 'debts', 'funds', 'buffer', 'payments', 'paydays'], 'readwrite');
  await tx.objectStore('settings').put(settings);
  for (const d of changedDebts) await tx.objectStore('debts').put(d);
  for (const f of funds) await tx.objectStore('funds').put(f);
  await tx.objectStore('buffer').put(buffer);
  for (const p of payments) await tx.objectStore('payments').put(p);
  await tx.objectStore('paydays').put(log);
  await tx.done;

  return {
    data: {
      ...data,
      settings,
      debts: data.debts.map((d) => changedById.get(d.id) ?? d),
      funds,
      buffer,
      payments: [...data.payments, ...payments],
      paydays: [...data.paydays, log],
    },
    step,
    newlyPaid,
  };
}

/**
 * Undo "I did it": balances, buffer, yearly-bill savings, the next payday and the logs go back to how
 * they were. Records made by that payday are deleted, and the rest are saved again with a new time,
 * so a synced second device takes the undone state too.
 */
export async function undoPayday(db: PiyDB, before: AppData, after: AppData, now = Date.now()): Promise<AppData> {
  const bump = <T extends { updatedAt: number }>(r: T): T => ({ ...r, updatedAt: now });
  const keep = {
    payments: new Set(before.payments.map((p) => p.id)),
    paydays: new Set(before.paydays.map((p) => p.id)),
    milestones: new Set(before.milestones.map((m) => m.id)),
  };
  const restored: AppData = {
    ...before,
    settings: bump(before.settings),
    debts: before.debts.map(bump),
    funds: before.funds.map(bump),
    buffer: bump(before.buffer),
  };
  const tx = db.transaction(['settings', 'debts', 'funds', 'buffer', 'payments', 'paydays', 'milestones'], 'readwrite');
  await tx.objectStore('settings').put(restored.settings);
  for (const d of restored.debts) await tx.objectStore('debts').put(d);
  for (const f of restored.funds) await tx.objectStore('funds').put(f);
  await tx.objectStore('buffer').put(restored.buffer);
  for (const p of after.payments) if (!keep.payments.has(p.id)) await tx.objectStore('payments').delete(p.id);
  for (const p of after.paydays) if (!keep.paydays.has(p.id)) await tx.objectStore('paydays').delete(p.id);
  for (const m of after.milestones) if (!keep.milestones.has(m.id)) await tx.objectStore('milestones').delete(m.id);
  await tx.done;
  return { ...restored, milestones: before.milestones.filter((m) => keep.milestones.has(m.id)) };
}

/** The payday that was done last (the one before the next payday), if it can still be changed: nothing moved since. */
export function changeablePayday(data: AppData): PaydayLog | null {
  const number = nextPaydayNumber(data.settings) - 1;
  const log = data.paydays.find((p) => p.number === number && p.status === 'done');
  const after = log?.snap?.after;
  if (!log || !after) return null;
  const same =
    data.debts.every((d) => !(d.id in after.debts) || (after.debts[d.id]![0] === d.balance && after.debts[d.id]![1] === d.status)) &&
    data.buffer.amount === after.buffer &&
    data.funds.every((f) => !(f.id in after.funds) || after.funds[f.id] === f.saved) &&
    !data.payments.some((p) => (p.paydayNumber ?? 0) > number);
  return same ? log : null;
}

/** The data as it was just before a payday was done, rebuilt from its snapshot. */
function beforePayday(data: AppData, log: PaydayLog): AppData {
  const b = log.snap!.before;
  return {
    ...data,
    settings: { ...data.settings, paydayIndex: data.settings.paydayIndex - 1, oneOffs: b.oneOffs },
    debts: data.debts.map((d) => (d.id in b.debts ? { ...d, balance: b.debts[d.id]![0], status: b.debts[d.id]![1] as Debt['status'] } : d)),
    funds: data.funds.map((f) => (f.id in b.funds ? { ...f, saved: b.funds[f.id]! } : f)),
    buffer: { ...data.buffer, amount: b.buffer, history: data.buffer.history.slice(0, b.historyLen) },
    payments: data.payments.filter((p) => p.paydayNumber !== log.number),
    paydays: data.paydays.filter((p) => p.number !== log.number),
  };
}

/** "Change what I paid": put the last payday back, then do it again with the money the buyer really put toward the plan. */
export async function changePaid(db: PiyDB, data: AppData, planMoney: number, now = Date.now()): Promise<PaydayDone & { before: AppData }> {
  const log = changeablePayday(data);
  if (!log) throw new Error('This payday can no longer be changed.');
  const restored = await undoPayday(db, beforePayday(data, log), data, now);
  const res = await didPayday(db, restored, { planMoney, now: now + 1 });
  return { ...res, before: restored };
}

/** Paydays before `today` that were neither done nor skipped. */
export function missedPaydays(data: AppData, today: string): number {
  let count = 0;
  const s = data.settings;
  for (let i = 0; i < 520; i++) {
    const date = nextPaydayISO({ ...s, paydayIndex: s.paydayIndex + i });
    if (date >= today) break;
    count++;
  }
  return count;
}

/** "I skipped it": the next payday moves forward, nothing is applied. */
export async function skipPaydays(db: PiyDB, data: AppData, count: number, now = Date.now()): Promise<AppData> {
  const s = data.settings;
  const logs: PaydayLog[] = [];
  for (let i = 0; i < count; i++) {
    const at = { ...s, paydayIndex: s.paydayIndex + i };
    logs.push({ id: `payday-${nextPaydayNumber(at)}`, updatedAt: now, number: nextPaydayNumber(at), date: nextPaydayISO(at), status: 'skipped', planMoney: 0, total: 0 });
  }
  const settings: Settings = { ...s, paydayIndex: s.paydayIndex + count, updatedAt: now };
  const tx = db.transaction(['settings', 'paydays'], 'readwrite');
  await tx.objectStore('settings').put(settings);
  for (const l of logs) await tx.objectStore('paydays').put(l);
  await tx.done;
  return { ...data, settings, paydays: [...data.paydays, ...logs] };
}

/** "+ Extra payment": goes to the focus debt now, any overflow to the next debt in order. */
export async function extraPayment(
  db: PiyDB,
  data: AppData,
  amount: number,
  today: string,
  now = Date.now(),
): Promise<{ data: AppData; newlyPaid: string[] }> {
  const debts = activeDebts(data);
  const rank = new Map(data.settings.payoffOrder.map((id, i) => [id, i]));
  const order = [...debts].sort((a, b) => (rank.get(a.id) ?? 1e6) - (rank.get(b.id) ?? 1e6) || a.position - b.position);
  let left = amount;
  const changed: Debt[] = [];
  const payments: Payment[] = [];
  const newlyPaid: string[] = [];
  for (const debt of order) {
    if (left <= ZERO) break;
    const paid = Math.min(left, debt.balance);
    if (paid <= 0) continue;
    left -= paid;
    const balance = debt.balance - paid;
    const done = balance <= ZERO;
    if (done) newlyPaid.push(debt.id);
    changed.push({ ...debt, balance: done ? 0 : balance, status: done ? 'paid' : debt.status, updatedAt: now });
    payments.push({ id: newId(), updatedAt: now, date: today, debtId: debt.id, fundId: null, amount: paid, kind: 'extra', planned: false, paydayNumber: null });
  }
  const tx = db.transaction(['debts', 'payments'], 'readwrite');
  for (const d of changed) await tx.objectStore('debts').put(d);
  for (const p of payments) await tx.objectStore('payments').put(p);
  await tx.done;
  const byId = new Map(changed.map((d) => [d.id, d]));
  return {
    data: { ...data, debts: data.debts.map((d) => byId.get(d.id) ?? d), payments: [...data.payments, ...payments] },
    newlyPaid,
  };
}
