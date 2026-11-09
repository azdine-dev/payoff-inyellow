/** A payday with nothing to move: 1 debt, a $50 minimum, $0 extra, every 2 weeks. */
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openAppDB } from '../data/db';
import type { AppData } from '../data/types';
import { simulatePlan } from '../engine';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { toPlanInput } from './planInput';
import { nextMove, paydayIsEmpty, paydayTotal, shouldAutoCount } from './zeroPayday';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-06',
  paycheckAmount: null,
  debts: [{ name: 'Visa', type: '', balance: 1000, apr: 20, minMonthly: 50, dueDay: 12, autopay: false, myOrder: null }],
  bufferNow: 0,
  bufferGoal: 500,
  extraPerPayday: 0,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let d: AppData;
beforeAll(async () => {
  d = await completeSetup(await openAppDB('zero-payday'), setup, '2026-10-30');
});
const plan = (x: AppData) => simulatePlan(toPlanInput(x));

describe('paydays that move nothing', () => {
  it('the bill falls on every other payday; the ones between move $0', () => {
    const r = plan(d);
    expect([0, 1, 2, 3].map((i) => paydayTotal(d, r, i))).toEqual([50, 0, 50, 0]);
    expect(paydayIsEmpty(d, r)).toBe(false); // the first payday has the Visa bill
  });

  it('the next move is the next bill: Visa $50 on Sat 12 Dec', () => {
    const r = plan(d);
    expect(nextMove(d, r, 1)).toEqual({ name: 'Visa', amount: 50, date: '2026-12-12' });
    expect(nextMove(d, r, 0)).toEqual({ name: 'Visa', amount: 50, date: '2026-11-12' });
  });

  it('after the first payday the next one is empty, and it counts itself only once its day has come', async () => {
    const db = await openAppDB('zero-payday-2');
    const first = (await didPayday(db, d, {})).data;
    expect(paydayIsEmpty(first)).toBe(true); // Fri 20 Nov: nothing due before Fri 4 Dec
    expect(shouldAutoCount(first, '2026-11-19')).toBe(false);
    expect(shouldAutoCount(first, '2026-11-20')).toBe(true);
    expect(shouldAutoCount(first, '2026-12-30')).toBe(true);
    const auto = (await didPayday(db, first, {})).data;
    expect(auto.paydays).toHaveLength(2);
    expect(auto.paydays[1]).toMatchObject({ date: '2026-11-20', status: 'done', total: 0 });
    expect(shouldAutoCount(auto, '2026-12-30')).toBe(false); // Fri 4 Dec moves the Visa bill: that one is for the buyer
    expect(nextMove(auto, plan(auto), 0)).toEqual({ name: 'Visa', amount: 50, date: '2026-12-12' });
  });

  it('several empty paydays in a row all count, one after another, and then it stops', async () => {
    // $0 for the plan and a bill every second payday, opened again a long time later
    const db = await openAppDB('zero-payday-3');
    let x = (await didPayday(db, d, {})).data;
    let counted = 0;
    for (let guard = 0; guard < 10 && shouldAutoCount(x, '2026-12-03'); guard++) {
      x = (await didPayday(db, x, {})).data;
      counted++;
    }
    expect(counted).toBe(1); // Fri 20 Nov; Fri 4 Dec has the bill and has not come yet
    expect(shouldAutoCount(x, '2026-12-03')).toBe(false);
  });

  it('a plan with no debts left has nothing to count', () => {
    expect(shouldAutoCount({ ...d, debts: d.debts.map((x) => ({ ...x, status: 'paid' as const })) }, '2027-01-01')).toBe(false);
  });
});
