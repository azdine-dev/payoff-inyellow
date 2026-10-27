/** The History list of a debt: statement updates are written down, new charges and payments already were. */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openAppDB, loadAll, type PiyDB } from '../data/db';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { logCharge, updateBalance } from './debtActions';

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
