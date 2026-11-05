/**
 * Opening  https://app.paidinyellow.com/unlock#<code>  (or the older  /#unlock=<code>)  unlocks the planner. The code is in the
 * part after the #, which the browser never sends to any server. It is taken out of the address
 * bar right away, checked on the phone, and saved with the plan. If there is no plan yet (the
 * buyer opens the link first), it is kept and used when setup is done.
 *
 * A sync link looks like  #sync=<id>.<key>&unlock=<code>  (shown as a QR code by the first phone).
 * The key stays in this part, so it never reaches a server either.
 *
 * On /unlock the part after the # can be just the code, or the code first and more after an &, like  /unlock#<code>&sync=<id>.<key>.
 * Only the word /unlock is ever sent to the server, never the code.
 */
import { saveCarry } from '../data/db';
import { COPY } from '../lib/copy';
import { cleanCode, verifyCode } from '../lib/license';
import { joinSync, parseSyncParam, pendingJoin } from '../sync/controller';
import { showNotice } from './notice';
import { saveLicense } from './settingsActions';
import { act, data, getDB } from './store';

/** True on /unlock (with or without a closing slash) */
export const isUnlockPath = (pathname: string) => /\/unlock\/?$/.test(pathname);

/** The launch values in an address: the code, the sync link, and whatever else is in the part after the #. */
export function readLaunch(pathname: string, hash: string): { params: URLSearchParams; onUnlockPath: boolean } {
  const text = hash.replace(/^#/, '');
  const onUnlockPath = isUnlockPath(pathname);
  // /unlock#<code>: the first part is the code itself, unless it is a name=value pair
  if (onUnlockPath && text && !/^[a-z]+=/i.test(text)) {
    const [code, ...more] = text.split('&');
    const params = new URLSearchParams(more.join('&'));
    params.set('unlock', code!);
    return { params, onUnlockPath };
  }
  return { params: new URLSearchParams(text), onUnlockPath };
}

export async function handleLaunchFragment(): Promise<void> {
  const { params, onUnlockPath } = readLaunch(location.pathname, location.hash);
  const raw = params.get('unlock');
  const syncRaw = params.get('sync');
  if (raw === null && syncRaw === null) {
    // /unlock opened with no code: just go home
    if (onUnlockPath) history.replaceState(null, '', '/' + location.search);
    return;
  }

  // Take them out of the address bar first, so they are not shared or kept in history by accident
  params.delete('unlock');
  params.delete('sync');
  const rest = params.toString();
  const path = onUnlockPath ? '/' : location.pathname;
  history.replaceState(null, '', path + location.search + (rest ? `#${rest}` : ''));

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
