/** "Payday list": every payday, one line each. Tap a payday to open what is in it. */
import { useMemo, useState } from 'preact/hooks';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { dayMonth, monthYear, shortDate, shortMonthYear } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { changeablePayday, changePaid, markNotPaid, notPaidPreview } from '../state/actions';
import { parseAmount } from '../lib/money';
import { paidFromLog } from '../today/model';
import { showNotice } from '../state/notice';
import { act, data, plan, previewDate, today } from '../state/store';
import { CheckIcon, Field, NumberInput, Sheet } from '../ui/controls';
import { Empty } from '../ui/Empty';

const FUTURE_STEP = 26;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "July 2027" */
const monthName = (iso: string) => `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

/** What a payday held, as small tags. Outline for what is ahead, yellow once it is paid. */
const TAG_KINDS = [
  { kind: 'minimum', label: 'Bill' },
  { kind: 'extra', label: 'Extra' },
  { kind: 'buffer', label: 'Buffer' },
  { kind: 'fund', label: 'Yearly' },
] as const;

/** Items in date order, grouped by month ("2026-11"). */
function monthGroups<T>(items: T[], dateOf: (x: T) => string): { month: string; items: T[] }[] {
  const groups: { month: string; items: T[] }[] = [];
  for (const it of items) {
    const month = dateOf(it).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.items.push(it);
    else groups.push({ month, items: [it] });
  }
  return groups;
}

export function PaydayListBody() {
  const d = data.value!;
  const cur = d.settings.currency;
  const r = plan.value!;
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const [shown, setShown] = useState(FUTURE_STEP);
  const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<'upcoming' | 'done'>('upcoming');
  // "Mark as not paid": only the most recent paid payday, and only while nothing else moved since
  const [notPaid, setNotPaid] = useState<number | null>(null);
  const [step, setStep] = useState<'view' | 'change' | 'confirm'>('view');
  const [amountText, setAmountText] = useState('');
  const latestDone = d.paydays.reduce((m, x) => Math.max(m, x.number), 0);
  const preview = notPaid !== null ? notPaidPreview(d) : null;
  const toggle = (key: string) => setOpen(open === key ? null : key);
  const changeable = changeablePayday(d)?.number ?? null;

  // Per payday: the bills due before the next payday, and the total (bills + yearly bills + buffer + extra)
  const rowBills = useMemo(() => r.rows.map((_, i) => billsForPlanRow(d, r, i)), [d, r]);
  const rowTotals = useMemo(() => r.rows.map((row, i) => totalOf(rowBills[i]!, row)), [r, rowBills]);

  const line = (label: string, amount: number, key: string, extra?: string) => (
    <div key={key} class="row">
      <span>{extra ?? label}</span>
      <span class="num">{formatMoney(amount, cur)}</span>
    </div>
  );

  const doneDetail = (p: (typeof d.paydays)[number]) => {
    const payments = d.payments.filter((x) => x.paydayNumber === p.number);
    return (
        <div class="stack pd-detail" style={{ gap: 6 }} role="group" aria-label={`${shortDate(p.date)} details`}>
          {p.status === 'skipped' ? (
            <p>{COPY.missed}</p>
          ) : (
            <>
              {p.bills?.map((b) => line('', b.amount, `b${b.debtId}`, `${b.name}, due ${dayMonth(b.due)}`))}
              {payments
                .filter((x) => x.kind !== 'fund' && !(x.kind === 'minimum' && p.bills !== undefined))
                .map((x) => line('', x.amount, x.id, x.kind === 'minimum' ? `${nameOf(x.debtId!)} minimum` : x.kind === 'extra' ? `Extra to ${nameOf(x.debtId!)}` : 'Buffer'))}
              {payments.some((x) => x.kind === 'fund') &&
                line('Yearly bills', payments.filter((x) => x.kind === 'fund').reduce((sum, x) => sum + x.amount, 0), 'funds')}
              <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
                <span>Total</span>
                <span class="num">{formatMoney(p.total, cur)}</span>
              </div>
              {p.debtLeft !== undefined && (
                <p class="muted small num" data-testid="debt-left-after">
                  Debt left after: {formatMoney(p.debtLeft, cur)}
                </p>
              )}
              {p.status === 'done' && p.number < latestDone && (
                <p class="muted small" data-testid="undo-later-first">
                  Undo the later ones first.
                </p>
              )}
            </>
          )}
        </div>
    );
  };

  return (
    <>
      <div class="row" style={{ justifyContent: 'flex-start', gap: 8 }} role="group" aria-label="Which paydays">
        {(['upcoming', 'done'] as const).map((v) => (
          <button key={v} type="button" class="pill plain chip" aria-pressed={list === v} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => setList(v)}>
            {v === 'upcoming' ? 'Coming up' : `Done${d.paydays.length ? ` (${d.paydays.length})` : ''}`}
          </button>
        ))}
      </div>

      {list === 'done' && d.paydays.length === 0 && <Empty art="calendar" line="No paydays done yet. Your first one turns yellow." />}
      {list === 'upcoming' && r.rows.length === 0 && <Empty art="calendar" line="No paydays ahead. That is the finish line." />}

      <div class="timeline" aria-label="Paydays">
        {list === 'done'
          ? monthGroups(d.paydays, (p) => p.date).map((g) => (
              <div key={g.month}>
                <h3 class="month-head">{monthYear(g.items[0]!.date)}</h3>
                <ul class="payday-list">
                  {g.items.map((p) => {
                    const payments = d.payments.filter((x) => x.paydayNumber === p.number);
                    const kinds = new Set(payments.map((x) => x.kind));
                    const key = `done-${p.number}`;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          class={`pd${p.status === 'done' ? ' on' : ''}`}
                          aria-expanded={open === key}
                          aria-label={`${shortDate(p.date)}, ${p.status === 'done' ? 'paid' : 'skipped'}`}
                          aria-haspopup={p.status === 'done' && changeable === p.number ? 'dialog' : undefined}
                          onClick={() => (p.status === 'done' && changeable === p.number ? (setStep('view'), setNotPaid(p.number)) : toggle(key))}
                        >
                          <span class="pd-box">{p.status === 'done' && <CheckIcon />}</span>
                          <span class="pd-date">{shortDate(p.date)}</span>
                          <span class="pd-note">{p.status === 'done' ? (changeable === p.number ? 'Latest · tap to see or undo' : 'Paid') : 'Skipped'}</span>
                          <span class="num pd-amt">{p.status === 'done' ? formatMoneyAuto(p.total, cur) : ''}</span>
                          {p.status === 'done' && <span class="tag paid">Paid</span>}
                        </button>
                        {p.status === 'done' && (
                          <div class="tags" aria-hidden="true">
                            {TAG_KINDS.filter((t) => kinds.has(t.kind)).map((t) => (
                              <span key={t.kind} class="tag">
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {open === key && doneDetail(p)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          : monthGroups(r.rows.slice(0, shown).map((row, i) => ({ row, i })), (x) => x.row.date).map((g) => (
              <div key={g.month}>
                <h3 class="month-head">{monthYear(g.items[0]!.row.date)}</h3>
                <ul class="payday-list">
                  {g.items.map(({ row, i }) => {
                    const bills = rowBills[i]!;
                    return (
                      <li key={row.date + i}>
                        <button type="button" class={`pd${i === 0 ? ' current' : ''}`} aria-current={i === 0 ? 'step' : undefined} aria-haspopup="dialog" aria-label={`${shortDate(row.date)}, to come`} onClick={() => (previewDate.value = row.date)}>
                          <span class="pd-box" />
                          <span class="pd-date">{shortDate(row.date)}</span>
                          <span class="pd-note">{row.extraGoesTo ? `Extra to ${nameOf(row.extraGoesTo)}` : row.bufferFirst ? 'Buffer first' : bills.due.length ? 'Bills due' : 'Nothing due'}</span>
                          <span class="num pd-amt">{formatMoneyAuto(rowTotals[i]!, cur)}</span>
                        </button>
                        <div class="tags" aria-hidden="true">
                          {bills.due.length > 0 && <span class="tag">Bill</span>}
                          {row.extraGoesTo && <span class="tag">Extra</span>}
                          {row.toBuffer > 0.004 && <span class="tag">Buffer</span>}
                          {row.toYearlyBills > 0.004 && <span class="tag">Yearly</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
      </div>
      {list === 'upcoming' && r.rows.length > shown && (
        <button type="button" class="btn ghost" onClick={() => setShown(shown + FUTURE_STEP)}>
          Show more paydays
        </button>
      )}

      <Sheet
        open={preview !== null}
        onClose={() => setNotPaid(null)}
        center={step === 'confirm'}
        icon={step === 'confirm' ? <UndoIcon /> : undefined}
        aside={preview && step !== 'confirm' ? `You paid ${formatMoneyAuto(preview.log.total, cur)}` : undefined}
        title={preview ? (step === 'confirm' ? `Mark ${shortDate(preview.log.date, today.value)} as not paid?` : shortDate(preview.log.date, today.value)) : ''}
      >
        {preview && step === 'view' && (
          <>
            <div class="stack pd-lines" style={{ gap: 0 }} role="group" aria-label={`${shortDate(preview.log.date)} details`}>
              {(paidFromLog(d, preview.log.number)?.rows ?? []).map((x) => (
                <div key={x.key} class="row">
                  <span>{x.label}</span>
                  <b class="num">{formatMoney(x.amount, cur)}</b>
                </div>
              ))}
            </div>
            {preview.log.debtLeft !== undefined && (
              <p class="muted small num" data-testid="debt-left-after">
                Debt left after: {formatMoney(preview.log.debtLeft, cur)}
              </p>
            )}
            <button
              type="button"
              class="btn outline"
              onClick={() => {
                setAmountText(String(preview.log.planMoney));
                setStep('change');
              }}
            >
              Change what I paid
            </button>
            <button type="button" class="btn sage" onClick={() => setStep('confirm')}>
              Mark as not paid
            </button>
            <p class="muted small" style={{ textAlign: 'center' }}>
              Older paydays: undo the later ones first.
            </p>
          </>
        )}
        {preview && step === 'change' && (
          <>
            <Field label="How much went to the plan that payday?" hint="Your bills stay the same. The rest follows the same order.">
              <NumberInput pre={cur.symbol} value={amountText} onInput={setAmountText} label="Money for the plan that payday" />
            </Field>
            <button
              type="button"
              class="btn"
              onClick={async () => {
                const amount = parseAmount(amountText);
                if (amount === null || amount < 0) return;
                setNotPaid(null);
                await act(async (db, x) => (await changePaid(db, x, amount)).data);
              }}
            >
              Update this payday
            </button>
            <button type="button" class="link" onClick={() => setStep('view')}>
              Back
            </button>
          </>
        )}
        {preview && step === 'confirm' && (
          <>
            <p>
              The {formatMoneyAuto(preview.log.total, cur)} comes off your progress. {shortDate(preview.log.date, today.value)} goes back on Today as your to-do.
            </p>
            <div class="undo-box" data-testid="undo-box">
              {Object.entries(preview.log.snap?.after.debts ?? {})
                .filter(([id, after]) => (preview.log.snap?.before.debts[id]?.[0] ?? after[0]) - after[0] > 0.004)
                .map(([id, after]) => (
                  <div key={id} class="row">
                    <span>{nameOf(id)}</span>
                    <b class="num">
                      {formatMoney(after[0], cur, { whole: true })} goes back to {formatMoney(preview.log.snap!.before.debts[id]![0], cur, { whole: true })}
                    </b>
                  </div>
                ))}
              <div class="row">
                <span>Debt-free</span>
                <b data-testid="not-paid-line">
                  {preview.debtFreeDate
                    ? `${preview.debtFreeDate.slice(0, 7) === r.debtFreeDate?.slice(0, 7) ? 'Still' : 'Moves to'} ${monthName(preview.debtFreeDate)}, if you pay it this week`
                    : 'Moves to more than 20 years from now'}
                </b>
              </div>
            </div>
            <button
              type="button"
              class="btn"
              onClick={async () => {
                const date = shortDate(preview.log.date, today.value);
                setNotPaid(null);
                setStep('view');
                await act((db, x) => markNotPaid(db, x));
                showNotice('info', `${date} is not paid now.`);
              }}
            >
              Yes, mark as not paid
            </button>
            <button type="button" class="link" onClick={() => setNotPaid(null)}>
              Keep it
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}

export function PaydayListSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Payday list">
      <PaydayListBody />
      <button type="button" class="link" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}
