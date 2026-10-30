/**
 * Path, "Calendar": a month grid. A dot sits under every payday and every bill due day. A paid payday is a
 * yellow filled circle. Tap a day to see its lines. Shape carries the meaning as well as color: filled dot =
 * payday, ring = bill, filled yellow circle = paid.
 */
import { useMemo, useState } from 'preact/hooks';
import { addMonths, daysInMonth, parseISO, toISO } from '../engine/dates';
import type { PlanResult } from '../engine';
import type { AppData } from '../data/types';
import { formatMoneyAuto } from '../lib/money';
import { shortDate, weekdayIndex } from '../lib/today';
import { billsForPlanRow } from '../state/billsDue';
import { billState, mergedRows, paidFromLog } from '../today/model';
import { Empty } from '../ui/Empty';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type PaydayMark = { status: 'paid' | 'skipped' | 'ahead'; index: number };

export function PaydayCalendar(props: { d: AppData; r: PlanResult; today: string }) {
  const { d, r, today } = props;
  const cur = d.settings.currency;
  const t = parseISO(today);
  const [cursor, setCursor] = useState({ y: t.y, m: t.m });
  const [picked, setPicked] = useState<string | null>(null);

  // Every payday we know of: the ones done or skipped, then the ones in the plan
  const paydays = useMemo(() => {
    const map = new Map<string, PaydayMark>();
    for (const p of d.paydays) map.set(p.date, { status: p.status === 'done' ? 'paid' : 'skipped', index: p.number });
    r.rows.slice(0, 120).forEach((row, i) => {
      if (!map.has(row.date)) map.set(row.date, { status: 'ahead', index: i });
    });
    return map;
  }, [d, r]);

  const active = d.debts.filter((x) => x.status === 'active' && x.dueDay);
  const billsOn = (iso: string) => {
    const day = parseISO(iso);
    return active.filter((x) => Math.min(x.dueDay!, daysInMonth(day.y, day.m)) === day.d);
  };

  const first = toISO({ y: cursor.y, m: cursor.m, d: 1 });
  const blanks = weekdayIndex(first);
  const days = daysInMonth(cursor.y, cursor.m);
  const move = (by: number) => {
    const n = addMonths({ y: cursor.y, m: cursor.m, d: 1 }, by);
    setCursor({ y: n.y, m: n.m });
    setPicked(null);
  };

  const cells = Array.from({ length: days }, (_, i) => {
    const iso = toISO({ y: cursor.y, m: cursor.m, d: i + 1 });
    const pay = paydays.get(iso);
    const bills = billsOn(iso);
    const words = [
      `${WEEK_FULL[weekdayIndex(iso)]} ${i + 1} ${MONTHS[cursor.m - 1]}`,
      pay ? (pay.status === 'paid' ? 'payday, paid' : pay.status === 'skipped' ? 'payday, skipped' : 'payday') : '',
      bills.length ? `${bills.length === 1 ? 'bill' : 'bills'} due` : '',
    ].filter(Boolean);
    return { iso, n: i + 1, pay, bills, label: words.join(', ') };
  });

  const sel = picked ? cells.find((c) => c.iso === picked) : undefined;

  const dayLines = () => {
    if (!sel) return null;
    const lines: { key: string; text: string; tags: { label: string; paid?: boolean }[]; amount?: number }[] = [];
    let total: number | null = null;
    if (sel.pay?.status === 'paid') {
      const log = paidFromLog(d, sel.pay.index);
      for (const x of log?.rows ?? []) lines.push({ key: x.key, text: x.label, tags: [{ label: 'Paid', paid: true }], amount: x.amount });
      total = log?.total ?? null;
    } else if (sel.pay?.status === 'skipped') {
      lines.push({ key: 'skipped', text: 'Skipped', tags: [] });
    } else if (sel.pay) {
      const row = r.rows[sel.pay.index]!;
      const { rows, total: sum } = mergedRows(row, d, billsForPlanRow(d, r, sel.pay.index));
      for (const x of rows) lines.push({ key: x.key, text: x.title, tags: x.tags.map((label) => ({ label })), amount: x.amount });
      total = sum;
    }
    for (const b of sel.bills) {
      const state = billState(d, b, sel.iso, today);
      lines.push({
        key: `due-${b.id}`,
        text: `${b.name} due`,
        tags: [{ label: 'Bill' }, ...(state === 'paid' ? [{ label: 'Paid', paid: true }] : state === 'late' ? [{ label: 'Not paid yet' }] : [])],
        amount: b.minMonthly > 0 ? b.minMonthly : undefined,
      });
    }
    return { lines, total };
  };
  const shown = dayLines();

  return (
    <div class="stack" style={{ gap: 8 }} data-testid="payday-calendar">
      <div class="row cal-head">
        <button type="button" class="round-btn small" aria-label="Previous month" onClick={() => move(-1)}>
          <span aria-hidden="true">‹</span>
        </button>
        <b class="cal-title" aria-live="polite">
          {MONTHS[cursor.m - 1]} {cursor.y}
        </b>
        <button type="button" class="round-btn small" aria-label="Next month" onClick={() => move(1)}>
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div class="cal-grid" role="grid" aria-label={`${MONTHS[cursor.m - 1]} ${cursor.y}`}>
        {WEEK.map((w, i) => (
          <span key={i} class="cal-wd" role="columnheader" aria-label={WEEK_FULL[i]}>
            {w}
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} role="gridcell" aria-hidden="true" />
        ))}
        {cells.map((c) => (
          <button
            key={c.iso}
            type="button"
            role="gridcell"
            class={`cal-day${c.iso === today ? ' today' : ''}${picked === c.iso ? ' picked' : ''}${c.pay?.status === 'paid' ? ' paid' : ''}${c.pay?.status === 'skipped' ? ' skipped' : ''}`}
            aria-label={c.label}
            aria-pressed={picked === c.iso}
            onClick={() => setPicked(picked === c.iso ? null : c.iso)}
          >
            <span class="cal-num num">{c.n}</span>
            <span class="cal-dots" aria-hidden="true">
              {c.pay && c.pay.status !== 'paid' && <i class="dot-pay" />}
              {c.bills.length > 0 && <i class="dot-bill" />}
            </span>
          </button>
        ))}
      </div>

      {sel && shown && (
        <div class="stack cal-lines" style={{ gap: 6 }} data-testid="calendar-day" role="group" aria-label={`${shortDate(sel.iso, today)} details`}>
          <p class="label">{shortDate(sel.iso, today)}</p>
          {shown.lines.length === 0 ? (
            <Empty art="calendar" line="Nothing on this day." small />
          ) : (
            <>
              {shown.lines.map((x) => (
                <div key={x.key} class="row">
                  <span>
                    {x.text}{' '}
                    <span class="pc-tags">
                      {x.tags.map((tag) => (
                        <span key={tag.label} class={`tag${tag.paid ? ' paid' : ''}`}>
                          {tag.label}
                        </span>
                      ))}
                    </span>
                  </span>
                  {x.amount !== undefined && <span class="num">{formatMoneyAuto(x.amount, cur)}</span>}
                </div>
              ))}
              {shown.total !== null && shown.total > 0 && (
                <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
                  <span>Total</span>
                  <span class="num">{formatMoneyAuto(shown.total, cur)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
