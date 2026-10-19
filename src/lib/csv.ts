/** CSV export of the plan (Plan tab). Opens in any spreadsheet. */
import type { PaydayStep } from '../engine';

const cell = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const cents = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export interface CsvRow {
  row: PaydayStep;
  /** Bills due between this payday and the next */
  billsDue: number;
  /** Bills due + yearly bills + buffer + extra */
  total: number;
}

export function planToCsv(rows: readonly CsvRow[], nameOf: (id: string) => string): string {
  const header = ['Payday', 'Date', 'Bills due', 'Yearly bills', 'Buffer', 'Extra', 'Extra goes to', 'Total to set aside', 'Debt left'];
  const lines = rows.map(({ row: r, billsDue, total }) =>
    [
      r.payday,
      r.date,
      cents(billsDue),
      cents(r.toYearlyBills),
      cents(r.toBuffer),
      cents(r.extra),
      r.extraGoesTo ? nameOf(r.extraGoesTo) : r.bufferFirst ? 'Buffer first' : '',
      cents(total),
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
