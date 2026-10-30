/** Labels on Coming up: Bill, then Paid once a payday covered it, or "Not paid yet" once its date passed. */
import { describe, expect, it } from 'vitest';
import type { PaydayLog } from '../data/types';
import { billPaid, billState, comingUp, prevDueDate } from './model';
import { countdownParts } from './DebtFreeCard';
import { roadDone } from '../ui/Road';

const debt = (id: string, name: string, dueDay: number, minMonthly = 50) => ({ id, name, status: 'active', dueDay, minMonthly, autopay: false });
const done = (number: number, date: string, bills: PaydayLog['bills'] = []) => ({ number, date, status: 'done', bills }) as PaydayLog;

describe('prevDueDate', () => {
  it('is the last due date before today, clamped to the month end', () => {
    expect(prevDueDate(12, '2026-10-15')).toBe('2026-10-12');
    expect(prevDueDate(12, '2026-10-12')).toBe('2026-09-12');
    expect(prevDueDate(30, '2027-03-05')).toBe('2027-02-28');
  });
});

describe('comingUp states', () => {
  const visa = debt('v', 'Visa', 12);
  const store = debt('s', 'Store card', 28);

  it('marks a bill as paid once a done payday carried it', () => {
    const data = { debts: [visa], paydays: [done(1, '2026-10-09', [{ debtId: 'v', name: 'Visa', amount: 50, due: '2026-10-12' }])] };
    expect(billPaid(data, 'v', '2026-10-12')).toBe(true);
    expect(comingUp(data as never, '2026-10-10').map((i) => [i.name, i.state])).toEqual([['Visa', 'paid']]);
  });

  it('says "late" for a bill past its date that no payday paid, in the last 14 days', () => {
    const data = { debts: [store], paydays: [done(1, '2026-10-09')] };
    const items = comingUp(data as never, '2026-10-30');
    expect(items.find((i) => i.date === '2026-10-28')?.state).toBe('late');
  });

  it('never opens on "late" before the first payday is done', () => {
    const data = { debts: [store], paydays: [] };
    expect(comingUp(data as never, '2026-10-30').some((i) => i.state === 'late')).toBe(false);
  });

  it('leaves out a bill older than 14 days and a debt without a minimum', () => {
    expect(comingUp({ debts: [store], paydays: [done(1, '2026-09-01')] } as never, '2026-11-20').some((i) => i.state === 'late')).toBe(false);
    expect(comingUp({ debts: [debt('z', 'Zero', 28, 0)], paydays: [done(1, '2026-10-09')] } as never, '2026-10-30').some((i) => i.state === 'late')).toBe(false);
  });
});

describe('the countdown card', () => {
  it('splits months into years and months', () => {
    expect(countdownParts(19)).toEqual({ years: 1, months: 7 });
    expect(countdownParts(24)).toEqual({ years: 2, months: 0 });
    expect(countdownParts(0)).toEqual({ years: 0, months: 0 });
  });

  it('turns more road squares yellow as more of the debt is gone', () => {
    expect(roadDone(0)).toBe(1);
    expect(roadDone(50)).toBeGreaterThan(roadDone(10));
    expect(roadDone(99)).toBe(7);
    expect(roadDone(100)).toBe(8);
  });
});

describe('billState', () => {
  const store = { id: 's', minMonthly: 50 };
  it('is paid, late or upcoming', () => {
    const data = { paydays: [done(1, '2026-10-09', [{ debtId: 's', name: 'Store card', amount: 50, due: '2026-10-12' }])] };
    expect(billState(data, store, '2026-10-12', '2026-10-30')).toBe('paid');
    expect(billState(data, store, '2026-10-20', '2026-10-30')).toBe('late');
    expect(billState(data, store, '2026-11-05', '2026-10-30')).toBe('upcoming');
    expect(billState(data, store, '2026-10-05', '2026-10-30')).toBe('upcoming'); // before the plan began
    expect(billState(data, { id: 'z', minMonthly: 0 }, '2026-10-20', '2026-10-30')).toBe('upcoming');
    expect(billState({ paydays: [] }, store, '2026-10-20', '2026-10-30')).toBe('upcoming');
  });
});
