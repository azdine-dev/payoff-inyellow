/**
 * Setup result (mockup screen 1): the debt-free date, what it saves, and the first step.
 * Without a valid unlock code this is the whole calculator ("calculator mode"): below the
 * result sit what the full planner adds, the code box and "Change my numbers".
 */
import { syncOn } from '../sync/controller';
import { planNeedsHelp } from '../engine';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { monthsBetween, monthYear, shortDate } from '../lib/today';
import { billsForNextPayday } from '../state/billsDue';
import { toPlanInput } from '../state/planInput';
import { exampleMode, leaveExample } from '../state/example';
import { data, editSeed, licenseState, plan, tab, today, view } from '../state/store';
import { draftFromData } from './draft';
import { firstStep, methodReason } from '../today/model';
import { NeedsHelp } from '../ui/NeedsHelp';
import { ifThenLine } from './steps/Order';
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
  // "Bills due $85, yearly bills $42.31, buffer $107.69"
  const partsList = r.rows[0]
    ? [
        bills.total > 0 && `bills due ${formatMoneyAuto(bills.total, cur)}`,
        r.rows[0].toYearlyBills > 0.004 && `yearly bills ${formatMoneyAuto(r.rows[0].toYearlyBills, cur)}`,
        r.rows[0].toBuffer > 0.004 && `buffer ${formatMoneyAuto(r.rows[0].toBuffer, cur)}`,
      ].filter(Boolean)
    : [];
  const parts = partsList.join(', ').replace(/^./, (c) => c.toUpperCase());

  const sooner = r.debtFreeDate && mo.months !== null ? mo.months - monthsBetween(today.value, r.debtFreeDate) : null;
  const less = mo.totalInterest !== null ? mo.totalInterest - r.totalInterest : null;
  const when = s.startMode === 'next-month' ? 'Your first payday' : 'This payday';

  return (
    <main class="screen">
      {example && (
        <section class="card soft stack" style={{ gap: 4 }} data-testid="example-banner">
          <p class="label">Example</p>
          <p>This is Sara’s plan, made up so you can see what you will get. Nothing is saved.</p>
        </section>
      )}
      <div class="row" style={{ paddingTop: 8 }}>
        <p class="muted">{COPY.resultReady}</p>
        {locked && !example && (
          <button type="button" class="link small" onClick={() => { tab.value = 'settings'; view.value = 'app'; }}>
            Settings
          </button>
        )}
      </div>
      {r.debtFreeDate ? (
        <h1 style={{ fontSize: '2.1rem', fontWeight: 700 }}>
          {COPY.resultLead}
          <br />
          <span class="hl-big" style={{ fontSize: '2.9rem', fontWeight: 800, marginTop: 10 }} data-testid="debt-free-date">
            {monthYear(r.debtFreeDate)}
          </span>
        </h1>
      ) : (
        <h1 style={{ fontSize: '2rem' }}>Right now this plan takes more than 20 years.</h1>
      )}

      {r.debtFreeDate && (
        <div class="grid-2">
          {mo.neverEnds ? (
            <div class="card">
              <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.4rem' }}>Never ends</p>
              <p class="muted small">with minimums only. Your plan ends it.</p>
            </div>
          ) : (
            sooner !== null &&
            sooner > 0 && (
              <div class="card">
                <p class="num" style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.7rem' }}>
                  {sooner}
                </p>
                <p class="muted small">months sooner than minimums</p>
              </div>
            )
          )}
          {less !== null && less >= 1 && (
            <div class="card">
              <p class="num" style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.7rem' }}>
                {formatMoney(less, cur, { whole: true })}
              </p>
              <p class="muted small">less interest</p>
            </div>
          )}
        </div>
      )}

      <NeedsHelp reasons={reasons} />

      {first && (
        <section class="card stack" style={{ gap: 6 }}>
          <p class="label">{COPY.firstStep}</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.35 }} data-testid="first-step">
            {when} ({shortDate(first.date)}):{' '}
            {first.kind === 'setaside' ? (
              <>
                set aside <span class="hl">{formatMoneyAuto(first.amount, cur)}</span>
              </>
            ) : first.kind === 'nothing' ? (
              <>nothing is due before your next payday</>
            ) : (
              <>
                pay <span class="hl">{formatMoneyAuto(first.amount, cur)}</span> to {first.target}
              </>
            )}
          </p>
          {first.kind === 'setaside' && r.rows[0] && (
            <p class="small num" data-testid="first-step-parts">
              {parts}.
            </p>
          )}
          <p class="muted small">{r.rows[0]?.bufferFirst ? COPY.buffer : first.kind === 'debt' ? methodReason(s.method) : ''}</p>
        </section>
      )}

      {!example && <p class="card">{ifThenLine(s.ifThen.day, s.ifThen.time)}</p>}

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
      <p class="hand">{COPY.slogan}</p>
      <p class="footer-note">
        {syncOn.value ? COPY.privacySynced : COPY.privacy} {COPY.disclaimer}
      </p>
    </main>
  );
}
