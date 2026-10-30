/** The countdown on Path: "14 months to go" or "1.2 years to go". The choice is remembered on this device. */
export type CountdownMode = 'months' | 'years';

const KEY = 'piy.countdown';

export function readCountdownMode(): CountdownMode {
  try {
    return localStorage.getItem(KEY) === 'years' ? 'years' : 'months';
  } catch {
    return 'months';
  }
}

export function saveCountdownMode(mode: CountdownMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // private window or blocked storage: the choice just lasts until the page closes
  }
}

export function countdownText(months: number, mode: CountdownMode): string {
  if (months < 1) return 'Less than a month to go';
  if (mode === 'months') return `${months} month${months === 1 ? '' : 's'} to go`;
  const years = Math.round((months / 12) * 10) / 10;
  const text = Number.isInteger(years) ? String(years) : years.toFixed(1);
  return `${text} ${years === 1 ? 'year' : 'years'} to go`;
}
