/** Save the backup file, then remember when. Used by Settings and by the reminder on Today. */
import { backupFilename, buildBackup } from '../data/backup';
import { downloadText } from '../lib/csv';
import { markBackedUp } from './settingsActions';
import { act, getDB } from './store';

export async function downloadBackup(): Promise<void> {
  const file = await buildBackup(await getDB());
  downloadText(backupFilename(), JSON.stringify(file, null, 1), 'application/json');
  await act((db, x) => markBackedUp(db, x));
}
