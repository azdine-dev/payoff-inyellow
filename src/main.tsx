import { render } from 'preact';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/caveat/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { makeApplyUpdate, removeHostingOverlays } from './lib/restart';
import { startUpdateChecks } from './lib/updateCheck';
import { pendingUpdateOnOpen, rememberPendingUpdate } from './lib/updateNotice';
import { setApplyUpdate, updateReady } from './state/store';

// Updates download quietly. Nothing reloads mid-payday: the buyer taps "Restart now" (Today or Settings) once.
// "An update is ready" only when an older version was already running this page. A first open has nothing to update.
const hadVersion = Boolean(navigator.serviceWorker?.controller);
const update = registerSW({
  // Ask for a new version at start, each time the app comes back to the screen, and every 30 minutes
  onRegisteredSW: (_url, registration) => {
    if (registration) startUpdateChecks(registration);
  },
  onNeedRefresh: () => {
    updateReady.value = hadVersion;
    // written down, so the next app open says it again if the update still has not been applied
    if (hadVersion) rememberPendingUpdate();
  },
});
// An update that was found last time and is still waiting shows "An update is ready" on this open too
if (pendingUpdateOnOpen()) updateReady.value = true;
// "Restart now" is one tap: the new version takes over and the page reloads into it
setApplyUpdate(makeApplyUpdate(update, () => location.reload()));
removeHostingOverlays();

render(<App />, document.getElementById('app')!);
