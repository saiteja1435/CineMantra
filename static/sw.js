const STATIC_V  = 'cm-static-v4';
const API_V     = 'cm-api-v4';
const IMG_V     = 'cm-img-v4';
const ALL_CACHES = [STATIC_V, API_V, IMG_V];

// Core shell — always available offline
const SHELL = [
  '/',
  '/offline',
  '/watchlist',
  '/static/css/style.css',
  '/static/css/navbar.css',
  '/static/css/hero.css',
  '/static/css/cards.css',
  '/static/css/responsive.css',
  '/static/css/ai_chat.css',
  '/static/css/auth.css',
  '/static/css/movie.css',
  '/static/css/watchlist.css',
  '/static/js/utils.js',
  '/static/js/app.js',
  '/static/js/home.js',
  '/static/js/movie.js',
  '/static/js/watchlist.js',
  '/static/js/surprise.js',
  '/static/js/ai_chat.js',
  '/static/images/placeholder.svg',
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_V)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // TMDB / external images — cache first, long TTL
  if (url.hostname.includes('image.tmdb.org') || url.hostname.includes('img.youtube.com')) {
    e.respondWith(cacheFirst(req, IMG_V));
    return;
  }

  // Same-origin only below
  if (url.origin !== self.location.origin) return;

  // Static assets — cache first
  if (url.pathname.startsWith('/static/')) {
    e.respondWith(cacheFirst(req, STATIC_V));
    return;
  }

  // API — network first (4s timeout), stale cache fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirstAPI(req));
    return;
  }

  // HTML pages — network first, cache on success, offline fallback
  e.respondWith(networkFirstPage(req));
});

// ── Strategies ────────────────────────────────────────────────

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(cacheName);
      c.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function networkFirstAPI(req) {
  const url    = new URL(req.url);
  const cached = await caches.match(req);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const c = await caches.open(API_V);
      c.put(req, res.clone());
    }
    return res;
  } catch {
    clearTimeout(timer);
    if (cached) return cached;

    // Watchlist/recent — serve from DB via offline JSON
    if (url.pathname === '/api/watchlist' || url.pathname === '/api/recent') {
      return cached || jsonOffline([]);
    }
  // AI chat offline — return helpful message
    if (url.pathname === '/api/ai/chat') {
      return new Response(JSON.stringify({
        ok: true,
        reply: "You are offline. Please connect to the internet to use CineMantra AI. 🎬",
        movies: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return jsonOffline(null);
  }
}

async function networkFirstPage(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(STATIC_V);
      c.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // For /movie/* try the generic cached shell
    const offlinePage = await caches.match('/offline');
    return offlinePage || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}

function jsonOffline(data) {
  const body = data === null
    ? JSON.stringify({ ok: false, offline: true, error: 'You are offline' })
    : JSON.stringify({ ok: true,  offline: true, results: data });
  return new Response(body, {
    status: data === null ? 503 : 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── Background Sync: cache visited movie pages ────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_MOVIE') {
    const { url, apiUrl } = e.data;
    // Cache the movie HTML page
    caches.open(STATIC_V).then(c => c.add(url).catch(() => {}));
    // Cache the movie API response
    if (apiUrl) {
      fetch(apiUrl).then(res => {
        if (res.ok) caches.open(API_V).then(c => c.put(apiUrl, res));
      }).catch(() => {});
    }
  }
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
