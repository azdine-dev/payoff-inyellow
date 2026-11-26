/**
 * A sub-screen that closes with the back button: `active` is true while it is open, `close` closes it.
 * Its history entry is added in a layout effect, before the sub-screen is painted: with a plain effect there is a moment
 * where it shows without its entry, and a back press then leaves the app instead of closing it.
 */
import { useLayoutEffect, useRef } from 'preact/hooks';
import { pushLayer, startBackStack } from './backStack';

export function useBackLayer(active: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useLayoutEffect(() => {
    if (!active) return;
    startBackStack();
    return pushLayer(() => closeRef.current());
  }, [active]);
}
