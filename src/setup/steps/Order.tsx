/** Payoff order (with the dollar comparison) and Fresh start + payday plan */
import { useMemo } from 'preact/hooks';
import { compareMethods, paydayISO, type PlanInput } from '../../engine';
import { shortDate, timeLabel, WEEKDAYS } from '../../lib/today';
import { comparisonLine } from '../../state/whatIf';
import { startIndex } from '../../state/actions';
import { Choice, Field } from '../../ui/controls';
import { draftDebtInputs, ifThenDefault, myOrderKeys, toSetupValues, type Draft } from '../draft';
import type { StepProps } from '../Wizard';

function draftPlanInput(draft: Draft): Omit<PlanInput, 'method'> {
  const v = toSetupValues(draft);
  return {
    frequency: v.frequency,
    nextPayday: v.nextPayday,
    extraPerPayday: v.extraPerPayday,
    bufferNow: v.bufferNow,
    bufferGoal: v.bufferGoal,
    debts: draftDebtInputs(draft).filter((d) => d.balance > 0),
    yearlyBills: v.funds,
  };
}

export function OrderStep({ draft, set }: StepProps) {
  const symbol = { symbol: draft.currencySymbol };
  const c = useMemo(() => compareMethods(draftPlanInput(draft)), [draft.debts, draft.extra, draft.bufferNow, draft.bufferGoal, draft.funds, draft.frequency, draft.nextPayday]);
  const comparison = comparisonLine(c, symbol);

  const keys = myOrderKeys(draft);
  const inputs = draftDebtInputs(draft);
  const nameOf = (k: string) => inputs.find((d) => d.id === k)?.name ?? '';
  const move = (i: number, dir: -1 | 1) => {
    const next = [...keys];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ myOrder: next });
  };

  return (
    <div class="stack">
      <h1>Which debt first?</h1>
      <div class="stack" role="radiogroup" aria-label="Payoff order" style={{ gap: 8 }}>
        <Choice
          checked={draft.method === 'paidinyellow'}
          onSelect={() => set({ method: 'paidinyellow' })}
          title={c.suggestBiggestInterest ? 'PaidInYellow order' : 'PaidInYellow order (recommended)'}
          sub="Smallest balance first, so you see a debt disappear soon. Debts that grow go first."
        />
        <Choice
          checked={draft.method === 'biggest-interest'}
          onSelect={() => set({ method: 'biggest-interest' })}
          title="Biggest interest first"
          sub="The highest rate first, so less goes to interest."
        />
        <Choice checked={draft.method === 'my-order'} onSelect={() => set({ method: 'my-order', myOrder: keys })} title="My own order" sub="You decide." />
      </div>
      <p class="card" style={{ margin: 0 }}>
        {comparison}
      </p>
      {draft.method === 'my-order' && (
        <ol class="stack" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 8 }}>
          {keys.map((k, i) => (
            <li key={k} class="card row" style={{ padding: '6px 6px 6px 16px' }}>
              <span>
                {i + 1}. {nameOf(k)}
              </span>
              <span>
                <button type="button" class="link" style={{ width: 44 }} aria-label={`Move ${nameOf(k)} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" class="link" style={{ width: 44 }} aria-label={`Move ${nameOf(k)} down`} disabled={i === keys.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function FreshStartStep({ draft, set, today }: StepProps) {
  const freq = draft.frequency || 'biweekly';
  const nextMonthIndex = startIndex({ frequency: freq, nextPayday: draft.nextPayday, startMode: 'next-month' }, today);
  const nextMonthDate = paydayISO(draft.nextPayday, freq, nextMonthIndex + 1);
  const day = ifThenDefault(draft);
  return (
    <div class="stack">
      <h1>When do you start?</h1>
      <p class="muted">A fresh start helps. Pick the one that feels right.</p>
      <div class="stack" role="radiogroup" aria-label="Start date" style={{ gap: 8 }}>
        <Choice checked={draft.startMode === 'this-payday'} onSelect={() => set({ startMode: 'this-payday' })} title="This payday" sub={shortDate(draft.nextPayday)} />
        {nextMonthIndex > 0 && (
          <Choice
            checked={draft.startMode === 'next-month'}
            onSelect={() => set({ startMode: 'next-month' })}
            title="On the 1st of next month"
            sub={`Your first payday after it: ${shortDate(nextMonthDate)}`}
          />
        )}
      </div>
      <h2 style={{ fontSize: '1.3rem', marginTop: 8 }}>Your payday plan</h2>
      <p class="muted">People who decide when and where they'll act follow through more often.</p>
      <div class="grid-2">
        <Field label="When I get paid on">
          <select value={day} onChange={(e) => set({ ifThenDay: (e.target as HTMLSelectElement).value })}>
            <option value="payday">payday</option>
            {WEEKDAYS.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </Field>
        <Field label="I open PaidInYellow at">
          <input type="time" value={draft.ifThenTime} onInput={(e) => set({ ifThenTime: (e.target as HTMLInputElement).value })} />
        </Field>
      </div>
      <p class="card soft" style={{ margin: 0 }}>
        {ifThenLine(day, draft.ifThenTime)}
      </p>
    </div>
  );
}

export function ifThenLine(day: string, time: string) {
  return (
    <>
      When I get paid{day === 'payday' ? '' : ' on '}
      {day !== 'payday' && <b>{day}</b>}, I open PaidInYellow at <b>{timeLabel(time || '20:00')}</b>.
    </>
  );
}
