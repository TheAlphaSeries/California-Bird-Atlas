// Offline support. The site keeps working at a marsh with no signal: pages, the field guide, your nine birds
// and photos you have already looked at all come from this browser's cache when the network is gone.
//
// Rule: always try the network first, so a push to GitHub shows up straight away, and keep a copy of every
// successful answer. Only when the network fails is the copy used. Editor-only data and anything sent
// (POST, PATCH, DELETE) is never cached. Raise VERSION to throw every cached copy away.
const VERSION = 'v3';
const CACHE = 'cba-' + VERSION;
// Fetched at install, so the core of the site works offline even before a page has been visited.
const CORE = ['/', '/this-season', '/css/atlas.css', '/css/magazine.css', '/js/app.js', '/js/util.js', '/js/wi.js', '/js/rotation.js',
  '/js/refphoto.js', '/js/issues.js', '/js/regionmap.js', '/js/calendar.js', '/js/i18n.js', '/js/hearts.js', '/js/viewer.js', '/js/stamps.js', '/js/sun.js', '/js/views/fieldwork.js', '/js/views/bird.js', '/js/views/theindex.js',
  '/js/views/fieldcard.js', '/js/views/cover.js', '/js/views/wall.js', '/data/wildindex.json', '/data/region-map.json', '/data/wall-samples.json',
  '/img/icon.svg', '/img/great-blue-heron.jpg'];
const API_OK = ['/api/bootstrap', '/api/wall', '/api/issues']; // public data worth keeping a copy of
const PHOTO_LIMIT = 400; // photos kept for offline viewing, oldest dropped first

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(CORE.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('cba-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimPhotos(cache) {
  const keys = (await cache.keys()).filter((r) => /\/media\/|upload\.wikimedia\.org/.test(r.url));
  for (const k of keys.slice(0, Math.max(0, keys.length - PHOTO_LIMIT))) await cache.delete(k);
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  const same = url.origin === self.location.origin;
  const isPhoto = (same && url.pathname.startsWith('/media/')) || url.hostname === 'upload.wikimedia.org';
  const isApi = same && url.pathname.startsWith('/api/');
  if (isApi && !API_OK.includes(url.pathname)) return; // editor data and lookups: network only
  if (!same && !isPhoto && url.hostname !== 'fonts.googleapis.com' && url.hostname !== 'fonts.gstatic.com') return;
  if (same && (url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/models/'))) return; // the 19 MB cut-out tool stays online-only
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') {
        // Page addresses all share one copy of the page shell, since the site builds every page in the browser.
        // API answers are kept under their path alone, so ?fresh=… requests don't pile up copies.
        const key = req.mode === 'navigate' ? '/' : isApi ? url.origin + url.pathname : req;
        cache.put(key, res.clone()).then(() => isPhoto && trimPhotos(cache)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await cache.match(req.mode === 'navigate' ? '/' : req, { ignoreSearch: isApi });
      if (hit) return hit;
      if (isApi) return new Response(JSON.stringify(url.pathname === '/api/bootstrap' ? null : []), { headers: { 'content-type': 'application/json' } });
      throw err;
    }
  })());
});
