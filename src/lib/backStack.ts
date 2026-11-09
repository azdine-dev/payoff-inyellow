/**
 * The Android back button and the swipe back close the sub-screen you are on instead of leaving the app.
 * Every sub-screen (a sheet, Whole plan, Preview, the reads, a read) is a layer: opening it adds one history entry,
 * and the back button takes the top layer away. When a layer is closed by the app (its own Close or Back button), its
 * history entry is taken away too, so the next back press does the right thing.
 */
interface Layer {
  close: () => void;
  /** its history entry is there */
  pushed: boolean;
}

const layers: Layer[] = [];
/** history.back() calls the app made itself: their popstate is not the buyer pressing back */
let ignore = 0;
/** layers waiting for the app's own history.back() to finish before they add their entry */
let waiting: Layer[] = [];

function push(layer: Layer) {
  history.pushState({ piyLayer: true }, '');
  layer.pushed = true;
}

/** Adds a layer. Returns the function to call when the app closes it itself. */
export function pushLayer(close: () => void): () => void {
  const layer: Layer = { close, pushed: false };
  layers.push(layer);
  if (ignore > 0) waiting.push(layer);
  else push(layer);
  return () => {
    const i = layers.indexOf(layer);
    if (i < 0) return; // the back button already closed it
    if (!layer.pushed) {
      layers.splice(i, 1);
      waiting = waiting.filter((x) => x !== layer);
      return;
    }
    if (i === layers.length - 1) {
      layers.pop();
      ignore++;
      history.back();
    } else {
      layer.close = () => undefined; // under another layer: its entry stays, and going back over it does nothing
    }
  };
}

function onPop() {
  if (ignore > 0) {
    ignore--;
    if (ignore === 0 && waiting.length) {
      const now = waiting;
      waiting = [];
      for (const l of now) if (layers.includes(l)) push(l);
    }
    return;
  }
  const top = layers.pop();
  top?.close();
}

let started = false;
/** Called once when the app starts */
export function startBackStack(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  // an entry left over from before a reload has no layer any more
  if (history.state?.piyLayer) history.replaceState(null, '');
  window.addEventListener('popstate', onPop);
}

/** For tests: how many layers are open */
export function openLayers(): number {
  return layers.length;
}
