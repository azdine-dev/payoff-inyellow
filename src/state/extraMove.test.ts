/**
 * "Move $X" on a payday with nothing due. Ahmed: Visa $2,000 at 5%, $70 minimum due the 12th, every 2 weeks from
 * Sat 28 Nov 2026, $0 extra, buffer $0. The numbers are engine_v2.py's with adjust {0: 50}.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openAppDB } from '../data/db';
import { simulatePlan } from '../engine';
import { formatMoneyAuto } from '../lib/money';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { extraMove, whereItGoes } from './extraMove';
import { toPlanInput } from './planInput';

const ahmed = (bufferGoal: number): SetupValues => ({
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-28',
  paycheckAmount: null,
  debts: [{ name: 'Visa', type: '', balance: 2000, apr: 5, minMonthly: 70, dueDay: 12, autopay: false, myOrder: null }],
  bufferNow: 0,
  bufferGoal,
  extraPerPayday: 0,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Saturday', time: '20:00' },
});
const money = (n: number) => formatMoneyAuto(n, { code: 'USD', symbol: '$' });

describe('Move $50 on Sat 28 Nov, a payday with nothing due', () => {
  it('goal $500: all of it to the safety net, Visa unchanged, debt-free still Sat 9 Jun 2029', async () => {
    const db = await openAppDB('extra-move-500');
    const d = await completeSetup(db, ahmed(500), '2026-11-26');
    const plan = simulatePlan(toPlanInput(d));
    expect(plan.debtFreeDate).toBe('2029-06-09');
    expect(plan.rows[0]!.date).toBe('2026-11-28');
    const m = extraMove(d, 50, plan);
    expect(m.toBuffer).toBe(50);
    expect(m.toDebts).toEqual([]);
    expect(m.bufferAfter).toBe(50);
    expect(m.after).toBe('2029-06-09');
    expect(whereItGoes(m, money)).toBe('$50 goes to your safety net first.');
    // and "Move $50" does exactly that
    const res = await didPayday(db, d, { planMoney: m.planMoney });
    expect(res.data.buffer.amount).toBe(50);
    expect(res.data.debts[0]!.balance).toBeCloseTo(2003.85, 2); // only the interest: no bill on this payday
    expect(simulatePlan(toPlanInput(res.data)).debtFreeDate).toBe('2029-06-09');
    expect(res.data.paydays.at(-1)!.total).toBe(50);
  });

  it('goal $0: all of it to Visa, which owes $1,953.85 after, and debt-free moves to Sat 12 May 2029', async () => {
    const db = await openAppDB('extra-move-0');
    const d = await completeSetup(db, ahmed(0), '2026-11-26');
    const plan = simulatePlan(toPlanInput(d));
    expect(plan.debtFreeDate).toBe('2029-06-09');
    const m = extraMove(d, 50, plan);
    expect(m.toBuffer).toBe(0);
    expect(m.toDebts.map((x) => [x.name, x.amount])).toEqual([['Visa', 50]]);
    expect(m.toDebts[0]!.owedAfter).toBeCloseTo(1953.85, 2);
    expect(m.after).toBe('2029-05-12');
    expect(whereItGoes(m, money)).toBe('$50 goes to Visa.');
    const res = await didPayday(db, d, { planMoney: m.planMoney });
    expect(res.data.debts[0]!.balance).toBeCloseTo(1953.85, 2);
    expect(simulatePlan(toPlanInput(res.data)).debtFreeDate).toBe('2029-05-12');
  });

  it('more than the buffer needs: the buffer first, then the focus debt', async () => {
    const d = await completeSetup(await openAppDB('extra-move-split'), { ...ahmed(500), bufferNow: 480 }, '2026-11-26');
    const m = extraMove(d, 50, simulatePlan(toPlanInput(d)));
    expect(m.toBuffer).toBe(20);
    expect(m.toDebts.map((x) => x.amount)).toEqual([30]);
    expect(whereItGoes(m, money)).toBe('$20 goes to your safety net first, then $30 to Visa.');
  });
});
