import { describe, expect, it } from 'vitest';
import { ordinal } from './today';

describe('ordinal', () => {
  it('writes 1st, 2nd, 3rd, 4th, and the teens as th', () => {
    const got = [1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 30, 31].map(ordinal);
    expect(got).toEqual(['1st', '2nd', '3rd', '4th', '5th', '10th', '11th', '12th', '13th', '14th', '20th', '21st', '22nd', '23rd', '24th', '30th', '31st']);
  });
});

import { relativeDay } from './today';

describe('relativeDay', () => {
  it('says today, tomorrow, in n days, and calm words for the past', () => {
    expect(relativeDay('2026-10-15', '2026-10-15')).toBe('today');
    expect(relativeDay('2026-10-15', '2026-10-16')).toBe('tomorrow');
    expect(relativeDay('2026-10-15', '2026-10-19')).toBe('in 4 days');
    expect(relativeDay('2026-10-15', '2026-10-14')).toBe('yesterday');
    expect(relativeDay('2026-10-15', '2026-10-12')).toBe('3 days ago');
    expect(relativeDay('2026-12-30', '2027-01-02')).toBe('in 3 days'); // across the new year
  });
});
