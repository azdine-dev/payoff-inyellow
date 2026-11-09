/** The app asks for updates by itself: at start, when it comes back to the screen, and every 30 minutes. */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHECK_EVERY_MS, startUpdateChecks } from './updateCheck';
import { buildDateText, versionText } from './version';

function fakePage(state = 'visible') {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState: state,
    addEventListener: (t: string, fn: () => void) => void (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(fn),
    removeEventListener: (t: string, fn: () => void) => void listeners.get(t)?.delete(fn),
    fire: (t: string) => listeners.get(t)?.forEach((fn) => fn()),
    count: (t: string) => listeners.get(t)?.size ?? 0,
  };
}

describe('asking for updates', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks once at start', async () => {
    const reg = { update: vi.fn(async () => undefined) };
    startUpdateChecks(reg, { doc: fakePage() });
    await vi.advanceTimersByTimeAsync(0);
    expect(reg.update).toHaveBeenCalledTimes(1);
  });

  it('asks again each time the app comes back to the screen, not when it goes away', async () => {
    const reg = { update: vi.fn(async () => undefined) };
    const page = fakePage();
    startUpdateChecks(reg, { doc: page });
    await vi.advanceTimersByTimeAsync(0);
    page.visibilityState = 'hidden';
    page.fire('visibilitychange');
    await vi.advanceTimersByTimeAsync(0);
    expect(reg.update).toHaveBeenCalledTimes(1);
    page.visibilityState = 'visible';
    page.fire('visibilitychange');
    await vi.advanceTimersByTimeAsync(0);
    expect(reg.update).toHaveBeenCalledTimes(2);
  });

  it('asks every 30 minutes', async () => {
    expect(CHECK_EVERY_MS).toBe(30 * 60 * 1000);
    const reg = { update: vi.fn(async () => undefined) };
    startUpdateChecks(reg, { doc: fakePage() });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    expect(reg.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(reg.update).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(reg.update).toHaveBeenCalledTimes(3);
  });

  it('one question at a time, and a failed one (no signal) does not stop the next', async () => {
    let finish: () => void = () => undefined;
    const reg = {
      update: vi
        .fn()
        .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(undefined),
    };
    const page = fakePage();
    startUpdateChecks(reg, { doc: page });
    await vi.advanceTimersByTimeAsync(0);
    page.fire('visibilitychange'); // the first question is still open
    await vi.advanceTimersByTimeAsync(0);
    expect(reg.update).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    page.fire('visibilitychange'); // this one fails
    await vi.advanceTimersByTimeAsync(0);
    page.fire('visibilitychange'); // and the next one still goes out
    await vi.advanceTimersByTimeAsync(0);
    expect(reg.update).toHaveBeenCalledTimes(3);
  });

  it('can be stopped', async () => {
    const reg = { update: vi.fn(async () => undefined) };
    const page = fakePage();
    const stop = startUpdateChecks(reg, { doc: page });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(page.count('visibilitychange')).toBe(0);
    await vi.advanceTimersByTimeAsync(2 * CHECK_EVERY_MS);
    page.fire('visibilitychange');
    expect(reg.update).toHaveBeenCalledTimes(1);
  });
});

describe('the server is asked again for the pages that say which version is current', () => {
  const headers = readFileSync('public/_headers', 'utf8');
  const block = (path: string) => {
    const lines = headers.split('\n');
    const at = lines.findIndex((l) => l.trim() === path);
    return at < 0 ? '' : lines.slice(at + 1, at + 3).join('\n');
  };
  it('sw.js and index.html are served with Cache-Control: no-cache', () => {
    expect(block('/sw.js')).toMatch(/Cache-Control:\s*no-cache/);
    expect(block('/index.html')).toMatch(/Cache-Control:\s*no-cache/);
    expect(block('/')).toMatch(/Cache-Control:\s*no-cache/);
  });
  it('the safety header for every page is still there', () => {
    expect(block('/*')).toMatch(/Content-Security-Policy/);
  });
});

describe('which version this phone runs', () => {
  it('writes the day and month of the build, and the year only when it is another year', () => {
    const now = new Date('2026-11-15T10:00:00');
    expect(buildDateText('2026-11-09T12:00:00', now)).toBe('9 Nov');
    expect(buildDateText('2025-03-02T12:00:00', now)).toBe('2 Mar 2025');
    expect(buildDateText(null, now)).toBe('');
    expect(buildDateText('not a date', now)).toBe('');
  });
  it('Version 1.0.4 · 9 Nov', () => {
    expect(versionText('1.0.4', '2026-11-09T12:00:00', new Date('2026-11-15T10:00:00'))).toBe('Version 1.0.4 · 9 Nov');
    expect(versionText('dev', null)).toBe('Version dev');
  });
});
