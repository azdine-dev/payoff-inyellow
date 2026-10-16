/** App state as Preact signals, loaded from IndexedDB at start. */
import { computed, effect, signal } from '@preact/signals';
import { simulatePlan } from '../engine';
import { commit, loadAll, openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import type { Draft } from '../setup/draft';
import { verifyCode } from '../lib/license';
import { todayISO } from '../lib/today';
import { syncMilestones } from './milestones';
import { baselineFor, toPlanInput } from './planInput';

export type View = 'loading' | 'setup' | 'result' | 'app';
export type Tab = 'today' | 'plan' | 'debts' | 'progress' | 'money' | 'settings';

export const view = signal<View>('loading');
export const tab = signal<Tab>('today');
export const data = signal<AppData | null>(null);
export const today = signal(todayISO());

/**
 * 'checking' while a stored code is being verified, 'locked' = calculator mode (no valid code),
 * 'unlocked' = the full planner. The check runs on the phone, with no internet.
 */
export type LicenseState = 'checking' | 'locked' | 'unlocked';
export const licenseState = signal<LicenseState>('checking');

/** Set when a calculator-mode user taps "Change my numbers": the wizard starts from these answers. */
export const editSeed = signal<Draft | null>(null);

/** A new version of the app is downloaded and waiting. Applied only when the buyer taps "Restart". */
export const updateReady = signal(false);
export let applyUpdate: () => void = () => location.reload();
export function setApplyUpdate(fn: () => void): void {
  applyUpdate = fn;
}

/** The browser's "install this app" prompt (Android, desktop). iPhone has none. */
export interface InstallPrompt {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const installPrompt = signal<InstallPrompt | null>(null);

/** True when the app runs from the Home Screen (installed). */
export function isInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

let dbPromise: Promise<PiyDB> | null = null;
export function getDB(): Promise<PiyDB> {
  dbPromise ??= openAppDB();
  return dbPromise;
}

/** The whole plan, re-simulated from the current state whenever data changes. */
export const plan = computed(() => (data.value ? simulatePlan(toPlanInput(data.value)) : null));

let actions: Promise<unknown> = Promise.resolve();

/**
 * Runs an action on the current data and shows its result. Actions run one after another, so a
 * quick second tap always starts from what the first one saved.
 */
export function act(fn: (db: PiyDB, current: AppData) => Promise<AppData>): Promise<AppData> {
  const run = actions.then(async () => {
    const next = await fn(await getDB(), data.value!);
    data.value = next;
    return next;
  });
  actions = run.catch(() => undefined);
  return run;
}

export async function boot(): Promise<void> {
  const db = await getDB();
  let loaded = await loadAll(db);
  // Plans made before Progress existed get their starting snapshot now
  if (loaded && !loaded.settings.baseline) {
    loaded = await commit(db, loaded, { settings: { ...loaded.settings, baseline: baselineFor(loaded, todayISO()) } });
  }
  data.value = loaded;
  view.value = loaded ? 'app' : 'setup';
  // Is there a valid unlock code? Checked again whenever the stored code changes.
  effect(() => {
    const code = data.value?.settings.license?.code ?? null;
    if (!code) {
      licenseState.value = 'locked';
      return;
    }
    void verifyCode(code).then((r) => {
      if ((data.peek()?.settings.license?.code ?? null) === code) licenseState.value = r.ok ? 'unlocked' : 'locked';
    });
  });
  // A milestone is saved the moment it's reached, with that day's date
  effect(() => {
    const current = data.value;
    const result = plan.value;
    const day = today.value;
    if (!current || !result || view.value === 'setup') return;
    void syncMilestones(db, current, result, day).then((next) => {
      if (next !== current && data.peek() === current) data.value = next;
    });
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as unknown as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => (installPrompt.value = null));
  // Ask the browser to keep this data (it can otherwise be cleared when storage is low)
  void navigator.storage?.persist?.().catch(() => undefined);
  // Keep "today" right when the app stays open past midnight or comes back from the background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') today.value = todayISO();
  });
}
