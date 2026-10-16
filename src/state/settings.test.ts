import 'fake-indexeddb/auto';
import * as ed from '@noble/ed25519';
import { beforeEach, describe, expect, it } from 'vitest';
import { simulatePlan } from '../engine';
import { loadAll, openAppDB, type PiyDB } from '../data/db';
import { BackupError, backupDue, buildBackup, parseBackup, restoreBackup, summarizeBackup } from '../data/backup';
import type { AppData } from '../data/types';
import { applyAppearance, TEXT_SCALES } from '../lib/appearance';
import { buildIcs, foldLine } from '../lib/ics';
import { b64urlDecode, b64urlEncode, cleanCode, makeCode, verifyCode } from '../lib/license';
import { PUBLIC_KEY_HEX } from '../lib/licenseKey';
import { completeSetup, didPayday, skipPaydays, type SetupValues } from './actions';
import { addDebt, logCharge } from './debtActions';
import { addFund, saveFindMoney, findMoneyItems, useBuffer } from './moneyActions';
import { applyWhatIf } from './planActions';
import { nextPaydayISO, nextPaydayNumber, toPlanInput } from './planInput';
import { changeSchedule, markBackedUp, saveLicense, setAppearance } from './settingsActions';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: 1400,
  debts: [
    { name: 'Visa', type: '', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: true, myOrder: null },
    { name: 'Store card', type: '', balance: 640, apr: 26.99, minMonthly: 35, dueDay: 31, autopay: false, myOrder: null },
  ],
  bufferNow: 200,
  bufferGoal: 500,
  extraPerPayday: 150,
  funds: [{ name: 'Car repairs', perYear: 600, month: 'Any time' }],
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

let db: PiyDB;
let data: AppData;
let n = 0;
beforeEach(async () => {
  db = await openAppDB(`settings-${n++}`);
  data = await completeSetup(db, setup, '2026-10-15', 1_000);
});

describe('backup', () => {
  it('exports, wipes and restores the same data', async () => {
    let d = (await didPayday(db, data)).data;
    d = await logCharge(db, d, d.debts[0]!.id, 80, 'everyday', 'Gas', '2026-10-24');
    d = await useBuffer(db, d, 50, 'Tires', '2026-10-24');
    d = await applyWhatIf(db, d, 20, { amount: 300, date: '2026-12-01', note: 'Refund' });
    d = await saveFindMoney(db, d, findMoneyItems(d).map((i, k) => (k === 0 ? { ...i, amount: 90, done: true } : i)));

    const file = parseBackup(JSON.stringify(await buildBackup(db)));
    const other = await openAppDB(`restore-${n++}`);
    const restored = await restoreBackup(other, file);

    const before = (await loadAll(db))!;
    const sortP = (a: AppData) => ({ ...a, payments: [...a.payments].sort((x, y) => x.id.localeCompare(y.id)) });
    expect(sortP(restored)).toEqual(sortP(before));
    expect(simulatePlan(toPlanInput(restored)).debtFreeDate).toBe(simulatePlan(toPlanInput(d)).debtFreeDate);
    expect(summarizeBackup(file)).toMatchObject({ debts: 2, paydays: 1, lastPayday: '2026-10-23' });
  });

  it('replaces what was on the phone', async () => {
    const file = parseBackup(JSON.stringify(await buildBackup(db)));
    const other = await openAppDB(`restore-${n++}`);
    await completeSetup(other, { ...setup, debts: [{ ...setup.debts[0]!, name: 'Other' }] }, '2026-10-15');
    const restored = await restoreBackup(other, file);
    expect(restored.debts.map((x) => x.name)).toEqual(['Visa', 'Store card']);
  });

  it('refuses files that are not backups, are newer, or are damaged, and changes nothing', async () => {
    const good = await buildBackup(db);
    const cases: [string, string | object][] = [
      ['not json', 'hello'],
      ['other json', { hello: 1 }],
      ['newer', { ...good, version: 99 }],
      ['missing store', { ...good, stores: { ...good.stores, debts: undefined } }],
      ['record without id', { ...good, stores: { ...good.stores, debts: [{ name: 'x' }] } }],
      ['no settings', { ...good, stores: { ...good.stores, settings: [] } }],
    ];
    for (const [, c] of cases) {
      expect(() => parseBackup(typeof c === 'string' ? c : JSON.stringify(c))).toThrow(BackupError);
    }
    expect((await loadAll(db))!.debts).toHaveLength(2);
  });

  it('reminds after 30 days without a backup', () => {
    const day = 86_400_000;
    expect(backupDue(null, 0, 29 * day)).toBe(false);
    expect(backupDue(null, 0, 30 * day)).toBe(true);
    expect(backupDue(40 * day, 0, 60 * day)).toBe(false);
    expect(backupDue(40 * day, 0, 71 * day)).toBe(true);
  });

  it('remembers when a backup was saved', async () => {
    const d = await markBackedUp(db, data, 5_000);
    expect(d.settings.lastBackupAt).toBe(5_000);
    expect((await loadAll(db))!.settings.lastBackupAt).toBe(5_000);
  });
});

