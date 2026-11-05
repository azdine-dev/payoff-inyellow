/** Plan tab: payoff order and the what-if. */
import { commit, newId, type PiyDB } from '../data/db';
import type { AppData, Debt } from '../data/types';
import type { PayoffMethod } from '../engine';
import { orderFor } from './planInput';

export async function setMethod(db: PiyDB, data: AppData, method: PayoffMethod, now = Date.now()): Promise<AppData> {
  // "My own order" starts from the order the debts are in now
  const debts: Debt[] =
    method === 'my-order' && data.debts.every((d) => d.myOrder === null)
      ? data.debts.map((d) => ({ ...d, myOrder: d.position + 1, updatedAt: now }))
      : [];
  // Picking a payoff order again is when the order is made again
  const next: AppData = { ...data, debts: debts.length ? data.debts.map((d) => debts.find((x) => x.id === d.id) ?? d) : data.debts };
  return commit(db, data, { settings: { ...data.settings, method, payoffOrder: orderFor(next, method), updatedAt: now }, debts });
}

/** "Use this in my plan": the slider amount joins the usual money, one-off money is kept with its date. */
export async function applyWhatIf(
  db: PiyDB,
  data: AppData,
  extraPerPayday: number,
  oneOff: { amount: number; date: string; note: string } | null,
  now = Date.now(),
): Promise<AppData> {
  const s = data.settings;
  return commit(db, data, {
    settings: {
      ...s,
      extraPerPayday: s.extraPerPayday + extraPerPayday,
      oneOffs: oneOff && oneOff.amount > 0 ? [...s.oneOffs, { id: newId(), ...oneOff }] : s.oneOffs,
      updatedAt: now,
    },
  });
}

/** "It's coming later": money with a payday and an optional type. Today asks "Did it arrive?" on that payday. */
export async function addComingLater(db: PiyDB, data: AppData, money: { amount: number; date: string; kind: string | null }, now = Date.now()): Promise<AppData> {
  const s = data.settings;
  const entry = { id: newId(), date: money.date, amount: money.amount, note: money.kind ?? 'Money coming later', ...(money.kind ? { kind: money.kind } : {}), later: true, arrived: false };
  return commit(db, data, { settings: { ...s, oneOffs: [...s.oneOffs, entry], updatedAt: now } });
}

/** "Yes" on "Did it arrive?": from now on the payday counts it. */
export async function confirmArrived(db: PiyDB, data: AppData, id: string, now = Date.now()): Promise<AppData> {
  const s = data.settings;
  return commit(db, data, { settings: { ...s, oneOffs: s.oneOffs.map((o) => (o.id === id ? { ...o, arrived: true } : o)), updatedAt: now } });
}

/** Move money coming later to another payday */
export async function moveComingLater(db: PiyDB, data: AppData, id: string, date: string, now = Date.now()): Promise<AppData> {
  const s = data.settings;
  return commit(db, data, { settings: { ...s, oneOffs: s.oneOffs.map((o) => (o.id === id ? { ...o, date } : o)), updatedAt: now } });
}

/** Put a removed one-off back (Undo) */
export async function restoreOneOff(db: PiyDB, data: AppData, entry: AppData['settings']['oneOffs'][number], now = Date.now()): Promise<AppData> {
  const s = data.settings;
  if (s.oneOffs.some((o) => o.id === entry.id)) return data;
  return commit(db, data, { settings: { ...s, oneOffs: [...s.oneOffs, entry], updatedAt: now } });
}

export async function removeOneOff(db: PiyDB, data: AppData, id: string, now = Date.now()): Promise<AppData> {
  const s = data.settings;
  return commit(db, data, { settings: { ...s, oneOffs: s.oneOffs.filter((o) => o.id !== id), updatedAt: now } });
}
