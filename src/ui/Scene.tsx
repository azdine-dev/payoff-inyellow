/**
 * "Your scene": a small original picture that grows as the debt goes away (design/warm-extras/Scenes.html).
 * Five stages by the share of debt gone:
 *   1 Dawn (0 to 24%): the road starts, the flag is far
 *   2 Morning (25 to 49%): the sun is up, a tree grows
 *   3 Halfway (50 to 74%): a bridge, a brighter sky
 *   4 Almost (75 to 99%): the flag is close, the fields turn green
 *   5 Home (100%): every square yellow, a light on at home
 * Colors come from CSS variables (see .scene in base.css), so dark mode has its own set. Yellow is only used
 * for the paid squares and the lit window. No people.
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
const SQUARES = [
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

/** How many squares are yellow (paid) at each stage: the two pre-filled ones, then more */
const YELLOW: Record<SceneStage, number> = { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 };

/** Where the sun is */
const SUN: Record<SceneStage, { cx: number; cy: number }> = {
  1: { cx: 250, cy: 104 },
  2: { cx: 250, cy: 78 },
  3: { cx: 250, cy: 56 },
  4: { cx: 250, cy: 42 },
  5: { cx: 214, cy: 34 },
};

const LABELS: Record<SceneStage, string> = {
  1: 'dawn, a road of squares with two yellow squares leading to a flag on a far hill',
  2: 'the sun rises and a small tree grows',
  3: 'halfway, the road crosses a small bridge',
  4: 'the flag is close and the fields are green',
  5: 'debt-free, the road is all yellow and a small house has a lit window',
};

export function Scene(props: { stage: SceneStage; fadeIn?: boolean; label?: string }) {
  const { stage, fadeIn = false } = props;
  const sun = SUN[stage];
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
      <circle cx={sun.cx} cy={sun.cy} r="18" class="sc-sun" />
      <path d="M0 112 Q80 74 160 98 T320 66 V170 H0Z" class="sc-hill1" />
      <path d="M0 142 Q100 112 190 132 T320 112 V170 H0Z" class="sc-hill2" />
      {stage >= 4 && <path d="M8 164 Q50 158 96 164 M190 166 Q240 158 300 165 M200 156 Q250 148 306 155" fill="none" class="sc-field" stroke-width="2" stroke-linecap="round" />}
      {stage >= 3 && (
        <>
          <path d="M118 150 Q140 140 162 150" fill="none" class="sc-water" stroke-width="5" stroke-linecap="round" opacity="0.6" />
          <path d="M120 142 Q140 126 160 142" fill="none" class="sc-ink" stroke-width="1.8" />
          <path d="M116 142 H164" class="sc-ink" stroke-width="1.8" />
        </>
      )}
      {stage >= 2 && (
        <>
          <rect x="58" y="116" width="4" height="16" class="sc-ink-fill" />
          <circle cx="60" cy="110" r="11" class="sc-tree" stroke-width="1.4" />
        </>
      )}
      <g class="sc-ink" stroke-width="1.4">
        {SQUARES.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="12" height="12" rx="3" class={i < YELLOW[stage] ? 'sc-paid' : 'sc-sq'} />
        ))}
      </g>
      <path d="M266 66 V36" class="sc-ink" stroke-width="2" stroke-linecap="round" />
      <path d="M266 36 L284 42 L266 48Z" class="sc-ink-fill" />
      {stage === 5 && (
        <>
          <path d="M276 66 L292 52 L308 66Z" class="sc-ink-fill" />
          <rect x="280" y="66" width="24" height="18" class="sc-sq sc-ink" stroke-width="1.6" />
          <rect x="288" y="70" width="8" height="8" class="sc-paid sc-ink" stroke-width="1.2" />
        </>
      )}
    </svg>
  );
}
