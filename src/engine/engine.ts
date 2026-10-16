/**
 * PaidInYellow payoff engine. An exact port of engine/engine_reference.py (the model
 * behind the Google Sheet bonus). If the model should change, update the reference,
 * engine/fixtures.json and the Sheet together, after Azeddin agrees.
 *
 * One step per payday. Money for the plan (plus any +/- for that payday) goes:
 *   1. yearly bills: sum(yearly costs) / ppy, capped at what is available
 *   2. buffer, until it reaches the goal
 *   3. the rest goes to debts as extra, in payoff order. The focus debt gets it all,
 *      overflow goes to the next debt. Minimums of paid-off debts roll into the extra.
 * New charges land on the focus debt of that payday.
 *
 * All amounts keep full precision. Round only for display.
 */
import { type Frequency, paydayISO } from './dates';
import { pyRound, pySum } from './pymath';

export type { Frequency } from './dates';

export const PAYDAYS_PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  biweekly: 26,
  'twice-monthly': 24,
  monthly: 12,
};

export type PayoffMethod = 'paidinyellow' | 'biggest-interest' | 'my-order';

/** Default limit: 520 paydays. Beyond it the app says "More than 20 years". */
export const MAX_PAYDAYS = 520;

/** A balance at or below this counts as zero. */
export const ZERO = 0.005;

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  /** Interest rate in percent, e.g. 22.9 */
  apr: number;
  minMonthly: number;
  /** Position for "My own order". Missing = last. */
  myOrder?: number | null;
}

export interface YearlyBillInput {
  perYear: number;
}

export interface PlanInput {
  frequency: Frequency;
  /**
   * ISO date the payday dates count from. With paydayOffset 0 (the Sheet and the fixtures)
   * this is payday 1. The app keeps the payday from setup here, so twice-a-month dates keep
   * alternating correctly after paydays are done.
   */
  nextPayday: string;
  /** Paydays already done or skipped since nextPayday. Row n's date is payday offset + n. */
  paydayOffset?: number;
  /** Twice a month only: the second pay day of the month (31 = last day). */
  otherPayday?: number | null;
  /**
   * The payoff order, as debt ids, kept from when the plan was made. Recompute it only when the
   * payoff method changes or a debt is added or removed. Re-sorting by current balances every
   * payday makes the focus debt jump and moves the debt-free date. Without it the order comes
   * from `method`. Paid debts stay in `debts` with balance 0, so their minimum keeps rolling
   * into the extra.
   */
  order?: string[];
  /** Money for the plan each payday, on top of the minimums */
  extraPerPayday: number;
  bufferNow: number;
  bufferGoal: number;
  method: PayoffMethod;
  debts: DebtInput[];
  yearlyBills?: YearlyBillInput[];
  /** "+/- this payday", keyed by payday number (1 = next payday) */
  adjustments?: Record<number, number>;
  /** New charges, keyed by payday number. They land on that payday's focus debt. */
  charges?: Record<number, number>;
  maxPaydays?: number;
}

export interface DebtStep {
  id: string;
  balanceBefore: number;
  interest: number;
  minimum: number;
  extra: number;
  /** After interest, minimum, extra and any new charge */
  balanceAfter: number;
}

export interface PaydayStep {
  payday: number;
  date: string;
  /** Money for the plan this payday: extraPerPayday + adjustment */
  planMoney: number;
  toYearlyBills: number;
  toBuffer: number;
  bufferAfter: number;
  /** Per debt, in payoff order */
  debts: DebtStep[];
  interest: number;
  minimums: number;
  extra: number;
  totalToSetAside: number;
  debtLeft: number;
  charge: number;
  /** Debt that got the most extra, else the first in order. New charges land here. */
  focusId: string | null;
  /** The focus debt when extra went to debts this payday, else null */
  extraGoesTo: string | null;
  /** No extra went to debts because the buffer is filling first */
  bufferFirst: boolean;
}

export interface MinimumsOnlyDebt {
  /** null = never ends (the minimum doesn't cover the interest) */
  months: number | null;
  interest: number | null;
}

export interface MinimumsOnly {
  neverEnds: boolean;
  months: number | null;
  totalInterest: number | null;
  perDebt: Record<string, MinimumsOnlyDebt>;
}

