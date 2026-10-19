/** Settings: sync between devices (optional), and the sheet that asks before a plan is replaced by a synced one. */
import { useEffect, useState } from 'preact/hooks';
import { renderSVG } from 'uqr';
import { backupFilename, buildBackup } from '../data/backup';
import { loadCarry } from '../data/db';
import { downloadText } from '../lib/csv';
import { shortDate } from '../lib/today';
import { data, getDB, licenseState } from '../state/store';
import { getSync, joinSync, lastSyncAt, pendingJoin, refreshSyncState, shareLink, syncNow, syncOn, syncStatus, unreadable } from '../sync/controller';
import { JoinError } from '../sync/engine';
import { Note, Sheet } from '../ui/controls';

const STATUS_TEXT: Record<string, string> = {
  idle: 'Up to date.',
  syncing: 'Syncing...',
  offline: 'No connection. Your changes are safe here and go out when you are back online.',
  'needs-code': 'Sync needs your unlock code.',
  blocked: 'Sync is turned off for this code. Your plan on this phone is untouched.',
  stopped: 'Sync was stopped on another phone. Your plan stays here.',
  error: 'Sync hit a problem. It will try again.',
  off: '',
};

export function SyncSection() {
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshSyncState();
  }, []);

  if (licenseState.value !== 'unlocked') return null;

  const turnOn = async () => {
    setBusy(true);
    setMsg('');
    try {
      await (await getSync()).enable();
      await refreshSyncState();
      await syncNow();
    } catch (e) {
      setMsg(e instanceof JoinError && e.reason === 'needs-code' ? 'Sync needs your unlock code.' : 'Couldn’t turn sync on. Try again.');
    }
    setBusy(false);
  };

  const showLink = async () => {
    const cfg = await (await getSync()).config();
    if (!cfg) return;
    const code = data.peek()?.settings.license?.code ?? (await loadCarry(await getDB()))?.license?.code ?? null;
    setLink(shareLink(cfg.syncId, cfg.key, code));
  };

  const stop = async () => {
    setBusy(true);
    try {
      await (await getSync()).stop({ deleteServer: true });
      await refreshSyncState();
      setConfirmStop(false);
      setLink(null);
      setMsg('Sync is off and your synced data was deleted from the server. Your plan stays on this phone.');
    } catch (e) {
      setMsg(e instanceof JoinError && e.reason === 'offline' ? 'No connection, so nothing was deleted yet. Try again when you are online.' : 'Something went wrong and sync is still on. Try again.');
      setConfirmStop(false);
    }
    setBusy(false);
  };

  const last = lastSyncAt.value;
  return (
    <section class="card stack" aria-labelledby="set-sync" data-testid="sync-section">
      <h2 id="set-sync">Sync between devices</h2>
      {!syncOn.value ? (
        <>
          <p class="muted">
            Optional. Use your plan on a second phone. Your numbers are locked on this phone before they are sent, and the key stays with you, so the server can’t read them. Without sync, nothing leaves this device.
          </p>
          <button type="button" class="btn ghost" disabled={busy} onClick={turnOn}>
            Turn on sync
          </button>
        </>
      ) : (
        <>
          <p data-testid="sync-status">{STATUS_TEXT[syncStatus.value] || 'Sync is on.'}</p>
          {last && <p class="small muted">Last synced {shortDate(new Date(last).toISOString().slice(0, 10))}.</p>}
          {unreadable.value > 0 && <Note>Some records couldn’t be unlocked. The link may have been copied wrong.</Note>}
          <button type="button" class="btn ghost" onClick={() => syncNow()}>
            Sync now
          </button>
          <button type="button" class="btn ghost" onClick={showLink}>
            Add another phone
          </button>
          {link && (
            <div class="stack" data-testid="sync-link-box">
              <p class="muted small">
                On the other phone, scan this code with the camera, or open the link. It holds the key to your plan, so keep it between you and the people you trust.
              </p>
              <div
                style={{ background: '#fff', padding: 12, borderRadius: 12, alignSelf: 'center', width: 240 }}
                dangerouslySetInnerHTML={{ __html: renderSVG(link, { ecc: 'L', border: 0 }) }}
              />
              <input type="text" readOnly value={link} aria-label="Sync link" onFocus={(e) => (e.target as HTMLInputElement).select()} data-testid="sync-link" />
            </div>
          )}
          <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmStop(true)}>
            Stop syncing and delete my server data
          </button>
        </>
      )}
      {msg && <Note>{msg}</Note>}
      <Sheet open={confirmStop} onClose={() => setConfirmStop(false)} title="Stop syncing?">
        <p>Your synced copy is deleted from the server and your other phones stop syncing. The plan on this phone stays.</p>
        <button type="button" class="btn" disabled={busy} onClick={stop}>
          Stop syncing and delete
        </button>
        <button type="button" class="link" onClick={() => setConfirmStop(false)}>
          Cancel
        </button>
      </Sheet>
    </section>
  );
}

/** Opening a sync link on a phone that already has a plan: say clearly that the plan will be replaced. */
export function JoinSheet() {
  const p = pendingJoin.value;
  const [busy, setBusy] = useState(false);
  const backup = async () => downloadText(backupFilename(), JSON.stringify(await buildBackup(await getDB()), null, 1), 'application/json');
  return (
    <Sheet open={p !== null} onClose={() => (pendingJoin.value = null)} title="Use the synced plan?">
      <p>This phone already has a plan. Joining replaces it with the synced plan. If you want to keep this one, save a backup first.</p>
      <button type="button" class="btn ghost" onClick={backup}>
        Save a backup first
      </button>
      <button
        type="button"
        class="btn"
        disabled={busy}
        onClick={async () => {
          if (!p) return;
          setBusy(true);
          await joinSync(p.syncId, p.key);
          setBusy(false);
        }}
      >
        Replace with the synced plan
      </button>
      <button type="button" class="link" onClick={() => (pendingJoin.value = null)}>
        Cancel
      </button>
    </Sheet>
  );
}
