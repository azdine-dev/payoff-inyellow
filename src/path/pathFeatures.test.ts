/** Chapters and Your whole plan: Nadia's numbers from design/path-features/README.md. */
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openAppDB } from '../data/db';
import type { AppData } from '../data/types';
import { simulatePlan } from '../engine';
import { completeSetup, didPayday, type SetupValues } from '../state/actions';
import { arrivalDue, plannedMoney, toPlanInput } from '../state/planInput';
import { addComingLater, confirmArrived } from '../state/planActions';
import { comingLaterPlan, whatIfSummary } from '../state/whatIf';
import { buildChapters } from './chaptersModel';
import { buildWholePlan } from './wholePlanModel';

const nadia: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-06',
  paycheckAmount: null,
  debts: [
    { name: 'Store Card', type: '', balance: 450, apr: 26.99, minMonthly: 30, dueDay: 12, autopay: false, myOrder: null },
    { name: 'Medical', type: '', balance: 600, apr: 0, minMonthly: 50, dueDay: 3, autopay: false, myOrder: null },
    { name: 'Visa', type: '', balance: 2200, apr: 22.99, minMonthly: 66, dueDay: 20, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [{ name: 'Gifts and holidays', perYear: 260, month: 'December' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let d: AppData;
beforeAll(async () => {
  d = await completeSetup(await openAppDB('path-features'), nadia, '2026-11-03');
});

const plan = (x: AppData) => simulatePlan(toPlanInput(x));
const span = (c: { firstDate: string; lastDate: string }) => `${c.firstDate} ${c.lastDate}`;

describe('Chapters', () => {
  it('Store card 5 paydays, Medical 3, Visa 11, in payoff order', () => {
    const m = buildChapters(d, plan(d));
    expect(m.chapters.map((c) => [c.name, c.days.length])).toEqual([['Store Card', 5], ['Medical', 3], ['Visa', 11]]);
    expect(span(m.chapters[0]!)).toBe('2026-11-06 2027-01-01');
    expect(span(m.chapters[1]!)).toBe('2027-01-15 2027-02-12');
    expect(span(m.chapters[2]!)).toBe('2027-02-26 2027-07-16');
    expect(m.debtFreeDate).toBe('2027-07-16');
    expect(m.chapters.map((c) => c.goneDate)).toEqual(['2027-01-01', '2027-02-12', '2027-07-16']);
    expect(m.chapters.map((c) => c.last)).toEqual([false, false, true]);
    expect(m.chapters.map((c) => c.here)).toEqual([true, false, false]);
    expect(m.chapters[0]!.rollsOn).toBe(30);
    expect(m.chapters[0]!.extraFrom).toBe('2026-12-04'); // the buffer fills first
    expect(m.chapters[1]!.extraFrom).toBeNull();
  });

  it('after the first payday is done: one yellow square, the next payday is "here"', async () => {
    const after = (await didPayday(await openAppDB('path-features-2'), d, {})).data;
    const m = buildChapters(after, plan(after));
    expect(m.chapters.map((c) => c.days.length)).toEqual([5, 3, 11]);
    expect(m.chapters[0]!.days.map((x) => x.kind)).toEqual(['paid', 'next', 'ahead', 'ahead', 'ahead']);
    expect(m.chapters[0]!.here).toBe(true);
  });
});

describe('Your whole plan', () => {
  it('matches the board: $3,528 = $3,250 + $278, minimums $1,445, next 30 days $446, by year', () => {
    const w = buildWholePlan(d, plan(d), '2026-11-03');
    expect(Math.round(w.owed)).toBe(3250);
    expect(Math.round(w.interest)).toBe(278);
    expect(Math.round(w.total)).toBe(3528);
    expect(Math.round(w.minimumsInterest!)).toBe(1445);
    expect(Math.round(w.kept!)).toBe(1167);
    expect(w.paydays).toBe(19);
    expect(w.debtCount).toBe(3);
    expect(w.next30.paydays).toBe(2);
    expect([w.next30.debts, w.next30.buffer, w.next30.yearly, w.next30.total].map(Math.round)).toEqual([146, 280, 20, 446]);
    expect(w.byYear.map((y) => [y.year, y.paydays, Math.round(y.total)])).toEqual([[2026, 4, 842], [2027, 15, 3176]]);
  });
});

describe('Money coming later', () => {
  it('$800 on Fri 9 Apr 2027: debt-free Fri 21 May 2027, 4 paydays sooner, $36 less interest', () => {
    const base = plan(d);
    const next = comingLaterPlan(d, 800, '2027-04-09');
    const s = whatIfSummary(base, next);
    expect(base.debtFreeDate).toBe('2027-07-16');
    expect(next.debtFreeDate).toBe('2027-05-21');
    expect(s.paydaysSooner).toBe(4);
    expect(Math.round(s.interestSaved)).toBe(36);
    expect(next.rows.find((x) => x.date === '2027-04-09')?.extraGoesTo).toBe(d.debts.find((x) => x.name === 'Visa')!.id);
  });

  it('on its payday it waits for Yes: not counted before, kept through "I did it" without it, counted after', async () => {
    const db = await openAppDB('coming-later');
    const added = await addComingLater(db, d, { amount: 800, date: '2026-11-06', kind: 'Tax refund' });
    expect(added.settings.oneOffs[0]).toMatchObject({ later: true, arrived: false, kind: 'Tax refund' });
    expect(arrivalDue(added.settings)?.amount).toBe(800);
    expect(plannedMoney(added)).toBe(plannedMoney(d)); // nothing moves until yes
    const yes = await confirmArrived(db, added, added.settings.oneOffs[0]!.id);
    expect(arrivalDue(yes.settings)).toBeNull();
    expect(plannedMoney(yes)).toBe(plannedMoney(d) + 800);
    // paying the payday without answering keeps the money for the next payday
    const paid = (await didPayday(db, added, {})).data;
    expect(paid.settings.oneOffs).toHaveLength(1);
    expect(arrivalDue(paid.settings)?.amount).toBe(800);
    // after yes it is used with the payday
    const used = (await didPayday(db, yes, {})).data;
    expect(used.settings.oneOffs).toHaveLength(0);
  });
});
