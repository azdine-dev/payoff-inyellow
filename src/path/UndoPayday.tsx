/**
 * Undo the latest paid payday (design canvas boards UndoSheet and UndoConfirm): what was paid, "Change what I paid",
 * "Mark as not paid", then a confirmation with the effect on the debt-free date. Only the latest paid payday opens it.
 */
import { useEffect, useState } from 'preact/hooks';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { shortDate } from '../lib/today';
import { changePaid, markNotPaid, notPaidPreview } from '../state/actions';
import { showNotice } from '../state/notice';
import { act, data, plan, today } from '../state/store';
import { paidFromLog } from '../today/model';
import { Field, NumberInput, Sheet } from '../ui/controls';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "July 2027" */
const monthName = (iso: string) => `${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function UndoPayday({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const nameOf = (id: string) => d.debts.find((x) => x.id === id)?.name ?? '';
  const [step, setStep] = useState<'view' | 'change' | 'confirm'>('view');
  const [amountText, setAmountText] = useState('');
  useEffect(() => {
    if (open) setStep('view');
  }, [open]);
  const preview = open ? notPaidPreview(d) : null;

  return (
    <Sheet
      open={preview !== null}
      onClose={onClose}
      center={step === 'confirm'}
      icon={step === 'confirm' ? <UndoIcon /> : undefined}
      aside={preview && step !== 'confirm' ? `You paid ${formatMoneyAuto(preview.log.total, cur)}` : undefined}
      title={preview ? (step === 'confirm' ? `Mark ${shortDate(preview.log.date, today.value)} as not paid?` : shortDate(preview.log.date, today.value)) : ''}
    >
      {preview && step === 'view' && (
        <>
          <div class="stack pd-lines" style={{ gap: 0 }} role="group" aria-label={`${shortDate(preview.log.date)} details`}>
            {(paidFromLog(d, preview.log.number)?.rows ?? []).map((x) => (
              <div key={x.key} class="row">
                <span>{x.label}</span>
                <b class="num">{formatMoney(x.amount, cur)}</b>
              </div>
            ))}
          </div>
          {preview.log.debtLeft !== undefined && (
            <p class="muted small num" data-testid="debt-left-after">
              Debt left after: {formatMoney(preview.log.debtLeft, cur)}
            </p>
          )}
          <button
            type="button"
            class="btn outline"
            onClick={() => {
              setAmountText(String(preview.log.planMoney));
              setStep('change');
            }}
          >
            Change what I paid
          </button>
          <button type="button" class="btn sage" onClick={() => setStep('confirm')}>
            Mark as not paid
          </button>
          <p class="muted small" style={{ textAlign: 'center' }}>
            Older paydays: undo the later ones first.
          </p>
        </>
      )}
      {preview && step === 'change' && (
        <>
          <Field label="How much went to the plan that payday?" hint="Your bills stay the same. The rest follows the same order.">
            <NumberInput pre={cur.symbol} value={amountText} onInput={setAmountText} label="Money for the plan that payday" />
          </Field>
          <button
            type="button"
            class="btn"
            onClick={async () => {
              const amount = parseAmount(amountText);
              if (amount === null || amount < 0) return;
              onClose();
              await act(async (db, x) => (await changePaid(db, x, amount)).data);
            }}
          >
            Update this payday
          </button>
          <button type="button" class="link" onClick={() => setStep('view')}>
            Back
          </button>
        </>
      )}
      {preview && step === 'confirm' && (
        <>
          <p>
            The {formatMoneyAuto(preview.log.total, cur)} comes off your progress. {shortDate(preview.log.date, today.value)} goes back on Today as your to-do.
          </p>
          <div class="undo-box" data-testid="undo-box">
            {Object.entries(preview.log.snap?.after.debts ?? {})
              .filter(([id, after]) => (preview.log.snap?.before.debts[id]?.[0] ?? after[0]) - after[0] > 0.004)
              .map(([id, after]) => (
                <div key={id} class="row">
                  <span>{nameOf(id)}</span>
                  <b class="num">
                    {formatMoney(after[0], cur, { whole: true })} goes back to {formatMoney(preview.log.snap!.before.debts[id]![0], cur, { whole: true })}
                  </b>
                </div>
              ))}
            <div class="row">
              <span>Debt-free</span>
              <b data-testid="not-paid-line">
                {preview.debtFreeDate
                  ? `${preview.debtFreeDate.slice(0, 7) === r.debtFreeDate?.slice(0, 7) ? 'Still' : 'Moves to'} ${monthName(preview.debtFreeDate)}, if you pay it this week`
                  : 'Moves to more than 20 years from now'}
              </b>
            </div>
          </div>
          <button
            type="button"
            class="btn"
            onClick={async () => {
              const date = shortDate(preview.log.date, today.value);
              onClose();
              await act((db, x) => markNotPaid(db, x));
              showNotice('info', `${date} is not paid now.`);
            }}
          >
            Yes, mark as not paid
          </button>
          <button type="button" class="link" onClick={onClose}>
            Keep it
          </button>
        </>
      )}
    </Sheet>
  );
}