export interface PlanResult {
  /** Debt ids in payoff order */
  order: string[];
  rows: PaydayStep[];
  debtFreeDate: string | null;
  paydaysToDebtFree: number | null;
  totalInterest: number;
  /** Debt id -> date it first reached zero */
  paidOff: Record<string, string>;
  minimumsOnly: MinimumsOnly;
}

/** A debt that charges interest and whose minimum doesn't cover it. A 0% debt never grows, even with a $0 minimum. */
export function isGrowing(d: Pick<DebtInput, 'balance' | 'apr' | 'minMonthly'>): boolean {
  return d.apr > 0 && d.minMonthly <= (d.balance * d.apr) / 1200;
}

type SortKey = number[];

function compareKeys(a: SortKey, b: SortKey): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
}

/**
 * Payoff order as indexes into `debts`. Ties keep the order the debts were entered.
 * - PaidInYellow order: debts whose minimum doesn't cover their interest go first
 *   (highest APR first among them), then smallest balance first.
 * - Biggest interest first: highest APR first (ties: smaller balance).
 * - My own order: the user's numbers, blanks last.
 */
export function payoffOrder(debts: readonly DebtInput[], method: PayoffMethod): number[] {
  const key = (i: number): SortKey => {
    const d = debts[i]!;
    if (method === 'paidinyellow') {
      return isGrowing(d) ? [0, -d.apr, i] : [1, d.balance, i];
    }
    if (method === 'biggest-interest') return [-d.apr, d.balance, i];
    return [d.myOrder ?? 1e6, i];
  };
  return debts.map((_, i) => i).sort((a, b) => compareKeys(key(a), key(b)));
}

/** The payoff order as debt ids, for storing with the plan. */
export function payoffOrderIds(debts: readonly DebtInput[], method: PayoffMethod): string[] {
  return payoffOrder(debts, method).map((i) => debts[i]!.id);
}

/** Indexes into `debts` for a stored order. Debts missing from it follow, in the order entered. */
function orderFromIds(debts: readonly DebtInput[], ids: readonly string[]): number[] {
  const byId = new Map(debts.map((d, i) => [d.id, i]));
  const picked = ids.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const seen = new Set(picked);
  return [...picked, ...debts.map((_, i) => i).filter((i) => !seen.has(i))];
}

/** Months and interest if only the monthly minimum is paid (NPER). null = never ends. */
export function minimumsOnlyForDebt(d: Pick<DebtInput, 'balance' | 'apr' | 'minMonthly'>): MinimumsOnlyDebt {
  const B = d.balance;
  const mn = d.minMonthly;
  if (B <= 0) return { months: 0, interest: 0 };
  const r = d.apr / 1200;
  if (mn <= B * r) return { months: null, interest: null };
  if (r === 0) return { months: Math.ceil(B / mn), interest: 0 };
  const n = -Math.log(1 - (r * B) / mn) / Math.log(1 + r);
  return { months: Math.ceil(n), interest: mn * n - B };
}

export function minimumsOnly(debts: readonly DebtInput[]): MinimumsOnly {
  const per = debts.map(minimumsOnlyForDebt);
  const perDebt: Record<string, MinimumsOnlyDebt> = {};
  debts.forEach((d, i) => (perDebt[d.id] = per[i]!));
  const neverEnds = per.some((p) => p.months === null);
  return {
    neverEnds,
    // The reference crashes on zero debts here; with nothing to pay it takes 0 months.
    months: neverEnds ? null : per.reduce((m, p) => Math.max(m, p.months!), 0),
    totalInterest: neverEnds ? null : pySum(per.map((p) => p.interest!)),
    perDebt,
  };
}

/** Fixed numbers for a plan: order, rates and minimums per payday, yearly bills per payday. */
export interface PreparedPlan {
  frequency: Frequency;
  ppy: number;
  ids: string[];
  /** APR as a fraction, in payoff order */
  rates: number[];
  /** Minimum set aside each payday, in payoff order */
  minPerPayday: number[];
  yearlyPerPayday: number;
}

export function preparePlan(
  input: Pick<PlanInput, 'frequency' | 'method' | 'debts' | 'yearlyBills' | 'order'>,
): PreparedPlan {
  const ppy = PAYDAYS_PER_YEAR[input.frequency];
  const order = input.order ? orderFromIds(input.debts, input.order) : payoffOrder(input.debts, input.method);
  const ordered = order.map((i) => input.debts[i]!);
  return {
    frequency: input.frequency,
    ppy,
    ids: ordered.map((d) => d.id),
    rates: ordered.map((d) => d.apr / 100),
    minPerPayday: ordered.map((d) => (d.minMonthly * 12) / ppy),
    yearlyPerPayday: pySum((input.yearlyBills ?? []).map((y) => y.perYear)) / ppy,
  };
}

