/** CSV of every payment the buyer has made (bills, extras, buffer, yearly bills). Opens in any spreadsheet. */
import type { AppData, PaymentKind } from '../data/types';

const cell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const cents = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

const KIND: Record<PaymentKind, string> = { minimum: 'Bill', extra: 'Extra', buffer: 'Buffer', fund: 'Yearly bill' };

export function paymentsToCsv(data: Pick<AppData, 'payments' | 'debts' | 'funds'>): string {
  const header = ['Date', 'Paid to', 'What', 'Amount', 'Payday number', 'From the plan'];
  const target = (p: AppData['payments'][number]) =>
    p.debtId ? (data.debts.find((d) => d.id === p.debtId)?.name ?? '') : p.fundId ? (data.funds.find((f) => f.id === p.fundId)?.name ?? '') : 'Buffer';
  const lines = [...data.payments]
    .sort((a, b) => a.date.localeCompare(b.date) || a.updatedAt - b.updatedAt)
    .map((p) => [p.date, target(p), KIND[p.kind], cents(p.amount), p.paydayNumber ?? '', p.planned ? 'yes' : 'no'].map(cell).join(','));
  return [header.map(cell).join(','), ...lines].join('\r\n') + '\r\n';
}
