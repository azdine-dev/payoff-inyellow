/** Welcome, Currency, Pay schedule */
import { COPY } from '../../lib/copy';
import { VIDEO_URL } from '../../lib/config';
import { CURRENCY_CHOICES, symbolFor } from '../../lib/money';
import { shortDate } from '../../lib/today';
import { Choice, Field, NumberInput, Wordmark } from '../../ui/controls';
import { FREQUENCIES } from '../draft';
import type { StepProps } from '../Wizard';

export function Welcome() {
  return (
    <div class="stack" style={{ gap: 20, paddingTop: 24 }}>
      <Wordmark height={34} />
      <h1 style={{ fontSize: '2rem' }}>{COPY.welcome}</h1>
      <p style={{ fontSize: '1.1rem' }}>{COPY.welcome2}</p>
      <p class="muted">About 15 minutes. Have your card statements or banking app close by.</p>
      {VIDEO_URL && (
        <a href={VIDEO_URL} target="_blank" rel="noopener" class="link">
          {COPY.watchVideo}
        </a>
      )}
    </div>
  );
}

export function CurrencyStep({ draft, set }: StepProps) {
  const other = draft.currencyCode === '';
  return (
    <div class="stack">
      <h1>Your currency</h1>
      <p class="muted">We picked it from your phone. Change it if it's wrong.</p>
      <Field label="Currency">
        <select
          value={draft.currencyCode}
          onChange={(e) => {
            const code = (e.target as HTMLSelectElement).value;
            set({ currencyCode: code, currencySymbol: code ? symbolFor(code) : '' });
          }}
        >
          {CURRENCY_CHOICES.includes(draft.currencyCode) || other ? null : (
            <option value={draft.currencyCode}>
              {draft.currencyCode} ({symbolFor(draft.currencyCode)})
            </option>
          )}
          {CURRENCY_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c} ({symbolFor(c)})
            </option>
          ))}
          <option value="">Other: type my own symbol</option>
        </select>
      </Field>
      {other && (
        <Field label="Your symbol" hint="Any symbol works, like $, €, DH or ₦.">
          <input type="text" maxLength={5} value={draft.currencySymbol} onInput={(e) => set({ currencySymbol: (e.target as HTMLInputElement).value })} />
        </Field>
      )}
    </div>
  );
}

export function PayStep({ draft, set, today }: StepProps) {
  return (
    <div class="stack">
      <h1>Your pay schedule</h1>
      <p class="muted">Your whole plan follows your paydays, not the calendar month.</p>
      <div class="stack" role="radiogroup" aria-label="How often you get paid" style={{ gap: 8 }}>
        {FREQUENCIES.map((f) => (
          <Choice key={f.value} checked={draft.frequency === f.value} onSelect={() => set({ frequency: f.value, ifThenDay: '' })} title={f.label} />
        ))}
      </div>
      <Field
        label="Your next payday"
        hint={draft.frequency === 'twice-monthly' ? 'Pick the first of your two paydays in the month, like the 1st or the 15th.' : undefined}
      >
        <input type="date" min={today} value={draft.nextPayday} onInput={(e) => set({ nextPayday: (e.target as HTMLInputElement).value, ifThenDay: '' })} />
      </Field>
      {draft.nextPayday && draft.nextPayday >= today && <p class="muted small">That's {shortDate(draft.nextPayday)}.</p>}
      <Field label="Your usual paycheck (optional)" hint="Only used to check that the plan fits. It stays on this phone.">
        <NumberInput pre={draft.currencySymbol} value={draft.paycheck} onInput={(v) => set({ paycheck: v })} label="Usual paycheck" />
      </Field>
    </div>
  );
}