export interface StepState {
  /** Balances in payoff order (same order as PreparedPlan.ids) */
  balances: number[];
  buffer: number;
  bufferGoal: number;
}

/**
 * One payday, exactly like one row of the reference.
 * `planMoney` is extraPerPayday plus any "+/- this payday".
 * "I did it" uses this same step with the real numbers.
 */
export function stepPayday(
  plan: PreparedPlan,
  state: StepState,
  planMoney: number,
  charge = 0,
  payday = 1,
  date = '',
): PaydayStep {
  const { ppy, rates, minPerPayday: mpp } = plan;
  const bal = state.balances;

  const funds = Math.min(plan.yearlyPerPayday, Math.max(0, planMoney));
  const toBuffer = Math.min(Math.max(0, state.bufferGoal - state.buffer), Math.max(0, planMoney - funds));
  const bufferAfter = state.buffer + toBuffer;

  const grown = bal.map((b, i) => b * (1 + rates[i]! / ppy));
  const interest = pySum(grown.map((g, i) => g - bal[i]!));
  const mins = grown.map((g, i) => Math.min(g, mpp[i]!));
  const minimums = pySum(mins);
  // Leftover plan money plus the minimums freed by paid-off debts (the rollover)
  const pot = Math.max(0, planMoney - funds - toBuffer) + pySum(mpp) - minimums;

  const xs: number[] = [];
  for (let i = 0; i < grown.length; i++) {
    xs.push(Math.min(grown[i]! - mins[i]!, Math.max(0, pot - pySum(xs))));
  }
  const maxExtra = xs.length ? Math.max(...xs) : 0;
  const focus = maxExtra > 0 ? xs.indexOf(maxExtra) : 0;

  const after = grown.map((g, i) => Math.max(0, g - mins[i]! - xs[i]!));
  if (after.length) after[focus] = after[focus]! + charge;

  const extra = pySum(xs);
  const focusId = plan.ids[focus] ?? null;
  return {
    payday,
    date,
    planMoney,
    toYearlyBills: funds,
    toBuffer,
    bufferAfter,
    debts: plan.ids.map((id, i) => ({
      id,
      balanceBefore: bal[i]!,
      interest: grown[i]! - bal[i]!,
      minimum: mins[i]!,
      extra: xs[i]!,
      balanceAfter: after[i]!,
    })),
    interest,
    minimums,
    extra,
    totalToSetAside: minimums + toBuffer + funds + extra,
    debtLeft: pySum(after),
    charge: after.length ? charge : 0,
    focusId,
    extraGoesTo: extra > ZERO ? focusId : null,
    bufferFirst: !(extra > ZERO) && toBuffer > 0,
  };
}

/** The whole plan, payday by payday, from the current state. */
export function simulatePlan(input: PlanInput): PlanResult {
  const plan = preparePlan(input);
  const byId = new Map(input.debts.map((d) => [d.id, d]));
  const maxPaydays = input.maxPaydays ?? MAX_PAYDAYS;
  const adj = input.adjustments ?? {};
  const chg = input.charges ?? {};

  let balances = plan.ids.map((id) => byId.get(id)!.balance);
  let buffer = input.bufferNow;
  let totalInterest = 0;
  const rows: PaydayStep[] = [];
  const paidOff: Record<string, string> = {};

  for (let n = 1; n <= maxPaydays; n++) {
    if (pySum(balances) <= ZERO) break;
    const date = paydayISO(input.nextPayday, input.frequency, (input.paydayOffset ?? 0) + n, input.otherPayday);
    const row = stepPayday(
      plan,
      { balances, buffer, bufferGoal: input.bufferGoal },
      input.extraPerPayday + (adj[n] ?? 0),
      chg[n] ?? 0,
      n,
      date,
    );
    totalInterest += row.interest;
    buffer = row.bufferAfter;
    balances = row.debts.map((d) => d.balanceAfter);
    for (const d of row.debts) {
      if (d.balanceAfter <= ZERO && !(d.id in paidOff)) paidOff[d.id] = date;
    }
    rows.push(row);
  }

  const last = rows[rows.length - 1];
  // Same test as the reference: the rounded debt left is zero
  const done = last !== undefined && pyRound(last.debtLeft, 2) <= ZERO;
  return {
    order: plan.ids,
    rows,
    debtFreeDate: done ? last.date : null,
    paydaysToDebtFree: done ? rows.length : null,
    totalInterest,
    paidOff,
    minimumsOnly: minimumsOnly(input.debts),
  };
}

