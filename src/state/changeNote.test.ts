import { describe, expect, it } from 'vitest';
import type { PlanResult } from '../engine';
import { dateMoveSentence } from './changeNote';

const plan = (debtFreeDate: string | null, paydaysToDebtFree: number | null) => ({ debtFreeDate, paydaysToDebtFree }) as PlanResult;

describe('what a change did to the date, in one sentence', () => {
  it('says when it did not move', () => {
    expect(dateMoveSentence(plan('2028-10-06', 52), plan('2028-10-06', 52))).toBe('Your debt-free date didn’t move.');
  });

  it('says how many paydays later or sooner, with the date', () => {
    expect(dateMoveSentence(plan('2028-10-06', 52), plan('2028-10-20', 53))).toBe('Your debt-free date moved 1 payday later (20 Oct 2028).');
    expect(dateMoveSentence(plan('2028-10-06', 52), plan('2028-08-11', 46))).toBe('Your debt-free date moved 6 paydays sooner (11 Aug 2028).');
  });

  it('is calm when the plan stops ending, or starts to', () => {
    expect(dateMoveSentence(plan('2028-10-06', 52), plan(null, null))).toContain('more than 20 years');
    expect(dateMoveSentence(plan(null, null), plan('2030-01-10', 90))).toBe('Your plan now ends on 10 Jan 2030.');
  });
});
