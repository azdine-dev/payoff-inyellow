import { describe, expect, it } from 'vitest';
import { backupReminder, paydaysSinceBackup } from './backup';

const day = 86_400_000;
const payday = (n: number, at: number, status: 'done' | 'skipped' = 'done') => ({ id: `p${n}`, updatedAt: at, number: n, date: '2026-10-23', status, planMoney: 0, total: 0 }) as never;
const data = (paydays: never[], lastBackupAt: number | null, setupDoneAt = 0) => ({ paydays, settings: { lastBackupAt, setupDoneAt } }) as never;

describe('the backup reminder', () => {
  it('counts the paydays done since the last backup (skipped ones do not count)', () => {
    const paydays = [payday(1, 10), payday(2, 20), payday(3, 30, 'skipped'), payday(4, 40)];
    expect(paydaysSinceBackup(data(paydays, null))).toBe(3);
    expect(paydaysSinceBackup(data(paydays, 25))).toBe(1);
    expect(paydaysSinceBackup(data(paydays, 100))).toBe(0);
  });

  it('comes after 4 paydays, even in the first week', () => {
    const three = [payday(1, 1), payday(2, 2), payday(3, 3)];
    expect(backupReminder(data(three, null, 0), 7 * day)).toBe(false);
    expect(backupReminder(data([...three, payday(4, 4)], null, 0), 7 * day)).toBe(true);
  });

  it('is quiet right after a backup, and still comes after 30 days for people paid monthly', () => {
    const four = [payday(1, 1), payday(2, 2), payday(3, 3), payday(4, 4)];
    expect(backupReminder(data(four, 10, 0), 11)).toBe(false);
    expect(backupReminder(data([payday(1, 1)], 5 * day, 0), 20 * day)).toBe(false);
    expect(backupReminder(data([payday(1, 1)], 5 * day, 0), 36 * day)).toBe(true);
  });
});
