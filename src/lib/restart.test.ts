/** "Restart now" in one tap, and nothing from the host left on the page. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeApplyUpdate } from './restart';

describe('Restart now', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('one tap tells the new version to take over and reloads, even if the browser never says it did', () => {
    const update = vi.fn(async () => undefined);
    const reload = vi.fn();
    const apply = makeApplyUpdate(update, reload, 1000);
    apply();
    expect(update).toHaveBeenCalledWith(true);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a second tap while it runs does nothing', () => {
    const update = vi.fn(async () => undefined);
    const reload = vi.fn();
    const apply = makeApplyUpdate(update, reload, 1000);
    apply();
    apply();
    vi.advanceTimersByTime(5000);
    expect(update).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the update call fails', async () => {
    const reload = vi.fn();
    makeApplyUpdate(async () => Promise.reject(new Error('no worker')), reload, 500)();
    await vi.advanceTimersByTimeAsync(500);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('the service worker settings', () => {
  it('the new version claims the open page, so the restart needs no second tap', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/clientsClaim:\s*true/);
  });
});
