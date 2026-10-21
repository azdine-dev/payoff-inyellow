import { describe, expect, it } from 'vitest';
import { deltaPhrase, type WhatIfSummary } from './whatIf';

const money = (n: number) => `$${Math.round(n)}`;
const sum = (p: Partial<WhatIfSummary>): WhatIfSummary => ({ newDate: '2028-08-11', monthsSaved: 2, paydaysSooner: 3, interestSaved: 210.4, nowEnds: false, ...p });

describe('deltaPhrase', () => {
  it('says paydays sooner and interest saved', () => {
    expect(deltaPhrase(sum({}), money)).toBe('3 paydays sooner, $210 less interest');
    expect(deltaPhrase(sum({ paydaysSooner: 1 }), money)).toBe('1 payday sooner, $210 less interest');
  });

  it('says "same date" when the date does not move, and nothing when nothing changes', () => {
    expect(deltaPhrase(sum({ paydaysSooner: 0, interestSaved: 40 }), money)).toBe('same date, $40 less interest');
    expect(deltaPhrase(sum({ paydaysSooner: 0, interestSaved: 0.2, newDate: null }), money)).toBeNull();
  });

  it('says when a plan that never ended now ends', () => {
    expect(deltaPhrase(sum({ nowEnds: true, paydaysSooner: null, interestSaved: 0 }), money)).toBe('gets your plan to an end');
  });
});
