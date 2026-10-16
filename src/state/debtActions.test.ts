import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { addDebt, archiveDebt, editDebt, logCharge, restoreDebt, updateBalance } from './debtActions';
import { addFund, editFund, findMoneyItems, removeFund, saveFindMoney, setBuffer, setBufferGoal, spendFund, useBuffer } from './moneyActions';
import { oneOffAdjustments, plannedMoney, toPlanInput } from './planInput';

const setup: SetupValues = {
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
  funds: [{ name: 'Car repairs', perYear: 600, month: 'Any time' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let data: AppData;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`debts-${n++}`);
  data = await completeSetup(db, setup, '2026-10-15');
});

const byName = (d: AppData, name: string) => d.debts.find((x) => x.name === name)!;
const freeDate = (d: AppData) => simulatePlan(toPlanInput(d)).debtFreeDate!;
const reload = async () => (await loadAll(db))!;

describe('setup snapshot', () => {
  it('saves a baseline and the "plan made" milestone', () => {
    expect(data.settings.baseline).toMatchObject({ date: '2026-10-15', debtFreeDate: freeDate(data), totalOwed: 3840 });
    expect(data.milestones.map((m) => m.id)).toEqual(['plan-made']);
  });
});

describe('debts', () => {
  it('adds a debt at the end and the plan includes it', async () => {
    const before = freeDate(data);
    const after = await addDebt(db, data, { name: 'Phone', type: '', balance: 300, apr: 0, minMonthly: 25, dueDay: null, autopay: false });
    expect(after.debts.map((d) => d.name)).toEqual(['Visa', 'Store card', 'Phone']);
    expect(freeDate(after) >= before).toBe(true);
    expect(await reload()).toEqual(after);
  });

  it('a new charge raises the balance, is logged, and moves the date', async () => {
    const before = freeDate(data);
    const visa = byName(data, 'Visa');
    const after = await logCharge(db, data, visa.id, 900, 'emergency', 'Car repair', '2026-10-16');
    expect(byName(after, 'Visa').balance).toBe(4100);
    expect(after.charges).toMatchObject([{ debtId: visa.id, amount: 900, tag: 'emergency', note: 'Car repair' }]);
    expect(freeDate(after) > before).toBe(true);
    expect(await reload()).toEqual(after);
  });

  it('a charge on a paid debt makes it active again', async () => {
    const store = byName(data, 'Store card');
    let d = await updateBalance(db, data, store.id, 0);
    expect(byName(d, 'Store card').status).toBe('paid');
    d = await logCharge(db, d, store.id, 40, 'everyday', '', '2026-10-16');
    expect(byName(d, 'Store card')).toMatchObject({ status: 'active', balance: 40 });
  });

  it('update from statement replaces the balance', async () => {
    const visa = byName(data, 'Visa');
    const after = await updateBalance(db, data, visa.id, 3150.25);
    expect(byName(after, 'Visa').balance).toBe(3150.25);
    expect(byName(after, 'Visa').startBalance).toBe(3200);
  });

  it('edits name, rate and minimum', async () => {
    const visa = byName(data, 'Visa');
    const after = await editDebt(db, data, visa.id, { ...visa, name: 'Visa Gold', apr: 19.9, minMonthly: 110 });
    expect(after.debts[0]).toMatchObject({ name: 'Visa Gold', apr: 19.9, minMonthly: 110, status: 'active' });
  });

  it('archived debts leave the plan and can come back', async () => {
    const store = byName(data, 'Store card');
    const archived = await archiveDebt(db, data, store.id);
    expect(toPlanInput(archived).debts.map((d) => d.name)).toEqual(['Visa']);
    const back = await restoreDebt(db, archived, store.id);
    expect(byName(back, 'Store card').status).toBe('active');
  });
});

describe('money', () => {
  it('using the buffer lowers it, and the next payday refills it first', async () => {
    const after = await useBuffer(db, data, 200, 'Car repair', '2026-10-16');
    expect(after.buffer.amount).toBe(300);
    expect(after.buffer.history.at(-1)).toEqual({ date: '2026-10-16', amount: -200, note: 'Car repair' });
    const { step } = await didPayday(db, after);
    expect(step.toBuffer).toBeGreaterThan(0);
    expect(step.extra).toBe(0);
  });

  it('cannot use more than is in the buffer', async () => {
    const after = await useBuffer(db, data, 9999, '', '2026-10-16');
    expect(after.buffer.amount).toBe(0);
  });

  it('sets the buffer and its goal', async () => {
    let d = await setBuffer(db, data, 650, '2026-10-16');
    d = await setBufferGoal(db, d, 1000);
    expect(d.buffer.amount).toBe(650);
    expect(d.settings.bufferGoal).toBe(1000);
    expect(await reload()).toEqual(d);
  });

  it('adds, edits, spends and removes yearly bills', async () => {
    let d = await addFund(db, data, { name: 'School', perYear: 300, month: 'August' });
    expect(d.funds.map((f) => f.name)).toEqual(['Car repairs', 'School']);
    const school = d.funds[1]!;
    d = await editFund(db, d, school.id, { name: 'School supplies', perYear: 350, month: 'August' });
    d = (await didPayday(db, d)).data;
    const saved = d.funds[1]!.saved;
    expect(saved).toBeCloseTo(350 / 26, 9);
    d = await spendFund(db, d, school.id, 5);
    expect(d.funds[1]!.saved).toBeCloseTo(saved - 5, 9);
    d = await removeFund(db, d, school.id);
    expect(d.funds.map((f) => f.name)).toEqual(['Car repairs']);
    const loaded = await reload();
    expect(loaded.funds).toEqual(d.funds);
    expect(loaded.debts).toEqual(d.debts);
  });

  it('keeps the "find your first $500" checklist', async () => {
    const items = findMoneyItems(data).map((i) => (i.key === 'sell' ? { ...i, amount: 120, done: true } : i));
    const d = await saveFindMoney(db, data, items);
    expect(findMoneyItems(d).find((i) => i.key === 'sell')).toMatchObject({ amount: 120, done: true });
    expect(findMoneyItems(await reload()).filter((i) => i.done)).toHaveLength(1);
  });
});

describe('one-off money', () => {
  it('goes into the payday on or after its date, then is used', async () => {
    const d = { ...data, settings: { ...data.settings, oneOffs: [{ id: 'x', date: '2026-11-01', amount: 900, note: 'Tax refund' }] } };
    expect(oneOffAdjustments(d.settings)).toEqual({ 2: 900 }); // payday 2 = Fri 6 Nov
    let r = await didPayday(db, d);
    expect(r.data.settings.oneOffs).toHaveLength(1);
    expect(plannedMoney(r.data)).toBe(1050);
    r = await didPayday(db, r.data);
    expect(r.step.planMoney).toBe(1050);
    expect(r.data.settings.oneOffs).toEqual([]);
  });
});
