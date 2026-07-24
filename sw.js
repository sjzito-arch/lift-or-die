// Bump this whenever any precached file changes — it's the only thing that
// forces stale caches to be replaced, since there's no build step to hash
// filenames (spec: fully offline-capable after first load).
const CACHE_VERSION = 'lift-or-die-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/activeExercise.js',
  './js/app.js',
  './js/audio.js',
  './js/dailyVote.js',
  './js/db.js',
  './js/exerciseTransition.js',
  './js/history.js',
  './js/loadCalculations.js',
  './js/rapidTapGuard.js',
  './js/rest.js',
  './js/restCards.js',
  './js/schema.js',
  './js/session.js',
  './js/setRecording.js',
  './js/settings.js',
  './js/setup.js',
  './js/statsCalculations.js',
  './js/workoutCompletion.js',
  './js/workoutScreen.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for the app shell: this is a personal, offline-first app with
// no server content that changes underneath it, so a working local copy
// always wins over waiting on the network. A navigation request that misses
// (e.g. a deep link with no matching cache entry) still falls back to the
// cached index.html rather than failing offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
