import { describe, expect, it } from 'vitest';
import { focusSentence, goneShare } from './model';

describe('how much of a debt is gone', () => {
  it('is 0% to 100%, never below zero', () => {
    expect(goneShare({ balance: 450, startBalance: 450 })).toEqual({ pct: 0, grown: false });
    expect(goneShare({ balance: 225, startBalance: 450 })).toEqual({ pct: 50, grown: false });
    expect(goneShare({ balance: 0, startBalance: 450 }).pct).toBe(100);
    expect(goneShare({ balance: 0, startBalance: 0 }).pct).toBe(0);
  });

  it('a balance that has grown is 0%, and says so, so no "gone" text is shown', () => {
    const g = goneShare({ balance: 500, startBalance: 450 });
    expect(g.pct).toBe(0);
    expect(g.grown).toBe(true);
    expect(Object.is(g.pct, -0)).toBe(false);
  });
});

describe('the focus sentence', () => {
  it('has the "gone" part for a normal debt', () => {
    expect(focusSentence(64.9, 3)).toBe('64% gone. After today, 3 paydays left.');
    expect(focusSentence(0, 4, false)).toBe('0% gone. 5 paydays left.');
  });

  it('drops the "gone" part when the balance has grown', () => {
    expect(focusSentence(null, 3)).toBe('After today, 3 paydays left.');
    expect(focusSentence(null, 0, false)).toBe('The next payday pays it off.');
    expect(focusSentence(null, null)).toBe('Not gone within 20 years at this pace.');
    expect(focusSentence(null, 3)).not.toMatch(/%/);
  });
});
