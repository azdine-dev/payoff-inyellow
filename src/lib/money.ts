/** Currency detection and money formatting. Full precision in the engine, rounding only here. */
import { pyRound } from '../engine/pymath';

export interface Currency {
  /** ISO 4217 code when known, e.g. USD */
  code?: string;
  /** What we print, e.g. $ */
  symbol: string;
}

const EUR = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', IN: 'INR', MA: 'MAD', AE: 'AED', SA: 'SAR',
  ZA: 'ZAR', NG: 'NGN', PH: 'PHP', MX: 'MXN', BR: 'BRL', JP: 'JPY', SG: 'SGD', MY: 'MYR', PK: 'PKR',
  EG: 'EGP', TR: 'TRY', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', KE: 'KES', GH: 'GHS',
  ...Object.fromEntries(EUR.map((r) => [r, 'EUR'])),
};

/** Common choices for the currency step. "Other" lets the buyer type any symbol. */
export const CURRENCY_CHOICES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'NZD', 'INR', 'MAD', 'AED', 'ZAR', 'PHP', 'MXN'];

export function symbolFor(code: string): string {
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

export function currencyFromCode(code: string): Currency {
  return { code, symbol: symbolFor(code) };
}

/** From the phone's language/region, e.g. en-US gives USD. Falls back to USD. */
export function detectCurrency(
  languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
): Currency {
  for (const tag of languages) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      const code = region ? REGION_CURRENCY[region] : undefined;
      if (code) return currencyFromCode(code);
    } catch {
      /* ignore bad tags */
    }
  }
  return currencyFromCode('USD');
}

function prefix(symbol: string): string {
  // Letter symbols read better with a space: "DH 150", "CHF 20"
  return /[A-Za-z]$/.test(symbol) ? `${symbol} ` : symbol;
}

/** $1,234.56 (cents) or $1,235 (whole). Rounds like the Sheet (half to even on exact ties). */
export function formatMoney(amount: number, currency: Currency, opts: { whole?: boolean } = {}): string {
  const digits = opts.whole ? 0 : 2;
  const value = pyRound(amount, digits);
  const abs = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${value < 0 ? '-' : ''}${prefix(currency.symbol)}${abs}`;
}

/** Cents if the amount has them, whole units if not: $150 / $107.69 */
export function formatMoneyAuto(amount: number, currency: Currency): string {
  const cents = pyRound(amount, 2);
  return formatMoney(cents, currency, { whole: Number.isInteger(cents) });
}

export const toCents = (x: number) => pyRound(x, 2);

/**
 * Reads what people type: "1,234.56", "1234,56", "$ 500", " 20 ".
 * Returns null when empty or not a number.
 */
export function parseAmount(text: string): number | null {
  let s = text.replace(/[^\d.,-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return null;
  const lastComma = s.lastIndexOf(',');
  if (lastComma !== -1 && !s.includes('.') && s.length - lastComma - 1 <= 2) {
    s = s.slice(0, lastComma).replace(/,/g, '') + '.' + s.slice(lastComma + 1); // decimal comma
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
