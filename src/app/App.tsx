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
import { NoticeBar } from '../ui/NoticeBar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'debts', label: 'Debts' },
  { id: 'progress', label: 'Progress' },
  { id: 'money', label: 'Money' },
];

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
            <i aria-hidden="true" />
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
      <Screens />
    </>
  );
}

function Screens() {
  useEffect(() => {
    void boot().then(handleLaunchFragment);
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
