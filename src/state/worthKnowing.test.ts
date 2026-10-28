import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { openAppDB, type PiyDB } from '../data/db';
import { completeSetup, type SetupValues } from './actions';
import { addDebt } from './debtActions';
import { useBuffer } from './moneyActions';
import { toPlanInput } from './planInput';
import { worthKnowing } from './worthKnowing';

const values: SetupValues = {
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
  extraPerPayday: 100,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};
const fmt = { money: (n: number) => `$${Math.round(n)}`, day: (iso: string) => iso };

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`know-${n++}`);
});

const know = (d: Awaited<ReturnType<typeof completeSetup>>) => worthKnowing(d, simulatePlan(toPlanInput(d)), '2026-10-28', fmt);

describe('Worth knowing', () => {
  it('is empty when there is nothing to say', async () => {
    expect(know(await completeSetup(db, values, '2026-10-15', 1000))).toEqual([]);
  });

  it('names a debt that grows, a bill with no due day, and a buffer that is refilling', async () => {
    let d = await completeSetup(db, values, '2026-10-15', 1000);
    d = await addDebt(db, d, { name: 'Old card', type: '', balance: 5000, apr: 29.99, minMonthly: 100, dueDay: 3, autopay: false }, 2000);
    d = await addDebt(db, d, { name: 'Phone plan', type: '', balance: 300, apr: 0, minMonthly: 40, dueDay: null, autopay: false }, 3000);
    d = await useBuffer(db, d, 200, 'Car repair', '2026-10-20', 4000);
    const list = know(d);
    expect(list).toEqual([
      'Old card grows even when you pay the minimum, so it goes first.',
      'Phone plan has no due day yet, so its bill is not in your plan. Add it on the Debts tab.',
      'You used some of your buffer. Your plan refills it first: $300 of $500 so far.',
    ]);
  });

  it('shows at most three, and says a promo that the plan clears is only a heads-up', async () => {
    let d = await completeSetup(db, values, '2026-10-15', 1000);
    d = await addDebt(db, d, { name: 'Sofa card', type: '', balance: 400, apr: 24, minMonthly: 40, dueDay: 9, autopay: false, promoApr: 0, promoEnds: '2027-03-01', deferredInterest: true }, 2000);
    expect(know(d)).toEqual(['Sofa card’s promo rate ends 2027-03-01. Your plan clears it before then.']);
    d = await addDebt(db, d, { name: 'Old card', type: '', balance: 5000, apr: 29.99, minMonthly: 100, dueDay: 3, autopay: false }, 3000);
    d = await addDebt(db, d, { name: 'Phone plan', type: '', balance: 300, apr: 0, minMonthly: 40, dueDay: null, autopay: false }, 4000);
    d = await useBuffer(db, d, 200, 'x', '2026-10-20', 5000);
    expect(know(d)).toHaveLength(3);
  });
});
