/** Calculator mode: what the full planner adds, the unlock code box, and the email form. */
import { useState } from 'preact/hooks';
import { COPY } from '../lib/copy';
import { STORE_URL, EMAIL_CAPTURE_URL } from '../lib/config';
import { IS_FREE } from '../lib/edition';
import { cleanCode, verifyCode } from '../lib/license';
import { isEmail, submitEmail } from '../lib/leadCapture';
import { saveLicense } from '../state/settingsActions';
import { act } from '../state/store';
import { Field, Note } from '../ui/controls';

export const UNLOCK_BENEFITS = [
  'Tick off every payday and watch it turn yellow',
  'Your whole plan payday by payday, with what-if and one-off money',
  'Buffer, yearly bills and new charges kept up to date',
  'Progress, milestones and a picture you can share',
  'Backup, calendar file and CSV export',
];

export function UnlockCard() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  const check = async () => {
    const r = await verifyCode(code);
    if (r.ok) {
      await act((db, x) => saveLicense(db, x, cleanCode(code)));
    } else {
      setMsg(r.reason === 'empty' ? 'Paste your unlock code first.' : COPY.codeRefused);
    }
  };

  return (
    <section class="card stack" aria-labelledby="unlock-title" data-testid="unlock-card">
      <h2 id="unlock-title" style={{ fontFamily: 'var(--font-head)', fontSize: '1.3rem' }}>
        Unlock the full planner
      </h2>
      <p class="muted">The calculator shows your date and your first step. The full planner keeps you going every payday:</p>
      <ul class="stack" style={{ margin: 0, paddingLeft: '1.1rem', gap: 4 }}>
        {UNLOCK_BENEFITS.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <p class="muted small">One price. No subscription. No bank login.</p>
      <a class="btn" href={STORE_URL} target="_blank" rel="noopener">
        Get the full planner
      </a>
      {open ? (
        <>
          <Field label="Your unlock code" hint="It came with your purchase. It’s checked on this device, with no internet needed.">
            <input type="text" autoCapitalize="off" autoCorrect="off" spellcheck={false} value={code} onInput={(e) => { setCode((e.target as HTMLInputElement).value); setMsg(''); }} />
          </Field>
          {msg && <Note>{msg}</Note>}
          <button type="button" class="btn ghost" onClick={check}>
            Unlock
          </button>
        </>
      ) : (
        <button type="button" class="link" style={{ alignSelf: 'center' }} onClick={() => setOpen(true)}>
          I have a code
        </button>
      )}
    </section>
  );
}

/** Only in the free edition, and only when an endpoint is set. Sends the email address and nothing else. */
export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [msg, setMsg] = useState('');
  if (!IS_FREE || !EMAIL_CAPTURE_URL) return null;

  const send = async (e: Event) => {
    e.preventDefault();
    if (!isEmail(email)) return setMsg('Type your email address, like name@example.com.');
    setState('sending');
    const r = await submitEmail(email);
    if (r === 'ok') setState('done');
    else {
      setState('idle');
      setMsg('That didn’t go through. Check your connection and try again.');
    }
  };

  if (state === 'done') {
    return (
      <p class="card" role="status" data-testid="email-thanks">
        Thank you. Your first email is on its way.
      </p>
    );
  }
  return (
    <form class="card stack" onSubmit={send} aria-label="Email" noValidate>
      <h2 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Get calm emails about getting out of debt</h2>
      <Field label="Your email" hint="Only your email address is sent. Your numbers never leave this device. Unsubscribe any time.">
        <input type="email" inputMode="email" autoComplete="email" value={email} onInput={(e) => { setEmail((e.target as HTMLInputElement).value); setMsg(''); }} />
      </Field>
      {msg && <Note>{msg}</Note>}
      <button type="submit" class="btn ghost" disabled={state === 'sending'}>
        Send me the emails
      </button>
    </form>
  );
}

export { COPY };
