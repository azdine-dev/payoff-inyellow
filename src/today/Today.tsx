/**
 * Today (docs/ux-v2/ux-v2.md sections 3 and 4, mockups 03 and 04): what do I move this payday?
 * One ink card with one total and one button. "I did it" flips it to yellow with a PAID stamp, and Undo
 * is there for 10 seconds. Between paydays the card is a calm countdown, so there is never a button
 * with nothing to do.
 */
import { syncOn } from '../sync/controller';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { dailyInterestCost, growingDebts, PAYDAYS_PER_YEAR, planNeedsHelp, simulatePlan } from '../engine';
import { backupReminder } from '../data/backup';
import { downloadBackup } from '../state/backupActions';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto, parseAmount, toCents } from '../lib/money';
import { dayMonth, diffDays, relativeDay, shortDate, shortMonthYear, weekdayName } from '../lib/today';
import { pathView } from '../path/Path';
import { changeablePayday, changePaid, didPayday, extraPayment, missedPaydays, skipPaydays, undoPayday } from '../state/actions';
import { biggerNote, billsForNextPayday } from '../state/billsDue';
import { editDebt } from '../state/debtActions';
import { momentText } from '../state/milestones';
import { dateMoveSentence } from '../state/changeNote';
import { showNotice } from '../state/notice';
import { activeDebts, nextPaydayISO, nextPaydayNumber, toDebtInput, toPlanInput } from '../state/planInput';
import type { AppData } from '../data/types';
import { Count, rememberCount, useCountUp } from '../ui/useCountUp';
import { progressStats } from '../state/milestones';
import { act, applyUpdate, data, freshMilestones, freshPaidDebts, freshPayday, getDB, plan, tab, today, updateDismissed, updateReady } from '../state/store';
import { Bar, Checkbox, CheckIcon, ChevronRight, Field, GearIcon, Note, NumberInput, Sheet } from '../ui/controls';
import { Ring } from '../ui/Ring';
import { NeedsHelp } from '../ui/NeedsHelp';
import { LaterCard } from './LaterCard';
import { afterPaySentence, comingUp, dailyCostLastMonth, extraSummary, focusDebt, focusSentence, mergedRows, paidFromLog, whyFirst } from './model';

interface JustPaid {
  date: string;
  total: number;
  rows: { key: string; label: string; amount: number }[];
}

