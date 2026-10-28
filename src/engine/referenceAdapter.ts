/**
 * Maps the reference JSON format (engine/fixtures_v2*.json, written by engine_v2.py) to the TypeScript engine
 * and back. Used by the parity tests only.
 *
 * In the reference, paydays are counted from 0 (`adjust`, `charges` and `buffer_used` are keyed by that index).
 * The TypeScript engine counts from 1, so the keys move up by one here.
 */
import { simulatePlan, type PayoffMethod, type PlanInput } from './engine';
import type { Frequency } from './dates';
import { pyRound } from './pymath';

export interface RefDebt {
  name: string;
  balance: number;
  apr: number;
  min: number;
  due?: number | null;
  my_order?: number | null;
  promo_apr?: number | null;
  promo_ends?: string | null;
  deferred?: boolean;
}

export interface RefInput {
  freq: 'weekly' | 'biweekly' | 'twice' | 'monthly';
  first_payday: string;
  second_day?: number | null;
  money: number;
  buffer?: number;
  goal: number;
  yearly?: number[];
  method?: 'piy' | 'avalanche' | 'custom';
  debts: RefDebt[];
  adjust?: Record<string, number>;
  charges?: Record<string, number>;
  buffer_used?: Record<string, number>;
  yearly_paid?: Record<string, number>;
}

export interface RefRow {
  date: string;
  bills: number;
  extra: number;
  total_move: number;
  owed: number;
}

export interface RefExpect {
  order: string[];
  debt_free: string | null;
  paydays: number | null;
  interest: number;
  first_paydays: RefRow[];
  /** Debt left after each of the first 60 paydays (the generated fixtures only) */
  owed_60?: number[];
  /** Deferred promos that are not cleared by their end date */
  promo?: { name: string; ends: string; owing: number; back_interest: number }[];
}

export interface RefFixture {
  name: string;
  note?: string;
  input: RefInput;
  expect: RefExpect;
}

const FREQ: Record<RefInput['freq'], Frequency> = {
  weekly: 'weekly',
  biweekly: 'biweekly',
  twice: 'twice-monthly',
  monthly: 'monthly',
};

const METHOD: Record<NonNullable<RefInput['method']>, PayoffMethod> = {
  piy: 'paidinyellow',
  avalanche: 'biggest-interest',
  custom: 'my-order',
};

/** Reference payday index (from 0) -> TypeScript payday number (from 1) */
const byPayday = (o: Record<string, number> = {}) => Object.fromEntries(Object.entries(o).map(([k, v]) => [Number(k) + 1, v]));

export function fromReferenceInput(ref: RefInput): PlanInput {
  return {
    frequency: FREQ[ref.freq],
    nextPayday: ref.first_payday,
    extraPerPayday: ref.money,
    bufferNow: ref.buffer ?? 0,
    bufferGoal: ref.goal,
    method: METHOD[ref.method ?? 'piy'],
    debts: ref.debts.map((debt, i) => ({
      id: `d${i}`,
      name: debt.name,
      balance: debt.balance,
      apr: debt.apr,
      minMonthly: debt.min,
      dueDay: debt.due ?? null,
      promoApr: debt.promo_apr ?? null,
      promoEnds: debt.promo_ends ?? null,
      deferred: debt.deferred ?? false,
      myOrder: debt.my_order ?? null,
    })),
    yearlyBills: (ref.yearly ?? []).map((perYear) => ({ perYear })),
    adjustments: byPayday(ref.adjust),
    charges: byPayday(ref.charges),
    bufferUsed: byPayday(ref.buffer_used),
    otherPayday: ref.second_day ?? null,
  };
}

/** Runs the TS engine and returns the result in the reference's shape and rounding. */
export function runAsReference(ref: RefInput): Required<RefExpect> {
  const input = fromReferenceInput(ref);
  const r = simulatePlan(input);
  const name = Object.fromEntries(input.debts.map((d) => [d.id, d.name]));
  return {
    order: r.order.map((id) => name[id]!),
    debt_free: r.debtFreeDate,
    paydays: r.paydaysToDebtFree,
    interest: pyRound(r.totalInterest, 2),
    first_paydays: r.rows.slice(0, 4).map((row) => ({
      date: row.date,
      bills: pyRound(row.minimums, 2),
      extra: pyRound(row.extra, 2),
      total_move: pyRound(row.totalToSetAside, 2),
      owed: pyRound(row.debtLeft, 2),
    })),
    owed_60: r.rows.slice(0, 60).map((row) => pyRound(row.debtLeft, 2)),
    promo: r.promo.map((p) => ({ name: name[p.debtId]!, ends: p.ends, owing: pyRound(p.owing, 2), back_interest: pyRound(p.backInterest, 2) })),
  };
}
