/**
 * Money on top of this payday (design/today-extra): chips $20 $50 $100 and Other (which opens the amount field). A pick
 * shows where it goes, in the engine's order, and the new debt-free day when it moves. Used inside the card on a payday
 * with nothing due, and in the "Extra money came in?" sheet on a payday with a bill.
 */
import { useMemo, useState } from 'preact/hooks';
import type { AppData } from '../data/types';
import type { PlanResult } from '../engine';
import { formatMoney, formatMoneyAuto, parseAmount } from '../lib/money';
import { fullDate } from '../lib/today';
import { extraMove, whereItGoes, type ExtraMove } from '../state/extraMove';
import { Field, NumberInput } from '../ui/controls';

const CHIPS = [20, 50, 100] as const;

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 3.5 2 3.5H5" />
    </svg>
  );
}

/** The second line: the safety net after it, then the new date when it moves, or what the debt owes after it */
export function moveDetail(m: ExtraMove, focusName: string | null, cur: AppData['settings']['currency']): string[] {
  const money = (n: number) => formatMoneyAuto(n, cur);
  const lines: string[] = [];
  if (m.toBuffer > 0.005) lines.push(`${money(m.bufferAfter)} of ${money(m.bufferGoal)}. ${focusName ? `A surprise bill stays off ${focusName}.` : 'A surprise bill has somewhere to land.'}`);
  if (m.after !== m.before && m.after) lines.push(`Debt-free ${fullDate(m.after)} instead of ${m.before ? fullDate(m.before) : 'more than 20 years'}.`);
  else if (m.toDebts.length) {
    const last = m.toDebts[m.toDebts.length - 1]!;
    lines.push(`${last.name} owes ${formatMoney(last.owedAfter, cur)} after this payday.`);
  }
  return lines;
}

export function ExtraChips(props: {
  d: AppData;
  current: PlanResult;
  /** The money for the plan this payday before the extra (default: the usual amount) */
  base?: number;
  focusName: string | null;
  /** The button's words for a pick, like "Move $50" */
  action: (m: ExtraMove) => string;
  onMove: (m: ExtraMove) => void;
  busy?: boolean;
}) {
  const { d, current, base, focusName, action, onMove, busy } = props;
  const cur = d.settings.currency;
  const money = (n: number) => formatMoneyAuto(n, cur);
  const [picked, setPicked] = useState<number | 'other' | null>(null);
  const [other, setOther] = useState('');
  const amount = picked === 'other' ? parseAmount(other) : picked;
  const m = useMemo(() => (amount !== null && amount > 0 ? extraMove(d, amount, current, base) : null), [d, current, base, amount]);

  return (
    <div class="stack" style={{ gap: 12 }} data-testid="extra-chips">
      <div class="chips amount-chips" role="group" aria-label="How much to move">
        {CHIPS.map((n) => (
          <button key={n} type="button" class="pill plain chip" aria-pressed={picked === n} onClick={() => setPicked(n)}>
            {money(n)}
          </button>
        ))}
        <button type="button" class="pill plain chip" aria-pressed={picked === 'other'} onClick={() => setPicked('other')}>
          Other
        </button>
      </div>
      {picked === 'other' && (
        <Field label="How much?">
          <NumberInput pre={cur.symbol} value={other} onInput={setOther} label="Other amount" />
        </Field>
      )}
      {m && (
        <div class="move-where" role="status" data-testid="move-where">
          <span class="move-icon">{m.toBuffer > 0.005 ? <ShieldIcon /> : <FlagIcon />}</span>
          <span>
            <b>{whereItGoes(m, money)}</b>
            {moveDetail(m, focusName, cur).map((line) => (
              <span key={line} class="move-line">
                {line}
              </span>
            ))}
          </span>
        </div>
      )}
      {m && (
        <button type="button" class="pc-btn move-btn" disabled={busy} onClick={() => onMove(m)}>
          {action(m)}
        </button>
      )}
    </div>
  );
}
