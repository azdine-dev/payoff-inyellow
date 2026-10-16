/** "Your plan needs help": kind words, hardship programs and nonprofit counseling. Never a loan. */
import type { NeedsHelpReason } from '../engine';
import { COPY } from '../lib/copy';
import { HARDSHIP_SCRIPT_URL, NFCC_URL } from '../lib/config';

export function NeedsHelp({ reasons }: { reasons: NeedsHelpReason[] }) {
  if (!reasons.length) return null;
  return (
    <section class="card soft stack" aria-labelledby="needs-help">
      <h2 id="needs-help">{COPY.needsHelpTitle}</h2>
      <p>{reasons.includes('minimums-over-paycheck') ? COPY.needsHelp : COPY.needsHelpLong}</p>
      <ul class="stack" style={{ margin: 0, paddingLeft: '1.1rem' }}>
        <li>
          {COPY.hardship}{' '}
          {HARDSHIP_SCRIPT_URL && (
            <a href={HARDSHIP_SCRIPT_URL} target="_blank" rel="noopener">
              What to say on the call
            </a>
          )}
        </li>
        <li>
          {COPY.counseling}{' '}
          <a href={NFCC_URL} target="_blank" rel="noopener">
            NFCC.org
          </a>
        </li>
      </ul>
    </section>
  );
}
