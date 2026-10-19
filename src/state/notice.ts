/** A short message at the top of the screen (for example after opening an unlock link). */
import { signal } from '@preact/signals';

export interface Notice {
  kind: 'unlocked' | 'saved' | 'invalid' | 'info';
  text: string;
}

export const notice = signal<Notice | null>(null);

export function showNotice(kind: Notice['kind'], text: string): void {
  notice.value = { kind, text };
}
