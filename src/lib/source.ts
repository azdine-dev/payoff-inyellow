/**
 * Where the buyer came from. The Etsy "Open me first" PDF opens the app with  ?from=etsy . That is saved on this device
 * as  piy.source = "etsy"  and taken out of the address bar, so it does not show in screenshots. A home screen launch
 * has no query string, so the saved value is what counts from then on. "Erase everything" keeps it, like the unlock
 * code (erase only clears the plan's database, never this). Any other value, or none, changes nothing.
 *
 * Etsy does not allow pointing its buyers to buy the same item somewhere else, so for them the app shows no shop link
 * and no support email (see isEtsy and the unlock card).
 */
import { signal } from '@preact/signals';

const KEY = 'piy.source';
export const ETSY = 'etsy';
export type Source = typeof ETSY | null;

type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Where = Pick<Location, 'pathname' | 'search' | 'hash'>;
type History = Pick<globalThis.History, 'replaceState' | 'state'>;

const defaultStore = (): Store | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // storage blocked (a private window): the app works as for any other buyer
  }
};

/** The saved source, or null */
export function readSource(store: Store | null = defaultStore()): Source {
  try {
    return store?.getItem(KEY) === ETSY ? ETSY : null;
  } catch {
    return null;
  }
}

/**
 * On load: ?from=etsy is saved and removed from the address bar (the rest of the address stays as it was).
 * Returns the source that counts now: the one just saved, or the one saved before.
 */
export function captureSource(
  where: Where | null = globalThis.location ?? null,
  history: History | null = globalThis.history ?? null,
  store: Store | null = defaultStore(),
): Source {
  if (!where) return readSource(store);
  const params = new URLSearchParams(where.search);
  if (params.get('from') !== ETSY) return readSource(store);
  try {
    store?.setItem(KEY, ETSY);
  } catch {
    // blocked storage: it still counts for this visit
  }
  params.delete('from');
  const rest = params.toString();
  history?.replaceState(history.state, '', where.pathname + (rest ? `?${rest}` : '') + where.hash);
  return ETSY;
}

/** The source for the screens. Set once at start (main.tsx). */
export const source = signal<Source>(null);
export const isEtsy = () => source.value === ETSY;
