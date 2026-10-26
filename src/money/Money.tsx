/** Safety net tab (was Money): buffer, yearly bills, "Find your first $500", debt share of pay. */
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
  spendFund,
  useBuffer,
  type FundFields,
} from '../state/moneyActions';
import { PAYDAYS_PER_YEAR } from '../engine';
import { activeDebts } from '../state/planInput';
import { act, data, today } from '../state/store';
import { useCountUp } from '../ui/useCountUp';
import { Bar, Checkbox, ChevronRight, Field, Note, NumberInput, Sheet } from '../ui/controls';

type Mode = 'use-buffer' | 'goal' | 'find' | 'pick-fund' | 'fund-add' | { fund: string; kind: 'edit' | 'spend' } | null;

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

  // Over a year: twelve months of minimums plus the plan money on every payday, against a year of paychecks
  const yearToDebt = activeDebts(d).reduce((sum, x) => sum + x.minMonthly * 12, 0) + s.extraPerPayday * PAYDAYS_PER_YEAR[s.frequency];
  const share = s.paycheckAmount && s.paycheckAmount > 0 ? (yearToDebt / (s.paycheckAmount * PAYDAYS_PER_YEAR[s.frequency])) * 100 : null;

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

  const findTitle = `Find your first ${formatMoney(500, cur, { whole: true })}`;
  const shownBuffer = useCountUp(d.buffer.amount, 'buffer');
  const ready = d.buffer.amount >= s.bufferGoal && s.bufferGoal > 0;
  const perYearTotal = d.funds.reduce((sum, f) => sum + f.perYear, 0);
  const eachPayday = perYearTotal / PAYDAYS_PER_YEAR[s.frequency];

  return (
    <main class="screen with-tabs">
      <h1>Safety net</h1>
      <p class="muted">So the next surprise bill stays off your cards.</p>

      <section class="card stack" aria-labelledby="buffer-title">
        <p class="label" id="buffer-title">
          Surprise buffer
        </p>
        <div class="row" style={{ justifyContent: 'flex-start', alignItems: 'baseline', gap: 10 }}>
          <span class="buffer-big num" data-testid="buffer-amount">
            {money(shownBuffer, cur)}
          </span>{' '}
          <span class="muted">
            of {formatMoney(s.bufferGoal, cur, { whole: true })}
            {ready && (
              <>
                {' · '}
                <span class="hl" data-testid="buffer-ready">
                  ready
                </span>
              </>
            )}
          </span>
        </div>
        <Bar pct={bufferPct} label="Buffer" />
        {usedNote ? <Note>{COPY.bufferUsed}</Note> : <p class="muted">Kept in a plain separate account or an envelope. If you use some, your plan refills it first.</p>}
        <button type="button" class="btn" onClick={() => setMode('use-buffer')}>
          I used some of it
        </button>
        <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => { setText(String(s.bufferGoal)); setMode('goal'); }}>
          Change my goal
        </button>
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
        <div class="row" style={{ alignItems: 'baseline' }}>
          <p class="label" id="yearly-title">
            Yearly bills
          </p>
          {d.funds.length > 0 && <span class="muted num">{money(eachPayday, cur)} each payday</span>}
        </div>
        {d.funds.length === 0 && <p class="muted">Bills you know are coming, like car repairs or gifts. A little each payday keeps them off a card.</p>}
        {d.funds.map((f) => (
          <button key={f.id} type="button" class="fund-row" aria-label={`${f.name}, edit`} onClick={() => openFund('edit', f.id)}>
            <span class="row">
              <b>{f.name}</b>
              <span class="num">
                {money(f.saved, cur)} of {money(f.perYear, cur)}
              </span>
            </span>
            <span class="bar ink" role="img" aria-label={`${f.name} saved`}>
              <span style={{ width: `${Math.min(100, f.perYear > 0 ? (f.saved / f.perYear) * 100 : 0)}%` }} />
            </span>
            <span class="muted small">{f.month === 'Any time' ? 'Any time' : `Needed in ${f.month}`}</span>
          </button>
        ))}
        <div class="grid-2">
          <button
            type="button"
            class="btn ghost"
            disabled={d.funds.length === 0}
            onClick={() => (d.funds.length === 1 ? openFund('spend', d.funds[0]!.id) : setMode('pick-fund'))}
          >
            I paid a bill
          </button>
          <button type="button" class="btn dashed" onClick={() => { setText(''); setText2(''); setMonth('Any time'); setMode('fund-add'); }}>
            + Add a bill
          </button>
        </div>
      </section>

      <button type="button" class="card find-row" onClick={() => setMode('find')}>
        <span class="stack" style={{ gap: 2, textAlign: 'left' }}>
          <b>{findTitle}</b>
          <span class="muted small">
            {items.length} small ideas, with a live total{total > 0 ? ` · ${formatMoney(total, cur, { whole: true })} so far` : ''}
          </span>
        </span>
        <ChevronRight />
      </button>

      {share !== null && (
        <p class="muted" style={{ textAlign: 'center' }} aria-label="Debt share of pay">
          Debt payments are <b class="num">{Math.round(share)}%</b> of your take-home pay.
        </p>
      )}

      <Sheet open={mode === 'find'} onClose={close} title={findTitle}>
        <div class="row">
          <span class="muted small">Tick what you do. Type what you think each one is worth.</span>
          <span class="num" style={{ fontWeight: 600 }} data-testid="find-total">
            {formatMoney(total, cur, { whole: true })}
          </span>
        </div>
        {items.map((i) => (
          <div key={i.key} class="stack" style={{ gap: 2 }}>
            <Checkbox checked={i.done} onToggle={() => toggleIdea(i.key)}>{i.label}</Checkbox>
            <div style={{ marginLeft: 34, maxWidth: 160 }}>
              <NumberInput pre={cur.symbol} value={i.amount === null ? '' : String(i.amount)} onInput={(v) => setIdeaAmount(i.key, v)} label={`Amount for ${i.label}`} />
            </div>
          </div>
        ))}
        <p class="num small muted">If you do all of them: {formatMoney(potential, cur, { whole: true })}</p>
        <button type="button" class="btn" onClick={close}>Done</button>
      </Sheet>

      <Sheet open={mode === 'pick-fund'} onClose={close} title="Which bill did you pay?">
        {d.funds.map((f) => (
          <button key={f.id} type="button" class="btn ghost" onClick={() => openFund('spend', f.id)}>
            {f.name}
          </button>
        ))}
        <button type="button" class="link" onClick={close}>Cancel</button>
      </Sheet>

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
        {fund && typeof mode === 'object' && mode?.kind === 'edit' && (
          <button type="button" class="link" onClick={async () => { await act((db, x) => removeFund(db, x, fund.id)); close(); }}>Remove this bill</button>
        )}
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
