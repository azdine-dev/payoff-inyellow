import { describe, expect, it } from 'vitest';
import type { DraftDebt } from '../draft';
import { debtComplete, debtSummary } from './Debts';

const debt = (p: Partial<DraftDebt>): DraftDebt => ({ key: 'k', name: '', type: '', balance: '', apr: '', min: '', dueDay: '', autopay: false, ...p });

describe('a finished debt as one line', () => {
  it('names, balance, rate, minimum and due day', () => {
    const d = debt({ name: 'Visa', balance: '3200', apr: '22.9', min: '96', dueDay: '12' });
    expect(debtComplete(d)).toBe(true);
    expect(debtSummary(d, '$', 0)).toBe('Visa · $3,200 · 22.9% · $96/mo · due 12th');
  });

  it('works without a due day, with pasted dollars and commas, and with cents', () => {
    const d = debt({ name: 'Store card', balance: '$1,234.56', apr: '26.99', min: '35' });
    expect(debtComplete(d)).toBe(true);
    expect(debtSummary(d, '$', 1)).toBe('Store card · $1,234.56 · 26.99% · $35/mo');
  });

  it('a debt with something missing is not complete, and still has a line', () => {
    const d = debt({ name: '', balance: '500' });
    expect(debtComplete(d)).toBe(false);
    expect(debtSummary(d, '$', 2)).toBe('Debt 3 · $500');
    expect(debtComplete(debt({ name: 'Visa', balance: '1', apr: '0', min: '' }))).toBe(false);
  });

  it('a 0% debt with a $0 minimum is complete', () => {
    expect(debtComplete(debt({ name: 'Family', balance: '800', apr: '0', min: '0' }))).toBe(true);
  });
});