/** The numbers on the other screens roll from what they were, not jump */
function rememberBalances(d: AppData) {
  for (const x of d.debts) rememberCount(`debt-${x.id}`, x.balance);
  const st = progressStats(d);
  rememberCount('path-owed', st.owed);
  rememberCount('path-paid', st.paid);
  rememberCount('path-pct', Math.floor(st.pct));
  rememberCount('buffer', d.buffer.amount);
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** "Next payday Fri 7 Nov · 14 days. Nothing to do until then." */
function CountdownCard(props: { nextDate: string; onShow?: () => void }) {
  const days = Math.max(0, diffDays(today.value, props.nextDate));
  return (
    <section class="card countdown-card" data-testid="countdown-card">
      <div class="days-tile">
        <b class="num">{days}</b>
        <span>{days === 1 ? 'day' : 'days'}</span>
      </div>
      <div class="stack" style={{ gap: 4 }}>
        <p>
          Next payday is <b>{shortDate(props.nextDate)}</b>. Nothing to do until then.
        </p>
        {props.onShow && (
          <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={props.onShow}>
            Mark it done early
          </button>
        )}
      </div>
    </section>
  );
}

export function Today() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const nextDate = nextPaydayISO(s);
  const money = (n: number) => formatMoneyAuto(n, cur);

  // "I got a different amount" for this payday only (null = the usual amount)
  const [override, setOverride] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [justPaid, setJustPaid] = useState<JustPaid | null>(null);
  // Debts that reached zero with the last payment: shown as a full-screen moment until "Next payday"
  const [paidIds, setPaidIds] = useState<string[]>([]);
  const [skippedNote, setSkippedNote] = useState(false);
  const [closedMoments, setClosedMoments] = useState<Set<string>>(new Set());
  // Undo lasts 10 seconds.
  const [undo, setUndo] = useState<{ before: typeof d; after: typeof d } | null>(null);
  const [showEarly, setShowEarly] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [sheet, setSheet] = useState<'amount' | 'extra' | 'redo' | null>(null);
  const [input, setInput] = useState('');
  const [inputNote, setInputNote] = useState('');
  // "add a due day" for a debt that has none
  const [dueDebtId, setDueDebtId] = useState<string | null>(null);
  const [dueText, setDueText] = useState('');
  const [dueNote, setDueNote] = useState('');

  // A new payday starts with nothing ticked and the usual amount
  useEffect(() => {
    setChecked(new Set());
    setOverride(null);
    setShowEarly(false);
  }, [s.paydayIndex]);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10_000);
    return () => clearTimeout(t);
  }, [undo]);

  const r = useMemo(() => (override === null ? plan.value! : simulatePlan(toPlanInput(d, override))), [d, override]);
  const row = r.rows[0];
  const bills = useMemo(() => billsForNextPayday(d), [d]);
  const { rows, total, noDueDay } = row ? mergedRows(row, d, bills) : { rows: [], total: 0, noDueDay: [] };
  const extra = row ? extraSummary(row, d) : null;
  const shownTotal = useCountUp(total, 'today-total');
  const doneCount = d.paydays.filter((p) => p.status === 'done').length;
  const missed = missedPaydays(d, today.value);
  const reasons = planNeedsHelp(toPlanInput(d), plan.value!, s.paycheckAmount);
  const focus = focusDebt(d, r);
  const growingNow = new Set(growingDebts(d.debts.filter((x) => x.status === 'active').map(toDebtInput)));
  const active = activeDebts(d);
  const due = comingUp(d, today.value);
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  // Before the payday: a countdown. Done: the yellow card stays until the next payday, even after a reload.
  // The full card shows until the first "I did it", and when the payday is 2 days away or less (early direct deposit).
  const countdownMode = active.length > 0 && Boolean(row) && nextDate > today.value && !showEarly && doneCount > 0 && diffDays(today.value, nextDate) > 2;
  const paidView = justPaid ?? (countdownMode ? paidFromLog(d, nextPaydayNumber(s) - 1) : null);
  const showEarlyCard = () => {
    setShowEarly(true);
    setJustPaid(null);
    setUndo(null);
    setPaidIds([]);
  };
  const isPayday = nextDate === today.value;

  const apply = async () => {
    if (busy) return;
    const paydayNumber = nextPaydayNumber(s);
    setBusy(true);
    setChecked(new Set(rows.map((x) => x.key)));
    navigator.vibrate?.(15); // a light tap, where the phone can
    await sleep(reducedMotion() ? 0 : 400); // the highlighter swipe (300 ms) and the boxes turning yellow
    const snapshot = rows.map((x) => ({ key: x.key, label: x.paidLabel, amount: x.amount }));
    rememberBalances(d);
    const res = await didPayday(await getDB(), d, { planMoney: override });
    setUndo({ before: d, after: res.data });
    setJustPaid({ date: res.step.date, total, rows: snapshot });
    setPaidIds(res.newlyPaid);
    freshPayday.value = res.step ? paydayNumber : null;
    freshPaidDebts.value = res.newlyPaid;
    setSkippedNote(false);
    setBackedUp(false);
    data.value = res.data;
    setBusy(false);
  };

  const toggle = (key: string) => {
    const next = new Set(checked);
    next.has(key) ? next.delete(key) : next.add(key);
    setChecked(next);
    if (rows.length && next.size === rows.length) void apply();
  };

  // What is ticked so far, and what is left of this payday
  const doneCents = rows.filter((x) => checked.has(x.key)).reduce((sum, x) => sum + x.amount, 0);
  const leftCents = Math.max(0, toCents(total - doneCents));
  const doneShare = total > 0 ? (doneCents / total) * 100 : 0;

  const doUndo = async () => {
    if (!undo) return;
    const restored = await undoPayday(await getDB(), undo.before, data.peek()!);
    setUndo(null);
    setJustPaid(null);
    setPaidIds([]);
    setChecked(new Set());
    data.value = restored;
  };

  const skip = async () => {
    data.value = await skipPaydays(await getDB(), d, Math.max(1, missed));
    setSkippedNote(true);
    setJustPaid(null);
  };

  const openDue = (id: string) => {
    setDueText('');
    setDueNote('');
    setDueDebtId(id);
  };

  const saveDue = async () => {
    const day = Number(dueText);
    const debt = d.debts.find((x) => x.id === dueDebtId);
    if (!debt) return;
    if (!Number.isInteger(day) || day < 1 || day > 31) return setDueNote('Type a day of the month, from 1 to 31.');
    await act((db, x) =>
      editDebt(db, x, debt.id, { name: debt.name, type: debt.type, balance: debt.balance, apr: debt.apr, minMonthly: debt.minMonthly, dueDay: day, autopay: debt.autopay }),
    );
    setDueDebtId(null);
  };

  const openSheet = (which: 'amount' | 'extra') => {
    setInput(which === 'amount' ? String(override ?? s.extraPerPayday) : '');
    setInputNote('');
    setSheet(which);
  };

  // "Change what I paid": the last payday goes back and is done again with the amount typed here
  const redoLog = paidView ? changeablePayday(d) : null;
  const openRedo = () => {
    setInput(String(redoLog?.planMoney ?? s.extraPerPayday));
    setInputNote('');
    setSheet('redo');
  };

  const saveSheet = async () => {
    const amount = parseAmount(input);
    if (sheet === 'redo') {
      if (amount === null || amount < 0) return setInputNote('Type an amount, like 50.');
      rememberBalances(d);
      const res = await changePaid(await getDB(), d, amount);
      setUndo({ before: res.before, after: res.data });
      setJustPaid(paidFromLog(res.data, redoLog!.number));
      setPaidIds(res.newlyPaid);
      data.value = res.data;
      setSheet(null);
      return;
    }
    if (amount === null || amount < 0 || (sheet === 'extra' && amount === 0)) {
      setInputNote('Type an amount, like 50.');
      return;
    }
    if (sheet === 'amount') {
      setOverride(amount === s.extraPerPayday ? null : amount);
      const diff = amount - s.extraPerPayday;
      if (diff !== 0) {
        // The rest of the plan keeps its order: nothing is added on top of the next payday
        const move = dateMoveSentence(plan.value!, simulatePlan(toPlanInput(d, amount)));
        showNotice('info', `You have ${money(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} for the plan this payday. ${move}`);
      }
    } else {
      const owed = active.reduce((sum, x) => sum + x.balance, 0);
      rememberBalances(d);
      const res = await extraPayment(await getDB(), d, Math.min(amount, owed), today.value);
      setPaidIds(res.newlyPaid);
      freshPaidDebts.value = res.newlyPaid;
      data.value = res.data;
    }
    setSheet(null);
  };

  // ---------------------------------------------------------------- what the screen says
  const greeting = paidView
    ? 'Done for this payday.'
    : !active.length
      ? 'You’re debt-free.'
      : missed > 0
        ? 'Welcome back.'
        : isPayday
          ? 'Hi, it’s payday.'
          : `Next payday is ${shortDate(nextDate)}.`;

  const goneLabel = (iso: string | null) => (iso ? (diffDays(today.value, iso) <= 100 ? shortDate(iso) : shortMonthYear(iso)) : null);
  // Paydays left for the focus debt after the one on the card (0 = this payday pays it off)
  const focusIdx = focus ? r.rows.findIndex((x) => x.debts.some((y) => y.id === focus.debt.id && y.balanceAfter <= 0.005)) : -1;
  // After "I did it": the plan is already the new one, so row 0 is the next payday
  const untilGone = focusIdx < 0 ? null : focusIdx;
  const rollTo = (() => {
    if (!focus) return null;
    const order = r.order.filter((id) => d.debts.find((x) => x.id === id)?.status === 'active');
    const next = order[order.indexOf(focus.debt.id) + 1];
    const freed = (focus.debt.minMonthly * 12) / PAYDAYS_PER_YEAR[s.frequency];
    return next && freed > 0 ? { amount: formatMoney(freed, cur), to: nameOf(next) } : null;
  })();

  const daily = dailyInterestCost(active);
  const lastMonth = dailyCostLastMonth(d, today.value);
  const bufferFull = d.buffer.amount >= s.bufferGoal && s.bufferGoal > 0;
  const showNudge = justPaid && (doneCount === 1 || doneCount % 4 === 0);

  const moments = d.milestones
    .filter((m) => freshMilestones.value.includes(m.id) && !closedMoments.has(m.id))
    .map((m) => {
      const firstExtra = d.payments.find((p) => p.kind === 'extra');
      const text = momentText(m.id, focus?.debt.name ?? null, firstExtra?.debtId ? nameOf(firstExtra.debtId) : null);
      return text ? (
        <section key={m.id} class="card row" data-testid="milestone-moment" role="status" style={{ background: 'var(--yellow)', borderColor: 'var(--yellow)', color: 'var(--on-yellow)' }}>
          <span style={{ fontWeight: 600 }}>{text}</span>
          <button type="button" class="link small" style={{ color: 'var(--on-yellow)' }} onClick={() => setClosedMoments(new Set([...closedMoments, m.id]))}>
            OK
          </button>
        </section>
      ) : null;
    });

  return (
    <main class="screen with-tabs">
      <header class="today-head">
        <div class="stack" style={{ gap: 2 }}>
          {paidView ? (
            <p class="date-line" role="status">
              <b>{shortDate(paidView.date)} is paid.</b> Next payday: {shortDate(nextDate)}.
            </p>
          ) : (
            <p class="date-line">
              {weekdayName(today.value)} {dayMonth(today.value)}
              {isPayday && active.length > 0 ? ' · payday' : ''}
            </p>
          )}
          <h1 class="today-h1" data-testid="greeting">
            {greeting}
          </h1>
        </div>
        <button type="button" class="round-btn" aria-label="Settings" onClick={() => (tab.value = 'settings')}>
          <GearIcon />
        </button>
      </header>

      <button
        type="button"
        class="pill-link"
        data-testid="debt-free-pill"
        aria-label={r.debtFreeDate ? `Debt-free by ${shortMonthYear(r.debtFreeDate)}. Open your path.` : undefined}
        onClick={() => {
          pathView.value = 'progress';
          tab.value = 'path';
        }}
      >
        {r.debtFreeDate ? (
          <>
            Debt-free by <span class="hl">{shortMonthYear(r.debtFreeDate)}</span>
          </>
        ) : active.length ? (
          'More than 20 years'
        ) : (
          'Debt-free'
        )}
        <ChevronRight />
      </button>

      {updateReady.value && !updateDismissed.value && (
        <section class="card soft row" role="status" data-testid="update-bar">
          <span>An update is ready.</span>
          <span class="row" style={{ gap: 14 }}>
            <button type="button" class="link small" onClick={applyUpdate}>
              Restart now
            </button>
            <button type="button" class="link small" aria-label="Dismiss the update bar" onClick={() => (updateDismissed.value = true)}>
              Not now
            </button>
          </span>
        </section>
      )}

      {backupReminder(d) && !justPaid && (
        <section class="card soft row" aria-label="Backup reminder">
          <span>Save a backup file. Takes 5 seconds.</span>
          <button type="button" class="link" onClick={() => void downloadBackup()}>
            Back up my plan
          </button>
        </section>
      )}

      {paidIds.length > 0 && (
        <div class="paid-moment" role="dialog" aria-modal="true" aria-label="Debt paid" data-testid="paid-moment">
          <div class="paid-moment-body">
            <p class="paid-moment-title">{COPY.debtPaid}</p>
            {paidIds.map((id) => {
              const debt = d.debts.find((x) => x.id === id);
              if (!debt) return null;
              // The minimum this debt took on each payday, which now goes on to the next one
              const freed = (debt.minMonthly * 12) / PAYDAYS_PER_YEAR[s.frequency];
              return (
                <p key={id} class="paid-moment-line">
                  {debt.name} is paid.{' '}
                  {freed > 0 ? (focus ? `Its ${formatMoney(freed, cur)} per payday now goes to ${focus.debt.name}.` : 'That was your last debt.') : focus ? `Next up: ${focus.debt.name}.` : 'That was your last debt.'}
                </p>
              );
            })}
            <button type="button" class="btn" onClick={() => setPaidIds([])}>
              {focus ? 'Next payday' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {moments}

      {skippedNote && (
        <section class="card soft" role="status">
          <p>{COPY.missed}</p>
          {r.debtFreeDate && (
            <p style={{ marginTop: 6 }}>
              Debt-free: <b>{shortMonthYear(r.debtFreeDate)}</b>. Next payday: <b>{shortDate(nextDate)}</b>.
            </p>
          )}
        </section>
      )}

      {/* ------------------------------------------------ done: the yellow card, and what comes next */}
      {paidView && (countdownMode || justPaid) && (
        <>
          <section class="paid-card" aria-label="Paid this payday" data-testid="paid-card">
            <div class="paid-top">
              <p class="pc-total num" data-testid="paid-total">
                {money(paidView.total)}
              </p>
              <span class="paid-stamp">
                <CheckIcon /> PAID
              </span>
            </div>
            <ul class="paid-rows">
              {paidView.rows.map((x) => (
                <li key={x.key}>
                  <CheckIcon />
                  <span>{x.label}</span>
                  <span class="num">{money(x.amount)}</span>
                </li>
              ))}
            </ul>
            <div class="row" style={{ justifyContent: 'flex-start', gap: 20 }}>
              {undo && (
                <button type="button" class="link" data-undo onClick={doUndo}>
                  Undo
                </button>
              )}
              {redoLog && (
                <button type="button" class="link small" data-testid="change-paid" onClick={openRedo}>
                  Change what I paid
                </button>
              )}
            </div>
          </section>

          <section class="card stack" style={{ gap: 10 }} data-testid="after-sentence">
            <p>
              {afterPaySentence(focus ? { name: focus.debt.name, left: money(focus.left), goneBy: focus.goneBy } : null, untilGone, rollTo)}
            </p>
            {focus && (
              <>
                <Bar pct={focus.pctGone} label={`${focus.debt.name} paid off`} />
                <p class="muted small num">{Math.floor(focus.pctGone)}% gone</p>
              </>
            )}
          </section>

          {countdownMode && <CountdownCard nextDate={nextDate} onShow={showEarlyCard} />}

          {showNudge && (
            <section class="nudge" aria-label="Save a copy" data-testid="backup-nudge">
              <span>{backedUp ? 'Saved. Keep the file somewhere safe.' : 'Your plan lives only on this device. Save a copy.'}</span>
              {!backedUp && (
                <button
                  type="button"
                  class="btn small"
                  onClick={async () => {
                    await downloadBackup();
                    setBackedUp(true);
                  }}
                >
                  Save backup
                </button>
              )}
            </section>
          )}
        </>
      )}

      {/* ------------------------------------------------ not done yet: the card, or the countdown */}
      {!justPaid && !active.length && (
        <section class="card stack">
          <p>Every debt is paid. Keep your buffer and your yearly bills going, so a surprise bill stays off the cards.</p>
        </section>
      )}

      {!justPaid && active.length > 0 && row && (
        <>
          {missed > 0 && (
            <section class="card stack" style={{ gap: 4 }}>
              <p>
                Your payday on <b>{shortDate(nextDate)}</b> went by. Did you do it?
              </p>
              <div class="row" style={{ justifyContent: 'flex-start', gap: 20 }}>
                <span class="muted small">Tick it below if you did.</span>
                <button type="button" class="link" onClick={skip}>
                  I skipped it
                </button>
              </div>
            </section>
          )}

          {s.startMode === 'next-month' && d.paydays.length === 0 && missed === 0 && (
            <p class="muted small">Your plan starts on {shortDate(nextDate)}. Until then, keep paying your minimums.</p>
          )}

          {countdownMode ? (
            paidView ? null : <CountdownCard nextDate={nextDate} onShow={showEarlyCard} />
          ) : (
            <section class={`payday-card${busy ? ' swiping' : ''}`} aria-labelledby="payday-title">
              <p id="payday-title" class="pc-label">
                {missed > 0 ? 'Your last payday' : 'This payday'}
              </p>
              <p class="pc-line">
                <span class="pc-move">Move</span>
                <span class="pc-total num" data-testid="payday-total">
                  {money(shownTotal)}
                </span>
              </p>
              {extra ? (
                <p class="pc-sub" data-testid="extra-sentence">
                  The extra <b>{money(extra.amount)}</b> goes to <span class="hl">{extra.target}</span>
                </p>
              ) : row.bufferFirst ? (
                <p class="pc-sub" data-testid="buffer-first">
                  Extra goes to your buffer until it reaches {money(s.bufferGoal)}.
                </p>
              ) : null}

              <div class="pc-rows">
                {rows.map((x) => (
                  <Checkbox
                    key={x.key}
                    checked={checked.has(x.key)}
                    onToggle={() => toggle(x.key)}
                    right={<span class="num pc-amount">{money(x.amount)}</span>}
                  >
                    <span class="pc-title">{x.title}</span>
                    <span class="pc-rowsub">{x.sub}</span>
                  </Checkbox>
                ))}
                {noDueDay.map((b) => (
                  <div key={`nd-${b.debtId}`} class="pc-nodue" data-testid="no-due-day">
                    <span>
                      {b.name} {money(b.amount)},{' '}
                      <button type="button" class="link" style={{ display: 'inline' }} onClick={() => openDue(b.debtId)}>
                        add a due day
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              {noDueDay.length > 0 && <p class="pc-note">Not counted until you add a due day.</p>}
              {biggerNote(bills, row, (n) => money(n), dayMonth) && (
                <p class="pc-note" data-testid="bigger-note">
                  {biggerNote(bills, row, (n) => money(n), dayMonth)}
                </p>
              )}
              {override !== null && (
                <p class="pc-note">
                  This payday uses {money(override)} for the plan instead of {money(s.extraPerPayday)}.{' '}
                  <button type="button" class="link small" onClick={() => setOverride(null)}>
                    Use the usual amount
                  </button>
                </p>
              )}
              {checked.size > 0 && !busy && (
                <div class="row pc-left" data-testid="left-this-payday" role="status">
                  <Ring pct={doneShare} size={44} label="Done this payday" showText={false} onDark />
                  <span>
                    Left this payday: <b class="num">{formatMoney(leftCents, cur)}</b>
                  </span>
                </div>
              )}

              <button type="button" class="pc-btn" onClick={() => void apply()} disabled={busy}>
                <CheckIcon /> {COPY.didIt} · <span class="num">{money(total)}</span>
              </button>
              <div class="row pc-links">
                <button type="button" class="link small" onClick={() => openSheet('amount')}>
                  {COPY.differentAmount}
                </button>
                <button type="button" class="link small" onClick={() => void skip()}>
                  Skip this payday
                </button>
              </div>
            </section>
          )}

          <NeedsHelp reasons={reasons} />

          {focus && (
            <section class="card stack" style={{ gap: 8 }} aria-label="Focus debt">
              <div class="row">
                <span class="label">Focus debt</span>
                {goneLabel(focus.goneBy) && <span class="muted small">gone by {goneLabel(focus.goneBy)}</span>}
              </div>
              <div class="row">
                <h2 class="focus-name">{focus.debt.name}</h2>
                <span class="num">
                  <b><Count value={focus.left} id={`focus-${focus.debt.id}`} format={(n) => formatMoney(n, cur, { whole: true })} /></b> left
                </span>
              </div>
              <Bar pct={focus.pctGone} label={`${focus.debt.name} paid off`} />
              <p class="muted" data-testid="focus-sentence">
                {focusSentence(focus.pctGone, focusIdx < 0 ? null : focusIdx)}
              </p>
              <p class="muted small" data-testid="focus-why">
                {whyFirst(s.method, growingNow.has(focus.debt.id))}
              </p>
              <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => openSheet('extra')}>
                {COPY.extraPayment}
              </button>
            </section>
          )}

          <div class="tile-row">
            <div class="card tile-card" data-testid="daily-cost">
              <p class="muted small">Your debt costs</p>
              <p class="tile-val num">{formatMoney(daily, cur)} a day</p>
              <p class="muted small">{lastMonth !== null ? `Last month ${formatMoney(lastMonth, cur)}` : 'It drops as balances go down.'}</p>
            </div>
            <button type="button" class="card tile-card tile-btn" data-testid="safety-tile" onClick={() => (tab.value = 'safety')}>
              <p class="muted small">Safety net</p>
              <p class="tile-val num">{bufferFull ? `${money(d.buffer.amount)} ready` : `${money(d.buffer.amount)} of ${money(s.bufferGoal)}`}</p>
              <p class="muted small">{bufferFull ? 'Goal reached' : 'Filling first'}</p>
            </button>
          </div>

          {due.length > 0 && (
            <section class="card stack" style={{ gap: 6 }} aria-label="Coming up" data-testid="coming-up">
              <p class="label">Coming up</p>
              {due.map((i) => (
                <div key={`${i.name}-${i.date}`} class="row">
                  <span>
                    {shortDate(i.date)} · {i.name}
                    {i.autopay ? ' (autopay)' : ''} <span class="muted small">{relativeDay(today.value, i.date)}</span>
                  </span>
                  <span class="num">{money(i.amount)}</span>
                </div>
              ))}
            </section>
          )}

          <LaterCard />
        </>
      )}

      <p class="hand">{COPY.slogan}</p>
      <p class="footer-note">
        {syncOn.value ? COPY.privacySynced : COPY.privacy} {COPY.disclaimer}
      </p>


      <Sheet open={dueDebtId !== null} onClose={() => setDueDebtId(null)} title={`Due day for ${d.debts.find((x) => x.id === dueDebtId)?.name ?? ''}`}>
        <Field label="Day of the month" hint="It’s on your statement.">
          <input type="text" inputMode="numeric" maxLength={2} value={dueText} onInput={(e) => { setDueText((e.target as HTMLInputElement).value.replace(/\D/g, '')); setDueNote(''); }} />
        </Field>
        {dueNote && <Note>{dueNote}</Note>}
        <button type="button" class="btn" onClick={saveDue}>
          Save
        </button>
        <button type="button" class="link" onClick={() => setDueDebtId(null)}>
          Cancel
        </button>
      </Sheet>

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === 'amount' || sheet === 'redo' ? COPY.differentAmount : 'Extra payment'}>
        {sheet === 'amount' || sheet === 'redo' ? (
          <Field label="How much can go to the plan this payday?" hint={`Usually ${money(s.extraPerPayday)}. Your minimums stay the same, and the rest follows the same order.`}>
            <NumberInput pre={cur.symbol} value={input} onInput={setInput} label="Money for the plan this payday" />
          </Field>
        ) : (
          <Field label="How much extra did you pay?" hint={focus ? `It goes to ${focus.debt.name}. Anything over its balance goes to the next debt.` : undefined}>
            <NumberInput pre={cur.symbol} value={input} onInput={setInput} label="Extra payment" />
          </Field>
        )}
        {inputNote && <Note>{inputNote}</Note>}
        <button type="button" class="btn" onClick={saveSheet}>
          {sheet === 'amount' || sheet === 'redo' ? 'Update this payday' : 'Save'}
        </button>
        <button type="button" class="link" onClick={() => setSheet(null)}>
          Cancel
        </button>
      </Sheet>
    </main>
  );
}

