const CACHE_NAME = 'recital-cache-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/image/icon-192.png',
  '/image/icon-512.png',
  'https://cdn.jsdelivr.net/npm/vuetify@3.3.8/dist/vuetify.min.css',
  'https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900',
  'https://cdn.jsdelivr.net/npm/@mdi/font@7.1.96/css/materialdesignicons.min.css',
  'https://unpkg.com/vue@3/dist/vue.global.prod.js',
  'https://cdn.jsdelivr.net/npm/vuetify@3.3.8/dist/vuetify.min.js'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  evt.respondWith(
    caches.match(evt.request).then((response) => {
      return response || fetch(evt.request);
    })
  );
});
