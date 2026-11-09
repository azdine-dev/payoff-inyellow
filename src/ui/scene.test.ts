/** The scene: how many squares are yellow, the road curve, and the stages. */
import { describe, expect, it } from 'vitest';
import { sceneStage, smoothPath, yellowSquares } from './Scene';

describe('yellow squares follow the real share paid', () => {
  it('two come pre-filled, then about one per 8% paid, never all twelve before the end', () => {
    expect(yellowSquares(1, 0)).toBe(2);
    expect(yellowSquares(1, 14)).toBe(2);
    expect(yellowSquares(2, 26)).toBe(3);
    expect(yellowSquares(3, 52)).toBe(6);
    expect(yellowSquares(4, 80)).toBe(10);
    expect(yellowSquares(4, 99.9)).toBe(11); // the last square is the finish
    expect(yellowSquares(5, 100)).toBe(12);
  });

  it('without the exact share it uses the stage', () => {
    expect([1, 2, 3, 4, 5].map((s) => yellowSquares(s as 1 | 2 | 3 | 4 | 5))).toEqual([2, 4, 6, 9, 12]);
    expect(yellowSquares(2, Number.NaN)).toBe(4);
  });

  it('the stage still comes from the share: 25, 50, 75 and all', () => {
    expect([0, 24.9, 25, 49.9, 50, 74.9, 75, 99.9].map((p) => sceneStage(p))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(sceneStage(100)).toBe(5);
    expect(sceneStage(10, false)).toBe(5);
  });
});

describe('the road curve', () => {
  it('passes through every point, in order, as one smooth path', () => {
    const d = smoothPath([[0, 0], [10, 5], [20, 4], [30, 12]]);
    expect(d.startsWith('M0 0 C')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(3);
    expect(d.endsWith('30 12')).toBe(true);
    expect(smoothPath([[1, 1]])).toBe('');
  });
});
