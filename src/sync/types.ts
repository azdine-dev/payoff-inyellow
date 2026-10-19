export type SyncStore = 'settings' | 'debts' | 'payments' | 'charges' | 'buffer' | 'funds' | 'paydays' | 'milestones' | 'findMoney';

/** Where sync stands, for the Settings screen. */
export type SyncStatus =
  | 'off'
  | 'idle' // up to date
  | 'syncing'
  | 'offline' // no network or the server is busy: changes are safe here and go out later
  | 'needs-code' // sync needs the unlock code
  | 'blocked' // the code is on the revoked list (refund)
  | 'stopped' // sync was stopped on another phone
  | 'error';

export interface SyncResult {
  status: SyncStatus;
  pulled: number;
  pushed: number;
  /** Records that could not be unlocked (wrong key or changed on the way) */
  unreadable: number;
  detail?: string;
}

/** The record format on the wire (see worker/src/sync.ts). */
export interface WireRecord {
  rid: string;
  ts: number;
  deleted?: boolean;
  iv?: string;
  ct?: string;
}

export interface WireRecordIn extends WireRecord {
  seq: number;
}
