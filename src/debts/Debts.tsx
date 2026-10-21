/** Debts tab: one card per debt, add, edit, archive, new charge, update from statement. */
import { StatusLine } from '../ui/StatusLine';
import { useState } from 'preact/hooks';
import { growingDebts } from '../engine';
import type { ChargeTag, Debt } from '../data/types';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { ordinal, shortMonthYear } from '../lib/today';
import { dateMoveSentence } from '../state/changeNote';
import { showNotice } from '../state/notice';
import { simulatePlan } from '../engine';
import { addDebt, archiveDebt, editDebt, logCharge, restoreDebt, updateBalance, type DebtFields } from '../state/debtActions';
import { toDebtInput, toPlanInput } from '../state/planInput';
import { act, data, plan, today } from '../state/store';
import { Bar, Choice, Field, Note, NumberInput, Sheet } from '../ui/controls';

type Mode = { kind: 'add' } | { kind: 'actions' | 'edit' | 'charge' | 'statement'; id: string } | null;

const TAGS: { value: ChargeTag; label: string }[] = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'one-off', label: 'One-off' },
];

const str = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

function DebtForm({ debt, onSave, onCancel, symbol }: { debt?: Debt; onSave: (f: DebtFields) => void; onCancel: () => void; symbol: string }) {
  const [f, setF] = useState({
    name: debt?.name ?? '',
    balance: debt ? str(debt.balance) : '',
    apr: debt ? str(debt.apr) : '',
    min: debt ? str(debt.minMonthly) : '',
    dueDay: debt?.dueDay ? String(debt.dueDay) : '',
    autopay: debt?.autopay ?? false,
  });
  const [note, setNote] = useState('');
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const save = () => {
    const balance = parseAmount(f.balance);
    const apr = parseAmount(f.apr);
    const min = parseAmount(f.min);
    const day = f.dueDay.trim() ? Number(f.dueDay) : null;
    if (!f.name.trim()) return setNote('Give this debt a name.');
    if (balance === null || balance < 0) return setNote('Add the balance you owe.');
    if (apr === null || apr < 0 || apr > 100) return setNote('Add the interest rate, from 0 to 100. Type 0 if there is none.');
    if (min === null || min < 0) return setNote('Add the monthly minimum. Type 0 if there is none.');
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return setNote('The due day is a day of the month, from 1 to 31.');
    onSave({ name: f.name.trim(), type: debt?.type ?? '', balance, apr, minMonthly: min, dueDay: day, autopay: f.autopay });
  };

  return (
    <>
      <Field label="Name">
        <input type="text" value={f.name} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
      </Field>
      <Field label="Balance you owe">
        <NumberInput pre={symbol} value={f.balance} onInput={(v) => set({ balance: v })} label="Balance" />
      </Field>
      <div class="grid-2">
        <Field label="Interest rate">
          <NumberInput post="%" value={f.apr} onInput={(v) => set({ apr: v })} label="Interest rate" />
        </Field>
        <Field label="Monthly minimum">
          <NumberInput pre={symbol} value={f.min} onInput={(v) => set({ min: v })} label="Monthly minimum" />
        </Field>
      </div>
      <Field label="Due day (recommended)" hint="It’s on your statement.">
        <input type="text" inputMode="numeric" maxLength={2} value={f.dueDay} onInput={(e) => set({ dueDay: (e.target as HTMLInputElement).value.replace(/\D/g, '') })} />
      </Field>
      <label class="row" style={{ justifyContent: 'flex-start', minHeight: 44 }}>
        <input type="checkbox" checked={f.autopay} onChange={(e) => set({ autopay: (e.target as HTMLInputElement).checked })} style={{ width: 22, height: 22 }} />
        <span>The minimum is paid by autopay</span>
      </label>
      {note && <Note>{note}</Note>}
      <button type="button" class="btn" onClick={save}>
        Save
      </button>
      <button type="button" class="link" onClick={onCancel}>
        Cancel
      </button>
    </>
  );
}

