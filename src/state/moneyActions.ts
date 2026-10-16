/** Money tab: buffer, yearly bills, "Find your first $500", paycheck. */
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

/** "Find your first $500" ideas (CLAUDE.md §5). No borrowing ideas, ever. */
export const FIND_MONEY_IDEAS: { key: string; label: string }[] = [
  { key: 'sell', label: 'Sell 3 things you don’t use' },
  { key: 'subscriptions', label: 'Pause 2 subscriptions' },
  { key: 'pantry', label: 'Eat from the pantry for a week' },
  { key: 'hours', label: 'Pick up extra hours or a side job' },
  { key: 'returns', label: 'Return something you haven’t used' },
  { key: 'bills', label: 'Call to lower a bill (phone, internet, insurance)' },
  { key: 'giftcards', label: 'Use gift cards you forgot about' },
  { key: 'takeout', label: 'Skip takeout for two weeks' },
];

export function findMoneyItems(data: AppData): FindMoneyItem[] {
  const saved = data.findMoney?.items ?? [];
  return FIND_MONEY_IDEAS.map((idea) => saved.find((s) => s.key === idea.key) ?? { ...idea, amount: null, done: false });
}

export async function saveFindMoney(db: PiyDB, data: AppData, items: FindMoneyItem[], now = Date.now()): Promise<AppData> {
  return commit(db, data, { findMoney: { id: 'findMoney', updatedAt: now, items } });
}
