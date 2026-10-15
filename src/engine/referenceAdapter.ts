/**
 * Maps the reference JSON format (engine/fixtures*.json, written by the Python reference)
 * to the TypeScript engine and back. Used by the parity tests only.
 */
import { simulatePlan, type PayoffMethod, type PlanInput } from './engine';
import type { Frequency } from './dates';
import { pyRound } from './pymath';

export interface RefDebt {
  name: string;
  type?: string;
  balance: number;
  apr: number;
  min: number;
  due_day?: number;
  my_order?: number | null;
}

export interface RefInput {
  freq: string;
  next_payday: [number, number, number];
  extra: number;
  buffer_now: number;
  buffer_goal: number;
  method: string;
  debts: RefDebt[];
  yearly?: { name: string; per_year: number; month: string }[];
  adj?: Record<string, number>;
  charges?: Record<string, number>;
}

export interface RefRow {
  payday: number;
  date: string;
  minimums: number;
  to_buffer: number;
  to_yearly_bills: number;
  extra: number;
  extra_goes_to: string;
  total_to_set_aside: number;
  debt_left: number;
}

export interface RefOutput {
  payoff_order: string[];
  debt_free_date: string | null;
  paydays_to_debt_free: number | null;
  total_interest: number;
  paid_off_dates: Record<string, string>;
  minimums_only: { never_ends: boolean; months: number | null; total_interest: number | null };
  first_paydays: RefRow[];
}

export interface RefFixture {
  name: string;
  note?: string;
  input: RefInput;
  expected: RefOutput;
}

const FREQ: Record<string, Frequency> = {
  'Every week': 'weekly',
  'Every 2 weeks': 'biweekly',
  'Twice a month': 'twice-monthly',
  'Every month': 'monthly',
};

const METHOD: Record<string, PayoffMethod> = {
  'PaidInYellow order': 'paidinyellow',
  'Biggest interest first': 'biggest-interest',
  'My own order': 'my-order',
};

const byPayday = (o: Record<string, number> = {}) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k), v]));

export function fromReferenceInput(ref: RefInput): PlanInput {
  const [y, m, d] = ref.next_payday;
  const frequency = FREQ[ref.freq];
  const method = METHOD[ref.method];
  if (!frequency || !method) throw new Error(`Unknown freq/method: ${ref.freq} / ${ref.method}`);
  return {
    frequency,
    nextPayday: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    extraPerPayday: ref.extra,
    bufferNow: ref.buffer_now,
    bufferGoal: ref.buffer_goal,
    method,
    debts: ref.debts.map((debt, i) => ({
      id: `d${i}`,
      name: debt.name,
      balance: debt.balance,
      apr: debt.apr,
      minMonthly: debt.min,
      myOrder: debt.my_order ?? null,
    })),
    yearlyBills: (ref.yearly ?? []).map((b) => ({ perYear: b.per_year })),
    adjustments: byPayday(ref.adj),
    charges: byPayday(ref.charges),
  };
}

/** Runs the TS engine and returns the result in the reference's shape and rounding. */
export function runAsReference(ref: RefInput): RefOutput {
  const input = fromReferenceInput(ref);
  const r = simulatePlan(input);
  const name = Object.fromEntries(input.debts.map((d) => [d.id, d.name]));
  const paidOff: Record<string, string> = {};
  for (const [id, date] of Object.entries(r.paidOff)) if (!(name[id]! in paidOff)) paidOff[name[id]!] = date;
  const mo = r.minimumsOnly;
  return {
    payoff_order: r.order.map((id) => name[id]!),
    debt_free_date: r.debtFreeDate,
    paydays_to_debt_free: r.paydaysToDebtFree,
    total_interest: pyRound(r.totalInterest, 2),
    paid_off_dates: paidOff,
    minimums_only: {
      never_ends: mo.neverEnds,
      months: mo.months,
      total_interest: mo.totalInterest === null ? null : pyRound(mo.totalInterest, 2),
    },
    first_paydays: r.rows.slice(0, 6).map((row) => ({
      payday: row.payday,
      date: row.date,
      minimums: pyRound(row.minimums, 2),
      to_buffer: pyRound(row.toBuffer, 2),
      to_yearly_bills: pyRound(row.toYearlyBills, 2),
      extra: pyRound(row.extra, 2),
      extra_goes_to: row.extraGoesTo ? name[row.extraGoesTo]! : row.bufferFirst ? 'Buffer first' : '',
      total_to_set_aside: pyRound(row.totalToSetAside, 2),
      debt_left: pyRound(row.debtLeft, 2),
    })),
  };
}