describe('calendar file', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  let ics = '';
  let events: string[] = [];
  beforeEach(() => {
    ics = buildIcs(data, '2026-10-15', { now });
    events = ics.split('BEGIN:VEVENT').slice(1);
  });

  it('is a valid calendar with CRLF lines, none over 75 bytes', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('has a payday and a payday check on every payday for a year', () => {
    const paydays = events.filter((e) => e.includes('SUMMARY:Payday\r\n'));
    const checks = events.filter((e) => e.includes('payday check'));
    expect(paydays).toHaveLength(26);
    expect(checks).toHaveLength(26);
    expect(paydays[0]).toContain('DTSTART;VALUE=DATE:20261023');
    expect(paydays[1]).toContain('DTSTART;VALUE=DATE:20261106');
    expect(checks[0]).toContain('DTSTART:20261023T200000');
    expect(checks[0]).toContain('TRIGGER:PT0S');
  });

  it('puts due dates on the due day with a reminder 3 days before, clamped to the month end', () => {
    const visa = events.filter((e) => e.includes('SUMMARY:Visa due'));
    expect(visa[0]).toContain('DTSTART;VALUE=DATE:20261112');
    expect(visa[0]).toContain('TRIGGER:-P3D');
    expect(visa[0]).toContain('autopay');
    const store = events.filter((e) => e.includes('SUMMARY:Store card due'));
    const starts = store.map((e) => /DTSTART;VALUE=DATE:(\d+)/.exec(e)![1]);
    expect(starts.slice(0, 5)).toEqual(['20261031', '20261130', '20261231', '20270131', '20270228']);
  });

  it('uses stable ids, so importing again does not duplicate', () => {
    const again = buildIcs(data, '2026-10-15', { now: new Date('2026-11-01T00:00:00Z') });
    const uids = (s: string) => [...s.matchAll(/UID:(.+)\r\n/g)].map((m) => m[1]);
    expect(uids(again)).toEqual(uids(ics));
    expect(new Set(uids(ics)).size).toBe(uids(ics).length);
  });

  it('skips paid and archived debts and fills in nothing for debts without a due day', async () => {
    const d = await addDebt(db, data, { name: 'Mom', type: '', balance: 100, apr: 0, minMonthly: 0, dueDay: null, autopay: false });
    expect(buildIcs(d, '2026-10-15', { now })).not.toContain('Mom due');
  });

  it('folds long lines at a character boundary', () => {
    const long = 'SUMMARY:' + 'é'.repeat(60);
    const folded = foldLine(long).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    expect(folded.slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(long);
  });
});

describe('unlock code', () => {
  const priv = ed.etc.bytesToHex(ed.utils.randomPrivateKey());
  let pub: string;
  beforeEach(async () => {
    pub = ed.etc.bytesToHex(await ed.getPublicKeyAsync(ed.etc.hexToBytes(priv)));
  });
  const payload = { v: 1 as const, id: 'ORDER-1234', iat: '2026-10-15', p: 'planner' as const };

  it('accepts a code signed with the matching key', async () => {
    const code = await makeCode(payload, priv);
    expect(code.startsWith('PIY1.')).toBe(true);
    expect(await verifyCode(code, pub)).toEqual({ ok: true, payload });
  });

  it('forgives spaces, line breaks and quotes from pasting', async () => {
    const code = await makeCode(payload, priv);
    const messy = `  “${code.slice(0, 30)}\n${code.slice(30)}”  `;
    expect(cleanCode(messy)).toBe(code);
    expect((await verifyCode(messy, pub)).ok).toBe(true);
  });

  it('rejects a changed payload, a changed signature, another key, and nonsense', async () => {
    const code = await makeCode(payload, priv);
    const [p, body, sig] = code.split('.');
    const forged = `${p}.${btoa(JSON.stringify({ ...payload, id: 'FREE' })).replace(/=+$/, '')}.${sig}`;
    const bytes = b64urlDecode(sig!);
    bytes[10] = bytes[10]! ^ 0x01; // one real bit, in the middle
    const flipped = `${p}.${body}.${b64urlEncode(bytes)}`;
    expect(await verifyCode(forged, pub)).toEqual({ ok: false, reason: 'signature' });
    expect(await verifyCode(flipped, pub)).toEqual({ ok: false, reason: 'signature' });
    expect(await verifyCode(code, PUBLIC_KEY_HEX)).toEqual({ ok: false, reason: 'signature' });
    expect(await verifyCode('hello', pub)).toEqual({ ok: false, reason: 'format' });
    expect(await verifyCode('PIY1.abc.def', pub)).toEqual({ ok: false, reason: 'format' });
    expect(await verifyCode('   ', pub)).toEqual({ ok: false, reason: 'empty' });
  });

  it('keeps the code with the plan', async () => {
    const d = await saveLicense(db, data, 'PIY1.x.y', 7);
    expect((await loadAll(db))!.settings.license).toEqual({ code: 'PIY1.x.y', activatedAt: 7 });
    expect(d.settings.license?.code).toBe('PIY1.x.y');
  });
});

describe('pay schedule change', () => {
  it('keeps history, keeps counting paydays, and uses the new dates', async () => {
    let d = (await didPayday(db, data)).data; // payday 1, Fri 23 Oct
    d = await skipPaydays(db, d, 1); // payday 2, Fri 6 Nov
    expect(nextPaydayNumber(d.settings)).toBe(3);

    d = await changeSchedule(db, d, 'weekly', '2026-11-13');
    expect(nextPaydayISO(d.settings)).toBe('2026-11-13');
    expect(nextPaydayNumber(d.settings)).toBe(3);
    expect(d.paydays.map((p) => [p.number, p.status])).toEqual([[1, 'done'], [2, 'skipped']]);

    const next = await didPayday(db, d);
    expect(next.data.paydays.map((p) => p.number)).toEqual([1, 2, 3]);
    expect(nextPaydayISO(next.data.settings)).toBe('2026-11-20');
    expect(next.data.payments.filter((p) => p.paydayNumber === 3).length).toBeGreaterThan(0);
    // yearly bills now split 52 ways
    expect(simulatePlan(toPlanInput(next.data)).rows[0]!.toYearlyBills).toBeCloseTo(600 / 52, 9);
  });
});

describe('appearance', () => {
  it('saves theme and text size', async () => {
    const d = await setAppearance(db, data, 'dark', 2);
    expect((await loadAll(db))!.settings).toMatchObject({ theme: 'dark', textSize: 2 });
    expect(d.settings.theme).toBe('dark');
  });

  it('applies to the page root', () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
      style: { setProperty: (k: string, v: string) => attrs.set(k, v) },
    } as unknown as HTMLElement;
    applyAppearance('dark', 3, root);
    expect(attrs.get('data-theme')).toBe('dark');
    expect(attrs.get('--text-scale')).toBe(String(TEXT_SCALES[3]));
    applyAppearance('auto', 1, root);
    expect(attrs.has('data-theme')).toBe(false);
  });

  it('old data without the new fields loads with defaults', async () => {
    const raw = { ...data.settings } as Record<string, unknown>;
    for (const k of ['theme', 'textSize', 'license', 'lastBackupAt', 'numberOffset', 'oneOffs']) delete raw[k];
    await db.put('settings', raw as never);
    expect((await loadAll(db))!.settings).toMatchObject({ theme: 'auto', textSize: 1, license: null, lastBackupAt: null, numberOffset: 0, oneOffs: [] });
  });
});

describe('yearly bills still save after a schedule change', () => {
  it('adds a bill and keeps the plan running', async () => {
    const d = await addFund(db, await changeSchedule(db, data, 'monthly', '2026-11-01'), { name: 'School', perYear: 240, month: 'August' });
    expect(simulatePlan(toPlanInput(d)).rows[0]!.toYearlyBills).toBeCloseTo((600 + 240) / 12, 9);
  });
});
