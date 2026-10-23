/** docs/ux-v2/ux-v2.md section 9: the three bugs found on the live site, each with its test. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { dayMonth, shortDate } from '../lib/today';
import { completeSetup, didPayday, extraPayment, type SetupValues } from './actions';
import { archiveDebt, restoreDebt, updateBalance } from './debtActions';
import { isDebtFree } from './debtFree';
import { hasRealPayments, milestoneDate, progressStats, reachedKeys, syncMilestones } from './milestones';
import { activeDebts, toPlanInput } from './planInput';

const sample: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: null, autopay: false, myOrder: null },
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: null, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 300,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let n = 0;
const make = (v: SetupValues = sample) => completeSetup(db, v, '2026-10-15', 1000);
const keys = (d: AppData) => [...reachedKeys(d, simulatePlan(toPlanInput(d)))].sort();
beforeEach(async () => {
  db = await openAppDB(`s9-${n++}`);
});

describe('bug 1: archived debts leave every total, simulation and milestone', () => {
  it('with the only debt archived, every number says debt-free and nothing is ticked', async () => {
    const one = await make({ ...sample, debts: [sample.debts[0]!] });
    const archived = await archiveDebt(db, one, one.debts[0]!.id, 2000);
    expect(isDebtFree(archived)).toBe(true);
    expect(activeDebts(archived)).toHaveLength(0);
    expect(progressStats(archived)).toMatchObject({ start: 0, owed: 0, paid: 0, pct: 0 });
    expect(keys(archived)).toEqual(['plan-made']); // no milestone on an empty plan
    // The engine has no date for an empty plan: screens must read that as debt-free, never "more than 20 years"
    expect(simulatePlan(toPlanInput(archived)).debtFreeDate).toBeNull();
  });

  it('with two debts, the archived one is out of the totals and the order', async () => {
    const two = await make();
    const visa = two.debts.find((d) => d.name === 'Visa')!;
    const archived = await archiveDebt(db, two, visa.id, 2000);
    expect(isDebtFree(archived)).toBe(false);
    expect(progressStats(archived)).toMatchObject({ start: 640, owed: 640 });
    expect(archived.settings.payoffOrder).toEqual([two.debts.find((d) => d.name === 'Store card')!.id]);
    expect(simulatePlan(toPlanInput(archived)).rows[0]!.debts).toHaveLength(1);
  });

  it('archiving a debt does not make the plan look "a month ahead"', async () => {
    const two = await make();
    const done = await didPayday(db, two, { now: 2000 });
    const visa = done.data.debts.find((d) => d.name === 'Visa')!;
    const archived = await archiveDebt(db, done.data, visa.id, 3000);
    expect(keys(archived)).not.toContain('month-ahead');
    // and bringing it back does not either
    const back = await restoreDebt(db, archived, visa.id, 4000);
    expect(keys(back)).not.toContain('month-ahead');
  });
});

describe('bug 2: milestones only tick with real payments, and carry real dates', () => {
  it('an empty plan has only "plan made", even if a debt starts at zero', async () => {
    const empty = await make({ ...sample, debts: [{ ...sample.debts[0]!, balance: 0 }, sample.debts[1]!] });
    expect(hasRealPayments(empty)).toBe(false);
    expect(keys(empty)).toEqual(['plan-made']);
  });

  it('a balance fixed to zero from the statement is not a payment, so it is not "first debt gone"', async () => {
    const two = await make();
    const paidByStatement = await updateBalance(db, two, two.debts[1]!.id, 0, 2000);
    expect(keys(paidByStatement)).toEqual(['plan-made']);
  });

  it('real payments tick them, each with the date of the payment, not the day it was noticed', async () => {
    const two = await make();
    const p1 = await didPayday(db, two, { now: 2000 }); // payday 1, 2026-10-23
    const p2 = await didPayday(db, p1.data, { now: 3000 }); // payday 2, 2026-11-06
    const p3 = await didPayday(db, p2.data, { now: 4000 }); // payday 3, 2026-11-20
    const extra = await extraPayment(db, p3.data, 640, '2026-11-25'); // pays Store card off
    const d = extra.data;
    expect(keys(d)).toEqual(expect.arrayContaining(['plan-made', 'buffer-full', 'first-extra', 'first-debt']));

    // The same check, run a month later, gives dates from the logs
    const synced = await syncMilestones(db, d, simulatePlan(toPlanInput(d)), '2026-12-30', 9000);
    const date = (k: string) => synced.milestones.find((m) => m.id === k)!.reachedOn;
    expect(new Set(synced.milestones.filter((m) => m.id !== 'plan-made').map((m) => m.reachedOn)).size).toBeGreaterThan(1); // not all one day
    expect(date('buffer-full')).toBe('2026-10-23'); // the payday that filled it ($300 on top of $200 reaches $500)
    expect(date('first-extra') < '2026-12-30').toBe(true);
    expect(date('first-debt') < '2026-12-30').toBe(true);
  });

  it('never dates a milestone after today', async () => {
    const two = await make();
    const paid = await didPayday(db, two, { now: 2000 }); // marked done early: the payday is 2026-10-23
    expect(milestoneDate('last-payment', paid.data, '2026-10-16') <= '2026-10-16').toBe(true);
  });

  it('removes milestones saved on an empty plan by an older version', async () => {
    const two = await make();
    const olds = [
      { id: 'last-payment' as const, updatedAt: 1, reachedOn: '2026-10-20' },
      { id: 'first-debt' as const, updatedAt: 1, reachedOn: '2026-10-20' },
    ];
    for (const m of olds) await db.put('milestones', m);
    const old = { ...two, milestones: [...two.milestones, ...olds] };
    const cleaned = await syncMilestones(db, old, simulatePlan(toPlanInput(old)), '2026-10-21');
    expect(cleaned.milestones.map((m) => m.id)).toEqual(['plan-made']);
    expect((await loadAll(db))!.milestones.map((m) => m.id)).toEqual(['plan-made']); // and from storage
  });

  it('moves an older, too-late date back to the real one', async () => {
    const two = await make();
    const p1 = await didPayday(db, two, { now: 2000 });
    const p2 = await didPayday(db, p1.data, { now: 3000 });
    const p3 = await didPayday(db, p2.data, { now: 4000 });
    const late = { id: 'buffer-full' as const, updatedAt: 1, reachedOn: '2026-12-30' };
    await db.put('milestones', late);
    const withOld = { ...p3.data, milestones: [...p3.data.milestones, late] };
    const fixed = await syncMilestones(db, withOld, simulatePlan(toPlanInput(withOld)), '2026-12-30', 5000);
    expect(fixed.milestones.find((m) => m.id === 'buffer-full')!.reachedOn).toBe('2026-10-23');
  });
});

describe('bug 3: the year shows whenever a date is not in the current year', () => {
  it('shortDate', () => {
    expect(shortDate('2026-10-23', '2026-10-15')).toBe('Fri 23 Oct');
    expect(shortDate('2027-10-08', '2026-10-15')).toBe('Fri 8 Oct 2027'); // the "next Fri 8 Oct" that looked missed
    expect(shortDate('2027-01-02', '2026-12-30')).toBe('Sat 2 Jan 2027'); // across the new year
    expect(shortDate('2026-12-30', '2027-01-02')).toBe('Wed 30 Dec 2026'); // and back
  });

  it('dayMonth', () => {
    expect(dayMonth('2026-11-20', '2026-10-15')).toBe('20 Nov');
    expect(dayMonth('2027-03-05', '2026-10-15')).toBe('5 Mar 2027');
  });
});
