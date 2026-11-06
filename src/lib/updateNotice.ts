/**
 * "An update is ready" on the next app open. When a new version is found while the app runs, the build that was running
 * is written down on this phone. The next time the app opens and that same build is still the one running, the new
 * version is still waiting, so the bar is shown again. Once the new version runs, the note is cleared.
 * Only a build label is kept here. No plan data goes into it.
 */
declare const __BUILD_ID__: string | undefined;

const KEY = 'piy.updatePending';

/** A label that changes with every build. In dev and in tests there is none, so it is "dev". */
export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const defaultStore = (): Store | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

/** A new version was found: write down which build is running now */
export function rememberPendingUpdate(build: string = BUILD_ID, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(KEY, build);
  } catch {
    // blocked storage: the bar still shows this time, just not on the next open
  }
}

/**
 * On app open: true when an update found earlier is still waiting (the build that was running then is the one running now).
 * When a newer build is running, the note is cleared.
 */
export function pendingUpdateOnOpen(build: string = BUILD_ID, store: Store | null = defaultStore()): boolean {
  try {
    const noted = store?.getItem(KEY) ?? null;
    if (noted === null) return false;
    if (noted === build) return true;
    store?.removeItem(KEY);
  } catch {
    // blocked storage: nothing to show
  }
  return false;
}
