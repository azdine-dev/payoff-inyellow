import { describe, expect, it } from 'vitest';
import type { PaydayLog } from '../data/types';
import { CAPTIONS, miniChartModel } from './balanceSeries';

const log = (number: number, debtLeft: number, status: 'done' | 'skipped' = 'done') => ({ number, status, debtLeft, date: `2026-11-${String(number).padStart(2, '0')}` }) as PaydayLog;
const rows = (...left: number[]) => left.map((debtLeft) => ({ debtLeft })) as never;
const plan = (r: number[], free = '2027-07-16') => ({ rows: rows(...r), debtFreeDate: free }) as never;

describe('the balance chart, one point per payday', () => {
  it('day one: the line starts at today\'s total and goes down to zero, with the day one caption', () => {
    const m = miniChartModel({ paydays: [] }, plan([3000, 2000, 1000, 0]), { start: 3250, owed: 3250 });
    expect(m.line.map((p) => [p.i, p.y])).toEqual([[0, 3250], [1, 3000], [2, 2000], [3, 1000], [4, 0]]);
    expect(m.here).toEqual({ i: 0, y: 3250 });
    expect(m.paid).toEqual([]);
    expect(m.endsAtZero).toBe(true);
    expect(m.caption).toBe('dayOne');
    expect(CAPTIONS.dayOne).toBe('Day one. Your line starts here.');
  });

  it('after a payday: a paid point, you are on it, and the caption says it is lower', () => {
    const m = miniChartModel({ paydays: [log(1, 3000)] }, plan([2000, 1000, 0]), { start: 3250, owed: 3000 });
    expect(m.line.map((p) => [p.i, p.y])).toEqual([[0, 3250], [1, 3000], [2, 2000], [3, 1000], [4, 0]]);
    expect(m.paid).toHaveLength(1);
    expect(m.here).toEqual({ i: 1, y: 3000 });
    expect(m.caption).toBe('lower');
    expect(CAPTIONS.lower).toBe('Lower than last payday.');
  });

  it('two paydays done: two paid points, the second is where you are, and a skipped payday is not a point', () => {
    const m = miniChartModel({ paydays: [log(1, 3000), log(2, 2000), log(3, 0, 'skipped')] }, plan([1000, 0]), { start: 3250, owed: 2000 });
    expect(m.paid.map((p) => p.i)).toEqual([1, 2]);
    expect(m.here.i).toBe(2);
    expect(m.caption).toBe('lower');
  });

  it('a new charge makes it higher, with a calm caption, and no change says the same', () => {
    const up = miniChartModel({ paydays: [log(1, 3000), log(2, 2000)] }, plan([1000, 0]), { start: 3250, owed: 3100 });
    expect(up.caption).toBe('higher');
    expect(CAPTIONS.higher).not.toMatch(/[!]/);
    const same = miniChartModel({ paydays: [log(1, 3000), log(2, 3000)] }, plan([1000, 0]), { start: 3250, owed: 3000 });
    expect(same.caption).toBe('same');
  });

  it('extra money on day one lowers where you are but keeps the starting point', () => {
    const m = miniChartModel({ paydays: [] }, plan([2000, 0]), { start: 3250, owed: 2800 });
    expect(m.line[0]).toEqual({ i: 0, y: 3250 });
    expect(m.here.y).toBe(2800);
    expect(m.caption).toBe('dayOne');
  });

  it('with no debt-free date the line does not claim to reach zero', () => {
    const m = miniChartModel({ paydays: [] }, { rows: rows(3000, 2900), debtFreeDate: null } as never, { start: 3250, owed: 3250 });
    expect(m.endsAtZero).toBe(false);
    expect(m.line[m.line.length - 1]!.y).toBeGreaterThan(0);
  });
});
