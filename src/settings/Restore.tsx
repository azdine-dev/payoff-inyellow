/** "Restore from a backup": pick a file, see what's in it, confirm, replace. */
import { useRef, useState } from 'preact/hooks';
import { BackupError, parseBackup, restoreBackup, summarizeBackup, type BackupFile, type BackupSummary } from '../data/backup';
import { applyAppearance } from '../lib/appearance';
import { shortDate } from '../lib/today';
import { data, getDB, tab, view } from '../state/store';
import { Note, Sheet } from '../ui/controls';

export function RestoreButton(props: { label?: string; class?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ parsed: BackupFile; summary: BackupSummary } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async (e: Event) => {
    const el = e.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    setMsg('');
    if (!f) return;
    try {
      const parsed = parseBackup(await f.text());
      setFile({ parsed, summary: summarizeBackup(parsed) });
    } catch (err) {
      setMsg(err instanceof BackupError ? err.message : 'That file couldn’t be read, so nothing was changed.');
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const restored = await restoreBackup(await getDB(), file.parsed);
      applyAppearance(restored.settings.theme, restored.settings.textSize);
      data.value = restored;
      tab.value = 'today';
      view.value = 'app';
      setFile(null);
    } catch {
      setMsg('Something went wrong and nothing was changed. Try again.');
      setFile(null);
    }
    setBusy(false);
  };

  return (
    <>
      <button type="button" class={props.class ?? 'btn ghost'} onClick={() => input.current?.click()}>
        {props.label ?? 'Restore from a backup'}
      </button>
      <input ref={input} type="file" accept=".json,application/json" class="sr-only" tabIndex={-1} aria-label="Backup file" onChange={pick} />
      {msg && <Note>{msg}</Note>}
      <Sheet open={file !== null} onClose={() => setFile(null)} title="Restore this backup?">
        {file && (
          <>
            <p>
              <b>
                {file.summary.debts} debt{file.summary.debts === 1 ? '' : 's'}
              </b>
              , {file.summary.paydays} payday{file.summary.paydays === 1 ? '' : 's'} logged
              {file.summary.lastPayday ? `, last paid ${shortDate(file.summary.lastPayday)}` : ''}. Saved on {file.summary.exportedAt.slice(0, 10)}.
            </p>
            <p class="muted">This replaces the plan that’s on this phone now.</p>
            <button type="button" class="btn" disabled={busy} onClick={confirm}>
              Restore it
            </button>
            <button type="button" class="link" onClick={() => setFile(null)}>
              Cancel
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
