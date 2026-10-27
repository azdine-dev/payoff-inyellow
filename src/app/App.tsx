import { useEffect, useState } from 'preact/hooks';
import { Result } from '../setup/Result';
import { Wizard } from '../setup/Wizard';
import { boot, licenseState, tab, view, type Tab } from '../state/store';
import { Debts } from '../debts/Debts';
import { Path } from '../path/Path';
import { Settings } from '../settings/Settings';
import { applyAppearance } from '../lib/appearance';
import { data } from '../state/store';
import { Money } from '../money/Money';
import { Today } from '../today/Today';
import { handleLaunchFragment } from '../state/unlockLink';
import { startSync } from '../sync/controller';
import { JoinSheet } from '../settings/SyncSection';
import { NoticeBar } from '../ui/NoticeBar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'path', label: 'Path' },
  { id: 'debts', label: 'Debts' },
  { id: 'safety', label: 'Safety net' },
];

/** Inline stroke icons, 1.9px, in ink. The tab you are on gets a soft pill behind it (never yellow: yellow means paid). */
function TabIcon(props: { id: Tab }) {
  const common = { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true, class: 'tab-icon' };
  switch (props.id) {
    case 'today': // a card with a tick: what to do today
      return (
        <svg {...common}>
          <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
          <path d="M9 12.4l2.2 2.2 4-4.2" />
          <path d="M9 7.5h6" />
        </svg>
      );
    case 'path': // a flag: where you are heading
      return (
        <svg {...common}>
          <path d="M6 21V4" />
          <path d="M6 5h11.5l-2.3 3.6 2.3 3.6H6" />
        </svg>
      );
    case 'debts': // a card
      return (
        <svg {...common}>
          <rect x="2.8" y="5.5" width="18.4" height="13" rx="3" />
          <path d="M2.8 10h18.4M6.5 15h3" />
        </svg>
      );
    default: // a shield: the safety net
      return (
        <svg {...common}>
          <path d="M12 3.2l7 2.6v5.4c0 4.4-2.9 8-7 9.6-4.1-1.6-7-5.2-7-9.6V5.8z" />
        </svg>
      );
  }
}

function TabBar() {
  return (
    <div class="tabbar">
      <nav aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab.value === t.id ? 'page' : undefined}
            onClick={() => {
              tab.value = t.id;
              window.scrollTo(0, 0);
            }}
          >
            <span class="tab-pill">
              <TabIcon id={t.id} />
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <>
      <NoticeBar />
      <JoinSheet />
      <Screens />
    </>
  );
}

/** True on a laptop or an iPad held wide (above 900px). Phones never are. */
function useWide(): boolean {
  const query = '(min-width: 900px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches));
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

function Screens() {
  const wide = useWide();
  useEffect(() => {
    void boot().then(handleLaunchFragment).then(startSync);
    // A link opened in the same window (a scanned code, a tap in the installed app) only changes the # part
    const onHash = () => void handleLaunchFragment();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // A new screen (the result after setup, Today after "Start my plan") starts at the top, not where the last one was scrolled to
  const screen = view.value;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const look = data.value?.settings;
  useEffect(() => {
    if (look) applyAppearance(look.theme, look.textSize);
  }, [look?.theme, look?.textSize]);

  if (view.value === 'loading') return null;
  if (view.value === 'setup') return <Wizard />;

  // A stored code is being checked on the phone (a blink)
  if (licenseState.value === 'checking') return null;
  if (view.value === 'result') return <Result />;

  const current = tab.value;

  // Calculator mode (no valid unlock code): the result is home. Settings stays open for the
  // unlock code, backup and help. The tracker, plan and the rest wait behind the code.
  // (Settings sits in the same wrapper in both cases, so unlocking from there does not close the sheet you are in.)
  if (licenseState.value === 'locked') {
    return current === 'settings' ? (
      <div class="app-shell no-nav">
        <Settings />
      </div>
    ) : (
      <Result />
    );
  }

  return (
    <div class="app-shell">
      {wide && (current === 'today' || current === 'path') ? (
        // On a wide screen Today and Path sit side by side
        <div class="wide-pair">
          <Today />
          <Path />
        </div>
      ) : current === 'today' ? (
        <Today />
      ) : current === 'debts' ? (
        <Debts />
      ) : current === 'path' ? (
        <Path />
      ) : current === 'safety' ? (
        <Money />
      ) : (
        <Settings />
      )}
      <TabBar />
    </div>
  );
}
