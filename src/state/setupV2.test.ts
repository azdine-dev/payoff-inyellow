/** ux-v2.md section 2: what the shorter setup relies on in the data. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import { laterStatus } from '../setup/LaterSheets';
import { completeSetup, didPayday, setStartMode, type SetupValues } from './actions';
import { DEFAULT_RATE, editDebt } from './debtActions';
import { toPlanInput } from './planInput';
import { markLater, setIfThen, markBackedUp } from './settingsActions';

const sample: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null },
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null },
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
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`v2-${n++}`);
});

describe('start on the 1st of next month, chosen on the result screen', () => {
  it('moves the first payday and comes back', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    expect(start.settings.paydayIndex).toBe(0);
    const later = await setStartMode(db, start, 'next-month', '2026-10-15', 2000);
    expect(later.settings).toMatchObject({ startMode: 'next-month', paydayIndex: 1 }); // 23 Oct is before Nov 1, so the first payday is 6 Nov
    expect(simulatePlan(toPlanInput(later)).rows[0]!.date).toBe('2026-11-06');
    expect((await loadAll(db))!.settings.paydayIndex).toBe(1); // saved
    const back = await setStartMode(db, later, 'this-payday', '2026-10-15', 3000);
    expect(back.settings).toMatchObject({ startMode: 'this-payday', paydayIndex: 0 });
    expect(simulatePlan(toPlanInput(back)).rows[0]!.date).toBe('2026-10-23');
  });

  it('is not possible once a payday is done', async () => {
    const start = await completeSetup(db, sample, '2026-10-15', 1000);
    const done = await didPayday(db, start, { now: 2000 });
    const same = await setStartMode(db, done.data, 'next-month', '2026-10-15', 3000);
    expect(same).toBe(done.data);
  });
});

describe('a rate left empty', () => {
  const missing: SetupValues = { ...sample, debts: [{ ...sample.debts[0]!, apr: DEFAULT_RATE, rateMissing: true }, sample.debts[1]!] };

  it('is saved as 24% with the debt marked, and plans exactly like a typed 24%', async () => {
    const data = await completeSetup(db, missing, '2026-10-15', 1000);
    expect(data.debts[0]).toMatchObject({ apr: 24, rateMissing: true });
    const typed = await completeSetup(db, { ...missing, debts: [{ ...sample.debts[0]!, apr: 24 }, sample.debts[1]!] }, '2026-10-15', 1000);
    const a = simulatePlan(toPlanInput(data));
    const b = simulatePlan(toPlanInput(typed));
    expect(a.debtFreeDate).toBe(b.debtFreeDate);
    expect(a.totalInterest).toBeCloseTo(b.totalInterest, 6);
  });

  it('adding the real rate clears the mark and changes the plan', async () => {
    const data = await completeSetup(db, missing, '2026-10-15', 1000);
    const visa = data.debts[0]!;
    const fixed = await editDebt(db, data, visa.id, { name: 'Visa', type: '', balance: 3200, apr: 17, rateMissing: false, minMonthly: 96, dueDay: 12, autopay: false }, 2000);
    expect(fixed.debts[0]).toMatchObject({ apr: 17, rateMissing: false });
    expect(simulatePlan(toPlanInput(fixed)).totalInterest).toBeLessThan(simulatePlan(toPlanInput(data)).totalInterest);
  });

  it('other edits keep the mark (it is only cleared by a rate)', async () => {
    const data = await completeSetup(db, missing, '2026-10-15', 1000);
    const visa = data.debts[0]!;
    const edited = await editDebt(db, data, visa.id, { name: 'Visa', type: '', balance: 3000, apr: 24, minMonthly: 96, dueDay: 12, autopay: false }, 2000);
    expect(edited.debts[0]!.rateMissing).toBe(true);
  });
});

describe('"Do these later"', () => {
  it('starts with all three to do', async () => {
    const data = await completeSetup(db, sample, '2026-10-15', 1000);
    expect(laterStatus(data)).toEqual({ yearly: false, reminder: false, backup: false });
  });

  it('each is done by doing it, or by saying it is not needed', async () => {
    let data = await completeSetup(db, sample, '2026-10-15', 1000);
    data = await markLater(db, data, 'yearly', 2000); // "I have no yearly bills"
    expect(laterStatus(data).yearly).toBe(true);
    data = await setIfThen(db, data, 'Friday', '19:00', 3000);
    expect(laterStatus(data).reminder).toBe(false); // changing it in Settings is not the same as choosing it here
    data = await markLater(db, data, 'reminder', 4000);
    expect(laterStatus(data).reminder).toBe(true);
    data = await markBackedUp(db, data, 5000);
    expect(laterStatus(data)).toEqual({ yearly: true, reminder: true, backup: true });
    expect((await loadAll(db))!.settings.later).toEqual({ yearly: true, reminder: true });
  });

  it('a yearly bill counts as done without the flag', async () => {
    const data = await completeSetup(db, { ...sample, funds: [{ name: 'Car repairs', perYear: 600, month: 'Any time' }] }, '2026-10-15', 1000);
    expect(laterStatus(data).yearly).toBe(true);
  });
});
