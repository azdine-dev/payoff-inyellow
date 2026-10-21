import { describe, expect, it } from 'vitest';
import { DRAFT_VERSION, newDraft, resumeStep, STEP_COUNT, stepNotes } from './draft';

describe('a wizard draft saved before the currency moved', () => {
  it('comes back to the same screen (old: 1 currency, 2 pay, 3 debts, 4 buffer...)', () => {
    expect(resumeStep(0, undefined)).toBe(0); // welcome
    expect(resumeStep(1, undefined)).toBe(1); // currency -> the pay schedule, which now shows it
    expect(resumeStep(2, undefined)).toBe(1); // pay schedule
    expect(resumeStep(3, undefined)).toBe(2); // debts
    expect(resumeStep(8, undefined)).toBe(7); // fresh start
  });

  it('a new draft keeps its step', () => {
    expect(resumeStep(3, DRAFT_VERSION)).toBe(3);
  });
});

describe('the seven steps', () => {
  it('has seven after the welcome', () => {
    expect(STEP_COUNT).toBe(7);
  });

  it('asks for the currency symbol and the schedule on the first step', () => {
    const d = { ...newDraft(), currencyCode: '', currencySymbol: '' };
    const notes = stepNotes(1, d, '2026-10-15');
    expect(notes).toContain('Type the symbol you use for money, like $ or €.');
    expect(notes).toContain('Choose how often you get paid.');
  });
});
