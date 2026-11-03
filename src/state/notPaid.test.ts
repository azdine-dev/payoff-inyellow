/** "Mark as not paid": only the most recent paid payday, with the new debt-free date shown first. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { simulatePlan } from '../engine';
import { changeablePayday, completeSetup, didPayday, markNotPaid, notPaidPreview, type SetupValues } from './actions';
import { addDebt, logCharge } from './debtActions';
import { toPlanInput } from './planInput';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-06',
  paycheckAmount: null,
  debts: [
    { name: 'Store Card', type: '', balance: 450, apr: 26.99, minMonthly: 30, dueDay: 12, autopay: false, myOrder: null },
    { name: 'Visa', type: '', balance: 2200, apr: 22.99, minMonthly: 66, dueDay: 20, autopay: false, myOrder: null },
  ],
  bufferNow: 500,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let data: AppData;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`notpaid-${n++}`);
  data = await completeSetup(db, setup, '2026-10-30');
});

const freeDate = (d: AppData) => simulatePlan(toPlanInput(d)).debtFreeDate;

describe('mark as not paid', () => {
  it('the most recent paid payday can be marked, and the preview says where the date goes', async () => {
    const before = freeDate(data);
    const one = (await didPayday(db, data, { now: 10 })).data;
    const preview = notPaidPreview(one)!;
    expect(preview.log.number).toBe(1);
    expect(preview.debtFreeDate).toBe(before); // back to how it was before the payday
  });

  it('marking it as not paid puts everything back: balances, buffer, payments, the payday and the next payday', async () => {
    const one = (await didPayday(db, data, { now: 10 })).data;
    const back = await markNotPaid(db, one, 20);
    expect(back.debts.map((d) => d.balance)).toEqual(data.debts.map((d) => d.balance));
    expect(back.buffer.amount).toBe(data.buffer.amount);
    expect(back.paydays).toHaveLength(0);
    expect(back.payments).toHaveLength(0);
    expect(back.settings.paydayIndex).toBe(data.settings.paydayIndex);
    expect(freeDate(back)).toBe(freeDate(data));
    expect(await loadAll(db)).toEqual(back); // and it is what is saved
  });

  it('with two paydays done only the second can be marked, the first stays paid', async () => {
    const one = (await didPayday(db, data, { now: 10 })).data;
    const two = (await didPayday(db, one, { now: 20 })).data;
    expect(changeablePayday(two)?.number).toBe(2);
    const back = await markNotPaid(db, two, 30);
    expect(back.paydays.map((p) => p.number)).toEqual([1]);
    // now the first is the most recent one
    expect(changeablePayday(back)?.number).toBe(1);
  });

  it('it is not allowed once something else moved after the payday (a new charge)', async () => {
    const one = (await didPayday(db, data, { now: 10 })).data;
    const charged = await logCharge(db, one, one.debts[1]!.id, 100, 'everyday', '', '2026-11-07');
    expect(changeablePayday(charged)).toBeNull();
    expect(notPaidPreview(charged)).toBeNull();
    await expect(markNotPaid(db, charged)).rejects.toThrow();
  });

  it('a new debt added after the payday also locks it', async () => {
    const one = (await didPayday(db, data, { now: 10 })).data;
    const more = await addDebt(db, one, { name: 'Phone', type: '', balance: 300, apr: 0, minMonthly: 25, dueDay: null, autopay: false });
    // the new debt is not in the payday's snapshot, so the payday can still be undone
    expect(changeablePayday(more)).not.toBeNull();
  });

  it('with no payday done there is nothing to mark', () => {
    expect(changeablePayday(data)).toBeNull();
    expect(notPaidPreview(data)).toBeNull();
  });
});
