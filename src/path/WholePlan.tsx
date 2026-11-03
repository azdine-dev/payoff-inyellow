/**
 * Your whole plan (design/path-features/WholePlan): opened from one card at the top of Path. It is a detail screen
 * inside Path, not a tab. Total to your debts, plan against minimums only, the next 30 days, and totals by year.
 */
import { useMemo } from 'preact/hooks';
import type { AppData } from '../data/types';
import type { PlanResult } from '../engine';
import { formatMoney } from '../lib/money';
import { fullDate } from '../lib/today';
import { wholePlanOpen } from '../state/store';
import { buildWholePlan } from './wholePlanModel';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n: number) => (n <= 10 ? WORDS[n]! : String(n));

/** The one card at the top of Path */
export function WholePlanCard(props: { d: AppData; r: PlanResult; today: string }) {
  const { d, r, today } = props;
  const w = useMemo(() => buildWholePlan(d, r, today), [d, r, today]);
  const money = (n: number) => formatMoney(n, d.settings.currency, { whole: true });
  if (!w.debtCount || !w.paydays) return null;
  return (
    <button type="button" class="card wp-card-link" data-testid="whole-plan-card" aria-label="Your whole plan" onClick={() => (wholePlanOpen.value = true)}>
      <span class="stack" style={{ gap: 2 }}>
        <span class="label">Your whole plan</span>
        <span>
          <b class="num">{money(w.total)}</b> to your debts · {w.paydays} payday{w.paydays === 1 ? '' : 's'}
        </span>
      </span>
      <span aria-hidden="true" class="muted">
        ›
      </span>
    </button>
  );
}

export function WholePlan(props: { d: AppData; r: PlanResult; today: string }) {
  const { d, r, today } = props;
  const cur = d.settings.currency;
  const w = useMemo(() => buildWholePlan(d, r, today), [d, r, today]);
  const money = (n: number) => formatMoney(n, cur, { whole: true });
  const planPct = w.minimumsInterest && w.minimumsInterest > 0 ? Math.min(100, Math.max(2, (w.interest / w.minimumsInterest) * 100)) : null;
  const thisYear = Number(today.slice(0, 4));
  const from = w.from && w.to ? (w.from.slice(0, 4) === w.to.slice(0, 4) || w.from.slice(0, 4) === today.slice(0, 4) ? fullDate(w.from).replace(/ \d{4}$/, '') : fullDate(w.from)) : '';

  return (
    <div class="stack" style={{ gap: 12 }} data-testid="whole-plan">
      <div class="wp-band">
        <button type="button" class="wp-back" onClick={() => (wholePlanOpen.value = false)}>
          ‹ Path
        </button>
        <h1>Your whole plan</h1>
        {w.from && w.to && (
          <p class="muted small" data-testid="wp-sub">
            {w.paydays} payday{w.paydays === 1 ? '' : 's'}, from {from} to {fullDate(w.to)}
          </p>
        )}
      </div>

      <section class="card stack" style={{ gap: 6, borderWidth: '1.5px', borderColor: 'var(--ink)' }} aria-label="In total">
        <p class="muted small">
          To your {count(w.debtCount)} debt{w.debtCount === 1 ? '' : 's'}, in total
        </p>
        <p class="wp-total num" data-testid="wp-total">
          {money(w.total)}
        </p>
        <p data-testid="wp-owe">
          That’s what you owe, {money(w.owed)}, plus <b>{money(w.interest)} interest</b>.
        </p>
        {planPct !== null && w.minimumsInterest !== null && (
          <div class="stack" style={{ gap: 8, marginTop: 6 }}>
            <div class="stack" style={{ gap: 4 }}>
              <div class="row small">
                <span>Your plan</span>
                <b data-testid="wp-plan-interest">{money(w.interest)} interest</b>
              </div>
              <div class="wp-bar" aria-hidden="true">
                <i class="plan" style={{ width: `${planPct}%` }} />
              </div>
            </div>
            <div class="stack" style={{ gap: 4 }}>
              <div class="row small muted">
                <span>Minimums only</span>
                <span data-testid="wp-min-interest">{money(w.minimumsInterest)} interest</span>
              </div>
              <div class="wp-bar" aria-hidden="true">
                <i class="min" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        )}
        {w.kept !== null && w.kept >= 1 && (
          <p style={{ marginTop: 4 }} data-testid="wp-kept">
            You keep <b>{money(w.kept)}</b> that would have gone to interest.
          </p>
        )}
        {w.minimumsInterest === null && <p class="muted small">With minimums only, your debts never end. Your plan does.</p>}
      </section>

      {w.next30.paydays > 0 && (
        <section class="card stack" style={{ gap: 4 }} aria-label="Next 30 days" data-testid="wp-next30">
          <p class="label">Next 30 days</p>
          <p>
            You’ll move <b>{money(w.next30.total)}</b> over {w.next30.paydays} payday{w.next30.paydays === 1 ? '' : 's'}.
          </p>
          <div class="stack" style={{ gap: 0, marginTop: 6 }}>
            {(
              [
                ['To debts', w.next30.debts],
                ['To your buffer', w.next30.buffer],
                ['To yearly bills', w.next30.yearly],
              ] as const
            )
              .filter(([, n]) => n > 0.004)
              .map(([label, n]) => (
                <div key={label} class="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>{label}</span>
                  <b class="num">{money(n)}</b>
                </div>
              ))}
          </div>
        </section>
      )}

      <section class="card calm stack" style={{ gap: 8 }} aria-label="By year" data-testid="wp-years">
        <p class="label">By year</p>
        {w.byYear.map((y, i) => (
          <div key={y.year} class="row">
            <span>
              {i === 0 && y.year === thisYear ? `Rest of ${y.year}` : y.year} · {y.paydays} payday{y.paydays === 1 ? '' : 's'}
            </span>
            <b class="num">{money(y.total)}</b>
          </div>
        ))}
        <p class="muted small">Includes buffer and yearly bills, so you can plan your budget.</p>
      </section>
    </div>
  );
}
