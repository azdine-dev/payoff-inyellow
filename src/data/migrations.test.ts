import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { openAppDB, STORES } from './db';

const V1 = ['settings', 'debts', 'payments', 'charges', 'buffer', 'funds', 'paydays', 'draft'];
const V2 = [...V1, 'milestones', 'findMoney'];

async function oldDb(name: string, version: number, stores: string[]) {
  const db = await openDB(name, version, { upgrade: (d) => stores.forEach((s) => d.createObjectStore(s, { keyPath: 'id' })) });
  await db.put('settings', { id: 'settings', frequency: 'biweekly', updatedAt: 1 });
  await db.put('debts', { id: 'd1', name: 'Visa', balance: 3200, updatedAt: 1 });
  await db.put('payments', { id: 'pay-1-minimum-d1', amount: 96, updatedAt: 1 });
  await db.put('draft', { id: 'carry', theme: 'dark', updatedAt: 1 });
  db.close();
}

describe('an update never wipes saved data', () => {
  it('a version 1 database keeps everything and gains the newer stores', async () => {
    await oldDb('mig-v1', 1, V1);
    const db = await openAppDB('mig-v1');
    expect(await db.get('debts', 'd1')).toMatchObject({ name: 'Visa', balance: 3200 });
    expect(await db.get('settings', 'settings')).toMatchObject({ frequency: 'biweekly' });
    expect(await db.get('payments', 'pay-1-minimum-d1')).toMatchObject({ amount: 96 });
    expect(await db.get('draft', 'carry')).toMatchObject({ theme: 'dark' });
    expect([...db.objectStoreNames].sort()).toEqual([...STORES].sort());
  });

  it('a version 2 database keeps everything and gains the sync store', async () => {
    await oldDb('mig-v2', 2, V2);
    const db = await openAppDB('mig-v2');
    expect(await db.get('debts', 'd1')).toMatchObject({ name: 'Visa' });
    expect([...db.objectStoreNames]).toContain('sync');
    expect([...db.objectStoreNames].sort()).toEqual([...STORES].sort());
  });

  it('opening the current version again changes nothing', async () => {
    const first = await openAppDB('mig-now');
    await first.put('debts', { id: 'd9', name: 'Card' } as never);
    first.close();
    const again = await openAppDB('mig-now');
    expect(await again.get('debts', 'd9')).toMatchObject({ name: 'Card' });
  });
});
