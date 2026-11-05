/** The unlock links: /unlock#CODE and the older /#unlock=CODE. The code is always after the #. */
import { describe, expect, it } from 'vitest';
import { isUnlockPath, readLaunch } from './unlockLink';

describe('readLaunch', () => {
  const code = 'UElWMXxwYWNrMXxzaG9waWZ5LTEwNDJ8MjAyNi0xMC0xOQ.c2lnbmF0dXJl';

  it('/unlock#CODE: the part after the # is the code', () => {
    const { params, onUnlockPath } = readLaunch('/unlock', `#${code}`);
    expect(onUnlockPath).toBe(true);
    expect(params.get('unlock')).toBe(code);
    expect(params.get('sync')).toBeNull();
  });

  it('works with a closing slash, and with a sync link after the code', () => {
    const { params } = readLaunch('/unlock/', `#${code}&sync=abc.def`);
    expect(params.get('unlock')).toBe(code);
    expect(params.get('sync')).toBe('abc.def');
  });

  it('the older #unlock=CODE still works on any path', () => {
    const { params, onUnlockPath } = readLaunch('/', `#unlock=${code}`);
    expect(onUnlockPath).toBe(false);
    expect(params.get('unlock')).toBe(code);
    const both = readLaunch('/unlock', `#unlock=${code}&sync=x.y`).params;
    expect(both.get('unlock')).toBe(code);
    expect(both.get('sync')).toBe('x.y');
  });

  it('a bare code on another path is not a code', () => {
    expect(readLaunch('/', `#${code}`).params.get('unlock')).toBeNull();
    expect(isUnlockPath('/unlock')).toBe(true);
    expect(isUnlockPath('/settings/unlock/')).toBe(true);
    expect(isUnlockPath('/unlocked')).toBe(false);
  });

  it('/unlock with nothing after it has no code', () => {
    expect(readLaunch('/unlock', '').params.get('unlock')).toBeNull();
  });
});
