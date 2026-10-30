/**
 * The Road: a winding vertical path of rounded squares, one per payday, bottom to top.
 * Paid = yellow with an ink check, next = ink outline, ahead = line grey. A flag stands where a debt reaches zero
 * (a yellow PAID stamp once it has), there is a halfway marker and a finish flag, and a "You are here" pin on the
 * next payday. It opens scrolled to the pin. Motion is 600 ms at most and is off with prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RoadFlag, RoadModel } from './roadModel';
import { Sheet } from '../ui/controls';

const W = 300;
const CX = 150;
const AMP = 56;
const STEP = 34;
const SQ = 22;
const PAD_TOP = 70;
const PAD_BOT = 44;

export const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** Centre of square i (0 is at the bottom) */
function spot(i: number, count: number): { x: number; y: number } {
  const height = PAD_TOP + (count - 1) * STEP + PAD_BOT;
  return { x: CX + AMP * Math.sin(i * 0.7), y: height - PAD_BOT - i * STEP };
}

const short = (s: string, n = 12) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function Road(props: {
  model: RoadModel;
  /** Square index the finish flag stands on (moves when a "Pay a bit more?" amount is tried) */
  finishIndex: number | null;
  freshPayday: number | null;
  freshPaidDebts: string[];
  /** The text for a flag sheet: the date and the amount, already worded */
  describe: (f: RoadFlag) => { title: string; lines: string[] };
  extraNote?: string | null;
}) {
  const { model, finishIndex, freshPayday, freshPaidDebts, describe } = props;
  const count = model.squares.length;
  const height = PAD_TOP + (count - 1) * STEP + PAD_BOT;
  const scroller = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<RoadFlag | null>(null);

  // The pin starts from where it was: the square just paid, or the bottom of the road on a fresh open
  const target = model.pinIndex !== null ? spot(model.pinIndex, count) : null;
  const from = (() => {
    if (!target || model.pinIndex === null) return null;
    if (reducedMotion()) return target;
    if (freshPayday !== null) return spot(Math.max(0, model.pinIndex - 1), count);
    return spot(0, count);
  })();
  const [pin, setPin] = useState(from);
  useEffect(() => {
    if (!target) return;
    const id = requestAnimationFrame(() => setPin(target));
    return () => cancelAnimationFrame(id);
  }, [model.pinIndex, count]);

  // Open scrolled to the pin
  useEffect(() => {
    const el = scroller.current;
    if (!el || !target) return;
    const scale = el.clientWidth / W || 1;
    el.scrollTop = Math.max(0, target.y * scale - el.clientHeight * 0.6);
  }, [model.pinIndex, count]);

  const centres = model.squares.map((s) => spot(s.index, count));
  const road = centres.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const drawn = model.flags.filter((f) => !(f.kind === 'debt' && f.merged));
  const finish = model.flags.find((f) => f.kind === 'finish');
  const finishAt = finish && finishIndex !== null ? spot(finishIndex, count) : null;
  const mergedDebt = model.flags.find((f) => f.kind === 'debt' && f.merged);
  const bare = (name: string) => short(name);

  const flagSide = (x: number) => (x >= CX ? 1 : -1);

  return (
    <div class="road-wrap" data-testid="road">
      <div class="road-scroll" ref={scroller} tabIndex={0} aria-label="Your road, one square per payday">
        <svg class="road-svg" viewBox={`0 0 ${W} ${height}`} width="100%" role="group" aria-label="The road to debt-free" focusable="false" style={{ display: 'block', height: 'auto', overflow: 'visible' }}>
          <path d={road} fill="none" stroke="var(--line)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 9" />

          {/* halfway: a dashed line across the road */}
          {drawn.filter((f) => f.kind === 'half').map((f) => {
            const p = centres[f.index]!;
            return (
              <g key={f.key} class="road-half" data-testid="road-flag" data-kind="half" role="button" tabIndex={0} aria-label={`Halfway${f.date ? `, ${describe(f).lines[0] ?? ''}` : ''}`} onClick={() => setOpen(f)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(f)}>
                <rect x="0" y={p.y - 18} width={W} height="36" fill="transparent" />
                <path d={`M10 ${p.y} H${W - 10}`} stroke={f.paid ? 'var(--ink)' : 'var(--gray)'} stroke-width="1.5" stroke-dasharray="4 5" />
                <text x="12" y={p.y - 6} font-size="11" font-weight="700" fill="var(--ink)">
                  Halfway
                </text>
              </g>
            );
          })}

          {/* squares */}
          {model.squares.map((s, i) => {
            const p = centres[i]!;
            const fresh = s.kind === 'paid' && s.number === freshPayday;
            return (
              <g key={s.index} class={`road-sq ${s.kind}`} data-testid="road-sq" data-kind={s.kind} role="img" aria-label={s.label}>
                <rect x={p.x - SQ / 2} y={p.y - SQ / 2} width={SQ} height={SQ} rx="6" class="sq-body" />
                {(s.kind === 'paid' || s.kind === 'start') && (
                  <>
                    <rect x={p.x - SQ / 2} y={p.y - SQ / 2} width={SQ} height={SQ} rx="6" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.8" class={fresh ? 'sq-fill swipe' : 'sq-fill'} />
                    <path d={`M${p.x - 5.5} ${p.y + 0.5} l4.2 4.2 l7.3 -8.6`} fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
                  </>
                )}
              </g>
            );
          })}

          {/* flags where a debt reaches zero */}
          {drawn.filter((f) => f.kind === 'debt').map((f) => {
            const p = centres[f.index]!;
            const side = flagSide(p.x);
            const fx = p.x + side * 22;
            const stamped = f.paid;
            const fresh = freshPaidDebts.includes(f.debtId ?? '');
            const d = describe(f);
            return (
              <g key={f.key} class={`road-flag${stamped ? ' stamped' : ''}${fresh ? ' fresh' : ''}`} data-testid="road-flag" data-kind="debt" data-paid={stamped ? '1' : '0'} role="button" tabIndex={0} aria-label={`${d.title}. ${d.lines.join('. ')}`} onClick={() => setOpen(f)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(f)}>
                <rect x={fx - 24} y={p.y - 30} width="48" height="44" fill="transparent" />
                {stamped ? (
                  <g transform={`translate(${fx} ${p.y - 6}) rotate(-6)`} class="stamp">
                    <rect x="-20" y="-9" width="40" height="18" rx="4" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.6" />
                    <text x="0" y="4.5" font-size="11" font-weight="800" text-anchor="middle" fill="var(--on-yellow)">
                      PAID
                    </text>
                  </g>
                ) : (
                  <>
                    <path d={`M${fx} ${p.y + 8} V${p.y - 24}`} stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
                    <path d={`M${fx} ${p.y - 24} l${side * 13} 5 l${-side * 13} 5 Z`} fill="var(--ink)" />
                  </>
                )}
                <text x={fx + side * (stamped ? 24 : 18)} y={stamped ? p.y - 2 : p.y - 9} font-size="11" font-weight="600" fill="var(--ink)" text-anchor={side > 0 ? 'start' : 'end'} stroke="var(--card)" stroke-width="3" paint-order="stroke">
                  {bare(f.title)}
                </text>
              </g>
            );
          })}

          {/* the finish flag (it slides when "Pay a bit more?" is tried) */}
          {finish && finishAt && (
            <g
              class="road-finish"
              data-testid="road-flag"
              data-kind="finish"
              data-index={finishIndex ?? undefined}
              style={{ transform: `translate(${finishAt.x}px, ${finishAt.y}px)` }}
              role="button"
              tabIndex={0}
              aria-label={`${describe(finish).title}. ${describe(finish).lines.join('. ')}`}
              onClick={() => setOpen(finish)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen(finish)}
            >
              <rect x="-26" y="-58" width="64" height="70" fill="transparent" />
              <path d="M0 10 V-44" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" />
              <path d="M0 -44 l26 9 l-26 9 Z" fill="var(--ink)" />
              <rect x="-2" y="-52" width="1" height="1" fill="none" />
              <text x="30" y="-30" font-size="11" font-weight="800" fill="var(--ink)" stroke="var(--card)" stroke-width="3" paint-order="stroke">
                Debt-free
              </text>
            </g>
          )}

          {/* You are here */}
          {pin && model.pinIndex !== null && (
            <g class="road-pin" data-testid="road-pin" data-index={model.pinIndex} style={{ transform: `translate(${pin.x}px, ${pin.y}px)` }} role="img" aria-label={`You are here, ${model.squares[model.pinIndex]!.label}`}>
              <path d="M0 -12 L0 -22" stroke="var(--ink)" stroke-width="2" stroke-linecap="round" />
              <circle cx="0" cy="-30" r="9" fill="var(--ink)" />
              <circle cx="0" cy="-30" r="3.2" fill="var(--paper)" />
              <g transform={`translate(${pin.x >= CX ? -16 : 16} -26)`}>
                <rect x={pin.x >= CX ? -78 : 0} y="-10" width="78" height="20" rx="10" fill="var(--ink)" />
                <text x={pin.x >= CX ? -39 : 39} y="4" font-size="10.5" font-weight="700" text-anchor="middle" fill="var(--on-ink)">
                  You are here
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>
      {model.hiddenAhead > 0 && <p class="muted small">+ {model.hiddenAhead} more paydays after these.</p>}
      {props.extraNote && <p class="muted small">{props.extraNote}</p>}

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? describe(open).title : ''}>
        {open && (
          <div class="stack" style={{ gap: 6 }} data-testid="road-flag-sheet">
            {describe(open).lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            {open.kind === 'debt' && open.paid && <span class="paid-stamp small-stamp" style={{ alignSelf: 'flex-start' }}>PAID</span>}
            {mergedDebt && open.kind === 'finish' && <p class="muted">{mergedDebt.title} is the last debt.</p>}
          </div>
        )}
        <button type="button" class="btn" onClick={() => setOpen(null)}>
          Close
        </button>
      </Sheet>
    </div>
  );
}
