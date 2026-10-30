/**
 * Today's top card (design/warm-extras/TodayWarm.html): "your scene" across the top, and under it the
 * countdown ("Debt-free in 9 months") with the debt-free month on the yellow highlight.
 */
import { useEffect, useState } from 'preact/hooks';
import { getSceneSeen, setSceneSeen } from '../lib/seen';
import { monthsBetween, monthYear } from '../lib/today';
import { Scene, sceneStage } from '../ui/Scene';

/** 19 months is "1 year" and "7 months". A zero part is left out. */
export function countdownParts(months: number): { years: number; months: number } {
  const m = Math.max(0, months);
  return { years: Math.floor(m / 12), months: m % 12 };
}

const plural = (n: number, word: string) => `${word}${n === 1 ? '' : 's'}`;

export function DebtFreeCard(props: { today: string; debtFreeDate: string | null; hasDebts: boolean; pctGone: number; onOpen: () => void }) {
  const { today, debtFreeDate, hasDebts, pctGone, onOpen } = props;
  const stage = sceneStage(pctGone, hasDebts);
  // A stage reached for the first time fades in once. The very first open just shows the scene.
  const [fadeStage, setFadeStage] = useState<number | null>(() => {
    const seen = getSceneSeen();
    return seen !== null && stage > seen ? stage : null;
  });
  useEffect(() => {
    const seen = getSceneSeen();
    if (seen !== null && stage > seen) setFadeStage(stage);
    if (seen === null || stage > seen) setSceneSeen(stage);
  }, [stage]);
  const parts = debtFreeDate ? countdownParts(monthsBetween(today, debtFreeDate)) : null;
  const aria = debtFreeDate ? `Debt-free in ${monthYear(debtFreeDate)}. Open your path.` : hasDebts ? 'More than 20 years. Open your path.' : 'Debt-free. Open your path.';
  return (
    <button type="button" class="card debt-free-card" data-testid="debt-free-pill" aria-label={aria} onClick={onOpen}>
      <Scene stage={stage} fadeIn={fadeStage === stage} />
      <span class="dfc-row">
        {parts && debtFreeDate ? (
          <>
            <span class="stack dfc-text" style={{ gap: 4 }}>
              <span class="label">Debt-free in</span>
              <span class="dfc-numbers num">
                {parts.years === 0 && parts.months === 0 && (
                  <span class="dfc-unit">
                    <small>Under</small> <b>1</b> <small>month</small>
                  </span>
                )}
                {parts.years > 0 && (
                  <span class="dfc-unit">
                    <b>{parts.years}</b> <small>{plural(parts.years, 'year')}</small>
                  </span>
                )}
                {parts.months > 0 && (
                  <span class="dfc-unit">
                    <b>{parts.months}</b> <small>{plural(parts.months, 'month')}</small>
                  </span>
                )}
              </span>
            </span>
            <span class="hl dfc-month">{monthYear(debtFreeDate)}</span>
          </>
        ) : (
          <span class="dfc-numbers">
            <span class="dfc-unit">
              <b>{hasDebts ? 'More than 20 years' : 'Debt-free'}</b>
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
