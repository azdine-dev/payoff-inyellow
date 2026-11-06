/**
 * An update never erases saved data. The plan lives in IndexedDB on the phone. A new version only replaces the app's
 * files: the database is opened by the new code, upgraded by adding stores, and never cleared.
 */
import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { completeSetup, didPayday, extraPayment, type SetupValues } from '../state/actions';
import { addComingLater } from '../state/planActions';
import { logCharge } from '../state/debtActions';
import { loadAll, openAppDB, STORES } from './db';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-06',
  paycheckAmount: null,
  debts: [
    { name: 'Store Card', type: '', balance: 450, apr: 26.99, minMonthly: 30, dueDay: 12, autopay: false, myOrder: null },
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

const V1 = ['settings', 'debts', 'payments', 'charges', 'buffer', 'funds', 'paydays', 'draft'] as const;

describe('an update keeps the plan', () => {
  it('a real plan from the oldest database version comes back unchanged after the upgrade', async () => {
    // a plan with paydays, an extra payment, a charge and money coming later, made with the current code
    const db = await openAppDB('update-source');
    let d = await completeSetup(db, setup, '2026-11-03');
    for (let i = 0; i < 3; i++) d = (await didPayday(db, d, {})).data;
    d = (await extraPayment(db, d, 40, '2026-12-10')).data;
    d = await logCharge(db, d, d.debts[1]!.id, 25, 'everyday', '', '2026-12-11');
    d = await addComingLater(db, d, { amount: 800, date: '2027-04-09', kind: 'Tax refund' });
    const before = await loadAll(db);
    expect(before!.paydays).toHaveLength(3);
    db.close();

    // the same records as the first version of the app kept them: only the version 1 stores
    const source = await openAppDB('update-source');
    const old = await openDB('update-old', 1, { upgrade: (x) => V1.forEach((s) => x.createObjectStore(s, { keyPath: 'id' })) });
    for (const store of V1) for (const record of await source.getAll(store)) await old.put(store, record);
    source.close();
    old.close();

    // "the update": the new code opens the old database
    const upgraded = await openAppDB('update-old');
    expect([...upgraded.objectStoreNames].sort()).toEqual([...STORES].sort());
    const after = await loadAll(upgraded);
    expect(after!.settings).toEqual(before!.settings);
    expect(after!.debts).toEqual(before!.debts);
    expect(after!.payments).toEqual(before!.payments);
    expect(after!.charges).toEqual(before!.charges);
    expect(after!.paydays).toEqual(before!.paydays);
    expect(after!.buffer).toEqual(before!.buffer);
    expect(after!.funds).toEqual(before!.funds);
    expect(after!.settings.oneOffs).toHaveLength(1);
  });

  it('opening the app again and again changes nothing', async () => {
    const db = await openAppDB('update-reopen');
    await completeSetup(db, setup, '2026-11-03');
    const first = await loadAll(db);
    db.close();
    for (let i = 0; i < 3; i++) {
      const again = await openAppDB('update-reopen');
      expect(await loadAll(again)).toEqual(first);
      again.close();
    }
  });
});

/** Every .ts and .tsx file of the app, not the tests */
function sources(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('nothing in the app clears data by itself', () => {
  const all = sources().map((p) => ({ p: p.replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

  it('no database or store is ever deleted', () => {
    for (const { p, text } of all) {
      expect(text, p).not.toMatch(/deleteDatabase|deleteObjectStore/);
      expect(text, p).not.toMatch(/localStorage\.clear|sessionStorage\.clear/);
    }
  });

  it('only four places empty a store, and each is a choice the buyer makes: start over, restore a backup, finish setup, join a synced plan', () => {
    const clearing = all.filter((f) => /objectStore\([^)]*\)\.clear\(\)/.test(f.text)).map((f) => f.p).sort();
    expect(clearing).toEqual(['src/data/backup.ts', 'src/data/erase.ts', 'src/state/actions.ts', 'src/sync/engine.ts']);
  });

  it('the service worker only caches the app files and waits for the buyer: no skipWaiting, nothing but static files', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toMatch(/registerType:\s*'prompt'/);
    expect(config).not.toMatch(/skipWaiting:\s*true/);
    expect(config).toMatch(/globPatterns:\s*\['\*\*\/\*\.\{js,css,html,svg,png,woff,woff2,webmanifest\}'\]/); // no data files
    expect(config).toMatch(/cleanupOutdatedCaches:\s*true/); // old file caches only
    // the app starts the service worker and nothing else touches the database on an update
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).not.toMatch(/indexedDB|openAppDB|eraseEverything|clear\(/);
  });
});
