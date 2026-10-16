/** Balance over time: your plan against minimums only. Plain SVG, follows the theme. */
import type { ChartData, Point } from '../lib/series';

const W = 320;
const H = 170;
const PAD = { l: 8, r: 8, t: 10, b: 22 };

export function Chart(props: { data: ChartData; startLabel: string; endLabel: string; planEndLabel: string | null; minimumsEnd: string | null; label: string }) {
  const { data } = props;
  const sx = (x: number) => PAD.l + (x / data.xMax) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - Math.min(y, data.yMax) / data.yMax) * (H - PAD.t - PAD.b);
  const path = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const base = H - PAD.b;
  const planEnd = data.plan[data.plan.length - 1]!;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.label} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} stroke="var(--line)" stroke-width="2" />
        <path d={path(data.minimums)} fill="none" stroke="var(--gray)" stroke-width="2.5" stroke-dasharray="6 5" stroke-linejoin="round" />
        <path d={path(data.plan)} fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" />
        {props.planEndLabel && (
          <>
            <circle cx={sx(planEnd.x)} cy={sy(planEnd.y)} r="5" fill="var(--yellow)" stroke="var(--ink)" stroke-width="2.5" />
            <text
              x={sx(planEnd.x)}
              y={sy(planEnd.y) - 11}
              font-size="11"
              font-weight="600"
              fill="var(--ink)"
              stroke="var(--card)"
              stroke-width="4"
              paint-order="stroke"
              text-anchor={sx(planEnd.x) > W * 0.7 ? 'end' : sx(planEnd.x) < W * 0.3 ? 'start' : 'middle'}
            >
              {props.planEndLabel}
            </text>
          </>
        )}
        <text x={PAD.l} y={H - 5} font-size="11" fill="var(--gray)">
          {props.startLabel}
        </text>
        <text x={W - PAD.r} y={H - 5} font-size="11" fill="var(--gray)" text-anchor="end">
          {props.endLabel}
        </text>
      </svg>
      <figcaption class="row small muted" style={{ justifyContent: 'flex-start', gap: 18, marginTop: 4 }}>
        <span>
          <b style={{ color: 'var(--ink)' }}>━</b> Your plan
        </span>
        <span>
          <b>╌</b> Minimums only ({data.minimumsMonths === null ? 'never ends' : `ends ${props.minimumsEnd}`})
        </span>
      </figcaption>
    </figure>
  );
}
