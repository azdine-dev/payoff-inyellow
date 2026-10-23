/**
 * "Do these later": a small checklist on Today for what setup no longer asks (yearly bills, payday reminder,
 * a backup) and for debts whose rate was left empty. It goes away as each item is done.
 */
import { useState } from 'preact/hooks';
import { LaterChips } from '../setup/LaterChips';
import { laterStatus, RateSheet } from '../setup/LaterSheets';
import { data } from '../state/store';

export function LaterCard() {
  const [rateFor, setRateFor] = useState<string | null>(null);
  const d = data.value;
  if (!d) return null;
  const missing = d.debts.filter((x) => x.status === 'active' && x.rateMissing);
  const status = laterStatus(d);
  if (!missing.length && status.yearly && status.reminder && status.backup) return null;
  return (
    <section class="card stack" aria-label="Do these later" data-testid="later-card">
      <p class="label">Do these later</p>
      {missing.length > 0 && (
        <div class="chips">
          {missing.map((m) => (
            <button key={m.id} type="button" class="chip-later" onClick={() => setRateFor(m.id)}>
              Add {m.name}’s rate
            </button>
          ))}
        </div>
      )}
      <LaterChips onlyPending />
      <RateSheet debtId={rateFor} onClose={() => setRateFor(null)} />
    </section>
  );
}
