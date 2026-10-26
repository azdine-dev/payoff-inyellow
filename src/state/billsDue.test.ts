import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { billsBetween, billsForNextPayday, billsForPlanRow, dueDateIn, totalOf, type BillDebt } from './billsDue';
import { toPlanInput } from './planInput';

/** What the engine pays each debt on this payday: its full minimum, never more than the balance */
const paidOf = (debts: BillDebt[]) => new Map(debts.map((d) => [d.id, Math.min(d.minMonthly, d.balance)]));

const debt = (name: string, dueDay: number | null, minMonthly: number, balance = 1000, apr = 0, autopay = false): BillDebt => ({
  id: name,
  name,
  balance,
  apr,
  minMonthly,
  dueDay,
  autopay,
});

describe('dueDateIn: the date in [from, to) a bill is due', () => {
  it('finds it in the window, on the payday itself, and never on the next payday', () => {
    expect(dueDateIn(28, '2026-10-23', '2026-11-06')).toBe('2026-10-28');
    expect(dueDateIn(23, '2026-10-23', '2026-11-06')).toBe('2026-10-23'); // this payday counts
    expect(dueDateIn(6, '2026-10-23', '2026-11-06')).toBeNull(); // the next payday belongs to the next window
    expect(dueDateIn(22, '2026-10-23', '2026-11-06')).toBeNull();
  });

  it('works across a month end and a year end', () => {
    expect(dueDateIn(2, '2026-10-23', '2026-11-06')).toBe('2026-11-02');
    expect(dueDateIn(3, '2026-12-25', '2027-01-08')).toBe('2027-01-03');
    expect(dueDateIn(31, '2026-10-23', '2026-11-06')).toBe('2026-10-31');
  });

  it('a due day past the end of a short month is the last day', () => {
    expect(dueDateIn(31, '2027-02-20', '2027-03-06')).toBe('2027-02-28');
    expect(dueDateIn(30, '2028-02-20', '2028-03-06')).toBe('2028-02-29');
  });

  it('a monthly payday window holds each due day once', () => {
    for (let day = 1; day <= 31; day++) expect(dueDateIn(day, '2026-11-01', '2026-12-01')).not.toBeNull();
    expect(dueDateIn(1, '2026-11-01', '2026-12-01')).toBe('2026-11-01');
  });
});

describe('billsBetween', () => {
  it('lists the debts due in the window, each with its full monthly minimum, in date order', () => {
    const w = billsBetween([debt('Car loan', 28, 285), debt('Visa', 12, 96), debt('Phone', 25, 40)], '2026-10-23', '2026-11-06', paidOf([debt('Car loan', 28, 285), debt('Visa', 12, 96), debt('Phone', 25, 40)]));
    expect(w.due.map((b) => [b.name, b.amount, b.due])).toEqual([
      ['Phone', 40, '2026-10-25'],
      ['Car loan', 285, '2026-10-28'],
    ]);
    expect(w.total).toBe(325);
    expect(w.noDueDay).toEqual([]);
  });

  it('shows a debt with no due day, but does not count it', () => {
    const w = billsBetween([debt('Visa', null, 96), debt('Car loan', 28, 285)], '2026-10-23', '2026-11-06', paidOf([debt('Visa', null, 96), debt('Car loan', 28, 285)]));
    expect(w.noDueDay).toEqual([{ debtId: 'Visa', name: 'Visa', amount: 96 }]);
    expect(w.total).toBe(285);
  });

  it('leaves out paid debts and debts with no minimum', () => {
    const w = billsBetween([debt('Paid', 25, 50, 0), debt('Mom', 25, 0), debt('Mom no day', null, 0), debt('Real', 26, 30)], '2026-10-23', '2026-11-06', paidOf([debt('Paid', 25, 50, 0), debt('Mom', 25, 0), debt('Mom no day', null, 0), debt('Real', 26, 30)]));
    expect(w.due.map((b) => b.name)).toEqual(['Real']);
    expect(w.noDueDay).toEqual([]);
  });

  it('lists what the engine pays, which is less than the minimum when the debt is nearly paid', () => {
    const nearly = debt('Store card', 5, 35, 13.22, 26.99);
    const w = billsBetween([nearly], '2026-10-23', '2026-11-06', new Map([['Store card', 13.28]]));
    expect(w.due.map((b) => [b.name, b.amount])).toEqual([['Store card', 13.28]]);
  });

  it('keeps the order entered for debts due on the same day, and marks autopay', () => {
    const w = billsBetween([debt('B', 25, 10, 100, 0, true), debt('A', 25, 20)], '2026-10-23', '2026-11-06', paidOf([debt('B', 25, 10, 100, 0, true), debt('A', 25, 20)]));
    expect(w.due.map((b) => [b.name, b.autopay])).toEqual([['B', true], ['A', false]]);
  });

  it('an empty window is fine', () => {
    expect(billsBetween([debt('Visa', 12, 96)], '2026-10-23', '2026-11-06', paidOf([debt('Visa', 12, 96)]))).toEqual({ due: [], noDueDay: [], total: 0 });
  });
});

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: true, myOrder: null },
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null },
    { name: 'Car loan', type: '', balance: 9800, apr: 7.5, minMonthly: 285, dueDay: 20, autopay: false, myOrder: null },
    { name: 'Medical bill', type: '', balance: 1150, apr: 0, minMonthly: 50, dueDay: 1, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [{ name: 'Car repairs', perYear: 600, month: 'Any time' }, { name: 'Gifts', perYear: 500, month: 'December' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let data: AppData;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`bills-${n++}`);
  data = await completeSetup(db, setup, '2026-10-15');
});

