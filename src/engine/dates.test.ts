import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayNumber,
  daysInMonth,
  fromDayNumber,
  parseISO,
  paydayISO,
  paydayNumberOnOrAfter,
  toISO,
} from './dates';

const iso = (s: string) => parseISO(s);
const dates = (first: string, f: Parameters<typeof paydayISO>[1], count: number) =>
  Array.from({ length: count }, (_, i) => paydayISO(first, f, i + 1));

describe('calendar basics', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('round-trips day numbers', () => {
    expect(dayNumber(iso('1970-01-01'))).toBe(0);
    for (let z = -800000; z < 800000; z += 997) expect(dayNumber(fromDayNumber(z))).toBe(z);
  });

  it('adds days across month, year and Feb 29', () => {
    expect(toISO(addDays(iso('2028-02-25'), 7))).toBe('2028-03-03');
    expect(toISO(addDays(iso('2028-02-28'), 1))).toBe('2028-02-29');
    expect(toISO(addDays(iso('2026-12-25'), 14))).toBe('2027-01-08');
  });

  it('adds months clamped to the month end', () => {
    expect(toISO(addMonths(iso('2027-01-31'), 1))).toBe('2027-02-28');
    expect(toISO(addMonths(iso('2028-01-31'), 1))).toBe('2028-02-29');
    expect(toISO(addMonths(iso('2027-01-31'), 3))).toBe('2027-04-30');
    expect(toISO(addMonths(iso('2026-11-30'), 14))).toBe('2028-01-30');
  });

  it('rejects dates that do not exist', () => {
    expect(() => parseISO('2027-02-29')).toThrow();
    expect(() => parseISO('2026-13-01')).toThrow();
    expect(() => parseISO('26-1-1')).toThrow();
  });
});

describe('payday dates', () => {
  it('weekly and every 2 weeks', () => {
    expect(dates('2026-10-23', 'weekly', 3)).toEqual(['2026-10-23', '2026-10-30', '2026-11-06']);
    expect(dates('2026-12-18', 'biweekly', 3)).toEqual(['2026-12-18', '2027-01-01', '2027-01-15']);
  });

  it('monthly keeps the day and clamps short months (the 31st)', () => {
    expect(dates('2027-01-31', 'monthly', 4)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    expect(dates('2028-01-29', 'monthly', 3)).toEqual(['2028-01-29', '2028-02-29', '2028-03-29']);
  });

  it('twice a month: the given day, then 15 days later', () => {
    expect(dates('2026-11-01', 'twice-monthly', 4)).toEqual(['2026-11-01', '2026-11-16', '2026-12-01', '2026-12-16']);
    expect(dates('2028-02-14', 'twice-monthly', 4)).toEqual(['2028-02-14', '2028-02-29', '2028-03-14', '2028-03-29']);
  });

  it('twice a month: the second payday is capped at the month end (Feb 28)', () => {
    expect(dates('2027-01-15', 'twice-monthly', 4)).toEqual(['2027-01-15', '2027-01-30', '2027-02-15', '2027-02-28']);
  });

  it('twice a month from the 31st gives two paydays on one date (matches the Sheet, open question)', () => {
    expect(dates('2026-10-31', 'twice-monthly', 4)).toEqual(['2026-10-31', '2026-10-31', '2026-11-30', '2026-11-30']);
  });

  it('finds the payday on or after a date', () => {
    expect(paydayNumberOnOrAfter('2026-10-23', 'biweekly', '2026-10-01')).toBe(1);
    expect(paydayNumberOnOrAfter('2026-10-23', 'biweekly', '2026-10-23')).toBe(1);
    expect(paydayNumberOnOrAfter('2026-10-23', 'biweekly', '2026-10-24')).toBe(2);
    expect(paydayNumberOnOrAfter('2026-10-23', 'monthly', '2027-04-01')).toBe(7);
    expect(paydayNumberOnOrAfter('2026-10-23', 'weekly', '2040-01-01', 10)).toBeNull();
  });
});
