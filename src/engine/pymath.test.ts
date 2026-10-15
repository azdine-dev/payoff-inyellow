import { describe, expect, it } from 'vitest';
import { pyRound, pySum } from './pymath';

describe('pyRound matches Python round()', () => {
  it('rounds exact ties to even', () => {
    // These are exactly representable ties
    expect(pyRound(0.125)).toBe(0.12);
    expect(pyRound(0.375)).toBe(0.38);
    expect(pyRound(2.625)).toBe(2.62);
    expect(pyRound(-0.125)).toBe(-0.12);
    expect(pyRound(2.5, 0)).toBe(2);
    expect(pyRound(3.5, 0)).toBe(4);
  });

  it('uses the exact binary value for near-ties', () => {
    // 2.675 is stored as 2.67499999... so Python gives 2.67
    expect(pyRound(2.675)).toBe(2.67);
    // 1.005 is stored as 1.00499999...
    expect(pyRound(1.005)).toBe(1);
    expect(pyRound(0.285)).toBe(0.28);
    expect(pyRound(14638.0249999)).toBe(14638.02);
  });
});

describe('pySum matches Python 3.12+ sum()', () => {
  it('compensates rounding error', () => {
    expect(pySum([0.1, 0.2, 0.3])).toBe(0.6);
    // Python: sum([1e16, 1.0, -1e16]) == 1.0 (all floats, like every sum in the engine)
    expect(pySum([1e16, 1.0, -1e16])).toBe(1);
    expect(pySum([])).toBe(0);
  });
});
