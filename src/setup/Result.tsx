/**
 * Step 4, "Your date" (mockup 02): the debt-free date, what it saves, your first step, and the things to do
 * later. Without a valid unlock code this is the whole calculator ("calculator mode"): below the result sit
 * what the full planner adds, the code box and "Change my numbers".
 */
import { useState } from 'preact/hooks';
import { syncOn } from '../sync/controller';
import { planNeedsHelp } from '../engine';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { addDaysISO, dayMonth, monthsBetween, monthYear, shortDate } from '../lib/today';
import { setStartMode, startIndex } from '../state/actions';
import { billsForNextPayday } from '../state/billsDue';
import { isDebtFree } from '../state/debtFree';
import { exampleMode, leaveExample } from '../state/example';
import { toPlanInput } from '../state/planInput';
import { act, data, editSeed, licenseState, plan, tab, today, view } from '../state/store';
import { draftFromData } from './draft';
import { firstStep, methodReason } from '../today/model';
import { NeedsHelp } from '../ui/NeedsHelp';
import { SetupBar } from '../ui/controls';
import { HowWeGotThis } from './HowWeGotThis';
import { LaterChips } from './LaterChips';
import { EmailCapture, UnlockCard } from './Unlock';

export function Result() {
  const d = data.value!;
  const r = plan.value!;
  const s = d.settings;
  const cur = s.currency;
  const mo = r.minimumsOnly;
  const example = exampleMode.value;
  const locked = licenseState.value !== 'unlocked';
  const reasons = planNeedsHelp(toPlanInput(d), r, s.paycheckAmount);
  const bills = billsForNextPayday(d);
  const first = r.rows[0] ? firstStep(r.rows[0], d, bills) : null;
  // "Medical bill $50 (due 1 Nov) · Store card $35 (due 5 Nov) · Yearly bills $42.31 · Buffer $107.69"
  const partsList = r.rows[0]
    ? [
        ...bills.due.map((b) => `${b.name} ${formatMoneyAuto(b.amount, cur)} (due ${dayMonth(b.due)})`),
        r.rows[0].toYearlyBills > 0.004 && `Yearly bills ${formatMoneyAuto(r.rows[0].toYearlyBills, cur)}`,
        r.rows[0].toBuffer > 0.004 && `Buffer ${formatMoneyAuto(r.rows[0].toBuffer, cur)}`,
      ].filter(Boolean)
    : [];
  const parts = partsList.join(' · ');
  const [how, setHow] = useState(false);

  const sooner = r.debtFreeDate && mo.months !== null ? mo.months - monthsBetween(today.value, r.debtFreeDate) : null;
  const less = mo.totalInterest !== null ? mo.totalInterest - r.totalInterest : null;
  const minimumsUntil = mo.months !== null ? monthYear(addDaysISO(today.value, Math.round(mo.months * 30.44))) : null;

  // "Start on the 1st of next month" is a choice you can still make until the first payday is done
  const nextMonthIndex = startIndex({ frequency: s.frequency, nextPayday: s.anchorPayday, startMode: 'next-month', otherPayday: s.otherPayday }, today.value);
  const canChooseStart = !example && d.paydays.length === 0 && (s.startMode === 'next-month' || nextMonthIndex > 0);

  return (
    <main class="screen">
      {example && (
        <section class="card soft stack" style={{ gap: 4 }} data-testid="example-banner">
          <p class="label">Example</p>
          <p>This is Sara’s plan, made up so you can see what you will get. Nothing is saved.</p>
        </section>
      )}
      <div class="setup-head">
        <SetupBar step={4} finished />
        {locked && !example && (
          <button type="button" class="link small" onClick={() => { tab.value = 'settings'; view.value = 'app'; }}>
            Settings
          </button>
        )}
      </div>

      {r.debtFreeDate ? (
        <div class="stack" style={{ gap: 8 }}>
          <p class="muted" style={{ fontSize: '1.1rem' }}>{COPY.resultLead}</p>
          <h1 style={{ margin: 0 }}>
            <span class="hl-big tilt" style={{ fontSize: '2.9rem', fontWeight: 800 }} data-testid="debt-free-date">
              {monthYear(r.debtFreeDate)}
            </span>
          </h1>
          <button type="button" class="link small" style={{ alignSelf: 'flex-start', fontWeight: 500 }} aria-label="How we got this date" onClick={() => setHow(true)}>
            How we got this
          </button>
          {!mo.neverEnds && minimumsUntil && (
            <p class="muted" data-testid="minimums-only">
              Paying only minimums, it would take until {minimumsUntil}.
            </p>
          )}
        </div>
      ) : (
        <h1 style={{ fontSize: '2rem' }}>{isDebtFree(d) ? 'You’re debt-free.' : 'Right now this plan takes more than 20 years.'}</h1>
      )}

      {r.debtFreeDate && (
        <div class="grid-2">
          {mo.neverEnds && (
            <div class="card tile" data-testid="tile-sooner">
              <p class="tile-big">Never ends</p>
              <p class="muted small">with minimums only. Your plan ends it.</p>
            </div>
          )}
          {!mo.neverEnds && sooner !== null && sooner > 0 && (
            <div class="card tile" data-testid="tile-sooner">
              <p class="tile-big num">
                {sooner} month{sooner === 1 ? '' : 's'}
              </p>
              <p class="muted small">sooner</p>
            </div>
          )}
          {less !== null && less >= 1 && (
            <div class="card tile" data-testid="tile-interest">
              <p class="tile-big num">{formatMoney(less, cur, { whole: true })}</p>
              <p class="muted small">less interest</p>
            </div>
          )}
        </div>
      )}

      <NeedsHelp reasons={reasons} />

      {!example && bills.noDueDay.length > 0 && (
        <section class="card stack" style={{ gap: 4 }} data-testid="no-due-day-note">
          <p>
            <b>{bills.noDueDay.map((b) => b.name).join(', ')}</b> {bills.noDueDay.length === 1 ? 'has' : 'have'} no due day yet. We can’t place {bills.noDueDay.length === 1 ? 'its bill' : 'their bills'} on a payday, so {bills.noDueDay.length === 1 ? 'it isn’t' : 'they aren’t'} in this plan yet.
          </p>
          <p class="muted small">Add the day on Today after you start. Your date updates at once.</p>
        </section>
      )}

      {first && (
        <section class="first-card" data-testid="first-card">
          <p class="first-label">
            {COPY.firstStep} · {shortDate(first.date)}
          </p>
          <p class="first-main" data-testid="first-step">
            {first.kind === 'debt' ? (
              Math.abs(first.total - first.amount) < 0.01 ? (
                <>
                  Pay {formatMoneyAuto(first.amount, cur)} to <span class="hl">{first.target}</span>.
                </>
              ) : (
                <>
                  Move {formatMoneyAuto(first.total, cur)}. The extra {formatMoneyAuto(first.amount, cur)} goes to <span class="hl">{first.target}</span>.
                </>
              )
            ) : first.kind === 'setaside' ? (
              <>Move {formatMoneyAuto(first.total, cur)}.</>
            ) : (
              <>Nothing is due before your next payday.</>
            )}
          </p>
          {first.kind !== 'nothing' && parts && (
            <p class="first-parts num" data-testid="first-step-parts">
              {parts}
            </p>
          )}
          <p class="first-why">{r.rows[0]?.bufferFirst ? COPY.buffer : first.kind === 'debt' ? methodReason(s.method) : ''}</p>
        </section>
      )}

      {!example && !locked && (
        <section class="stack" style={{ gap: 8 }} aria-label="Do these later">
          <p class="label">Do these later, on Today</p>
          <LaterChips />
        </section>
      )}

      {canChooseStart && (
        <button
          type="button"
          class="link small"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => void act((db, x) => setStartMode(db, x, s.startMode === 'next-month' ? 'this-payday' : 'next-month', today.value))}
        >
          {s.startMode === 'next-month' ? 'Start this payday instead' : 'Start on the 1st of next month instead'}
        </button>
      )}

      {example ? (
        <>
          <div class="spacer" />
          <button type="button" class="btn" onClick={leaveExample}>
            Start with my numbers
          </button>
        </>
      ) : locked ? (
        <>
          <UnlockCard />
          <button
            type="button"
            class="btn ghost"
            onClick={() => {
              editSeed.value = draftFromData(d);
              view.value = 'setup';
            }}
          >
            Change my numbers
          </button>
          <EmailCapture />
        </>
      ) : (
        <>
          <div class="spacer" />
          <button
            type="button"
            class="btn"
            onClick={() => {
              tab.value = 'today';
              view.value = 'app';
            }}
          >
            {COPY.startPlan}
          </button>
        </>
      )}
      <HowWeGotThis open={how} onClose={() => setHow(false)} />
      <p class="hand">{COPY.slogan}</p>
      <p class="footer-note">
        {syncOn.value ? COPY.privacySynced : COPY.privacy} {COPY.disclaimer}
      </p>
    </main>
  );
}
