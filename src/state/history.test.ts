/** The History list of a debt: statement updates are written down, new charges and payments already were. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openAppDB, loadAll, type PiyDB } from '../data/db';
import { completeSetup, didPayday, splitExtra, type SetupValues } from './actions';
import { addDebt, editDebt, logCharge, updateBalance } from './debtActions';

const values: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [{ name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null }],
  bufferNow: 500,
  bufferGoal: 500,
  extraPerPayday: 100,
  funds: [],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`history-${n++}`);
});

describe('"Update from statement" is written down', () => {
  it('keeps the old and the new balance with the date, and it survives a reload of the data', async () => {
    const start = await completeSetup(db, values, '2026-10-15', 1000);
    const visa = start.debts[0]!;
    const after = await updateBalance(db, start, visa.id, 3150.5, 2000, '2026-10-16');
    expect(after.debts[0]!.balance).toBe(3150.5);
    expect(after.debts[0]!.statements).toEqual([{ date: '2026-10-16', from: 3200, to: 3150.5 }]);
    const again = await updateBalance(db, after, visa.id, 3100, 3000, '2026-10-20');
    expect(again.debts[0]!.statements).toHaveLength(2);
    expect((await loadAll(db))!.debts[0]!.statements).toHaveLength(2);
  });

  it('writes nothing when the balance did not change, and older debts simply have no list', async () => {
    const start = await completeSetup(db, values, '2026-10-15', 1000);
    expect(start.debts[0]!.statements).toBeUndefined();
    const same = await updateBalance(db, start, start.debts[0]!.id, 3200, 2000, '2026-10-16');
    expect(same.debts[0]!.statements).toBeUndefined();
  });
});

describe('the other History rows are there to list', () => {
  it('a payday leaves its bill and extra, and a charge leaves its tag and note', async () => {
    const start = await completeSetup(db, values, '2026-10-15', 1000);
    const paid = await didPayday(db, start, { now: 2000 });
    const visa = paid.data.debts[0]!;
    const kinds = paid.data.payments.filter((p) => p.debtId === visa.id).map((p) => p.kind);
    expect(kinds).toContain('extra');
    const charged = await logCharge(db, paid.data, visa.id, 45, 'emergency', 'car part', '2026-10-24', 3000);
    expect(charged.charges.at(-1)).toMatchObject({ debtId: visa.id, amount: 45, tag: 'emergency', note: 'car part' });
  });
});

describe('extra money', () => {
  it('splitExtra: the focus debt first, the overflow to the next, nothing saved', async () => {
    const two: SetupValues = { ...values, debts: [...values.debts, { name: 'Store', type: '', balance: 100, apr: 20, minMonthly: 25, dueDay: 5, autopay: false, myOrder: null }] };
    const start = await completeSetup(db, two, '2026-10-15', 1000);
    const { changed, newlyPaid } = splitExtra(start, 150, '2026-10-16');
    expect(changed.map((d) => [d.name, Math.round(d.balance)])).toEqual([['Store', 0], ['Visa', 3150]]); // Store is smallest, so first; 50 overflow to Visa
    expect(newlyPaid).toHaveLength(1);
    expect(start.debts.find((d) => d.name === 'Store')!.balance).toBe(100); // untouched
  });

  it('a deferred promo that is still running takes the extra first', async () => {
    let d = await completeSetup(db, values, '2026-10-15', 1000);
    d = await addDebt(db, d, { name: 'Sofa card', type: '', balance: 5000, apr: 12, minMonthly: 200, dueDay: 9, autopay: false, promoApr: 0, promoEnds: '2027-03-01', deferredInterest: true }, 2000);
    expect(splitExtra(d, 100, '2026-10-16').changed.map((x) => x.name)).toEqual(['Sofa card']);
    expect(splitExtra(d, 100, '2027-04-01').changed.map((x) => x.name)).not.toContain('Sofa card'); // after the promo, back to the usual order
  });
});

describe('lender, notes and type', () => {
  it('are kept on the debt, and cleared when emptied', async () => {
    const start = await completeSetup(db, values, '2026-10-15', 1000);
    const visa = start.debts[0]!;
    const fields = { name: 'Visa', type: 'Family or friend', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false };
    const set = await editDebt(db, start, visa.id, { ...fields, lender: 'Aunt Sara', notes: 'Pays back on the 1st' }, 2000);
    expect(set.debts[0]).toMatchObject({ type: 'Family or friend', lender: 'Aunt Sara', notes: 'Pays back on the 1st' });
    expect((await loadAll(db))!.debts[0]!.lender).toBe('Aunt Sara');
    const cleared = await editDebt(db, set, visa.id, { ...fields, type: '', lender: undefined, notes: undefined }, 3000);
    expect(cleared.debts[0]!.lender).toBeUndefined();
    expect(cleared.debts[0]!.notes).toBeUndefined();
  });
});
