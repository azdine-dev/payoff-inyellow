/** Stand-in for the service worker helper in the single-file build (no service worker there). */
export function registerSW(): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
