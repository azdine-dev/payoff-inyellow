import { describe, expect, it } from 'vitest';
import type { DraftDebt } from '../draft';
import { debtChecks, debtComplete, debtRow } from './Debts';

const debt = (p: Partial<DraftDebt>): DraftDebt => ({ key: 'k', name: '', type: '', balance: '', apr: '', min: '', dueDay: '', autopay: false, ...p });

describe('a debt added so far, as one line', () => {
  it('name, rate, minimum and due day, with the balance on the right', () => {
    const d = debt({ name: 'Store Card', balance: '890', apr: '26.99', min: '35', dueDay: '2' });
    expect(debtComplete(d)).toBe(true);
    expect(debtRow(d, '$', 0)).toEqual({ name: 'Store Card', sub: '26.99% · $35 a month · due the 2nd', amount: '$890' });
  });

  it('works without a due day, with pasted dollars and commas, and with cents', () => {
    const d = debt({ name: 'Visa', balance: '$1,234.56', apr: '24.99', min: '65' });
    expect(debtComplete(d)).toBe(true);
    expect(debtRow(d, '$', 1)).toEqual({ name: 'Visa', sub: '24.99% · $65 a month', amount: '$1,234.56' });
  });

  it('an empty rate says "rate missing" and still counts as complete', () => {
    const d = debt({ name: 'Mom', balance: '800', apr: '', min: '40', dueDay: '15' });
    expect(debtComplete(d)).toBe(true);
    expect(debtRow(d, '$', 0).sub).toBe('rate missing · $40 a month · due the 15th');
  });

  it('a debt with something missing is not complete, and still has a line', () => {
    const d = debt({ name: '', balance: '500' });
    expect(debtComplete(d)).toBe(false);
    expect(debtRow(d, '$', 2)).toEqual({ name: 'Debt 3', sub: 'rate missing', amount: '$500' });
    expect(debtComplete(debt({ name: 'Visa', balance: '1', apr: '0', min: '' }))).toBe(false);
    expect(debtComplete(debt({ name: 'Visa', balance: '1', apr: 'abc', min: '5' }))).toBe(false);
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

import { minimumsLine } from './Money';

describe('the minimums line on the money step', () => {
  const sara = ['96', '35', '285', '50'].map((min, i) => debt({ key: `k${i}`, name: `D${i}`, balance: '1000', apr: '10', min }));

  it("Sara's minimums: $466 a month", () => {
    expect(minimumsLine({ debts: sara, currencySymbol: '$' })).toBe('Your minimums: $466 a month.');
  });

  it('has no line until a debt has a minimum, and uses the symbol you chose', () => {
    expect(minimumsLine({ debts: [debt({})], currencySymbol: '$' })).toBeNull();
    expect(minimumsLine({ debts: sara, currencySymbol: '€' })).toBe('Your minimums: €466 a month.');
  });
});
