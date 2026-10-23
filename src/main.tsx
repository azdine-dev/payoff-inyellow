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
import { setApplyUpdate, updateReady } from './state/store';

// Updates download quietly. Nothing reloads mid-payday: the buyer taps "Restart now" in Settings.
// "An update is ready" only when an older version was already running this page. A first open has nothing to update.
const hadVersion = Boolean(navigator.serviceWorker?.controller);
const update = registerSW({ onNeedRefresh: () => (updateReady.value = hadVersion) });
setApplyUpdate(() => void update(true));

render(<App />, document.getElementById('app')!);
