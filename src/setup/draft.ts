/**
 * The wizard keeps what people type as text (so "1,2" mid-typing isn't lost), autosaves it,
 * and turns it into numbers when a step is done.
 */
import { parseISO, type DebtInput, type Frequency, type PayoffMethod } from '../engine';
import type { StartMode } from '../data/types';
import { currencyFromCode, detectCurrency, parseAmount } from '../lib/money';
import { addDaysISO, weekdayName } from '../lib/today';
import type { AppData } from '../data/types';
import type { SetupValues } from '../state/actions';
import { activeDebts, nextPaydayISO } from '../state/planInput';

export interface DraftDebt {
  key: string;
  name: string;
  type: string;
  balance: string;
  apr: string;
  min: string;
  dueDay: string;
  autopay: boolean;
}

export interface DraftFund {
  key: string;
  name: string;
  perYear: string;
  month: string;
}

export interface Draft {
  /** ISO code, or '' for "Other" (symbol typed by hand) */
  currencyCode: string;
  currencySymbol: string;
  frequency: Frequency | '';
  nextPayday: string;
  paycheck: string;
  debts: DraftDebt[];
  bufferNow: string;
  bufferGoal: string;
  extra: string;
  funds: DraftFund[];
  method: PayoffMethod;
  /** Debt keys in "My own order" */
  myOrder: string[];
  startMode: StartMode;
  /** Weekday name, or 'payday' */
  ifThenDay: string;
  ifThenTime: string;
}

let keySeq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export const emptyDebt = (): DraftDebt => ({ key: newKey(), name: '', type: '', balance: '', apr: '', min: '', dueDay: '', autopay: false });
export const newFund = (name = ''): DraftFund => ({ key: newKey(), name, perYear: '', month: 'Any time' });

export function newDraft(): Draft {
  const c = detectCurrency();
  return {
    currencyCode: c.code ?? '',
    currencySymbol: c.symbol,
    frequency: '',
    nextPayday: '',
    paycheck: '',
    debts: [emptyDebt()],
    bufferNow: '',
    bufferGoal: '500',
    extra: '',
    funds: [],
    method: 'paidinyellow',
    myOrder: [],
    startMode: 'this-payday',
    ifThenDay: '',
    ifThenTime: '20:00',
  };
}

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'twice-monthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Every month' },
];

