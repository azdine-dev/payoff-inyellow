/** The three "Do these later" chips: yearly bills, payday reminder, save a backup. Used on the result screen and on Today. */
import { useState } from 'preact/hooks';
import { CheckIcon } from '../ui/controls';
import { downloadBackup } from '../state/backupActions';
import { showNotice } from '../state/notice';
import { data } from '../state/store';
import { LATER_LABELS, laterStatus, ReminderSheet, YearlyBillsSheet, type LaterKey } from './LaterSheets';

const ORDER: LaterKey[] = ['yearly', 'reminder', 'backup'];

export function LaterChips(props: { onlyPending?: boolean }) {
  const d = data.value;
  const [sheet, setSheet] = useState<'yearly' | 'reminder' | null>(null);
  if (!d) return null;
  const status = laterStatus(d);
  const keys = ORDER.filter((k) => !props.onlyPending || !status[k]);
  if (!keys.length) return null;

  const open = async (k: LaterKey) => {
    if (k === 'backup') {
      await downloadBackup();
      showNotice('info', 'Backup saved. Keep the file somewhere safe, like your email or a cloud folder.');
    } else setSheet(k);
  };

  return (
    <>
      <div class="chips" role="group" aria-label="Do these later">
        {keys.map((k) => (
          <button key={k} type="button" class={`chip-later${status[k] ? ' done' : ''}`} onClick={() => void open(k)}>
            {status[k] && <CheckIcon />}
            {LATER_LABELS[k]}
          </button>
        ))}
      </div>
      <YearlyBillsSheet open={sheet === 'yearly'} onClose={() => setSheet(null)} />
      <ReminderSheet open={sheet === 'reminder'} onClose={() => setSheet(null)} />
    </>
  );
}
