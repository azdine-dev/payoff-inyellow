/**
 * "Your scene": a small original picture that grows as the debt goes away (design/warm-extras/Scenes.html).
 * Five stages by the share of debt gone:
 *   1 Dawn (0 to 24%): the road starts, the flag is far
 *   2 Morning (25 to 49%): the sun is up, a tree grows
 *   3 Halfway (50 to 74%): a bridge over a stream, a second tree
 *   4 Almost (75 to 99%): the flag is close, the fields turn green
 *   5 Home (100%): every square yellow, a light on at home
 * The road is a real ribbon with a dashed line, and the squares sit on it. The yellow squares follow the real share
 * paid (when `pct` is given), and a small pin shows where you are: on the next square.
 * By day there is a sun with a soft halo and a few clouds. By night (dark mode) the same place has a crescent moon,
 * a soft glow and stars. Colors come from CSS variables (see .scene in base.css). Yellow is only used for the paid
 * squares and the lit window (the sun and the glow are a pale yellow tint). No people.
 */
export type SceneStage = 1 | 2 | 3 | 4 | 5;

/** The stage for the share of debt that is gone. With no debts left it is the last one. */
export function sceneStage(pctGone: number, hasDebts = true): SceneStage {
  if (!hasDebts || pctGone >= 100) return 5;
  if (pctGone >= 75) return 4;
  if (pctGone >= 50) return 3;
  if (pctGone >= 25) return 2;
  return 1;
}

export const STAGE_NAMES: Record<SceneStage, string> = { 1: 'Dawn', 2: 'Morning', 3: 'Halfway', 4: 'Almost', 5: 'Home' };

/** The twelve squares of the road, bottom left to the flag */
export const SCENE_SQUARES = [
  [24, 151],
  [46, 146],
  [68, 140],
  [90, 135],
  [112, 129],
  [134, 124],
  [156, 117],
  [178, 109],
  [198, 100],
  [216, 89],
  [232, 77],
  [246, 65],
] as const;
const SQUARES = SCENE_SQUARES;

/** How many squares are yellow (paid) at each stage when the exact share is not known: the two pre-filled ones, then more */
const YELLOW: Record<SceneStage, number> = { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 };

/** How many squares are yellow: by the real share when it is known (two come pre-filled, the last one is the finish), else by stage */
export function yellowSquares(stage: SceneStage, pct?: number): number {
  if (stage === 5) return SQUARES.length;
  if (pct === undefined || Number.isNaN(pct)) return YELLOW[stage];
  return Math.min(SQUARES.length - 1, Math.max(2, Math.round((Math.max(0, pct) / 100) * SQUARES.length)));
}

/** Where the sun (or the moon) is: upper left, climbing as the debt goes, away from the flag and the road */
const SUN: Record<SceneStage, { cx: number; cy: number }> = {
  1: { cx: 64, cy: 88 },
  2: { cx: 80, cy: 66 },
  3: { cx: 98, cy: 50 },
  4: { cx: 118, cy: 40 },
  5: { cx: 138, cy: 34 },
};

const LABELS: Record<SceneStage, string> = {
  1: 'dawn, a road of squares with two yellow squares leading to a flag on a far hill',
  2: 'the sun rises and a small tree grows',
  3: 'halfway, the road crosses a small bridge over a stream',
  4: 'the flag is close and the fields are green',
  5: 'debt-free, the road is all yellow and a small house has a lit window',
};

type Pt = readonly [number, number];

/** A smooth curve through points (Catmull-Rom turned into cubic curves) */
export function smoothPath(points: readonly Pt[]): string {
  if (points.length < 2) return '';
  const p = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Three hills, far to near */
export function Hills() {
  return (
    <>
      <path d="M0 98 Q70 70 150 90 T320 62 V170 H0Z" class="sc-hill0" />
      <path d="M0 112 Q80 74 160 98 T320 66 V170 H0Z" class="sc-hill1" />
      <path d="M0 142 Q100 112 190 132 T320 112 V170 H0Z" class="sc-hill2" />
    </>
  );
}

/** Day: a few soft clouds. Night: stars. Which one shows is decided by the theme (CSS). */
export function SkyDecor() {
  return (
    <>
      <g class="sc-cloud" aria-hidden="true">
        <ellipse cx="206" cy="30" rx="20" ry="6" />
        <ellipse cx="220" cy="25" rx="13" ry="6.5" />
        <ellipse cx="194" cy="27" rx="10" ry="5" />
        <ellipse cx="22" cy="22" rx="15" ry="4.5" />
        <ellipse cx="32" cy="18" rx="9" ry="5" />
      </g>
      <g class="sc-star" aria-hidden="true">
        <circle cx="22" cy="22" r="1.5" />
        <circle cx="52" cy="38" r="1.1" />
        <circle cx="168" cy="22" r="1.4" />
        <circle cx="196" cy="42" r="1" />
        <circle cx="226" cy="18" r="1.3" />
        <circle cx="300" cy="24" r="1.4" />
        <circle cx="288" cy="50" r="1" />
        <circle cx="10" cy="70" r="1" />
      </g>
    </>
  );
}

/** The sun by day (with a halo and rays), a crescent moon with a soft glow by night */
export function SkyBody(props: { cx: number; cy: number; rays?: boolean }) {
  const { cx, cy, rays = false } = props;
  return (
    <g transform={`translate(${cx} ${cy})`} class="sc-body" data-testid="scene-sun" aria-hidden="true">
      <circle r="30" class="sc-halo" />
      <circle r="22" class="sc-halo2" />
      {rays && (
        <g class="sc-ray" stroke-width="1.6" stroke-linecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <path key={i} d={`M${(Math.cos(a) * 19).toFixed(1)} ${(Math.sin(a) * 19).toFixed(1)} L${(Math.cos(a) * 25).toFixed(1)} ${(Math.sin(a) * 25).toFixed(1)}`} />;
          })}
        </g>
      )}
      <circle r="15" class="sc-sun" />
      <defs>
        <mask id="sc-moon-bite" maskUnits="userSpaceOnUse" x="-20" y="-20" width="40" height="40">
          <rect x="-20" y="-20" width="40" height="40" fill="#fff" />
          <circle cx="7" cy="-3.5" r="10" fill="#000" />
        </mask>
      </defs>
      <circle r="12" class="sc-moon" mask="url(#sc-moon-bite)" />
    </g>
  );
}

