/**
 * Path, Chapters (design/path-features/Chapters): one card per debt, paydays as small squares (yellow = paid).
 * Tap a chapter to see its paydays. A payday ahead opens the read-only Preview, the latest paid payday opens Undo.
 */
import { useMemo, useState } from 'preact/hooks';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { dayMonth, fullDate, shortDate } from '../lib/today';
import { billsForPlanRow, totalOf } from '../state/billsDue';
import { changeablePayday } from '../state/actions';
import { data, plan, previewDate, today } from '../state/store';
import { CheckIcon } from '../ui/controls';
import { Empty } from '../ui/Empty';
import { buildChapters, type Chapter, type ChapterDay } from './chaptersModel';
import { UndoPayday } from './UndoPayday';

/** What a payday held, as small tags. Outline for what is ahead. */
const TAG_KINDS = [
  { kind: 'minimum', label: 'Bill' },
  { kind: 'extra', label: 'Extra' },
  { kind: 'buffer', label: 'Buffer' },
  { kind: 'fund', label: 'Yearly' },
] as const;

function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 3.5 2 3.5H5" />
    </svg>
  );
}
function HouseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <rect x="10" y="13" width="4" height="4" fill="var(--yellow-soft)" />
    </svg>
  );
}

/** "Fri 6 Nov to Fri 1 Jan 2027": the year once, at the end, unless the two dates are in different years */
function span(c: Chapter, today: string): string {
  const y = c.firstDate.slice(0, 4);
  const bare = y === c.lastDate.slice(0, 4) || y === today.slice(0, 4);
  return `${bare ? fullDate(c.firstDate).replace(/ \d{4}$/, '') : fullDate(c.firstDate)} to ${fullDate(c.lastDate)}`;
}

const MAX_SQUARES = 60;

