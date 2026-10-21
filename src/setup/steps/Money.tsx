/** Buffer, Money for the plan, Yearly bills */
import { PAYDAYS_PER_YEAR } from '../../engine';
import { COPY } from '../../lib/copy';
import { parseAmount } from '../../lib/money';
import { Field, NumberInput } from '../../ui/controls';
import { filledDebts, MONTH_CHOICES, newFund, type Draft, type DraftFund } from '../draft';
import type { StepProps } from '../Wizard';

export function BufferStep({ draft, set }: StepProps) {
  return (
    <div class="stack">
      <h1>Your buffer</h1>
      <p>{COPY.buffer}</p>
      <Field label="How much do you have set aside for surprises?" hint="Leave it empty if nothing yet. That's where most people start.">
        <NumberInput pre={draft.currencySymbol} value={draft.bufferNow} onInput={(v) => set({ bufferNow: v })} label="Buffer now" />
      </Field>
      <Field label="Your buffer goal" hint="A plain separate account or an envelope works.">
        <NumberInput pre={draft.currencySymbol} value={draft.bufferGoal} onInput={(v) => set({ bufferGoal: v })} label="Buffer goal" />
      </Field>
    </div>
  );
}

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

export function ExtraStep({ draft, set }: StepProps) {
  const line = minimumsLine(draft);
  const current = parseAmount(draft.extra);
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
            {draft.currencySymbol}{n}
          </button>
        ))}
      </div>
      <p class="muted small">It fills your yearly bills and your buffer first, then goes to one debt at a time.</p>
    </div>
  );
}

const IDEAS = ['Car repairs', 'Gifts and holidays', 'Insurance renewals', 'School'];

export function YearlyStep({ draft, set }: StepProps) {
  const update = (key: string, patch: Partial<DraftFund>) => set({ funds: draft.funds.map((f) => (f.key === key ? { ...f, ...patch } : f)) });
  const unused = IDEAS.filter((i) => !draft.funds.some((f) => f.name === i));
  return (
    <div class="stack">
      <h1>Yearly bills</h1>
      <p class="muted">Bills you know are coming, just not every month. A little each payday means they don't land on a card. You can skip this.</p>
      {draft.funds.map((f) => (
        <div key={f.key} class="card stack">
          <div class="row">
            <span class="label">Yearly bill</span>
            <button type="button" class="link small" onClick={() => set({ funds: draft.funds.filter((x) => x.key !== f.key) })}>
              Remove
            </button>
          </div>
          <Field label="Name">
            <input type="text" value={f.name} onInput={(e) => update(f.key, { name: (e.target as HTMLInputElement).value })} />
          </Field>
          <div class="grid-2">
            <Field label="Cost per year">
              <NumberInput pre={draft.currencySymbol} value={f.perYear} onInput={(v) => update(f.key, { perYear: v })} label={`${f.name} per year`} />
            </Field>
            <Field label="Needed in">
              <select value={f.month} onChange={(e) => update(f.key, { month: (e.target as HTMLSelectElement).value })}>
                {MONTH_CHOICES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      ))}
      <div class="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }}>
        {unused.map((idea) => (
          <button key={idea} type="button" class="pill plain" style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => set({ funds: [...draft.funds, newFund(idea)] })}>
            + {idea}
          </button>
        ))}
        <button type="button" class="pill plain" style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => set({ funds: [...draft.funds, newFund()] })}>
          + Other
        </button>
      </div>
    </div>
  );
}
