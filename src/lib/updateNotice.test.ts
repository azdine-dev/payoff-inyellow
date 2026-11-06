/** "An update is ready" on the next app open: noted while the old build runs, shown again until the new build runs. */
import { describe, expect, it } from 'vitest';
import { pendingUpdateOnOpen, rememberPendingUpdate } from './updateNotice';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

describe('an update that is waiting', () => {
  it('nothing noted, nothing shown', () => {
    expect(pendingUpdateOnOpen('build-1', memory())).toBe(false);
  });

  it('found while build 1 runs: the next opens of build 1 say "An update is ready" again, every time', () => {
    const s = memory();
    rememberPendingUpdate('build-1', s);
    expect(pendingUpdateOnOpen('build-1', s)).toBe(true);
    expect(pendingUpdateOnOpen('build-1', s)).toBe(true); // "Not now" only hides it for that open
  });

  it('once build 2 runs, the note is cleared and nothing is shown', () => {
    const s = memory();
    rememberPendingUpdate('build-1', s);
    expect(pendingUpdateOnOpen('build-2', s)).toBe(false);
    expect(s.m.size).toBe(0);
    expect(pendingUpdateOnOpen('build-1', s)).toBe(false);
  });

  it('only a build label is kept, never plan data, and blocked storage never throws', () => {
    const s = memory();
    rememberPendingUpdate('build-1', s);
    expect([...s.m.values()]).toEqual(['build-1']);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => rememberPendingUpdate('build-1', blocked)).not.toThrow();
    expect(pendingUpdateOnOpen('build-1', blocked)).toBe(false);
  });
});
