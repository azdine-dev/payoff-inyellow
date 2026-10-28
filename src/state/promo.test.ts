/** Promo rates: the sentences, and what the plan does with a deferred-interest promo. */
import { describe, expect, it } from 'vitest';
import { simulatePlan, type PlanInput } from '../engine';
import { promoEndingSentence, promoLine, promoRiskSentence } from './promo';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const day = (iso: string) => iso;

const input = (deferred: boolean, promoEnds = '2027-03-31'): PlanInput => ({
  frequency: 'biweekly',
  nextPayday: '2026-10-30',
  extraPerPayday: 120,
  bufferNow: 500,
  bufferGoal: 500,
  method: 'paidinyellow',
  debts: [
    { id: 'f', name: 'Furniture card', balance: 3000, apr: 14.99, minMonthly: 50, dueDay: 12, promoApr: 0, promoEnds, deferred },
    { id: 'v', name: 'Visa', balance: 1500, apr: 22, minMonthly: 60, dueDay: 20 },
  ],
});

describe('the promo rate', () => {
  it('is used before the end date and the normal rate after it', () => {
    const r = simulatePlan(input(false, '2026-12-01'));
    const rows = r.rows;
    const f = (i: number) => rows[i]!.debts.find((d) => d.id === 'f')!;
    expect(f(0).interest).toBe(0); // 30 Oct: promo, 0%
    const first = rows.findIndex((x) => x.date >= '2026-12-01');
    expect(f(first).promo).toBe(false);
    expect(f(first).interest).toBeGreaterThan(0); // the end date itself uses the normal rate
    expect(f(first - 1).promo).toBe(true);
  });

  it('a deferred promo goes first until its end date, and not after it', () => {
    const r = simulatePlan(input(true));
    const extra = (i: number, id: string) => r.rows[i]!.debts.find((d) => d.id === id)!.extra;
    expect(extra(2, 'f')).toBeGreaterThan(0); // Visa would be first without the promo (smaller balance)
    expect(extra(2, 'v')).toBe(0);
    const plain = simulatePlan(input(false));
    expect(plain.rows[2]!.debts.find((d) => d.id === 'v')!.extra).toBeGreaterThan(0);
  });

  it('warns with what is still owing and the back interest, only when the plan does not clear it in time', () => {
    const risky = simulatePlan(input(true));
    expect(risky.promo).toHaveLength(1);
    expect(risky.promo[0]!.debtId).toBe('f');
    expect(risky.promo[0]!.owing).toBeGreaterThan(1000);
    expect(risky.promo[0]!.backInterest).toBeGreaterThan(100);
    expect(simulatePlan(input(false)).promo).toEqual([]); // not deferred: no warning
    expect(simulatePlan(input(true, '2030-01-01')).promo).toEqual([]); // plenty of time: cleared before the date
  });
});

describe('the sentences', () => {
  it('are calm, with amounts and dates', () => {
    expect(promoRiskSentence('Furniture card', { ends: '31 Mar 2027', owing: 1430, backInterest: 144.7 }, money, day)).toBe(
      'Furniture card’s promo ends 31 Mar 2027. At this pace $1,430 will still be owing then, and about $145 of back interest could be added. It goes first until then.',
    );
    expect(promoEndingSentence('Furniture card', '31 Mar 2027', day)).toBe('Furniture card’s promo rate ends 31 Mar 2027. Your plan clears it before then.');
  });

  it('the debt card line shows a promo that is still running, and nothing once it is over', () => {
    expect(promoLine({ promoApr: 0, promoEnds: '2027-03-31', deferredInterest: true }, '2026-10-28', day)).toBe('Promo rate 0% until 2027-03-31 · interest is deferred');
    expect(promoLine({ promoApr: 0, promoEnds: '2026-01-01' }, '2026-10-28', day)).toBeNull();
    expect(promoLine({}, '2026-10-28', day)).toBeNull();
  });
});
