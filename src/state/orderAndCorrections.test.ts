/**
 * The payoff order is made again from the chosen method after every add, edit, archive, restore and balance update, a quick-added
 * debt with no minimum is not "growing", and a typed-in balance (Edit, "Update from statement") is not paid progress.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { addDebt, archiveDebt, baselineAfterCorrection, editDebt, restoreDebt, updateBalance, type DebtFields } from './debtActions';
import { progressStats, reachedKeys } from './milestones';
import { simulatePlan } from '../engine';
import { toPlanInput } from './planInput';

// The Nadia plan, without Visa yet
const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-06',
  paycheckAmount: null,
  debts: [
    { name: 'Store Card', type: '', balance: 450, apr: 26.99, minMonthly: 30, dueDay: 12, autopay: false, myOrder: null },
    { name: 'Medical', type: '', balance: 600, apr: 0, minMonthly: 50, dueDay: 3, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

const visa = (over: Partial<DebtFields> = {}): DebtFields => ({ name: 'Visa', type: '', balance: 2200, apr: 22.99, minMonthly: 66, dueDay: 20, autopay: false, ...over });

let db: PiyDB;
let data: AppData;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`order-${n++}`);
  data = await completeSetup(db, setup, '2026-10-30');
});

const names = (d: AppData) => d.settings.payoffOrder.map((id) => d.debts.find((x) => x.id === id)!.name);
const byName = (d: AppData, name: string) => d.debts.find((x) => x.name === name)!;

describe('the payoff order is made again', () => {
  it('Store Card and Medical, then Visa added with its minimum: Store Card, Medical, Visa', async () => {
    const after = await addDebt(db, data, visa());
    expect(names(after)).toEqual(['Store Card', 'Medical', 'Visa']);
    expect(names((await loadAll(db))!)).toEqual(['Store Card', 'Medical', 'Visa']); // and it is what is saved
  });

  it('a quick-added Visa with no minimum does not count as growing, so it does not jump to the front', async () => {
    const quick = await addDebt(db, data, visa({ minMonthly: 0, minPending: true }));
    expect(names(quick)).toEqual(['Store Card', 'Medical', 'Visa']);
  });

  it('adding the minimum afterwards (an edit) keeps the order right', async () => {
    const quick = await addDebt(db, data, visa({ minMonthly: 0, minPending: true }));
    const edited = await editDebt(db, quick, byName(quick, 'Visa').id, visa());
    expect(names(edited)).toEqual(['Store Card', 'Medical', 'Visa']);
  });

  it('a debt that really grows (a minimum of 0 typed in) still goes first', async () => {
    const grows = await addDebt(db, data, visa({ minMonthly: 0, minPending: false }));
    expect(names(grows)[0]).toBe('Visa');
  });

  it('an edit that changes the order is saved: Medical becomes the smallest', async () => {
    const edited = await editDebt(db, data, byName(data, 'Medical').id, { name: 'Medical', type: '', balance: 300, apr: 0, minMonthly: 50, dueDay: 3, autopay: false });
    expect(names(edited)).toEqual(['Medical', 'Store Card']);
  });

  it('"Update from statement" makes the order again from the new balance', async () => {
    const updated = await updateBalance(db, data, byName(data, 'Store Card').id, 900, 1, '2026-10-31');
    expect(names(updated)).toEqual(['Medical', 'Store Card']);
    expect(names((await loadAll(db))!)).toEqual(['Medical', 'Store Card']);
  });

  it('archive and restore make it again too', async () => {
    const withVisa = await addDebt(db, data, visa());
    const archived = await archiveDebt(db, withVisa, byName(withVisa, 'Medical').id);
    expect(names(archived)).toEqual(['Store Card', 'Visa']);
    const back = await restoreDebt(db, archived, byName(archived, 'Medical').id);
    expect(names(back)).toEqual(['Store Card', 'Medical', 'Visa']);
  });

  it('follows the chosen method: biggest interest first puts Store Card, Visa, Medical', async () => {
    const withVisa = await addDebt(db, { ...data, settings: { ...data.settings, method: 'biggest-interest' } }, visa());
    expect(names(withVisa)).toEqual(['Store Card', 'Visa', 'Medical']);
  });

  it('the plan itself uses that order: the extra goes to Store Card first', async () => {
    const after = await addDebt(db, data, visa());
    const r = simulatePlan(toPlanInput(after));
    expect(r.rows.find((x) => x.extraGoesTo)!.extraGoesTo).toBe(byName(after, 'Store Card').id); // the first extra (the buffer fills first)
  });
});

describe('a typed-in balance is not paid progress', () => {
  it('"Update from statement" down to a lower balance leaves progress at 0% and starts that debt from the new balance', async () => {
    const before = progressStats(data);
    const updated = await updateBalance(db, data, byName(data, 'Medical').id, 400, 1, '2026-10-31');
    expect(byName(updated, 'Medical').startBalance).toBe(400);
    const after = progressStats(updated);
    expect(after.paid).toBe(0);
    expect(after.pct).toBe(0);
    expect(before.paid).toBe(0);
    // and no milestone comes from it
    const keys = reachedKeys(updated, simulatePlan(toPlanInput(updated)));
    expect([...keys]).toEqual(['plan-made']);
  });

  it('the same for Edit: a lower balance typed in is a correction, not 25% progress', async () => {
    const edited = await editDebt(db, data, byName(data, 'Store Card').id, { name: 'Store Card', type: '', balance: 100, apr: 26.99, minMonthly: 30, dueDay: 12, autopay: false });
    expect(byName(edited, 'Store Card').startBalance).toBe(100);
    expect(progressStats(edited).paid).toBe(0);
  });

  it('an unchanged balance keeps its starting point, and a higher balance moves it up too', async () => {
    const same = await editDebt(db, data, byName(data, 'Medical').id, { name: 'Medical', type: '', balance: 600, apr: 0, minMonthly: 60, dueDay: 3, autopay: false });
    expect(byName(same, 'Medical').startBalance).toBe(600);
    const higher = await updateBalance(db, data, byName(data, 'Medical').id, 700);
    expect(byName(higher, 'Medical').startBalance).toBe(700);
    expect(progressStats(higher).paid).toBe(0);
  });

  it('real payments still count: a payday done, then a statement update, keeps what was really paid', async () => {
    const done = (await didPayday(db, data, {})).data;
    const real = progressStats(done).paid;
    expect(real).toBeGreaterThan(0);
    const medical = byName(done, 'Medical');
    const corrected = await updateBalance(db, done, medical.id, medical.balance - 100);
    // the 100 of the statement is not progress, the real payments are
    expect(progressStats(corrected).paid).toBeCloseTo(real, 2);
    expect(baselineAfterCorrection(done, medical, medical.balance - 100)).toBeGreaterThanOrEqual(medical.balance - 100);
  });
});
