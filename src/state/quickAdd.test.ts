import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import { completeSetup, type SetupValues } from './actions';
import { addDebt, editDebt } from './debtActions';

const sample: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [{ name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null }],
  bufferNow: 500,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`quick-${n++}`);
});

describe('quick add', () => {
  it('saves a debt with only a name, balance and rate, flagged until the minimum is added', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    const next = await addDebt(db, start, { name: 'Phone', type: '', balance: 400, apr: 0, minMonthly: 0, minPending: true, dueDay: null, autopay: false }, 2000);
    const phone = next.debts.find((d) => d.name === 'Phone')!;
    expect(phone.minPending).toBe(true);
    expect(phone.minMonthly).toBe(0);
    expect((await loadAll(db))!.debts.find((d) => d.name === 'Phone')!.minPending).toBe(true); // stored
  });

  it('adding the minimum later clears the flag', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    const added = await addDebt(db, start, { name: 'Phone', type: '', balance: 400, apr: 0, minMonthly: 0, minPending: true, dueDay: null, autopay: false }, 2000);
    const phone = added.debts.find((d) => d.name === 'Phone')!;
    const done = await editDebt(db, added, phone.id, { name: 'Phone', type: '', balance: 400, apr: 0, minMonthly: 40, minPending: false, dueDay: 5, autopay: false }, 3000);
    const after = done.debts.find((d) => d.name === 'Phone')!;
    expect(after.minPending).toBe(false);
    expect(after.minMonthly).toBe(40);
    expect(after.dueDay).toBe(5);
  });

  it('old debts (no flag at all) are unchanged', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    expect(start.debts[0]!.minPending).toBeUndefined();
  });
});
