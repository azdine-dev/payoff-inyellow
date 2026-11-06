/** The note on Today over ten real paydays: a milestone note shows once, and no note repeats twice in a row. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openAppDB } from '../data/db';
import { completeSetup, didPayday, type SetupValues } from '../state/actions';
import { simulatePlan } from '../engine';
import { syncMilestones } from '../state/milestones';
import { toPlanInput } from '../state/planInput';
import { pickNote } from './payNote';

const setup: SetupValues = {
  currency: { code: 'USD', symbol: '$' },
  frequency: 'biweekly',
  nextPayday: '2026-11-06',
  paycheckAmount: null,
  debts: [
    { name: 'Store Card', type: '', balance: 450, apr: 26.99, minMonthly: 30, dueDay: 12, autopay: false, myOrder: null },
    { name: 'Medical', type: '', balance: 600, apr: 0, minMonthly: 50, dueDay: 3, autopay: false, myOrder: null },
    { name: 'Visa', type: '', balance: 2200, apr: 22.99, minMonthly: 66, dueDay: 20, autopay: false, myOrder: null },
  ],
  bufferNow: 500,
  bufferGoal: 500,
  extraPerPayday: 400,
  funds: [{ name: 'Gifts and holidays', perYear: 260, month: 'December' }], // Nadia's plan
  method: 'paidinyellow',
  startMode: 'this-payday',
  ifThen: { day: 'Friday', time: '20:00' },
};

/** Does every payday the way Today does, as long as the plan has debts left, up to `max` paydays */
/** `markedOn`: every payday is marked on that one calendar day (marked early), instead of on its own date */
async function notesFor(name: string, extraPerPayday: number, max: number, markedOn?: string, bufferNow = 200) {
  const db = await openAppDB(name);
  let d = await completeSetup(db, { ...setup, extraPerPayday, bufferNow }, '2026-11-03');
  const seen: { kind: string; text: string; date: string }[] = [];
  while (seen.length < max && d.debts.some((x) => x.status === 'active')) {
    const res = await didPayday(db, d, {});
    d = res.data;
    const date = d.paydays[d.paydays.length - 1]!.date;
    d = await syncMilestones(db, d, simulatePlan(toPlanInput(d)), markedOn ?? date);
    // the debt paid just now is "fresh"
    seen.push({ ...pickNote(d, { freshPaidDebt: res.newlyPaid.length > 0 }), date });
  }
  return seen;
}

function expectNoRepeat(seen: { kind: string; text: string }[]) {
  for (let i = 1; i < seen.length; i++) expect(seen[i]!.text, `payday ${i} and ${i + 1} say the same thing: ${seen[i]!.text}`).not.toBe(seen[i - 1]!.text);
  for (const kind of ['halfway', 'almostHome', 'firstPayday', 'debtFree']) expect(seen.filter((x) => x.kind === kind).length, kind).toBeLessThanOrEqual(1);
}

describe('ten paydays in a row', () => {
  it('ten paydays at $150: no note repeats twice in a row, and a milestone note shows once', async () => {
    const seen = await notesFor('note-sequence-a', 150, 10);
    expect(seen).toHaveLength(10);
    expectNoRepeat(seen);
    expect(seen[0]!.kind).toBe('firstPayday');
    expect(seen.filter((x) => x.kind === 'rotating').length).toBeGreaterThan(3);
  });

  it('a fast plan that pays two debts on neighbouring paydays: "PAID. One down." then "PAID. Two down."', async () => {
    const seen = await notesFor('note-sequence-b', 400, 12);
    expect(seen.length).toBeGreaterThanOrEqual(6);
    expectNoRepeat(seen);
    const paid = seen.filter((x) => x.kind === 'debtPaid').map((x) => x.text);
    expect(paid[0]).toBe('PAID. One down.');
    expect(paid[1]).toBe('PAID. Two down.');
    expect(seen[seen.length - 1]!.text).toBe('Debt-free.');
  });

  it('19 paydays marked early on one day: Halfway and Almost home each show exactly once, and the notes after use the rotating lines', async () => {
    const seen = await notesFor('note-sequence-early', 150, 19, '2026-11-05'); // Nadia's plan: 19 paydays, all marked on Thu 5 Nov
    expect(seen).toHaveLength(19);
    expect(seen.filter((x) => x.text === 'Halfway.' || x.kind === 'halfway')).toHaveLength(1);
    expect(seen.filter((x) => x.kind === 'almostHome')).toHaveLength(1);
    expectNoRepeat(seen);
    // each milestone sits on the payday that first showed it, and the paydays after it rotate
    const at = (kind: string) => seen.findIndex((x) => x.kind === kind);
    expect(at('halfway')).toBeGreaterThan(0);
    expect(at('almostHome')).toBeGreaterThan(at('halfway'));
    for (const kind of ['halfway', 'almostHome']) {
      const next = seen[at(kind) + 1];
      if (next && next.kind !== 'debtFree') expect(['rotating', 'debtPaid', 'bufferUsed', 'afterSkip']).toContain(next.kind);
    }
    expect(seen[seen.length - 1]!.text).toBe('Debt-free.');
  });
});
