/**
 * Sync between devices. Offline first: every change is saved on the phone at once, and sent when
 * there is a network. There is no queue to lose: each round looks at the stored records, finds the
 * ones that changed since the last round, and sends them. So it doesn't matter which part of the
 * app made the change, or how long the phone was offline.
 *
 * One record per debt / payment / setting. The last change wins, per record (by its time).
 * A deleted record is sent as a delete, so it is deleted everywhere.
 *
 * A round is:  pull (get what changed on the server) then push (send what changed here).
 */
import type { LedgerEntry, PiyDB, SyncConfig } from '../data/db';
import { b64urlDecode } from '../lib/licenseCore';
import { SyncHttpError, SyncNetworkError, syncApi } from './api';
import { decryptJson, encryptJson, importKey, newKey, newSyncId, sha256Hex } from './crypto';
import { canonical, fromPayload, isRecord, ridOf, splitRid, SYNC_STORES, toPayload } from './records';
import type { SyncResult, SyncStatus, WireRecord, WireRecordIn } from './types';

export interface SyncDeps {
  db: PiyDB;
  /** Example: https://api.paidinyellow.com (no trailing slash) */
  baseUrl: string;
  /** The unlock code. Every request carries it. */
  getCode: () => Promise<string | null> | string | null;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Called after records from another phone were saved here, so the screen can reload. */
  onRemoteChange?: () => Promise<void> | void;
  pageSize?: number;
  pushChunk?: number;
}

type Rec = Record<string, unknown> & { id: string; updatedAt: number };
type Dirty = { rid: string; ts: number; deleted: boolean; payload?: Rec; hash: string };

const SYNC_ID = /^[A-Za-z0-9_-]{22,64}$/;

export class JoinError extends Error {
  constructor(public reason: 'link_invalid' | 'offline' | 'needs-code' | 'blocked' | 'error') {
    super(reason);
  }
}

