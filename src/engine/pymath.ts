/**
 * Small helpers that reproduce Python's number behaviour, so the TypeScript engine
 * returns the same numbers as engine/engine_v2.py (and the Google Sheet).
 */

/**
 * Python's built-in `round(x, nd)`: rounds the exact decimal value of the float,
 * ties go to the even digit.
 *
 * `toFixed` also works on the exact value but sends ties away from zero. A true tie
 * at `nd` decimals is only possible when x = q / 2^(nd+1) with q odd, so that is the
 * only case we correct.
 */
export function pyRound(x: number, nd = 2): number {
  if (!Number.isFinite(x)) return x;
  const q = x * 2 ** (nd + 1); // exact: multiplying by a power of two
  if (Number.isInteger(q) && Math.abs(q) % 2 === 1) {
    // x * 10^nd = k + 1/2 exactly, with k = (|q| * 5^nd - 1) / 2
    const k = (Math.abs(q) * 5 ** nd - 1) / 2;
    const even = k % 2 === 0 ? k : k + 1;
    return Math.sign(x) * Number((even / 10 ** nd).toFixed(nd));
  }
  return Number(x.toFixed(nd));
}

/**
 * Python 3.12+ `sum()` of floats: Neumaier compensated summation.
 * Using it keeps the port bit-for-bit close to the reference.
 */
export function pySum(xs: readonly number[]): number {
  let hi = 0;
  let lo = 0;
  for (const x of xs) {
    const t = hi + x;
    if (Math.abs(hi) >= Math.abs(x)) lo += hi - t + x;
    else lo += x - t + hi;
    hi = t;
  }
  return lo !== 0 && Number.isFinite(lo) ? hi + lo : hi;
}
