/** A sub-screen that closes with the back button: `active` is true while it is open, `close` closes it. */
import { useEffect, useRef } from 'preact/hooks';
import { pushLayer, startBackStack } from './backStack';

export function useBackLayer(active: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    startBackStack();
    return pushLayer(() => closeRef.current());
  }, [active]);
}
