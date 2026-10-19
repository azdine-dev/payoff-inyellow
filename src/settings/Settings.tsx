/** Settings: plan basics, backup, calendar, appearance, install, unlock code, help. */
import { useState } from 'preact/hooks';
import { buildBackup, backupFilename } from '../data/backup';
import { eraseEverything } from '../data/erase';
import type { TextSize, Theme } from '../data/types';
import { FREQUENCIES, otherPaydayFrom, twiceDays, twiceFromSchedule, twiceNotes, type TwicePair } from '../setup/draft';
import { TwicePicker } from '../setup/TwicePicker';
import { downloadText } from '../lib/csv';
import { buildIcs } from '../lib/ics';
import { COPY } from '../lib/copy';
import { HARDSHIP_SCRIPT_URL, SUPPORT_EMAIL, VIDEO_URL } from '../lib/config';
import { cleanCode, verifyCode } from '../lib/license';
import { CURRENCY_CHOICES, currencyFromCode, formatMoney, parseAmount, symbolFor } from '../lib/money';
import { TEXT_SIZE_LABELS } from '../lib/appearance';
import { shortDate, timeLabel, WEEKDAYS } from '../lib/today';
import { setBufferGoal, setPaycheck } from '../state/moneyActions';
import { nextPaydayISO } from '../state/planInput';
import { changeSchedule, clearLicense, markBackedUp, saveLicense, setAppearance, setCurrency, setExtraPerPayday, setIfThen } from '../state/settingsActions';
import { act, applyUpdate, data, editSeed, getDB, installPrompt, isInstalled, licenseState, tab, today, updateReady, view } from '../state/store';
import { Choice, Field, Note, NumberInput, Sheet } from '../ui/controls';
import { FAQ, INSTALL_HELP } from './faq';
import { RestoreButton } from './Restore';
import { SyncSection } from './SyncSection';
import { syncOn } from '../sync/controller';

