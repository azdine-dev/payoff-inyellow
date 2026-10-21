/** The same small line at the top of every main tab: when the debts are gone and how many paydays that is. */
import { shortMonthYear } from '../lib/today';
import { plan } from '../state/store';

export function statusText(debtFreeDate: string | null, paydaysLeft: number | null, anyActive: boolean): string {
  if (!anyActive) return 'Debt-free';
  if (!debtFreeDate) return 'More than 20 years at this pace';
  const left = paydaysLeft === null ? '' : ` · ${paydaysLeft} payday${paydaysLeft === 1 ? '' : 's'} left`;
  return `Debt-free ${shortMonthYear(debtFreeDate)}${left}`;
}

export function StatusLine() {
  const r = plan.value;
  if (!r) return null;
  return (
    <p class="muted small num" data-testid="status-line">
      {statusText(r.debtFreeDate, r.paydaysToDebtFree, (r.paydaysToDebtFree ?? 1) > 0)}
    </p>
  );
}
