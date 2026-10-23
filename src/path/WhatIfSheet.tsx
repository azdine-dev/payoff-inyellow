/** "What if I add more?": the slider, quick amounts and one-off money, shown in a bottom sheet. Nothing changes until "Use this in my plan". */
import { useMemo, useState } from 'preact/hooks';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { addDaysISO, monthYear, shortDate } from '../lib/today';
import { applyWhatIf, removeOneOff } from '../state/planActions';
import { act, data, plan, today } from '../state/store';
import { deltaPhrase, whatIfPlan, whatIfSummary } from '../state/whatIf';
import { Field, Note, NumberInput, Sheet } from '../ui/controls';

function Body() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const r = plan.value!;
  const [add, setAdd] = useState(0);
  const [oneAmount, setOneAmount] = useState('');
  const [oneDate, setOneDate] = useState('');
  const [oneNote, setOneNote] = useState('');
  const [applied, setApplied] = useState(false);

  const oneOff = (() => {
    const amount = parseAmount(oneAmount);
    return amount && amount > 0 && oneDate ? { amount, date: oneDate } : null;
  })();
  const wi = useMemo(() => whatIfPlan(d, add, oneOff), [d, add, oneAmount, oneDate]);
  const sum = whatIfSummary(r, wi);
  const changed = add > 0 || oneOff !== null;
  // Quick amounts, each with what it would change: no second plan, just the difference
  const chips = useMemo(
    () => [25, 50, 100].map((n) => ({ n, phrase: deltaPhrase(whatIfSummary(r, whatIfPlan(d, n, null)), (v) => formatMoney(v, cur, { whole: true })) })),
    [d, r],
  );
  return (
    <>
        <p class="muted small">Try it here first. Nothing changes until you tap Use this in my plan.</p>
        <label class="field">
          <span>
            Add <b class="num">{formatMoneyAuto(add, cur)}</b> each payday
          </span>
          <input type="range" min="0" max="1000" step="10" value={add} aria-label="Add money each payday" onInput={(e) => { setAdd(Number((e.target as HTMLInputElement).value)); setApplied(false); }} />
        </label>
        <div class="stack" style={{ gap: 8 }} role="group" aria-label="Quick what-ifs">
          {chips.map((c) => (
            <button
              key={c.n}
              type="button"
              class="choice chip-delta"
              aria-pressed={add === c.n}
              onClick={() => {
                setAdd(add === c.n ? 0 : c.n);
                setApplied(false);
              }}
            >
              <span class="choice-text">
                <span>+{formatMoneyAuto(c.n, cur)} each payday</span>
                {c.phrase && <small class="hint">{c.phrase}</small>}
              </span>
            </button>
          ))}
        </div>
        <div class="grid-2">
          <Field label="One-off money">
            <NumberInput pre={cur.symbol} value={oneAmount} onInput={(v) => { setOneAmount(v); setApplied(false); }} label="One-off money" />
          </Field>
          <Field label="On this date">
            <input type="date" min={today.value} max={addDaysISO(today.value, 3650)} value={oneDate} onInput={(e) => { setOneDate((e.target as HTMLInputElement).value); setApplied(false); }} />
          </Field>
        </div>
        {oneOff && <Field label="What is it? (optional)"><input type="text" placeholder="Tax refund" value={oneNote} onInput={(e) => setOneNote((e.target as HTMLInputElement).value)} /></Field>}

        {changed ? (
          <div class="stack" style={{ gap: 8 }} data-testid="whatif-result">
            {sum.newDate ? (
              <div class="whatif-cards">
                <div class="card mini">
                  <p class="muted small">Debt-free</p>{' '}
                  <p class="mini-num">{monthYear(sum.newDate)}</p>{' '}
                  <p class="muted small">instead of {r.debtFreeDate ? monthYear(r.debtFreeDate) : 'more than 20 years'}</p>
                </div>
                {sum.paydaysSooner !== null && (
                  <div class="card mini">
                    <p class="mini-num num">{Math.max(0, sum.paydaysSooner)}</p>{' '}
                    <p class="muted small">payday{sum.paydaysSooner === 1 ? '' : 's'} sooner</p>
                  </div>
                )}
                <div class="card mini">
                  <p class="mini-num num">{formatMoney(Math.max(0, sum.interestSaved), cur, { whole: true })}</p>{' '}
                  <p class="muted small">less interest</p>
                </div>
              </div>
            ) : (
              <p>Still more than 20 years. A bigger amount might get there.</p>
            )}
          </div>
        ) : (
          <p class="muted small">Move the slider, tap an amount, or add one-off money, like a tax refund.</p>
        )}

        <button
          type="button"
          class="btn"
          disabled={!changed}
          onClick={async () => {
            await act((db, x) => applyWhatIf(db, x, add, oneOff ? { ...oneOff, note: oneNote.trim() || 'One-off money' } : null));
            setAdd(0);
            setOneAmount('');
            setOneDate('');
            setOneNote('');
            setApplied(true);
          }}
        >
          Use this in my plan
        </button>
        {applied && <Note>Done. Your plan and Today use it now.</Note>}

        {s.oneOffs.length > 0 && (
          <div class="stack" style={{ gap: 4 }}>
            <p class="label">Planned one-off money</p>
            {s.oneOffs.map((o) => (
              <div key={o.id} class="row" style={{ borderTop: '1px dashed var(--line)' }}>
                <span class="num small">
                  {shortDate(o.date)} · {formatMoney(o.amount, cur, { whole: Number.isInteger(o.amount) })} · {o.note}
                </span>
                <button type="button" class="link small" onClick={() => act((db, x) => removeOneOff(db, x, o.id))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
    </>
  );
}

export function WhatIfSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="What if I add more?">
      <Body />
      <button type="button" class="link" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}
