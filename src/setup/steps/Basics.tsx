/** Pay schedule, with the welcome words on top and the currency as a small line */
import { useState } from 'preact/hooks';
import { COPY } from '../../lib/copy';
import { VIDEO_URL } from '../../lib/config';
import { CURRENCY_CHOICES, symbolFor } from '../../lib/money';
import { shortDate } from '../../lib/today';
import { editSeed } from '../../state/store';
import { Choice, Field, HelpTip, NumberInput, Wordmark } from '../../ui/controls';
import { FREQUENCIES } from '../draft';
import { TwicePicker } from '../TwicePicker';
import type { StepProps } from '../Wizard';

/** "Currency: USD ($) · Change". Picked from the device. The choices open only when asked for. */
function CurrencyLine({ draft, set }: Pick<StepProps, 'draft' | 'set'>) {
  const other = draft.currencyCode === '';
  const [open, setOpen] = useState(false);
  const shown = other ? draft.currencySymbol.trim() || 'your own symbol' : `${draft.currencyCode} (${draft.currencySymbol})`;
  return (
    <div class="stack" style={{ gap: 6 }}>
      <p class="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span data-testid="currency-line">Currency: {shown}</span>
        {!open && !other && (
          <button type="button" class="link small" onClick={() => setOpen(true)}>
            Change
          </button>
        )}
      </p>
      {(open || other) && (
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
      )}
      {(open || other) && other && (
        <Field label="Your symbol" hint="Any symbol works, like $, €, DH or ₦.">
          <input type="text" maxLength={5} value={draft.currencySymbol} onInput={(e) => set({ currencySymbol: (e.target as HTMLInputElement).value })} />
        </Field>
      )}
    </div>
  );
}

/** The words that used to be a screen of their own. Skipped when numbers are being changed. */
function Welcome({ draft, set }: Pick<StepProps, 'draft' | 'set'>) {
  return (
    <div class="stack" style={{ gap: 12 }}>
      <Wordmark height={30} />
      <h1 style={{ fontSize: '1.7rem' }}>{COPY.welcome}</h1>
      <p style={{ fontSize: '1.05rem' }}>{COPY.welcome2}</p>
      <p class="muted">
        About 5 minutes.
        <HelpTip title="What you need">
          <p>Have your card statements or banking app close by.</p>
        </HelpTip>
      </p>
      {VIDEO_URL && (
        <a href={VIDEO_URL} target="_blank" rel="noopener" class="link">
          {COPY.watchVideo}
        </a>
      )}
      <Field label="What should we call you? (optional)" hint="Stays on this device.">
        <input type="text" maxLength={24} autoComplete="given-name" value={draft.firstName ?? ''} onInput={(e) => set({ firstName: (e.target as HTMLInputElement).value })} />
      </Field>
    </div>
  );
}

export function PayStep({ draft, set, today }: StepProps) {
  return (
    <div class="stack">
      {!editSeed.value && <Welcome draft={draft} set={set} />}
      <h2 style={{ fontSize: '1.5rem' }}>
        Your pay schedule
        <HelpTip title="Why paydays?">
          <p>Your whole plan follows your paydays, not the calendar month.</p>
        </HelpTip>
      </h2>
      <CurrencyLine draft={draft} set={set} />
      <div class="stack" role="radiogroup" aria-label="How often you get paid" style={{ gap: 8 }}>
        {FREQUENCIES.map((f) => (
          <Choice key={f.value} checked={draft.frequency === f.value} onSelect={() => set({ frequency: f.value, ifThenDay: '' })} title={f.label} />
        ))}
      </div>
      {draft.frequency === 'twice-monthly' && (
        <TwicePicker pair={draft.twicePair} a={draft.twiceA} b={draft.twiceB} onChange={(p) => set({ ...p, ifThenDay: '' })} />
      )}
      <Field label="Your next payday" hint={draft.frequency === 'twice-monthly' ? 'It should be one of your two pay days.' : undefined}>
        <input type="date" min={today} value={draft.nextPayday} onInput={(e) => set({ nextPayday: (e.target as HTMLInputElement).value, ifThenDay: '' })} />
      </Field>
      {draft.nextPayday && draft.nextPayday >= today && <p class="muted small">That's {shortDate(draft.nextPayday)}.</p>}
      <Field label="Your usual paycheck (optional)" hint="Stays on this device.">
        <NumberInput pre={draft.currencySymbol} value={draft.paycheck} onInput={(v) => set({ paycheck: v })} label="Usual paycheck" />
      </Field>
    </div>
  );
}
