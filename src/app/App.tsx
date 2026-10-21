import { useEffect } from 'preact/hooks';
import { Result } from '../setup/Result';
import { Wizard } from '../setup/Wizard';
import { boot, licenseState, tab, view, type Tab } from '../state/store';
import { Debts } from '../debts/Debts';
import { Plan } from '../plan/Plan';
import { Settings } from '../settings/Settings';
import { applyAppearance } from '../lib/appearance';
import { data } from '../state/store';
import { Progress } from '../progress/Progress';
import { Money } from '../money/Money';
import { Today } from '../today/Today';
import { handleLaunchFragment } from '../state/unlockLink';
import { startSync } from '../sync/controller';
import { JoinSheet } from '../settings/SyncSection';
import { NoticeBar } from '../ui/NoticeBar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'debts', label: 'Debts' },
  { id: 'progress', label: 'Progress' },
  { id: 'money', label: 'Money' },
];

/** Simple line icons, 24px, drawn in ink. The shape marked "fill" turns yellow on the tab you are on. */
function TabIcon(props: { id: Tab }) {
  const common = { viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, 'aria-hidden': true, class: 'tab-icon' };
  switch (props.id) {
    case 'today': // a calendar page with today ticked
      return (
        <svg {...common}>
          <rect class="fill" x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path d="M8.8 15.2l2.2 2.2 4.4-4.6" />
        </svg>
      );
    case 'plan': // a list of paydays
      return (
        <svg {...common}>
          <rect class="fill" x="3.5" y="4" width="17" height="16.5" rx="3" />
          <path d="M8 9h8M8 12.5h8M8 16h5" />
        </svg>
      );
    case 'debts': // a card
      return (
        <svg {...common}>
          <rect class="fill" x="2.8" y="5.5" width="18.4" height="13" rx="3" />
          <path d="M2.8 10h18.4M6.5 15h3" />
        </svg>
      );
    case 'progress': // rising bars
      return (
        <svg {...common}>
          <rect class="fill" x="4" y="12" width="4" height="8" rx="1.2" />
          <rect class="fill" x="10" y="8" width="4" height="12" rx="1.2" />
          <rect class="fill" x="16" y="4" width="4" height="16" rx="1.2" />
        </svg>
      );
    default: // money: a coin
      return (
        <svg {...common}>
          <circle class="fill" cx="12" cy="12" r="8.5" />
          <path d="M14.6 9.2c-.5-.8-1.5-1.2-2.6-1.2-1.5 0-2.6.8-2.6 1.9 0 2.7 5.4 1.2 5.4 4 0 1.1-1.1 1.9-2.8 1.9-1.2 0-2.3-.5-2.8-1.4M12 6.5V8M12 16v1.5" />
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
            <TabIcon id={t.id} />
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

function Screens() {
  useEffect(() => {
    void boot().then(handleLaunchFragment).then(startSync);
    // A link opened in the same window (a scanned code, a tap in the installed app) only changes the # part
    const onHash = () => void handleLaunchFragment();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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
  if (licenseState.value === 'locked') return current === 'settings' ? <Settings /> : <Result />;

  return (
    <>
      {current === 'today' ? (
        <Today />
      ) : current === 'debts' ? (
        <Debts />
      ) : current === 'plan' ? (
        <Plan />
      ) : current === 'progress' ? (
        <Progress />
      ) : current === 'money' ? (
        <Money />
      ) : (
        <Settings />
      )}
      <TabBar />
    </>
  );
}
