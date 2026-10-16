import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { compareMethods, simulatePlan } from '../engine';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { chartData, minimumsOnlySeries } from '../lib/series';
import { planToCsv } from '../lib/csv';
import { completeSetup, didPayday, extraPayment, type SetupValues } from './actions';
import { updateBalance } from './debtActions';
import { progressStats, projectedDate, reachedKeys, syncMilestones } from './milestones';
import { applyWhatIf, removeOneOff, setMethod } from './planActions';
import { plannedMoney, toPlanInput } from './planInput';
import { comparisonLine, whatIfPlan, whatIfSummary } from './whatIf';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: null, autopay: false, myOrder: null },
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: null, autopay: false, myOrder: null },
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
  db = await openAppDB(`progress-${n++}`);
  data = await completeSetup(db, setup, '2026-10-15');
});

describe('minimums-only series', () => {
  it('matches the engine model: a 24% card at $240 a month ends in 56 months', () => {
    const s = minimumsOnlySeries([{ balance: 8000, apr: 24, minMonthly: 240 }], 60);
    expect(s[0]).toBe(8000);
    expect(s[55]).toBeGreaterThan(0);
    expect(s[56]).toBe(0);
  });

  it('grows when the minimum does not cover the interest', () => {
    const s = minimumsOnlySeries([{ balance: 5000, apr: 30, minMonthly: 100 }], 12);
    expect(s[12]).toBeGreaterThan(s[0]!);
  });

  it('chart data starts at what is owed and ends where the plan ends', () => {
    const r = simulatePlan(toPlanInput(data));
    const c = chartData('2026-10-15', data.debts, r, 3840);
    expect(c.plan[0]).toEqual({ x: 0, y: 3840 });
    expect(c.plan[c.plan.length - 1]!.y).toBeLessThanOrEqual(0.005);
    expect(c.minimums.length).toBeGreaterThan(2);
    expect(c.xMax).toBeGreaterThanOrEqual(c.plan[c.plan.length - 1]!.x);
  });
});

describe('progress and milestones', () => {
  it('starts at zero with only "plan made" reached', () => {
    expect(progressStats(data)).toMatchObject({ start: 3840, owed: 3840, paid: 0, pct: 0 });
    expect([...reachedKeys(data, simulatePlan(toPlanInput(data)))]).toEqual(['plan-made']);
  });

  it('reaches first extra, first debt and 10% once money is paid, and keeps them', async () => {
    const paid = await extraPayment(db, data, 700, '2026-10-16');
    const r = simulatePlan(toPlanInput(paid.data));
    const keys = reachedKeys(paid.data, r);
    expect(keys).toContain('first-extra');
    expect(keys).toContain('first-debt');
    expect(keys).toContain('pct-10');
    expect(keys).not.toContain('pct-25');

    const synced = await syncMilestones(db, paid.data, r, '2026-10-16');
    // $700 early also moves the date by more than a month
    expect(synced.milestones.map((m) => m.id).sort()).toEqual(['first-debt', 'first-extra', 'month-ahead', 'pct-10', 'plan-made']);
    // A charge later does not un-reach anything
    const worse = await updateBalance(db, synced, synced.debts[0]!.id, 9000);
    const again = await syncMilestones(db, worse, simulatePlan(toPlanInput(worse)), '2026-10-20');
    expect(again.milestones.map((m) => m.id)).toEqual(synced.milestones.map((m) => m.id));
    expect((await loadAll(db))!.milestones).toHaveLength(5);
  });

  it('knows when the next milestones are expected', () => {
    const r = simulatePlan(toPlanInput(data));
    expect(projectedDate('first-debt', data, r)).toBe(r.paidOff[data.debts[1]!.id]);
    expect(projectedDate('pct-25', data, r)! > '2026-10-23').toBe(true);
    expect(projectedDate('last-payment', data, r)).toBe(r.debtFreeDate);
  });

  it('"one month ahead" appears when extra money moves the date a month', async () => {
    const d = await applyWhatIf(db, data, 200, null);
    const r = simulatePlan(toPlanInput(d));
    expect(reachedKeys(d, r)).toContain('month-ahead');
  });

  it('logs planned vs actual when a payday is done', async () => {
    const done = await didPayday(db, data, { planMoney: 90 });
    expect(done.data.paydays[0]!.plannedTotal).toBeCloseTo(60.46 + 150, 1);
    expect(done.data.paydays[0]!.total).toBeCloseTo(60.46 + 90, 1);
  });
});

describe('plan tab', () => {
  it('what-if: more money each payday saves months and interest', () => {
    const base = simulatePlan(toPlanInput(data));
    const s = whatIfSummary(base, whatIfPlan(data, 100, null));
    expect(s.monthsSaved).toBeGreaterThan(0);
    expect(s.interestSaved).toBeGreaterThan(0);
  });

  it('what-if: one-off money on a date goes into the payday on or after it', () => {
    const base = simulatePlan(toPlanInput(data));
    const s = whatIfSummary(base, whatIfPlan(data, 0, { amount: 1500, date: '2026-12-01' }));
    expect(s.interestSaved).toBeGreaterThan(0);
    expect(s.newDate! < base.debtFreeDate!).toBe(true);
  });

  it('no change means no change', () => {
    const base = simulatePlan(toPlanInput(data));
    const s = whatIfSummary(base, whatIfPlan(data, 0, null));
    expect(s).toMatchObject({ monthsSaved: 0, interestSaved: 0, newDate: base.debtFreeDate });
  });

  it('"Use this in my plan" changes the usual money and keeps the one-off', async () => {
    const d = await applyWhatIf(db, data, 50, { amount: 800, date: '2026-11-20', note: 'Tax refund' });
    expect(d.settings.extraPerPayday).toBe(200);
    expect(d.settings.oneOffs).toMatchObject([{ amount: 800, date: '2026-11-20', note: 'Tax refund' }]);
    expect(plannedMoney(d)).toBe(200); // the refund lands on payday 3
    const gone = await removeOneOff(db, d, d.settings.oneOffs[0]!.id);
    expect(gone.settings.oneOffs).toEqual([]);
    expect(await loadAll(db)).toMatchObject({ settings: { extraPerPayday: 200, oneOffs: [] } });
  });

  it('switching to "My own order" keeps the current order', async () => {
    const d = await setMethod(db, data, 'my-order');
    expect(d.settings.method).toBe('my-order');
    expect(d.debts.map((x) => x.myOrder)).toEqual([1, 2]);
    const back = await setMethod(db, d, 'paidinyellow');
    expect(back.settings.method).toBe('paidinyellow');
  });

  it('writes the comparison in dollars', () => {
    const { method: _m, ...rest } = toPlanInput(data);
    const line = comparisonLine(compareMethods(rest), data.settings.currency);
    expect(line).toMatch(/\$|costs the same/);
  });

  it('exports the plan as CSV with quoted names', () => {
    const r = simulatePlan(toPlanInput(data));
    const csv = planToCsv(r.rows.slice(0, 2), (id) => (id === data.debts[1]!.id ? 'Store, "main"' : 'Visa'));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Payday,Date,Minimums,Yearly bills,Buffer,Extra,Extra goes to,Total to set aside,Debt left');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^1,2026-10-23,60\.46,0\.00,/);
    expect(csv).toContain('"Store, ""main"""');
  });
});
