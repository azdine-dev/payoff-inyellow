/**
 * Opening  https://app.paidinyellow.com/#unlock=<code>  unlocks the planner. The code is in the
 * part after the #, which the browser never sends to any server. It is taken out of the address
 * bar right away, checked on the phone, and saved with the plan. If there is no plan yet (the
 * buyer opens the link first), it is kept and used when setup is done.
 */
import { saveCarry } from '../data/db';
import { COPY } from '../lib/copy';
import { cleanCode, verifyCode } from '../lib/license';
import { showNotice } from './notice';
import { saveLicense } from './settingsActions';
import { act, data, getDB } from './store';

export async function handleLaunchFragment(): Promise<void> {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const raw = params.get('unlock');
  if (raw === null) return;

  // Take the code out of the address bar first, so it is not shared or kept in history by accident
  params.delete('unlock');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + location.search + (rest ? `#${rest}` : ''));

  const code = cleanCode(raw);
  const result = await verifyCode(code);
  if (!result.ok) {
    showNotice('invalid', result.reason === 'empty' ? COPY.codeEmpty : COPY.codeRefused);
    return;
  }
  if (data.value) {
    await act((db, current) => saveLicense(db, current, code));
    showNotice('unlocked', COPY.unlocked);
  } else {
    await saveCarry(await getDB(), { license: { code, activatedAt: Date.now() } });
    showNotice('saved', COPY.codeSaved);
  }
}
