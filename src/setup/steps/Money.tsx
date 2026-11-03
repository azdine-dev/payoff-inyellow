/** Money: what goes toward the plan each payday, and the buffer. One screen. */
import { useState } from 'preact/hooks';
import { PAYDAYS_PER_YEAR } from '../../engine';
import { COPY } from '../../lib/copy';
import { parseAmount } from '../../lib/money';
import { Field, HelpTip, NumberInput, Sheet } from '../../ui/controls';
import { filledDebts, MONTH_CHOICES, newFund, type Draft } from '../draft';
import type { StepProps } from '../Wizard';

const EXTRA_CHIPS = [20, 50, 100];

/** The yearly bill ideas on this step: a short label, and the name the bill gets */
const YEARLY_CHIPS = [
  { label: 'Car repairs', name: 'Car repairs' },
  { label: 'Gifts and holidays', name: 'Gifts and holidays' },
  { label: 'Insurance', name: 'Insurance' },
  { label: 'School', name: 'School' },
];
const whole = (symbol: string, n: number) => `${symbol}${Math.round(n).toLocaleString('en-US')}`;

/** "Your minimums: $466 a month." Null until a debt has a minimum. */
export function minimumsLine(draft: Pick<Draft, 'debts' | 'currencySymbol'>): string | null {
  const monthly = filledDebts(draft as Draft).reduce((s, d) => s + Math.max(0, parseAmount(d.min) ?? 0), 0);
  if (monthly <= 0) return null;
  return `Your minimums: ${whole(draft.currencySymbol, monthly)} a month.`;
}

/**
 * "Help me work it out": what is left of a paycheck after essentials and the debt minimums. The minimums are
 * counted for the buyer (a month of them spread over the paychecks of a month, a rough figure for budgeting only).
 */
export function roomLeft(takeHome: number, essentials: number, monthlyMinimums: number, paychecksPerYear: number | null): number {
  const minimumsPerPaycheck = paychecksPerYear ? (monthlyMinimums * 12) / paychecksPerYear : 0;
  return takeHome - essentials - minimumsPerPaycheck;
}

