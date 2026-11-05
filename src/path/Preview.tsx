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
import { previewDate } from '../state/store';
import { Scene, sceneStage, STAGE_NAMES } from '../ui/Scene';

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

/** A small hill with a rising line of squares: yellow = paid so far, the glow = the date being looked at, a flag at the end. */
function PreviewScene(props: { total: number; done: number; at: number; label: string }) {
  const { total, done, at, label } = props;
  const n = Math.max(2, Math.min(12, total));
  const spot = (k: number) => {
    const t = k / (n - 1);
    return { x: 34 + t * 236, y: 150 - (t * 0.9 + 0.1 * Math.sin(t * 6)) * 100 };
  };
  const payIndex = (k: number) => Math.round((k * (total - 1)) / (n - 1));
  const glowAt = Math.min(n - 1, Math.max(0, Math.round((at * (n - 1)) / Math.max(1, total - 1))));
  const end = spot(n - 1);
  return (
    <svg class="pv-scene" viewBox="0 0 340 190" role="img" aria-label={label} data-testid="preview-scene">
      <rect width="340" height="190" fill="var(--calm)" />
      <path d="M0 140 C60 110 120 120 180 130 C240 140 290 100 340 90 L340 190 L0 190 Z" fill="var(--calm-band)" opacity="0.7" />
      <path d="M0 165 C70 135 130 150 200 150 C260 150 300 130 340 125 L340 190 L0 190 Z" fill="var(--calm-band)" />
      <rect x="44" y="104" width="4" height="34" fill="var(--gray)" />
      <circle cx="46" cy="98" r="12" fill="var(--gray)" opacity="0.55" />
      <circle cx={spot(glowAt).x} cy={spot(glowAt).y} r="26" fill="var(--yellow-soft)" />
      {Array.from({ length: n }, (_, k) => {
        const p = spot(k);
        const paid = payIndex(k) < done;
        return <rect key={k} x={p.x - 9} y={p.y - 9} width="18" height="18" rx="5" fill={paid ? 'var(--yellow)' : 'var(--card)'} stroke="var(--ink)" stroke-width="2" />;
      })}
      <line x1={end.x + 14} y1={end.y + 10} x2={end.x + 14} y2={end.y - 30} stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" />
      <path d={`M${end.x + 14} ${end.y - 30} l22 8 l-22 8 Z`} fill="var(--ink)" />
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
  const goneRow = (id: string) => r.rows.findIndex((x) => x.debts.some((y) => y.id === id && y.balanceAfter <= 0.005));
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
          const at = goneRow(x.id);
          const goneDate = at >= 0 ? r.rows[at]!.date : null;
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
