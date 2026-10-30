/**
 * "Pay a bit more?": four amounts as chips. Tapping one moves the finish flag on the road and shows the new date,
 * the months sooner and the interest saved, with "Use this". Nothing changes until "Use this".
 */
import { useMemo, useState } from 'preact/hooks';
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { monthYear } from '../lib/today';
import { applyWhatIf } from '../state/planActions';
import { act } from '../state/store';
import { whatIfPlan, whatIfSummary } from '../state/whatIf';

export const MORE_AMOUNTS = [20, 50, 100, 200];

export function PayMore(props: { d: AppData; r: PlanResult; onPreview: (rows: number | null) => void; onMore: () => void }) {
  const { d, r } = props;
  const cur = d.settings.currency;
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const trials = useMemo(() => new Map(MORE_AMOUNTS.map((n) => [n, whatIfPlan(d, n, null)])), [d]);
  const sum = picked !== null ? whatIfSummary(r, trials.get(picked)!) : null;

  const pick = (n: number) => {
    const next = picked === n ? null : n;
    setPicked(next);
    setDone(false);
    props.onPreview(next === null ? null : trials.get(next)!.rows.length);
  };

  const use = async () => {
    if (picked === null) return;
    await act((db, x) => applyWhatIf(db, x, picked, null));
    setPicked(null);
    setDone(true);
    props.onPreview(null);
  };

  const sooner = sum?.nowEnds ? 'It gets your plan to an end.' : sum && sum.monthsSaved !== null && sum.monthsSaved > 0 ? `${sum.monthsSaved} month${sum.monthsSaved === 1 ? '' : 's'} sooner.` : 'The same month.';

  return (
    <section class="card stack" aria-label="Pay a bit more" data-testid="pay-more">
      <p class="label">Pay a bit more?</p>
      <div class="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }} role="group" aria-label="Extra each payday">
        {MORE_AMOUNTS.map((n) => (
          <button key={n} type="button" class="pill plain chip" aria-pressed={picked === n} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => pick(n)}>
            +{formatMoneyAuto(n, cur)}
          </button>
        ))}
      </div>
      {sum && picked !== null && (
        <div class="stack" style={{ gap: 6 }} data-testid="more-result">
          <p>
            {sum.newDate ? (
              <>
                Debt-free <b>{monthYear(sum.newDate)}</b>. {sooner}
              </>
            ) : (
              'Still more than 20 years. A bigger amount might get there.'
            )}
          </p>
          {sum.interestSaved >= 1 && <p class="muted">{formatMoney(sum.interestSaved, cur, { whole: true })} less interest.</p>}
          <button type="button" class="btn" onClick={use}>
            Use this
          </button>
        </div>
      )}
      {done && (
        <p class="small" role="status" data-testid="more-done">
          Done. Your plan and Today use it now.
        </p>
      )}
      <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={props.onMore}>
        More options
      </button>
    </section>
  );
}
