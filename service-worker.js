const CACHE_VERSION = 'v21';
const APP_SHELL_CACHE = `kitap-app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `kitap-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './assets/styles.css',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/maskable-512.png',
  './src/app.js',
  './src/isbn.js',
  './src/merge.js',
  './src/db.js',
  './src/pwa.js',
  './src/scanner.js',
  './src/providers/googleBooks.js',
  './src/providers/openLibrary.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_SHELL_CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

function isNavigation(request){
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (isNavigation(req)) {
    event.respondWith(fetch(req).catch(async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      return (await cache.match('./index.html')) || (await cache.match('./offline.html'));
    }));
    return;
  }

  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
    return;
  }

  if (req.method === 'GET') {
    event.respondWith(networkFirst(req));
  }
});

async function networkFirst(req){
  const cache = await caches.open(RUNTIME_CACHE);
  try{
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  }catch(e){
    const cached = await cache.match(req);
    return cached || new Response('', { status: 504, statusText: 'Offline' });
  }
}
