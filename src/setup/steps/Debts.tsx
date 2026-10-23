/** Debts: the ones already added are one line each above the form. Only the debt being filled in is open. */
import { useState } from 'preact/hooks';
import { COPY } from '../../lib/copy';
import { parseAmount } from '../../lib/money';
import { ordinal } from '../../lib/today';
import { DEFAULT_RATE } from '../../state/debtActions';
import { Field, Note, NumberInput } from '../../ui/controls';
import { emptyDebt, type DraftDebt } from '../draft';
import type { StepProps } from '../Wizard';

const TYPES = ['Credit card', 'Store card', 'Car loan', 'Student loan', 'Medical bill', 'Personal loan', 'Family or friend', 'Other'];

/** "22.9" as 22.9, whatever way it was typed or pasted. */
const rate = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Quiet questions about numbers that look like a typo. They are only questions: nothing is blocked,
 * and the buyer can keep what they typed.
 */
export function debtChecks(d: DraftDebt): string[] {
  const out: string[] = [];
  const bal = parseAmount(d.balance);
  const apr = parseAmount(d.apr);
  const min = parseAmount(d.min);
  if (apr !== null && apr > 60) out.push(`Is ${rate(apr)}% right? Most cards are 15-30%.`);
  if (bal !== null && min !== null && bal > 0 && min > bal) out.push('Your minimum is larger than the balance. Is that right?');
  if (grows(d)) out.push('At this minimum the balance won’t go down. Check the statement.');
  return out;
}

function grows(d: DraftDebt): boolean {
  const bal = parseAmount(d.balance) ?? 0;
  const apr = parseAmount(d.apr) ?? 0;
  const min = parseAmount(d.min);
  return bal > 0 && apr > 0 && min !== null && min <= (bal * apr) / 1200;
}

/** Name, balance and minimum are there. The rate may be empty (24% is used, "rate missing"). The due day is recommended. */
export function debtComplete(d: DraftDebt): boolean {
  return d.name.trim() !== '' && parseAmount(d.balance) !== null && parseAmount(d.min) !== null && (d.apr.trim() === '' || parseAmount(d.apr) !== null);
}

const plain = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** What the one-line row shows: "Store Card" / "26.99% · $35 a month · due the 2nd" / "$890". */
export function debtRow(d: DraftDebt, symbol: string, index: number): { name: string; sub: string; amount: string } {
  const apr = parseAmount(d.apr);
  const min = parseAmount(d.min);
  const bal = parseAmount(d.balance);
  const bits: string[] = [];
  if (d.apr.trim() === '') bits.push('rate missing');
  else if (apr !== null) bits.push(`${plain(apr)}%`);
  if (min !== null) bits.push(`${symbol}${plain(min)} a month`);
  const day = Number(d.dueDay);
  if (d.dueDay.trim() && Number.isInteger(day) && day >= 1 && day <= 31) bits.push(`due the ${ordinal(day)}`);
  return { name: d.name.trim() || `Debt ${index + 1}`, sub: bits.join(' · '), amount: bal === null ? '' : `${symbol}${plain(bal)}` };
}

