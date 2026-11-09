/**
 * An installed app can stay open or asleep for days, and the browser only looks for a new version now and then.
 * So the app asks itself: once when it starts, every time it comes back to the screen, and every 30 minutes.
 * An answer of "no new version" costs almost nothing. Offline, the question just fails and is forgotten.
 */
export const CHECK_EVERY_MS = 30 * 60 * 1000;

interface Registration {
  update: () => Promise<unknown>;
}

interface Listener {
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

export interface UpdateCheckOptions {
  intervalMs?: number;
  /** The page, for "came back to the screen" */
  doc?: Listener & { visibilityState?: string };
  /** Where timers run */
  timers?: { setInterval: (fn: () => void, ms: number) => unknown; clearInterval: (id: unknown) => void };
}

/** Starts asking for updates. Returns a function that stops it. */
export function startUpdateChecks(registration: Registration, opts: UpdateCheckOptions = {}): () => void {
  const doc = opts.doc ?? (typeof document === 'undefined' ? undefined : document);
  const timers = opts.timers ?? { setInterval: (fn, ms) => setInterval(fn, ms), clearInterval: (id) => clearInterval(id as number) };
  let asking = false;
  const check = () => {
    if (asking) return; // one question at a time
    asking = true;
    Promise.resolve()
      .then(() => registration.update())
      .catch(() => undefined) // no signal, or the server is busy: ask again later
      .finally(() => {
        asking = false;
      });
  };
  const onVisible = () => {
    if (doc?.visibilityState === undefined || doc.visibilityState === 'visible') check();
  };
  check(); // at start
  doc?.addEventListener('visibilitychange', onVisible);
  const id = timers.setInterval(check, opts.intervalMs ?? CHECK_EVERY_MS);
  return () => {
    doc?.removeEventListener('visibilitychange', onVisible);
    timers.clearInterval(id);
  };
}
