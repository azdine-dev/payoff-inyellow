/**
 * The pictures of the short reads (design/warm-extras/Read.html): a sage sky and hill, ink lines, soft yellow, one idea each.
 * The buffer read is the umbrella over a stack of coins from the design. The others are drawn in the same style.
 * `ReadIcon` is the small line icon on the list.
 */
import type { ReadArtKind } from '../copy/reads';

const ink = { stroke: 'var(--ink)', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const soft = { stroke: 'var(--line)', 'stroke-width': 3, 'stroke-linecap': 'round' } as const;

/** A motif drawn on a 120 x 80 sheet, placed in the middle of the 320 x 150 picture */
function Motif({ kind }: { kind: ReadArtKind }) {
  switch (kind) {
    case 'order':
      return (
        <>
          <rect x="18" y="44" width="20" height="20" rx="5" {...ink} fill="var(--yellow)" />
          <path d="M23 54 l4 4 l7 -8" {...ink} />
          <rect x="46" y="36" width="28" height="28" rx="6" {...ink} fill="var(--card)" />
          <rect x="82" y="26" width="22" height="38" rx="6" {...ink} fill="var(--card)" stroke-opacity="0.5" />
        </>
      );
    case 'house':
      return (
        <>
          <path d="M26 66 H94 M32 66 V38 L60 16 L88 38 V66" {...ink} fill="var(--card)" />
          <rect x="52" y="44" width="16" height="22" rx="3" {...ink} fill="var(--calm)" />
          <rect x="38" y="42" width="10" height="10" rx="2" {...ink} fill="#fff6c2" />
        </>
      );
    case 'phone':
      return (
        <>
          <rect x="26" y="16" width="30" height="52" rx="7" {...ink} fill="var(--card)" />
          <path d="M37 60 h8" {...ink} />
          <path d="M66 24 h32 a6 6 0 0 1 6 6 v14 a6 6 0 0 1 -6 6 h-18 l-8 8 v-8 h-6 a6 6 0 0 1 -6 -6 v-14 a6 6 0 0 1 6 -6 Z" {...ink} fill="var(--card)" />
          <path d="M74 34 h22 M74 42 h14" {...soft} />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="60" cy="42" r="26" {...ink} fill="var(--card)" />
          <path d="M60 42 V26 M60 42 l11 7" {...ink} />
          <path d="M60 20 v3 M60 61 v3 M38 42 h3 M79 42 h3" {...soft} />
        </>
      );
    case 'flag':
      return (
        <>
          <path d="M44 66 V16" {...ink} stroke-width="2.8" />
          <path d="M44 16 l30 10 l-30 10 Z" fill="var(--ink)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" />
          <rect x="62" y="48" width="22" height="22" rx="6" {...ink} fill="var(--yellow)" />
          <path d="M68 59 l4 4 l8 -9" {...ink} />
        </>
      );
    case 'calendar':
      return (
        <>
          <rect x="22" y="18" width="76" height="52" rx="8" {...ink} fill="var(--card)" />
          <path d="M22 32 h76 M42 12 v10 M78 12 v10" {...ink} />
          <rect x="30" y="40" width="14" height="14" rx="4" {...ink} stroke-dasharray="3 3" />
          <rect x="52" y="40" width="14" height="14" rx="4" {...ink} fill="var(--card)" />
          <path d="M72 47 h18 M84 42 l6 5 l-6 5" {...ink} />
        </>
      );
    case 'coins':
      return (
        <>
          <ellipse cx="48" cy="58" rx="22" ry="8" {...ink} fill="#fff6c2" />
          <ellipse cx="48" cy="48" rx="22" ry="8" {...ink} fill="#fff6c2" />
          <ellipse cx="48" cy="38" rx="22" ry="8" {...ink} fill="#fff6c2" />
          <path d="M88 30 v16 M80 38 h16" {...ink} />
        </>
      );
    case 'bills':
      return (
        <>
          <rect x="30" y="12" width="60" height="58" rx="7" {...ink} fill="var(--card)" />
          <path d="M42 28 h36 M42 40 h36 M42 52 h22" {...soft} />
          <circle cx="36" cy="28" r="1.8" fill="var(--ink)" />
          <circle cx="36" cy="40" r="1.8" fill="var(--ink)" />
          <circle cx="36" cy="52" r="1.8" fill="var(--ink)" />
        </>
      );
    case 'lifebuoy':
      return (
        <>
          <circle cx="60" cy="42" r="26" {...ink} fill="var(--card)" />
          <circle cx="60" cy="42" r="11" {...ink} fill="var(--calm)" />
          <path d="M41 23 l9 9 M79 23 l-9 9 M41 61 l9 -9 M79 61 l-9 -9" stroke="var(--calm-band)" stroke-width="5" stroke-linecap="round" />
        </>
      );
    default:
      return null;
  }
}

export function ReadArt({ kind }: { kind: ReadArtKind }) {
  return (
    <svg class="read-art" viewBox="0 0 320 150" width="100%" role="img" aria-label="An illustration for this read" focusable="false" data-kind={kind}>
      <rect width="320" height="150" class="sc-sky" />
      <path d="M0 118 Q100 96 200 112 T320 100 V150 H0Z" class="sc-hill2" />
      {kind === 'umbrella' ? (
        <>
          <g class="rd-rain" stroke-width="2" stroke-linecap="round">
            <path d="M40 20 l-6 14M80 34 l-6 14M250 22 l-6 14M285 40 l-6 14M60 70 l-6 14M265 74 l-6 14" />
          </g>
          <path d="M110 70 Q160 18 210 70 Z" class="sc-sq sc-ink" stroke-width="2" />
          <path d="M110 70 Q123 62 135 70 Q148 62 160 70 Q173 62 185 70 Q198 62 210 70" fill="none" class="sc-ink" stroke-width="2" />
          <path d="M160 44 V104 q0 8 -8 8" fill="none" class="sc-ink" stroke-width="2" stroke-linecap="round" />
          <g class="sc-ink" stroke-width="1.6">
            <rect x="140" y="98" width="40" height="8" rx="4" class="sc-sun" />
            <rect x="142" y="90" width="36" height="8" rx="4" class="sc-sun" />
            <rect x="144" y="82" width="32" height="8" rx="4" class="sc-sun" />
          </g>
        </>
      ) : (
        <g transform="translate(94 20) scale(1.1)">
          <Motif kind={kind} />
        </g>
      )}
    </svg>
  );
}

/** The small icon on the list, 24px line style */
export function ReadIcon({ id }: { id: string }) {
  const p: Record<string, string> = {
    'smallest-first': 'M5 20V5M5 5h11l-2 3.5 2 3.5H5',
    buffer: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z',
    'surprise-plan': 'M4 18h16M6 18V9l6-5 6 5v9',
    'call-lender': 'M6 3h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z',
    'promo-trap': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
    'debt-zero': 'M5 12.5l4.5 4.5L19 7.5',
    'missed-payday': 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4',
    'first-500': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 7.5v9M9.5 10.2c0-1.1 1.1-1.7 2.5-1.7s2.5.6 2.5 1.7-1.1 1.5-2.5 1.8-2.5.7-2.5 1.8 1.1 1.7 2.5 1.7 2.5-.6 2.5-1.7',
    'not-surprises': 'M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h6',
    'not-enough': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6.3 6.3l3.6 3.6M17.7 6.3l-3.6 3.6M6.3 17.7l3.6-3.6M17.7 17.7l-3.6-3.6',
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={p[id] ?? p['debt-zero']} />
    </svg>
  );
}
