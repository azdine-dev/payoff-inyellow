/** A number that counts to its new value in 200 ms when it changes. No animation on first show, or with reduced motion. */
import { useEffect, useRef, useState } from 'preact/hooks';

export function useCountUp(value: number, ms = 200): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (current.current === value) return;
    const reduce = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (reduce) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      current.current = p < 1 ? from + (value - from) * p : value;
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}
