import { describe, expect, it } from 'vitest';
import { suggestedRead } from './suggest';

const base = (over: Record<string, unknown> = {}) => ({
  d: { paydays: [{ number: 1, status: 'done' }], debts: [{ status: 'active' }], buffer: { amount: 500 }, settings: { bufferGoal: 500 }, funds: [{}], ...over } as never,
  today: '2026-10-30',
  needsHelp: false,
  read: [] as string[],
});

describe('which read is suggested', () => {
  it('nothing when nothing fits', () => {
    expect(suggestedRead(base())).toBeNull();
  });

  it('a low buffer suggests the buffer read', () => {
    expect(suggestedRead(base({ buffer: { amount: 200 } }))).toBe('buffer');
  });

  it('a debt that is paid suggests the day a debt hits zero, before the buffer', () => {
    expect(suggestedRead(base({ buffer: { amount: 200 }, debts: [{ status: 'paid' }] }))).toBe('debt-zero');
  });

  it('a skipped payday suggests the missed payday read', () => {
    expect(suggestedRead(base({ paydays: [{ number: 1, status: 'done' }, { number: 2, status: 'skipped' }] }))).toBe('missed-payday');
  });

  it('a promo that has not ended suggests the trap read', () => {
    expect(suggestedRead(base({ debts: [{ status: 'active', promoApr: 0, promoEnds: '2027-03-31' }] }))).toBe('promo-trap');
    expect(suggestedRead(base({ debts: [{ status: 'active', promoApr: 0, promoEnds: '2026-01-01' }] }))).toBeNull();
  });

  it('a plan that needs help suggests the last read; no yearly bills suggests the bills read; day one the first read', () => {
    expect(suggestedRead({ ...base(), needsHelp: true })).toBe('not-enough');
    expect(suggestedRead(base({ funds: [] }))).toBe('not-surprises');
    expect(suggestedRead(base({ paydays: [] }))).toBe('smallest-first');
  });

  it('skips a read that was already read and goes to the next one that fits', () => {
    expect(suggestedRead({ ...base({ buffer: { amount: 200 }, funds: [] }), read: ['buffer'] })).toBe('not-surprises');
    expect(suggestedRead({ ...base({ buffer: { amount: 200 } }), read: ['buffer'] })).toBeNull();
  });
});
