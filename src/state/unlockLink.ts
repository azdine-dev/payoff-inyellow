/**
 * Opening  https://app.paidinyellow.com/#unlock=<code>  unlocks the planner. The code is in the
 * part after the #, which the browser never sends to any server. It is taken out of the address
 * bar right away, checked on the phone, and saved with the plan. If there is no plan yet (the
 * buyer opens the link first), it is kept and used when setup is done.
 *
 * A sync link looks like  #sync=<id>.<key>&unlock=<code>  (shown as a QR code by the first phone).
 * The key stays in this part, so it never reaches a server either.
 */
import { saveCarry } from '../data/db';
import { COPY } from '../lib/copy';
import { cleanCode, verifyCode } from '../lib/license';
import { joinSync, parseSyncParam, pendingJoin } from '../sync/controller';
import { showNotice } from './notice';
import { saveLicense } from './settingsActions';
import { act, data, getDB } from './store';

export async function handleLaunchFragment(): Promise<void> {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const raw = params.get('unlock');
  const syncRaw = params.get('sync');
  if (raw === null && syncRaw === null) return;

  // Take them out of the address bar first, so they are not shared or kept in history by accident
  params.delete('unlock');
  params.delete('sync');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + location.search + (rest ? `#${rest}` : ''));

  let codeOk = raw === null;
  if (raw !== null) {
    const code = cleanCode(raw);
    const result = await verifyCode(code);
    if (!result.ok) {
      showNotice('invalid', result.reason === 'empty' ? COPY.codeEmpty : COPY.codeRefused);
    } else {
      codeOk = true;
      if (data.value) {
        await act((db, current) => saveLicense(db, current, code));
        showNotice('unlocked', COPY.unlocked);
      } else {
        await saveCarry(await getDB(), { license: { code, activatedAt: Date.now() } });
        showNotice('saved', COPY.codeSaved);
      }
    }
  }
  if (syncRaw === null || !codeOk) return;

  const link = parseSyncParam(syncRaw);
  if (!link) {
    showNotice('invalid', COPY.syncLinkBad);
    return;
  }
  // A phone that already has a plan asks first: joining replaces it
  if (data.value) pendingJoin.value = link;
  else await joinSync(link.syncId, link.key);
}
