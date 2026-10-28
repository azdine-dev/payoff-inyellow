/**
 * "Worth knowing" on Path: up to three calm sentences from the buyer's own numbers, most useful first.
 * Nothing here is advice: it says what the numbers say. An empty list hides the card.
 */
import { growingDebts, type PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { promoEndingSentence, promoRiskSentence } from './promo';
import { activeDebts, toDebtInput } from './planInput';

export interface KnowingFormat {
  money: (n: number) => string;
  day: (iso: string) => string;
}

const names = (list: string[]) => (list.length === 1 ? list[0]! : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`);

export function worthKnowing(data: AppData, plan: PlanResult, today: string, f: KnowingFormat): string[] {
  const active = activeDebts(data);
  const out: string[] = [];

  // 1. A debt that grows even when its minimum is paid
  const growing = new Set(growingDebts(active.map(toDebtInput)));
  for (const d of active) if (growing.has(d.id) && !d.minPending) out.push(`${d.name} grows even when you pay the minimum, so it goes first.`);

  // 2. A promo rate that ends: the risk when the plan will not clear it, a plain heads-up when it will
  for (const w of plan.promo) {
    const d = data.debts.find((x) => x.id === w.debtId);
    if (d) out.push(promoRiskSentence(d.name, { ends: w.ends, owing: w.owing, backInterest: w.backInterest }, f.money, f.day));
  }
  for (const d of active) {
    const risky = plan.promo.some((w) => w.debtId === d.id);
    if (!risky && d.promoApr != null && d.promoEnds && d.promoEnds > today && d.promoEnds <= addMonthsISO(today, 6)) out.push(promoEndingSentence(d.name, d.promoEnds, f.day));
  }

  // 3. A bill that is not in the plan yet because it has no due day
  const noDay = active.filter((d) => d.minMonthly > 0 && !d.dueDay).map((d) => d.name);
  if (noDay.length) out.push(`${names(noDay)} ${noDay.length === 1 ? 'has' : 'have'} no due day yet, so ${noDay.length === 1 ? 'its bill is' : 'their bills are'} not in your plan. Add ${noDay.length === 1 ? 'it' : 'them'} on the Debts tab.`);

  // 4. Buffer money was used and the plan is refilling it
  const used = data.buffer.history.some((h) => h.amount < 0);
  if (used && data.settings.bufferGoal > 0 && data.buffer.amount < data.settings.bufferGoal) {
    out.push(`You used some of your buffer. Your plan refills it first: ${f.money(data.buffer.amount)} of ${f.money(data.settings.bufferGoal)} so far.`);
  }
  return out.slice(0, 3);
}

/** today + 6 months, as an ISO date (the day is kept, clamped to the month's end) */
function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(ny, nm, 0).getDate();
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