export function MoneyStep({ draft, set }: StepProps) {
  const [help, setHelp] = useState(false);
  const [takeHome, setTakeHome] = useState('');
  const [essentials, setEssentials] = useState('');
  const sym = draft.currencySymbol || '$';
  const monthly = filledDebts(draft as Draft).reduce((sum, d) => sum + Math.max(0, parseAmount(d.min) ?? 0), 0);
  const ppy = draft.frequency ? PAYDAYS_PER_YEAR[draft.frequency] : null;
  const home = parseAmount(takeHome);
  const need = parseAmount(essentials);
  const bufferGoal = parseAmount(draft.bufferGoal) ?? 0;
  const bufferSummary = bufferGoal > 0
    ? `Your plan fills it first, up to ${whole(sym, bufferGoal)}, before any extra goes to debt.`
    : 'Your plan starts without a safety net goal. You can add one later in Safety net.';
  const known = home !== null && home > 0 && need !== null && need >= 0;
  const left = known ? roomLeft(home!, need!, monthly, ppy) : 0;
  const room = Math.floor(left);
  const use = (n: number) => {
    set({ extra: String(n), ...(draft.paycheck.trim() === '' && home ? { paycheck: String(home) } : {}) });
    setHelp(false);
  };
  // A chip adds the bill (cost and month below it), tapping again takes it away
  const toggleFund = (name: string) => {
    const has = draft.funds.some((f) => f.name === name);
    set({ yearlyNone: false, funds: has ? draft.funds.filter((f) => f.name !== name) : [...draft.funds, newFund(name)] });
  };
  const setFund = (key: string, patch: Partial<Draft['funds'][number]>) => set({ funds: draft.funds.map((f) => (f.key === key ? { ...f, ...patch } : f)) });
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
      <Field label="How much can you put toward the plan each payday, on top of your minimums?" hint={COPY.extraHint(draft.currencySymbol || '$')}>
        <NumberInput pre={draft.currencySymbol} value={draft.extra} onInput={(v) => set({ extra: v })} label="Money for the plan each payday" />
      </Field>
      <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} data-testid="help-work-out" onClick={() => setHelp(true)}>
        Help me work it out
      </button>
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
      <p class="muted small">
        Where does it go?
        <HelpTip title="Where it goes">
          <p>It fills your yearly bills and your buffer first, then goes to one debt at a time.</p>
        </HelpTip>
      </p>

      <Sheet open={help} onClose={() => setHelp(false)} title="Help me work it out">
        <p class="muted">Two numbers per paycheck. We do the rest.</p>
        <Field label="Take-home per paycheck" hint="What lands in your account.">
          <NumberInput pre={sym} value={takeHome} onInput={setTakeHome} label="Take-home per paycheck" />
        </Field>
        <Field label="Essentials per paycheck" hint="Rent, food, utilities, transport. Your debt minimums are counted for you.">
          <NumberInput pre={sym} value={essentials} onInput={setEssentials} label="Essentials per paycheck" />
        </Field>
        {known && monthly > 0 && ppy && (
          <p class="muted small num" data-testid="help-minimums">
            Your debt minimums: about {whole(sym, (monthly * 12) / ppy)} per paycheck.
          </p>
        )}
        {known && (
          <section class="card stack" style={{ gap: 8 }} data-testid="help-result">
            {room >= 1 ? (
              <>
                <p>
                  <b>About {whole(sym, room)} is left.</b> Put some or all of it toward the plan.
                </p>
                <div class="grid-2">
                  <button type="button" class="btn" onClick={() => use(room)}>
                    Use all of it
                  </button>
                  {room >= 2 && (
                    <button type="button" class="btn ghost" onClick={() => use(Math.floor(room / 2))}>
                      Use half
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>Nothing is left after your essentials and minimums right now. That happens. Even {sym}20 matters, so start small, and you can change it any time.</p>
            )}
          </section>
        )}
        <button type="button" class="link" onClick={() => setHelp(false)}>
          Close
        </button>
      </Sheet>

      <section class="stack" style={{ gap: 8, marginTop: 8 }} aria-label="Your safety net">
        <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Your safety net</h2>
        <p class="muted">{bufferSummary}</p>
        <div class="grid-2">
          <Field label="Set aside now" hint="Zero is fine.">
            <NumberInput pre={draft.currencySymbol} value={draft.bufferNow} onInput={(v) => set({ bufferNow: v })} label="Buffer now" />
          </Field>
          <Field label="Goal" hint="A plain separate account or an envelope.">
            <NumberInput pre={draft.currencySymbol} value={draft.bufferGoal} onInput={(v) => set({ bufferGoal: v })} label="Safety net goal" />
          </Field>
        </div>
      </section>

      <section class="stack" style={{ gap: 8, marginTop: 8 }} aria-label="Yearly bills" data-testid="yearly-row">
        <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
          Yearly bills <span class="muted small">(optional)</span>
        </h2>
        <p class="muted">Bills you know are coming. A little each payday keeps them off a card.</p>
        <div class="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }} role="group" aria-label="Yearly bill ideas">
          {YEARLY_CHIPS.map((c) => {
            const on = draft.funds.some((f) => f.name === c.name);
            return (
              <button key={c.label} type="button" class="pill plain chip" aria-pressed={on} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => toggleFund(c.name)}>
                {c.label}
              </button>
            );
          })}
          <button type="button" class="pill plain chip" aria-pressed={draft.yearlyNone} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => set({ yearlyNone: !draft.yearlyNone, funds: [] })}>
            I have none
          </button>
        </div>
        {draft.funds.map((f) => (
          <div key={f.key} class="card stack" style={{ gap: 8 }} data-testid="yearly-fund">
            <b>{f.name}</b>
            <div class="grid-2">
              <Field label="Cost per year">
                <NumberInput pre={draft.currencySymbol} value={f.perYear} onInput={(v) => setFund(f.key, { perYear: v })} label={`${f.name}, cost per year`} />
              </Field>
              <Field label="Needed in">
                <select aria-label={`${f.name}, needed in`} value={f.month} onChange={(e) => setFund(f.key, { month: (e.target as HTMLSelectElement).value })}>
                  {MONTH_CHOICES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        ))}
        {draft.funds.some((f) => (parseAmount(f.perYear) ?? 0) <= 0) && <p class="muted small">Add a cost for each one, or it is left out.</p>}
      </section>
    </div>
  );
}
