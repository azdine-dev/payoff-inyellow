/**
 * "Balance, payday by payday" (design/warm-extras/TodayWarm.html): a small line from what you owe now down to zero
 * at the debt-free month, a yellow dot where you are, a flag at the end. The part already paid is filled yellow.
 * Tap opens Path.
 */
import { useMemo } from 'preact/hooks';
import { formatMoney } from '../lib/money';
import { shortMonthYear } from '../lib/today';
import { progressStats } from '../state/milestones';
import { data, plan, tab, today } from '../state/store';
import { miniChartModel, type Pt } from './balanceSeries';

const W = 320;
const H = 120;
const PAD = { l: 14, r: 20, t: 20, b: 20 };

export function MiniChart() {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const stats = progressStats(d);
  const m = useMemo(() => miniChartModel(d, r, stats, today.value), [d, r, today.value]);
  if (m.start <= 0 && m.owed <= 0) return null;

  const sx = (x: number) => PAD.l + (x / m.xMax) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - Math.min(y, m.yMax) / m.yMax) * (H - PAD.t - PAD.b);
  const line = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const wedge =
    m.history.length > 1 && m.down > 0
      ? `M${sx(0).toFixed(1)} ${sy(m.start).toFixed(1)} L${sx(m.here.x).toFixed(1)} ${sy(m.start).toFixed(1)} ${[...m.history].reverse().map((p) => `L${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ')} Z`
      : null;
  const money = (n: number) => formatMoney(n, cur, { whole: true });
  const hx = sx(m.here.x);
  const hy = sy(m.here.y);
  const endX = sx(m.xMax);
  const dayOne = d.paydays.length === 0 && m.down === 0;
  const endLabel = r.debtFreeDate ? `${shortMonthYear(r.debtFreeDate)} · ${money(0)}` : '';

  return (
    <button type="button" class="card minichart" data-testid="mini-chart" aria-label={`Balance, payday by payday. Down ${money(m.down)} since you started. Open your path.`} onClick={() => (tab.value = 'path')}>
      <span class="row" style={{ alignItems: 'baseline' }}>
        <span class="label">Balance, payday by payday</span>
        <span class="chev" aria-hidden="true">
          ›
        </span>
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-hidden="true" focusable="false" style={{ display: 'block', height: 'auto' }}>
        <line x1="12" y1={H - PAD.b} x2="308" y2={H - PAD.b} stroke="var(--line)" stroke-width="1.5" />
        {wedge && <path d={wedge} fill="var(--yellow)" fill-opacity="0.55" stroke="none" data-testid="mini-paid" />}
        <path d={line(m.history)} fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        <path d={line(m.ahead)} fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={m.endsAtZero ? undefined : '2 6'} />
        {m.endsAtZero && (
          <>
            <path d={`M${endX} ${H - PAD.b} V${H - PAD.b - 18}`} stroke="var(--ink)" stroke-width="1.8" />
            <path d={`M${endX} ${H - PAD.b - 18} l12 4 l-12 4Z`} fill="var(--ink)" />
          </>
        )}
        <circle cx={hx} cy={hy} r="6" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.8" data-testid="mini-here" />
        <text x={hx > W * 0.6 ? hx - 12 : hx + 12} y={hy - 4} font-size="11" font-weight="700" fill="var(--ink)" text-anchor={hx > W * 0.6 ? 'end' : 'start'} data-testid="mini-start">
          You · {money(m.owed)}
        </text>
        {m.endsAtZero && (
          <text x={W - 12} y={H - 4} font-size="11" fill="var(--gray)" text-anchor="end" data-testid="mini-end">
            {endLabel}
          </text>
        )}
      </svg>
      <span data-testid="mini-line">{dayOne ? 'Day one. Your line starts here.' : `Down ${money(m.down)} since you started.`}</span>
    </button>
  );
}