export function createSync(deps: SyncDeps) {
  const { db, baseUrl } = deps;
  const fetchFn = deps.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = deps.now ?? Date.now;
  const pageSize = deps.pageSize ?? 500;
  const pushChunk = deps.pushChunk ?? 200;

  const getConfig = async () => (await db.get('sync', 'config')) as SyncConfig | undefined;
  const saveConfig = (c: SyncConfig) => db.put('sync', { ...c, updatedAt: now() });

  async function getLedger(): Promise<Map<string, LedgerEntry>> {
    const all = (await db.getAll('sync')) as (SyncConfig | LedgerEntry)[];
    return new Map(all.filter((e): e is LedgerEntry => e.id.startsWith('rid:')).map((e) => [e.rid, e]));
  }
  const setLedger = (ledger: Map<string, LedgerEntry>, rid: string, ts: number, hash: string, deleted: boolean) => {
    const entry: LedgerEntry = { id: `rid:${rid}`, updatedAt: now(), rid, ts, hash, deleted };
    ledger.set(rid, entry);
    return db.put('sync', entry);
  };

  async function clearSyncState() {
    await db.clear('sync');
  }

  async function clearLocalPlan() {
    const tx = db.transaction([...SYNC_STORES], 'readwrite');
    await Promise.all(SYNC_STORES.map((s) => tx.objectStore(s).clear()));
    await tx.done;
  }

  // ---------------------------------------------------------------- one record coming in
  async function applyRemote(rec: WireRecordIn, key: CryptoKey, ledger: Map<string, LedgerEntry>): Promise<'applied' | 'skipped' | 'unreadable'> {
    const parts = splitRid(rec.rid);
    if (!parts) return 'skipped'; // a kind of record this version doesn't know
    const { store, id } = parts;
    const local = (await db.get(store, id)) as Rec | undefined;
    const led = ledger.get(rec.rid);
    // A record we deleted here, and haven't told the server yet, counts as newer than anything we are about to receive
    const localTs = local ? local.updatedAt : led ? (led.deleted ? led.ts : Number.POSITIVE_INFINITY) : 0;
    if (rec.ts <= localTs) return 'skipped';

    if (rec.deleted) {
      if (local) await db.delete(store, id);
      await setLedger(ledger, rec.rid, rec.ts, '', true);
      return 'applied';
    }
    if (!rec.iv || !rec.ct) return 'unreadable';
    let payload: unknown;
    try {
      payload = await decryptJson(key, rec.rid, rec.iv, rec.ct);
    } catch {
      return 'unreadable'; // wrong key, or changed on the way
    }
    if (!isRecord(payload) || payload.id !== id) return 'unreadable';
    const saved = { ...fromPayload(store, payload, local), updatedAt: rec.ts };
    await db.put(store, saved as never);
    await setLedger(ledger, rec.rid, rec.ts, await sha256Hex(canonical(toPayload(store, saved))), false);
    return 'applied';
  }

  async function pull(cfg: SyncConfig, key: CryptoKey, api: ReturnType<typeof syncApi>, ledger: Map<string, LedgerEntry>) {
    let since = cfg.since;
    let applied = 0;
    let unreadable = 0;
    for (;;) {
      const page = await api.get(cfg.syncId, since, pageSize);
      for (const rec of page.records) {
        const r = await applyRemote(rec, key, ledger);
        if (r === 'applied') applied++;
        else if (r === 'unreadable') unreadable++;
      }
      since = page.seq;
      await saveConfig({ ...cfg, since });
      cfg.since = since;
      if (!page.more) break;
    }
    if (applied) await deps.onRemoteChange?.();
    return { applied, unreadable };
  }

  // ---------------------------------------------------------------- what changed here
  async function scan(ledger: Map<string, LedgerEntry>): Promise<Dirty[]> {
    const dirty: Dirty[] = [];
    const seen = new Set<string>();
    for (const store of SYNC_STORES) {
      for (const rec of (await db.getAll(store)) as unknown as Rec[]) {
        const rid = ridOf(store, rec.id);
        seen.add(rid);
        const payload = toPayload(store, rec);
        const hash = await sha256Hex(canonical(payload));
        const led = ledger.get(rid);
        if (led && !led.deleted && (led.hash === hash || rec.updatedAt <= led.ts)) continue; // nothing new to send
        if (led?.deleted && rec.updatedAt <= led.ts) continue; // an older copy of something deleted since
        dirty.push({ rid, ts: rec.updatedAt, deleted: false, payload, hash });
      }
    }
    // Deleted here since the last round
    for (const led of ledger.values()) {
      if (!led.deleted && !seen.has(led.rid)) dirty.push({ rid: led.rid, ts: now(), deleted: true, hash: '' });
    }
    return dirty;
  }

  async function push(cfg: SyncConfig, key: CryptoKey, api: ReturnType<typeof syncApi>, ledger: Map<string, LedgerEntry>) {
    const dirty = await scan(ledger);
    for (let i = 0; i < dirty.length; i += pushChunk) {
      const chunk = dirty.slice(i, i + pushChunk);
      const wire: WireRecord[] = await Promise.all(
        chunk.map(async (d) => (d.deleted ? { rid: d.rid, ts: d.ts, deleted: true } : { rid: d.rid, ts: d.ts, ...(await encryptJson(key, d.rid, d.payload)) })),
      );
      await api.put(cfg.syncId, wire);
      for (const d of chunk) await setLedger(ledger, d.rid, d.ts, d.hash, d.deleted);
      if (!cfg.created) {
        cfg.created = true;
        await saveConfig(cfg);
      }
    }
    return dirty.length;
  }

  // ---------------------------------------------------------------- one round
  async function runOnce(): Promise<SyncResult> {
    const result = (status: SyncStatus, extra: Partial<SyncResult> = {}): SyncResult => ({ status, pulled: 0, pushed: 0, unreadable: 0, ...extra });
    const cfg = await getConfig();
    if (!cfg) return result('off');
    const code = await deps.getCode();
    if (!code) return result('needs-code');

    try {
      const key = await importKey(cfg.key);
      const api = syncApi(baseUrl, code, fetchFn);
      const ledger = await getLedger();
      const pulled = cfg.created ? await pull(cfg, key, api, ledger) : { applied: 0, unreadable: 0 };
      const pushed = await push(cfg, key, api, ledger);
      await saveConfig({ ...cfg, lastSyncAt: now() });
      return result('idle', { pulled: pulled.applied, pushed, unreadable: pulled.unreadable });
    } catch (e) {
      if (e instanceof SyncNetworkError) return result('offline');
      if (e instanceof SyncHttpError) {
        if (e.status === 401) return result('needs-code');
        if (e.status === 403) return result('blocked', { detail: e.code });
        if (e.status === 404) {
          // The sync was stopped on another phone. This phone keeps its plan and goes back to being on its own.
          await clearSyncState();
          return result('stopped');
        }
        if (e.status === 429 || e.status >= 500) return result('offline', { detail: e.code }); // try again later
        return result('error', { detail: e.code });
      }
      return result('error', { detail: e instanceof Error ? e.message : 'unknown' });
    }
  }

  // One round at a time. If something asks for another round meanwhile, it runs right after.
  let running: Promise<SyncResult> | null = null;
  let again = false;
  function syncNow(): Promise<SyncResult> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      let r: SyncResult;
      do {
        again = false;
        r = await runOnce();
      } while (again && r.status === 'idle');
      return r;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    syncNow,

    config: getConfig,

    /** First phone: make the id and the key, then send everything. */
    async enable(): Promise<{ syncId: string; key: string }> {
      if (await getConfig()) throw new Error('Sync is already on.');
      if (!(await deps.getCode())) throw new JoinError('needs-code');
      await clearSyncState();
      const cfg: SyncConfig = { id: 'config', updatedAt: now(), syncId: newSyncId(), key: newKey(), since: 0, enabledAt: now(), lastSyncAt: null, created: false };
      await saveConfig(cfg);
      await syncNow();
      return { syncId: cfg.syncId, key: cfg.key };
    },

    /** Another phone: take the plan from the sync. Checks the link first, so a wrong link changes nothing here. */
    async join(syncId: string, keyText: string): Promise<SyncResult> {
      let keyBytes: Uint8Array | null = null;
      try {
        keyBytes = b64urlDecode(keyText);
      } catch {
        keyBytes = null;
      }
      if (!SYNC_ID.test(syncId) || keyBytes?.length !== 32) throw new JoinError('link_invalid');
      const code = await deps.getCode();
      if (!code) throw new JoinError('needs-code');
      try {
        await syncApi(baseUrl, code, fetchFn).get(syncId, 0, 1); // does it exist?
      } catch (e) {
        if (e instanceof SyncNetworkError) throw new JoinError('offline');
        if (e instanceof SyncHttpError) throw new JoinError(e.status === 404 || e.status === 400 ? 'link_invalid' : e.status === 401 ? 'needs-code' : e.status === 403 ? 'blocked' : 'error');
        throw new JoinError('error');
      }
      await clearLocalPlan();
      await clearSyncState();
      await saveConfig({ id: 'config', updatedAt: now(), syncId, key: keyText, since: 0, enabledAt: now(), lastSyncAt: null, created: true });
      return syncNow();
    },

    /**
     * Stop syncing on this phone. With deleteServer, everything stored for this id is deleted from the
     * server first (and if that fails, nothing changes, so the buyer can try again).
     */
    async stop(opts: { deleteServer: boolean }): Promise<void> {
      const cfg = await getConfig();
      if (!cfg) return;
      if (opts.deleteServer) {
        const code = await deps.getCode();
        if (!code) throw new JoinError('needs-code');
        try {
          await syncApi(baseUrl, code, fetchFn).remove(cfg.syncId);
        } catch (e) {
          if (e instanceof SyncNetworkError) throw new JoinError('offline');
          if (!(e instanceof SyncHttpError && e.status === 404)) throw new JoinError('error'); // 404 = already gone
        }
      }
      await clearSyncState();
    },
  };
}

export type SyncEngine = ReturnType<typeof createSync>;
