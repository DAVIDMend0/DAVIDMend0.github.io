// Service worker: lets DRIFTS open instantly and keep working with no signal.
//
// How updates work: the app always opens from the cache (fast), then quietly
// downloads the newest files in the background. Visitors see your changes the
// NEXT time they open the app. Bump CACHE_VERSION when you add, rename or remove
// files, so old copies get cleaned out.
const CACHE_VERSION = 'drifts-v7';
const APP_CACHE = `${CACHE_VERSION}-app`;
const CDN_CACHE = `${CACHE_VERSION}-cdn`;

const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/layout.css',
  'css/cards.css',
  'css/controls.css',
  'css/navigation.css',
  'css/lockout.css',
  'css/trips.css',
  'css/ats.css',
  'css/garage.css',
  'css/header.css',
  'css/sheet.css',
  'css/drivemode.css',
  'css/devmode.css',
  'css/preflight.css',
  'logo.webp',
  'js/state.js',
  'js/audio.js',
  'js/ui.js',
  'js/sensors.js',
  'js/session.js',
  'js/wheel.js',
  'js/ats.js',
  'js/ble.js',
  'js/trips.js',
  'js/vision.js',
  'js/fusion.js',
  'js/devmode.js',
  'js/maintenance.js',
  'js/gps.js',
  'js/settings.js',
  'js/sheet.js',
  'js/sos.js',
  'js/drivemode.js',
  'js/facecheck.js',
  'js/garage-backup.js',
  'js/main.js',
  'js/pwa.js',
  'portfolio-wrapper.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

// Third-party files that never change at a pinned version: safe to keep forever.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // MediaPipe + fonts: cache first (they are pinned, so they never change)
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req, CDN_CACHE));
    return;
  }

  // Our own files: serve the cached copy now, refresh it in the background
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, event));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  const res = await network;
  if (res) return res;
  // Offline and never cached: fall back to the app itself for page loads
  if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
  return Response.error();
}