/** A round tree: a trunk and a crown */
export function Tree(props: { x: number; y: number; s?: number }) {
  const { x, y, s = 1 } = props;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-hidden="true">
      <rect x="-2" y="6" width="4" height="16" class="sc-ink-fill" />
      <circle cx="0" cy="0" r="11" class="sc-tree" stroke-width="1.4" />
      <circle cx="-3" cy="-3" r="4" class="sc-tree-light" />
    </g>
  );
}

export function Scene(props: { stage: SceneStage; fadeIn?: boolean; label?: string; pct?: number }) {
  const { stage, fadeIn = false } = props;
  const sun = SUN[stage];
  const filled = yellowSquares(stage, props.pct);
  const centers = SQUARES.map(([x, y]) => [x + 6, y + 6] as const);
  const here = filled < SQUARES.length ? centers[filled]! : null;
  const ribbon = smoothPath(centers);
  return (
    <svg
      class={`scene scene-${stage}${fadeIn ? ' scene-in' : ''}`}
      data-testid="scene"
      data-stage={stage}
      viewBox="0 0 320 170"
      width="100%"
      role="img"
      aria-label={props.label ?? `Your scene, stage ${stage}: ${LABELS[stage]}`}
      focusable="false"
    >
      <rect width="320" height="170" class="sc-sky" />
      <SkyDecor />
      <SkyBody cx={sun.cx} cy={sun.cy} rays={stage >= 2} />
      <Hills />
      {stage >= 4 && <path d="M8 164 Q50 158 96 164 M190 166 Q240 158 300 165 M200 156 Q250 148 306 155" fill="none" class="sc-field" stroke-width="2" stroke-linecap="round" />}
      {stage >= 3 && (
        <g aria-hidden="true">
          <path d="M112 152 Q140 140 168 152" fill="none" class="sc-water" stroke-width="7" stroke-linecap="round" opacity="0.55" />
          <path d="M120 150 Q140 143 160 150" fill="none" class="sc-water-line" stroke-width="1.4" stroke-linecap="round" />
          <path d="M118 142 Q140 124 162 142" fill="none" class="sc-ink" stroke-width="2" stroke-linecap="round" />
          <path d="M114 142 H166" class="sc-ink" stroke-width="2" stroke-linecap="round" />
          <path d="M124 142 V148 M156 142 V148" class="sc-ink" stroke-width="1.6" stroke-linecap="round" />
        </g>
      )}
      {stage >= 2 && <Tree x={60} y={110} />}
      {stage >= 3 && <Tree x={38} y={124} s={0.72} />}
      <path d={ribbon} fill="none" class="sc-road" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
      <path d={ribbon} fill="none" class="sc-roadline" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1 6" />
      <g class="sc-ink" stroke-width="1.4">
        {SQUARES.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="12" height="12" rx="3" class={i < filled ? 'sc-paid' : 'sc-sq'} />
        ))}
      </g>
      {here && (
        <g class="sc-pin" data-testid="scene-pin" data-index={filled} role="img" aria-label="You are here">
          <circle cx={here[0]} cy={here[1]} r="10" class="sc-pin-ring" fill="none" stroke-width="1.6" />
          <path d={`M${here[0] - 4.5} ${here[1] - 21} H${here[0] + 4.5} L${here[0]} ${here[1] - 13.5} Z`} class="sc-ink-fill" />
        </g>
      )}
      <path d="M266 66 V36" class="sc-ink" stroke-width="2" stroke-linecap="round" />
      <path d="M266 36 Q275 38 284 42 Q275 45 266 48Z" class="sc-ink-fill" />
      {stage === 5 && (
        <g aria-hidden="true">
          <circle cx="292" cy="74" r="14" class="sc-glow" />
          <rect x="296" y="52" width="5" height="10" class="sc-ink-fill" />
          <circle cx="299" cy="48" r="3.4" class="sc-smoke" />
          <circle cx="303" cy="41" r="2.6" class="sc-smoke" />
          <path d="M276 66 L292 52 L308 66Z" class="sc-ink-fill" />
          <rect x="280" y="66" width="24" height="18" class="sc-sq sc-ink" stroke-width="1.6" />
          <rect x="288" y="70" width="8" height="8" class="sc-paid sc-ink" stroke-width="1.2" />
        </g>
      )}
    </svg>
  );
}
