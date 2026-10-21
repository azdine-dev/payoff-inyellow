/** Debts: quick add, unlimited. */
import { useState } from 'preact/hooks';
import { COPY } from '../../lib/copy';
import { parseAmount } from '../../lib/money';
import { Field, Note, NumberInput } from '../../ui/controls';
import { emptyDebt, type DraftDebt } from '../draft';
import type { StepProps } from '../Wizard';

const TYPES = ['Credit card', 'Store card', 'Car loan', 'Student loan', 'Medical bill', 'Personal loan', 'Family or friend', 'Other'];

function grows(d: DraftDebt): boolean {
  const bal = parseAmount(d.balance) ?? 0;
  const apr = parseAmount(d.apr) ?? 0;
  const min = parseAmount(d.min);
  return bal > 0 && apr > 0 && min !== null && min <= (bal * apr) / 1200;
}

function DebtCard(props: { debt: DraftDebt; index: number; symbol: string; canRemove: boolean; onChange: (p: Partial<DraftDebt>) => void; onRemove: () => void }) {
  const { debt: d, index } = props;
  const [more, setMore] = useState(Boolean(d.type || d.autopay));
  return (
    <fieldset class="card stack" style={{ margin: 0 }}>
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
      <Field label="Balance you owe">
        <NumberInput pre={props.symbol} value={d.balance} onInput={(v) => props.onChange({ balance: v })} label="Balance" />
      </Field>
      <div class="grid-2">
        <Field label="Interest rate" hint="Example: 22.9. It’s on your statement as APR.">
          <NumberInput post="%" value={d.apr} onInput={(v) => props.onChange({ apr: v })} label="Interest rate" />
        </Field>
        <Field label="Monthly minimum">
          <NumberInput pre={props.symbol} value={d.min} onInput={(v) => props.onChange({ min: v })} label="Monthly minimum" />
        </Field>
      </div>
      <Field label="Due day (recommended)" hint="It’s on your statement.">
        <input type="text" inputMode="numeric" maxLength={2} value={d.dueDay} onInput={(e) => props.onChange({ dueDay: (e.target as HTMLInputElement).value.replace(/\D/g, '') })} />
      </Field>
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
    </fieldset>
  );
}

export function DebtsStep({ draft, set }: StepProps) {
  const update = (key: string, patch: Partial<DraftDebt>) => set({ debts: draft.debts.map((d) => (d.key === key ? { ...d, ...patch } : d)) });
  return (
    <div class="stack">
      <h1>Your debts</h1>
      <p class="muted">Cards, loans, medical bills, money from family. You find the rate and minimum on your statement.</p>
      {draft.debts.map((d, i) => (
        <DebtCard
          key={d.key}
          debt={d}
          index={i}
          symbol={draft.currencySymbol}
          canRemove={draft.debts.length > 1}
          onChange={(p) => update(d.key, p)}
          onRemove={() => set({ debts: draft.debts.filter((x) => x.key !== d.key) })}
        />
      ))}
      <button type="button" class="btn ghost" onClick={() => set({ debts: [...draft.debts, emptyDebt()] })}>
        Add another
      </button>
    </div>
  );
}
