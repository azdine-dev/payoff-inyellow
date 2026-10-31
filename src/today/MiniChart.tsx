/**
 * "Balance, payday by payday" (design/warm-extras/TodayWarm.html): total owed at each payday, from today's total down to
 * zero in the debt-free month. Paid paydays are yellow dots, the payday you are on is the highlighted one, and the line
 * ends with the flag. It shows before and after "I did it". Tap opens Path.
 */
import { useMemo } from 'preact/hooks';
import { formatMoney } from '../lib/money';
import { shortMonthYear } from '../lib/today';
import { progressStats } from '../state/milestones';
import { data, plan, tab } from '../state/store';
import { CAPTIONS, miniChartModel, type ChartPoint } from './balanceSeries';

const W = 320;
const H = 120;
const PAD = { l: 14, r: 22, t: 22, b: 22 };

export function MiniChart() {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const stats = progressStats(d);
  const m = useMemo(() => miniChartModel(d, r, stats), [d, r]);
  if (m.start <= 0 && m.owed <= 0) return null;

  const sx = (i: number) => PAD.l + (i / m.xMax) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - Math.min(y, m.yMax) / m.yMax) * (H - PAD.t - PAD.b);
  const path = (pts: ChartPoint[]) => pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p.i).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const money = (n: number) => formatMoney(n, cur, { whole: true });
  const hx = sx(m.here.i);
  const hy = sy(m.here.y);
  const last = m.line[m.line.length - 1]!;
  const endX = sx(last.i);
  const base = H - PAD.b;
  const nearEnd = hx > W * 0.55;
  const endLabel = r.debtFreeDate ? `${shortMonthYear(r.debtFreeDate)} · ${money(0)}` : '';

  return (
    <button
      type="button"
      class="card minichart"
      data-testid="mini-chart"
      aria-label={`Balance, payday by payday. You owe ${money(m.owed)}. ${CAPTIONS[m.caption]} Open your path.`}
      onClick={() => (tab.value = 'path')}
    >
      <span class="row" style={{ alignItems: 'baseline' }}>
        <span class="label">Balance, payday by payday</span>
        <span class="chev" aria-hidden="true">
          ›
        </span>
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-hidden="true" focusable="false" style={{ display: 'block', height: 'auto' }}>
        <line x1="12" y1={base} x2="308" y2={base} stroke="var(--line)" stroke-width="1.5" />
        <path d={path(m.line)} fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" data-testid="mini-line-path" />
        {m.endsAtZero && (
          <>
            <path d={`M${endX} ${base} V${base - 20}`} stroke="var(--ink)" stroke-width="1.8" data-testid="mini-flag" />
            <path d={`M${endX} ${base - 20} l12 4 l-12 4Z`} fill="var(--ink)" />
          </>
        )}
        {/* paydays done: yellow dots */}
        {m.paid.slice(0, -1).map((p) => (
          <circle key={p.i} cx={sx(p.i)} cy={sy(p.y)} r="4.5" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.6" data-testid="mini-paid" />
        ))}
        {/* the payday you are on: highlighted */}
        <circle cx={hx} cy={hy} r="11" fill="var(--yellow-soft)" />
        <circle cx={hx} cy={hy} r="6.5" fill="var(--yellow)" stroke="var(--ink)" stroke-width="2" data-testid="mini-here" />
        <text x={nearEnd ? hx - 14 : hx + 14} y={hy - 6} font-size="11" font-weight="700" fill="var(--ink)" text-anchor={nearEnd ? 'end' : 'start'} data-testid="mini-start">
          You · {money(m.owed)}
        </text>
        {m.endsAtZero && (
          <text x={W - 12} y={H - 4} font-size="11" fill="var(--gray)" text-anchor="end" data-testid="mini-end">
            {endLabel}
          </text>
        )}
      </svg>
      <span data-testid="mini-line">{CAPTIONS[m.caption]}</span>
    </button>
  );
}
