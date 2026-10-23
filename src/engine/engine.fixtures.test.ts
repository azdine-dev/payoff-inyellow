/**
 * Parity with the reference engine (and so with the Google Sheet).
 * Dates must match exactly; amounts to the cent.
 */
import { describe, expect, it } from 'vitest';
import fixtures from '../../engine/fixtures.json';
import edge from '../../engine/fixtures-edge.json';
import random from '../../engine/fixtures-random.json';
import { runAsReference, type RefFixture } from './referenceAdapter';

const suites: [string, RefFixture[]][] = [
  ['engine/fixtures.json (checked against the Sheet)', fixtures as unknown as RefFixture[]],
  ['engine/fixtures-edge.json', edge as unknown as RefFixture[]],
  ['engine/fixtures-random.json', random as unknown as RefFixture[]],
];

for (const [title, list] of suites) {
  describe(title, () => {
    it('is not empty', () => expect(list.length).toBeGreaterThan(0));
    it.each(list.map((f) => [f.name, f] as const))('%s', (_name, f) => {
      expect(runAsReference(f.input)).toEqual(f.expected);
    });
  });
}

describe('the brief fixtures (the 6 of the brief and the no-due-day one)', () => {
  it('are all present', () => expect((fixtures as unknown as RefFixture[]).length).toBe(7));
});
