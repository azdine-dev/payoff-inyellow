/** Progress (mockup screen 3): paid so far, chart, payday grid, milestones. */
import { useState } from 'preact/hooks';
import { CheckIcon, Bar } from '../ui/controls';
import { chartData } from '../lib/series';
import { formatMoney } from '../lib/money';
import { makeMilestoneImage, shareImage } from '../lib/shareImage';
import { addDaysISO, monthYear, shortDate, shortMonthYear } from '../lib/today';
import { MILESTONE_LABELS, MILESTONE_ORDER, progressStats, projectedDate } from '../state/milestones';
import { activeDebts, countedDebts } from '../state/planInput';
import { data, plan, today } from '../state/store';
import { Chart } from './Chart';

const MAX_SQUARES = 156;

export function Progress() {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const stats = progressStats(d);
  const active = activeDebts(d);
  const counted = countedDebts(d);
  const [shareMsg, setShareMsg] = useState('');

  const mo = r.minimumsOnly;
  const avoided = mo.totalInterest !== null ? mo.totalInterest - r.totalInterest : null;
  const paydaysLeft = r.paydaysToDebtFree;

  // Payday grid: 2 squares already yellow, then done and skipped paydays, then what is ahead
  const past = d.paydays;
  const ahead = paydaysLeft ?? r.rows.length;
  const aheadShown = Math.max(0, Math.min(ahead, MAX_SQUARES - 2 - past.length));

  const chart = chartData(today.value, active, r, stats.owed);
  const reached = new Map(d.milestones.map((m) => [m.id, m.reachedOn]));

  // Planned vs actual, for paydays done in this calendar month
  const month = today.value.slice(0, 7);
  const thisMonth = past.filter((p) => p.status === 'done' && p.date.startsWith(month));
  const actual = thisMonth.reduce((s, p) => s + p.total, 0);
  const planned = thisMonth.reduce((s, p) => s + (p.plannedTotal ?? p.total), 0);

  const share = async () => {
    setShareMsg('');
    const blob = await makeMilestoneImage({
      pct: stats.pct,
      debtsGone: counted.filter((x) => x.status === 'paid').length,
      debtsTotal: counted.length,
    });
    const how = await shareImage(blob);
    setShareMsg(how === 'saved' ? 'Saved as a picture. It shows percentages only.' : '');
  };

  return (
    <main class="screen with-tabs">
      <h1>Progress</h1>

      <section class="card stack" aria-label="Paid so far">
        <p class="label">Paid so far</p>
        <p class="num" style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '2.4rem', lineHeight: 1.1 }} data-testid="paid-so-far">
          {formatMoney(stats.paid, cur, { whole: true })}
        </p>
        <Bar pct={stats.pct} label="Debt paid off" />
        <p class="muted small num">
          {Math.floor(stats.pct)}% of {formatMoney(stats.start, cur, { whole: true })}
          {paydaysLeft !== null ? ` · ${paydaysLeft} paydays left` : ''}
        </p>
      </section>

      <div class="grid-2">
        <div class="card">
          <p class="num" style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.4rem' }}>
            {formatMoney(stats.owed, cur, { whole: true })}
          </p>
          <p class="muted small">still owed</p>
        </div>
        <div class="card">
          {mo.neverEnds ? (
            <>
              <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.4rem' }}>Never ends</p>
              <p class="muted small">with minimums only. Your plan ends it.</p>
            </>
          ) : avoided !== null && avoided >= 1 ? (
            <>
              <p class="num" style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.4rem' }}>
                {formatMoney(avoided, cur, { whole: true })}
              </p>
              <p class="muted small">interest avoided vs minimums</p>
            </>
          ) : (
            <>
              <p class="num" style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.4rem' }}>
                {formatMoney(r.totalInterest, cur, { whole: true })}
              </p>
              <p class="muted small">interest still ahead</p>
            </>
          )}
        </div>
      </div>

      {stats.owed > 0 && (
        <section class="card stack" aria-label="Balance over time">
          <h2>Your balance over time</h2>
          <Chart
            data={chart}
            startLabel="Now"
            endLabel={shortMonthYear(addDaysISO(today.value, Math.round(chart.xMax)))}
            planEndLabel={r.debtFreeDate ? `Debt-free ${shortMonthYear(r.debtFreeDate)}` : null}
            minimumsEnd={chart.minimumsMonths === null ? null : shortMonthYear(addDaysISO(today.value, Math.round(chart.minimumsMonths * 30.44)))}
            label="Balance over time, your plan against minimums only"
          />
        </section>
      )}

      <section class="card stack" aria-labelledby="grid-title">
        <div class="row" style={{ alignItems: 'baseline' }}>
          <h2 id="grid-title">Your paydays</h2>
          <span class="muted small">each paid payday turns yellow</span>
        </div>
        <div class="payday-grid" role="list">
          {['list', 'plan'].map((t) => (
            <div key={t} class="sq on" role="listitem" aria-label={t === 'list' ? 'Debts listed' : 'Plan made'}>
              <span>{t}</span>
              <CheckIcon />
            </div>
          ))}
          {past.map((p) => (
            <div
              key={p.id}
              class={`sq${p.status === 'done' ? ' on' : ' skipped'}`}
              role="listitem"
              aria-label={`${shortDate(p.date)}: ${p.status === 'done' ? 'paid' : 'skipped'}`}
              title={shortDate(p.date)}
            >
              {p.status === 'done' ? <CheckIcon /> : <span>skip</span>}
            </div>
          ))}
          {Array.from({ length: aheadShown }, (_, i) => (
            <div key={`a${i}`} class="sq" role="listitem" aria-label={r.rows[i] ? `${shortDate(r.rows[i]!.date)}: to come` : 'to come'} />
          ))}
        </div>
        {ahead > aheadShown && <p class="muted small">+ {ahead - aheadShown} more paydays after these.</p>}
      </section>

      <section class="card stack" aria-labelledby="ms-title">
        <h2 id="ms-title">Milestones</h2>
        <ul class="stack" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 4 }}>
          {MILESTONE_ORDER.map((key) => {
            const on = reached.get(key);
            const when = on ?? projectedDate(key, d, r);
            return (
              <li key={key} class="row" style={{ justifyContent: 'flex-start', minHeight: 36, gap: 12 }} aria-label={`${MILESTONE_LABELS[key]}${on ? ', reached' : ''}`}>
                <span class={`ms-dot${on ? ' on' : ''}`} aria-hidden="true">
                  {on && <CheckIcon />}
                </span>
                <span style={{ flex: 1 }}>{MILESTONE_LABELS[key]}</span>
                {when && (
                  <span class="muted small num">
                    {on ? shortDate(when) : monthYear(when)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {thisMonth.length > 0 && (
        <p class="card num" data-testid="planned-vs-actual">
          This month you paid <b>{formatMoney(actual, cur, { whole: true })}</b> of <b>{formatMoney(planned, cur, { whole: true })}</b> planned.
        </p>
      )}

      <section class="card stack">
        <p class="muted small">A picture of your progress to share. It shows percentages only, never amounts or names.</p>
        <button type="button" class="btn ghost" onClick={share}>
          Share my progress
        </button>
        {shareMsg && <p class="small" role="status">{shareMsg}</p>}
      </section>
    </main>
  );
}
