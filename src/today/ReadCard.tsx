/**
 * One small card with one suggested short read: the title and "1 min". It shows after "I did it", or when nothing is due,
 * never above the payday card. The suggestion stays the same until the next payday. Once it is read it gets a tick, and
 * the next payday suggests the next read. The whole list is in Path ("See all reads").
 */
import { useEffect } from 'preact/hooks';
import { planNeedsHelp } from '../engine';
import { READS } from '../copy/reads';
import { getReadIds, getTodayRead, setTodayRead } from '../lib/seen';
import { readMinutes } from '../reads/ReadsScreen';
import { ReadIcon } from '../reads/ReadArt';
import { readForToday } from '../reads/todayRead';
import { nextPaydayNumber, toPlanInput } from '../state/planInput';
import { data, plan, readsFrom, readsId, tab, today } from '../state/store';
import { CheckIcon, ChevronRight } from '../ui/controls';

export function ReadCard(props: { missed: number; focusPct: number | null }) {
  const d = data.value!;
  const payday = nextPaydayNumber(d.settings);
  const read = getReadIds();
  const stored = getTodayRead();
  const needsHelp = planNeedsHelp(toPlanInput(d), plan.value!, d.settings.paycheckAmount).length > 0;
  // the same suggestion all payday: it only changes when the payday does
  const pick = stored && stored.payday === payday ? stored.id : readForToday({ d, today: today.value, missed: props.missed, focusPct: props.focusPct, needsHelp, read });
  useEffect(() => {
    if (pick && !(stored && stored.payday === payday && stored.id === pick)) setTodayRead({ payday, id: pick });
  }, [pick, payday]);
  const item = pick ? READS.find((r) => r.id === pick) : undefined;
  if (!item) return null;
  const isRead = read.includes(item.id);
  return (
    <button
      type="button"
      class="card read-today"
      data-testid="today-read"
      data-read={isRead ? '1' : undefined}
      data-read-id={item.id}
      aria-label={`${isRead ? 'Read' : 'Short read'}: ${item.title}, ${readMinutes(item)} min`}
      onClick={() => {
        // straight into the read; Back comes home to Today
        readsFrom.value = 'today';
        readsId.value = item.id;
        tab.value = 'reads';
        window.scrollTo(0, 0);
      }}
    >
      <span class="read-tile">
        <ReadIcon id={item.id} />
      </span>
      <span class="stack" style={{ gap: 0, flex: 1, textAlign: 'left' }}>
        <span class="muted small">{isRead ? 'Read' : 'A short read for you'}</span>
        <b>{item.title}</b>
        <span class="muted small">{readMinutes(item)} min</span>
      </span>
      {isRead ? (
        <span class="read-check" role="img" aria-label="Read" data-testid="today-read-check">
          <CheckIcon />
        </span>
      ) : (
        <ChevronRight />
      )}
    </button>
  );
}
