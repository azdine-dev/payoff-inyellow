/** Money: what goes toward the plan each payday, and the buffer. One screen. */
import { PAYDAYS_PER_YEAR } from '../../engine';
import { COPY } from '../../lib/copy';
import { parseAmount } from '../../lib/money';
import { Field, NumberInput } from '../../ui/controls';
import { filledDebts, type Draft } from '../draft';
import type { StepProps } from '../Wizard';

const EXTRA_CHIPS = [20, 50, 100, 150];
const whole = (symbol: string, n: number) => `${symbol}${Math.round(n).toLocaleString('en-US')}`;

/** "Your minimums: $466 a month, about $215 each payday." Null until a debt has a minimum. */
export function minimumsLine(draft: Pick<Draft, 'debts' | 'frequency' | 'currencySymbol'>): string | null {
  const monthly = filledDebts(draft as Draft).reduce((s, d) => s + Math.max(0, parseAmount(d.min) ?? 0), 0);
  if (monthly <= 0) return null;
  const ppy = draft.frequency ? PAYDAYS_PER_YEAR[draft.frequency] : null;
  const sym = draft.currencySymbol;
  return ppy
    ? `Your minimums: ${whole(sym, monthly)} a month, about ${whole(sym, (monthly * 12) / ppy)} each payday.`
    : `Your minimums: ${whole(sym, monthly)} a month.`;
}

export function MoneyStep({ draft, set }: StepProps) {
  const line = minimumsLine(draft);
  const current = parseAmount(draft.extra);
  const isChip = EXTRA_CHIPS.includes(current ?? -1) && draft.extra.trim() === String(current);
  return (
    <div class="stack">
      <h1>Money for the plan</h1>
      {line && (
        <p class="card" data-testid="minimums-line">
          {line}
        </p>
      )}
      <Field label="How much can you put toward the plan each payday, on top of your minimums?" hint={COPY.extraHint}>
        <NumberInput pre={draft.currencySymbol} value={draft.extra} onInput={(v) => set({ extra: v })} label="Money for the plan each payday" />
      </Field>
      <div class="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }} role="group" aria-label="Quick amounts">
        {EXTRA_CHIPS.map((n) => (
          <button key={n} type="button" class="pill plain chip" aria-pressed={current === n} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => set({ extra: String(n) })}>
            {draft.currencySymbol}
            {n}
          </button>
        ))}
        <button
          type="button"
          class="pill plain chip"
          aria-pressed={draft.extra.trim() !== '' && !isChip}
          style={{ minHeight: 44, cursor: 'pointer' }}
          onClick={() => {
            if (isChip) set({ extra: '' });
            (document.querySelector('input[aria-label="Money for the plan each payday"]') as HTMLInputElement | null)?.focus();
          }}
        >
          Other
        </button>
      </div>
      <p class="muted small">It fills your yearly bills and your buffer first, then goes to one debt at a time.</p>

      <h2 style={{ fontSize: '1.3rem', marginTop: 8 }}>Your buffer</h2>
      <p class="muted">{COPY.buffer}</p>
      <div class="grid-2">
        <Field label="Set aside now" hint="Empty is fine.">
          <NumberInput pre={draft.currencySymbol} value={draft.bufferNow} onInput={(v) => set({ bufferNow: v })} label="Buffer now" />
        </Field>
        <Field label="Buffer goal" hint="A plain separate account or an envelope.">
          <NumberInput pre={draft.currencySymbol} value={draft.bufferGoal} onInput={(v) => set({ bufferGoal: v })} label="Buffer goal" />
        </Field>
      </div>
    </div>
  );
}
