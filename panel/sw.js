// Pracownik w tle aplikacji „Bębny – panel”:
// – pozwala zainstalować panel jako aplikację i otworzyć go bez internetu (ostatnia zapisana wersja),
// – pokazuje powiadomienia o nowych zapytaniach od klientów.
const WERSJA = 'panel-v3';
const PLIKI = ['./', './index.html', './supabase.js', './manifest.webmanifest', './ikona-192.png', './ikona-512.png', './ikona-znaczek.png', '../config.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(WERSJA).then((c) => c.addAll(PLIKI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((klucze) => Promise.all(klucze.filter((k) => k !== WERSJA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Najpierw internet (zawsze świeży panel), a bez internetu – zapisana kopia.
// Baza danych i zdjęcia (Supabase) idą zawsze prosto do internetu.
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const swoj = url.origin === self.location.origin;
  if (!swoj) return;
  e.respondWith(
    // no-cache: przy internecie zawsze najnowsza wersja panelu (bez 10-minutowej pamięci serwera)
    fetch(r, { cache: 'no-cache' }).then((odp) => {
      if (odp.ok && (url.pathname.startsWith('/panel/') || url.pathname === '/config.js')) {
        const kopia = odp.clone();
        caches.open(WERSJA).then((c) => c.put(r, kopia));
      }
      return odp;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then((z) => z || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

// ---------- powiadomienia ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { tytul: e.data && e.data.text() }; }
  const tytul = d.tytul || 'Nowe zapytanie ze strony';
  e.waitUntil(self.registration.showNotification(tytul, {
    body: d.tresc || 'Otwórz panel, żeby zobaczyć szczegóły.',
    icon: 'ikona-192.png',
    badge: 'ikona-znaczek.png',
    tag: d.tag || 'zapytanie',
    renotify: true,
    data: { url: d.url || './#zapytania' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const cel = new URL(e.notification.data && e.notification.data.url || './#zapytania', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((okna) => {
    const panel = okna.find((o) => o.url.startsWith(self.registration.scope));
    if (panel) { panel.postMessage({ typ: 'otworz', url: cel }); return panel.focus(); }
    return self.clients.openWindow(cel);
  }));
});
