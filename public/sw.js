const CACHE_NAME = 'edureach-shell-v5';
const DYNAMIC_CACHE = 'edureach-dynamic-v5';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('edureach-') && key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache or replay API/authenticated responses across sessions.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/.netlify/') || request.headers.has('authorization')) return;

  // Always use a fresh document so a deployment cannot pin a stale JS bundle.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(fetch(request).catch(() => new Response(
      'EduReach is offline. Reconnect to load this page.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )));
    return;
  }

  // JavaScript/CSS bundles under /assets are deliberately NOT intercepted.
  // Hashed bundles are deployment-specific; serving an older cached chunk can
  // cause React lazy imports to fail after a new deployment. Let the browser/CDN
  // handle them normally. Only stable visual assets use this small cache.
  const isStableAsset = url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/news/photos/') || STATIC_ASSETS.includes(url.pathname);
  if (!isStableAsset) return;

  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && !/no-store|private/i.test(response.headers.get('cache-control') || '')) {
      const copy = response.clone();
      event.waitUntil(caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, copy)));
    }
    return response;
  }));
});
