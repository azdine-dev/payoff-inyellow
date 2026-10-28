/** Two printable pages: "This payday" (what to move, with due dates and tick boxes) and "My debts". Shown only when printing. */
import type { AppData } from '../data/types';
import type { PlanResult } from '../engine';
import { COPY } from '../lib/copy';
import { formatMoney, formatMoneyAuto } from '../lib/money';
import { shortDate } from '../lib/today';
import type { BillsWindow } from '../state/billsDue';
import { mergedRows } from '../today/model';

export function PrintPayday(props: { d: AppData; r: PlanResult; bills: BillsWindow; today: string }) {
  const { d, r, bills, today } = props;
  const cur = d.settings.currency;
  const row = r.rows[0];
  if (!row) return null;
  const { rows, total, noDueDay } = mergedRows(row, d, bills);
  const dueOf = (debtId?: string) => bills.due.find((b) => b.debtId === debtId)?.due;
  return (
    <section class="print-only" aria-hidden="true" data-testid="print-payday">
      <h1>This payday · {shortDate(row.date, today)}</h1>
      <p>Move {formatMoneyAuto(total, cur)}. Tick each line when it is done.</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }}>Done</th>
            <th>What</th>
            <th>Due</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.key}>
              <td>
                <span class="tick" />
              </td>
              <td>
                {x.title}
                {x.kind === 'debt' && x.sub.startsWith('Bill') ? <span class="print-sub"> · {x.sub.split(' · ')[0]}</span> : x.kind === 'debt' ? <span class="print-sub"> · {x.sub}</span> : null}
              </td>
              <td>{dueOf(x.debtId) ? shortDate(dueOf(x.debtId)!, today) : ''}</td>
              <td style={{ textAlign: 'right' }}>{formatMoney(x.amount, cur)}</td>
            </tr>
          ))}
          <tr>
            <td />
            <td>
              <b>Total</b>
            </td>
            <td />
            <td style={{ textAlign: 'right' }}>
              <b>{formatMoney(total, cur)}</b>
            </td>
          </tr>
        </tbody>
      </table>
      {noDueDay.length > 0 && <p class="print-sub">Not counted yet, no due day: {noDueDay.map((x) => x.name).join(', ')}.</p>}
      <p class="print-sub">{COPY.disclaimer}</p>
    </section>
  );
}

export function PrintDebts(props: { d: AppData; r: PlanResult; today: string }) {
  const { d, r, today } = props;
  const cur = d.settings.currency;
  const rank = new Map(r.order.map((id, i) => [id, i]));
  const active = d.debts.filter((x) => x.status === 'active').sort((a, b) => (rank.get(a.id) ?? 1e6) - (rank.get(b.id) ?? 1e6));
  const paid = d.debts.filter((x) => x.status === 'paid');
  const owed = active.reduce((sum, x) => sum + x.balance, 0);
  return (
    <section class="print-only" aria-hidden="true" data-testid="print-debts">
      <h1>My debts · PaidInYellow</h1>
      <p>In the order you pay them. {formatMoney(owed, cur, { whole: true })} owed on {shortDate(today, today)}.</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Debt</th>
            <th style={{ textAlign: 'right' }}>Balance</th>
            <th style={{ textAlign: 'right' }}>Rate</th>
            <th style={{ textAlign: 'right' }}>Minimum</th>
            <th>Due day</th>
            <th>Gone by</th>
          </tr>
        </thead>
        <tbody>
          {active.map((x, i) => (
            <tr key={x.id}>
              <td>{i + 1}</td>
              <td>
                {x.name}
                {[x.type, x.lender].filter(Boolean).length > 0 && <span class="print-sub"> · {[x.type, x.lender].filter(Boolean).join(' · ')}</span>}
                {x.notes && <div class="print-sub">{x.notes}</div>}
              </td>
              <td style={{ textAlign: 'right' }}>{formatMoney(x.balance, cur)}</td>
              <td style={{ textAlign: 'right' }}>{x.apr}%</td>
              <td style={{ textAlign: 'right' }}>{x.minPending ? '' : formatMoney(x.minMonthly, cur)}</td>
              <td>{x.dueDay ?? ''}</td>
              <td>{r.paidOff[x.id] ? shortDate(r.paidOff[x.id]!, today) : ''}</td>
            </tr>
          ))}
          {paid.map((x) => (
            <tr key={x.id}>
              <td />
              <td>
                {x.name} <span class="print-sub">· PAID</span>
              </td>
              <td colSpan={5} />
            </tr>
          ))}
        </tbody>
      </table>
      <p class="print-sub">{COPY.disclaimer}</p>
    </section>
  );
}
