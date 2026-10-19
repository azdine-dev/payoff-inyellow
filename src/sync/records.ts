/** Which stored records are synced, and how a record becomes a synced record and back. */
import type { SyncStore } from './types';

/** One synced record per debt, payment, charge, setting... (not the wizard draft, not the sync settings). */
export const SYNC_STORES: readonly SyncStore[] = ['settings', 'debts', 'payments', 'charges', 'buffer', 'funds', 'paydays', 'milestones', 'findMoney'];

export const ridOf = (store: SyncStore, id: string) => `${store}/${id}`;

export function splitRid(rid: string): { store: SyncStore; id: string } | null {
  const i = rid.indexOf('/');
  const store = rid.slice(0, i) as SyncStore;
  return i > 0 && SYNC_STORES.includes(store) ? { store, id: rid.slice(i + 1) } : null;
}

/** Settings that belong to one phone, not to the plan. Dark mode on one phone must not change another. */
const DEVICE_ONLY = ['theme', 'textSize', 'lastBackupAt', 'license'] as const;

type Rec = Record<string, unknown> & { id: string; updatedAt: number };

/** What is sent for a record (the same record, minus this phone's own preferences). */
export function toPayload(store: SyncStore, record: Rec): Rec {
  if (store !== 'settings') return record;
  const copy = { ...record };
  for (const k of DEVICE_ONLY) delete copy[k];
  return copy;
}

/** What is saved for a record that came in. This phone keeps its own preferences. */
export function fromPayload(store: SyncStore, payload: Rec, local: Rec | undefined): Rec {
  if (store !== 'settings') return payload;
  return {
    ...payload,
    theme: local?.theme ?? 'auto',
    textSize: local?.textSize ?? 1,
    lastBackupAt: local?.lastBackupAt ?? null,
    license: local?.license ?? null,
  };
}

/** The same JSON text for the same record, whatever order the keys were made in. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function isRecord(value: unknown): value is Rec {
  return !!value && typeof value === 'object' && typeof (value as Rec).id === 'string' && Number.isFinite((value as Rec).updatedAt);
}
