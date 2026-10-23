/**
 * Path: "When am I done, and how far have I come?" Plan and Progress used to repeat each other (both showed
 * the paydays and the date), so they are one screen now. For this step the two old screens are the two
 * views of it; the redesigned layout (ux-v2.md section 5) replaces them in a later step.
 */
import { signal } from '@preact/signals';
import { Plan } from '../plan/Plan';
import { Progress } from '../progress/Progress';
import { StatusLine } from '../ui/StatusLine';

export type PathView = 'progress' | 'plan';
export const pathView = signal<PathView>('progress');

const VIEWS: { id: PathView; label: string }[] = [
  { id: 'progress', label: 'Progress' },
  { id: 'plan', label: 'Plan' },
];

export function Path() {
  return (
    <main class="screen with-tabs">
      <h1>Your path</h1>
      <StatusLine />
      <div class="row" style={{ justifyContent: 'flex-start', gap: 8 }} role="group" aria-label="Path view">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" class="pill plain chip" aria-pressed={pathView.value === v.id} style={{ minHeight: 44, cursor: 'pointer' }} onClick={() => (pathView.value = v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {pathView.value === 'progress' ? <Progress /> : <Plan />}
    </main>
  );
}
