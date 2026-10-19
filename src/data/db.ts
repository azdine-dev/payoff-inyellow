/** IndexedDB storage. Data lives only on this device. */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { payoffOrderIds } from '../engine';
import type {
  AppData,
  BufferRecord,
  Charge,
  Debt,
  FindMoneyRecord,
  Fund,
  Milestone,
  Payment,
  PaydayLog,
  Settings,
  TextSize,
  Theme,
  License,
} from './types';

export interface DraftRecord {
  id: 'draft';
  updatedAt: number;
  step: number;
  data: unknown;
}

/** Kept across "Start over" so the unlock code and the look survive. Used once by the next setup. */
export interface CarryRecord {
  id: 'carry';
  updatedAt: number;
  theme: Theme;
  textSize: TextSize;
  license: License | null;
}

/** Sync on this device: which space, and the key (the key never leaves the device except in the link the buyer shares). */
export interface SyncConfig {
  id: 'config';
  updatedAt: number;
  syncId: string;
  /** AES-GCM key, base64url (32 bytes) */
  key: string;
  /** Server number of the last change we have fetched */
  since: number;
  enabledAt: number;
  lastSyncAt: number | null;
  /** The space exists on the server (the first phone creates it with its first save) */
  created: boolean;
}

/** What we last sent to or got from the server for one record. Lets us find what changed without hooking every write. */
export interface LedgerEntry {
  id: string; // 'rid:' + rid
  updatedAt: number;
  rid: string;
  ts: number;
  hash: string;
  deleted: boolean;
}

interface PiySchema extends DBSchema {
  settings: { key: string; value: Settings };
  debts: { key: string; value: Debt };
  payments: { key: string; value: Payment };
  charges: { key: string; value: Charge };
  buffer: { key: string; value: BufferRecord };
  funds: { key: string; value: Fund };
  paydays: { key: string; value: PaydayLog };
  draft: { key: string; value: DraftRecord | CarryRecord };
  milestones: { key: string; value: Milestone };
  findMoney: { key: string; value: FindMoneyRecord };
  sync: { key: string; value: SyncConfig | LedgerEntry };
}

export type PiyDB = IDBPDatabase<PiySchema>;
export type StoreName =
  | 'settings'
  | 'debts'
  | 'payments'
  | 'charges'
  | 'buffer'
  | 'funds'
  | 'paydays'
  | 'draft'
  | 'milestones'
  | 'findMoney'
  | 'sync';

/** Stores per database version. Never change an old line: add a new version instead. */
const VERSIONS: StoreName[][] = [
  ['settings', 'debts', 'payments', 'charges', 'buffer', 'funds', 'paydays', 'draft'], // v1
  ['milestones', 'findMoney'], // v2
  ['sync'], // v3
];
export const STORES: StoreName[] = VERSIONS.flat();

export function openAppDB(name = 'paidinyellow'): Promise<PiyDB> {
  return openDB<PiySchema>(name, VERSIONS.length, {
    upgrade(db, oldVersion) {
      VERSIONS.slice(oldVersion).forEach((stores) => {
        for (const store of stores) db.createObjectStore(store, { keyPath: 'id' });
      });
    },
  });
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Everything the app needs, or null before setup is done. */
export async function loadAll(db: PiyDB): Promise<AppData | null> {
  const stored = await db.get('settings', 'settings');
  if (!stored) return null;
  const [debts, buffer, funds, payments, charges, paydays, milestones, findMoney] = await Promise.all([
    db.getAll('debts'),
    db.get('buffer', 'buffer'),
    db.getAll('funds'),
    db.getAll('payments'),
    db.getAll('charges'),
    db.getAll('paydays'),
    db.getAll('milestones'),
    db.get('findMoney', 'findMoney'),
  ]);
  // Fields added after v1 get their defaults
  // Older plans have no stored payoff order yet: make it once, from the debts as they are
  const counted = debts.filter((d) => d.status !== 'archived').sort((a, b) => a.position - b.position);
  const settings: Settings = {
    ...stored,
    otherPayday: stored.otherPayday ?? null,
    payoffOrder:
      stored.payoffOrder ??
      payoffOrderIds(
        counted.map((d) => ({ id: d.id, name: d.name, balance: d.balance, apr: d.apr, minMonthly: d.minMonthly, myOrder: d.myOrder })),
        stored.method,
      ),
    oneOffs: stored.oneOffs ?? [],
    baseline: stored.baseline ?? null,
    numberOffset: stored.numberOffset ?? 0,
    lastBackupAt: stored.lastBackupAt ?? null,
    theme: stored.theme ?? 'auto',
    textSize: stored.textSize ?? 1,
    license: stored.license ?? null,
  };
  return {
    settings,
    debts: debts.sort((a, b) => a.position - b.position),
    buffer: buffer ?? { id: 'buffer', updatedAt: Date.now(), amount: 0, history: [] },
    funds: funds.sort((a, b) => a.position - b.position),
    payments: payments.sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt),
    charges: charges.sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt),
    paydays: paydays.sort((a, b) => a.number - b.number),
    milestones: milestones.sort((a, b) => a.reachedOn.localeCompare(b.reachedOn)),
    findMoney: findMoney ?? null,
  };
}

