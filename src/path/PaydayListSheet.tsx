/** "Payday list": every payday, one line each. Tap a payday to open what is in it. */
import { useMemo, useState } from 'preact/hooks';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { dayMonth, monthYear, shortDate } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { data, plan } from '../state/store';
import { CheckIcon, Sheet } from '../ui/controls';

const FUTURE_STEP = 26;

/** What a payday held, as small tags. Outline for what is ahead, yellow once it is paid. */
const TAG_KINDS = [
  { kind: 'minimum', label: 'Minimum' },
  { kind: 'extra', label: 'Extra' },
  { kind: 'buffer', label: 'Buffer' },
  { kind: 'fund', label: 'Yearly bill' },
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

function Body() {
  const d = data.value!;
  const cur = d.settings.currency;
  const r = plan.value!;
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const [shown, setShown] = useState(FUTURE_STEP);
  const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<'upcoming' | 'done'>('upcoming');
  const toggle = (key: string) => setOpen(open === key ? null : key);

  // Per payday: the bills due before the next payday, and the total (bills + yearly bills + buffer + extra)
  const rowBills = useMemo(() => r.rows.map((_, i) => billsForPlanRow(d, r, i)), [d, r]);
  const rowTotals = useMemo(() => r.rows.map((row, i) => totalOf(rowBills[i]!, row)), [r, rowBills]);

  const line = (label: string, amount: number, key: string, extra?: string) => (
    <div key={key} class="row">
      <span>{extra ?? label}</span>
      <span class="num">{formatMoney(amount, cur)}</span>
    </div>
  );

  return (
    <>
      <div class="row" style={{ justifyContent: 'flex-start', gap: 8 }} role="group" aria-label="Which paydays">
        {(['upcoming', 'done'] as const).map((v) => (
          <button key={v} type="button" class="pill plain chip" aria-pressed={list === v} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => setList(v)}>
            {v === 'upcoming' ? 'Upcoming' : `Done${d.paydays.length ? ` (${d.paydays.length})` : ''}`}
          </button>
        ))}
      </div>

      {list === 'done' && d.paydays.length === 0 && <p class="muted">No paydays done yet. Each one you mark done turns yellow here.</p>}
      {list === 'upcoming' && r.rows.length === 0 && <p class="muted">No paydays ahead.</p>}

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
                          onClick={() => toggle(key)}
                        >
                          <span class="pd-box">{p.status === 'done' && <CheckIcon />}</span>
                          <span class="pd-date">{shortDate(p.date)}</span>
                          <span class="pd-note">{p.status === 'done' ? 'Paid' : 'Skipped'}</span>
                          <span class="num pd-amt">{p.status === 'done' ? formatMoneyAuto(p.total, cur) : ''}</span>
                        </button>
                        {p.status === 'done' && (
                          <div class="tags" aria-hidden="true">
                            {TAG_KINDS.filter((t) => kinds.has(t.kind)).map((t) => (
                              <span key={t.kind} class="tag paid">
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {open === key && (
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
                              </>
                            )}
                          </div>
                        )}
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
                    const key = `ahead-${i}`;
                    const bills = rowBills[i]!;
                    return (
                      <li key={row.date + i}>
                        <button type="button" class="pd" aria-expanded={open === key} aria-label={`${shortDate(row.date)}, to come`} onClick={() => toggle(key)}>
                          <span class="pd-box" />
                          <span class="pd-date">{shortDate(row.date)}</span>
                          <span class="pd-note">{row.extraGoesTo ? `Extra to ${nameOf(row.extraGoesTo)}` : row.bufferFirst ? 'Buffer first' : bills.due.length ? 'Bills due' : 'Nothing due'}</span>
                          <span class="num pd-amt">{formatMoneyAuto(rowTotals[i]!, cur)}</span>
                        </button>
                        <div class="tags" aria-hidden="true">
                          {bills.due.length > 0 && <span class="tag">Minimum</span>}
                          {row.extraGoesTo && <span class="tag">Extra</span>}
                          {row.toBuffer > 0.004 && <span class="tag">Buffer</span>}
                          {row.toYearlyBills > 0.004 && <span class="tag">Yearly bill</span>}
                        </div>
                        {open === key && (
                          <div class="stack pd-detail" style={{ gap: 6 }} role="group" aria-label={`${shortDate(row.date)} details`}>
                            {bills.due.map((b) => line('', b.amount, `b${b.debtId}`, `${b.name}, due ${dayMonth(b.due)}`))}
                            {row.toYearlyBills > 0.004 && line('Yearly bills', row.toYearlyBills, 'y')}
                            {row.toBuffer > 0.004 && line('Buffer', row.toBuffer, 'buf')}
                            {row.debts
                              .filter((x) => x.extra > 0.004)
                              .map((x) => (
                                <div key={`e${x.id}`} class="row">
                                  <span>
                                    Extra to <span class="hl">{nameOf(x.id)}</span>
                                  </span>
                                  <span class="num">{formatMoney(x.extra, cur)}</span>
                                </div>
                              ))}
                            <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
                              <span>Total</span>
                              <span class="num">{formatMoney(rowTotals[i]!, cur)}</span>
                            </div>
                            <p class="muted small num" data-testid="debt-left-after">
                              Debt left after: {formatMoney(row.debtLeft, cur)}
                            </p>
                          </div>
                        )}
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
    </>
  );
}

export function PaydayListSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Payday list">
      <Body />
      <button type="button" class="link" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}
