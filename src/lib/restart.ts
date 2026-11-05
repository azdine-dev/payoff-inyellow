/**
 * "Restart now" in one tap. The waiting version is told to take over, and the page reloads into it.
 * The service worker normally announces the change itself; if it does not, the page reloads after a short wait,
 * so the buyer never has to tap twice. A second tap while this runs does nothing.
 */
export function makeApplyUpdate(update: (reloadPage?: boolean) => Promise<void>, reload: () => void, waitMs = 1200): () => void {
  let running = false;
  return () => {
    if (running) return;
    running = true;
    void update(true).catch(() => undefined);
    setTimeout(reload, waitMs);
  };
}

/**
 * The hosting service can add its own badge or toolbar to the page. This app shows nothing of the kind, so
 * anything added by Netlify is taken off the page again, now and when it shows up later.
 */
export function removeHostingOverlays(doc: Document = document): void {
  const sweep = () => {
    const stray = doc.querySelectorAll('script[src*="netlify"], iframe[src*="netlify"], link[href*="netlify"], [id^="nl-"], [id^="netlify-"], [class*="netlify-"]');
    stray.forEach((el) => el.remove());
  };
  sweep();
  if (typeof MutationObserver === 'undefined') return;
  // Injected nodes are added straight to the head or the body, so watching their direct children is enough
  const watch = new MutationObserver(sweep);
  for (const node of [doc.head, doc.body]) if (node) watch.observe(node, { childList: true });
}
