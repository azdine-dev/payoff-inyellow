import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAll, loadCarry, loadDraft, openAppDB, saveDraft, type PiyDB } from '../data/db';
import { buildBackup } from '../data/backup';
import { eraseEverything } from '../data/erase';
import type { AppData } from '../data/types';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { saveLicense, setAppearance } from './settingsActions';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: null,
  debts: [{ name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: false, myOrder: null }],
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
  db = await openAppDB(`erase-${n++}`);
  data = await completeSetup(db, setup, '2026-10-15');
  data = (await didPayday(db, data)).data;
  data = await setAppearance(db, data, 'dark', 2);
  data = await saveLicense(db, data, 'PIY1.a.b', 9);
  await saveDraft(db, 3, { half: 'done' });
});

describe('start over', () => {
  it('erases every store', async () => {
    await eraseEverything(db, null);
    expect(await loadAll(db)).toBeNull();
    expect(await loadDraft(db)).toBeUndefined();
    expect(await loadCarry(db)).toBeUndefined();
    const backup = await buildBackup(db);
    for (const rows of Object.values(backup.stores)) expect(rows).toEqual([]);
  });

  it('can keep the unlock code and the look for the next setup', async () => {
    await eraseEverything(db, { theme: data.settings.theme, textSize: data.settings.textSize, license: data.settings.license });
    expect(await loadAll(db)).toBeNull();
    expect(await loadCarry(db)).toMatchObject({ theme: 'dark', textSize: 2, license: { code: 'PIY1.a.b', activatedAt: 9 } });
    expect(await loadDraft(db)).toBeUndefined(); // the half-finished wizard answers are gone

    const carry = (await loadCarry(db))!;
    const fresh = await completeSetup(db, setup, '2026-11-01', 5, { theme: carry.theme, textSize: carry.textSize, license: carry.license });
    expect(fresh.settings).toMatchObject({ theme: 'dark', textSize: 2, license: { code: 'PIY1.a.b' } });
    expect(fresh.paydays).toEqual([]);
    expect(fresh.payments).toEqual([]);
    expect(fresh.settings.paydayIndex).toBe(0);
    expect(await loadCarry(db)).toBeUndefined(); // used once
  });

  it('a backup never contains the kept values or the wizard draft', async () => {
    await eraseEverything(db, { theme: 'auto', textSize: 1, license: null });
    const backup = await buildBackup(db);
    expect(JSON.stringify(backup)).not.toContain('carry');
  });
});
