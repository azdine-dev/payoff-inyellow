/** "Change what I paid": the last payday goes back and is done again with another amount. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import { changeablePayday, changePaid, completeSetup, didPayday, extraPayment, type SetupValues } from './actions';

const sample: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null },
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null },
  ],
  bufferNow: 500,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [{ name: 'Car repairs', perYear: 600, month: 'Any time' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`change-paid-${n++}`);
});

describe('changePaid', () => {
  it('gives the same state as doing the payday once with the other amount', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    const first = await didPayday(db, start, { now: 2000 });
    expect(changeablePayday(first.data)?.number).toBe(1);

    const changed = await changePaid(db, first.data, 60, 3000);
    const direct = await didPayday(await openAppDB(`change-paid-direct-${n++}`), start, { planMoney: 60, now: 3000 });

    const balances = (d: typeof start) => d.debts.map((x) => [x.name, Math.round(x.balance * 1e6) / 1e6, x.status]);
    expect(balances(changed.data)).toEqual(balances(direct.data));
    expect(changed.data.buffer.amount).toBeCloseTo(direct.data.buffer.amount, 9);
    expect(changed.data.buffer.history).toHaveLength(direct.data.buffer.history.length);
    expect(changed.data.funds.map((f) => f.saved)).toEqual(direct.data.funds.map((f) => f.saved));
    expect(changed.data.settings.paydayIndex).toBe(direct.data.settings.paydayIndex);
    expect(changed.data.paydays).toHaveLength(1);
    expect(changed.data.paydays[0]!.planMoney).toBe(60);
    // The records on disk are the new ones: one payday, no doubled payments
    const saved = (await loadAll(db))!;
    expect(saved.paydays).toHaveLength(1);
    expect(saved.payments.length).toBe(direct.data.payments.length);
  });

  it('can be changed again, and the snapshot of the first payday still holds', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    const first = await didPayday(db, start, { now: 2000 });
    const once = await changePaid(db, first.data, 40, 3000);
    const twice = await changePaid(db, once.data, 150, 4000);
    expect(twice.data.debts.map((d) => d.balance)).toEqual(first.data.debts.map((d) => d.balance)); // 150 is the usual amount
  });

  it('is not offered once something else moved the balances', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    const first = await didPayday(db, start, { now: 2000 });
    const more = await extraPayment(db, first.data, 25, '2026-10-16', 3000);
    expect(changeablePayday(more.data)).toBeNull();
    await expect(changePaid(db, more.data, 60, 4000)).rejects.toThrow();
  });

  it('is not offered before any payday is done, or for a payday that is not the last one', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    expect(changeablePayday(start)).toBeNull();
    const first = await didPayday(db, start, { now: 2000 });
    const second = await didPayday(db, first.data, { now: 3000 });
    expect(changeablePayday(second.data)?.number).toBe(2);
  });
});
