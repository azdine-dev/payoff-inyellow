import { describe, expect, it } from 'vitest';
import { DRAFT_VERSION, newDraft, resumeStep, SETUP_STEPS, STEP_COUNT, stepNotes, toSetupValues } from './draft';

describe('a wizard draft saved before the four-step setup', () => {
  it('version 1 (welcome, currency, pay, debts, buffer, extra, yearly, order, fresh start) comes back to the same screen', () => {
    expect(resumeStep(0, undefined)).toBe(0); // welcome -> pay (the welcome words are on top of it)
    expect(resumeStep(1, undefined)).toBe(0); // currency -> pay
    expect(resumeStep(2, undefined)).toBe(0); // pay
    expect(resumeStep(3, undefined)).toBe(1); // debts
    expect(resumeStep(4, undefined)).toBe(2); // buffer -> money
    expect(resumeStep(5, undefined)).toBe(2); // extra -> money
    expect(resumeStep(8, undefined)).toBe(2); // fresh start -> money (the last screen)
  });

  it('version 2 (welcome, pay, debts, buffer, extra, yearly, order, fresh start)', () => {
    expect(resumeStep(0, 2)).toBe(0);
    expect(resumeStep(1, 2)).toBe(0);
    expect(resumeStep(2, 2)).toBe(1); // debts
    expect(resumeStep(3, 2)).toBe(2);
    expect(resumeStep(7, 2)).toBe(2);
  });

  it('a new draft keeps its step', () => {
    expect(resumeStep(1, DRAFT_VERSION)).toBe(1);
    expect(resumeStep(2, DRAFT_VERSION)).toBe(2);
  });
});

describe('the four steps', () => {
  it('has three screens to fill in, then the result', () => {
    expect(STEP_COUNT).toBe(3);
    expect(SETUP_STEPS).toBe(4);
  });

  it('step 1 asks for the currency symbol and the schedule', () => {
    const d = { ...newDraft(), currencyCode: '', currencySymbol: '' };
    const notes = stepNotes(0, d, '2026-10-15');
    expect(notes).toContain('Type the symbol you use for money, like $ or €.');
    expect(notes).toContain('Choose how often you get paid.');
  });

  it('step 2 lets the rate stay empty (24% is used and the debt is marked)', () => {
    const d = { ...newDraft(), debts: [{ key: 'a', name: 'Visa', type: '', balance: '3200', apr: '', min: '96', dueDay: '12', autopay: false }] };
    expect(stepNotes(1, d, '2026-10-15')).toEqual([]);
    const v = toSetupValues({ ...d, frequency: 'biweekly', nextPayday: '2026-10-23' });
    expect(v.debts[0]).toMatchObject({ apr: 24, rateMissing: true });
    // a rate that is typed is kept, and the debt is not marked
    const typed = toSetupValues({ ...d, debts: [{ ...d.debts[0]!, apr: '22.9' }], frequency: 'biweekly', nextPayday: '2026-10-23' });
    expect(typed.debts[0]).toMatchObject({ apr: 22.9 });
    expect(typed.debts[0]).not.toHaveProperty('rateMissing');
    // a typo is still asked about
    expect(stepNotes(1, { ...d, debts: [{ ...d.debts[0]!, apr: 'abc' }] }, '2026-10-15').join(' ')).toContain('interest rate');
  });

  it('step 2 needs the due day of a debt that has a minimum, and not of one that has none', () => {
    const d = { ...newDraft(), debts: [{ key: 'a', name: 'Visa', type: '', balance: '3200', apr: '22.9', min: '96', dueDay: '', autopay: false }] };
    expect(stepNotes(1, d, '2026-10-15')).toEqual(['Visa: add the due day. It’s on your statement, and the plan needs it to place the bill.']);
    expect(stepNotes(1, { ...d, debts: [{ ...d.debts[0]!, dueDay: '12' }] }, '2026-10-15')).toEqual([]);
    expect(stepNotes(1, { ...d, debts: [{ ...d.debts[0]!, min: '0' }] }, '2026-10-15')).toEqual([]); // no minimum, no bill
  });

  it('step 3 asks for the buffer goal and the money for the plan', () => {
    const d = { ...newDraft(), bufferGoal: '', extra: '' };
    expect(stepNotes(2, d, '2026-10-15')).toEqual(['Type a goal for your buffer, like 500.', 'Type an amount, even 0. You can change it any time.']);
    expect(stepNotes(2, { ...newDraft(), bufferGoal: '500', extra: '150' }, '2026-10-15')).toEqual([]);
  });

  it('the setup defaults are the ones the old steps chose: PaidInYellow order, start this payday', () => {
    const d = newDraft();
    expect(d.method).toBe('paidinyellow');
    expect(d.startMode).toBe('this-payday');
    expect(d.funds).toEqual([]);
  });
});