export const MONTH_CHOICES = ['Any time', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const STEP_COUNT = 8; // after the welcome screen

const isBlank = (d: DraftDebt) => !d.name.trim() && !d.balance.trim() && !d.apr.trim() && !d.min.trim() && !d.dueDay.trim();

export function filledDebts(draft: Draft): DraftDebt[] {
  return draft.debts.filter((d) => !isBlank(d));
}

export function debtName(d: DraftDebt, i: number): string {
  return d.name.trim() || `Debt ${i + 1}`;
}

function validDate(iso: string): boolean {
  try {
    parseISO(iso);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calm notes for a step; empty = ready to continue. Written in ink, never red.
 * @param step 1-8 (0 is the welcome screen)
 */
export function stepNotes(step: number, draft: Draft, today: string): string[] {
  const notes: string[] = [];
  const amount = (s: string) => parseAmount(s);
  switch (step) {
    case 1:
      if (!draft.currencySymbol.trim()) notes.push('Type the symbol you use for money, like $ or €.');
      break;
    case 2:
      if (!draft.frequency) notes.push('Choose how often you get paid.');
      if (!draft.nextPayday || !validDate(draft.nextPayday)) notes.push('Pick the date of your next payday.');
      else if (draft.nextPayday < today) notes.push('Pick your next payday: today or a day after today.');
      else if (draft.nextPayday > addDaysISO(today, 62)) notes.push('Pick your next payday. It looks more than 2 months away.');
      if (draft.paycheck.trim() && (amount(draft.paycheck) ?? -1) < 0) notes.push('The paycheck amount should be a number, like 1400.');
      break;
    case 3: {
      const debts = filledDebts(draft);
      if (!debts.length) notes.push('Add at least one debt with its balance.');
      debts.forEach((d, i) => {
        const name = debtName(d, i);
        const bal = amount(d.balance);
        const apr = amount(d.apr);
        const min = amount(d.min);
        if (bal === null || bal < 0) notes.push(`${name}: add the balance you owe.`);
        if (apr === null || apr < 0 || apr > 100) notes.push(`${name}: add the interest rate, from 0 to 100. Type 0 if there is none.`);
        if (min === null || min < 0) notes.push(`${name}: add the monthly minimum. Type 0 if there is none.`);
        if (d.dueDay.trim()) {
          const day = Number(d.dueDay);
          if (!Number.isInteger(day) || day < 1 || day > 31) notes.push(`${name}: the due day is a day of the month, from 1 to 31.`);
        }
      });
      if (debts.length && !debts.some((d) => (amount(d.balance) ?? 0) > 0)) notes.push('Add at least one debt with a balance above zero.');
      break;
    }
    case 4:
      if (draft.bufferNow.trim() && (amount(draft.bufferNow) ?? -1) < 0) notes.push('Type what you have set aside, or leave it empty.');
      if ((amount(draft.bufferGoal) ?? -1) < 0) notes.push('Type a goal for your buffer, like 500.');
      break;
    case 5:
      if ((amount(draft.extra) ?? -1) < 0) notes.push('Type an amount, even 0. You can change it any time.');
      break;
    case 6:
      draft.funds.forEach((f) => {
        if (!f.name.trim() && !f.perYear.trim()) return;
        if ((amount(f.perYear) ?? -1) <= 0) notes.push(`${f.name.trim() || 'This bill'}: add how much it costs in a year.`);
      });
      break;
  }
  return notes;
}

export function draftDebtInputs(draft: Draft): DebtInput[] {
  const debts = filledDebts(draft);
  return debts.map((d, i) => ({
    id: d.key,
    name: debtName(d, i),
    balance: parseAmount(d.balance) ?? 0,
    apr: parseAmount(d.apr) ?? 0,
    minMonthly: parseAmount(d.min) ?? 0,
    myOrder: draft.method === 'my-order' ? myOrderKeys(draft).indexOf(d.key) + 1 : null,
  }));
}

/** Debt keys in the user's order: saved order first, then any new debts. */
export function myOrderKeys(draft: Draft): string[] {
  const keys = filledDebts(draft).map((d) => d.key);
  return [...draft.myOrder.filter((k) => keys.includes(k)), ...keys.filter((k) => !draft.myOrder.includes(k))];
}

export function ifThenDefault(draft: Draft): string {
  if (draft.ifThenDay) return draft.ifThenDay;
  if ((draft.frequency === 'weekly' || draft.frequency === 'biweekly') && validDate(draft.nextPayday)) {
    return weekdayName(draft.nextPayday);
  }
  return 'payday';
}

export function toSetupValues(draft: Draft): SetupValues {
  const debts = filledDebts(draft);
  const inputs = draftDebtInputs(draft);
  return {
    currency: draft.currencyCode ? currencyFromCode(draft.currencyCode) : { symbol: draft.currencySymbol.trim() },
    frequency: draft.frequency as Frequency,
    nextPayday: draft.nextPayday,
    paycheckAmount: draft.paycheck.trim() ? parseAmount(draft.paycheck) : null,
    debts: debts.map((d, i) => ({
      name: inputs[i]!.name,
      type: d.type,
      balance: inputs[i]!.balance,
      apr: inputs[i]!.apr,
      minMonthly: inputs[i]!.minMonthly,
      dueDay: d.dueDay.trim() ? Number(d.dueDay) : null,
      autopay: d.autopay,
      myOrder: inputs[i]!.myOrder ?? null,
    })),
    bufferNow: parseAmount(draft.bufferNow) ?? 0,
    bufferGoal: parseAmount(draft.bufferGoal) ?? 0,
    extraPerPayday: parseAmount(draft.extra) ?? 0,
    funds: draft.funds
      .filter((f) => (parseAmount(f.perYear) ?? 0) > 0)
      .map((f) => ({ name: f.name.trim() || 'Yearly bill', perYear: parseAmount(f.perYear)!, month: f.month })),
    method: draft.method,
    startMode: draft.startMode,
    ifThen: { day: ifThenDefault(draft), time: draft.ifThenTime || '20:00' },
  };
}

const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/**
 * The wizard answers that would produce the plan as it stands now. Used by "Change my numbers".
 * Balances are the current ones and the next payday is the upcoming one, so redoing setup
 * starts from where the buyer is.
 */
export function draftFromData(d: AppData): Draft {
  const s = d.settings;
  const debts = activeDebts(d);
  const keyOf = new Map(debts.map((x) => [x.id, newKey()]));
  const byOrder = [...debts].sort((a, b) => (a.myOrder ?? 1e6) - (b.myOrder ?? 1e6) || a.position - b.position);
  return {
    currencyCode: s.currency.code ?? '',
    currencySymbol: s.currency.symbol,
    frequency: s.frequency,
    nextPayday: nextPaydayISO(s),
    paycheck: s.paycheckAmount ? num(s.paycheckAmount) : '',
    debts: debts.map((x) => ({
      key: keyOf.get(x.id)!,
      name: x.name,
      type: x.type,
      balance: num(x.balance),
      apr: num(x.apr),
      min: num(x.minMonthly),
      dueDay: x.dueDay ? String(x.dueDay) : '',
      autopay: x.autopay,
    })),
    bufferNow: num(d.buffer.amount),
    bufferGoal: num(s.bufferGoal),
    extra: num(s.extraPerPayday),
    funds: d.funds.map((f) => ({ key: newKey(), name: f.name, perYear: num(f.perYear), month: f.month })),
    method: s.method,
    myOrder: byOrder.map((x) => keyOf.get(x.id)!),
    startMode: 'this-payday',
    ifThenDay: s.ifThen.day,
    ifThenTime: s.ifThen.time,
  };
}
