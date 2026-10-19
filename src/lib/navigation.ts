/**
 * Client-side navigation for the router in src/app/App.tsx.
 *
 * Pages do not receive a router instance, so a link is followed by writing the
 * History API entry and emitting the same `popstate` event the browser emits
 * for Back/Forward. Keeping it in one place means every page behaves the same
 * way: one history entry, one render, no full page reload.
 */
export function navigateInApp(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
