import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { compareMethods, type PayoffMethod } from '../engine';
import { downloadText, planToCsv } from '../lib/csv';
import { formatMoney } from '../lib/money';
import { makeMilestoneImage, shareImage } from '../lib/shareImage';
import { chartData } from '../lib/series';
import { addDaysISO, monthsBetween, monthYear, shortDate, shortMonthYear } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { isDebtFree } from '../state/debtFree';
import { MILESTONE_LABELS, progressStats } from '../state/milestones';
import { setMethod } from '../state/planActions';
import { activeDebts, countedDebts, nextPaydayISO, toPlanInput } from '../state/planInput';
import { act, data, freshPaidDebts, freshPayday, plan, today } from '../state/store';
import { comparisonLine } from '../state/whatIf';
import { worthKnowing } from '../state/worthKnowing';
import { focusDebt } from '../today/model';
import { Chart } from '../progress/Chart';
import { Count } from '../ui/useCountUp';
import { Choice, HelpTip, Sheet } from '../ui/controls';
import { Ring } from '../ui/Ring';
import { PaydayCalendar } from './PaydayCalendar';
import { PaydayListBody } from './PaydayListSheet';
import { PayMore } from './PayMore';
import { Road } from './Road';
import { buildRoad, finishIndexFor, type RoadFlag } from './roadModel';
import { WhatIfSheet } from './WhatIfSheet';
import { PrintDebts, PrintPayday } from './PrintSheets';
import { paymentsToCsv } from '../state/paymentsCsv';
import { countdownText, readCountdownMode, saveCountdownMode, type CountdownMode } from './countdown';
import { COPY } from '../lib/copy';

/** Kept for the Settings and Today links that open Path on a given view. */
export type PathView = 'progress' | 'plan';
export const pathView = signal<PathView>('progress');

const ORDER_NAME: Record<PayoffMethod, string> = {
  paidinyellow: 'smallest first',
  'biggest-interest': 'biggest interest first',
  'my-order': 'my own order',
};

type View = 'road' | 'list' | 'calendar';

