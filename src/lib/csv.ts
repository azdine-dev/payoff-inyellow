/** CSV export of the plan (Plan tab). Opens in any spreadsheet. */
import type { PaydayStep } from '../engine';

const cell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const cents = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export function planToCsv(rows: readonly PaydayStep[], nameOf: (id: string) => string): string {
  const header = ['Payday', 'Date', 'Minimums', 'Yearly bills', 'Buffer', 'Extra', 'Extra goes to', 'Total to set aside', 'Debt left'];
  const lines = rows.map((r) =>
    [
      r.payday,
      r.date,
      cents(r.minimums),
      cents(r.toYearlyBills),
      cents(r.toBuffer),
      cents(r.extra),
      r.extraGoesTo ? nameOf(r.extraGoesTo) : r.bufferFirst ? 'Buffer first' : '',
      cents(r.totalToSetAside),
      cents(r.debtLeft),
    ]
      .map(cell)
      .join(','),
  );
  return [header.map(cell).join(','), ...lines].join('\r\n') + '\r\n';
}

/** Saves text as a file on the phone or computer. */
export function downloadText(filename: string, text: string, type = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
