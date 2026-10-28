/**
 * Parity with engine_v2.py (the model of the Google Sheet too).
 * Debt-free date exactly; interest and the first four paydays to the cent; the generated fixtures also check
 * the debt left on each of the first 60 paydays.
 */
import { describe, expect, it } from 'vitest';
import fixtures from '../../engine/fixtures_v2.json';
import edge from '../../engine/fixtures_v2_edge.json';
import random from '../../engine/fixtures_v2_random.json';
import { runAsReference, type RefFixture } from './referenceAdapter';

const suites: [string, RefFixture[]][] = [
  ['engine/fixtures_v2.json (the 7 of the Sheet)', fixtures as unknown as RefFixture[]],
  ['engine/fixtures_v2_edge.json', edge as unknown as RefFixture[]],
  ['engine/fixtures_v2_random.json', random as unknown as RefFixture[]],
];

for (const [title, list] of suites) {
  describe(title, () => {
    it('is not empty', () => expect(list.length).toBeGreaterThan(0));
    it.each(list.map((f) => [f.name, f] as const))('%s', (_name, f) => {
      const { owed_60: wantOwed, promo: wantPromo, ...want } = f.expect;
      const { owed_60: gotOwed, promo: gotPromo, ...got } = runAsReference(f.input);
      expect(got).toEqual(want);
      if (wantPromo) expect(gotPromo).toEqual(wantPromo);
      if (wantOwed) expect(gotOwed.slice(0, wantOwed.length)).toEqual(wantOwed);
    });
  });
}

describe('the fixtures of the Sheet', () => {
  it('are all 7 present, and the classic $8,000 at 24% is 56 months and $5,315.34', () => {
    const list = fixtures as unknown as RefFixture[];
    expect(list.map((f) => f.name).slice(0, 7)).toEqual(['karim', 'sara', 'growing_avalanche', 'growing_piy', 'twice_month', 'monthly_custom', 'eight_k']);
    const eight = runAsReference(list.find((f) => f.name === 'eight_k')!.input);
    expect(eight.paydays).toBe(56);
    expect(eight.interest).toBe(5315.34);
  });
});
