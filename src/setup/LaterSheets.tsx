/**
 * "Do these later": the things that used to be setup steps. Each is a small sheet, opened from a chip on the
 * result screen or from the checklist card on Today. Nothing here is needed for the debt-free date.
 */
import { useEffect, useState } from 'preact/hooks';
import type { AppData } from '../data/types';
import { downloadText } from '../lib/csv';
import { buildIcs } from '../lib/ics';
import { parseAmount } from '../lib/money';
import { WEEKDAYS } from '../lib/today';
import { editDebt } from '../state/debtActions';
import { addFund } from '../state/moneyActions';
import { markLater, setIfThen } from '../state/settingsActions';
import { act, data, today } from '../state/store';
import { Field, Note, NumberInput, Sheet } from '../ui/controls';
import { MONTH_CHOICES } from './draft';
import { ifThenLine } from './ifThenLine';

/** Which of the three "later" items are done. Backup is done once a backup file was saved. */
export function laterStatus(d: Pick<AppData, 'funds' | 'settings'>): { yearly: boolean; reminder: boolean; backup: boolean } {
  return {
    yearly: d.funds.length > 0 || Boolean(d.settings.later?.yearly),
    reminder: Boolean(d.settings.later?.reminder),
    backup: d.settings.lastBackupAt !== null,
  };
}

export const LATER_LABELS = { yearly: 'Yearly bills', reminder: 'Payday reminder', backup: 'Save a backup' } as const;
export type LaterKey = keyof typeof LATER_LABELS;

const IDEAS = ['Car repairs', 'Gifts and holidays', 'Insurance renewals', 'School'];

export function YearlyBillsSheet(props: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('Any time');
  const [note, setNote] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  useEffect(() => {
    if (props.open) {
      setName('');
      setAmount('');
      setMonth('Any time');
      setNote('');
      setAdded([]);
    }
  }, [props.open]);
  const cur = data.value?.settings.currency;

  const save = async () => {
    const perYear = parseAmount(amount);
    if (perYear === null || perYear <= 0) return setNote('Add how much it costs in a year, like 600.');
    const label = name.trim() || 'Yearly bill';
    await act((db, x) => addFund(db, x, { name: label, perYear, month }));
    await act((db, x) => markLater(db, x, 'yearly'));
    setAdded([...added, label]);
    setName('');
    setAmount('');
    setMonth('Any time');
    setNote('');
  };

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Yearly bills">
      <p class="muted">Bills you know are coming, just not every month. A little each payday means they don’t land on a card.</p>
      <div class="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }}>
        {IDEAS.filter((i) => !added.includes(i)).map((idea) => (
          <button key={idea} type="button" class="pill plain" style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => setName(idea)}>
            + {idea}
          </button>
        ))}
      </div>
      <Field label="Name">
        <input type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </Field>
      <div class="grid-2">
        <Field label="Cost per year">
          <NumberInput pre={cur?.symbol} value={amount} onInput={setAmount} label="Cost per year" />
        </Field>
        <Field label="Needed in">
          <select value={month} onChange={(e) => setMonth((e.target as HTMLSelectElement).value)}>
            {MONTH_CHOICES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      </div>
      {note && <Note>{note}</Note>}
      {added.length > 0 && <p role="status">Added: {added.join(', ')}.</p>}
      <button type="button" class="btn" onClick={save}>
        Add this bill
      </button>
      <button type="button" class="btn ghost" onClick={props.onClose}>
        Done
      </button>
      {added.length === 0 && (
        <button
          type="button"
          class="link"
          onClick={async () => {
            await act((db, x) => markLater(db, x, 'yearly'));
            props.onClose();
          }}
        >
          I have no yearly bills
        </button>
      )}
    </Sheet>
  );
}

export function ReminderSheet(props: { open: boolean; onClose: () => void }) {
  const d = data.value;
  const [day, setDay] = useState('payday');
  const [time, setTime] = useState('20:00');
  useEffect(() => {
    if (props.open && d) {
      setDay(d.settings.ifThen.day);
      setTime(d.settings.ifThen.time);
    }
  }, [props.open]);
  if (!d) return null;

  const save = async () => {
    await act((db, x) => setIfThen(db, x, day, time || '20:00'));
    await act((db, x) => markLater(db, x, 'reminder'));
    props.onClose();
  };

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Payday reminder">
      <p class="muted">People who decide when and where they’ll act follow through more often.</p>
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
      <p class="card soft" style={{ margin: 0 }}>
        {ifThenLine(day, time)}
      </p>
      <button type="button" class="btn" onClick={save}>
        Save my reminder
      </button>
      <button type="button" class="btn ghost" onClick={() => downloadText('paidinyellow-calendar.ics', buildIcs(d, today.value), 'text/calendar')}>
        Add paydays to my calendar
      </button>
      <button type="button" class="link" onClick={props.onClose}>
        Not now
      </button>
    </Sheet>
  );
}

/** "Add Visa's rate": the debt was set up with 24% because the rate was left empty. */
export function RateSheet(props: { debtId: string | null; onClose: () => void }) {
  const debt = data.value?.debts.find((x) => x.id === props.debtId);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    setText('');
    setNote('');
  }, [props.debtId]);

  const save = async () => {
    const apr = parseAmount(text);
    if (!debt || apr === null || apr < 0 || apr > 100) return setNote('Type the rate from your statement, like 22.9. Type 0 if there is none.');
    await act((db, x) =>
      editDebt(db, x, debt.id, { name: debt.name, type: debt.type, balance: debt.balance, apr, rateMissing: false, minMonthly: debt.minMonthly, dueDay: debt.dueDay, autopay: debt.autopay }),
    );
    props.onClose();
  };

  return (
    <Sheet open={debt !== undefined} onClose={props.onClose} title={`${debt?.name ?? ''} rate`}>
      <p class="muted">We used 24% for now. The real rate makes your date more exact.</p>
      <Field label="Interest rate" hint="Example: 22.9. It’s on your statement as APR.">
        <NumberInput post="%" value={text} onInput={setText} label="Interest rate" />
      </Field>
      {note && <Note>{note}</Note>}
      <button type="button" class="btn" onClick={save}>
        Save
      </button>
      <button type="button" class="link" onClick={props.onClose}>
        Not now
      </button>
    </Sheet>
  );
}
