/**
 * Path, Preview (design canvas board): a read-only look at a future payday, from the plan as it stands.
 * Nothing is saved and nothing can be ticked. An ink band says so, with a way back; month chips jump ahead.
 */
import { useEffect } from 'preact/hooks';
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { formatMoney } from '../lib/money';
import { monthsBetween, shortDate } from '../lib/today';
import { progressStats } from '../state/milestones';
import { goneDates } from './goneDates';
import { previewDate } from '../state/store';
import { Hills, Scene, SCENE_SQUARES, SkyBody, SkyDecor, sceneStage, smoothPath, STAGE_NAMES, Tree } from '../ui/Scene';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthYearName = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** "Fri 12 Mar 2027": the year is always there in a preview */
const fullDate = (iso: string, today: string) => {
  const s = shortDate(iso, today);
  return /\d{4}$/.test(s) ? s : `${s} ${iso.slice(0, 4)}`;
};

/** The words for "how long to go" from the previewed date */
export function monthsToGoText(debtLeft: number, date: string, debtFreeDate: string | null): string {
  if (debtLeft <= 0.005) return 'Debt-free by then';
  if (!debtFreeDate) return 'More than 20 years at this pace';
  const n = Math.max(0, monthsBetween(date, debtFreeDate));
  return n === 0 ? 'Less than a month to go' : `${n} month${n === 1 ? '' : 's'} to debt-free`;
}

/**
 * The scene of the preview: the same hills, road and flag as "Your scene", with the squares paid so far in yellow
 * and the previewed payday marked with a soft glow and a pin. At most twelve squares are drawn, spread over the whole plan.
 */
