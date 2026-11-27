/**
 * Find money: "I found $__" goes in as extra money on the next payday, in the engine's order (the buffer first).
 * Ahmed: Visa $2,000 at 5%, $70 minimum due the 12th, every 2 weeks from Sat 28 Nov 2026, $0 extra, buffer $0.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadAll, openAppDB } from '../data/db';
import { simulatePlan } from '../engine';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { extraMove } from './extraMove';
import { FIND_GROUPS, FIND_MONEY_IDEAS, addFoundMoney, foundFor, foundTotal } from './moneyActions';
import { nextPaydayISO, plannedMoney, toPlanInput } from './planInput';

const ahmed = (bufferGoal: number, bufferNow = 0): SetupValues => ({
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-28',
  paycheckAmount: null,
  debts: [{ name: 'Visa', type: '', balance: 2000, apr: 5, minMonthly: 70, dueDay: 12, autopay: false, myOrder: null }],
  bufferNow,
  bufferGoal,
  extraPerPayday: 0,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Saturday', time: '20:00' },
});
let n = 0;

describe('the ideas', () => {
  it('are in four groups, Cut, Sell, Earn and Lower, each with a typical amount', () => {
    expect(FIND_GROUPS.map((g) => g.label)).toEqual(['Cut', 'Sell', 'Earn', 'Lower']);
    for (const g of FIND_GROUPS) expect(FIND_MONEY_IDEAS.filter((i) => i.group === g.key).length).toBeGreaterThanOrEqual(2);
    for (const i of FIND_MONEY_IDEAS) expect(i.typical).toBeGreaterThan(0);
    expect(FIND_MONEY_IDEAS.find((i) => i.key === 'subscriptions')).toMatchObject({ label: 'Cancel one subscription', typical: 15, monthly: true });
  });

  it('never suggest borrowing: no loans, buy now pay later or card tricks', () => {
    const words = FIND_MONEY_IDEAS.map((i) => i.label.toLowerCase()).join(' | ');
    for (const bad of ['loan', 'borrow', 'credit', 'card', 'transfer', 'buy now', 'pay later', 'advance', 'cash back', '0%']) expect(words).not.toContain(bad);
  });
});

describe('"I found $40" on Ahmed, goal $500', () => {
  it('goes on the next payday as extra money, all of it to the safety net first; the engine does the rest', async () => {
    const db = await openAppDB(`find-${n++}`);
    const d0 = await completeSetup(db, ahmed(500), '2026-11-26');
    const plan0 = simulatePlan(toPlanInput(d0));
    expect(extraMove(d0, 40, plan0).toBuffer).toBe(40); // what the sheet shows before

    const d = await addFoundMoney(db, d0, 'subscriptions', 40, nextPaydayISO(d0.settings), '2026-11-26');
    expect(d.settings.oneOffs).toEqual([expect.objectContaining({ date: '2026-11-28', amount: 40, note: 'Found money' })]);
    expect(plannedMoney(d)).toBe(40);
    expect(foundTotal(d)).toBe(40);
    expect(foundFor(d, 'subscriptions')).toBe(40);
    // the same plan as "Move $40" on that payday: same rows, same date
    const plan = simulatePlan(toPlanInput(d));
    expect(plan).toEqual(simulatePlan(toPlanInput(d0, 40)));
    expect(plan.rows[0]!.toBuffer).toBe(40);
    expect(plan.debtFreeDate).toBe(plan0.debtFreeDate);

    const r = await didPayday(db, d);
    expect(r.data.buffer.amount).toBe(40);
    expect(r.data.settings.oneOffs).toEqual([]); // used on that payday
    expect(foundTotal(r.data)).toBe(40); // the total stays
    expect(foundTotal((await loadAll(db))!)).toBe(40);
  });

  it('adds up: two finds on two ideas, and again on one', async () => {
    const db = await openAppDB(`find-${n++}`);
    let d = await completeSetup(db, ahmed(500), '2026-11-26');
    const date = nextPaydayISO(d.settings);
    d = await addFoundMoney(db, d, 'sell', 100, date, '2026-11-26');
    d = await addFoundMoney(db, d, 'hours', 120, date, '2026-11-26');
    d = await addFoundMoney(db, d, 'sell', 25, date, '2026-11-26');
    expect(foundFor(d, 'sell')).toBe(125);
    expect(foundTotal(d)).toBe(245);
    expect(plannedMoney(d)).toBe(245);
  });

  it('with the buffer full it goes to Visa, so the date can move', async () => {
    const db = await openAppDB(`find-${n++}`);
    const d0 = await completeSetup(db, ahmed(500, 500), '2026-11-26');
    const d = await addFoundMoney(db, d0, 'hours', 300, nextPaydayISO(d0.settings), '2026-11-26');
    const plan = simulatePlan(toPlanInput(d));
    expect(plan.rows[0]!.toBuffer).toBe(0);
    expect(plan).toEqual(simulatePlan(toPlanInput(d0, 300)));
    expect(plan.debtFreeDate! <= simulatePlan(toPlanInput(d0)).debtFreeDate!).toBe(true);
  });

  it('keeps older checklist ticks in the total', async () => {
    const db = await openAppDB(`find-${n++}`);
    const d0 = await completeSetup(db, ahmed(500), '2026-11-26');
    const old = { ...d0, findMoney: { id: 'findMoney' as const, updatedAt: 1, items: [{ key: 'giftcards', label: 'Use gift cards you forgot about', amount: 30, done: true }] } };
    const d = await addFoundMoney(db, old, 'pantry', 40, nextPaydayISO(d0.settings), '2026-11-26');
    expect(foundTotal(d)).toBe(70);
  });

  it('with no payday plan (no debt left) it goes straight to the buffer', async () => {
    const db = await openAppDB(`find-${n++}`);
    const d0 = await completeSetup(db, ahmed(500), '2026-11-26');
    const d = await addFoundMoney(db, d0, 'returns', 30, null, '2026-11-26');
    expect(d.buffer.amount).toBe(30);
    expect(d.buffer.history.at(-1)).toMatchObject({ amount: 30, note: 'Found money' });
    expect(d.settings.oneOffs).toEqual([]);
  });
});