type Edit = 'currency' | 'schedule' | 'extra' | 'goal' | 'paycheck' | 'ifthen' | null;

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'Match my phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Settings() {
  const d = data.value!;
  const s = d.settings;
  const cur = s.currency;
  const [edit, setEdit] = useState<Edit>(null);
  const [text, setText] = useState('');
  const [freq, setFreq] = useState(s.frequency);
  const [date, setDate] = useState('');
  const [twice, setTwice] = useState<{ pair: TwicePair; a: string; b: string }>({ pair: '', a: '', b: '' });
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [codeMsg, setCodeMsg] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [currencyCode, setCurrencyCode] = useState(cur.code ?? '');
  const [erasing, setErasing] = useState(false);
  const [alsoCode, setAlsoCode] = useState(false);
  const [day, setDay] = useState(s.ifThen.day);
  const [time, setTime] = useState(s.ifThen.time);

  const close = () => {
    setEdit(null);
    setMsg('');
  };

  const open = (which: Exclude<Edit, null>) => {
    setMsg('');
    if (which === 'extra') setText(String(s.extraPerPayday));
    if (which === 'goal') setText(String(s.bufferGoal));
    if (which === 'paycheck') setText(s.paycheckAmount ? String(s.paycheckAmount) : '');
    if (which === 'schedule') {
      setFreq(s.frequency);
      setDate(nextPaydayISO(s));
      setTwice(s.frequency === 'twice-monthly' ? twiceFromSchedule(nextPaydayISO(s), s.otherPayday) : { pair: '', a: '', b: '' });
    }
    if (which === 'currency') {
      setCurrencyCode(cur.code ?? '');
      setText(cur.code ? '' : cur.symbol);
    }
    if (which === 'ifthen') {
      setDay(s.ifThen.day);
      setTime(s.ifThen.time);
    }
    setEdit(which);
  };

  const save = async () => {
    const amount = parseAmount(text);
    if (edit === 'extra' || edit === 'goal') {
      if (amount === null || amount < 0) return setMsg('Type an amount, even 0.');
      await act((db, x) => (edit === 'extra' ? setExtraPerPayday(db, x, amount) : setBufferGoal(db, x, amount)));
    } else if (edit === 'paycheck') {
      if (text.trim() && (amount === null || amount < 0)) return setMsg('Type an amount, like 1400, or leave it empty.');
      await act((db, x) => setPaycheck(db, x, text.trim() ? amount : null));
    } else if (edit === 'schedule') {
      if (!date || date < today.value) return setMsg('Pick your next payday: today or a day after today.');
      const notes = twiceNotes(freq, date, twice.pair, twice.a, twice.b);
      if (notes.length) return setMsg(notes[0]!);
      const other = freq === 'twice-monthly' ? otherPaydayFrom(date, twiceDays(twice.pair, twice.a, twice.b)) : null;
      await act((db, x) => changeSchedule(db, x, freq, date, other));
    } else if (edit === 'currency') {
      const c = currencyCode ? currencyFromCode(currencyCode) : { symbol: text.trim() };
      if (!c.symbol) return setMsg('Type the symbol you use for money, like $ or €.');
      await act((db, x) => setCurrency(db, x, c));
    } else if (edit === 'ifthen') {
      await act((db, x) => setIfThen(db, x, day, time || '20:00'));
    }
    close();
  };

  const saveBackup = async () => {
    const db = await getDB();
    const file = await buildBackup(db);
    downloadText(backupFilename(), JSON.stringify(file, null, 1), 'application/json');
    await act((dbx, x) => markBackedUp(dbx, x));
    setBackupMsg('Saved. Keep the file somewhere safe, like your email or a cloud folder.');
  };

  const startOver = async () => {
    const keep = alsoCode ? null : { theme: s.theme, textSize: s.textSize, license: s.license };
    await eraseEverything(await getDB(), keep);
    editSeed.value = null;
    data.value = null;
    tab.value = 'today';
    view.value = 'setup';
  };

  const exportCalendar = () => {
    downloadText('paidinyellow-calendar.ics', buildIcs(d, today.value), 'text/calendar');
  };

  const checkCode = async () => {
    const r = await verifyCode(code);
    if (r.ok) {
      await act((db, x) => saveLicense(db, x, cleanCode(code)));
      setCode('');
      setCodeMsg('');
    } else {
      setCodeMsg(r.reason === 'empty' ? 'Paste your unlock code first.' : 'This code doesn’t look right. Check that you copied all of it.');
    }
  };

  const theme = (v: Theme) => act((db, x) => setAppearance(db, x, v, x.settings.textSize));
  const size = (v: TextSize) => act((db, x) => setAppearance(db, x, x.settings.theme, v));
  const lastBackup = s.lastBackupAt ? new Date(s.lastBackupAt).toISOString().slice(0, 10) : null;
  const ifThenText = s.ifThen.day === 'payday' ? `Every payday at ${timeLabel(s.ifThen.time)}` : `${s.ifThen.day} at ${timeLabel(s.ifThen.time)}`;
  const freqLabel = FREQUENCIES.find((f) => f.value === s.frequency)?.label ?? '';

  const row = (label: string, value: string, which: Exclude<Edit, null>) => (
    <div class="row" style={{ borderTop: '1px dashed var(--line)', minHeight: 52 }}>
      <span>
        <span class="muted small" style={{ display: 'block' }}>
          {label}
        </span>
        <span class="num" style={{ fontWeight: 600 }}>
          {value}
        </span>
      </span>
      <button type="button" class="link small" aria-label={`Change ${label}`} onClick={() => open(which)}>
        Change
      </button>
    </div>
  );

  return (
    <main class="screen with-tabs">
      <div class="row">
        <h1>Settings</h1>
        <button type="button" class="link" onClick={() => (tab.value = 'today')}>
          Back to Today
        </button>
      </div>

      {updateReady.value && (
        <section class="card soft row" role="status">
          <span>An update is ready.</span>
          <button type="button" class="link" onClick={applyUpdate}>
            Restart now
          </button>
        </section>
      )}

      <section class="card" aria-labelledby="set-plan">
        <h2 id="set-plan">Your plan</h2>
        {row('Pay schedule', `${freqLabel}, next ${shortDate(nextPaydayISO(s))}`, 'schedule')}
        {row('Money for the plan each payday', formatMoney(s.extraPerPayday, cur, { whole: Number.isInteger(s.extraPerPayday) }), 'extra')}
        {row('Buffer goal', formatMoney(s.bufferGoal, cur, { whole: Number.isInteger(s.bufferGoal) }), 'goal')}
        {row('Usual paycheck', s.paycheckAmount ? formatMoney(s.paycheckAmount, cur, { whole: Number.isInteger(s.paycheckAmount) }) : 'Not set', 'paycheck')}
        {row('Currency', cur.code ? `${cur.code} (${cur.symbol})` : cur.symbol, 'currency')}
        {row('Payday check', ifThenText, 'ifthen')}
        <p class="muted small" style={{ marginTop: 8 }}>
          Your payoff order is on the{' '}
          <button type="button" class="link small" onClick={() => (tab.value = 'plan')}>
            Plan tab
          </button>
          .
        </p>
      </section>

      <section class="card stack" aria-labelledby="set-backup">
        <h2 id="set-backup">Backup</h2>
        <p class="muted">Your plan lives only on this device. A backup file lets you restore it on this phone or a new one.</p>
        <p class="small" data-testid="last-backup">
          {lastBackup ? `Last saved ${shortDate(lastBackup)}.` : 'You haven’t saved a backup yet.'}
        </p>
        <button type="button" class="btn" onClick={saveBackup}>
          Save a backup
        </button>
        {backupMsg && <Note>{backupMsg}</Note>}
        <RestoreButton />
      </section>

      {licenseState.value === 'unlocked' ? (
        <section class="card stack" aria-labelledby="set-cal">
          <h2 id="set-cal">Calendar</h2>
          <p class="muted">
            A calendar file with your paydays, your payday check at {timeLabel(s.ifThen.time)}, and each due date with a reminder 3 days before. It covers the next 12 months.
          </p>
          <button type="button" class="btn ghost" onClick={exportCalendar}>
            Add to my calendar
          </button>
          <p class="muted small">Events don’t change after you add them. Add the file again after big changes to your plan.</p>
        </section>
      ) : (
        <section class="card stack" aria-labelledby="set-cal">
          <h2 id="set-cal">Calendar</h2>
          <p class="muted">The calendar file with your paydays and due dates comes with the full planner.</p>
        </section>
      )}

      <section class="card stack" aria-labelledby="set-look">
        <h2 id="set-look">Appearance</h2>
        <div class="stack" role="radiogroup" aria-label="Theme" style={{ gap: 8 }}>
          {THEMES.map((t) => (
            <Choice key={t.value} checked={s.theme === t.value} onSelect={() => theme(t.value)} title={t.label} />
          ))}
        </div>
        <p class="label" style={{ marginTop: 6 }}>
          Text size
        </p>
        <div class="stack" role="radiogroup" aria-label="Text size" style={{ gap: 8 }}>
          {([0, 1, 2, 3] as TextSize[]).map((v) => (
            <Choice key={v} checked={s.textSize === v} onSelect={() => size(v)} title={TEXT_SIZE_LABELS[v]} />
          ))}
        </div>
      </section>

      <section class="card stack" aria-labelledby="set-install">
        <h2 id="set-install">Put it on your phone</h2>
        {isInstalled() ? (
          <p>It’s on your Home Screen. It opens like any other app and works without internet.</p>
        ) : (
          <>
            {installPrompt.value && (
              <button
                type="button"
                class="btn"
                onClick={async () => {
                  await installPrompt.value!.prompt();
                  installPrompt.value = null;
                }}
              >
                Install the app
              </button>
            )}
            <p>
              <b>iPhone:</b> {INSTALL_HELP.iphone}
            </p>
            <p>
              <b>Android:</b> {INSTALL_HELP.android}
            </p>
          </>
        )}
        <p class="muted small">{INSTALL_HELP.why}</p>
      </section>

      <section class="card stack" aria-labelledby="set-code">
        <h2 id="set-code">Unlock code</h2>
        {s.license ? (
          <>
            <p data-testid="unlocked">Unlocked. Thank you.</p>
            <button type="button" class="link small" style={{ alignSelf: 'flex-start' }} onClick={() => act((db, x) => clearLicense(db, x))}>
              Remove the code from this phone
            </button>
          </>
        ) : (
          <>
            <p class="muted">Your code came with your purchase. Paste it here. It’s checked on this phone, with no internet needed.</p>
            <Field label="Code">
              <input type="text" autoCapitalize="off" autoCorrect="off" spellcheck={false} value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
            </Field>
            {codeMsg && <Note>{codeMsg}</Note>}
            <button type="button" class="btn ghost" onClick={checkCode}>
              Unlock
            </button>
          </>
        )}
      </section>

      <SyncSection />

      <section class="card stack" aria-labelledby="set-help">
        <h2 id="set-help">Help</h2>
        <div>
          {FAQ.map((f) => (
            <details key={f.q} class="faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
        <p>
          Still stuck? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. A screenshot helps.
        </p>
        {VIDEO_URL && (
          <a href={VIDEO_URL} target="_blank" rel="noopener">
            {COPY.watchVideo}
          </a>
        )}
        {HARDSHIP_SCRIPT_URL && (
          <a href={HARDSHIP_SCRIPT_URL} target="_blank" rel="noopener">
            What to say when you call your lenders
          </a>
        )}
      </section>

      <section class="card stack" aria-labelledby="set-over">
        <h2 id="set-over">Start over</h2>
        <p class="muted">Erase your plan from this phone and begin again with a clean setup.</p>
        <button type="button" class="btn ghost" onClick={() => { setAlsoCode(false); setErasing(true); }}>
          Erase everything and start over
        </button>
      </section>

      <section class="card stack" aria-labelledby="set-about">
        <h2 id="set-about">About</h2>
        <p>{syncOn.value ? COPY.privacySynced : COPY.privacy}</p>
        <p class="muted">{COPY.disclaimer}</p>
        <p class="muted small">PaidInYellow · one paycheck at a time</p>
      </section>

      <Sheet open={erasing} onClose={() => setErasing(false)} title="Erase everything?">
        <p>
          This erases your debts, paydays, payments, buffer and yearly bills from this phone. It can’t be undone.
        </p>
        <p class="muted">If you might want your plan back, save a backup first. It takes a second.</p>
        <button type="button" class="btn ghost" onClick={saveBackup}>
          Save a backup first
        </button>
        {backupMsg && <Note>{backupMsg}</Note>}
        {s.license && (
          <label class="row" style={{ justifyContent: 'flex-start', minHeight: 44 }}>
            <input type="checkbox" checked={alsoCode} onChange={(e) => setAlsoCode((e.target as HTMLInputElement).checked)} style={{ width: 22, height: 22 }} />
            <span>Also remove my unlock code from this phone</span>
          </label>
        )}
        <button type="button" class="btn" onClick={startOver}>
          Yes, erase everything
        </button>
        <button type="button" class="link" onClick={() => setErasing(false)}>
          Cancel
        </button>
      </Sheet>

      <Sheet open={edit === 'schedule'} onClose={close} title="Pay schedule">
        <div class="stack" role="radiogroup" aria-label="How often you get paid" style={{ gap: 8 }}>
          {FREQUENCIES.map((f) => (
            <Choice key={f.value} checked={freq === f.value} onSelect={() => setFreq(f.value)} title={f.label} />
          ))}
        </div>
        {freq === 'twice-monthly' && (
          <TwicePicker
            pair={twice.pair}
            a={twice.a}
            b={twice.b}
            onChange={(p) => setTwice({ pair: p.twicePair ?? twice.pair, a: p.twiceA ?? twice.a, b: p.twiceB ?? twice.b })}
          />
        )}
        <Field label="Your next payday" hint="Your history stays. Planned one-off money keeps its dates.">
          <input type="date" min={today.value} value={date} onInput={(e) => setDate((e.target as HTMLInputElement).value)} />
        </Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>
          Save
        </button>
        <button type="button" class="link" onClick={close}>
          Cancel
        </button>
      </Sheet>

      <Sheet open={edit === 'extra' || edit === 'goal' || edit === 'paycheck'} onClose={close} title={edit === 'extra' ? 'Money for the plan' : edit === 'goal' ? 'Buffer goal' : 'Usual paycheck'}>
        <Field
          label="Amount"
          hint={edit === 'extra' ? COPY.extraHint : edit === 'paycheck' ? 'Stays on this phone. Leave it empty to remove it.' : undefined}
        >
          <NumberInput pre={cur.symbol} value={text} onInput={setText} label="Amount" />
        </Field>
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>
          Save
        </button>
        <button type="button" class="link" onClick={close}>
          Cancel
        </button>
      </Sheet>

      <Sheet open={edit === 'currency'} onClose={close} title="Currency">
        <Field label="Currency">
          <select
            value={currencyCode}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setCurrencyCode(v);
              setText(v ? symbolFor(v) : '');
            }}
          >
            {currencyCode && !CURRENCY_CHOICES.includes(currencyCode) && <option value={currencyCode}>{currencyCode}</option>}
            {CURRENCY_CHOICES.map((c) => (
              <option key={c} value={c}>
                {c} ({symbolFor(c)})
              </option>
            ))}
            <option value="">Other: type my own symbol</option>
          </select>
        </Field>
        {currencyCode === '' && (
          <Field label="Your symbol">
            <input type="text" maxLength={5} value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
          </Field>
        )}
        {msg && <Note>{msg}</Note>}
        <button type="button" class="btn" onClick={save}>
          Save
        </button>
        <button type="button" class="link" onClick={close}>
          Cancel
        </button>
      </Sheet>

      <Sheet open={edit === 'ifthen'} onClose={close} title="Payday check">
        <div class="grid-2">
          <Field label="When I get paid on">
            <select value={day} onChange={(e) => setDay((e.target as HTMLSelectElement).value)}>
              <option value="payday">payday</option>
              {WEEKDAYS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </Field>
          <Field label="I open PaidInYellow at">
            <input type="time" value={time} onInput={(e) => setTime((e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        <button type="button" class="btn" onClick={save}>
          Save
        </button>
        <button type="button" class="link" onClick={close}>
          Cancel
        </button>
      </Sheet>
    </main>
  );
}
