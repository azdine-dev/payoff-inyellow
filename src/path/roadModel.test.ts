/** The Road, with the Nadia scenario: every 2 weeks from Fri 6 Nov 2026, $150, buffer 200 of 500, Gifts $260 in December. */
import { describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { newDraft, toSetupValues } from '../setup/draft';
import { buildSetupData } from '../state/actions';
import { toPlanInput } from '../state/planInput';
import { progressStats } from '../state/milestones';
import { buildRoad, finishIndexFor } from './roadModel';

const TODAY = '2026-10-30';

function nadia(method: 'paidinyellow' | 'biggest-interest') {
  const draft = {
    ...newDraft(),
    currencyCode: 'USD',
    frequency: 'biweekly' as const,
    nextPayday: '2026-11-06',
    debts: [
      { key: 'a', name: 'Store Card', type: '', balance: '450', apr: '26.99', min: '30', dueDay: '12', autopay: false },
      { key: 'b', name: 'Medical', type: '', balance: '600', apr: '0', min: '50', dueDay: '3', autopay: false },
      { key: 'c', name: 'Visa', type: '', balance: '2200', apr: '22.99', min: '66', dueDay: '20', autopay: false },
    ],
    bufferNow: '200',
    bufferGoal: '500',
    extra: '150',
    funds: [{ key: 'f', name: 'Gifts and holidays', perYear: '260', month: 'December' }],
    method,
  };
  const data = buildSetupData(toSetupValues(draft), TODAY, 1000);
  const r = simulatePlan(toPlanInput(data));
  const stats = progressStats(data);
  const road = buildRoad(data, r, stats.start, stats.pct, TODAY);
  const flag = (name: string) => road.flags.find((f) => f.title === name && f.kind === 'debt');
  return { data, r, road, flag, stats };
}

describe('the Road, Nadia, PaidInYellow order', () => {
  const { road, flag, r } = nadia('paidinyellow');

  it('flags the day each debt reaches zero', () => {
    expect(flag('Store Card')?.date).toBe('2027-01-01');
    expect(flag('Medical')?.date).toBe('2027-02-12');
    expect(flag('Visa')?.date).toBe('2027-07-16');
  });

  it('puts the finish flag on the last payday, which is the last debt', () => {
    expect(r.debtFreeDate?.slice(0, 7)).toBe('2027-07');
    const finish = road.flags.find((f) => f.kind === 'finish')!;
    expect(finish.date).toBe('2027-07-16');
    expect(finish.index).toBe(road.finishIndex);
    expect(flag('Visa')?.merged).toBe(true);
  });

  it('starts with the two pre-filled squares, then the next payday, with the pin there', () => {
    expect(road.squares.slice(0, 2).map((s) => [s.kind, s.label])).toEqual([['start', 'Debts listed'], ['start', 'Plan made']]);
    expect(road.squares[2]).toMatchObject({ kind: 'next', date: '2026-11-06' });
    expect(road.pinIndex).toBe(2);
    expect(road.firstAhead).toBe(2);
  });

  it('has a halfway marker between the start and the finish', () => {
    const half = road.flags.find((f) => f.kind === 'half')!;
    expect(half.index).toBeGreaterThan(road.firstAhead);
    expect(half.index).toBeLessThan(road.finishIndex!);
  });
});

describe('the Road, Nadia, biggest interest first', () => {
  const { road, flag, r, data } = nadia('biggest-interest');

  it('flags Store Card in January, then Visa and Medical in July 2027, Medical last', () => {
    expect(flag('Store Card')?.date).toBe('2027-01-01');
    expect(flag('Visa')?.date?.slice(0, 7)).toBe('2027-07');
    expect(flag('Medical')?.date?.slice(0, 7)).toBe('2027-07');
    expect(flag('Visa')!.date! < flag('Medical')!.date!).toBe(true);
    expect(road.flags.find((f) => f.kind === 'finish')?.date).toBe(flag('Medical')?.date);
  });

  it('avoids $1,203 of interest against minimums only', () => {
    const avoided = r.minimumsOnly.totalInterest! - r.totalInterest;
    expect(Math.round(avoided)).toBe(1203);
    expect(data.settings.method).toBe('biggest-interest');
  });
});

describe('the finish flag preview', () => {
  it('moves to the square a shorter plan would end on', () => {
    const { road, r } = nadia('paidinyellow');
    const sooner = finishIndexFor(road, r.rows.length - 3);
    expect(sooner).toBe(road.finishIndex! - 3);
  });
});

describe('after paydays are done', () => {
  it('draws them as paid squares and moves the pin forward', () => {
    const { data, r, stats } = nadia('paidinyellow');
    const done = { ...data, paydays: [{ id: 'p1', updatedAt: 1, number: 1, date: '2026-11-06', status: 'done', total: 180 }] as never };
    const road = buildRoad(done, r, stats.start, stats.pct, TODAY);
    expect(road.squares[2]).toMatchObject({ kind: 'paid', number: 1 });
    expect(road.pinIndex).toBe(3);
    expect(road.squares[3]!.kind).toBe('next');
  });
});
