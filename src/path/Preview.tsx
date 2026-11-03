/**
 * Path, Preview: a read-only look at a future payday, from the plan as it stands. Nothing is saved and nothing
 * can be ticked here. A banner says so, with a way back.
 */
import { useEffect } from 'preact/hooks';
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { formatMoney } from '../lib/money';
import { dayMonth, monthsBetween, shortDate } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { progressStats } from '../state/milestones';
import { previewDate } from '../state/store';
import { Scene, sceneStage, STAGE_NAMES } from '../ui/Scene';

/** The words for "how long to go" from the previewed date */
export function monthsToGoText(debtLeft: number, date: string, debtFreeDate: string | null): string {
  if (debtLeft <= 0.005) return 'Debt-free by then';
  if (!debtFreeDate) return 'More than 20 years at this pace';
  const n = Math.max(0, monthsBetween(date, debtFreeDate));
  return n === 0 ? 'Less than a month to go' : `${n} month${n === 1 ? '' : 's'} to debt-free`;
}

export function PathPreview(props: { d: AppData; r: PlanResult; today: string }) {
  const { d, r, today } = props;
  const date = previewDate.value;
  const i = date ? r.rows.findIndex((x) => x.date === date) : -1;
  // The preview belongs to Path: leaving it takes it away
  useEffect(() => () => void (previewDate.value = null), []);
  if (i < 0 || !date) return null;

  const row = r.rows[i]!;
  const cur = d.settings.currency;
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const bills = billsForPlanRow(d, r, i);
  const total = totalOf(bills, row);
  const stats = progressStats(d);
  const pctGone = stats.start > 0 ? Math.min(100, Math.max(0, (1 - row.debtLeft / stats.start) * 100)) : 0;
  const stage = sceneStage(pctGone, row.debtLeft > 0.005);
  const goneBy = d.debts.filter((x) => x.status === 'active' && row.debts.some((y) => y.id === x.id && y.balanceAfter <= 0.005));
  const label = shortDate(date, today);

  return (
    <div class="stack" style={{ gap: 12 }} data-testid="path-preview">
      <div class="card calm row" role="status" data-testid="preview-banner">
        <span>
          <b>Preview of {label}.</b> Nothing changes.
        </span>
        <button type="button" class="btn small" onClick={() => (previewDate.value = null)}>
          Back to today
        </button>
      </div>

      <section class="card stack" style={{ gap: 4 }} aria-label="Still owed then">
        <p class="label">Total owed after this payday</p>
        <p class="big num" data-testid="preview-owed" style={{ fontSize: '2rem', fontWeight: 800 }}>
          {formatMoney(row.debtLeft, cur, { whole: true })}
        </p>
        <p data-testid="preview-months">{monthsToGoText(row.debtLeft, date, r.debtFreeDate)}</p>
      </section>

      <section class="card stack" style={{ gap: 6 }} aria-label="Debts paid by then">
        <p class="label">Debts paid by then</p>
        <p data-testid="preview-paid">{goneBy.length ? goneBy.map((x) => x.name).join(', ') : 'None yet'}</p>
        <p class="label">Buffer</p>
        <p class="num" data-testid="preview-buffer">
          {formatMoney(row.bufferAfter, cur, { whole: true })} of {formatMoney(d.settings.bufferGoal, cur, { whole: true })}
        </p>
      </section>

      <section class="card stack" style={{ gap: 6 }} aria-label="Your scene then">
        <Scene stage={stage} label={`Your scene then: ${STAGE_NAMES[stage]}`} />
        <p class="muted small" data-testid="preview-stage">
          {STAGE_NAMES[stage]}
        </p>
      </section>

      <section class="card stack pd-detail" style={{ gap: 6 }} role="group" aria-label={`${label} details`}>
        <p class="label">What this payday does</p>
        {bills.due.map((b) => (
          <div key={b.debtId} class="row">
            <span>{`${b.name}, due ${dayMonth(b.due)}`}</span>
            <span class="num">{formatMoney(b.amount, cur)}</span>
          </div>
        ))}
        {row.toYearlyBills > 0.004 && (
          <div class="row">
            <span>Yearly bills</span>
            <span class="num">{formatMoney(row.toYearlyBills, cur)}</span>
          </div>
        )}
        {row.toBuffer > 0.004 && (
          <div class="row">
            <span>Buffer</span>
            <span class="num">{formatMoney(row.toBuffer, cur)}</span>
          </div>
        )}
        {row.debts
          .filter((x) => x.extra > 0.004)
          .map((x) => (
            <div key={x.id} class="row">
              <span>
                Extra to <span class="hl">{nameOf(x.id)}</span>
              </span>
              <span class="num">{formatMoney(x.extra, cur)}</span>
            </div>
          ))}
        <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
          <span>Total</span>
          <span class="num">{formatMoney(total, cur)}</span>
        </div>
        <p class="muted small num" data-testid="debt-left-after">
          Debt left after: {formatMoney(row.debtLeft, cur)}
        </p>
        <p class="muted small">The plan as it stands. Nothing here is saved or ticked.</p>
      </section>
    </div>
  );
}
