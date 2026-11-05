/**
 * Money coming later is kept out of the plan until the buyer says it arrived, so the main debt-free date never
 * moves because of it. This is the one extra line under the date: "With your $800 tax refund: May 2027".
 */
import type { AppData, OneOff } from '../data/types';
import { simulatePlan } from '../engine';
import { formatMoney } from '../lib/money';
import { monthYear } from '../lib/today';
import { toPlanInput, waitingForArrival } from './planInput';

/** The money coming later that has not arrived yet, in date order */
export function comingLaterItems(data: Pick<AppData, 'settings'>): OneOff[] {
  return data.settings.oneOffs.filter(waitingForArrival).sort((a, b) => a.date.localeCompare(b.date));
}

/** "tax refund", or "extra money" when no type was tapped */
const kindWords = (o: OneOff) => (o.kind && o.kind !== 'Other' ? o.kind.toLowerCase() : 'extra money');

export interface ComingLaterLine {
  items: OneOff[];
  total: number;
  /** The debt-free date if all of it arrives on its payday. Null when the plan still does not end. */
  date: string | null;
  text: string;
}

export function comingLaterLine(data: AppData): ComingLaterLine | null {
  const items = comingLaterItems(data);
  if (!items.length) return null;
  const s = data.settings;
  const counted = items.map((o) => ({ ...o, arrived: true }));
  const result = simulatePlan(toPlanInput({ ...data, settings: { ...s, oneOffs: [...s.oneOffs.filter((o) => !waitingForArrival(o)), ...counted] } }));
  if (!result.debtFreeDate) return null;
  const total = items.reduce((sum, o) => sum + o.amount, 0);
  const money = formatMoney(total, s.currency, { whole: Number.isInteger(total) });
  const what = items.length === 1 ? `your ${money} ${kindWords(items[0]!)}` : `your ${money} coming later`;
  return { items, total, date: result.debtFreeDate, text: `With ${what}: ${monthYear(result.debtFreeDate)}` };
}
