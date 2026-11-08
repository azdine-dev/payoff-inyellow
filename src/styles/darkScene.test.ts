/** The dark scene reads as a calm night: lighter hills than the sky, and a soft sun that can be seen. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/base.css', 'utf8').replace(/\r\n/g, '\n');
const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
/** The declarations inside the first `{ }` that follows `selector` */
const block = (selector: string) => {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`no ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
};
const token = (b: string, name: string) => {
  const m = b.match(new RegExp('--' + name + ':\\s*([^;]+);'));
  if (!m) throw new Error(`no --${name}`);
  return m[1]!.trim();
};

describe('the dark scene', () => {
  const dark = block(":root[data-theme='dark'] .scene {");
  const near = block(":root[data-theme='dark'] .scene-5 {");
  const phone = block(':root:not([data-theme]) .scene {');

  it('hills are about #2E4537 and #3A5544, lighter than the night sky', () => {
    expect(token(dark, 'sc-h1')).toBe('#2e4537');
    expect(token(dark, 'sc-h2')).toBe('#3a5544');
    expect(ratio(token(dark, 'sc-h1'), token(dark, 'sc-sky'))).toBeGreaterThanOrEqual(1.3);
    expect(ratio(token(dark, 'sc-h2'), token(dark, 'sc-sky'))).toBeGreaterThanOrEqual(1.6);
    expect(ratio(token(dark, 'sc-h2'), token(dark, 'sc-h1'))).toBeGreaterThanOrEqual(1.15); // the two hills can be told apart
  });

  it('the sun is yellow-soft at about 35% opacity', () => {
    expect(token(dark, 'sc-sun')).toBe('rgba(255, 246, 194, 0.35)');
  });

  it('the near stages keep a little more light, and "match my phone" has the same colors', () => {
    expect(token(near, 'sc-h1')).toBe('#34503f');
    expect(token(near, 'sc-h2')).toBe('#416150');
    for (const name of ['sc-sky', 'sc-sun', 'sc-h1', 'sc-h2']) expect(token(phone, name), name).toBe(token(dark, name));
  });
});
