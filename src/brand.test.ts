/**
 * Brand rules from CLAUDE.md §2-3, checked on every source file:
 * no red anywhere, no em or en dashes in copy, no loan or transfer advice, no promises.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : [];
  });
}

const src = files(join(__dirname));
const read = (p: string) => readFileSync(p, 'utf8');

/** A hex color is "red" when red is strong and green and blue are both well below it. */
function isRed(hex: string): boolean {
  const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  return r > 150 && g < r * 0.55 && b < r * 0.55;
}

describe('brand rules', () => {
  it('finds the source files', () => expect(src.length).toBeGreaterThan(10));

  it('uses no red color', () => {
    for (const f of src) {
      const text = read(f);
      expect(text, f).not.toMatch(/\b(red|crimson|darkred|firebrick|tomato)\b\s*[;'"]/i);
      for (const hex of text.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []) expect(isRed(hex), `${f}: ${hex}`).toBe(false);
    }
  });

  it('has no em or en dashes', () => {
    for (const f of src) expect(read(f), f).not.toMatch(/[\u2013\u2014]/);
  });

  it('never suggests borrowing, and makes no promises', () => {
    const banned = /balance transfer|consolidat|payday loan|debt settlement|0% card|refinanc|guarantee|100%\s+(guaranteed|safe|sure|certain|free|works)/i;
    for (const f of src.filter((p) => !p.endsWith('.css'))) expect(read(f), f).not.toMatch(banned);
  });
});
