/** Debts tab: one card per debt, add, edit, archive, new charge, update from statement. */
import { useEffect, useState } from 'preact/hooks';
import { growingDebts } from '../engine';
import type { ChargeTag, Debt } from '../data/types';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { diffDays, ordinal, shortDate, shortMonthYear } from '../lib/today';
import { dateMoveSentence } from '../state/changeNote';
import { showNotice } from '../state/notice';
import { simulatePlan } from '../engine';
import { addDebt, archiveDebt, DEFAULT_RATE, editDebt, logCharge, restoreDebt, updateBalance, type DebtFields } from '../state/debtActions';
import { toDebtInput, toPlanInput } from '../state/planInput';
import { act, data, freshPaidDebts, openDebtId, plan, today } from '../state/store';
import { Count } from '../ui/useCountUp';
import { CheckIcon, Choice, Field, Note, NumberInput, PlusIcon, Sheet } from '../ui/controls';
import { Ring } from '../ui/Ring';

type Mode = { kind: 'add' } | { kind: 'actions' | 'edit' | 'charge' | 'statement' | 'history'; id: string } | null;

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
    apr: debt && !debt.rateMissing ? str(debt.apr) : '',
    min: debt && !debt.minPending ? str(debt.minMonthly) : '',
    dueDay: debt?.dueDay ? String(debt.dueDay) : '',
    autopay: debt?.autopay ?? false,
  });
  const [note, setNote] = useState('');
  // A new debt starts as a quick add: name, balance and rate. Editing shows everything.
  const [more, setMore] = useState(Boolean(debt));
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const save = () => {
    const balance = parseAmount(f.balance);
    const apr = parseAmount(f.apr);
    const min = parseAmount(f.min);
    const day = f.dueDay.trim() ? Number(f.dueDay) : null;
    if (!f.name.trim()) return setNote('Give this debt a name.');
    if (balance === null || balance < 0) return setNote('Add the balance you owe.');
    // The rate can wait: left empty, 24% is used and the debt is marked "rate missing" until the real one is added
    if (f.apr.trim() && (apr === null || apr < 0 || apr > 100)) return setNote('The interest rate should be a number from 0 to 100, like 22.9. Type 0 if there is none.');
    // The minimum can wait: left empty it counts as 0 and the debt carries a soft tag until it is added
    if (f.min.trim() && (min === null || min < 0)) return setNote('The monthly minimum should be a number. Type 0 if there is none.');
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return setNote('The due day is a day of the month, from 1 to 31.');
    onSave({ name: f.name.trim(), type: debt?.type ?? '', balance, apr: apr ?? DEFAULT_RATE, rateMissing: !f.apr.trim(), minMonthly: min ?? 0, minPending: !f.min.trim(), dueDay: day, autopay: f.autopay });
  };

  return (
    <>
      <Field label="Name">
        <input type="text" value={f.name} onInput={(e) => set({ name: (e.target as HTMLInputElement).value })} />
      </Field>
      <Field label="Balance you owe">
        <NumberInput pre={symbol} value={f.balance} onInput={(v) => set({ balance: v })} label="Balance" />
      </Field>
      <Field label="Interest rate" hint={`Example: 22.9. Leave it empty if you don’t know it: we’ll use ${DEFAULT_RATE}%.`}>
        <NumberInput post="%" value={f.apr} onInput={(v) => set({ apr: v })} label="Interest rate" />
      </Field>
      {more ? (
        <>
          <Field label="Monthly minimum" hint={debt ? undefined : 'You can leave it empty and add it later.'}>
            <NumberInput pre={symbol} value={f.min} onInput={(v) => set({ min: v })} label="Monthly minimum" />
          </Field>
          <Field label="Due day (recommended)" hint="It’s on your statement.">
            <input type="text" inputMode="numeric" maxLength={2} value={f.dueDay} onInput={(e) => set({ dueDay: (e.target as HTMLInputElement).value.replace(/\D/g, '') })} />
          </Field>
          <label class="row" style={{ justifyContent: 'flex-start', minHeight: 44 }}>
            <input type="checkbox" checked={f.autopay} onChange={(e) => set({ autopay: (e.target as HTMLInputElement).checked })} style={{ width: 22, height: 22 }} />
            <span>The minimum is paid by autopay</span>
          </label>
        </>
      ) : (
        <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(true)}>
          Add minimum and due day now
        </button>
      )}
      {!more && <p class="muted small">Quick add. Until you add the minimum, the plan counts it as {symbol}0.</p>}
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

  // Tapped on another screen (the focus debt card on Today): open that debt's sheet
  useEffect(() => {
    if (!openDebtId.value) return;
    const id = openDebtId.value;
    openDebtId.value = null;
    if (d.debts.some((x) => x.id === id)) setMode({ kind: 'actions', id });
  }, [openDebtId.value]);

  // The paid card turns yellow and the next debt slides in once, then it is just the screen
  useEffect(() => {
    if (!freshPaidDebts.value.length) return;
    const t = setTimeout(() => (freshPaidDebts.value = []), 1200);
    return () => clearTimeout(t);
  }, [freshPaidDebts.value]);

  // History of one debt, newest first: bills and extras paid, new charges, statement updates. Read-only.
  const historyOf = (debt: Debt) => {
    const rows: { key: string; date: string; label: string; detail: string }[] = [];
    for (const p of d.payments) {
      if (p.debtId !== debt.id || (p.kind !== 'minimum' && p.kind !== 'extra')) continue;
      rows.push({ key: p.id, date: p.date, label: p.kind === 'minimum' ? 'Bill paid' : p.planned ? 'Extra paid' : 'Extra payment', detail: formatMoney(p.amount, cur) });
    }
    for (const c of d.charges) {
      if (c.debtId !== debt.id) continue;
      const tag = TAGS.find((t) => t.value === c.tag)?.label ?? '';
      rows.push({ key: c.id, date: c.date, label: `New charge or fee${tag ? ` (${tag})` : ''}${c.note ? `, ${c.note}` : ''}`, detail: `+${formatMoney(c.amount, cur)}` });
    }
    (debt.statements ?? []).forEach((st, i) => rows.push({ key: `st${i}`, date: st.date, label: 'Updated from statement', detail: `${formatMoney(st.from, cur)} to ${formatMoney(st.to, cur)}` }));
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  };

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
    else await act((db, x) => updateBalance(db, x, current.id, amount, Date.now(), today.value));
    close();
  };

  const owedTotal = sorted.reduce((sum, x) => sum + x.balance, 0);
  const goneText = (iso: string) => (diffDays(today.value, iso) <= 92 ? shortDate(iso, today.value) : shortMonthYear(iso));
  const tagFor = (i: number) => (i === 0 ? '1 · Paying now' : i === 1 ? '2 · Next' : `${i + 1} · Later`);

  const card = (debt: Debt, index: number) => {
    const pct = debt.startBalance > 0 ? (1 - debt.balance / debt.startBalance) * 100 : 100;
    const goneBy = r.paidOff[debt.id];
    const isPaid = debt.status === 'paid';
    const bill = debt.minPending ? null : formatMoneyAuto(debt.minMonthly, cur);
    return (
      <section
        key={debt.id}
        class={`card stack debt-card${index === 0 && !isPaid ? ' now' : ''}${isPaid ? ' paid' : ''}${isPaid && freshPaidDebts.value.includes(debt.id) ? ' just-paid' : ''}${!isPaid && index === 0 && freshPaidDebts.value.length > 0 ? ' slide-in' : ''}`}
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
          {isPaid ? (
            <>
              <div class="row">
                <h2 class="struck">{debt.name}</h2>
                <span class="paid-stamp small-stamp">
                  <CheckIcon /> PAID
                </span>
              </div>
              <p>{COPY.debtPaid}</p>
            </>
          ) : (
            <>
              <div class="row">
                <span class={`pos-tag${index === 0 ? ' now' : ''}`}>{tagFor(index)}</span>
                <span class="muted small num">{goneBy ? `gone by ${goneText(goneBy)}` : 'not gone within 20 years'}</span>
              </div>
              <div class="row debt-main">
                <div class="stack" style={{ gap: 2 }}>
                  <h2>{debt.name}</h2>
                  <span class="num debt-left">
                    <Count value={debt.balance} id={`debt-${debt.id}`} format={(n) => formatMoney(n, cur, { whole: true })} />
                  </span>
                </div>
                <Ring pct={pct} size={60} label={`${debt.name} paid off`} />
              </div>
              <p class="muted small num">
                {Math.floor(pct)}% gone · {debt.rateMissing ? `rate missing, using ${debt.apr}%` : `${debt.apr}%`}
                {bill ? ` · ${bill} bill${debt.dueDay ? ` on the ${ordinal(debt.dueDay)}` : ''}` : ''}
                {debt.autopay ? ' · autopay' : ''}
              </p>
              {debt.minPending && (
                <span class="tag" data-testid="min-pending" style={{ alignSelf: 'flex-start' }}>
                  Add your minimum
                </span>
              )}
              {growing.has(debt.id) && !debt.minPending && <p class="small">Grows even with the minimum, so it goes first.</p>}
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <main class="screen with-tabs">
      <header class="today-head">
        <div class="stack" style={{ gap: 2 }}>
          <h1>Debts</h1>
          <p class="muted num" data-testid="owed-line">
            {active.length ? `${formatMoney(owedTotal, cur, { whole: true })} left · in the order you pay them` : 'Nothing left to pay'}
          </p>
        </div>
        <button type="button" class="round-btn dark" aria-label="Add a debt" onClick={() => setMode({ kind: 'add' })}>
          <PlusIcon />
        </button>
      </header>
      {sorted.map(card)}
      {!active.length && <p class="card">No debts to pay right now.</p>}
      {active.length > 0 && (
        <section class="card stack" aria-label="Tap a debt to">
          <p class="label">Tap a debt to</p>
          <p>Update from my statement</p>
          <p>Add a new charge or fee</p>
          <p>Edit or archive</p>
        </section>
      )}
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
                  Add a new charge or fee
                </button>
                <button type="button" class="btn ghost" onClick={() => { setText(str(current.balance)); setMode({ kind: 'statement', id: current.id }); }}>
                  Update from my statement
                </button>
              </>
            )}
            <button type="button" class="btn ghost" onClick={() => setMode({ kind: 'history', id: current.id })}>
              History
            </button>
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
      <Sheet open={mode?.kind === 'history'} onClose={close} title={`${current?.name ?? ''} history`}>
        {current && (
          <>
            {historyOf(current).length === 0 ? (
              <p class="muted">Nothing yet. Payments, new charges and statement updates show here.</p>
            ) : (
              <ul class="history-list" data-testid="debt-history">
                {historyOf(current).map((h) => (
                  <li key={h.key}>
                    <span class="stack" style={{ gap: 0 }}>
                      <b>{h.label}</b>
                      <span class="muted small">{shortDate(h.date, today.value)}</span>
                    </span>
                    <span class="num">{h.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" class="btn" onClick={close}>
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
      <Sheet open={mode?.kind === 'charge'} onClose={close} title="Add a new charge or fee">
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
