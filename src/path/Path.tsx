/**
 * Path (ux-v2.md section 5): "When am I done, and how far have I come?" Plan and Progress are one screen.
 * The what-if and the payday list are bottom sheets. The method comparison shows only when the rule fires.
 */
import { signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import { compareMethods, type PayoffMethod } from '../engine';
import { downloadText, planToCsv } from '../lib/csv';
import { formatMoney } from '../lib/money';
import { makeMilestoneImage, shareImage } from '../lib/shareImage';
import { chartData } from '../lib/series';
import { addDaysISO, diffDays, monthYear, shortDate, shortMonthYear } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { isDebtFree } from '../state/debtFree';
import { MILESTONE_LABELS, projectedDate, progressStats } from '../state/milestones';
import { setMethod } from '../state/planActions';
import { activeDebts, countedDebts, nextPaydayISO, toPlanInput } from '../state/planInput';
import { act, data, plan, today } from '../state/store';
import { comparisonLine } from '../state/whatIf';
import { Chart } from '../progress/Chart';
import { useCountUp } from '../ui/useCountUp';
import { Bar, CheckIcon, Choice, Sheet } from '../ui/controls';
import { PaydayListSheet } from './PaydayListSheet';
import { WhatIfSheet } from './WhatIfSheet';
import { COPY } from '../lib/copy';

/** Kept for the Settings and Today links that open Path on a given view. */
export type PathView = 'progress' | 'plan';
export const pathView = signal<PathView>('progress');

const MAX_SQUARES = 156;

const ORDER_NAME: Record<PayoffMethod, string> = {
  paidinyellow: 'smallest first',
  'biggest-interest': 'biggest interest first',
  'my-order': 'my own order',
};

interface Ahead {
  key: string;
  title: string;
  when: string;
  kind: 'next' | 'later' | 'end';
}

export function Path() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const r = plan.value!;
  const stats = progressStats(d);
  const active = activeDebts(d);
  const counted = countedDebts(d);
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const debtFree = isDebtFree(d);

  const [sheet, setSheet] = useState<'whatif' | 'list' | 'order' | 'export' | null>(null);
  const [shareMsg, setShareMsg] = useState('');
  const close = () => setSheet(null);

  const { method: _m, ...rest } = toPlanInput(d);
  const cmp = useMemo(() => compareMethods(rest), [d]);

  const mo = r.minimumsOnly;
  const avoided = mo.totalInterest !== null ? mo.totalInterest - r.totalInterest : null;
  const paydaysLeft = r.paydaysToDebtFree;
  const pct = Math.floor(stats.pct);
  const shownPct = useCountUp(pct);

  // Payday grid: 2 squares already yellow, then done and skipped paydays, then what is ahead
  const past = d.paydays;
  const ahead = paydaysLeft ?? r.rows.length;
  const aheadShown = Math.max(0, Math.min(ahead, MAX_SQUARES - 2 - past.length));
  const currentIndex = past.length + 2; // the next payday: ink outline

  // What's ahead: milestones only. Months for anything further than 3 months away.
  const nextPayday = nextPaydayISO(s);
  const timeline = useMemo<Ahead[]>(() => {
    const items: { date: string; title: string; end: boolean }[] = [];
    const goneDates = Object.entries(r.paidOff)
      .filter(([id]) => d.debts.find((x) => x.id === id)?.status === 'active')
      .map(([id, date]) => ({ id, date }))
      .sort((a, b) => a.date.localeCompare(b.date));
    goneDates.forEach((g, i) => {
      const last = i === goneDates.length - 1 && g.date === r.debtFreeDate;
      items.push({ date: g.date, title: last ? `${nameOf(g.id)} gone. Debt-free.` : `${nameOf(g.id)} gone`, end: last });
    });
    const half = d.milestones.some((m) => m.id === 'pct-50') ? null : projectedDate('pct-50', d, r);
    if (half) items.push({ date: half, title: 'Halfway there', end: false });
    if (r.debtFreeDate && !items.some((i) => i.end)) items.push({ date: r.debtFreeDate, title: 'Debt-free', end: true });
    items.sort((a, b) => a.date.localeCompare(b.date) || Number(a.end) - Number(b.end));
    return items.slice(0, 5).map((it, i) => {
      const near = diffDays(today.value, it.date) <= 92;
      const when = it.end ? monthYear(it.date) : near ? `${shortDate(it.date, today.value)}${it.date === nextPayday ? ' · next payday' : ''}` : `around ${shortMonthYear(it.date)}`;
      return { key: `${it.title}-${it.date}`, title: it.title, when, kind: it.end ? 'end' : i === 0 ? 'next' : 'later' };
    });
  }, [d, r]);

  const reachedList = d.milestones.filter((m) => m.id !== 'plan-made').sort((x, y) => x.reachedOn.localeCompare(y.reachedOn));

  const choose = (m: PayoffMethod) => act((db, x) => setMethod(db, x, m));

  const rowBills = useMemo(() => r.rows.map((_, i) => billsForPlanRow(d, r, i)), [d, r]);
  const rowTotals = useMemo(() => r.rows.map((row, i) => totalOf(rowBills[i]!, row)), [r, rowBills]);
  const csv = () => downloadText('paidinyellow-plan.csv', planToCsv(r.rows.map((row, i) => ({ row, billsDue: rowBills[i]!.total, total: rowTotals[i]! })), nameOf));

  const chart = chartData(today.value, active, r, stats.owed);
  const month = today.value.slice(0, 7);
  const thisMonth = past.filter((p) => p.status === 'done' && p.date.startsWith(month));
  const actual = thisMonth.reduce((sum, p) => sum + p.total, 0);
  const planned = thisMonth.reduce((sum, p) => sum + (p.plannedTotal ?? p.total), 0);

  const share = async () => {
    setShareMsg('');
    const blob = await makeMilestoneImage({ pct: stats.pct, debtsGone: counted.filter((x) => x.status === 'paid').length, debtsTotal: counted.length });
    const how = await shareImage(blob);
    setShareMsg(how === 'saved' ? 'Saved as a picture. It shows percentages only.' : '');
  };

  return (
    <main class="screen with-tabs">
      <header class="stack" style={{ gap: 2 }}>
        <h1>Your path</h1>
        <p class="muted num" data-testid="status-line">
          {debtFree ? (
            'Debt-free'
          ) : r.debtFreeDate ? (
            <>
              Debt-free by <span class="hl">{shortMonthYear(r.debtFreeDate)}</span>
              {paydaysLeft !== null ? ` · ${paydaysLeft} payday${paydaysLeft === 1 ? '' : 's'} left` : ''}
            </>
          ) : (
            'More than 20 years at this pace'
          )}
        </p>
      </header>

      <section class="card stack" aria-label="Paid so far">
        <div class="row" style={{ alignItems: 'baseline' }}>
          <p class="path-pct num" data-testid="pct-gone">
            {Math.round(shownPct)}%
          </p>
          <span class="muted">gone</span>
        </div>
        <Bar pct={stats.pct} label="Debt paid off" />
        <div class="path-stats">
          <div>
            <p class="num path-stat" data-testid="paid-so-far">
              {formatMoney(stats.paid, cur, { whole: true })}
            </p>
            <p class="muted small">paid</p>
          </div>
          <div>
            <p class="num path-stat" data-testid="to-go">
              {formatMoney(stats.owed, cur, { whole: true })}
            </p>
            <p class="muted small">to go</p>
          </div>
          <div>
            {mo.neverEnds ? (
              <>
                <p class="path-stat">Never ends</p>
                <p class="muted small">with minimums only</p>
              </>
            ) : avoided !== null && avoided >= 1 ? (
              <>
                <p class="num path-stat" data-testid="interest-avoided">
                  {formatMoney(avoided, cur, { whole: true })}
                </p>
                <p class="muted small">interest avoided</p>
              </>
            ) : (
              <>
                <p class="num path-stat">{formatMoney(r.totalInterest, cur, { whole: true })}</p>
                <p class="muted small">interest ahead</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section class="card stack" aria-labelledby="grid-title">
        <div class="row" style={{ alignItems: 'baseline' }}>
          <p class="label" id="grid-title">
            Every payday
          </p>
          <span class="muted small">paid ones turn yellow</span>
        </div>
        <div class="payday-grid" role="list">
          {['Debts listed', 'Plan made'].map((label) => (
            <div key={label} class="sq on" role="listitem" aria-label={label} title={label}>
              <CheckIcon />
            </div>
          ))}
          {past.map((p) => (
            <div key={p.id} class={`sq${p.status === 'done' ? ' on' : ' skipped'}`} role="listitem" aria-label={`${shortDate(p.date)}: ${p.status === 'done' ? 'paid' : 'skipped'}`} title={shortDate(p.date)}>
              {p.status === 'done' ? <CheckIcon /> : <span>skip</span>}
            </div>
          ))}
          {Array.from({ length: aheadShown }, (_, i) => (
            <div
              key={`a${i}`}
              class={`sq future${past.length + 2 + i === currentIndex ? ' current' : ''}`}
              role="listitem"
              aria-label={r.rows[i] ? `${shortDate(r.rows[i]!.date)}: ${i === 0 ? 'next' : 'to come'}` : 'to come'}
            />
          ))}
        </div>
        <p class="muted small">The first two squares are done already: debts listed, plan made.</p>
        {ahead > aheadShown && <p class="muted small">+ {ahead - aheadShown} more paydays after these.</p>}
      </section>

      {debtFree && (
        <section class="card">
          <p>You’re debt-free. Every debt is paid or archived, so there is nothing left to plan.</p>
        </section>
      )}

      {!debtFree && timeline.length > 0 && (
        <section class="card stack" aria-labelledby="ahead-title" data-testid="whats-ahead">
          <p class="label" id="ahead-title">
            What’s ahead
          </p>
          <ul class="ahead-list">
            {timeline.map((t) => (
              <li key={t.key}>
                <span class={`ahead-dot ${t.kind}`} aria-hidden="true" />
                <span class="stack" style={{ gap: 0 }}>
                  <b>{t.title}</b>
                  <span class="muted small">{t.when}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reachedList.length > 0 && (
        <section class="card stack" aria-labelledby="reached-title">
          <p class="label" id="reached-title">
            Reached
          </p>
          <ul class="ahead-list">
            {reachedList.map((m) => (
              <li key={m.id} aria-label={`${MILESTONE_LABELS[m.id]}, reached`}>
                <span class="ahead-dot reached" aria-hidden="true" />
                <span class="stack" style={{ gap: 0 }}>
                  <b>{MILESTONE_LABELS[m.id]}</b>
                  <span class="muted small">{shortDate(m.reachedOn, today.value)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!debtFree && cmp.suggestBiggestInterest && s.method !== 'biggest-interest' && (
        <section class="card row" data-testid="comparison">
          <span class="small">{comparisonLine(cmp, cur)}</span>
          <button type="button" class="btn small" onClick={() => choose('biggest-interest')}>
            Switch
          </button>
        </section>
      )}

      {!debtFree && (
        <div class="grid-2">
          <button type="button" class="btn" onClick={() => setSheet('whatif')}>
            What if I add more?
          </button>
          <button type="button" class="btn ghost" onClick={() => setSheet('list')}>
            Payday list
          </button>
        </div>
      )}
      {debtFree && (
        <button type="button" class="btn ghost" onClick={() => setSheet('list')}>
          Payday list
        </button>
      )}

      <div class="row">
        <p class="muted small">
          Order: {ORDER_NAME[s.method]}
          {!debtFree && (
            <>
              {' · '}
              <button type="button" class="link small" onClick={() => setSheet('order')}>
                change
              </button>
            </>
          )}
        </p>
        <button type="button" class="link small" onClick={() => setSheet('export')}>
          Print or export
        </button>
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
        {shareMsg && (
          <p class="small" role="status">
            {shareMsg}
          </p>
        )}
      </section>

      <WhatIfSheet open={sheet === 'whatif'} onClose={close} />
      <PaydayListSheet open={sheet === 'list'} onClose={close} />

      <Sheet open={sheet === 'order'} onClose={close} title="Which debt first?">
        <div class="stack" role="radiogroup" aria-label="Payoff order" style={{ gap: 8 }}>
          <Choice checked={s.method === 'paidinyellow'} onSelect={() => choose('paidinyellow')} title="PaidInYellow order" sub="Smallest first. Debts that grow go first." />
          <Choice checked={s.method === 'biggest-interest'} onSelect={() => choose('biggest-interest')} title="Biggest interest first" sub="Highest rate first." />
          <Choice checked={s.method === 'my-order'} onSelect={() => choose('my-order')} title="My own order" sub="The order your debts are in on the Debts tab." />
        </div>
        <p class="muted small" data-testid="order-comparison">
          {comparisonLine(cmp, cur)}
        </p>
        <button type="button" class="btn" onClick={close}>
          Done
        </button>
      </Sheet>

      <Sheet open={sheet === 'export'} onClose={close} title="Print or export">
        <button type="button" class="btn ghost" onClick={csv}>
          Export CSV
        </button>
        <button type="button" class="btn ghost" onClick={() => window.print()}>
          Print one page
        </button>
        <button type="button" class="link" onClick={close}>
          Close
        </button>
      </Sheet>

      {/* Printed by "Print one page": everything else is hidden in print */}
      <section class="print-only" aria-hidden="true">
        <h1>My payoff plan · PaidInYellow</h1>
        <p>{debtFree ? 'Debt-free' : r.debtFreeDate ? `Debt-free by ${monthYear(r.debtFreeDate)}` : 'More than 20 years at this pace'}</p>
        <p>Order: {r.order.map(nameOf).join(', ')}</p>
        <table>
          <thead>
            <tr>
              <th>Payday</th>
              <th>Date</th>
              <th>Total</th>
              <th>Extra goes to</th>
              <th>Debt left</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.slice(0, 26).map((row, i) => (
              <tr key={row.payday}>
                <td>{row.payday}</td>
                <td>{shortDate(row.date)}</td>
                <td>{formatMoney(rowTotals[i]!, cur)}</td>
                <td>{row.extraGoesTo ? nameOf(row.extraGoesTo) : row.bufferFirst ? 'Buffer first' : ''}</td>
                <td>{formatMoney(row.debtLeft, cur, { whole: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{COPY.disclaimer}</p>
      </section>
    </main>
  );
}
