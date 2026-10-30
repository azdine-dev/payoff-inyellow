/** Contrast of every text / background pair in both themes (WCAG: 4.5 for body text, 3 for large text and UI). */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;

function block(selector: RegExp): Record<string, string> {
  const m = css.match(selector);
  if (!m) throw new Error('no block ' + selector);
  const out: Record<string, string> = {};
  for (const d of m[1]!.matchAll(/--([a-z-]+):\s*([^;]+?);/g)) out[d[1]!] = d[2]!.replace(/\s*\/\*.*$/, '').trim();
  return out;
}

const light = block(/:root \{([\s\S]*?)\n\}/);
const darkOverrides = block(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/);
const mediaDark = block(/:root:not\(\[data-theme\]\) \{([\s\S]*?)\n  \}/);

function theme(over: Record<string, string>) {
  const t = { ...light, ...over };
  const resolve = (v: string): string => (v.startsWith('var(') ? resolve(t[v.slice(6, -1)]!) : v);
  const color = (name: string): Rgb => {
    const v = resolve(t[name]!);
    return hex(v);
  };
  const rgba = (name: string): { rgb: Rgb; a: number } => {
    const m = resolve(t[name]!).match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)!;
    return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) };
  };
  return { color, rgba };
}

const over = (fg: Rgb, a: number, bg: Rgb): Rgb => fg.map((c, i) => Math.round(c * a + bg[i]! * (1 - a))) as Rgb;
const lum = ([r, g, b]: Rgb) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

function pairs(t: ReturnType<typeof theme>) {
  const c = t.color;
  const row = t.rgba('row-bg');
  const rowOnCalm = over(row.rgb, row.a, c('calm'));
  const rowOnCard = over(row.rgb, row.a, c('card'));
  const list: [string, Rgb, Rgb, number][] = [
    ['ink on paper', c('ink'), c('paper'), 4.5],
    ['ink on card', c('ink'), c('card'), 4.5],
    ['ink on calm', c('ink'), c('calm'), 4.5],
    ['ink on calm band', c('ink'), c('calm-band'), 4.5],
    ['ink on a row inside calm', c('ink'), rowOnCalm, 4.5],
    ['ink on a row inside a card', c('ink'), rowOnCard, 4.5],
    ['ink at 85% on calm (card notes)', over(c('ink'), 0.85, c('calm')), c('calm'), 4.5],
    ['gray on paper', c('gray'), c('paper'), 4.5],
    ['gray on card', c('gray'), c('card'), 4.5],
    ['gray on calm', c('gray'), c('calm'), 4.5],
    ['gray on calm band', c('gray'), c('calm-band'), 4.5],
    ['gray on a row inside calm', c('gray'), rowOnCalm, 4.5],
    ['button text on action', c('on-action'), c('action'), 4.5],
    ['link (action) on paper', c('action'), c('paper'), 4.5],
    ['link (action) on card', c('action'), c('card'), 4.5],
    ['link (action) on calm', c('action'), c('calm'), 4.5],
    ['link (action) on calm band', c('action'), c('calm-band'), 4.5],
    ['text on yellow', c('on-yellow'), c('yellow'), 4.5],
    ['text on soft yellow', c('ink'), c('yellow-soft'), 4.5],
    ['chip text on ink', c('on-ink'), c('ink'), 4.5],
    ['ink hairline-free button edge (action vs paper)', c('action'), c('paper'), 3],
  ];
  return list;
}

describe.each([
  ['light', {}],
  ['dark', darkOverrides],
] as const)('%s theme', (_name, over) => {
  const t = theme(over);
  for (const [label, fg, bg, min] of pairs(t)) {
    it(`${label}: at least ${min}:1`, () => {
      const r = ratio(fg, bg);
      expect(r, `${label} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
    });
  }
});

describe('yellow on sage', () => {
  // Yellow and sage are close in lightness (about 1.1:1 in the light theme), so yellow never relies on color alone there
  const base = readFileSync('src/styles/base.css', 'utf8');
  it('a ticked box and a Paid label inside the payday card keep an ink edge', () => {
    expect(base).toMatch(/\.pc-rows \.check\[aria-checked='true'\] \.box \{[^}]*border-color: var\(--ink\)/);
    expect(base).toMatch(/\.payday-card \.tag\.paid \{[^}]*border-color: var\(--ink\)/);
  });
});

describe('the "match my phone" dark block equals the dark theme', () => {
  it('has the same tokens', () => {
    const a = { ...darkOverrides };
    const b = { ...mediaDark };
    delete a['color-scheme'];
    delete b['color-scheme'];
    expect(b).toEqual(a);
  });
});

describe('the tokens from brand/design-tokens-v2.md', () => {
  it('are the ones in the CSS', () => {
    expect(light['paper']).toBe('#f8f6f0');
    expect(light['card']).toBe('#ffffff');
    expect(light['calm']).toBe('#e6efe8');
    expect(light['calm-band']).toBe('#d8e7dc');
    expect(light['action']).toBe('#2f4a6d');
    expect(light['ink']).toBe('#1f2a44');
    expect(light['yellow']).toBe('#ffe14d');
    expect(darkOverrides['pc-bg']).toBe('#24332b');
  });
});