describe('for the next payday', () => {
  it('is the bills due from this payday up to the next (Sara, Fri 23 Oct)', () => {
    const w = billsForNextPayday(data);
    expect(w.due.map((b) => [b.name, b.amount, b.due])).toEqual([
      ['Medical bill', 50, '2026-11-01'],
      ['Store card', 35, '2026-11-05'],
    ]);
    expect(w.total).toBe(85);
  });

  it('the total is the bills + yearly bills + buffer + extra, and not the per-payday average', () => {
    const plan = simulatePlan(toPlanInput(data));
    const first = plan.rows[0]!;
    expect(first.minimums).toBeCloseTo(85, 2); // what the engine pays: the same two bills the buyer sees (Medical 50, Store card 35)
    expect(totalOf(billsForNextPayday(data), first)).toBe(235); // 85 + 42.31 + 107.69
    expect(first.totalToSetAside).toBeCloseTo(235, 2); // and the engine's total is that same amount
  });

  it('a payday with a big bill, and a payday with none', () => {
    const plan = simulatePlan(toPlanInput(data));
    // 20 Nov: Car loan (20 Nov) and Medical bill (1 Dec) fall before 4 Dec
    const w3 = billsForPlanRow(data, plan, 2);
    expect(w3.due.map((b) => [b.name, b.amount])).toEqual([['Car loan', 285], ['Medical bill', 50]]);
    // 6 Nov window [6 Nov, 20 Nov): Visa 12 Nov
    expect(billsForPlanRow(data, plan, 1).due.map((b) => [b.name, b.amount])).toEqual([['Visa', 96]]);
  });

  it('a bill is never in two windows at once, and a long debt is due every month', () => {
    const plan = simulatePlan(toPlanInput(data));
    const counts = new Map<string, number>();
    const dates = new Map<string, Set<string>>();
    for (let i = 0; i < 26; i++) {
      const w = billsForPlanRow(data, plan, i);
      expect(new Set(w.due.map((b) => b.debtId)).size).toBe(w.due.length); // once per window
      for (const b of w.due) {
        counts.set(b.name, (counts.get(b.name) ?? 0) + 1);
        const set = dates.get(b.name) ?? new Set();
        expect(set.has(b.due)).toBe(false); // the same due date is never counted twice
        set.add(b.due);
        dates.set(b.name, set);
      }
    }
    // Visa and Car loan last longer than a year: due 12 or 13 times in 26 paydays
    for (const name of ['Visa', 'Car loan']) {
      expect(counts.get(name)).toBeGreaterThanOrEqual(12);
      expect(counts.get(name)).toBeLessThanOrEqual(13);
    }
    // Store card is paid off early, so its bills stop
    expect(counts.get('Store card')).toBeLessThan(8);
  });

  it('a paid debt drops out of the later windows', async () => {
    const store = data.debts.find((d) => d.name === 'Store card')!;
    const paid: AppData = { ...data, debts: data.debts.map((d) => (d.id === store.id ? { ...d, balance: 0, status: 'paid' } : d)) };
    expect(billsForNextPayday(paid).due.map((b) => b.name)).toEqual(['Medical bill']);
  });

  it('"I did it" logs the same total the buyer saw, and the bills', async () => {
    const seen = totalOf(billsForNextPayday(data), simulatePlan(toPlanInput(data)).rows[0]!);
    const r = await didPayday(db, data);
    expect(r.data.paydays[0]!.total).toBe(seen);
    expect(r.data.paydays[0]!.bills?.map((b) => [b.name, b.amount, b.due])).toEqual([
      ['Medical bill', 50, '2026-11-01'],
      ['Store card', 35, '2026-11-05'],
    ]);
    // What is applied to the balances is the engine's step: the two bills shown, the extra and the interest. Visa and
    // the Car loan have no bill this payday, so they only grow by interest.
    expect(r.step.debtLeft).toBeCloseTo(14768.1, 2);
    const visa = r.data.debts.find((d) => d.name === 'Visa')!;
    expect(visa.balance).toBeGreaterThan(3200);
  });
});

