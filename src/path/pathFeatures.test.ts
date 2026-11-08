/** Chapters and Your whole plan: Nadia's numbers from design/path-features/README.md. */
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openAppDB } from '../data/db';
import type { AppData } from '../data/types';
import { simulatePlan } from '../engine';
import { completeSetup, didPayday, extraPayment, type SetupValues } from '../state/actions';
import { arrivalDue, plannedMoney, toPlanInput } from '../state/planInput';
import { addComingLater, confirmArrived, moveComingLater, removeOneOff, restoreOneOff } from '../state/planActions';
import { comingLaterPlan, whatIfSummary } from '../state/whatIf';
import { comingLaterLine } from '../state/comingLater';
import { goneDates } from './goneDates';
import { buildChapters, extraNote } from './chaptersModel';
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

  it('the chapter note says when the extra starts, and "The extra goes here now." once that date has come', () => {
    const day = (iso: string) => `day ${iso}`;
    expect(extraNote('2026-12-04', '2026-11-03', day)).toBe('Your buffer fills first. From day 2026-12-04 the extra goes here.');
    expect(extraNote('2026-12-04', '2026-12-03', day)).toBe('Your buffer fills first. From day 2026-12-04 the extra goes here.');
    expect(extraNote('2026-12-04', '2026-12-04', day)).toBe('The extra goes here now.'); // the day it starts
    expect(extraNote('2026-12-04', '2027-01-10', day)).toBe('The extra goes here now.'); // after it
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

  it('does not move the main debt-free date: it adds one line, and counts only after Yes', async () => {
    const db = await openAppDB('coming-later-line');
    const added = await addComingLater(db, d, { amount: 800, date: '2027-04-09', kind: 'Tax refund' });
    expect(plan(added).debtFreeDate).toBe('2027-07-16'); // the plan date stays
    expect(plan(added).totalInterest).toBe(plan(d).totalInterest);
    expect(comingLaterLine(added)?.text).toBe('With your $800 tax refund: May 2027');
    const none = await addComingLater(db, d, { amount: 100, date: '2027-04-09', kind: null });
    expect(comingLaterLine(none)?.text).toMatch(/^With your \$100 extra money: /);
    const two = await addComingLater(db, added, { amount: 100, date: '2027-05-07', kind: 'Gift' });
    expect(comingLaterLine(two)?.text).toMatch(/^With your \$900 coming later: /);
    expect(comingLaterLine(d)).toBeNull();
    const yes = await confirmArrived(db, added, added.settings.oneOffs[0]!.id);
    expect(plan(yes).debtFreeDate).toBe('2027-05-21'); // counted now
    expect(comingLaterLine(yes)).toBeNull();
  });

  it('move to another payday and remove, each with an undo that restores the same entry', async () => {
    const db = await openAppDB('coming-later-edit');
    const added = await addComingLater(db, d, { amount: 800, date: '2027-04-09', kind: 'Tax refund' });
    const id = added.settings.oneOffs[0]!.id;
    const moved = await moveComingLater(db, added, id, '2027-05-07');
    expect(moved.settings.oneOffs[0]!.date).toBe('2027-05-07');
    expect(comingLaterLine(moved)?.text).toMatch(/^With your \$800 tax refund: [A-Z][a-z]+ 2027$/);
    const back = await moveComingLater(db, moved, id, '2027-04-09');
    expect(back.settings.oneOffs[0]).toEqual(added.settings.oneOffs[0]);
    const entry = back.settings.oneOffs[0]!;
    const gone = await removeOneOff(db, back, id);
    expect(gone.settings.oneOffs).toHaveLength(0);
    expect((await restoreOneOff(db, gone, entry)).settings.oneOffs).toEqual([entry]);
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

describe('the day each debt is gone', () => {
  const id = (data: AppData, name: string) => data.debts.find((x) => x.name === name)!.id;

  it('in the plan: Store Card Fri 1 Jan 2027, Medical Fri 12 Feb 2027, Visa Fri 16 Jul 2027', () => {
    const g = goneDates(d, plan(d));
    expect(g.get(id(d, 'Store Card'))).toBe('2027-01-01');
    expect(g.get(id(d, 'Medical'))).toBe('2027-02-12');
    expect(g.get(id(d, 'Visa'))).toBe('2027-07-16');
  });

  it('a debt already paid has its real date, not the first payday of the plan', async () => {
    const db = await openAppDB('gone-dates');
    const paid = (await extraPayment(db, d, 450, '2026-11-04')).data; // Store Card is paid off on Wed 4 Nov
    expect(paid.debts.find((x) => x.name === 'Store Card')!.status).toBe('paid');
    const g = goneDates(paid, plan(paid));
    expect(g.get(id(paid, 'Store Card'))).toBe('2026-11-04');
    expect(g.get(id(paid, 'Medical'))).toBe('2027-01-15'); // the others still come from the plan
  });

  it('paid through paydays: the date of the payday that did it', async () => {
    const db = await openAppDB('gone-dates-paydays');
    let x = d;
    for (let i = 0; i < 5; i++) x = (await didPayday(db, x, {})).data;
    expect(x.debts.find((y) => y.name === 'Store Card')!.status).toBe('paid');
    expect(goneDates(x, plan(x)).get(id(x, 'Store Card'))).toBe('2027-01-01');
  });
});
