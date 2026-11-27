/**
 * What used to sit low on Today: the balance chart, the focus debt and the daily cost. They live on Path now, so Today
 * stays short: the date, the debt-free day, this payday, one read, what is coming up.
 */
import { dailyInterestCost, growingDebts } from '../engine';
import { formatMoney } from '../lib/money';
import { diffDays, shortDate, shortMonthYear } from '../lib/today';
import { activeDebts, nextPaydayISO, toDebtInput } from '../state/planInput';
import { data, openDebtId, plan, tab, today } from '../state/store';
import { MiniChart } from '../today/MiniChart';
import { dailyCostLastMonth, focusDebt, focusSentence, whyFirst } from '../today/model';
import { Bar, HelpTip } from '../ui/controls';
import { Count } from '../ui/useCountUp';

export function FocusSection(props: { minimumsEnd?: string | null }) {
  const d = data.value!;
  const r = plan.value!;
  const s = d.settings;
  const cur = s.currency;
  const active = activeDebts(d);
  if (active.length === 0) return null;
  const focus = focusDebt(d, r);
  const growingNow = new Set(growingDebts(d.debts.filter((x) => x.status === 'active').map(toDebtInput)));
  const nextDate = nextPaydayISO(s);
  const goneLabel = (iso: string | null) => (iso ? (diffDays(today.value, iso) <= 100 ? shortDate(iso) : shortMonthYear(iso)) : null);
  const focusIdx = focus ? r.rows.findIndex((x) => x.debts.some((y) => y.id === focus.debt.id && y.balanceAfter <= 0.005)) : -1;
  const daily = dailyInterestCost(active);
  const lastMonth = dailyCostLastMonth(d, today.value);

  return (
    <>
      <MiniChart />
      {props.minimumsEnd && (
        <p class="muted small" data-testid="minimums-line" style={{ marginTop: -6, paddingLeft: 4 }}>
          With minimums only: {props.minimumsEnd}.
        </p>
      )}

      {focus && (
        <section class="card stack" style={{ gap: 8 }} aria-label="Focus debt">
          {/* The name, the balance and the bar are one door to this debt on the Debts tab */}
          <button
            type="button"
            class="door-btn"
            aria-label={`${focus.debt.name}, open in Debts`}
            onClick={() => {
              openDebtId.value = focus.debt.id;
              tab.value = 'debts';
            }}
          >
            <span class="row">
              <span class="label">Focus debt</span>
              {goneLabel(focus.goneBy) && <span class="muted small">gone by {goneLabel(focus.goneBy)}</span>}
            </span>
            <span class="row">
              <span class="focus-name">{focus.debt.name}</span>
              <span class="num">
                <b>
                  <Count value={focus.left} id={`focus-${focus.debt.id}`} format={(n) => formatMoney(n, cur, { whole: true })} />
                </b>{' '}
                left
              </span>
            </span>
            <Bar pct={focus.pctGone} label={`${focus.debt.name} paid off`} />
          </button>
          <div class="row" style={{ justifyContent: 'flex-start', gap: 0 }}>
            <p class="muted" data-testid="focus-sentence">
              {/* "gone by" above already says when: one short sentence */}
              {!focus.grown && focusIdx >= 0 && goneLabel(focus.goneBy)
                ? `${Math.floor(focus.pctGone)}% gone.`
                : focusSentence(focus.grown ? null : focus.pctGone, focusIdx < 0 ? null : focusIdx, nextDate <= today.value)}
            </p>
            <HelpTip title="Why this one?">
              <p data-testid="focus-why">{whyFirst(s.method, growingNow.has(focus.debt.id))}</p>
            </HelpTip>
          </div>
        </section>
      )}

      <div class="card tile-card" data-testid="daily-cost">
        <p class="muted small">
          Daily cost
          <HelpTip title="Daily cost">
            <p>It is the interest your debts add each day. It drops as balances go down.</p>
          </HelpTip>
        </p>
        <p class="tile-val num">{formatMoney(daily, cur)}</p>
        {lastMonth !== null && <p class="muted small">Last month {formatMoney(lastMonth, cur)}</p>}
      </div>
    </>
  );
}
