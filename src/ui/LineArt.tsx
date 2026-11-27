/**
 * Line art in the scene's style: ink strokes with round ends, soft line-grey marks, sage fills. Inline SVG, so it works
 * offline, and always aria-hidden: the words next to it say the same thing.
 * - LineIcon / TypeTag: one small icon per line type (bill, yearly, buffer, extra) in payday cards and lists.
 * - LineIllustration: nothing due, debt-free, and the four Find money groups.
 */
import type { ComponentChildren } from 'preact';

export type LineKind = 'bill' | 'yearly' | 'buffer' | 'extra';

const KIND_OF_LABEL: Record<string, LineKind> = { Bill: 'bill', Yearly: 'yearly', Buffer: 'buffer', Extra: 'extra' };

export function LineIcon({ kind, size = 13 }: { kind: LineKind; size?: number }) {
  return (
    <svg class="line-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-kind={kind}>
      {kind === 'bill' && <path d="M6.5 3h11v18l-2.75-1.8L12 21l-2.75-1.8L6.5 21zM9.5 8h5M9.5 12h5" />}
      {kind === 'yearly' && <path d="M4.5 6h15v14h-15zM4.5 10.5h15M8.5 3.5v4M15.5 3.5v4M9 15h2" />}
      {kind === 'buffer' && <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />}
      {kind === 'extra' && <path d="M6 21V4M6 4h11l-2 3.5 2 3.5H6" />}
    </svg>
  );
}

/** A tag with its line icon in front: "Bill", "Extra", "Buffer", "Yearly". Other tags stay words only. */
export function TypeTag({ label, children }: { label: string; children?: ComponentChildren }) {
  const kind = KIND_OF_LABEL[label];
  return (
    <span class={`tag${kind ? ' type-tag' : ''}`} data-kind={kind}>
      {kind && <LineIcon kind={kind} />}
      {children ?? label}
    </span>
  );
}

export type IllustrationKind = 'nothing-due' | 'debt-free' | 'cut' | 'sell' | 'earn' | 'lower';

const ink = { stroke: 'var(--ink)', 'stroke-width': 1.8, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const soft = { stroke: 'var(--line)', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' } as const;

/** A small line picture, 96 x 64, standing on a soft ground line like the scene */
export function LineIllustration({ art, width = 96 }: { art: IllustrationKind; width?: number }) {
  return (
    <svg class="line-art" viewBox="0 0 96 64" width={width} height={(width * 64) / 96} aria-hidden="true" focusable="false" data-art={art}>
      <path d="M10 56h76" {...soft} />
      {art === 'nothing-due' && (
        <>
          {/* a calendar page with a quiet check, and a sprig: nothing to do */}
          <rect x="20" y="12" width="42" height="40" rx="6" {...ink} fill="var(--card)" />
          <path d="M20 22h42M30 8v8M52 8v8" {...ink} />
          <path d="M32 37l6 6 12-12" {...ink} />
          <path d="M74 56c0-10 2-16 10-22-1 9-4 15-10 22zM74 56c-1-6-4-10-9-12 1 5 4 9 9 12" {...ink} fill="var(--calm)" />
        </>
      )}
      {art === 'debt-free' && (
        <>
          {/* a flag on the top of the hill: the debt-free day */}
          <path d="M14 56Q48 30 82 56" {...ink} fill="var(--calm)" />
          <path d="M48 43V10" {...ink} />
          <path d="M48 10h20l-5 6 5 6H48" {...ink} fill="var(--yellow)" />
          <path d="M22 20l3 3M74 30l3-3M30 8l1 4" {...ink} stroke-opacity="0.5" />
        </>
      )}
      {art === 'cut' && (
        <>
          {/* scissors through a long receipt: cut a cost */}
          <rect x="44" y="16" width="40" height="30" rx="4" {...ink} fill="var(--card)" />
          <path d="M52 24h20M52 31h14M52 38h24" {...soft} />
          <path d="M40 31h48" {...ink} stroke-dasharray="3 4" />
          <circle cx="15" cy="21" r="6" {...ink} fill="var(--calm)" />
          <circle cx="15" cy="41" r="6" {...ink} fill="var(--calm)" />
          <path d="M20 24l22 13M20 38l22-13" {...ink} />
        </>
      )}
      {art === 'sell' && (
        <>
          {/* a box with a price tag: sell what you do not use */}
          <path d="M14 30h36v26H14zM14 30l6-8h24l6 8M28 30v8h8v-8" {...ink} fill="var(--card)" />
          <path d="M50 26c6-4 10-8 14-10" {...ink} stroke-opacity="0.6" />
          <path d="M62 10h16a3 3 0 013 3v13l-11 11-13-13z" {...ink} fill="var(--calm)" />
          <circle cx="74" cy="16" r="2" {...ink} />
        </>
      )}
      {art === 'earn' && (
        <>
          {/* a clock and a growing stack: extra hours */}
          <circle cx="30" cy="32" r="17" {...ink} fill="var(--card)" />
          <path d="M30 22v10l7 5" {...ink} />
          <rect x="58" y="48" width="26" height="7" rx="3.5" {...ink} fill="var(--card)" />
          <rect x="60" y="40" width="22" height="7" rx="3.5" {...ink} fill="var(--card)" />
          <rect x="62" y="32" width="18" height="7" rx="3.5" {...ink} fill="var(--calm)" />
          <path d="M71 14v12M65 20h12" {...ink} />
        </>
      )}
      {art === 'lower' && (
        <>
          {/* a monthly bill and an arrow down: lower a bill */}
          <rect x="16" y="10" width="34" height="42" rx="5" {...ink} fill="var(--card)" />
          <path d="M24 20h18M24 27h12M24 40h18" {...soft} />
          <path d="M24 40h10" {...ink} />
          <path d="M70 12v32M60 34l10 10 10-10" {...ink} />
        </>
      )}
    </svg>
  );
}
