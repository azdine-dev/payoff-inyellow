import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { completeSetup, didPayday, extraPayment, missedPaydays, skipPaydays, startIndex, type SetupValues } from './actions';
import { nextPaydayISO, toPlanInput } from './planInput';

/** Same numbers as engine/fixtures.json "sample_every_2_weeks" */
const sample: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: 1400,
  debts: [
    { name: 'Visa', type: 'Credit card', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: true, myOrder: null },
    { name: 'Store card', type: 'Store card', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null },
    { name: 'Car loan', type: 'Car loan', balance: 9800, apr: 7.5, minMonthly: 285, dueDay: 20, autopay: false, myOrder: null },
    { name: 'Medical bill', type: 'Medical', balance: 1150, apr: 0, minMonthly: 50, dueDay: 1, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [
    { name: 'Car repairs', perYear: 600, month: 'Any time' },
    { name: 'Gifts and holidays', perYear: 500, month: 'December' },
  ],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`test-${n++}`);
});

/** Records of one payday share a date, so compare payments without depending on their order. */
const norm = (data: AppData | null) =>
  data && { ...data, payments: [...data.payments].sort((a, b) => a.id.localeCompare(b.id)) };

const names = (data: AppData) => Object.fromEntries(data.debts.map((d) => [d.name, d]));

describe('setup', () => {
  it('saves everything and loads it back', async () => {
    const data = await completeSetup(db, sample, '2026-10-15', 1000);
    expect(await loadAll(db)).toEqual(data);
    expect(data.debts.map((d) => d.name)).toEqual(['Visa', 'Store card', 'Car loan', 'Medical bill']);
    expect(data.debts.every((d) => d.startBalance === d.balance && d.id && d.updatedAt === 1000)).toBe(true);
  });

  it('gives the same plan as the Sheet fixture', async () => {
    const data = await completeSetup(db, sample, '2026-10-15');
    const r = simulatePlan(toPlanInput(data));
    expect(r.debtFreeDate).toBe('2028-10-06');
    expect(r.paydaysToDebtFree).toBe(52);
  });

  it('"1st of next month" skips the paydays before it', () => {
    expect(startIndex({ ...sample, startMode: 'next-month' }, '2026-10-15')).toBe(1); // first payday on/after Nov 1 = Nov 6
    expect(startIndex(sample, '2026-10-15')).toBe(0);
  });
});

describe('I did it', () => {
  it('applies the same step as the plan, and the plan does not drift', async () => {
    const data = await completeSetup(db, sample, '2026-10-15');
    const before = simulatePlan(toPlanInput(data));
    const { data: after, step } = await didPayday(db, data);

    expect(step.date).toBe('2026-10-23');
    expect(step.totalToSetAside).toBe(before.rows[0]!.totalToSetAside);
    expect(step.debtLeft).toBe(before.rows[0]!.debtLeft);
    expect(nextPaydayISO(after.settings)).toBe('2026-11-06');
    expect(after.buffer.amount).toBeCloseTo(307.69, 2);
    expect(after.funds.reduce((s, f) => s + f.saved, 0)).toBeCloseTo(42.31, 2);

    const next = simulatePlan(toPlanInput(after));
    expect(next.debtFreeDate).toBe(before.debtFreeDate);
    expect(next.rows.map((r) => [r.date, r.debtLeft, r.totalToSetAside])).toEqual(
      before.rows.slice(1).map((r) => [r.date, r.debtLeft, r.totalToSetAside]),
    );
    expect(norm(await loadAll(db))).toEqual(norm(after));
  });

  it('logs payments and the payday', async () => {
    const data = await completeSetup(db, sample, '2026-10-15');
    const { data: after, step } = await didPayday(db, data);
    expect(after.paydays).toMatchObject([{ number: 1, date: '2026-10-23', status: 'done', planMoney: 150 }]);
    const total = after.payments.reduce((s, p) => s + p.amount, 0);
    expect(total).toBeCloseTo(step.totalToSetAside, 9);
    expect(new Set(after.payments.map((p) => p.kind))).toEqual(new Set(['minimum', 'buffer', 'fund']));
  });

  it('uses a different amount for this payday only', async () => {
    const data = await completeSetup(db, { ...sample, bufferNow: 500 }, '2026-10-15');
    const { step, data: after } = await didPayday(db, data, { planMoney: 400 });
    expect(step.extra).toBeCloseTo(400 - 1100 / 26, 9);
    expect(step.extraGoesTo).toBe(names(data)['Store card']!.id);
    expect(after.settings.extraPerPayday).toBe(150);
  });

  it('marks a debt paid when it reaches zero', async () => {
    let data = await completeSetup(db, { ...sample, bufferNow: 500 }, '2026-10-15');
    const paidIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await didPayday(db, data);
      data = r.data;
      paidIds.push(...r.newlyPaid);
    }
    const store = names(data)['Store card']!;
    expect(paidIds).toContain(store.id);
    expect(store.status).toBe('paid');
    expect(store.balance).toBe(0);
  });
});

describe('missed and skipped paydays', () => {
  it('counts paydays before today that were not done', async () => {
    const data = await completeSetup(db, sample, '2026-10-15');
    expect(missedPaydays(data, '2026-10-23')).toBe(0);
    expect(missedPaydays(data, '2026-10-24')).toBe(1);
    expect(missedPaydays(data, '2026-11-07')).toBe(2);
  });

  it('skipping moves the date and applies nothing', async () => {
    const data = await completeSetup(db, sample, '2026-10-15');
    const after = await skipPaydays(db, data, 2);
    expect(nextPaydayISO(after.settings)).toBe('2026-11-20');
    expect(after.debts.map((d) => d.balance)).toEqual(data.debts.map((d) => d.balance));
    expect(after.paydays.map((p) => p.status)).toEqual(['skipped', 'skipped']);
    expect(norm(await loadAll(db))).toEqual(norm(after));
  });
});

describe('+ Extra payment', () => {
  it('goes to the focus debt, overflow to the next', async () => {
    const data = await completeSetup(db, sample, '2026-10-15');
    const { data: after, newlyPaid } = await extraPayment(db, data, 700, '2026-10-16');
    const by = names(after);
    expect(by['Store card']!.balance).toBe(0);
    expect(by['Store card']!.status).toBe('paid');
    expect(by['Medical bill']!.balance).toBe(1090); // PaidInYellow order: Store card, then Medical bill
    expect(newlyPaid).toEqual([by['Store card']!.id]);
    expect(after.payments.every((p) => p.planned === false)).toBe(true);
  });
});
