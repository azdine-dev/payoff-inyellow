/** Money tab: buffer, yearly bills, "Find your first $500", debt share of pay. */
import { useState } from 'preact/hooks';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { MONTH_CHOICES } from '../setup/draft';
import {
  addFund,
  editFund,
  findMoneyItems,
  removeFund,
  saveFindMoney,
  setBufferGoal,
  setPaycheck,
  spendFund,
  useBuffer,
  type FundFields,
} from '../state/moneyActions';
import { minimumsPerPayday } from '../engine';
import { activeDebts } from '../state/planInput';
import { act, data, today } from '../state/store';
import { Bar, Checkbox, Field, Note, NumberInput, Sheet } from '../ui/controls';

type Mode = 'use-buffer' | 'goal' | 'paycheck' | 'fund-add' | { fund: string; kind: 'edit' | 'spend' } | null;

export function Money() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const [month, setMonth] = useState('Any time');
  const [msg, setMsg] = useState('');
  const [usedNote, setUsedNote] = useState(false);

  const close = () => {
    setMode(null);
    setText('');
    setText2('');
    setMsg('');
  };
  const money = formatMoneyAuto;

  const bufferPct = s.bufferGoal > 0 ? (d.buffer.amount / s.bufferGoal) * 100 : 100;
  const items = findMoneyItems(d);
  const total = items.reduce((sum, i) => sum + (i.done ? i.amount ?? 0 : 0), 0);
  const potential = items.reduce((sum, i) => sum + (i.amount ?? 0), 0);

  const perPayday = minimumsPerPayday(activeDebts(d), s.frequency) + s.extraPerPayday;
  const share = s.paycheckAmount && s.paycheckAmount > 0 ? (perPayday / s.paycheckAmount) * 100 : null;

  const fund = typeof mode === 'object' && mode ? d.funds.find((f) => f.id === mode.fund) : undefined;

  const openFund = (kind: 'edit' | 'spend', id: string) => {
    const f = d.funds.find((x) => x.id === id)!;
    setText(kind === 'edit' ? String(f.perYear) : '');
    setText2(f.name);
    setMonth(f.month);
    setMode({ fund: id, kind });
  };

  const save = async () => {
    const amount = parseAmount(text);
    const bad = () => setMsg('Type an amount, like 50.');
    if (mode === 'use-buffer') {
      if (amount === null || amount <= 0) return bad();
      await act((db, x) => useBuffer(db, x, amount, text2, today.value));
      setUsedNote(true);
    } else if (mode === 'goal') {
      if (amount === null || amount < 0) return bad();
      await act((db, x) => setBufferGoal(db, x, amount));
    } else if (mode === 'paycheck') {
      if (text.trim() && (amount === null || amount < 0)) return bad();
      await act((db, x) => setPaycheck(db, x, text.trim() ? amount : null));
    } else if (mode === 'fund-add' || (typeof mode === 'object' && mode?.kind === 'edit')) {
      if (amount === null || amount <= 0) return setMsg('Add how much it costs in a year.');
      const f: FundFields = { name: text2.trim() || 'Yearly bill', perYear: amount, month };
      if (mode === 'fund-add') await act((db, x) => addFund(db, x, f));
      else await act((db, x) => editFund(db, x, (mode as { fund: string }).fund, f));
    } else if (typeof mode === 'object' && mode?.kind === 'spend') {
      if (amount === null || amount <= 0) return bad();
      await act((db, x) => spendFund(db, x, (mode as { fund: string }).fund, amount));
    }
    close();
  };

  const toggleIdea = (key: string) =>
    act((db, x) => saveFindMoney(db, x, items.map((i) => (i.key === key ? { ...i, done: !i.done } : i))));
  const setIdeaAmount = (key: string, v: string) =>
    act((db, x) => saveFindMoney(db, x, items.map((i) => (i.key === key ? { ...i, amount: parseAmount(v) } : i))));

  return (
    <main class="screen with-tabs">
      <h1>Money</h1>

      <section class="card stack" aria-labelledby="buffer-title">
        <div class="row">
          <h2 id="buffer-title">Buffer</h2>
          <span class="num" style={{ fontWeight: 600 }}>
            {formatMoney(d.buffer.amount, cur, { whole: true })} of {formatMoney(s.bufferGoal, cur, { whole: true })}
          </span>
        </div>
        <Bar pct={bufferPct} label="Buffer" />
        {usedNote ? <Note>{COPY.bufferUsed}</Note> : <p class="muted small">{COPY.buffer}</p>}
        <div class="row" style={{ justifyContent: 'flex-start', gap: 18 }}>
          <button type="button" class="link small" onClick={() => setMode('use-buffer')}>
            I used some of it
          </button>
          <button type="button" class="link small" onClick={() => { setText(String(s.bufferGoal)); setMode('goal'); }}>
            Change my goal
          </button>
        </div>
        {d.buffer.history.length > 0 && (
          <details>
            <summary class="muted small" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>History</summary>
            <ul class="stack small" style={{ margin: 0, paddingLeft: '1.1rem', gap: 4 }}>
              {[...d.buffer.history].reverse().map((h, i) => (
                <li key={i} class="num">
                  {h.date} · {h.amount < 0 ? '-' : '+'}
                  {money(Math.abs(h.amount), cur)} · {h.note}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section class="card stack" aria-labelledby="yearly-title">
        <h2 id="yearly-title">Yearly bills</h2>
        {d.funds.length === 0 && <p class="muted small">Bills you know are coming, like car repairs or gifts. A little each payday keeps them off a card.</p>}
        {d.funds.map((f) => (
          <div key={f.id} class="stack" style={{ gap: 4, borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
            <div class="row">
              <b>{f.name}</b>
              <span class="num">{money(f.saved, cur)} saved</span>
            </div>
            <Bar pct={f.perYear > 0 ? (f.saved / f.perYear) * 100 : 0} label={`${f.name} saved`} />
            <p class="muted small num">
              {money(f.perYear, cur)} a year · needed {f.month === 'Any time' ? 'any time' : `in ${f.month}`}
            </p>
            <div class="row" style={{ justifyContent: 'flex-start', gap: 18 }}>
              <button type="button" class="link small" onClick={() => openFund('spend', f.id)}>I paid this bill</button>
              <button type="button" class="link small" onClick={() => openFund('edit', f.id)}>Edit</button>
              <button type="button" class="link small" onClick={() => act((db, x) => removeFund(db, x, f.id))}>Remove</button>
            </div>
          </div>
        ))}
        <button type="button" class="btn ghost" onClick={() => { setText(''); setText2(''); setMonth('Any time'); setMode('fund-add'); }}>
          Add a yearly bill
        </button>
      </section>

      <section class="card stack" aria-labelledby="find-title">
        <div class="row">
          <h2 id="find-title">Find your first $500</h2>
          <span class="num" style={{ fontWeight: 600 }}>{formatMoney(total, cur, { whole: true })}</span>
        </div>
        <p class="muted small">Tick what you do. Type what you think each one is worth.</p>
        {items.map((i) => (
          <div key={i.key} class="stack" style={{ gap: 2 }}>
            <Checkbox checked={i.done} onToggle={() => toggleIdea(i.key)}>{i.label}</Checkbox>
            <div style={{ marginLeft: 34, maxWidth: 160 }}>
              <NumberInput pre={cur.symbol} value={i.amount === null ? '' : String(i.amount)} onInput={(v) => setIdeaAmount(i.key, v)} label={`Amount for ${i.label}`} />
            </div>
          </div>
        ))}
        <p class="num small muted">If you do all of them: {formatMoney(potential, cur, { whole: true })}</p>
      </section>

      <section class="card stack" aria-label="Debt share of pay">
        {share !== null ? (
          <p>
            Debt payments are <b class="num">{Math.round(share)}%</b> of your take-home pay.
          </p>
        ) : (
          <p class="muted">Add your usual paycheck to see how much of it goes to debt.</p>
        )}
        <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => { setText(s.paycheckAmount ? String(s.paycheckAmount) : ''); setMode('paycheck'); }}>
          {s.paycheckAmount ? 'Change my paycheck' : 'Add my paycheck'}
        </button>
      </section>

      <Sheet open={mode === 'use-buffer'} onClose={close} title="I used some of my buffer">
        <p class="muted">That's what it's for.</p>
        <Field label="How much?"><NumberInput pre={cur.symbol} value={text} onInput={setText} label="Amount used" /></Field>
        <Field label="What for? (optional)"><input type="text" value={text2} onInput={(e) => setText2((e.target as HTMLInputElement).value)} /></Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>Save</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
      <Sheet open={mode === 'goal'} onClose={close} title="Buffer goal">
        <Field label="Goal"><NumberInput pre={cur.symbol} value={text} onInput={setText} label="Buffer goal" /></Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>Save</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
      <Sheet open={mode === 'paycheck'} onClose={close} title="Your usual paycheck">
        <Field label="Amount" hint="Stays on this phone. Leave it empty to remove it."><NumberInput pre={cur.symbol} value={text} onInput={setText} label="Usual paycheck" /></Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>Save</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
      <Sheet open={mode === 'fund-add' || (typeof mode === 'object' && mode?.kind === 'edit')} onClose={close} title={mode === 'fund-add' ? 'Add a yearly bill' : 'Edit yearly bill'}>
        <Field label="Name"><input type="text" value={text2} onInput={(e) => setText2((e.target as HTMLInputElement).value)} /></Field>
        <div class="grid-2">
          <Field label="Cost per year"><NumberInput pre={cur.symbol} value={text} onInput={setText} label="Cost per year" /></Field>
          <Field label="Needed in">
            <select value={month} onChange={(e) => setMonth((e.target as HTMLSelectElement).value)}>
              {MONTH_CHOICES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>Save</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
      <Sheet open={typeof mode === 'object' && mode?.kind === 'spend'} onClose={close} title={`I paid ${fund?.name ?? 'this bill'}`}>
        <p class="muted">The money saved for it goes down by what you paid.</p>
        <Field label="How much did it cost?"><NumberInput pre={cur.symbol} value={text} onInput={setText} label="Amount paid" /></Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>Save</button>
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>
    </main>
  );
}
