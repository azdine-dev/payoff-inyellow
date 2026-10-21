import { describe, expect, it } from 'vitest';
import type { DraftDebt } from '../draft';
import { debtChecks, debtComplete, debtSummary } from './Debts';

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

describe('quiet questions about numbers that look like a typo', () => {
  const full = (p: Partial<DraftDebt>) => debt({ name: 'Visa', balance: '3200', apr: '22.9', min: '96', ...p });

  it('says nothing for a normal debt, and for a 0% debt with a $0 minimum', () => {
    expect(debtChecks(full({}))).toEqual([]);
    expect(debtChecks(debt({ name: 'Family', balance: '800', apr: '0', min: '0' }))).toEqual([]);
  });

  it('asks about a rate over 60%', () => {
    expect(debtChecks(full({ apr: '61', min: '2000' }))).toEqual(['Is 61% right? Most cards are 15-30%.']);
    expect(debtChecks(full({ apr: '60', min: '2000' }))).toEqual([]);
    // 2290% also means the minimum cannot cover the interest, so both questions are asked
    expect(debtChecks(full({ apr: '2290' }))).toEqual(['Is 2290% right? Most cards are 15-30%.', 'At this minimum the balance won’t go down. Check the statement.']);
  });

  it('asks about a minimum larger than the balance', () => {
    expect(debtChecks(full({ balance: '50', apr: '0', min: '96' }))).toEqual(['Your minimum is larger than the balance. Is that right?']);
  });

  it('says when the minimum does not cover the interest', () => {
    expect(debtChecks(full({ balance: '10000', apr: '24', min: '150' }))).toEqual(['At this minimum the balance won’t go down. Check the statement.']);
  });

  it('understands pasted dollars and commas', () => {
    expect(debtChecks(full({ balance: '$10,000', apr: '24', min: '$150.00' }))).toEqual(['At this minimum the balance won’t go down. Check the statement.']);
  });
});
