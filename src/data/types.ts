/**
 * Stored records (CLAUDE.md §7). Every record has an id and updatedAt, so Pack 2 sync stays possible.
 */
import type { Frequency, PayoffMethod } from '../engine';
import type { Currency } from '../lib/money';

export interface Meta {
  id: string;
  /** ms since epoch */
  updatedAt: number;
}

export type StartMode = 'this-payday' | 'next-month';
export type Theme = 'auto' | 'light' | 'dark';
/** 0 small, 1 default, 2 large, 3 larger */
export type TextSize = 0 | 1 | 2 | 3;

export interface License {
  code: string;
  activatedAt: number;
}

export interface Settings extends Meta {
  id: 'settings';
  currency: Currency;
  frequency: Frequency;
  /** The next payday entered in setup. Payday dates always count from here. */
  anchorPayday: string;
  /** Paydays done, skipped or before the plan start. Next payday = anchor + paydayIndex. */
  paydayIndex: number;
  paycheckAmount: number | null;
  extraPerPayday: number;
  bufferGoal: number;
  method: PayoffMethod;
  /** "When I get paid on [day], I open PaidInYellow at [time]". day = weekday name or 'payday' */
  ifThen: { day: string; time: string };
  startMode: StartMode;
  setupDoneAt: number;
  /** Planned one-off money (a tax refund...). It goes into the payday on or after its date. */
  oneOffs: OneOff[];
  /** Twice a month only: the second pay day of the month (31 = last day). */
  otherPayday: number | null;
  /**
   * Payoff order as debt ids, set when the plan is made. Changed only when the payoff method
   * changes or a debt is added, removed or brought back. Never re-sorted by balance each payday.
   */
  payoffOrder: string[];
  /** Payday log numbers continue across schedule changes: number = numberOffset + paydayIndex + 1 */
  numberOffset: number;
  /** ms since epoch of the last exported backup, null = never */
  lastBackupAt: number | null;
  theme: Theme;
  textSize: TextSize;
  license: License | null;
  /** The plan as it stood when setup was done. Progress compares against it. */
  baseline: Baseline | null;
  /** "Do these later" items that are done (or that the buyer said they don't need) */
  later?: { yearly?: boolean; reminder?: boolean };
}

export interface OneOff {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface Baseline {
  date: string;
  debtFreeDate: string | null;
  totalInterest: number;
  minimumsOnlyInterest: number | null;
  minimumsOnlyMonths: number | null;
  totalOwed: number;
}

export type DebtStatus = 'active' | 'paid' | 'archived';

export interface Debt extends Meta {
  name: string;
  type: string;
  balance: number;
  /** percent */
  apr: number;
  minMonthly: number;
  /** Added with the quick add: the minimum is not known yet (it counts as 0 until it is typed in) */
  minPending?: boolean;
  /** The rate was left empty in setup: 24% is used until the buyer adds the real one */
  rateMissing?: boolean;
  dueDay: number | null;
  autopay: boolean;
  myOrder: number | null;
  startBalance: number;
  status: DebtStatus;
  /** Order the debts were entered (ties in payoff order keep it) */
  position: number;
}

export type PaymentKind = 'minimum' | 'extra' | 'buffer' | 'fund';

export interface Payment extends Meta {
  date: string;
  debtId: string | null;
  fundId: string | null;
  amount: number;
  kind: PaymentKind;
  /** true = part of a payday plan, false = "+ Extra payment" */
  planned: boolean;
  paydayNumber: number | null;
}

export type ChargeTag = 'everyday' | 'emergency' | 'one-off';

export interface Charge extends Meta {
  date: string;
  debtId: string;
  amount: number;
  tag: ChargeTag;
  note: string;
}

export interface BufferRecord extends Meta {
  id: 'buffer';
  amount: number;
  history: { date: string; amount: number; note: string }[];
}

export interface Fund extends Meta {
  name: string;
  perYear: number;
  /** "Any time" or a month name */
  month: string;
  saved: number;
  /** Order the bills were entered */
  position: number;
}

export interface PaydayLog extends Meta {
  /** Payday number counted from the anchor (1 = the payday entered in setup) */
  number: number;
  date: string;
  status: 'done' | 'skipped';
  planMoney: number;
  total: number;
  /** What the plan asked for that payday with the usual money (planned vs actual) */
  plannedTotal?: number;
  /** Total debt left after this payday */
  debtLeft?: number;
  /** The bills that were due between this payday and the next, as shown on Today */
  bills?: { debtId: string; name: string; amount: number; due: string }[];
}

export type MilestoneKey =
  | 'plan-made'
  | 'buffer-full'
  | 'first-extra'
  | 'first-debt'
  | 'pct-10'
  | 'pct-25'
  | 'pct-50'
  | 'pct-75'
  | 'month-ahead'
  | 'last-payment';

export interface Milestone extends Meta {
  id: MilestoneKey;
  reachedOn: string;
}

export interface FindMoneyItem {
  key: string;
  label: string;
  amount: number | null;
  done: boolean;
}

export interface FindMoneyRecord extends Meta {
  id: 'findMoney';
  items: FindMoneyItem[];
}

export interface AppData {
  settings: Settings;
  debts: Debt[];
  buffer: BufferRecord;
  funds: Fund[];
  payments: Payment[];
  charges: Charge[];
  paydays: PaydayLog[];
  milestones: Milestone[];
  findMoney: FindMoneyRecord | null;
}
