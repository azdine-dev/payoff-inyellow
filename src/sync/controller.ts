/**
 * Sync for the running app: when to sync, and what the screen shows. The sync itself is in engine.ts.
 * Sync is off until the buyer turns it on. Nothing here runs for someone who never does.
 */
import { effect, signal } from '@preact/signals';
import { loadAll, loadCarry } from '../data/db';
import { COPY } from '../lib/copy';
import { SYNC_URL } from '../lib/config';
import { showNotice } from '../state/notice';
import { data, getDB, view } from '../state/store';
import { createSync, JoinError, type SyncEngine } from './engine';
import type { SyncStatus } from './types';

export const syncOn = signal(false);
export const syncStatus = signal<SyncStatus>('off');
export const lastSyncAt = signal<number | null>(null);
export const unreadable = signal(0);

/** A link to join a sync was opened: waits here for the buyer to confirm if there is already a plan on this phone. */
export const pendingJoin = signal<{ syncId: string; key: string } | null>(null);

let engine: Promise<SyncEngine> | null = null;
export function getSync(): Promise<SyncEngine> {
  engine ??= (async () => {
    const db = await getDB();
    return createSync({
      db,
      baseUrl: SYNC_URL,
      // The code in the plan, or the one kept from an unlock link opened before there was a plan
      getCode: async () => data.peek()?.settings.license?.code ?? (await loadCarry(db))?.license?.code ?? null,
      onRemoteChange: async () => {
        let loaded = await loadAll(db);
        if (!loaded) return;
        // A phone that joined from a link keeps the unlock code the link brought (it is not synced as part of the plan)
        const carried = (await loadCarry(db))?.license;
        if (!loaded.settings.license && carried) {
          await db.put('settings', { ...loaded.settings, license: carried });
          loaded = (await loadAll(db))!;
        }
        data.value = loaded;
        if (view.peek() === 'setup' || view.peek() === 'result') view.value = 'app';
      },
    });
  })();
  return engine;
}

/** Re-read whether sync is on (after turning it on or off). */
export async function refreshSyncState(): Promise<void> {
  const cfg = await (await getSync()).config();
  syncOn.value = !!cfg;
  lastSyncAt.value = cfg?.lastSyncAt ?? null;
  if (!cfg) syncStatus.value = 'off';
}

export async function syncNow(): Promise<void> {
  const sync = await getSync();
  if (!(await sync.config())) {
    await refreshSyncState();
    return;
  }
  syncStatus.value = 'syncing';
  const r = await sync.syncNow();
  syncStatus.value = r.status;
  unreadable.value = r.unreadable;
  await refreshSyncState();
  if (r.status === 'stopped') syncStatus.value = 'stopped';
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function syncSoon(ms = 2000): void {
  if (!syncOn.peek()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** Called once at start. */
export function startSync(): void {
  void refreshSyncState().then(() => syncSoon(300));
  // Every change is saved on the phone first, then sent a moment later
  effect(() => {
    void data.value;
    syncSoon();
  });
  window.addEventListener('online', () => syncSoon(500));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncSoon(500));
  setInterval(() => document.visibilityState === 'visible' && syncSoon(0), 60_000);
}

/** Take the plan from a sync link. Checks the link first; a wrong link changes nothing on this phone. */
export async function joinSync(syncId: string, key: string): Promise<boolean> {
  pendingJoin.value = null;
  try {
    const r = await (await getSync()).join(syncId, key);
    await refreshSyncState();
    syncStatus.value = r.status;
    unreadable.value = r.unreadable;
    showNotice('info', COPY.syncJoined);
    return true;
  } catch (e) {
    const reason = e instanceof JoinError ? e.reason : 'error';
    showNotice(
      'invalid',
      reason === 'offline' ? COPY.syncOffline : reason === 'needs-code' ? COPY.syncNeedsCode : reason === 'blocked' ? COPY.syncBlocked : COPY.syncLinkBad,
    );
    return false;
  }
}

/** The link another phone shows: opens this app, with everything needed in the # part (never sent to a server). */
export function shareLink(syncId: string, key: string, code: string | null): string {
  const params = new URLSearchParams({ sync: `${syncId}.${key}` });
  if (code) params.set('unlock', code);
  return `${location.origin}/#${params.toString()}`;
}

/** "id.key" from a link, or null when it isn't one. */
export function parseSyncParam(value: string): { syncId: string; key: string } | null {
  const m = /^([A-Za-z0-9_-]{22,64})\.([A-Za-z0-9_-]{43})$/.exec(value.trim());
  return m ? { syncId: m[1]!, key: m[2]! } : null;
}