export function Debts() {
  const d = data.value!;
  const cur = d.settings.currency;
  const r = plan.value!;
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [tag, setTag] = useState<ChargeTag>('everyday');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  const growing = new Set(growingDebts(d.debts.filter((x) => x.status === 'active').map(toDebtInput)));
  const active = d.debts.filter((x) => x.status === 'active');
  const paid = d.debts.filter((x) => x.status === 'paid');
  const archived = d.debts.filter((x) => x.status === 'archived');
  const current = mode && mode.kind !== 'add' ? d.debts.find((x) => x.id === mode.id) : undefined;
  const orderIndex = (id: string) => r.order.indexOf(id);
  const sorted = [...active].sort((a, b) => orderIndex(a.id) - orderIndex(b.id));

  const close = () => {
    setMode(null);
    setText('');
    setNote('');
    setMsg('');
  };

  const saveAmount = async () => {
    const amount = parseAmount(text);
    if (!current || amount === null || amount < 0 || (mode?.kind === 'charge' && amount === 0)) return setMsg('Type an amount, like 25.');
    if (mode?.kind === 'charge') {
      const before = plan.value!;
      const next = await act((db, x) => logCharge(db, x, current.id, amount, tag, note, today.value));
      showNotice('info', `That adds ${formatMoneyAuto(amount, cur)} to ${current.name}. ${dateMoveSentence(before, simulatePlan(toPlanInput(next)))}`);
    }
    else await act((db, x) => updateBalance(db, x, current.id, amount));
    close();
  };

  const card = (debt: Debt) => {
    const pct = debt.startBalance > 0 ? (1 - debt.balance / debt.startBalance) * 100 : 100;
    const goneBy = r.paidOff[debt.id];
    const paydaysLeft = goneBy ? r.rows.findIndex((row) => row.debts.some((x) => x.id === debt.id && x.balanceAfter <= 0.005)) + 1 : null;
    const isPaid = debt.status === 'paid';
    return (
      <section
        key={debt.id}
        class="card stack"
        style={isPaid ? { background: 'var(--yellow)', borderColor: 'var(--yellow)', color: 'var(--on-yellow)' } : undefined}
        aria-label={debt.name}
      >
        <div
          class="stack debt-hit"
          role="button"
          tabIndex={0}
          aria-label={`${debt.name}, options`}
          onClick={() => setMode({ kind: 'actions', id: debt.id })}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setMode({ kind: 'actions', id: debt.id }))}
        >
        <div class="row">
          <h2>{debt.name}</h2>
          {isPaid ? <b>PAID</b> : <span class="num" style={{ fontWeight: 600 }}>{formatMoney(debt.balance, cur, { whole: true })}</span>}
        </div>
        {isPaid ? (
          <p>{COPY.debtPaid}</p>
        ) : (
          <>
            <Bar pct={pct} label={`${debt.name} paid off`} />
            <p class="muted small num">
              {Math.floor(pct)}% gone · {debt.apr}% rate · minimum {formatMoneyAuto(debt.minMonthly, cur)}
              {debt.dueDay ? ` · due on the ${ordinal(debt.dueDay)}${debt.autopay ? ' (autopay)' : ''}` : ''}
            </p>
            <p class="muted small">
              {goneBy ? `Gone by ${shortMonthYear(goneBy)}${paydaysLeft ? ` · ${paydaysLeft} paydays left` : ''}` : 'Not gone within 20 years at this pace'}
            </p>
            {growing.has(debt.id) && <Note>{debt.name} grows even with the minimum. It's first in your plan.</Note>}
          </>
        )}
        </div>
      </section>
    );
  };

  return (
    <main class="screen with-tabs">
      <h1>Debts</h1>
      <StatusLine />
      {sorted.map(card)}
      {!active.length && <p class="card">No debts to pay right now.</p>}
      <button type="button" class="btn ghost" onClick={() => setMode({ kind: 'add' })}>
        Add a debt
      </button>
      {paid.length > 0 && (
        <>
          <p class="label">Paid</p>
          {paid.map(card)}
        </>
      )}
      {archived.length > 0 && (
        <>
          <p class="label">Archived</p>
          {archived.map((a) => (
            <div key={a.id} class="card row">
              <span>{a.name}</span>
              <button type="button" class="link small" onClick={() => act((db, x) => restoreDebt(db, x, a.id))}>
                Bring back
              </button>
            </div>
          ))}
        </>
      )}

      <Sheet open={mode?.kind === 'actions'} onClose={close} title={current?.name ?? ''}>
        {current && (
          <>
            {current.status !== 'paid' && (
              <>
                <button type="button" class="btn ghost" onClick={() => { setText(''); setMode({ kind: 'charge', id: current.id }); }}>
                  Log a new charge or fee
                </button>
                <button type="button" class="btn ghost" onClick={() => { setText(str(current.balance)); setMode({ kind: 'statement', id: current.id }); }}>
                  Update from statement
                </button>
              </>
            )}
            <button type="button" class="btn ghost" onClick={() => setMode({ kind: 'edit', id: current.id })}>
              Edit
            </button>
            <button type="button" class="link" onClick={async () => { await act((db, x) => archiveDebt(db, x, current.id)); close(); }}>
              Archive
            </button>
            <button type="button" class="link" onClick={close}>
              Close
            </button>
          </>
        )}
      </Sheet>
      <Sheet open={mode?.kind === 'add'} onClose={close} title="Add a debt">
        <DebtForm symbol={cur.symbol} onCancel={close} onSave={async (f) => { await act((db, x) => addDebt(db, x, f)); close(); }} />
      </Sheet>
      <Sheet open={mode?.kind === 'edit'} onClose={close} title={`Edit ${current?.name ?? ''}`}>
        {current && (
          <DebtForm key={current.id} debt={current} symbol={cur.symbol} onCancel={close} onSave={async (f) => { await act((db, x) => editDebt(db, x, current.id, f)); close(); }} />
        )}
      </Sheet>
      <Sheet open={mode?.kind === 'charge'} onClose={close} title="Log a new charge or fee">
        <p class="muted">It goes on {current?.name}. Your plan updates. No judgment, it just keeps the numbers true.</p>
        <Field label="Amount">
          <NumberInput pre={cur.symbol} value={text} onInput={setText} label="Charge amount" />
        </Field>
        <div class="stack" role="radiogroup" aria-label="What was it" style={{ gap: 8 }}>
          {TAGS.map((t) => (
            <Choice key={t.value} checked={tag === t.value} onSelect={() => setTag(t.value)} title={t.label} />
          ))}
        </div>
        <Field label="Note (optional)">
          <input type="text" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} />
        </Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={saveAmount}>Add to balance</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
      <Sheet open={mode?.kind === 'statement'} onClose={close} title="Update from statement">
        <Field label={`What does your statement say ${current?.name ?? ''} is now?`} hint="This replaces the balance in the app, so the plan matches reality.">
          <NumberInput pre={cur.symbol} value={text} onInput={setText} label="Balance on statement" />
        </Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={saveAmount}>Update balance</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
    </main>
  );
}
