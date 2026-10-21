/** Plan: payday list, method switch, what-if, export. */
import { useMemo, useState } from 'preact/hooks';
import { compareMethods, type PayoffMethod } from '../engine';
import { downloadText, planToCsv } from '../lib/csv';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { addDaysISO, dayMonth, monthYear, shortDate } from '../lib/today';
import { biggerNote, billsForPlanRow, totalOf } from '../state/billsDue';
import { applyWhatIf, removeOneOff, setMethod } from '../state/planActions';
import { toPlanInput } from '../state/planInput';
import { act, data, plan, today } from '../state/store';
import { comparisonLine, deltaPhrase, whatIfPlan, whatIfSummary } from '../state/whatIf';
import { CheckIcon, Choice, Field, Note, NumberInput, Sheet } from '../ui/controls';

const FUTURE_STEP = 26;

export function Plan() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const r = plan.value!;
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';

  const [shown, setShown] = useState(FUTURE_STEP);
  const [open, setOpen] = useState<{ kind: 'done'; number: number } | { kind: 'ahead'; index: number } | null>(null);
  const [add, setAdd] = useState(0);
  const [oneAmount, setOneAmount] = useState('');
  const [oneDate, setOneDate] = useState('');
  const [oneNote, setOneNote] = useState('');
  const [applied, setApplied] = useState(false);

  const { method: _m, ...rest } = toPlanInput(d);
  const cmp = useMemo(() => compareMethods(rest), [d]);

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

  const choose = (m: PayoffMethod) => act((db, x) => setMethod(db, x, m));

  // Per payday: the bills due before the next payday, and the total (bills + yearly bills + buffer + extra)
  const rowBills = useMemo(() => r.rows.map((_, i) => billsForPlanRow(d, r, i)), [d, r]);
  const rowTotals = useMemo(() => r.rows.map((row, i) => totalOf(rowBills[i]!, row)), [r, rowBills]);

  const csv = () =>
    downloadText('paidinyellow-plan.csv', planToCsv(r.rows.map((row, i) => ({ row, billsDue: rowBills[i]!.total, total: rowTotals[i]! })), nameOf));

  const opened = open?.kind === 'ahead' ? r.rows[open.index] : undefined;
  const openedBills = open?.kind === 'ahead' ? rowBills[open.index] : undefined;
  const openedTotal = open?.kind === 'ahead' ? rowTotals[open.index] : undefined;
  const openedLog = open?.kind === 'done' ? d.paydays.find((p) => p.number === open.number) : undefined;
  const openedPayments = open?.kind === 'done' ? d.payments.filter((p) => p.paydayNumber === open.number) : [];

  return (
    <main class="screen with-tabs">
      <h1>Plan</h1>

      <section class="card stack" aria-label="Debt-free date">
        {r.debtFreeDate ? (
          <p>
            You can be debt-free by <span class="hl">{monthYear(r.debtFreeDate)}</span>
            {r.paydaysToDebtFree ? ` · ${r.paydaysToDebtFree} paydays` : ''}.
          </p>
        ) : (
          <p>At this pace the plan takes more than 20 years. The what-if below can help you find a way.</p>
        )}
        <div class="row" style={{ justifyContent: 'flex-start', gap: 18 }}>
          <button type="button" class="link small" onClick={csv}>
            Export CSV
          </button>
          <button type="button" class="link small" onClick={() => window.print()}>
            Print one page
          </button>
        </div>
      </section>

      <section class="card stack" aria-labelledby="method-title">
        <h2 id="method-title">Which debt first?</h2>
        <div class="stack" role="radiogroup" aria-label="Payoff order" style={{ gap: 8 }}>
          <Choice checked={s.method === 'paidinyellow'} onSelect={() => choose('paidinyellow')} title="PaidInYellow order" sub="Smallest first. Debts that grow go first." />
          <Choice checked={s.method === 'biggest-interest'} onSelect={() => choose('biggest-interest')} title="Biggest interest first" sub="Highest rate first." />
          <Choice checked={s.method === 'my-order'} onSelect={() => choose('my-order')} title="My own order" sub="The order your debts are in on the Debts tab." />
        </div>
        <p class="muted" data-testid="comparison">
          {comparisonLine(cmp, cur)}
        </p>
      </section>

      <section class="card stack" aria-labelledby="whatif-title">
        <h2 id="whatif-title">What if?</h2>
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
          <div class="card soft stack" style={{ gap: 4 }} data-testid="whatif-result">
            {sum.newDate ? (
              <>
                <p>
                  New date: <b>{monthYear(sum.newDate)}</b>
                </p>
                <p class="num small">
                  {sum.nowEnds
                    ? 'This gets your plan to an end.'
                    : sum.monthsSaved !== null && sum.monthsSaved > 0
                      ? `${sum.monthsSaved} month${sum.monthsSaved === 1 ? '' : 's'} sooner`
                      : 'The same month'}
                  {sum.paydaysSooner !== null && sum.paydaysSooner > 0 ? ` · ${sum.paydaysSooner} payday${sum.paydaysSooner === 1 ? '' : 's'} sooner` : ''}
                  {sum.interestSaved >= 1 ? ` · ${formatMoney(sum.interestSaved, cur, { whole: true })} less interest` : ''}
                </p>
              </>
            ) : (
              <p>Still more than 20 years. A bigger amount might get there.</p>
            )}
          </div>
        ) : (
          <p class="muted small">Move the slider or add one-off money, like a tax refund. You see the new date right here.</p>
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
      </section>

      <section class="card stack" aria-labelledby="list-title">
        <h2 id="list-title">Payday by payday</h2>
        {d.paydays.length === 0 && r.rows.length === 0 && <p class="muted">No paydays yet.</p>}
        <ul class="payday-list" aria-label="Paydays">
          {d.paydays.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                class={`pd${p.status === 'done' ? ' on' : ''}`}
                aria-label={`${shortDate(p.date)}, ${p.status === 'done' ? 'paid' : 'skipped'}`}
                onClick={() => setOpen({ kind: 'done', number: p.number })}
              >
                <span class="pd-box">{p.status === 'done' && <CheckIcon />}</span>
                <span class="pd-date">{shortDate(p.date)}</span>
                <span class="pd-note">{p.status === 'done' ? 'Paid' : 'Skipped'}</span>
                <span class="num pd-amt">{p.status === 'done' ? formatMoneyAuto(p.total, cur) : ''}</span>
              </button>
            </li>
          ))}
          {r.rows.slice(0, shown).map((row, i) => (
            <li key={row.date + i}>
              <button type="button" class="pd" aria-label={`${shortDate(row.date)}, to come`} onClick={() => setOpen({ kind: 'ahead', index: i })}>
                <span class="pd-box" />
                <span class="pd-date">{shortDate(row.date)}</span>
                <span class="pd-note">{row.extraGoesTo ? `Extra to ${nameOf(row.extraGoesTo)}` : row.bufferFirst ? 'Buffer first' : rowBills[i]!.due.length ? 'Bills due' : 'Nothing due'}</span>
                <span class="num pd-amt">{formatMoneyAuto(rowTotals[i]!, cur)}</span>
              </button>
              {biggerNote(rowBills[i]!, row, (n) => formatMoneyAuto(n, cur), dayMonth) && (
                <p class="muted small" data-testid="bigger-note" style={{ margin: '0 0 6px 40px' }}>
                  {biggerNote(rowBills[i]!, row, (n) => formatMoneyAuto(n, cur), dayMonth)}
                </p>
              )}
            </li>
          ))}
        </ul>
        {r.rows.length > shown && (
          <button type="button" class="btn ghost" onClick={() => setShown(shown + FUTURE_STEP)}>
            Show more paydays
          </button>
        )}
      </section>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={opened ? shortDate(opened.date) : openedLog ? shortDate(openedLog.date) : 'Payday'}>
        {opened && (
          <div class="stack" style={{ gap: 6 }}>
            {openedBills?.due.map((b) => (
              <div key={`b${b.debtId}`} class="row">
                <span>
                  {b.name}, due {dayMonth(b.due)}
                </span>
                <span class="num">{formatMoney(b.amount, cur)}</span>
              </div>
            ))}
            {opened.toYearlyBills > 0.004 && (
              <div class="row"><span>Yearly bills</span><span class="num">{formatMoney(opened.toYearlyBills, cur)}</span></div>
            )}
            {opened.toBuffer > 0.004 && (
              <div class="row"><span>Buffer</span><span class="num">{formatMoney(opened.toBuffer, cur)}</span></div>
            )}
            {opened.debts.filter((x) => x.extra > 0.004).map((x) => (
              <div key={`e${x.id}`} class="row">
                <span>Extra to <span class="hl">{nameOf(x.id)}</span></span>
                <span class="num">{formatMoney(x.extra, cur)}</span>
              </div>
            ))}
            <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
              <span>Total</span>
              <span class="num">{formatMoney(openedTotal ?? 0, cur)}</span>
            </div>
            <p class="muted small num" data-testid="debt-left-after">Debt left after: {formatMoney(opened.debtLeft, cur)}</p>
          </div>
        )}
        {openedLog && (
          <div class="stack" style={{ gap: 6 }}>
            {openedLog.status === 'skipped' ? (
              <p>{COPY.missed}</p>
            ) : (
              <>
                {openedLog.bills?.map((b) => (
                  <div key={`b${b.debtId}`} class="row">
                    <span>
                      {b.name}, due {dayMonth(b.due)}
                    </span>
                    <span class="num">{formatMoney(b.amount, cur)}</span>
                  </div>
                ))}
                {openedPayments
                  .filter((p) => p.kind !== 'fund' && !(p.kind === 'minimum' && openedLog.bills !== undefined))
                  .map((p) => (
                    <div key={p.id} class="row">
                      <span>
                        {p.kind === 'minimum' ? `${nameOf(p.debtId!)} minimum` : p.kind === 'extra' ? `Extra to ${nameOf(p.debtId!)}` : 'Buffer'}
                      </span>
                      <span class="num">{formatMoney(p.amount, cur)}</span>
                    </div>
                  ))}
                {openedPayments.some((p) => p.kind === 'fund') && (
                  <div class="row">
                    <span>Yearly bills</span>
                    <span class="num">{formatMoney(openedPayments.filter((p) => p.kind === 'fund').reduce((sum, p) => sum + p.amount, 0), cur)}</span>
                  </div>
                )}
                <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
                  <span>Total</span>
                  <span class="num">{formatMoney(openedLog.total, cur)}</span>
                </div>
                {openedLog.debtLeft !== undefined && (
                  <p class="muted small num" data-testid="debt-left-after">Debt left after: {formatMoney(openedLog.debtLeft, cur)}</p>
                )}
              </>
            )}
          </div>
        )}
        <button type="button" class="btn" onClick={() => setOpen(null)}>Close</button>
      </Sheet>

      {/* Printed by "Print one page": everything else is hidden in print */}
      <section class="print-only" aria-hidden="true">
        <h1>My payoff plan · PaidInYellow</h1>
        <p>{r.debtFreeDate ? `Debt-free by ${monthYear(r.debtFreeDate)}` : 'More than 20 years at this pace'}</p>
        <p>Order: {r.order.map(nameOf).join(', ')}</p>
        <table>
          <thead><tr><th>Payday</th><th>Date</th><th>Total</th><th>Extra goes to</th><th>Debt left</th></tr></thead>
          <tbody>
            {r.rows.slice(0, 26).map((row, i) => (
              <tr key={row.payday}>
                <td>{row.payday}</td>
                <td>{shortDate(row.date)}</td>
                <td>{formatMoney(rowTotals[i]!, cur)}</td>
                <td>{row.extraGoesTo ? nameOf(row.extraGoesTo) : row.bufferFirst ? 'Buffer first' : ''}</td>
                <td>{formatMoney(row.debtLeft, cur, { whole: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{COPY.disclaimer}</p>
      </section>
    </main>
  );
}

