import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simulatePlan } from '../engine';
import { openAppDB, type PiyDB } from '../data/db';
import type { AppData } from '../data/types';
import { isEmail, submitEmail } from '../lib/leadCapture';
import { draftFromData, toSetupValues } from '../setup/draft';
import { completeSetup, didPayday, type SetupValues } from './actions';
import { saveLicense, setAppearance } from './settingsActions';
import { toPlanInput } from './planInput';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-10-23',
  paycheckAmount: 1400,
  debts: [
    { name: 'Visa', type: 'Credit card', balance: 3200, apr: 22.9, minMonthly: 96, dueDay: 12, autopay: true, myOrder: null },
    { name: 'Store card', type: '', balance: 640.5, apr: 26.99, minMonthly: 35, dueDay: null, autopay: false, myOrder: null },
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
  db = await openAppDB(`calc-${n++}`);
  data = await completeSetup(db, setup, '2026-10-15');
});

describe('"Change my numbers" starts from the current answers', () => {
  it('turns saved data back into the same setup values', () => {
    const back = toSetupValues(draftFromData(data));
    expect(back).toEqual({ ...setup, paycheckAmount: 1400 });
  });

  it('gives the same plan when nothing is changed', async () => {
    const before = simulatePlan(toPlanInput(data));
    const again = await completeSetup(await openAppDB(`calc-${n++}`), toSetupValues(draftFromData(data)), '2026-10-15');
    const after = simulatePlan(toPlanInput(again));
    expect(after.debtFreeDate).toBe(before.debtFreeDate);
    expect(after.totalInterest).toBeCloseTo(before.totalInterest, 6);
  });

  it('starts from the current balances and the upcoming payday', async () => {
    const d = (await didPayday(db, data)).data;
    const draft = draftFromData(d);
    expect(draft.nextPayday).toBe('2026-11-06');
    expect(draft.bufferNow).toBe('326.92'); // 200 + (150 - 600/26)
    expect(Number(draft.debts[1]!.balance)).toBeLessThan(640.5);
  });

  it('skips paid debts', async () => {
    const d = { ...data, debts: data.debts.map((x, i) => (i === 1 ? { ...x, balance: 0, status: 'paid' as const } : x)) };
    expect(draftFromData(d).debts.map((x) => x.name)).toEqual(['Visa']);
  });

  it('keeps theme, text size and code when numbers are redone', async () => {
    let d = await setAppearance(db, data, 'dark', 3);
    d = await saveLicense(db, d, 'PIY1.a.b', 5);
    const redone = await completeSetup(db, setup, '2026-10-16', 10, {
      theme: d.settings.theme,
      textSize: d.settings.textSize,
      license: d.settings.license,
    });
    expect(redone.settings).toMatchObject({ theme: 'dark', textSize: 3, license: { code: 'PIY1.a.b' } });
    expect(redone.paydays).toEqual([]);
  });
});

describe('email capture', () => {
  it('recognizes email addresses', () => {
    expect(isEmail('ana@example.com')).toBe(true);
    expect(isEmail('  ana@example.com ')).toBe(true);
    for (const bad of ['', 'ana', 'ana@', '@example.com', 'ana@example', 'ana @example.com']) expect(isEmail(bad)).toBe(false);
  });

  it('sends the email and the source, and nothing else', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const r = await submitEmail('  ana@example.com ', 'https://leads.test/x', fetcher as unknown as typeof fetch);
    expect(r).toBe('ok');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://leads.test/x');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: 'ana@example.com', source: 'free-calculator' });
  });

  it('does not send a bad address, or anything when no endpoint is set', async () => {
    const fetcher = vi.fn();
    expect(await submitEmail('nope', 'https://leads.test/x', fetcher as unknown as typeof fetch)).toBe('invalid');
    expect(await submitEmail('ana@example.com', '', fetcher as unknown as typeof fetch)).toBe('failed');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports a failed or refused send', async () => {
    const refused = vi.fn().mockResolvedValue({ ok: false });
    const offline = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await submitEmail('ana@example.com', 'https://x.test', refused as unknown as typeof fetch)).toBe('failed');
    expect(await submitEmail('ana@example.com', 'https://x.test', offline as unknown as typeof fetch)).toBe('failed');
  });
});
