/** Settings tab: schedule, currency, appearance, backup bookkeeping, unlock code. */
import { commit, type PiyDB } from '../data/db';
import type { AppData, TextSize, Theme } from '../data/types';
import type { Frequency } from '../engine';
import type { Currency } from '../lib/money';

/**
 * New pay schedule. History stays: the next payday log number carries on from where it was.
 * Planned one-off money keeps its dates.
 */
export async function changeSchedule(
  db: PiyDB,
  data: AppData,
  frequency: Frequency,
  nextPayday: string,
  now = Date.now(),
): Promise<AppData> {
  const s = data.settings;
  return commit(db, data, {
    settings: {
      ...s,
      frequency,
      anchorPayday: nextPayday,
      numberOffset: s.numberOffset + s.paydayIndex,
      paydayIndex: 0,
      updatedAt: now,
    },
  });
}

export async function setCurrency(db: PiyDB, data: AppData, currency: Currency, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, currency, updatedAt: now } });
}

export async function setExtraPerPayday(db: PiyDB, data: AppData, amount: number, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, extraPerPayday: amount, updatedAt: now } });
}

export async function setIfThen(db: PiyDB, data: AppData, day: string, time: string, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, ifThen: { day, time }, updatedAt: now } });
}

export async function setAppearance(db: PiyDB, data: AppData, theme: Theme, textSize: TextSize, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, theme, textSize, updatedAt: now } });
}

export async function markBackedUp(db: PiyDB, data: AppData, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, lastBackupAt: now } });
}

export async function saveLicense(db: PiyDB, data: AppData, code: string, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, license: { code, activatedAt: now }, updatedAt: now } });
}

export async function clearLicense(db: PiyDB, data: AppData, now = Date.now()): Promise<AppData> {
  return commit(db, data, { settings: { ...data.settings, license: null, updatedAt: now } });
}
