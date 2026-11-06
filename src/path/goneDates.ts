/**
 * The day each debt is (or will be) gone. A debt that is already paid has a real date: the day of its last payment.
 * A debt still being paid has the payday of the plan that takes it to zero. Null when the plan never gets there.
 */
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';

export function goneDates(d: Pick<AppData, 'debts' | 'payments'>, r: PlanResult): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const debt of d.debts) {
    if (debt.status === 'paid') {
      const last = d.payments
        .filter((p) => p.debtId === debt.id && (p.kind === 'minimum' || p.kind === 'extra') && p.amount > 0)
        .reduce<string | null>((m, p) => (m === null || p.date > m ? p.date : m), null);
      out.set(debt.id, last);
    } else {
      const row = r.rows.find((x) => x.debts.some((y) => y.id === debt.id && y.balanceAfter <= 0.005));
      out.set(debt.id, row?.date ?? null);
    }
  }
  return out;
}
