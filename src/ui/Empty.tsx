/** An empty list: a small picture and one warm line. Ink, line grey and yellow only. */
import type { ComponentChildren } from 'preact';

export type EmptyArt = 'debts' | 'calendar' | 'list' | 'envelope';

function Art({ art }: { art: EmptyArt }) {
  const ink = { stroke: 'var(--ink)', 'stroke-width': 1.8, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  const soft = { stroke: 'var(--line)', 'stroke-width': 3, 'stroke-linecap': 'round' } as const;
  return (
    <svg class="empty-art" viewBox="0 0 96 64" width="96" height="64" aria-hidden="true" focusable="false">
      {art === 'debts' && (
        <>
          <rect x="14" y="14" width="52" height="34" rx="6" {...ink} />
          <rect x="30" y="22" width="52" height="34" rx="6" {...ink} fill="var(--card)" />
          <path d="M38 34h22M38 42h12" {...soft} />
          <rect x="66" y="30" width="10" height="10" rx="3" fill="var(--yellow)" stroke="none" />
        </>
      )}
      {art === 'calendar' && (
        <>
          <rect x="16" y="12" width="64" height="44" rx="7" {...ink} />
          <path d="M16 24h64M34 8v8M62 8v8" {...ink} />
          <path d="M28 34h4M44 34h4M60 34h4M28 45h4M44 45h4" {...soft} />
          <rect x="58" y="41" width="9" height="9" rx="2.5" fill="var(--yellow)" stroke="none" />
        </>
      )}
      {art === 'list' && (
        <>
          <rect x="16" y="12" width="9" height="9" rx="2.5" fill="var(--yellow)" stroke="none" />
          <rect x="16" y="28" width="9" height="9" rx="2.5" {...ink} />
          <rect x="16" y="44" width="9" height="9" rx="2.5" {...ink} />
          <path d="M34 16.5h44M34 32.5h34M34 48.5h40" {...soft} />
        </>
      )}
      {art === 'envelope' && (
        <>
          <rect x="16" y="16" width="64" height="38" rx="6" {...ink} />
          <path d="M18 20l30 20 30-20" {...ink} />
          <circle cx="48" cy="40" r="5" fill="var(--yellow)" stroke="none" />
        </>
      )}
    </svg>
  );
}

export function Empty(props: { art: EmptyArt; line: ComponentChildren; small?: boolean }) {
  return (
    <div class={`empty${props.small ? ' small' : ''}`} data-testid="empty">
      <Art art={props.art} />
      <p class="muted">{props.line}</p>
    </div>
  );
}
