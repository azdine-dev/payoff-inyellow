/** Which version this phone runs: "Version 1.0.4 · 9 Nov". The version is the one in package.json, the date is when it was built. */
declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
/** ISO time of the build (the dev server: when it started) */
export const BUILD_TIME: string | null = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "9 Nov", and "9 Nov 2025" when it was another year */
export function buildDateText(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const text = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? text : `${text} ${d.getFullYear()}`;
}

export function versionText(version: string = APP_VERSION, builtAt: string | null = BUILD_TIME, now: Date = new Date()): string {
  const date = buildDateText(builtAt, now);
  return `Version ${version}${date ? ` · ${date}` : ''}`;
}
