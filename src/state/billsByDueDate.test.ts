/** v2 of the model: "I did it" applies the bills, the extra, the buffer and the yearly bills that were shown. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openAppDB, type PiyDB } from '../data/db';
import { completeSetup, didPayday, type SetupValues } from './actions';

const values: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null }, // due 5 Nov: in this payday's window
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null }, // due 12 Nov: next payday's window
    { name: 'Gym', type: '', balance: 2000, apr: 10, minMonthly: 30, dueDay: null, autopay: false, myOrder: null }, // no due day: no bill
  ],
  bufferNow: 500,
  bufferGoal: 500,
  extraPerPayday: 100,
  funds: [{ name: 'Car repairs', perYear: 520, month: 'Any time' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`bills-v2-${n++}`);
});

const grow = (balance: number, apr: number) => balance * (1 + apr / 100 / 26);

describe('"I did it" applies what was shown', () => {
  it('bill to its debt, extra to the focus debt, yearly bills to their pot, interest per payday', async () => {
    const start = await completeSetup(db, values, '2026-10-15', 1000);
    const { data, step } = await didPayday(db, start, { now: 2000 });
    const by = (name: string, d = data) => d.debts.find((x) => x.name === name)!;

    // Store card: interest, then its 35 bill, then the extra (100 minus 20 for the yearly bills: 80)
    expect(by('Store card').balance).toBeCloseTo(grow(640, 26.99) - 35 - 80, 6);
    // Visa and Gym have no bill in this window: they only grow by interest
    expect(by('Visa').balance).toBeCloseTo(grow(3200, 22.9), 6);
    expect(by('Gym').balance).toBeCloseTo(grow(2000, 10), 6);
    expect(by('Visa').balance).toBeGreaterThan(3200);
    expect(by('Gym').balance).toBeGreaterThan(2000);

    expect(data.funds[0]!.saved).toBeCloseTo(20, 6); // 520 / 26
    expect(step.minimums).toBeCloseTo(35, 6); // only the bill that was due
    const logged = data.payments.filter((p) => p.kind === 'minimum');
    expect(logged.map((p) => [p.debtId === by('Store card').id, p.amount])).toEqual([[true, 35]]);
  });

  it('the next payday pays the next bill, and a debt with no due day is never paid down by a minimum', async () => {
    const start = await completeSetup(db, values, '2026-10-15', 1000);
    const first = await didPayday(db, start, { now: 2000 });
    const gymBefore = first.data.debts.find((d) => d.name === 'Gym')!.balance;
    const second = await didPayday(db, first.data, { now: 3000 }); // window [6 Nov, 20 Nov): Visa on the 12th
    expect(second.step.debts.find((d) => d.id === first.data.debts.find((x) => x.name === 'Visa')!.id)!.minimum).toBe(96);
    expect(second.step.debts.find((d) => d.id === first.data.debts.find((x) => x.name === 'Gym')!.id)!.minimum).toBe(0);
    expect(second.data.debts.find((d) => d.name === 'Gym')!.balance).toBeGreaterThanOrEqual(gymBefore);
  });
});
