/**
 * Dark mode and text size. The choice is saved with the plan, and mirrored in localStorage so the
 * page can apply it before the first paint (see the small script in index.html).
 */
import type { TextSize, Theme } from '../data/types';

export const TEXT_SCALES: Record<TextSize, number> = { 0: 0.92, 1: 1, 2: 1.15, 3: 1.3 };
export const TEXT_SIZE_LABELS: Record<TextSize, string> = { 0: 'Small', 1: 'Default', 2: 'Large', 3: 'Larger' };
export const STORAGE_KEY = 'piy-appearance';

export function applyAppearance(theme: Theme, textSize: TextSize, root: HTMLElement = document.documentElement): void {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  root.style.setProperty('--text-scale', String(TEXT_SCALES[textSize] ?? 1));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme, textSize }));
  } catch {
    /* private window: the saved setting still applies after load */
  }
}
