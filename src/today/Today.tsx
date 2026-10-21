/** Today (mockup screen 2): one clear step every payday. */
import { syncOn } from '../sync/controller';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { dailyInterestCost, planNeedsHelp, simulatePlan } from '../engine';
import { backupDue } from '../data/backup';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { dayMonth, shortDate, shortMonthYear } from '../lib/today';
import { didPayday, extraPayment, missedPaydays, skipPaydays } from '../state/actions';
import { biggerNote, billsForNextPayday } from '../state/billsDue';
import { editDebt } from '../state/debtActions';
import { momentText } from '../state/milestones';
import { activeDebts, nextPaydayISO, toPlanInput } from '../state/planInput';
import { act, data, getDB, plan, tab, today } from '../state/store';
import { Bar, Checkbox, Field, GearIcon, Note, NumberInput, Sheet, Wordmark } from '../ui/controls';
import { NeedsHelp } from '../ui/NeedsHelp';
import { comingUp, dueLine, focusDebt, paydayLines } from './model';

interface JustPaid {
  date: string;
  total: number;
}

export function Today() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const nextDate = nextPaydayISO(s);

  // "I got a different amount" for this payday only (null = the usual amount)
  const [override, setOverride] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [justPaid, setJustPaid] = useState<JustPaid | null>(null);
  const [paidNames, setPaidNames] = useState<string[]>([]);
  const [skippedNote, setSkippedNote] = useState(false);
  const [closedMoments, setClosedMoments] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<'amount' | 'extra' | null>(null);
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
  }, [s.paydayIndex]);

  const r = useMemo(() => (override === null ? plan.value! : simulatePlan(toPlanInput(d, override))), [d, override]);
  const row = r.rows[0];
  const bills = useMemo(() => billsForNextPayday(d), [d]);
  const { lines, total, noDueDay } = row ? paydayLines(row, d, bills) : { lines: [], total: 0, noDueDay: [] };
  const missed = missedPaydays(d, today.value);
  const reasons = planNeedsHelp(toPlanInput(d), plan.value!, s.paycheckAmount);
  const focus = focusDebt(d, r);
  const active = activeDebts(d);
  const due = comingUp(d, today.value);
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setChecked(new Set(lines.map((l) => l.key)));
    await new Promise((res) => setTimeout(res, 650)); // let the boxes turn yellow first
    const res = await didPayday(await getDB(), d, { planMoney: override });
    setJustPaid({ date: res.step.date, total });
    setPaidNames(res.newlyPaid.map(nameOf));
    setSkippedNote(false);
    data.value = res.data;
    setBusy(false);
  };

  const toggle = (key: string) => {
    const next = new Set(checked);
    next.has(key) ? next.delete(key) : next.add(key);
    setChecked(next);
    if (lines.length && next.size === lines.length) apply();
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

  const saveSheet = async () => {
    const amount = parseAmount(input);
    if (amount === null || amount < 0 || (sheet === 'extra' && amount === 0)) {
      setInputNote('Type an amount, like 50.');
      return;
    }
    if (sheet === 'amount') {
      setOverride(amount === s.extraPerPayday ? null : amount);
    } else {
      const owed = active.reduce((sum, x) => sum + x.balance, 0);
      const res = await extraPayment(await getDB(), d, Math.min(amount, owed), today.value);
      setPaidNames(res.newlyPaid.map(nameOf));
      data.value = res.data;
    }
    setSheet(null);
  };

  const pill = r.debtFreeDate ? `Debt-free · ${shortMonthYear(r.debtFreeDate)}` : active.length ? 'More than 20 years' : 'Debt-free';

  return (
    <main class="screen with-tabs">
      <header class="row" style={{ flexWrap: 'wrap' }}>
        <Wordmark />
        <div class="row" style={{ gap: 4, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <span class="pill" data-testid="debt-free-pill">
            {pill}
          </span>
          <button type="button" class="link" aria-label="Settings" style={{ width: 44, display: 'grid', placeItems: 'center' }} onClick={() => (tab.value = 'settings')}>
            <GearIcon />
          </button>
        </div>
      </header>

      {backupDue(s.lastBackupAt, s.setupDoneAt) && (
        <section class="card soft row" aria-label="Backup reminder">
          <span>Your plan lives only on this device. Save a backup.</span>
          <button type="button" class="link" onClick={() => (tab.value = 'settings')}>
            Save a backup
          </button>
        </section>
      )}

      {paidNames.map((name) => (
        <section key={name} class="card" style={{ background: 'var(--yellow)', borderColor: 'var(--yellow)', color: 'var(--on-yellow)' }}>
          <p style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.3rem' }}>{name}</p>
          <p style={{ fontWeight: 600 }}>{COPY.debtPaid}</p>
        </section>
      ))}

      {d.milestones
        .filter((m) => m.reachedOn === today.value && !closedMoments.has(m.id))
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
        })}

      {justPaid && (
        <section class="card soft row" role="status">
          <span>
            <b>{shortDate(justPaid.date)} is paid.</b> Next payday: {shortDate(nextDate)}.
          </span>
          <span class="num" style={{ fontWeight: 600 }}>
            {formatMoney(justPaid.total, cur)}
          </span>
        </section>
      )}

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

      {!active.length ? (
        <section class="card stack">
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1.8rem' }}>
            You're <span class="hl-big">debt-free</span>
          </h2>
          <p>Every debt is paid. Keep your buffer and your yearly bills going, so a surprise bill stays off the cards.</p>
        </section>
      ) : (
        row && (
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

            <section class="card" aria-labelledby="payday-title">
              <div class="row">
                <h2 id="payday-title">{missed > 0 ? 'Last payday' : 'Next payday'}</h2>
                <span class="muted">{shortDate(nextDate)}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {lines.map((l, i) => (
                  <div key={l.key} style={{ borderTop: i ? '1px dashed var(--line)' : 'none' }}>
                    <Checkbox
                      checked={checked.has(l.key)}
                      onToggle={() => toggle(l.key)}
                      right={
                        l.inline ? undefined : (
                          <span class="num" style={{ fontWeight: 600 }}>
                            {formatMoneyAuto(l.amount, cur)}
                          </span>
                        )
                      }
                    >
                      {l.label} {l.highlight && <span class="hl">{l.highlight}</span>}
                    </Checkbox>
                  </div>
                ))}
                {noDueDay.map((b) => (
                  <div key={`nd-${b.debtId}`} data-testid="no-due-day" style={{ borderTop: lines.length ? '1px dashed var(--line)' : 'none', minHeight: 44, display: 'flex', alignItems: 'center', paddingLeft: 34 }}>
                    <span>
                      {b.name} {formatMoneyAuto(b.amount, cur)},{' '}
                      <button type="button" class="link" style={{ display: 'inline' }} onClick={() => openDue(b.debtId)}>
                        add a due day
                      </button>
                    </span>
                  </div>
                ))}
                {noDueDay.length > 0 && (
                  <p class="muted small" style={{ margin: '0 0 8px 34px' }}>
                    Not counted until you add a due day.
                  </p>
                )}
              </div>
              {row && biggerNote(bills, row, (n) => formatMoneyAuto(n, cur), dayMonth) && (
                <p class="muted small" data-testid="bigger-note" style={{ margin: '0 0 8px 34px' }}>
                  {biggerNote(bills, row, (n) => formatMoneyAuto(n, cur), dayMonth)}
                </p>
              )}
              {row.bufferFirst && (
                <p class="muted small" data-testid="buffer-first" style={{ margin: '0 0 8px 34px' }}>
                  Extra goes to your buffer until it reaches {formatMoneyAuto(s.bufferGoal, cur)}.
                </p>
              )}
              {override !== null && (
                <p class="muted small" style={{ margin: '4px 0 8px' }}>
                  This payday uses {formatMoneyAuto(override, cur)} for the plan instead of {formatMoneyAuto(s.extraPerPayday, cur)}.{' '}
                  <button type="button" class="link small" onClick={() => setOverride(null)}>
                    Use the usual amount
                  </button>
                </p>
              )}
              <button type="button" class={`btn${busy ? ' done' : ''}`} style={{ marginTop: 10 }} onClick={apply} disabled={busy}>
                {COPY.didIt} · <span class="num">{formatMoneyAuto(total, cur)}</span>
              </button>
              <div class="row" style={{ marginTop: 4 }}>
                <button type="button" class="link small" onClick={() => openSheet('amount')}>
                  {COPY.differentAmount}
                </button>
                <button type="button" class="link small" onClick={() => openSheet('extra')}>
                  {COPY.extraPayment}
                </button>
              </div>
            </section>
          </>
        )
      )}

      <NeedsHelp reasons={reasons} />

      {focus && (
        <section class="card stack" style={{ gap: 8 }} aria-label="Focus debt">
          <div class="row">
            <h2>{focus.debt.name}</h2>
            <span class="num" style={{ fontWeight: 600 }}>
              {Math.floor(focus.pctGone)}% gone
            </span>
          </div>
          <Bar pct={focus.pctGone} label={`${focus.debt.name} paid off`} />
          <p class="muted small">
            {formatMoney(focus.left, cur, { whole: true })} left{focus.goneBy ? ` · gone by ${shortMonthYear(focus.goneBy)}` : ''}
          </p>
        </section>
      )}

      {active.length > 0 && (
        <p class="card">
          Your debt costs you <b class="num">{formatMoney(dailyInterestCost(active), cur)} a day</b>. It drops as balances go down.
        </p>
      )}

      {due.length > 0 && (
        <p class="muted small">
          Coming up · {due.map((i) => dueLine(i, d)).join(' · ')}
        </p>
      )}

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

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === 'amount' ? COPY.differentAmount : 'Extra payment'}>
        {sheet === 'amount' ? (
          <Field
            label="How much can go to the plan this payday?"
            hint={`Usually ${formatMoneyAuto(s.extraPerPayday, cur)}. Your minimums stay the same, and the rest follows the same order.`}
          >
            <NumberInput pre={cur.symbol} value={input} onInput={setInput} label="Money for the plan this payday" />
          </Field>
        ) : (
          <Field label="How much extra did you pay?" hint={focus ? `It goes to ${focus.debt.name}. Anything over its balance goes to the next debt.` : undefined}>
            <NumberInput pre={cur.symbol} value={input} onInput={setInput} label="Extra payment" />
          </Field>
        )}
        {inputNote && <Note>{inputNote}</Note>}
        <button type="button" class="btn" onClick={saveSheet}>
          {sheet === 'amount' ? 'Update this payday' : 'Save'}
        </button>
        <button type="button" class="link" onClick={() => setSheet(null)}>
          Cancel
        </button>
      </Sheet>
    </main>
  );
}

