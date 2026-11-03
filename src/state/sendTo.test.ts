/** "I got extra money" > "Send it to": the chosen debt first, the rest in the plan's order. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { completeSetup, extraPayment, splitExtra, type SetupValues } from './actions';
import { extraMoneyPlan } from './whatIf';

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
  db = await openAppDB(`sendto-${n++}`);
  data = await completeSetup(db, setup, '2026-10-30');
});

const id = (name: string) => data.debts.find((d) => d.name === name)!.id;

describe('send it to', () => {
  it('without a choice the extra goes to the focus debt, like before', () => {
    const { payments } = splitExtra(data, 100, '2026-10-30');
    expect(payments).toHaveLength(1);
    expect(payments[0]!.debtId).toBe(id('Store Card'));
  });

  it('a chosen debt takes it, and only what it needs; the overflow goes on in the plan order', async () => {
    const res = await extraPayment(db, data, 100, '2026-10-30', Date.now(), id('Visa'));
    expect(res.data.debts.find((d) => d.name === 'Visa')!.balance).toBe(2100);
    expect(res.data.debts.find((d) => d.name === 'Store Card')!.balance).toBe(450);
    const over = splitExtra(data, 500, '2026-10-30', Date.now(), id('Store Card'));
    expect(over.payments.map((p) => [p.debtId, p.amount])).toEqual([
      [id('Store Card'), 450],
      [id('Visa'), 50],
    ]);
  });

  it('the preview plan follows the choice', () => {
    const toVisa = extraMoneyPlan(data, 400, '2026-10-30', id('Visa'));
    const toFocus = extraMoneyPlan(data, 400, '2026-10-30');
    expect(toVisa.totalInterest).not.toBe(toFocus.totalInterest);
  });
});
