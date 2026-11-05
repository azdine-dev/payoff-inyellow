/**
 * After the first "I did it": one calm card that asks for the two things that keep the plan safe, because the plan
 * lives only on this phone. Add it to the home screen, and save a backup. It goes away when both are done, or on "Not now".
 */
import { useState } from 'preact/hooks';
import { getSafeDismissed, setSafeDismissed } from '../lib/seen';
import { downloadBackup } from '../state/backupActions';
import { showNotice } from '../state/notice';
import { data, installPrompt, isInstalled, settingsSheet, tab } from '../state/store';

export function SafeCard() {
  const d = data.value;
  const [hidden, setHidden] = useState(getSafeDismissed());
  if (!d || hidden) return null;
  if (!d.paydays.some((p) => p.status === 'done')) return null;
  const installed = isInstalled();
  const backedUp = d.settings.lastBackupAt !== null;
  if (installed && backedUp) return null;

  return (
    <section class="card calm stack" style={{ gap: 8 }} aria-label="Keep your plan safe" data-testid="safe-card">
      <p>Add PaidInYellow to your home screen and save a backup, so your plan stays safe.</p>
      <div class="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        {!installed && (
          <button
            type="button"
            class="btn small"
            onClick={async () => {
              if (installPrompt.value) {
                await installPrompt.value.prompt();
                installPrompt.value = null;
              } else {
                settingsSheet.value = 'install';
                tab.value = 'settings';
              }
            }}
          >
            Add to home screen
          </button>
        )}
        {!backedUp && (
          <button
            type="button"
            class="btn small"
            onClick={async () => {
              await downloadBackup();
              showNotice('info', 'Backup saved. Keep the file somewhere safe, like your email or a cloud folder.');
            }}
          >
            Save a backup
          </button>
        )}
        <button
          type="button"
          class="link small"
          onClick={() => {
            setSafeDismissed();
            setHidden(true);
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
