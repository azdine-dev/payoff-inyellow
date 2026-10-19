import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAll, openAppDB, type PiyDB } from '../../src/data/db';
import { completeSetup, didPayday, type SetupValues } from '../../src/state/actions';
import { editDebt } from '../../src/state/debtActions';
import { commit } from '../../src/data/db';
import { createSync, JoinError } from '../../src/sync/engine';
import { codeFor, harness, NOW, type Harness } from './helpers';

const sample: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: 1400,
  debts: [
    { name: 'Visa', type: 'Credit card', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: true, myOrder: null },
    { name: 'Store card', type: 'Store card', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 5, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [{ name: 'Car repairs', perYear: 600, month: 'Any time' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let h: Harness;
let n = 0;
let online = true;
const code = codeFor('shopify-1');

async function device(name: string, getCode: () => string | null = () => code) {
  const db: PiyDB = await openAppDB(`two-${n++}-${name}`);
  const sync = createSync({
    db,
    baseUrl: 'https://api.test',
    getCode,
    now: () => h.clock.now,
    fetchFn: (async (url: string, init?: RequestInit) => {
      if (!online) throw new TypeError('offline');
      const u = new URL(url);
      return h.call(u.pathname + u.search, { ...init, code: new Headers(init?.headers).get('X-PIY-Code') });
    }) as typeof fetch,
  });
  return { db, sync };
}

/** Everything a plan is made of, in a form two phones can be compared by (this phone's own settings left out). */
async function plan(db: PiyDB) {
  const d = (await loadAll(db))!;
  const { theme, textSize, lastBackupAt, license, ...settings } = d.settings as any;
  return { ...d, settings, payments: [...d.payments].sort((a, b) => a.id.localeCompare(b.id)) };
}

beforeEach(() => {
  h = harness();
  online = true;
});

describe('two devices', () => {
  it('the second phone gets the whole plan, and the server only ever holds scrambled bytes', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();

    const rows = (await h.db.prepare('SELECT * FROM sync_records').all<any>()).results;
    expect(rows.length).toBeGreaterThan(5);
    const stored = JSON.stringify(rows);
    for (const secret of ['Visa', 'Store card', 'Car repairs', '3200', 'Credit card', key]) expect(stored).not.toContain(secret);

    const b = await device('b');
    const r = await b.sync.join(syncId, key);
    expect(r.status).toBe('idle');
    expect(r.unreadable).toBe(0);
    expect(await plan(b.db)).toEqual(await plan(a.db));
  });

  it('a change on one phone shows up on the other, both ways', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);

    h.clock.now += 60_000;
    let dataA = (await loadAll(a.db))!;
    const visa = dataA.debts.find((d) => d.name === 'Visa')!;
    await editDebt(a.db, dataA, visa.id, { ...visa, balance: 3000 }, h.clock.now);
    expect((await a.sync.syncNow()).pushed).toBe(1);
    expect((await b.sync.syncNow()).pulled).toBe(1);
    expect((await loadAll(b.db))!.debts.find((d) => d.name === 'Visa')!.balance).toBe(3000);

    h.clock.now += 60_000;
    const dataB = (await loadAll(b.db))!;
    await didPayday(b.db, dataB, { now: h.clock.now });
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect(await plan(a.db)).toEqual(await plan(b.db));
    expect((await loadAll(a.db))!.settings.paydayIndex).toBe(1);
  });

  it('both phones tap "I did it" for the same payday while offline: it merges into one payday, not two', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);

    online = false;
    h.clock.now += 60_000;
    await didPayday(a.db, (await loadAll(a.db))!, { now: h.clock.now });
    h.clock.now += 5_000;
    await didPayday(b.db, (await loadAll(b.db))!, { now: h.clock.now });
    expect((await a.sync.syncNow()).status).toBe('offline');
    online = true;
    await a.sync.syncNow();
    await b.sync.syncNow();
    await a.sync.syncNow();
    const pa = await plan(a.db);
    expect(pa).toEqual(await plan(b.db));
    expect(pa.settings.paydayIndex).toBe(1);
    expect(pa.paydays).toHaveLength(1);
  });

  it('offline first: changes made with no network are kept and go out when the network is back', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);

    online = false;
    h.clock.now += 60_000;
    const data = (await loadAll(a.db))!;
    const store = data.debts.find((d) => d.name === 'Store card')!;
    await editDebt(a.db, data, store.id, { ...store, balance: 500 }, h.clock.now);
    expect((await a.sync.syncNow()).status).toBe('offline');
    expect((await loadAll(a.db))!.debts.find((d) => d.name === 'Store card')!.balance).toBe(500);
    online = true;
    expect((await a.sync.syncNow()).pushed).toBe(1);
    await b.sync.syncNow();
    expect((await loadAll(b.db))!.debts.find((d) => d.name === 'Store card')!.balance).toBe(500);
  });

  it('two edits of the same debt: the later one wins, on both phones', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);

    const dA = (await loadAll(a.db))!;
    const dB = (await loadAll(b.db))!;
    const visa = dA.debts.find((d) => d.name === 'Visa')!;
    await editDebt(a.db, dA, visa.id, { ...visa, balance: 111 }, h.clock.now + 1_000);
    await editDebt(b.db, dB, visa.id, { ...visa, balance: 222 }, h.clock.now + 2_000); // later
    h.clock.now += 10_000;
    await a.sync.syncNow();
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect((await loadAll(a.db))!.debts.find((d) => d.id === visa.id)!.balance).toBe(222);
    expect((await loadAll(b.db))!.debts.find((d) => d.id === visa.id)!.balance).toBe(222);
  });

  it('a deleted record is deleted on the other phone', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);

    const data = (await loadAll(a.db))!;
    await commit(a.db, data, { remove: { funds: [data.funds[0]!.id] } });
    h.clock.now += 1000;
    await a.sync.syncNow();
    await b.sync.syncNow();
    expect((await loadAll(b.db))!.funds).toHaveLength(0);
  });

  it('keeps each phone\'s own look and unlock code', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);
    const sA = (await a.db.get('settings', (await loadAll(a.db))!.settings.id)) as any;
    await a.db.put('settings', { ...sA, theme: 'dark', textSize: 1.3, updatedAt: h.clock.now + 5 });
    h.clock.now += 100;
    await a.sync.syncNow();
    await b.sync.syncNow();
    const sB = (await loadAll(b.db))!.settings;
    expect(sB.theme).not.toBe('dark');
  });

  it('a wrong key reads nothing and changes nothing', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId } = await a.sync.enable();
    const b = await device('b');
    const wrong = 'A'.repeat(43);
    const r = await b.sync.join(syncId, wrong);
    expect(r.unreadable).toBeGreaterThan(5);
    expect((await loadAll(b.db))).toBeNull();
  });

  it('a wrong link (no such sync) is refused before anything on the phone changes', async () => {
    const b = await device('b');
    await completeSetup(b.db, sample, '2026-10-15', NOW);
    const before = await plan(b.db);
    await expect(b.sync.join('Zz9Yy8Xx7Ww6Vv5Uu4Tt3S', 'B'.repeat(43))).rejects.toMatchObject({ reason: 'link_invalid' });
    await expect(b.sync.join('short', 'B'.repeat(43))).rejects.toBeInstanceOf(JoinError);
    expect(await plan(b.db)).toEqual(before);
    expect(await b.sync.config()).toBeUndefined();
  });

  it('stop and delete: the server is emptied, the phone keeps its plan, and the other phone is told', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);

    const kept = await plan(a.db);
    await a.sync.stop({ deleteServer: true });
    expect((await h.db.prepare('SELECT COUNT(*) AS n FROM sync_records').first<{ n: number }>())!.n).toBe(0);
    expect(await a.sync.config()).toBeUndefined();
    expect(await plan(a.db)).toEqual(kept);
    expect((await a.sync.syncNow()).status).toBe('off');
    expect((await b.sync.syncNow()).status).toBe('stopped');
    expect(await b.sync.config()).toBeUndefined();
    expect((await loadAll(b.db))!.debts).toHaveLength(2);
  });

  it('stop while offline does not pretend the server data is gone', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    await a.sync.enable();
    online = false;
    await expect(a.sync.stop({ deleteServer: true })).rejects.toMatchObject({ reason: 'offline' });
    expect(await a.sync.config()).toBeDefined(); // still on, so the buyer can try again
  });

  it('needs the unlock code, and tells a refunded buyer calmly', async () => {
    const a = await device('a', () => null);
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    await expect(a.sync.enable()).rejects.toMatchObject({ reason: 'needs-code' });

    const ok = await device('ok');
    await completeSetup(ok.db, sample, '2026-10-15', NOW);
    await ok.sync.enable();
    await h.db.prepare('INSERT INTO revoked (code_id, revoked_at) VALUES (?, ?)').bind('shopify-1', NOW).run();
    h.clock.now += 1000;
    expect((await ok.sync.syncNow()).status).toBe('blocked');
    expect((await loadAll(ok.db))!.debts).toHaveLength(2); // the plan on the phone is untouched
  });

  it('a lot of records go through in pages and chunks', async () => {
    const a = await device('a');
    await completeSetup(a.db, sample, '2026-10-15', NOW);
    const { db } = a;
    const data = (await loadAll(db))!;
    const extra = Array.from({ length: 450 }, (_, i) => ({
      id: `pay-x-${i}`, updatedAt: NOW + i, date: '2026-10-20', debtId: data.debts[0]!.id, fundId: null, amount: 1, kind: 'extra' as const, planned: false, paydayNumber: null,
    }));
    await commit(db, data, { payments: extra });
    const { syncId, key } = await a.sync.enable();
    const b = await device('b');
    await b.sync.join(syncId, key);
    expect((await loadAll(b.db))!.payments).toHaveLength(450);
  });
});