export async function loadDraft(db: PiyDB): Promise<DraftRecord | undefined> {
  return (await db.get('draft', 'draft')) as DraftRecord | undefined;
}

export async function loadCarry(db: PiyDB): Promise<CarryRecord | undefined> {
  return (await db.get('draft', 'carry')) as CarryRecord | undefined;
}

/** Keeps a code (or the look) for the next setup. Used when an unlock link is opened before the plan is made. */
export async function saveCarry(db: PiyDB, patch: Partial<Pick<CarryRecord, 'theme' | 'textSize' | 'license'>>): Promise<void> {
  const current = await loadCarry(db);
  await db.put('draft', {
    id: 'carry',
    updatedAt: Date.now(),
    theme: current?.theme ?? 'auto',
    textSize: current?.textSize ?? 1,
    license: current?.license ?? null,
    ...patch,
  });
}

export async function saveDraft(db: PiyDB, step: number, data: unknown): Promise<void> {
  await db.put('draft', { id: 'draft', updatedAt: Date.now(), step, data });
}

/** Records that changed in one action. Written in one transaction. */
export interface Changes {
  settings?: Settings;
  buffer?: BufferRecord;
  findMoney?: FindMoneyRecord;
  debts?: Debt[];
  funds?: Fund[];
  payments?: Payment[];
  charges?: Charge[];
  paydays?: PaydayLog[];
  milestones?: Milestone[];
  /** ids to delete, per store */
  remove?: Partial<Record<'funds', string[]>>;
}

export async function writeChanges(db: PiyDB, c: Changes): Promise<void> {
  const stores = (Object.keys(c) as (keyof Changes)[]).flatMap((k) => (k === 'remove' ? Object.keys(c.remove ?? {}) : [k])) as StoreName[];
  if (!stores.length) return;
  const tx = db.transaction([...new Set(stores)], 'readwrite');
  const puts: Promise<unknown>[] = [];
  if (c.settings) puts.push(tx.objectStore('settings').put(c.settings));
  if (c.buffer) puts.push(tx.objectStore('buffer').put(c.buffer));
  if (c.findMoney) puts.push(tx.objectStore('findMoney').put(c.findMoney));
  for (const d of c.debts ?? []) puts.push(tx.objectStore('debts').put(d));
  for (const f of c.funds ?? []) puts.push(tx.objectStore('funds').put(f));
  for (const p of c.payments ?? []) puts.push(tx.objectStore('payments').put(p));
  for (const ch of c.charges ?? []) puts.push(tx.objectStore('charges').put(ch));
  for (const l of c.paydays ?? []) puts.push(tx.objectStore('paydays').put(l));
  for (const m of c.milestones ?? []) puts.push(tx.objectStore('milestones').put(m));
  for (const id of c.remove?.funds ?? []) puts.push(tx.objectStore('funds').delete(id));
  await Promise.all([...puts, tx.done]);
}

/** Applies the same changes to the in-memory data (by id, keeping order). */
export function mergeChanges(data: AppData, c: Changes): AppData {
  const upsert = <T extends { id: string }>(list: T[], items: T[] = []): T[] => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const kept = list.map((x) => byId.get(x.id) ?? x);
    return [...kept, ...items.filter((i) => !list.some((x) => x.id === i.id))];
  };
  return {
    ...data,
    settings: c.settings ?? data.settings,
    buffer: c.buffer ?? data.buffer,
    findMoney: c.findMoney ?? data.findMoney,
    debts: upsert(data.debts, c.debts),
    funds: upsert(data.funds, c.funds).filter((f) => !c.remove?.funds?.includes(f.id)),
    payments: upsert(data.payments, c.payments),
    charges: upsert(data.charges, c.charges),
    paydays: upsert(data.paydays, c.paydays),
    milestones: upsert(data.milestones, c.milestones),
  };
}

/** Write, then return the new in-memory data. */
export async function commit(db: PiyDB, data: AppData, c: Changes): Promise<AppData> {
  await writeChanges(db, c);
  return mergeChanges(data, c);
}
