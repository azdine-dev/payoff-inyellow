import { describe, expect, it } from 'vitest';
import { ROTATING_NOTES, STATE_NOTES } from '../copy/notes';
import type { PaydayLog } from '../data/types';
import { pickNote } from './payNote';

const words = (s: string) => s.trim().split(/\s+/).length;
const log = (number: number, date: string, status: 'done' | 'skipped' = 'done') => ({ number, date, status }) as PaydayLog;
const base = { paydays: [] as PaydayLog[], debts: [] as never[], payments: [] as never[], milestones: [] as never[], buffer: { history: [] as { date: string; amount: number }[] } };

describe('the lines', () => {
  const all = [...Object.values(STATE_NOTES), ...ROTATING_NOTES];

  it('there are 30 rotating lines and 5 for what just happened', () => {
    expect(ROTATING_NOTES).toHaveLength(30);
    expect(Object.keys(STATE_NOTES)).toHaveLength(5);
    expect(new Set(ROTATING_NOTES).size).toBe(30);
  });

  it('every line has 12 words or fewer', () => {
    for (const line of all) expect(words(line), line).toBeLessThanOrEqual(12);
  });

  it('no exclamation marks, no dashes or hyphens, no hype, no shame', () => {
    for (const line of all) {
      expect(line, line).not.toMatch(/[!—–-]/);
      expect(line.toLowerCase(), line).not.toMatch(/amazing|incredible|crush|smash|guarantee|never fail|you failed|lazy|behind schedule|shame/);
    }
  });

  it('says the lines Azeddin gave, word for word', () => {
    expect(STATE_NOTES.firstPayday).toBe('First square. The hardest one is behind you.');
    expect(STATE_NOTES.bufferUsed).toBe('That’s what it was for. Nothing went on a card.');
    expect(STATE_NOTES.afterSkip).toBe('Life happens. Never miss twice.');
    expect(STATE_NOTES.debtPaid).toBe('PAID. One down.');
    expect(STATE_NOTES.halfway).toBe('Halfway. You did this with paychecks, not luck.');
  });
});

describe('which note shows', () => {
  it('day one, before any payday, is the first payday note', () => {
    expect(pickNote(base)).toEqual({ kind: 'firstPayday', text: STATE_NOTES.firstPayday });
  });

  it('a debt just paid comes first, then halfway, then the rest', () => {
    const d = { ...base, paydays: [log(1, '2026-11-06')] };
    expect(pickNote(d, { freshPaidDebt: true, freshHalfway: true }).kind).toBe('debtPaid');
    expect(pickNote(d, { freshHalfway: true }).kind).toBe('halfway');
    const paid = { ...d, debts: [{ id: 'a', status: 'paid' }] as never, payments: [{ debtId: 'a', paydayNumber: 1, date: '2026-11-06' }] as never };
    expect(pickNote(paid).kind).toBe('debtPaid');
    const half = { ...d, milestones: [{ id: 'pct-50', reachedOn: '2026-11-06' }] as never };
    expect(pickNote(half).kind).toBe('halfway');
  });

  it('after the first payday the buffer note, then the skip note, then a rotating line', () => {
    const two = { ...base, paydays: [log(1, '2026-11-06'), log(2, '2026-11-20')] };
    expect(pickNote(two).kind).toBe('rotating');
    const used = { ...two, buffer: { history: [{ date: '2026-11-22', amount: -200 }] } };
    expect(pickNote(used)).toEqual({ kind: 'bufferUsed', text: STATE_NOTES.bufferUsed });
    const skipped = { ...base, paydays: [log(1, '2026-11-06'), log(2, '2026-11-20'), log(3, '2026-12-04', 'skipped')] };
    expect(pickNote(skipped)).toEqual({ kind: 'afterSkip', text: STATE_NOTES.afterSkip });
  });

  it('the rotating line is the same all payday and moves on at the next one', () => {
    const at = (n: number) => pickNote({ ...base, paydays: Array.from({ length: n }, (_, i) => log(i + 1, `2026-12-${String(i + 1).padStart(2, '0')}`)) });
    expect(at(4)).toEqual(at(4));
    expect(at(4).text).not.toBe(at(5).text);
    expect(at(4).kind).toBe('rotating');
    // it cycles through all 30 lines
    expect(new Set(Array.from({ length: 30 }, (_, i) => at(i + 3).text)).size).toBe(30);
  });
});
