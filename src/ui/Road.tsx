/**
 * The brand picture: a road of squares that turn yellow on the way to a small finish flag.
 * Ink, line grey and yellow only, all from the palette variables, so dark mode follows by itself.
 */
const TOTAL = 8;

/** Where each square sits on the gently rising road */
const SPOTS = Array.from({ length: TOTAL }, (_, i) => ({ x: 6 + i * 16.5, y: 60 - i * 4.5 + Math.sin(i * 0.95) * 8 }));

/** How many of the squares are yellow for a share of the debt that is gone (the first one is "plan made") */
export function roadDone(pctGone: number): number {
  if (pctGone >= 100) return TOTAL;
  return Math.min(TOTAL - 1, 1 + Math.floor((Math.max(0, pctGone) / 100) * (TOTAL - 1)));
}

export function RoadIllustration(props: { done: number; width?: number; label?: string }) {
  const { done, width = 150, label } = props;
  const finished = done >= TOTAL;
  const flagX = SPOTS[TOTAL - 1]!.x + 22;
  const flagBase = SPOTS[TOTAL - 1]!.y + 12;
  const road = SPOTS.map((p, i) => `${i ? 'L' : 'M'}${p.x + 7} ${p.y + 7}`).join(' ');
  return (
    <svg class="road" viewBox="0 0 160 90" width={width} height={(width * 90) / 160} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} focusable="false">
      <path d={road} fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7" />
      {SPOTS.map((p, i) => (
        <rect
          key={i}
          class={i < done ? 'road-sq on' : 'road-sq'}
          x={p.x}
          y={p.y}
          width="14"
          height="14"
          rx="3.5"
          fill={i < done ? 'var(--yellow)' : 'none'}
          stroke={i < done ? 'var(--yellow)' : 'var(--ink)'}
          stroke-width="1.6"
        />
      ))}
      <path d={`M${flagX} ${flagBase} V${flagBase - 34}`} stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
      <path d={`M${flagX} ${flagBase - 34} L${flagX + 15} ${flagBase - 28} L${flagX} ${flagBase - 21} Z`} fill={finished ? 'var(--yellow)' : 'var(--ink)'} stroke={finished ? 'var(--ink)' : 'none'} stroke-width="1.2" stroke-linejoin="round" />
    </svg>
  );
}
