const APP_ID = 'vigabar-rango-amplitud-456-6x49';
const CACHE_NAME = 'vigabar-rango-amplitud-456-6x49-cache-v1';
const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

const OWN_ASSETS = [
  './',
  './index.html',
  './manifest-rango-amplitud-456.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-1024.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './favicon.ico'
];

function scopeUrl() {
  return new URL(self.registration.scope);
}

function isInsideOwnScope(url) {
  const scope = scopeUrl();
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

function relativeToScope(url) {
  const scope = scopeUrl();
  if (!isInsideOwnScope(url)) return null;
  return url.pathname.slice(scope.pathname.length);
}

function isOwnNavigation(request, url) {
  if (request.mode !== 'navigate') return false;
  const rel = relativeToScope(url);
  return rel === '' || rel === 'index.html';
}

function isOwnAsset(url) {
  if (!isInsideOwnScope(url)) return false;
  const rel = relativeToScope(url);
  const normalized = './' + rel;
  return OWN_ASSETS.includes(normalized) || (rel === '' && OWN_ASSETS.includes('./'));
}

async function ownCache() {
  return caches.open(CACHE_NAME);
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await ownCache();

    for (const rel of OWN_ASSETS) {
      try {
        const url = new URL(rel, self.registration.scope).href;
        const response = await fetch(url, { cache: 'reload' });
        if (response && response.ok) await cache.put(url, response.clone());
      } catch (_) {}
    }

    try {
      const response = await fetch(XLSX_URL, { cache: 'reload' });
      if (response && response.ok) await cache.put(XLSX_URL, response.clone());
    } catch (_) {}
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const ownNavigation = isOwnNavigation(event.request, url);
  const ownAsset = isOwnAsset(url);
  const ownExternal = url.href === XLSX_URL;

  if (!ownNavigation && !ownAsset && !ownExternal) return;

  if (ownNavigation) {
    event.respondWith((async () => {
      const cache = await ownCache();
      try {
        const response = await fetch(event.request);
        if (response && response.ok) {
          const indexUrl = new URL('./index.html', self.registration.scope).href;
          await cache.put(indexUrl, response.clone());
        }
        return response;
      } catch (_) {
        const exact = await cache.match(event.request);
        if (exact) return exact;
        const indexUrl = new URL('./index.html', self.registration.scope).href;
        const fallback = await cache.match(indexUrl);
        return fallback || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await ownCache();
    const cached = await cache.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response && response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