function DebtCard(props: {
  debt: DraftDebt;
  index: number;
  symbol: string;
  canRemove: boolean;
  onChange: (p: Partial<DraftDebt>) => void;
  onRemove: () => void;
  onAdd: () => void;
}) {
  const { debt: d, index } = props;
  const [more, setMore] = useState(Boolean(d.type || d.autopay));
  return (
    <fieldset class="card stack open-debt" style={{ margin: 0 }}>
      <legend class="sr-only">Debt {index + 1}</legend>
      <div class="row">
        <span class="label">Debt {index + 1}</span>
        {props.canRemove && (
          <button type="button" class="link small" onClick={props.onRemove}>
            Remove
          </button>
        )}
      </div>
      <Field label="Name">
        <input type="text" placeholder="Visa, Store card, Mom…" value={d.name} onInput={(e) => props.onChange({ name: (e.target as HTMLInputElement).value })} />
      </Field>
      <div class="grid-2">
        <Field label="Balance">
          <NumberInput pre={props.symbol} value={d.balance} onInput={(v) => props.onChange({ balance: v })} label="Balance" />
        </Field>
        <Field label="Interest rate">
          <NumberInput post="%" value={d.apr} onInput={(v) => props.onChange({ apr: v })} label="Interest rate" />
        </Field>
      </div>
      <div class="grid-2">
        <Field label="Monthly minimum">
          <NumberInput pre={props.symbol} value={d.min} onInput={(v) => props.onChange({ min: v })} label="Monthly minimum" />
        </Field>
        <Field label="Due day (recommended)" hint="It’s on your statement.">
          <input type="text" inputMode="numeric" maxLength={2} value={d.dueDay} onInput={(e) => props.onChange({ dueDay: (e.target as HTMLInputElement).value.replace(/\D/g, '') })} />
        </Field>
      </div>
      <p class="muted small">Don’t know the rate? Leave it. We’ll use {DEFAULT_RATE}% and remind you. Example: 22.9.</p>
      {debtChecks(d).map((n) => (
        <Note key={n}>{n}</Note>
      ))}
      {grows(d) && <Note>{COPY.debtGrows}</Note>}
      {more ? (
        <>
          <Field label="Type (optional)">
            <select value={d.type} onChange={(e) => props.onChange({ type: (e.target as HTMLSelectElement).value })}>
              <option value="">Choose a type</option>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <label class="row" style={{ justifyContent: 'flex-start', minHeight: 44 }}>
            <input type="checkbox" checked={d.autopay} onChange={(e) => props.onChange({ autopay: (e.target as HTMLInputElement).checked })} style={{ width: 22, height: 22 }} />
            <span>The minimum is paid by autopay</span>
          </label>
        </>
      ) : (
        <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>
          Add type and autopay
        </button>
      )}
      <button type="button" class="btn dashed" onClick={props.onAdd}>
        + Add another debt
      </button>
    </fieldset>
  );
}

export function DebtsStep({ draft, set }: StepProps) {
  const update = (key: string, patch: Partial<DraftDebt>) => set({ debts: draft.debts.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  // Only the debt being filled in is open. The rest are one line each: tap one to change it.
  const [openKey, setOpenKey] = useState<string | null>(() => draft.debts.find((d) => !debtComplete(d))?.key ?? null);
  const [tried, setTried] = useState(false);
  const open = draft.debts.find((d) => d.key === openKey);

  const addAnother = () => {
    // The debt in front of you must be done first, so a half-filled one is never left behind as a one-line row
    if (open && !debtComplete(open) && (open.name.trim() || open.balance.trim() || open.min.trim() || open.apr.trim())) {
      setTried(true);
      return;
    }
    setTried(false);
    const fresh = open && !debtComplete(open) ? open : emptyDebt();
    if (fresh !== open) set({ debts: [...draft.debts, fresh] });
    setOpenKey(fresh.key);
  };

  return (
    <div class="stack">
      <h1>What do you owe?</h1>
      <p class="muted">Everything is on your statement. Rough numbers are fine for now.</p>
      {draft.debts.map((d, i) => {
        if (d.key === openKey) return null;
        const row = debtRow(d, draft.currencySymbol, i);
        return (
          <button key={d.key} type="button" class="card debt-row" data-testid="debt-summary" aria-label={`Edit ${d.name.trim() || `debt ${i + 1}`}`} onClick={() => setOpenKey(d.key)}>
            <span class="debt-row-main">
              <span class="debt-row-name">{row.name}</span>
              <span class="debt-row-sub num">
                {row.sub}
                {!debtComplete(d) && ' · needs details'}
              </span>
            </span>
            <span class="debt-row-amount num">{row.amount}</span>
          </button>
        );
      })}
      {open && (
        <DebtCard
          key={open.key}
          debt={open}
          index={draft.debts.indexOf(open)}
          symbol={draft.currencySymbol}
          canRemove={draft.debts.length > 1}
          onChange={(p) => update(open.key, p)}
          onRemove={() => {
            set({ debts: draft.debts.filter((x) => x.key !== open.key) });
            setOpenKey(null);
          }}
          onAdd={addAnother}
        />
      )}
      {!open && (
        <button type="button" class="btn dashed" onClick={addAnother}>
          + Add another debt
        </button>
      )}
      {tried && <Note>Finish this debt first: its name, balance and monthly minimum.</Note>}
    </div>
  );
}
