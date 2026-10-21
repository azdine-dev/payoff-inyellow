/** A short message at the top of the screen (for example after opening an unlock link). */
import { signal } from '@preact/signals';

export interface Notice {
  kind: 'unlocked' | 'saved' | 'invalid' | 'info';
  text: string;
}

export const notice = signal<Notice | null>(null);

let timer: ReturnType<typeof setTimeout> | undefined;

/** Shows a message, and takes it away by itself (a refusal stays a little longer so it can be read). */
export function showNotice(kind: Notice['kind'], text: string): void {
  notice.value = { kind, text };
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (notice.peek()?.text === text) notice.value = null;
  }, kind === 'invalid' ? 9000 : 5000);
}
