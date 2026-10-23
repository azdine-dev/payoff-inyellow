/**
 * A number that rolls to its new value in 200 ms, up or down. What was last shown is remembered by key, so a balance
 * that dropped while you were on another screen rolls when you come back. Not on the first ever show, and not with
 * reduced motion.
 */
import { useEffect, useRef, useState } from 'preact/hooks';

const shownBefore = new Map<string, number>();

/**
 * Before the data changes, remember what the other screens last showed (or would show), so their numbers
 * roll from the old value when you open them. Keeps what a screen really showed if there is one.
 */
export function rememberCount(key: string, value: number) {
  if (!shownBefore.has(key)) shownBefore.set(key, value);
}

export function useCountUp(value: number, key?: string, ms = 200): number {
  const start = key !== undefined && shownBefore.has(key) ? shownBefore.get(key)! : value;
  const [shown, setShown] = useState(start);
  const current = useRef(start);
  useEffect(() => {
    if (current.current === value) return;
    const reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const remember = (n: number) => {
      current.current = n;
      if (key !== undefined) shownBefore.set(key, n);
    };
    if (reduce) {
      remember(value);
      setShown(value);
      return;
    }
    const from = current.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      remember(p < 1 ? from + (value - from) * p : value);
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  useEffect(() => {
    if (key !== undefined && !shownBefore.has(key)) shownBefore.set(key, value);
  }, []);
  return shown;
}

/** <Count value={n} format={...} id="to-go" /> */
export function Count(props: { value: number; format: (n: number) => string; id?: string }) {
  return <>{props.format(useCountUp(props.value, props.id))}</>;
}
