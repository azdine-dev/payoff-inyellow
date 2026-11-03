/**
 * Money coming later (design/path-features/ComingLater), inside "Extra money". The only typed field is the amount.
 * The payday defaults to the next one and the type is optional. The new debt-free date shows before anything is saved.
 * On that payday Today asks "Did it arrive?" and counts it only after Yes.
 */
import { useMemo, useState } from 'preact/hooks';
import { formatMoney, parseAmount } from '../lib/money';
import { fullDate } from '../lib/today';
import { arrivalDue } from '../state/planInput';
import { addComingLater, confirmArrived } from '../state/planActions';
import { act, data, plan, today } from '../state/store';
import { comingLaterPlan, whatIfSummary } from '../state/whatIf';
import { Field, NumberInput } from '../ui/controls';

const KINDS = ['Tax refund', 'Bonus', 'Gift', 'Other'] as const;

/** "Fri 16 Jul", or with the year when it is not the same year as the other date */
const noYear = (iso: string, other: string) => (iso.slice(0, 4) === other.slice(0, 4) ? fullDate(iso).replace(/ \d{4}$/, '') : fullDate(iso));

export function ComingLaterPanel({ onDone }: { onDone: () => void }) {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const rows = r.rows.slice(0, 52);
  const [kind, setKind] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState<string>(rows[0]?.date ?? '');
  const amount = parseAmount(amountText);
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';

  const effect = useMemo(() => {
    if (!amount || amount <= 0 || !date) return null;
    const next = comingLaterPlan(d, amount, date);
    const row = next.rows.find((x) => x.date === date);
    const goesTo = row?.extraGoesTo ? nameOf(row.extraGoesTo) : null;
    return { summary: whatIfSummary(r, next), next, goesTo, buffer: Boolean(row && !row.extraGoesTo && row.bufferFirst) };
  }, [d, r, amount, date]);

  const money = (n: number) => formatMoney(n, cur, { whole: true });
  const s = effect?.summary;
  const bits: string[] = [];
  if (s?.paydaysSooner && s.paydaysSooner > 0) bits.push(`${s.paydaysSooner} payday${s.paydaysSooner === 1 ? '' : 's'} sooner`);
  if (s && s.interestSaved >= 1) bits.push(`${money(s.interestSaved)} less interest`);

  return (
    <>
      <div class="stack" style={{ gap: 6 }}>
        <p class="label-strong">What is it?</p>
        <div class="el-chips" role="group" aria-label="What is it?">
          {KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <Field label="How much?">
        <NumberInput pre={cur.symbol} value={amountText} onInput={setAmountText} label="Money coming later" />
      </Field>
      <div class="stack" style={{ gap: 6 }}>
        <label class="label-strong" for="later-payday">
          Which payday?
        </label>
        <div class="el-select">
          <select id="later-payday" aria-label="Which payday?" value={date} onChange={(e) => setDate((e.target as HTMLSelectElement).value)}>
            {rows.map((x) => (
              <option key={x.date} value={x.date}>
                {fullDate(x.date)}
              </option>
            ))}
          </select>
        </div>
        <p class="muted small">Not sure? Pick a later payday. You can move it.</p>
      </div>

      {effect && s && (
        <div class="el-effect" data-testid="later-effect">
          <span class="muted small">{effect.goesTo ? `If it goes to ${effect.goesTo}` : effect.buffer ? 'If it fills your buffer first' : 'If it comes in'}</span>
          {s.newDate ? (
            <span style={{ fontSize: '1rem', lineHeight: 1.4 }} data-testid="later-debtfree">
              {r.debtFreeDate && s.newDate !== r.debtFreeDate ? (
                <>
                  Debt-free <b>{fullDate(s.newDate)}</b> instead of {noYear(r.debtFreeDate, s.newDate)}
                </>
              ) : (
                <>
                  Debt-free stays <b>{fullDate(s.newDate)}</b>
                </>
              )}
            </span>
          ) : (
            <span data-testid="later-debtfree">Still more than 20 years. A bigger amount might get there.</span>
          )}
          {bits.length > 0 && <span class="muted small">{bits.join(' · ')}</span>}
        </div>
      )}

      <button
        type="button"
        class="btn"
        disabled={!amount || amount <= 0 || !date}
        onClick={async () => {
          await act((db, x) => addComingLater(db, x, { amount: amount!, date, kind }));
          onDone();
        }}
      >
        Add to my plan
      </button>
      <p class="muted small" style={{ textAlign: 'center' }}>
        On that payday, Today asks if it arrived. Nothing moves until you say yes.
      </p>
    </>
  );
}

/** "Did it arrive?": on the payday the money was planned for, Today asks before counting it */
export function ArrivalCard() {
  const d = data.value!;
  const s = d.settings;
  const due = arrivalDue(s);
  const [notYet, setNotYet] = useState<Set<string>>(new Set());
  if (!due || notYet.has(due.id)) return null;
  return (
    <section class="card calm stack" style={{ gap: 6 }} aria-label="Did it arrive?" data-testid="arrival-card">
      <p class="label">Did it arrive?</p>
      <p>
        <b class="num">{formatMoney(due.amount, s.currency, { whole: true })}</b>
        {due.kind ? ` · ${due.kind}` : ''} · planned for {fullDate(due.date)}
      </p>
      <button type="button" class="btn" onClick={() => act((db, x) => confirmArrived(db, x, due.id))}>
        Yes, it arrived
      </button>
      <button type="button" class="link" onClick={() => setNotYet(new Set(notYet).add(due.id))}>
        Not yet
      </button>
      <p class="muted small">It is counted in this payday only after you say yes.</p>
    </section>
  );
}