// ---------------------------------------------------------------------------
// Helpers for the screens (CLAUDE.md §6)
// ---------------------------------------------------------------------------

/** "Your debt costs you $X a day": sum(balance x APR) / 365, on current balances. */
export function dailyInterestCost(debts: readonly Pick<DebtInput, 'balance' | 'apr'>[]): number {
  return pySum(debts.map((d) => (d.balance * d.apr) / 100)) / 365;
}

/** Total minimums set aside each payday (monthly minimum x 12 / ppy). */
export function minimumsPerPayday(
  debts: readonly Pick<DebtInput, 'minMonthly' | 'balance'>[],
  frequency: Frequency,
): number {
  const ppy = PAYDAYS_PER_YEAR[frequency];
  return pySum(debts.filter((d) => d.balance > ZERO).map((d) => (d.minMonthly * 12) / ppy));
}

/**
 * Debts that grow even when the minimum is paid ("This one grows even when you pay the
 * minimum, so it goes first."). A 0% debt with a 0 minimum also sorts first in PaidInYellow
 * order, but it doesn't grow, so it isn't listed here.
 */
export function growingDebts(debts: readonly DebtInput[]): string[] {
  return debts.filter((d) => d.balance > ZERO && isGrowing(d)).map((d) => d.id);
}

export interface MethodComparison {
  paidinyellow: PlanResult;
  biggestInterest: PlanResult;
  /** Interest saved by Biggest interest first (negative = it costs more) */
  interestSaved: number;
  /** Paydays sooner with Biggest interest first (null if either never ends) */
  paydaysSooner: number | null;
  /** True when Biggest interest first saves more than 10% or more than $500: say so in dollars */
  suggestBiggestInterest: boolean;
}

/**
 * Comparison rule (Setup and Plan): run both orders. If Biggest interest first saves more
 * than 10% of the interest or more than $500, show the difference and let the user choose.
 * Otherwise recommend PaidInYellow order.
 */
export function compareMethods(input: Omit<PlanInput, 'method'>): MethodComparison {
  // Each method makes its own order. A stored order would make both runs the same plan.
  const fresh = { ...input, order: undefined };
  const piy = simulatePlan({ ...fresh, method: 'paidinyellow' });
  const big = simulatePlan({ ...fresh, method: 'biggest-interest' });
  const interestSaved = piy.totalInterest - big.totalInterest;
  const bothEnd = piy.debtFreeDate !== null && big.debtFreeDate !== null;
  let suggest: boolean;
  if (bothEnd) suggest = interestSaved > 0.1 * piy.totalInterest || interestSaved > 500;
  else suggest = piy.debtFreeDate === null && big.debtFreeDate !== null;
  return {
    paidinyellow: piy,
    biggestInterest: big,
    interestSaved,
    paydaysSooner: bothEnd ? piy.paydaysToDebtFree! - big.paydaysToDebtFree! : null,
    suggestBiggestInterest: suggest,
  };
}

export type NeedsHelpReason = 'minimums-over-paycheck' | 'no-end-in-20-years';

/**
 * "Your plan needs help": the minimums are more than the paycheck (when we know it),
 * or the plan doesn't end within the limit. The screen then points to hardship programs
 * and nonprofit credit counseling. Never to a loan.
 */
export function planNeedsHelp(
  input: PlanInput,
  result: PlanResult,
  paycheckAmount?: number | null,
): NeedsHelpReason[] {
  const reasons: NeedsHelpReason[] = [];
  if (paycheckAmount != null && minimumsPerPayday(input.debts, input.frequency) > paycheckAmount) {
    reasons.push('minimums-over-paycheck');
  }
  if (input.debts.some((d) => d.balance > ZERO) && result.debtFreeDate === null) {
    reasons.push('no-end-in-20-years');
  }
  return reasons;
}
