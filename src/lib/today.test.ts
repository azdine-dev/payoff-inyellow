import { describe, expect, it } from 'vitest';
import { ordinal } from './today';

describe('ordinal', () => {
  it('writes 1st, 2nd, 3rd, 4th, and the teens as th', () => {
    const got = [1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24, 30, 31].map(ordinal);
    expect(got).toEqual(['1st', '2nd', '3rd', '4th', '5th', '10th', '11th', '12th', '13th', '14th', '20th', '21st', '22nd', '23rd', '24th', '30th', '31st']);
  });
});
