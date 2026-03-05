/**
 * ProtoPulse Service Worker
 *
 * Implements 5 cache strategies (cache-first, network-first, stale-while-revalidate,
 * network-only, cache-only), app shell pre-caching, cache versioning, background sync,
 * and message handling.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SW_VERSION = '1.0.0';
const CACHE_PREFIX = 'protopulse-v1';

/** App shell resources to pre-cache on install. */
const APP_SHELL = [
  '/',
  '/index.html',
];

/**
 * Route table: maps URL patterns to cache strategies.
 * Patterns use simple glob matching (* = any segment chars, ** = any path).
 * Evaluated in order — first match wins.
 */
const ROUTES = [
  { pattern: '/api/*', strategy: 'network-first', cacheName: `${CACHE_PREFIX}-api-data` },
  { pattern: '/*.js', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-app-shell` },
  { pattern: '/*.css', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-app-shell` },
  { pattern: '/*.html', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-app-shell` },
  { pattern: '/*.png', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-images` },
  { pattern: '/*.svg', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-images` },
  { pattern: '/*.ico', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-images` },
  { pattern: '/*.woff2', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-fonts` },
  { pattern: '/*.woff', strategy: 'cache-first', cacheName: `${CACHE_PREFIX}-fonts` },
];

const DEFAULT_CACHE_NAME = `${CACHE_PREFIX}-default`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a simple glob pattern to a RegExp.
 * Supports `*` (any chars except /) and `**` (any chars including /).
 */
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp('^' + escaped + '$');
}

/**
 * Find the matching route for a given URL pathname.
 * Returns { strategy, cacheName } or null for no match.
 */
function matchRoute(pathname) {
  for (const route of ROUTES) {
    if (globToRegex(route.pattern).test(pathname)) {
      return { strategy: route.strategy, cacheName: route.cacheName };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cache Strategies
// ---------------------------------------------------------------------------

/** Cache-first: serve from cache, fall back to network (and cache the response). */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Network-first: try network, fall back to cache. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Stale-while-revalidate: serve cache immediately, update in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Fire-and-forget the revalidation
    fetchPromise;
    return cached;
  }

  // No cache — must wait for network
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

/** Network-only: always fetch from network. */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/** Cache-only: only serve from cache. */
async function cacheOnly(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  return new Response('Not in cache', { status: 504, statusText: 'Cache Miss' });
}

/**
 * Dispatch a request to the appropriate strategy.
 */
function handleFetch(request, strategy, cacheName) {
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request, cacheName);
    case 'network-first':
      return networkFirst(request, cacheName);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request, cacheName);
    case 'network-only':
      return networkOnly(request);
    case 'cache-only':
      return cacheOnly(request, cacheName);
    default:
      return networkFirst(request, cacheName);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle Events
// ---------------------------------------------------------------------------

/** Install: pre-cache the app shell. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(`${CACHE_PREFIX}-app-shell`)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/** Activate: clean up old caches that don't match the current prefix. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('protopulse-') && !key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/** Fetch: route requests to the correct cache strategy. */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests for caching
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) schemes
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Only cache same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  const route = matchRoute(url.pathname);
  if (route) {
    event.respondWith(handleFetch(request, route.strategy, route.cacheName));
  } else {
    // Default: network-first for navigation, cache-first for assets
    const isNavigation = request.mode === 'navigate';
    const strategy = isNavigation ? 'network-first' : 'cache-first';
    event.respondWith(handleFetch(request, strategy, DEFAULT_CACHE_NAME));
  }
});

// ---------------------------------------------------------------------------
// Background Sync
// ---------------------------------------------------------------------------

self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-changes') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_TRIGGERED' });
        });
      })
    );
  }
});

// ---------------------------------------------------------------------------
// Message Handling
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data || typeof data.type !== 'string') {
    return;
  }

  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      if (event.source) {
        event.source.postMessage({ type: 'VERSION', version: SW_VERSION });
      }
      break;

    case 'CLEAR_CACHES':
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))
        );
      }).then(() => {
        if (event.source) {
          event.source.postMessage({ type: 'CACHES_CLEARED' });
        }
      });
      break;
  }
});