export function PreviewScene(props: { total: number; done: number; at: number; label: string }) {
  const { total, done, at, label } = props;
  const n = Math.max(2, Math.min(SCENE_SQUARES.length, total));
  const pick = Array.from({ length: n }, (_, k) => SCENE_SQUARES[Math.round((k * (SCENE_SQUARES.length - 1)) / (n - 1))]!);
  const centers = pick.map(([x, y]) => [x + 6, y + 6] as const);
  const payIndex = (k: number) => Math.round((k * (total - 1)) / (n - 1));
  const glowAt = Math.min(n - 1, Math.max(0, Math.round((at * (n - 1)) / Math.max(1, total - 1))));
  const here = centers[glowAt]!;
  const ribbon = smoothPath(centers);
  return (
    <svg class="pv-scene scene scene-3" viewBox="0 0 320 170" width="100%" role="img" aria-label={label} data-testid="preview-scene" focusable="false">
      <rect width="320" height="170" class="sc-sky" />
      <SkyDecor />
      <SkyBody cx={78} cy={54} rays />
      <Hills />
      <Tree x={60} y={112} />
      <path d={ribbon} fill="none" class="sc-road" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
      <path d={ribbon} fill="none" class="sc-roadline" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1 6" />
      <circle cx={here[0]} cy={here[1]} r="17" class="sc-glow" />
      <g class="sc-ink" stroke-width="1.4">
        {pick.map(([x, y], k) => (
          <rect key={k} x={x} y={y} width="12" height="12" rx="3" class={payIndex(k) < done ? 'sc-paid' : 'sc-sq'} />
        ))}
      </g>
      <g aria-hidden="true">
        <circle cx={here[0]} cy={here[1]} r="10" class="sc-pin-ring" fill="none" stroke-width="1.6" />
        <path d={`M${here[0] - 4.5} ${here[1] - 21} H${here[0] + 4.5} L${here[0]} ${here[1] - 13.5} Z`} class="sc-ink-fill" />
      </g>
      <path d="M266 66 V36" class="sc-ink" stroke-width="2" stroke-linecap="round" />
      <path d="M266 36 Q275 38 284 42 Q275 45 266 48Z" class="sc-ink-fill" />
    </svg>
  );
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
  const money = (n: number, whole = true) => formatMoney(n, cur, { whole });
  const stats = progressStats(d);
  const pctGone = stats.start > 0 ? Math.min(100, Math.max(0, (1 - row.debtLeft / stats.start) * 100)) : 0;
  const stage = sceneStage(pctGone, row.debtLeft > 0.005);
  const label = fullDate(date, today);

  // One chip per month the plan covers: a chip opens the last payday of that month. The debt-free month ends on the debt-free day.
  const months: { key: string; iso: string }[] = [];
  for (const x of r.rows.slice(0, 120)) {
    const key = x.date.slice(0, 7);
    const at = months.findIndex((m) => m.key === key);
    if (at < 0) months.push({ key, iso: x.date });
    else months[at] = { key, iso: x.date };
  }
  const debtFreeDay = row.debtLeft <= 0.005;

  // Debts in payoff order: gone by then, or still being paid
  const order = r.order.map((id) => d.debts.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x) && x!.status !== 'archived');
  const goneOn = goneDates(d, r);
  const stepOf = (id: string) => row.debts.find((x) => x.id === id);
  const isGone = (id: string) => (stepOf(id)?.balanceAfter ?? 0) <= 0.005;
  const payingNow = order.find((x) => !isGone(x.id))?.id;
  const buffer = row.bufferAfter;
  const goal = d.settings.bufferGoal;
  const later = r.debtFreeDate ? monthsBetween(date, r.debtFreeDate) : null;

  return (
    <div class="stack" style={{ gap: 12 }} data-testid="path-preview">
      <div class="pv-band" role="status" data-testid="preview-banner">
        <div>
          <b>Preview · {label}</b>
          <span>Nothing changes. Just looking ahead.</span>
        </div>
        <button type="button" class="pv-back" onClick={() => (previewDate.value = null)}>
          Back to today
        </button>
      </div>

      <div class="stack" style={{ gap: 6 }}>
        <p class="label">Pick a month</p>
        <div class="pv-months" role="group" aria-label="Pick a month">
          {months.map((m) => (
            <button
              key={m.key}
              type="button"
              class="pill plain chip"
              aria-pressed={m.key === date.slice(0, 7)}
              aria-label={monthYearName(m.iso)}
              onClick={() => (previewDate.value = m.iso)}
            >
              {MONTHS[Number(m.key.slice(5, 7)) - 1]!.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <section class="card stack" style={{ gap: 6, padding: 0, overflow: 'hidden' }} aria-label="Your scene then">
        {debtFreeDay ? (
          <Scene stage={5} label={`Your scene then: ${STAGE_NAMES[5]}`} />
        ) : (
          <PreviewScene total={d.paydays.length + r.rows.length} done={d.paydays.filter((x) => x.status === 'done').length} at={d.paydays.length + i} label={`Your scene then: ${STAGE_NAMES[stage]}`} />
        )}
        <div class="stack" style={{ gap: 4, padding: '4px 16px 16px' }}>
          <p class="muted">On {label} you’ll owe</p>
          <p class="num" data-testid="preview-owed" style={{ fontFamily: 'var(--font-head)', fontSize: '2.6rem', fontWeight: 800, lineHeight: 1.1 }}>
            {money(row.debtLeft)}
          </p>
          <p data-testid="preview-months">
            <b>{Math.floor(pctGone)}% gone</b>
            {row.debtLeft <= 0.005
              ? ' · this is your debt-free day'
              : r.debtFreeDate
                ? ` · debt-free ${later === 0 ? 'that same month' : `${later} month${later === 1 ? '' : 's'} later`}, in ${monthYearName(r.debtFreeDate)}`
                : ' · more than 20 years at this pace'}
          </p>
          <span data-testid="preview-stage" class="sr-only">
            {STAGE_NAMES[stage]}
          </span>
        </div>
      </section>

      <section class="card stack" style={{ gap: 0 }} aria-label="Debts then" data-testid="preview-debts">
        {order.map((x, k) => {
          const gone = isGone(x.id);
          const goneDate = goneOn.get(x.id) ?? null;
          return (
            <div key={x.id} class="row" style={{ padding: '12px 0', borderTop: k ? '1px solid var(--line)' : undefined, alignItems: 'center' }} data-testid="preview-debt">
              <span class="stack" style={{ gap: 0 }}>
                <b>{x.name}</b>
                <span class="muted small">
                  {gone ? `Gone ${goneDate ? fullDate(goneDate, today) : ''}` : `${x.id === payingNow ? 'Paying now · ' : ''}gone ${goneDate ? shortDate(goneDate, today).replace(/^\w+ \d+ /, '') + (/\d{4}$/.test(shortDate(goneDate, today)) ? '' : ` ${goneDate.slice(0, 4)}`) : 'later'}`}
                </span>
              </span>
              {gone ? <span class="tag paid">PAID</span> : <b class="num">{money(stepOf(x.id)?.balanceAfter ?? x.balance)}</b>}
            </div>
          );
        })}
      </section>

      <div class="pv-tiles">
        <div>
          <span class="muted small">Safety net</span>
          <b class="num" data-testid="preview-buffer">
            {goal > 0 && buffer >= goal - 0.005 ? `${money(goal)} full` : `${money(buffer)} of ${money(goal)}`}
          </b>
        </div>
        <div>
          <span class="muted small">Paid off by then</span>
          <b class="num" data-testid="preview-paid-off">
            {money(Math.max(0, stats.start - row.debtLeft))}
          </b>
        </div>
      </div>

      <p class="muted small" style={{ textAlign: 'center' }}>
        If you keep following your plan. No buttons here, nothing to mark.
      </p>
      <p class="pv-hand">this is where your paychecks take you</p>
    </div>
  );
}
