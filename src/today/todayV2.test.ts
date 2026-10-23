/** ux-v2.md sections 3 and 4: the sentences and helpers behind the new Today. */
import { describe, expect, it } from 'vitest';
import type { PaydayLog } from '../data/types';
import { afterPaySentence, betweenPaydays, dailyCostLastMonth, focusSentence } from './model';

const log = (number: number, date: string, status: 'done' | 'skipped', dailyCost?: number) => ({ number, date, status, dailyCost }) as PaydayLog;

describe('focusSentence', () => {
  it('says how many paydays are left after today', () => {
    expect(focusSentence(64.9, 1)).toBe('64% gone. After today, one payday left.');
    expect(focusSentence(10, 5)).toBe('10% gone. After today, 5 paydays left.');
    expect(focusSentence(90, 0)).toBe('90% gone. This payday pays it off.');
    expect(focusSentence(3, null)).toContain('Not gone within 20 years');
  });
});

describe('afterPaySentence', () => {
  it('names what is left, and where the freed money rolls', () => {
    const focus = { name: 'Store Card', left: '$35', goneBy: '2026-12-04' };
    expect(afterPaySentence(focus, 0, { amount: '$16.15', to: 'Visa' })).toBe('Store Card has $35 left. It’s gone next payday. Then its $16.15 rolls to Visa.');
    expect(afterPaySentence(focus, 3, null)).toBe('Store Card has $35 left. It’s gone by December 2026.');
    expect(afterPaySentence(null, null, null)).toContain('debt-free');
  });
});

describe('betweenPaydays', () => {
  const data = { paydays: [log(3, '2026-10-23', 'done')] };
  it('is true only when the last payday is done and the next is still ahead', () => {
    expect(betweenPaydays(data as never, '2026-11-06', 4, '2026-10-24')).toBe(true);
    expect(betweenPaydays(data as never, '2026-11-06', 4, '2026-11-06')).toBe(false);
    expect(betweenPaydays(data as never, '2026-11-06', 5, '2026-10-24')).toBe(false);
  });
});

describe('dailyCostLastMonth', () => {
  it('uses the payday done about a month ago, and nothing before that exists', () => {
    expect(dailyCostLastMonth({ paydays: [] }, '2026-10-23')).toBeNull();
    expect(dailyCostLastMonth({ paydays: [log(1, '2026-09-25', 'done', 6.1)] }, '2026-10-23')).toBe(6.1);
    expect(dailyCostLastMonth({ paydays: [log(1, '2026-10-16', 'done', 6.1)] }, '2026-10-23')).toBeNull(); // too recent
  });
});
