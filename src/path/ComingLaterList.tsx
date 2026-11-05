/**
 * Path, under "Your whole plan": the money you planned to get later, as a small list
 * ("Tax refund · $800 · Fri 9 Apr"). Tap an item to move it to another payday or remove it. Undo stays for a few seconds.
 */
import { useEffect, useState } from 'preact/hooks';
import type { OneOff } from '../data/types';
import { formatMoney } from '../lib/money';
import { fullDate, shortDate } from '../lib/today';
import { comingLaterItems } from '../state/comingLater';
import { moveComingLater, removeOneOff, restoreOneOff } from '../state/planActions';
import { act, data, plan, today } from '../state/store';
import { Sheet } from '../ui/controls';

export function ComingLaterList() {
  const d = data.value!;
  const r = plan.value!;
  const cur = d.settings.currency;
  const items = comingLaterItems(d);
  const [open, setOpen] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ text: string; run: () => Promise<unknown> } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  const item = items.find((o) => o.id === open) ?? null;
  const name = (o: OneOff) => o.kind ?? 'Extra money';
  const money = (o: OneOff) => formatMoney(o.amount, cur, { whole: Number.isInteger(o.amount) });
  if (!items.length && !undo) return null;

  // The paydays to pick from: the ones ahead, and its own payday if that one is already behind us
  const dates = r.rows.slice(0, 52).map((x) => x.date);
  if (item && !dates.includes(item.date)) dates.unshift(item.date);

  return (
    <section class="card stack" style={{ gap: 4 }} aria-label="Coming later" data-testid="coming-later-list">
      <p class="label">Coming later</p>
      {items.map((o) => (
        <button key={o.id} type="button" class="row cl-item" aria-haspopup="dialog" aria-label={`${name(o)}, ${money(o)}, ${shortDate(o.date, today.value)}`} onClick={() => setOpen(o.id)}>
          <span>
            {name(o)} · <b class="num">{money(o)}</b> · {shortDate(o.date, today.value)}
          </span>
          <span aria-hidden="true" class="muted">
            ›
          </span>
        </button>
      ))}
      {undo && (
        <div class="row small" role="status" data-testid="coming-later-undo">
          <span>{undo.text}</span>
          <button
            type="button"
            class="link small"
            onClick={async () => {
              const run = undo.run;
              setUndo(null);
              await run();
            }}
          >
            Undo
          </button>
        </div>
      )}

      <Sheet open={item !== null} onClose={() => setOpen(null)} title={item ? `${name(item)} · ${money(item)}` : ''}>
        {item && (
          <>
            <div class="stack" style={{ gap: 6 }}>
              <label class="label-strong" for="cl-payday">
                Which payday?
              </label>
              <div class="el-select">
                <select
                  id="cl-payday"
                  aria-label="Move to payday"
                  value={item.date}
                  onChange={async (e) => {
                    const date = (e.target as HTMLSelectElement).value;
                    const before = item.date;
                    const id = item.id;
                    setOpen(null);
                    await act((db, x) => moveComingLater(db, x, id, date));
                    setUndo({ text: `Moved to ${shortDate(date, today.value)}.`, run: () => act((db, x) => moveComingLater(db, x, id, before)) });
                  }}
                >
                  {dates.map((x) => (
                    <option key={x} value={x}>
                      {fullDate(x)}
                    </option>
                  ))}
                </select>
              </div>
              <p class="muted small">Today asks if it arrived on that payday.</p>
            </div>
            <button
              type="button"
              class="btn outline"
              onClick={async () => {
                const entry = item;
                setOpen(null);
                await act((db, x) => removeOneOff(db, x, entry.id));
                setUndo({ text: `Removed ${name(entry).toLowerCase()}.`, run: () => act((db, x) => restoreOneOff(db, x, entry)) });
              }}
            >
              Remove
            </button>
            <button type="button" class="link" onClick={() => setOpen(null)}>
              Close
            </button>
          </>
        )}
      </Sheet>
    </section>
  );
}
