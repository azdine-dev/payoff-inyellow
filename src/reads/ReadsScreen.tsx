/**
 * Short reads, as two full screens (design/warm-extras/Reads.html and Read.html): the list, then one read.
 * Each read ends with one action into the app, and a card for the next read.
 */
import { useEffect, useState } from 'preact/hooks';
import { planNeedsHelp } from '../engine';
import { READS, readWords, type Read, type ReadTarget } from '../copy/reads';
import { getReadIds, markReadId } from '../lib/seen';
import { toPlanInput } from '../state/planInput';
import { data, plan, readsFrom, readsId, safetyIntent, tab, today } from '../state/store';
import { CheckIcon, ChevronRight } from '../ui/controls';
import { ReadArt, ReadIcon } from './ReadArt';
import { suggestedRead } from './suggest';

const minutes = (r: Read) => Math.max(1, Math.round(readWords(r) / 200));

const FROM_LABEL: Record<string, string> = { path: 'Path', settings: 'Settings', today: 'Today', debts: 'Debts', safety: 'Safety net' };

/** Where a read's button takes you */
export function goTo(target: ReadTarget) {
  readsId.value = null;
  if (target === 'safety:fund-add') safetyIntent.value = 'fund-add';
  if (target === 'safety:find') safetyIntent.value = 'find';
  tab.value = target.startsWith('safety') ? 'safety' : (target as 'today' | 'debts' | 'settings');
  window.scrollTo(0, 0);
}

/** Open the list from Path or Settings: "‹ Path" brings you back */
export function openReads(from: 'path' | 'settings') {
  readsFrom.value = from;
  readsId.value = null;
  tab.value = 'reads';
  window.scrollTo(0, 0);
}

function Back(props: { label: string; onClick: () => void }) {
  return (
    <button type="button" class="reads-back" onClick={props.onClick}>
      ‹ {props.label}
    </button>
  );
}

export function ReadsScreen() {
  const [done, setDone] = useState<string[]>(getReadIds);
  const id = readsId.value;
  const current = id ? READS.find((r) => r.id === id) : undefined;

  // Opening a read marks it read
  useEffect(() => {
    if (current) setDone(markReadId(current.id));
    window.scrollTo(0, 0);
  }, [current?.id]);

  if (current) {
    const i = READS.findIndex((r) => r.id === current.id);
    const next = READS[(i + 1) % READS.length]!;
    return (
      <main class="screen reads-screen" data-testid="read">
        <Back label="Short reads" onClick={() => (readsId.value = null)} />
        <ReadArt kind={current.art} />
        <p class="label">Short read · {minutes(current)} min</p>
        <h1 class="read-title">{current.title}</h1>
        {current.paragraphs.map((p) => (
          <p key={p} class="read-p">
            {p}
          </p>
        ))}
        {current.callout && (
          <div class="read-callout" data-testid="read-callout">
            <b>{current.callout.lead}</b> {current.callout.text}
          </div>
        )}
        <button
          type="button"
          class="btn"
          data-testid="read-action"
          onClick={() => goTo(current.action.target)}
        >
          {current.action.label}
        </button>
        <button type="button" class="next-read" data-testid="next-read" onClick={() => (readsId.value = next.id)}>
          <span class="stack" style={{ gap: 0, textAlign: 'left' }}>
            <span class="muted small">Next read</span>
            <b>{next.title}</b>
          </span>
          <ChevronRight />
        </button>
        <p class="hand">{current.tagline}</p>
      </main>
    );
  }

  const d = data.value!;
  const needsHelp = planNeedsHelp(toPlanInput(d), plan.value!, d.settings.paycheckAmount).length > 0;
  const suggested = suggestedRead({ d, today: today.value, needsHelp, read: done });
  const from = readsFrom.value;
  return (
    <main class="screen reads-screen reads-list" data-testid="read-screen">
      <header class="reads-head">
        <Back label={FROM_LABEL[from] ?? 'Path'} onClick={() => (tab.value = from)} />
        <h1>Short reads</h1>
        <p class="reads-sub">One minute each. No internet needed.</p>
      </header>
      <ul class="read-list" data-testid="read-list">
        {READS.map((r) => {
          const isRead = done.includes(r.id);
          const isSuggested = suggested === r.id;
          return (
            <li key={r.id}>
              <button type="button" class={`read-item${isSuggested ? ' suggested' : ''}`} data-testid="read-item" data-suggested={isSuggested ? '1' : undefined} onClick={() => (readsId.value = r.id)}>
                <span class="read-tile">
                  <ReadIcon id={r.id} />
                </span>
                <span class="stack" style={{ gap: 0, flex: 1, textAlign: 'left' }}>
                  <b>{r.title}</b>
                  <span class="muted small">
                    {minutes(r)} min
                    {r.meta ? ` · ${r.meta}` : ''}
                    {isSuggested ? ' · suggested for you' : ''}
                  </span>
                </span>
                {isRead ? (
                  <span class="read-check" role="img" aria-label="Read" data-testid="read-check">
                    <CheckIcon />
                  </span>
                ) : (
                  <ChevronRight />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p class="muted small" style={{ textAlign: 'center' }} data-testid="read-count">
        {done.length} of {READS.length} read
      </p>
    </main>
  );
}
