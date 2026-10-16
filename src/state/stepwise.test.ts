/**
 * The three rules that keep the step-by-step app equal to one full simulation (CLAUDE.md section 6):
 *  1. paid debts stay in the plan at 0, so their minimum keeps rolling into the extra
 *  2. the payoff order is stored when the plan is made and kept
 *  3. payday dates come from the schedule, never from "last payday + step"
 * Tapping "I did it" on every payday, to the end, must give the same debt-free date and interest
 * as the reference for every fixture without +/- or new charges.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import fixtures from '../../engine/fixtures.json';
import { simulatePlan, ZERO } from '../engine';
import { pyRound } from '../engine/pymath';
import { fromReferenceInput, type RefFixture } from '../engine/referenceAdapter';
import { openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { completeSetup, didPayday, type PaydayDone, type SetupValues } from './actions';
import { addDebt, logCharge } from './debtActions';
import { activeDebts, toPlanInput } from './planInput';

const all = fixtures as unknown as RefFixture[];

function setupFrom(f: RefFixture): SetupValues {
  const p = fromReferenceInput(f.input);
  return {
    currency: { code: 'USD', symbol: '$' },
    frequency: p.frequency,
    nextPayday: p.nextPayday,
    otherPayday: p.otherPayday ?? null,
    paycheckAmount: null,
    debts: p.debts.map((d) => ({ name: d.name, type: '', balance: d.balance, apr: d.apr, minMonthly: d.minMonthly, dueDay: null, autopay: false, myOrder: d.myOrder ?? null })),
    bufferNow: p.bufferNow,
    bufferGoal: p.bufferGoal,
    extraPerPayday: p.extraPerPayday,
    funds: (p.yearlyBills ?? []).map((y, i) => ({ name: `Bill ${i}`, perYear: y.perYear, month: 'Any time' })),
    method: p.method,
    startMode: 'this-payday',
    ifThen: { day: 'payday', time: '20:00' },
  };
}

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`stepwise-${n++}`);
});

async function tapThrough(data: AppData) {
  const steps: PaydayDone['step'][] = [];
  const paidOff: Record<string, string> = {};
  let d = data;
  while (activeDebts(d).length && steps.length < 520) {
    const r = await didPayday(db, d);
    steps.push(r.step);
    for (const id of r.newlyPaid) paidOff[d.debts.find((x) => x.id === id)!.name] = r.step.date;
    d = r.data;
  }
  return { steps, paidOff, data: d };
}

describe('"I did it" on every payday gives the same result as one full simulation', () => {
  const withoutAdjustments = all.filter((f) => !Object.keys(f.input.adj ?? {}).length && !Object.keys(f.input.charges ?? {}).length);

  it('covers the fixtures without +/- or charges', () => expect(withoutAdjustments.length).toBe(5));

  it.each(withoutAdjustments.map((f) => [f.name, f] as const))('%s', async (_name, f) => {
    const data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const { steps, paidOff, data: end } = await tapThrough(data);

    expect(steps.length).toBe(f.expected.paydays_to_debt_free);
    expect(steps[steps.length - 1]!.date).toBe(f.expected.debt_free_date);
    expect(pyRound(steps.reduce((s, x) => s + x.interest, 0), 2)).toBe(f.expected.total_interest);
    expect(paidOff).toEqual(f.expected.paid_off_dates);
    expect(end.debts.every((x) => x.status === 'paid' && x.balance === 0)).toBe(true);
  });

  it('every payday along the way is the same row as the full simulation', async () => {
    const f = all[0]!;
    const data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const full = simulatePlan(toPlanInput(data));
    const { steps } = await tapThrough(data);
    expect(steps.map((s) => [s.date, pyRound(s.totalToSetAside, 2), pyRound(s.debtLeft, 2)])).toEqual(
      full.rows.map((s) => [s.date, pyRound(s.totalToSetAside, 2), pyRound(s.debtLeft, 2)]),
    );
  });
});

describe('rule 1: a paid debt stays in the plan, and its minimum rolls into the extra', () => {
  it('the payday total stays the same and the extra grows by the minimum', async () => {
    const f = all[0]!; // Sara
    let data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const steps: PaydayDone['step'][] = [];
    let paidAt = -1;
    for (let i = 0; i < 30 && paidAt < 0; i++) {
      const r = await didPayday(db, data);
      steps.push(r.step);
      data = r.data;
      if (r.newlyPaid.length) paidAt = i;
    }
    expect(paidAt).toBeGreaterThan(3);
    const store = data.debts.find((d) => d.name === 'Store card')!;
    expect(store.status).toBe('paid');

    // The debt is still in the plan, at 0
    const plan = toPlanInput(data);
    expect(plan.debts.find((d) => d.id === store.id)).toMatchObject({ balance: 0 });

    const before = steps[paidAt - 1]!;
    const first = (await didPayday(db, data)).step;
    expect(first.totalToSetAside).toBeCloseTo(before.totalToSetAside, 6);
    const minimumPerPayday = (store.minMonthly * 12) / 26;
    expect(first.extra - before.extra).toBeGreaterThan(minimumPerPayday - 0.5);
    expect(first.minimums).toBeLessThan(before.minimums - minimumPerPayday + 0.5);
  });

  it('a paid debt is never announced again', async () => {
    const f = all[0]!;
    let data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const announced: string[] = [];
    for (let i = 0; i < 30; i++) {
      const r = await didPayday(db, data);
      announced.push(...r.newlyPaid);
      data = r.data;
    }
    expect(new Set(announced).size).toBe(announced.length);
    expect(announced.length).toBeGreaterThanOrEqual(2);
  });
});

describe('rule 2: the payoff order is stored and kept', () => {
  it('is made at setup, with ids, and does not change as balances change', async () => {
    const f = all[0]!;
    let data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const names = (d: AppData) => d.settings.payoffOrder.map((id) => d.debts.find((x) => x.id === id)!.name);
    expect(names(data)).toEqual(['Store card', 'Medical bill', 'Visa', 'Car loan']);

    // A big charge makes Store card the biggest balance. The order does not jump.
    const store = data.debts.find((d) => d.name === 'Store card')!;
    data = await logCharge(db, data, store.id, 20000, 'one-off', '', '2026-10-16');
    expect(names(data)).toEqual(['Store card', 'Medical bill', 'Visa', 'Car loan']);
    expect(simulatePlan(toPlanInput(data)).order[0]).toBe(store.id);

    const r = await didPayday(db, data);
    expect(names(r.data)).toEqual(['Store card', 'Medical bill', 'Visa', 'Car loan']);
  });

  it('is made again when a debt is added', async () => {
    const f = all[0]!;
    let data = await completeSetup(db, setupFrom(f), '2026-10-15');
    data = await addDebt(db, data, { name: 'Tiny', type: '', balance: 50, apr: 10, minMonthly: 25, dueDay: null, autopay: false });
    expect(data.settings.payoffOrder.map((id) => data.debts.find((x) => x.id === id)!.name)).toEqual(['Tiny', 'Store card', 'Medical bill', 'Visa', 'Car loan']); // smallest balance first
  });
});

describe('rule 3: payday dates come from the schedule', () => {
  it('twice a month keeps its two pay days all the way through', async () => {
    const f = all.find((x) => x.name === 'twice_a_month_debt_that_grows')!;
    let data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const dates: string[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await didPayday(db, data);
      dates.push(r.step.date);
      data = r.data;
    }
    expect(dates).toEqual(['2026-10-31', '2026-11-15', '2026-11-30', '2026-12-15', '2026-12-31', '2027-01-15', '2027-01-31', '2027-02-15']);
    expect(data.settings).toMatchObject({ otherPayday: 15, paydayIndex: 8 });
  });
});

describe('a zero balance is zero', () => {
  it('nothing left means no active debts', async () => {
    const f = all[4]!;
    const data = await completeSetup(db, setupFrom(f), '2026-10-15');
    const { data: end } = await tapThrough(data);
    expect(end.debts.reduce((s, d) => s + d.balance, 0)).toBeLessThanOrEqual(ZERO);
  });
});
