/** "How we got this": the plain math behind the date and the first step, in one sheet. */
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { data, plan } from '../state/store';
import { methodReason } from '../today/model';
import { Sheet } from '../ui/controls';

export function HowWeGotThis(props: { open: boolean; onClose: () => void }) {
  const d = data.value;
  const r = plan.value;
  if (!props.open || !d || !r || !r.rows[0]) return <Sheet open={false} onClose={props.onClose} title="How we got this">{null}</Sheet>;
  const s = d.settings;
  const cur = s.currency;
  const row = r.rows[0];
  const active = d.debts.filter((x) => x.status === 'active');
  const monthly = active.reduce((sum, x) => sum + x.minMonthly, 0);
  const minimums = row.debts.reduce((sum, x) => sum + x.minimum, 0);
  const extra = row.debts.reduce((sum, x) => sum + x.extra, 0);
  const yearly = d.funds.reduce((sum, f) => sum + f.perYear, 0);
  const focus = row.extraGoesTo ? d.debts.find((x) => x.id === row.extraGoesTo)?.name : null;

  return (
    <Sheet open onClose={props.onClose} title="How we got this">
      <div class="stack" style={{ gap: 10 }} data-testid="how-we-got-this">
        <p class="muted small">The math, with your numbers. Nothing is hidden.</p>
        <p>
          <b>Your bills:</b> {formatMoneyAuto(monthly, cur)} a month in all. Each one is paid on the payday before its due day, so some paydays have more bills than others. This payday: {formatMoney(minimums, cur)}.
        </p>
        {yearly > 0 && (
          <p>
            <b>Yearly bills:</b> {formatMoneyAuto(yearly, cur)} a year, so {formatMoney(row.toYearlyBills, cur)} each payday.
          </p>
        )}
        <p>
          <b>Buffer:</b> {formatMoney(row.toBuffer, cur)} this payday. It comes first, until it reaches {formatMoneyAuto(s.bufferGoal, cur)}. You have {formatMoneyAuto(d.buffer.amount, cur)} now.
        </p>
        <p>
          <b>Extra for debts:</b> {formatMoney(extra, cur)} this payday{focus ? `, all to ${focus}` : row.bufferFirst ? '. The buffer takes it first' : ''}.
        </p>
        <p>
          <b>Order:</b> {methodReason(s.method)}
        </p>
        <p>
          <b>The date:</b> each payday we add a little interest to every debt, take off the bills that fall due before the next payday and your extra, and move on. The date is when the last balance reaches zero. It changes if your numbers change.
        </p>
        <button type="button" class="btn" onClick={props.onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
