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

export async function removeOneOff(db: PiyDB, data: AppData, id: string, now = Date.now()): Promise<AppData> {
  const s = data.settings;
  return commit(db, data, { settings: { ...s, oneOffs: s.oneOffs.filter((o) => o.id !== id), updatedAt: now } });
}
