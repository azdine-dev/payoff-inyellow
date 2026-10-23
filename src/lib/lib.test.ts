import { describe, expect, it } from 'vitest';
import { detectCurrency, formatMoney, formatMoneyAuto, parseAmount } from './money';
import { monthsBetween, nextDueDate, shortDate, timeLabel, weekdayName } from './today';

const usd = { code: 'USD', symbol: '$' };

describe('money', () => {
  it('formats cents and whole units', () => {
    expect(formatMoney(1234.5, usd)).toBe('$1,234.50');
    expect(formatMoney(1234.5, usd, { whole: true })).toBe('$1,234');
    expect(formatMoneyAuto(150, usd)).toBe('$150');
    expect(formatMoneyAuto(107.6923, usd)).toBe('$107.69');
    expect(formatMoney(20, { symbol: 'DH' })).toBe('DH 20.00');
  });

  it('reads what people type', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1234,56')).toBe(1234.56);
    expect(parseAmount('$ 500')).toBe(500);
    expect(parseAmount('22.9%')).toBe(22.9);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('detects currency from the region', () => {
    expect(detectCurrency(['en-US']).code).toBe('USD');
    expect(detectCurrency(['en-GB']).code).toBe('GBP');
    expect(detectCurrency(['fr-FR']).code).toBe('EUR');
    expect(detectCurrency([]).code).toBe('USD');
  });
});

describe('dates for screens', () => {
  it('formats like the mockup', () => {
    expect(shortDate('2026-10-24', '2026-10-15')).toBe('Sat 24 Oct');
    expect(weekdayName('2026-10-23')).toBe('Friday');
    expect(timeLabel('20:00')).toBe('8 pm');
    expect(timeLabel('07:30')).toBe('7:30 am');
  });

  it('counts calendar months', () => {
    expect(monthsBetween('2026-10-15', '2028-03-01')).toBe(17);
  });

  it('finds the next due date', () => {
    expect(nextDueDate(28, '2026-10-15')).toBe('2026-10-28');
    expect(nextDueDate(5, '2026-10-15')).toBe('2026-11-05');
    expect(nextDueDate(31, '2026-11-15')).toBe('2026-11-30');
  });
});
