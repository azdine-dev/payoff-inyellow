import { describe, expect, it } from 'vitest';
import { roomLeft } from './Money';

describe('"Help me work it out"', () => {
  it('is take-home minus essentials minus the debt minimums spread over the paychecks', () => {
    // $466 a month of minimums, every 2 weeks: 466 x 12 / 26 = 215.08 per paycheck
    expect(roomLeft(900, 400, 466, 26)).toBeCloseTo(900 - 400 - 215.0769, 3);
    expect(roomLeft(900, 400, 0, 26)).toBe(500);
  });

  it('can be nothing, or below nothing, and a missing schedule counts no minimums', () => {
    expect(roomLeft(600, 500, 466, 26)).toBeLessThan(0);
    expect(roomLeft(900, 400, 466, null)).toBe(500);
  });
});