export function Chapters() {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const model = useMemo(() => buildChapters(d, r), [d, r]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [undoOpen, setUndoOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const changeable = changeablePayday(d)?.number ?? null;
  const latestDone = d.paydays.reduce((m, x) => Math.max(m, x.number), 0);
  const rowBills = useMemo(() => r.rows.map((_, i) => billsForPlanRow(d, r, i)), [d, r]);
  const rowTotals = useMemo(() => r.rows.map((row, i) => totalOf(rowBills[i]!, row)), [r, rowBills]);
  const toggle = (id: string) => {
    const next = new Set(open);
    if (!next.delete(id)) next.add(id);
    setOpen(next);
  };

  if (!model.chapters.length) return <Empty art="calendar" line="No paydays ahead. That is the finish line." />;

  const line = (label: string, amount: number, key: string) => (
    <div key={key} class="row">
      <span>{label}</span>
      <span class="num">{formatMoney(amount, cur)}</span>
    </div>
  );

  const doneDetail = (number: number) => {
    const p = d.paydays.find((x) => x.number === number)!;
    const payments = d.payments.filter((x) => x.paydayNumber === number);
    return (
      <div class="stack pd-detail" style={{ gap: 6 }} role="group" aria-label={`${shortDate(p.date)} details`}>
        {p.status === 'skipped' ? (
          <p>{COPY.missed}</p>
        ) : (
          <>
            {p.bills?.map((b) => line(`${b.name}, due ${dayMonth(b.due)}`, b.amount, `b${b.debtId}`))}
            {payments
              .filter((x) => x.kind !== 'fund' && !(x.kind === 'minimum' && p.bills !== undefined))
              .map((x) => line(x.kind === 'minimum' ? `${nameOf(x.debtId!)} minimum` : x.kind === 'extra' ? `Extra to ${nameOf(x.debtId!)}` : 'Buffer', x.amount, x.id))}
            {payments.some((x) => x.kind === 'fund') && line('Yearly bills', payments.filter((x) => x.kind === 'fund').reduce((sum, x) => sum + x.amount, 0), 'funds')}
            <div class="row" style={{ borderTop: '1px solid var(--ink)', paddingTop: 6, fontWeight: 600 }}>
              <span>Total</span>
              <span class="num">{formatMoney(p.total, cur)}</span>
            </div>
            {p.debtLeft !== undefined && (
              <p class="muted small num" data-testid="debt-left-after">
                Debt left after: {formatMoney(p.debtLeft, cur)}
              </p>
            )}
            {p.number < latestDone && (
              <p class="muted small" data-testid="undo-later-first">
                Undo the later ones first.
              </p>
            )}
          </>
        )}
      </div>
    );
  };

  const dayRow = (day: ChapterDay) => {
    if (day.number !== undefined) {
      const p = d.paydays.find((x) => x.number === day.number)!;
      const done = p.status === 'done';
      const latest = done && changeable === day.number;
      const payments = d.payments.filter((x) => x.paydayNumber === day.number);
      const kinds = new Set(payments.map((x) => x.kind));
      return (
        <li key={day.key}>
          <button
            type="button"
            class={`pd${done ? ' on' : ''}`}
            aria-expanded={!latest ? detail === day.number : undefined}
            aria-haspopup={latest ? 'dialog' : undefined}
            aria-label={`${shortDate(p.date)}, ${done ? 'paid' : 'skipped'}`}
            onClick={() => (latest ? setUndoOpen(true) : setDetail(detail === day.number ? null : day.number!))}
          >
            <span class="pd-box">{done && <CheckIcon />}</span>
            <span class="pd-date">{shortDate(p.date)}</span>
            <span class="pd-note">{done ? (latest ? 'Latest · tap to see or undo' : 'Paid') : 'Skipped'}</span>
            <span class="num pd-amt">{done ? formatMoneyAuto(p.total, cur) : ''}</span>
            {done && <span class="tag paid">Paid</span>}
          </button>
          {done && (
            <div class="tags" aria-hidden="true">
              {TAG_KINDS.filter((t) => kinds.has(t.kind)).map((t) => (
                <span key={t.kind} class="tag">
                  {t.label}
                </span>
              ))}
            </div>
          )}
          {detail === day.number && !latest && doneDetail(day.number)}
        </li>
      );
    }
    const i = day.rowIndex!;
    const row = r.rows[i]!;
    const bills = rowBills[i]!;
    return (
      <li key={day.key}>
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
  };

  return (
    <div class="stack" style={{ gap: 0 }} data-testid="chapters">
      <p class="muted small" style={{ marginBottom: 8 }} data-testid="chapters-summary">
        {model.chapters.length} chapter{model.chapters.length === 1 ? '' : 's'}
        {model.debtFreeDate ? ` · debt-free ${fullDate(model.debtFreeDate)}` : ''}
      </p>
      {model.chapters.map((c) => {
        const shown = c.days.slice(0, MAX_SQUARES);
        const small = c.days.length > 8;
        const isOpen = open.has(c.debtId);
        const doneCount = c.days.filter((x) => x.kind === 'paid').length;
        return (
          <div key={c.debtId}>
            <section class={`chapter${c.here ? ' here' : ''}`} aria-label={`Chapter ${c.index}, ${c.name}`} data-testid="chapter">
              <button type="button" class="chapter-head" aria-expanded={isOpen} aria-label={`${c.name}, chapter ${c.index}`} onClick={() => toggle(c.debtId)}>
                <span class="chapter-top">
                  <span class="chapter-label">
                    Chapter {c.index}
                    {c.last && c.index > 1 ? ' · the last one' : ''}
                  </span>
                  {c.here && <span class="chapter-pill">You are here</span>}
                </span>
                <span class="chapter-name">{c.name}</span>
                <span class="chapter-span" data-testid="chapter-span">
                  {c.days.length} payday{c.days.length === 1 ? '' : 's'} · {span(c, today.value)}
                </span>
                <span class={`chapter-squares${small ? ' small' : ''}`} role="img" aria-label={`${doneCount} of ${c.days.length} paydays done`}>
                  {shown.map((x) => (
                    <i key={x.key} class={x.kind} />
                  ))}
                  {c.days.length > shown.length && <span class="muted small">+{c.days.length - shown.length}</span>}
                </span>
                {c.extraFrom && (
                  <span class="chapter-note">
                    Your buffer fills first. From {shortDate(c.extraFrom, today.value)} the extra goes here.
                  </span>
                )}
              </button>
              {isOpen && (
                <ul class="payday-list chapter-days" aria-label={`${c.name} paydays`}>
                  {c.days.map(dayRow)}
                </ul>
              )}
            </section>
            {c.goneDate && !c.last && (
              <div class="chapter-flag" data-testid="chapter-flag">
                <span class="bar" aria-hidden="true" />
                <FlagIcon />
                <span>
                  <b>{c.name} gone</b> · {fullDate(c.goneDate)}.{c.rollsOn ? ` Its ${formatMoneyAuto(c.rollsOn, cur)} rolls on.` : ''}
                </span>
              </div>
            )}
            {c.alsoGone.map((g) => (
              <div key={g.name} class="chapter-flag" data-testid="chapter-flag">
                <span class="bar" aria-hidden="true" />
                <FlagIcon />
                <span>
                  <b>{g.name} gone</b> · {fullDate(g.date)}
                </span>
              </div>
            ))}
          </div>
        );
      })}
      {model.debtFreeDate && (
        <div class="chapter-end" data-testid="chapter-end">
          <HouseIcon />
          <span>
            <b>Debt-free</b> · {fullDate(model.debtFreeDate)}
          </span>
        </div>
      )}
      <p class="muted small" style={{ textAlign: 'center', marginTop: 14 }}>
        Tap a chapter to see its paydays. Tap a payday to preview it.
      </p>
      <UndoPayday open={undoOpen} onClose={() => setUndoOpen(false)} />
    </div>
  );
}