function IconOrder() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M5 7h14M5 12h10M5 17h6" />
    </svg>
  );
}
function IconPrint() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 9V4h10v5M7 17H5v-6h14v6h-2M8 14h8v6H8z" />
    </svg>
  );
}
function IconExport() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 4v11M8 8l4-4 4 4M5 15v4h14v-4" />
    </svg>
  );
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
  const money = (n: number) => formatMoney(n, cur, { whole: true });

  const [view, setView] = useState<View>('road');
  const [sheet, setSheet] = useState<'more' | 'order' | 'print' | 'export' | null>(null);
  const [cmode, setCmode] = useState<CountdownMode>(readCountdownMode);
  // The "Pay a bit more?" amount being tried: how many paydays the plan would take
  const [previewRows, setPreviewRows] = useState<number | null>(null);
  // What "Print" prints: the plan (one page), this payday, or my debts
  const [printKind, setPrintKind] = useState<'plan' | 'payday' | 'debts'>('plan');
  const printNow = (kind: 'plan' | 'payday' | 'debts') => {
    setPrintKind(kind);
    setSheet(null);
    setTimeout(() => window.print(), 60);
  };
  const toggleCountdown = () => {
    const next: CountdownMode = cmode === 'months' ? 'years' : 'months';
    setCmode(next);
    saveCountdownMode(next);
  };
  const [shareMsg, setShareMsg] = useState('');
  const close = () => setSheet(null);

  const { method: _m, ...rest } = toPlanInput(d);
  const cmp = useMemo(() => compareMethods(rest), [d]);

  const mo = r.minimumsOnly;
  const avoided = mo.totalInterest !== null ? mo.totalInterest - r.totalInterest : null;
  const paydaysLeft = r.paydaysToDebtFree;

  const nextPayday = nextPaydayISO(s);
  const road = useMemo(() => buildRoad(d, r, stats.start, stats.pct, today.value), [d, r]);
  const finishIndex =
    road.finishIndex === null ? null : previewRows === null ? road.finishIndex : Math.min(road.squares.length - 1, Math.max(road.firstAhead, finishIndexFor(road, previewRows)));

  const know = worthKnowing(d, r, today.value, { money: (n) => formatMoney(n, cur, { whole: true }), day: (iso) => shortDate(iso, today.value) });
  const reachedList = d.milestones.filter((m) => m.id !== 'plan-made').sort((x, y) => x.reachedOn.localeCompare(y.reachedOn));
  const focus = !debtFree ? focusDebt(d, r) : null;
  const focusIdx = focus ? r.rows.findIndex((x) => x.debts.some((y) => y.id === focus.debt.id && y.balanceAfter <= 0.005)) : -1;

  // The square of the payday just done fills yellow once; a paid-off flag turns into its stamp once
  useEffect(() => {
    if (freshPayday.value === null) return;
    const t = setTimeout(() => (freshPayday.value = null), 900);
    return () => clearTimeout(t);
  }, [freshPayday.value]);
  useEffect(() => {
    if (!freshPaidDebts.value.length) return;
    const t = setTimeout(() => (freshPaidDebts.value = []), 1200);
    return () => clearTimeout(t);
  }, [freshPaidDebts.value]);

  const choose = (m: PayoffMethod) => act((db, x) => setMethod(db, x, m));

  const rowBills = useMemo(() => r.rows.map((_, i) => billsForPlanRow(d, r, i)), [d, r]);
  const rowTotals = useMemo(() => r.rows.map((row, i) => totalOf(rowBills[i]!, row)), [r, rowBills]);
  const paymentsCsv = () => downloadText('paidinyellow-payments.csv', paymentsToCsv(d));
  const csv = () => downloadText('paidinyellow-plan.csv', planToCsv(r.rows.map((row, i) => ({ row, billsDue: rowBills[i]!.total, total: rowTotals[i]! })), nameOf));

  const chart = chartData(today.value, active, r, stats.owed);
  const month = today.value.slice(0, 7);
  const thisMonth = d.paydays.filter((p) => p.status === 'done' && p.date.startsWith(month));
  const actual = thisMonth.reduce((sum, p) => sum + p.total, 0);
  const planned = thisMonth.reduce((sum, p) => sum + (p.plannedTotal ?? p.total), 0);
  const paidCount = counted.filter((x) => x.status === 'paid').length;

  const share = async () => {
    setShareMsg('');
    const blob = await makeMilestoneImage({ pct: stats.pct, debtsGone: paidCount, debtsTotal: counted.length });
    const how = await shareImage(blob);
    setShareMsg(how === 'saved' ? 'Saved as a picture. It shows percentages only.' : '');
  };

  // The words for a flag sheet and its spoken name
  const describe = (f: RoadFlag): { title: string; lines: string[] } => {
    if (f.kind === 'finish') return { title: 'Debt-free', lines: [f.date ? `Your last payment is ${shortDate(f.date, today.value)}.` : 'More than 20 years at this pace.'] };
    if (f.kind === 'half') return { title: 'Halfway', lines: [f.date ? (f.paid ? `Reached ${shortDate(f.date, today.value)}.` : `Around ${shortDate(f.date, today.value)}.`) : 'Half of what you owed is gone.'] };
    const lines = [f.paid ? (f.date ? `Paid off ${shortDate(f.date, today.value)}.` : 'Paid off.') : `Gone ${shortDate(f.date!, today.value)}.`];
    if (f.amount) lines.push(`${money(f.amount)} ${f.paid ? 'paid off' : 'to pay off'}.`);
    return { title: f.title, lines };
  };

  return (
    <main class="screen with-tabs">
      <header class="stack path-head" style={{ gap: 4 }}>
        <h1>Your path</h1>
        {debtFree ? (
          <p class="path-count" data-testid="status-line">
            <span class="hl">Debt-free</span>
          </p>
        ) : r.debtFreeDate ? (
          <>
            <button type="button" class="countdown-toggle path-count" data-testid="countdown-toggle" aria-label="Time to go. Tap to switch between months and years." onClick={toggleCountdown}>
              {countdownText(monthsBetween(today.value, r.debtFreeDate), cmode)}
            </button>
            <p class="num" data-testid="status-line">
              <span class="hl">Debt-free · {shortMonthYear(r.debtFreeDate)}</span>
            </p>
            {paydaysLeft !== null && (
              <p class="muted small num" data-testid="paydays-left">
                {paydaysLeft} payday{paydaysLeft === 1 ? '' : 's'} left
              </p>
            )}
          </>
        ) : (
          <p class="path-count" data-testid="status-line">
            More than 20 years at this pace
          </p>
        )}
      </header>

      <div class="path-stats" role="group" aria-label="Your numbers">
        <div>
          <span class="tile-label">Paid off</span>
          <span class="stat-val num" data-testid="paid-so-far">
            <Count value={stats.paid} id="path-paid" format={money} />
          </span>
        </div>
        <div>
          <span class="tile-label">Still owed</span>
          <span class="stat-val num" data-testid="to-go">
            <Count value={stats.owed} id="path-owed" format={money} />
          </span>
        </div>
        <div>
          <span class="tile-label">{mo.neverEnds || (avoided !== null && avoided >= 1) ? 'Interest you avoid' : 'Interest ahead'}</span>
          <span class="stat-val num" data-testid="interest-avoided">
            {mo.neverEnds ? 'Never ends' : avoided !== null && avoided >= 1 ? money(avoided) : money(r.totalInterest)}
          </span>
        </div>
      </div>

      <section class="card stack" aria-labelledby="road-title">
        <div class="stack" style={{ gap: 8 }}>
          <p class="label" id="road-title">
            Every payday
            <HelpTip title="Every payday">
              <p>One square for each payday. The first two are done already: debts listed, plan made. Each payday you record turns yellow.</p>
            </HelpTip>
          </p>
          <div class="seg wide" role="group" aria-label="Show paydays as">
            {(['road', 'list', 'calendar'] as const).map((v) => (
              <button key={v} type="button" class="seg-btn" aria-pressed={view === v} onClick={() => setView(v)}>
                {v === 'road' ? 'Road' : v === 'list' ? 'List' : 'Calendar'}
              </button>
            ))}
          </div>
        </div>
        {view === 'road' && (
          <>
            <Road model={road} finishIndex={finishIndex} freshPayday={freshPayday.value} freshPaidDebts={freshPaidDebts.value} describe={describe} />
            {d.paydays.length === 0 && !debtFree && <p data-testid="day-one">Day one. Your first yellow square is {shortDate(nextPayday, today.value)}.</p>}
          </>
        )}
        {view === 'list' && <PaydayListBody />}
        {view === 'calendar' && <PaydayCalendar d={d} r={r} today={today.value} />}
      </section>

      {debtFree && (
        <section class="card">
          <p>You’re debt-free. Every debt is paid or archived, so there is nothing left to plan.</p>
        </section>
      )}

      {focus && (
        <section class="card row" aria-label="Next stop" data-testid="next-stop">
          <div class="stack" style={{ gap: 2 }}>
            <p class="label">Next stop</p>
            <p>
              <b>{focus.debt.name}</b>
            </p>
            <p class="muted small num">
              {focusIdx >= 0 ? `${focusIdx + 1} payday${focusIdx === 0 ? '' : 's'} to go · ${shortDate(r.rows[focusIdx]!.date, today.value)}` : 'More than 20 years at this pace'}
            </p>
          </div>
          <Ring pct={focus.pctGone} size={52} label={`${focus.debt.name} paid off`} />
        </section>
      )}

      {!debtFree && <PayMore d={d} r={r} onPreview={setPreviewRows} onMore={() => setSheet('more')} />}

      {know.length > 0 && (
        <section class="card stack" aria-label="Worth knowing" data-testid="worth-knowing">
          <p class="label">Worth knowing</p>
          <ul class="know-list">
            {know.map((t) => (
              <li key={t}>{t}</li>
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

      {stats.owed > 0 && (
        <section class="card stack" aria-label="Balance over time">
          <h2>Your plan vs minimums only</h2>
          <Chart
            data={chart}
            startLabel="Now"
            endLabel=""
            planEndLabel={null}
            minimumsEnd={chart.minimumsMonths === null ? null : shortMonthYear(addDaysISO(today.value, Math.round(chart.minimumsMonths * 30.44)))}
            label="Balance over time, your plan against minimums only"
          />
        </section>
      )}

      {thisMonth.length > 0 && (
        <p class="card num" data-testid="planned-vs-actual">
          This month: <b>{formatMoney(actual, cur, { whole: true })}</b> of <b>{formatMoney(planned, cur, { whole: true })}</b> planned
        </p>
      )}

      {paidCount >= 1 && (
        <section class="card stack" aria-label="Share progress">
          <p class="label">
            Share progress
            <HelpTip title="Share progress">
              <p>A picture of your progress to share. It shows percentages only, never amounts or names.</p>
            </HelpTip>
          </p>
          <button type="button" class="btn ghost" onClick={share}>
            Share my progress
          </button>
          {shareMsg && (
            <p class="small" role="status">
              {shareMsg}
            </p>
          )}
        </section>
      )}

      <nav class="path-foot" aria-label="Order, print and export">
        <button type="button" class="foot-link" onClick={() => setSheet('order')}>
          <IconOrder /> <span>Order</span>
        </button>
        <button type="button" class="foot-link" onClick={() => setSheet('print')}>
          <IconPrint /> <span>Print</span>
        </button>
        <button type="button" class="foot-link" onClick={() => setSheet('export')}>
          <IconExport /> <span>Export</span>
        </button>
      </nav>
      <p class="muted small" style={{ textAlign: 'center' }} data-testid="order-line">
        Order: {ORDER_NAME[s.method]}
      </p>

      <WhatIfSheet open={sheet === 'more'} onClose={close} />

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

      <Sheet open={sheet === 'print'} onClose={close} title="Print">
        {!debtFree && (
          <button type="button" class="btn ghost" onClick={() => printNow('payday')}>
            Print this payday
          </button>
        )}
        <button type="button" class="btn ghost" onClick={() => printNow('debts')}>
          Print my debts
        </button>
        <button type="button" class="btn ghost" onClick={() => printNow('plan')}>
          Print the plan (one page)
        </button>
        <button type="button" class="link" onClick={close}>
          Close
        </button>
      </Sheet>

      <Sheet open={sheet === 'export'} onClose={close} title="Export">
        <button type="button" class="btn ghost" onClick={csv}>
          Export the plan (CSV)
        </button>
        <button type="button" class="btn ghost" onClick={paymentsCsv}>
          Export my payments (CSV)
        </button>
        <button type="button" class="link" onClick={close}>
          Close
        </button>
      </Sheet>

      {/* Printed by "Print": everything else is hidden in print */}
      {printKind === 'payday' && <PrintPayday d={d} r={r} bills={rowBills[0] ?? { due: [], noDueDay: [], total: 0 }} today={today.value} />}
      {printKind === 'debts' && <PrintDebts d={d} r={r} today={today.value} />}
      {printKind === 'plan' && <section class="print-only" aria-hidden="true">
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
      </section>}
    </main>
  );
}
