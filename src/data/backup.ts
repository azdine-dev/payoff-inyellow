/**
 * Backup and restore. Data lives only on this device, so a backup file is the safety net.
 * The file is plain JSON on purpose: readable, easy to keep, easy to trust.
 */
import type { PiyDB, StoreName } from './db';
import { loadAll } from './db';
import type { AppData } from './types';

export const BACKUP_FORMAT = 'paidinyellow-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_REMINDER_DAYS = 30;

/** Stores that go into a backup (the wizard draft does not). */
const BACKUP_STORES = ['settings', 'debts', 'payments', 'charges', 'buffer', 'funds', 'paydays', 'milestones', 'findMoney'] as const;
type BackupStore = (typeof BACKUP_STORES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  stores: Record<BackupStore, unknown[]>;
}

export interface BackupSummary {
  debts: number;
  paydays: number;
  exportedAt: string;
  lastPayday: string | null;
}

export async function buildBackup(db: PiyDB, now = new Date()): Promise<BackupFile> {
  const stores = {} as Record<BackupStore, unknown[]>;
  for (const name of BACKUP_STORES) stores[name] = await db.getAll(name);
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), stores };
}

export function backupFilename(now = new Date()): string {
  return `paidinyellow-backup-${now.toISOString().slice(0, 10)}.json`;
}

export class BackupError extends Error {}

/** Reads and checks a backup file. Throws BackupError with a kind message for the buyer. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('This file isn’t a PaidInYellow backup.');
  }
  const f = raw as Partial<BackupFile> | null;
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT || typeof f.version !== 'number' || !f.stores || typeof f.stores !== 'object') {
    throw new BackupError('This file isn’t a PaidInYellow backup.');
  }
  if (f.version > BACKUP_VERSION) {
    throw new BackupError('This backup comes from a newer version of PaidInYellow. Update the app first, then try again.');
  }
  for (const name of BACKUP_STORES) {
    const list = (f.stores as Record<string, unknown>)[name];
    if (!Array.isArray(list)) throw new BackupError('This backup is missing some of its data, so nothing was changed.');
    if (list.some((r) => !r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string')) {
      throw new BackupError('This backup has records that can’t be read, so nothing was changed.');
    }
  }
  const settings = (f.stores as Record<string, unknown[]>).settings!;
  if (settings.length !== 1) throw new BackupError('This backup has no plan in it, so nothing was changed.');
  return f as BackupFile;
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  const debts = (file.stores.debts as { status?: string }[]).filter((d) => d.status !== 'archived').length;
  const paydays = file.stores.paydays as { date: string; status: string }[];
  const done = paydays.filter((p) => p.status === 'done').map((p) => p.date).sort();
  return { debts, paydays: paydays.length, exportedAt: file.exportedAt, lastPayday: done[done.length - 1] ?? null };
}

/** Replaces everything on this device with the backup. All or nothing. */
export async function restoreBackup(db: PiyDB, file: BackupFile): Promise<AppData> {
  const names: StoreName[] = [...BACKUP_STORES, 'draft'];
  const tx = db.transaction(names, 'readwrite');
  await Promise.all(names.map((n) => tx.objectStore(n).clear()));
  for (const name of BACKUP_STORES) {
    const store = tx.objectStore(name) as unknown as { put(v: unknown): Promise<unknown> };
    for (const rec of file.stores[name]) await store.put(rec);
  }
  await tx.done;
  return (await loadAll(db))!;
}

/** True when it's time for the calm "Save a backup" card. */
export function backupDue(lastBackupAt: number | null, setupDoneAt: number, now = Date.now()): boolean {
  const since = lastBackupAt ?? setupDoneAt;
  return now - since >= BACKUP_REMINDER_DAYS * 86_400_000;
}
