/** Safety net tab: buffer, yearly bills, Find money, paycheck. */
import { commit, newId, type PiyDB } from '../data/db';
import type { AppData, FindMoneyItem, Fund } from '../data/types';

/** "I used $200 for a car repair": the buffer goes down and the plan refills it first. */
export async function useBuffer(db: PiyDB, data: AppData, amount: number, note: string, today: string, now = Date.now()): Promise<AppData> {
  const used = Math.min(amount, data.buffer.amount);
  return commit(db, data, {
    buffer: {
      ...data.buffer,
      amount: data.buffer.amount - used,
      history: [...data.buffer.history, { date: today, amount: -used, note: note.trim() || 'Used for a surprise' }],
      updatedAt: now,
    },
  });
}

/** Fix the buffer to what's really in the account or envelope. */
export async function setBuffer(db: PiyDB, data: AppData, amount: number, today: string, now = Date.now()): Promise<AppData> {
  const diff = amount - data.buffer.amount;
  if (diff === 0) return data;
  return commit(db, data, {
    buffer: { ...data.buffer, amount, history: [...data.buffer.history, { date: today, amount: diff, note: 'Updated' }], updatedAt: now },
  });
}

export async function setBufferGoal(db: PiyDB, data: AppData, goal: number, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, bufferGoal: goal, updatedAt: now } });
}

/** The first name for the greeting on Today. Empty takes it away. */
export async function setFirstName(db: PiyDB, data: AppData, name: string, now = Date.now()): Promise<AppData> {
  const { firstName: _old, ...rest } = data.settings;
  const tidy = name.trim().slice(0, 24);
  return commit(db, data, { settings: { ...rest, ...(tidy ? { firstName: tidy } : {}), updatedAt: now } });
}

export async function setPaycheck(db: PiyDB, data: AppData, amount: number | null, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, paycheckAmount: amount, updatedAt: now } });
}

export interface FundFields {
  name: string;
  perYear: number;
  month: string;
}

export async function addFund(db: PiyDB, data: AppData, f: FundFields, now = Date.now()): Promise<AppData> {
  const position = data.funds.reduce((m, x) => Math.max(m, x.position), -1) + 1;
  const fund: Fund = { id: newId(), updatedAt: now, ...f, saved: 0, position };
  return commit(db, data, { funds: [fund] });
}

export async function editFund(db: PiyDB, data: AppData, id: string, f: FundFields, now = Date.now()): Promise<AppData> {
  const fund = data.funds.find((x) => x.id === id)!;
  return commit(db, data, { funds: [{ ...fund, ...f, updatedAt: now }] });
}

export async function removeFund(db: PiyDB, data: AppData, id: string): Promise<AppData> {
  return commit(db, data, { remove: { funds: [id] } });
}

/** "I paid this bill": the money saved for it goes down. */
export async function spendFund(db: PiyDB, data: AppData, id: string, amount: number, now = Date.now()): Promise<AppData> {
  const fund = data.funds.find((x) => x.id === id)!;
  return commit(db, data, { funds: [{ ...fund, saved: Math.max(0, fund.saved - amount), updatedAt: now }] });
}

export type FindGroup = 'cut' | 'sell' | 'earn' | 'lower';

/** Find money: four groups of ideas, each with a typical amount. Never loans, buy now pay later or card tricks. */
export const FIND_GROUPS: { key: FindGroup; label: string }[] = [
  { key: 'cut', label: 'Cut' },
  { key: 'sell', label: 'Sell' },
  { key: 'earn', label: 'Earn' },
  { key: 'lower', label: 'Lower' },
];

export const FIND_MONEY_IDEAS: { key: string; group: FindGroup; label: string; typical: number; monthly?: boolean }[] = [
  { key: 'subscriptions', group: 'cut', label: 'Cancel one subscription', typical: 15, monthly: true },
  { key: 'takeout', group: 'cut', label: 'Skip takeout for two weeks', typical: 60 },
  { key: 'pantry', group: 'cut', label: 'Eat from the pantry for a week', typical: 40 },
  { key: 'sell', group: 'sell', label: 'Sell 3 things you don’t use', typical: 100 },
  { key: 'returns', group: 'sell', label: 'Return something unused', typical: 30 },
  { key: 'hours', group: 'earn', label: 'Pick up a few extra hours', typical: 120 },
  { key: 'weekend', group: 'earn', label: 'One weekend job, like pet sitting', typical: 80 },
  { key: 'bills', group: 'lower', label: 'Call to lower your phone or internet bill', typical: 20, monthly: true },
  { key: 'insurance', group: 'lower', label: 'Compare your car insurance', typical: 30, monthly: true },
];

/** One item per idea, with what was found for it so far */
export function findMoneyItems(data: AppData): FindMoneyItem[] {
  const saved = data.findMoney?.items ?? [];
  return FIND_MONEY_IDEAS.map(({ key, label }) => saved.find((s) => s.key === key) ?? { key, label, amount: null, done: false });
}

/** Money found so far: every saved idea marked found, older ideas included */
export function foundTotal(data: AppData): number {
  return (data.findMoney?.items ?? []).reduce((sum, i) => sum + (i.done ? i.amount ?? 0 : 0), 0);
}

/** What was found for one idea */
export function foundFor(data: AppData, key: string): number {
  const i = data.findMoney?.items.find((x) => x.key === key);
  return i?.done ? i.amount ?? 0 : 0;
}

/**
 * "I found $40": the amount goes in as extra money on the next payday (one-off money on that payday's date), so it
 * follows the engine's order: the yearly bills' share, the buffer until its goal, then the focus debt. With no debt
 * left there is no payday plan, so it goes straight to the buffer.
 */
export async function addFoundMoney(
  db: PiyDB,
  data: AppData,
  key: string,
  amount: number,
  paydayDate: string | null,
  today: string,
  now = Date.now(),
): Promise<AppData> {
  const saved = data.findMoney?.items ?? [];
  const idea = FIND_MONEY_IDEAS.find((x) => x.key === key);
  const was = saved.find((x) => x.key === key) ?? { key, label: idea?.label ?? key, amount: null, done: false };
  const item: FindMoneyItem = { ...was, amount: foundFor(data, key) + amount, done: true };
  const items = saved.some((x) => x.key === key) ? saved.map((x) => (x.key === key ? item : x)) : [...saved, item];
  const s = data.settings;
  const found = { id: 'findMoney' as const, updatedAt: now, items };
  if (paydayDate)
    return commit(db, data, { findMoney: found, settings: { ...s, oneOffs: [...s.oneOffs, { id: newId(), date: paydayDate, amount, note: 'Found money' }], updatedAt: now } });
  return commit(db, data, {
    findMoney: found,
    buffer: { ...data.buffer, amount: data.buffer.amount + amount, history: [...data.buffer.history, { date: today, amount, note: 'Found money' }], updatedAt: now },
  });
}

export async function saveFindMoney(db: PiyDB, data: AppData, items: FindMoneyItem[], now = Date.now()): Promise<AppData> {
  return commit(db, data, { findMoney: { id: 'findMoney', updatedAt: now, items } });
}
