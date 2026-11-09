/** The back button closes the sub-screen on top, one at a time, and the app closing a screen leaves the history clean. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** A tiny browser history: entries, a position, and a back() that answers a moment later with popstate */
function fakeBrowser() {
  const entries: unknown[] = [null];
  let at = 0;
  const listeners: (() => void)[] = [];
  const history = {
    get state() {
      return entries[at];
    },
    pushState(state: unknown) {
      entries.splice(at + 1);
      entries.push(state);
      at++;
    },
    replaceState(state: unknown) {
      entries[at] = state;
    },
    back() {
      if (at === 0) return;
      queueMicrotask(() => {
        at--;
        listeners.forEach((fn) => fn());
      });
    },
  };
  const window = { addEventListener: (t: string, fn: () => void) => void (t === 'popstate' && listeners.push(fn)) };
  return {
    history,
    window,
    pressBack: async () => {
      history.back();
      await Promise.resolve();
      await Promise.resolve();
    },
    position: () => at,
  };
}

let b: ReturnType<typeof fakeBrowser>;
let stack: typeof import('./backStack');

beforeEach(async () => {
  vi.resetModules();
  b = fakeBrowser();
  vi.stubGlobal('history', b.history);
  vi.stubGlobal('window', b.window);
  stack = await import('./backStack');
  stack.startBackStack();
});

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('layers and the back button', () => {
  it('opening a screen adds one history entry, and back closes it', async () => {
    const closed = vi.fn();
    stack.pushLayer(closed);
    expect(b.position()).toBe(1);
    await b.pressBack();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(b.position()).toBe(0);
    expect(stack.openLayers()).toBe(0);
  });

  it('two screens close one at a time, the top one first', async () => {
    const order: string[] = [];
    stack.pushLayer(() => order.push('list'));
    stack.pushLayer(() => order.push('read'));
    await b.pressBack();
    expect(order).toEqual(['read']);
    await b.pressBack();
    expect(order).toEqual(['read', 'list']);
  });

  it('a screen the app closes itself takes its entry away, so the next back press is not wasted', async () => {
    const dismiss = stack.pushLayer(() => undefined);
    dismiss();
    await settle();
    expect(b.position()).toBe(0);
    expect(stack.openLayers()).toBe(0);
    // and the back button after that does not close anything that is not there
    const later = vi.fn();
    stack.pushLayer(later);
    await b.pressBack();
    expect(later).toHaveBeenCalledTimes(1);
  });

  it('closing one screen and opening another in the same moment keeps the history in step', async () => {
    const dismiss = stack.pushLayer(() => undefined); // a sheet closes ...
    dismiss();
    const second = vi.fn();
    stack.pushLayer(second); // ... and another opens at once
    await settle();
    expect(b.position()).toBe(1); // one entry, for the second screen
    await b.pressBack();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('closed by the back button, the dismiss that follows does nothing more', async () => {
    let dismiss: () => void = () => undefined;
    dismiss = stack.pushLayer(() => dismiss()); // like a component that closes, then cleans up
    await b.pressBack();
    await settle();
    expect(b.position()).toBe(0);
  });

  it('a screen closed under another one leaves its entry, and going back over it does nothing', async () => {
    const lower = vi.fn();
    const top = vi.fn();
    const dismissLower = stack.pushLayer(lower);
    stack.pushLayer(top);
    dismissLower(); // closed by the app while another screen is on top
    await b.pressBack();
    expect(top).toHaveBeenCalledTimes(1);
    await b.pressBack(); // the entry of the closed one
    expect(lower).not.toHaveBeenCalled();
    expect(b.position()).toBe(0);
  });

  it('an entry left over from before a reload is cleared at start', async () => {
    vi.resetModules();
    const c = fakeBrowser();
    c.history.pushState({ piyLayer: true });
    vi.stubGlobal('history', c.history);
    vi.stubGlobal('window', c.window);
    const fresh = await import('./backStack');
    fresh.startBackStack();
    expect(c.history.state).toBeNull();
  });
});
