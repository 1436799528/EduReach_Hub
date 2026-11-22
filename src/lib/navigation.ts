/**
 * Client-side navigation for the router in src/app/App.tsx.
 *
 * Pages do not receive a router instance, so a link is followed by writing the
 * History API entry and emitting the same `popstate` event the browser emits
 * for Back/Forward. Keeping it in one place means every page behaves the same
 * way: one history entry, one render, no full page reload.
 */
export function navigateInApp(path: string, { replace = false }: { replace?: boolean } = {}): void {
  try {
    history.replaceState({ ...(history.state || {}), y: window.scrollY }, '', window.location.href);
  } catch {
    /* optional */
  }
  if (replace) window.history.replaceState({ y: 0 }, '', path);
  else window.history.pushState({ y: 0 }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
