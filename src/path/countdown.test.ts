import { describe, expect, it } from 'vitest';
import { countdownText } from './countdown';

describe('countdownText', () => {
  it('says months, or years with one decimal', () => {
    expect(countdownText(14, 'months')).toBe('14 months to go');
    expect(countdownText(14, 'years')).toBe('1.2 years to go');
    expect(countdownText(24, 'years')).toBe('2 years to go');
    expect(countdownText(12, 'years')).toBe('1 year to go');
  });

  it('is calm about the last stretch', () => {
    expect(countdownText(1, 'months')).toBe('1 month to go');
    expect(countdownText(0, 'months')).toBe('Less than a month to go');
    expect(countdownText(0, 'years')).toBe('Less than a month to go');
  });
});
