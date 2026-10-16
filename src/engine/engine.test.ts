/** Engine behaviour the Python reference can't cover (or crashes on). */
import { describe, expect, it } from 'vitest';
import {
  compareMethods,
  dailyInterestCost,
  growingDebts,
  minimumsPerPayday,
  planNeedsHelp,
  preparePlan,
  simulatePlan,
  stepPayday,
  type DebtInput,
  type PlanInput,
} from './engine';
import { pyRound } from './pymath';

const visa: DebtInput = { id: 'visa', name: 'Visa', balance: 3200, apr: 22.9, minMonthly: 96 };
const store: DebtInput = { id: 'store', name: 'Store card', balance: 640, apr: 26.99, minMonthly: 35 };

const base: PlanInput = {
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  extraPerPayday: 150,
  bufferNow: 200,
  bufferGoal: 500,
  method: 'paidinyellow',
  debts: [visa, store],
  yearlyBills: [{ perYear: 600 }, { perYear: 500 }],
};

describe('simulatePlan', () => {
  it('handles zero debts (the reference crashes here)', () => {
    const r = simulatePlan({ ...base, debts: [] });
    expect(r.rows).toEqual([]);
    expect(r.debtFreeDate).toBeNull();
    expect(r.minimumsOnly).toMatchObject({ neverEnds: false, months: 0, totalInterest: 0 });
  });

  it('keys paid-off dates by id, so two debts can share a name', () => {
    const r = simulatePlan({
      ...base,
      debts: [
        { ...store, id: 'a', name: 'Card' },
        { ...visa, id: 'b', name: 'Card' },
      ],
    });
    expect(Object.keys(r.paidOff).sort()).toEqual(['a', 'b']);
  });

  it('ends with every balance at zero', () => {
    const r = simulatePlan(base);
    const last = r.rows[r.rows.length - 1]!;
    expect(r.debtFreeDate).toBe(last.date);
    for (const d of last.debts) expect(d.balanceAfter).toBeLessThanOrEqual(0.005);
  });

  it('stops at 520 paydays when the plan never ends', () => {
    const r = simulatePlan({
      ...base,
      extraPerPayday: 0,
      debts: [{ id: 'x', name: 'Card', balance: 20000, apr: 29.99, minMonthly: 200 }],
    });
    expect(r.rows.length).toBe(520);
    expect(r.debtFreeDate).toBeNull();
    expect(r.minimumsOnly.neverEnds).toBe(true);
  });

  it('never sends money anywhere but bills, buffer and debts', () => {
    for (const row of simulatePlan(base).rows) {
      const parts = row.minimums + row.toBuffer + row.toYearlyBills + row.extra;
      expect(row.totalToSetAside).toBeCloseTo(parts, 9);
      expect(row.toBuffer).toBeGreaterThanOrEqual(0);
      expect(row.extra).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('paydayOffset', () => {
  it('keeps twice-a-month dates alternating after paydays are done', () => {
    const input: PlanInput = { ...base, frequency: 'twice-monthly', nextPayday: '2026-11-01' };
    const full = simulatePlan(input);
    const later = simulatePlan({ ...input, paydayOffset: 3 });
    expect(later.rows.slice(0, 3).map((r) => r.date)).toEqual(full.rows.slice(3, 6).map((r) => r.date));
    expect(later.rows[0]!.date).toBe('2026-12-16');
    expect(later.rows[1]!.date).toBe('2027-01-01');
  });
});

describe('stepPayday', () => {
  it('gives the same row as the simulation (used by "I did it")', () => {
    const r = simulatePlan(base);
    const plan = preparePlan(base);
    let balances = r.order.map((id) => base.debts.find((d) => d.id === id)!.balance);
    let buffer = base.bufferNow;
    for (const row of r.rows.slice(0, 12)) {
      const step = stepPayday(plan, { balances, buffer, bufferGoal: base.bufferGoal }, base.extraPerPayday, 0, row.payday, row.date);
      expect(step).toEqual(row);
      balances = step.debts.map((d) => d.balanceAfter);
      buffer = step.bufferAfter;
    }
  });

  it('puts a different paycheck amount through the same order', () => {
    const plan = preparePlan(base);
    const state = { balances: [640, 3200], buffer: 500, bufferGoal: 500 };
    const normal = stepPayday(plan, state, 150);
    const more = stepPayday(plan, state, 250);
    expect(more.extra - normal.extra).toBeCloseTo(100, 9);
    expect(more.extraGoesTo).toBe('store');
  });
});

describe('compareMethods', () => {
  it('recommends PaidInYellow order when the difference is small', () => {
    const c = compareMethods(base);
    expect(c.interestSaved).toBeLessThanOrEqual(500);
    expect(c.interestSaved).toBeLessThanOrEqual(0.1 * c.paidinyellow.totalInterest);
    expect(c.suggestBiggestInterest).toBe(false);
  });

  it('suggests Biggest interest first when it saves more than $500', () => {
    const c = compareMethods({
      ...base,
      extraPerPayday: 300,
      bufferNow: 500,
      yearlyBills: [],
      debts: [
        { id: 'small', name: 'Low rate', balance: 9000, apr: 3, minMonthly: 120 },
        { id: 'big', name: 'High rate', balance: 15000, apr: 29.99, minMonthly: 400 },
      ],
    });
    expect(c.interestSaved).toBeGreaterThan(500);
    expect(c.suggestBiggestInterest).toBe(true);
  });
});

describe('screen helpers', () => {
  it('daily interest cost: sum(balance x APR) / 365', () => {
    expect(pyRound(dailyInterestCost([visa, store]), 2)).toBe(pyRound((3200 * 0.229 + 640 * 0.2699) / 365, 2));
    expect(dailyInterestCost([])).toBe(0);
  });

  it('minimums per payday: monthly x 12 / ppy, skipping paid debts', () => {
    expect(minimumsPerPayday([visa, store], 'biweekly')).toBeCloseTo((131 * 12) / 26, 9);
    expect(minimumsPerPayday([{ ...visa, balance: 0 }, store], 'monthly')).toBe(35);
  });

  it('flags debts that grow, but not a 0% debt with no minimum', () => {
    const debts: DebtInput[] = [
      { id: 'old', name: 'Old card', balance: 5000, apr: 29.99, minMonthly: 100 },
      { id: 'mom', name: 'Mom', balance: 600, apr: 0, minMonthly: 0 },
      visa,
    ];
    expect(growingDebts(debts)).toEqual(['old']);
  });

  it('plan needs help when minimums are over the paycheck or it never ends', () => {
    const r = simulatePlan(base);
    expect(planNeedsHelp(base, r, 2000)).toEqual([]);
    expect(planNeedsHelp(base, r, 50)).toEqual(['minimums-over-paycheck']);
    const stuck: PlanInput = {
      ...base,
      extraPerPayday: 0,
      debts: [{ id: 'x', name: 'Card', balance: 20000, apr: 29.99, minMonthly: 200 }],
    };
    expect(planNeedsHelp(stuck, simulatePlan(stuck))).toEqual(['no-end-in-20-years']);
  });
});
