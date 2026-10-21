import { describe, expect, it } from 'vitest';
import { statusText } from './StatusLine';

describe('the header line on every tab', () => {
  it('says the month and the paydays left', () => {
    expect(statusText('2028-10-06', 49, true)).toBe('Debt-free Oct 2028 · 49 paydays left');
    expect(statusText('2026-11-20', 1, true)).toBe('Debt-free Nov 2026 · 1 payday left');
  });

  it('says it kindly when the plan is long, and when every debt is paid', () => {
    expect(statusText(null, null, true)).toBe('More than 20 years at this pace');
    expect(statusText(null, 0, false)).toBe('Debt-free');
  });
});
