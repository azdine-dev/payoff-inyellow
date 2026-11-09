/** The one read Today suggests: missed payday, then buffer used, then a debt almost gone, then the first payday. */
import { describe, expect, it } from 'vitest';
import type { PaydayLog } from '../data/types';
import { readForToday, type TodayReadInput } from './todayRead';

const log = (number: number, date: string, status: 'done' | 'skipped' = 'done') => ({ number, date, status }) as PaydayLog;
const base = (over: Partial<TodayReadInput> = {}): TodayReadInput => ({
  d: {
    paydays: [log(1, '2026-11-06'), log(2, '2026-11-20')],
    debts: [{ status: 'active' }] as never,
    buffer: { amount: 500, history: [] } as never,
    settings: { bufferGoal: 500 } as never,
    funds: [{}] as never,
  },
  today: '2026-11-21',
  missed: 0,
  focusPct: 10,
  needsHelp: false,
  read: [],
  ...over,
});

describe('which read Today suggests', () => {
  it('a missed payday comes first', () => {
    expect(readForToday(base({ missed: 1 }))).toBe('missed-payday');
    const skipped = base();
    skipped.d.paydays.push(log(3, '2026-12-04', 'skipped'));
    expect(readForToday(skipped)).toBe('missed-payday');
  });

  it('then buffer money used since the last payday', () => {
    const used = base();
    used.d.buffer = { amount: 300, history: [{ date: '2026-11-22', amount: -200 }] as never } as never;
    expect(readForToday(used)).toBe('buffer');
    expect(readForToday({ ...used, missed: 1 })).toBe('missed-payday'); // a missed payday still wins
    // used before the last payday: not news any more
    const old = base();
    old.d.buffer = { amount: 500, history: [{ date: '2026-11-10', amount: -200 }] as never } as never;
    expect(readForToday(old)).not.toBe('buffer');
  });

  it('then a debt that is almost gone', () => {
    expect(readForToday(base({ focusPct: 80 }))).toBe('debt-zero');
    expect(readForToday(base({ focusPct: 74.9 }))).not.toBe('debt-zero');
    expect(readForToday(base({ focusPct: null }))).not.toBe('debt-zero');
  });

  it('then the first payday', () => {
    const first = base();
    first.d.paydays = [log(1, '2026-11-06')];
    expect(readForToday(first)).toBe('smallest-first');
    const none = base();
    none.d.paydays = [];
    expect(readForToday(none)).toBe('smallest-first');
  });

  it('skips a read that was read, and falls back to the usual suggestion when none of the four fits', () => {
    expect(readForToday(base({ focusPct: 80, read: ['debt-zero'] }))).not.toBe('debt-zero');
    const buffer = base();
    buffer.d.buffer = { amount: 100, history: [] } as never;
    expect(readForToday(buffer)).toBe('buffer'); // the usual suggestion: the buffer is below its goal
    expect(readForToday(base())).toBeNull(); // the buffer is full, there are yearly bills, a payday is done: nothing to suggest
  });

  it('nothing when everything that fits was read', () => {
    expect(readForToday(base({ missed: 1, focusPct: 90, read: ['missed-payday', 'debt-zero', 'smallest-first', 'buffer'] }))).toBeNull();
  });
});
