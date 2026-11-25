import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { openAppDB } from '../data/db';
import { eraseEverything } from '../data/erase';
import { captureSource, readSource } from './source';

/** localStorage, the address and the history of one device */
function device(search = '', pathname = '/', hash = '') {
  const saved = new Map<string, string>();
  const store = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v) };
  const where = { pathname, search, hash };
  const urls: string[] = [];
  const history = { state: { piyLayer: 0 }, replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void urls.push(String(url)) };
  return { saved, store, where, history, urls };
}

describe('where the buyer came from', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('?from=etsy is saved, and the query leaves the address bar', () => {
    const d = device('?from=etsy');
    expect(captureSource(d.where, d.history, d.store)).toBe('etsy');
    expect(d.saved.get('piy.source')).toBe('etsy');
    expect(d.urls).toEqual(['/']);
  });

  it('other parts of the address stay as they were', () => {
    const d = device('?from=etsy&x=1', '/unlock', '#CODE');
    captureSource(d.where, d.history, d.store);
    expect(d.urls).toEqual(['/unlock?x=1#CODE']);
  });

  it('a reload, or a home screen launch, with no query keeps it', () => {
    const d = device('?from=etsy');
    captureSource(d.where, d.history, d.store);
    const later = { pathname: '/', search: '', hash: '' };
    expect(captureSource(later, d.history, d.store)).toBe('etsy');
    expect(readSource(d.store)).toBe('etsy');
    expect(d.urls).toHaveLength(1); // nothing more to take out of the address
  });

  it('"Erase everything" keeps it, like the unlock code', async () => {
    const d = device('?from=etsy');
    (globalThis as { localStorage?: unknown }).localStorage = d.store;
    captureSource(d.where, d.history, d.store);
    const db = await openAppDB('source-erase');
    await eraseEverything(db, null);
    await eraseEverything(db, { theme: 'dark', textSize: 1, license: { code: 'PIY1.a.b', activatedAt: 1 } });
    expect(readSource()).toBe('etsy');
  });

  it('no query, or any other value, changes nothing', () => {
    for (const search of ['', '?from=shop', '?from=ETSY', '?x=etsy']) {
      const d = device(search);
      expect(captureSource(d.where, d.history, d.store)).toBeNull();
      expect(d.saved.size).toBe(0);
      expect(d.urls).toEqual([]); // the address is left alone
    }
  });

  it('blocked storage: it still counts for this visit, and nothing breaks', () => {
    const d = device('?from=etsy');
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(captureSource(d.where, d.history, blocked)).toBe('etsy');
    expect(readSource(blocked)).toBeNull();
  });
});
