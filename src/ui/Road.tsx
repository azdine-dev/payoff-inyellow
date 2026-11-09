/**
 * The brand picture: a road of squares that turn yellow on the way to a small finish flag.
 * A soft road ribbon runs under the squares, a small pin shows the next one, and a pale sun sits over the hill.
 * Ink, line grey and yellow only, all from the palette variables, so dark mode follows by itself.
 */
import { smoothPath } from './Scene';

const TOTAL = 8;

/** Where each square sits on the gently rising road */
const SPOTS = Array.from({ length: TOTAL }, (_, i) => ({ x: 8 + i * 16, y: 62 - i * 4.5 + Math.sin(i * 0.95) * 7 }));

/** How many of the squares are yellow for a share of the debt that is gone (the first one is "plan made") */
export function roadDone(pctGone: number): number {
  if (pctGone >= 100) return TOTAL;
  return Math.min(TOTAL - 1, 1 + Math.floor((Math.max(0, pctGone) / 100) * (TOTAL - 1)));
}

export function RoadIllustration(props: { done: number; width?: number; label?: string }) {
  const { done, width = 150, label } = props;
  const finished = done >= TOTAL;
  const flagX = SPOTS[TOTAL - 1]!.x + 24;
  const flagBase = SPOTS[TOTAL - 1]!.y + 12;
  const centers = SPOTS.map((p) => [p.x + 7, p.y + 7] as const);
  const ribbon = smoothPath(centers);
  const here = done < TOTAL ? centers[done]! : null;
  return (
    <svg class="road" viewBox="0 0 160 90" width={width} height={(width * 90) / 160} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} focusable="false">
      <defs>
        <mask id="rd-moon-bite" maskUnits="userSpaceOnUse" x="20" y="6" width="40" height="40">
          <rect x="20" y="6" width="40" height="40" fill="#fff" />
          <circle cx="46" cy="22.5" r="8" fill="#000" />
        </mask>
      </defs>
      <circle cx="38" cy="26" r="17" class="road-halo" />
      <circle cx="38" cy="26" r="10" class="road-sun" />
      <circle cx="38" cy="26" r="9" class="road-moon" mask="url(#rd-moon-bite)" />
      <path d={ribbon} fill="none" class="road-ribbon" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <path d={ribbon} fill="none" class="road-dash" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1 6" />
      {SPOTS.map((p, i) => (
        <rect
          key={i}
          class={i < done ? 'road-sq on' : 'road-sq'}
          x={p.x}
          y={p.y}
          width="14"
          height="14"
          rx="3.5"
          fill={i < done ? 'var(--yellow)' : 'var(--card)'}
          stroke="var(--ink)"
          stroke-width={i < done ? 1.5 : 1.6}
        />
      ))}
      {here && (
        <g class="road-here" aria-hidden="true">
          <circle cx={here[0]} cy={here[1]} r="11.5" fill="none" stroke="var(--ink)" stroke-width="1.5" />
          <path d={`M${here[0] - 4} ${here[1] - 23} H${here[0] + 4} L${here[0]} ${here[1] - 16} Z`} fill="var(--ink)" />
        </g>
      )}
      <path d={`M${flagX} ${flagBase} V${flagBase - 34}`} stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
      <path
        d={`M${flagX} ${flagBase - 34} Q${flagX + 8} ${flagBase - 32} ${flagX + 15} ${flagBase - 28} Q${flagX + 8} ${flagBase - 25} ${flagX} ${flagBase - 21} Z`}
        fill={finished ? 'var(--yellow)' : 'var(--ink)'}
        stroke={finished ? 'var(--ink)' : 'none'}
        stroke-width="1.2"
        stroke-linejoin="round"
      />
    </svg>
  );
}
