/** The countdown on Path: "14 months left" or "1.2 years left". The choice is remembered on this device. */
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
  if (months < 1) return 'Less than a month left';
  if (mode === 'months') return `${months} month${months === 1 ? '' : 's'} left`;
  const years = Math.round((months / 12) * 10) / 10;
  const text = Number.isInteger(years) ? String(years) : years.toFixed(1);
  return `${text} ${years === 1 ? 'year' : 'years'} left`;
}
