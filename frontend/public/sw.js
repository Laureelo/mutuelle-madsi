// Service worker de MADSI : rend l'application installable sur téléphone et accélère son ouverture.
// Règle de prudence : les données (/api) ne sont JAMAIS mises en cache (finances, informations personnelles).
const CACHE = 'madsi-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon-192.png', '/manifest.webmanifest'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages : le réseau d'abord (toujours la dernière version), sinon la copie gardée (hors connexion)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((rep) => {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put('/', copie));
        return rep;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // Fichiers de l'application (noms avec empreinte) : le cache d'abord, mis à jour en arrière-plan
  event.respondWith(
    caches.match(req).then((enCache) => {
      const reseau = fetch(req).then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
        return rep;
      }).catch(() => enCache);
      return enCache || reseau;
    })
  );
});
