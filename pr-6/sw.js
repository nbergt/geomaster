/* GeoMaster — Service Worker: macht die installierte App offline nutzbar.
   Nur bei Auslieferung über http(s) (GitHub Pages); per Doppelklick
   (file://) läuft die App ohne ihn. Strategie: erst das Netz (immer der
   neuste Stand), ohne Netz der Zwischenspeicher. Beim Installieren werden
   alle App-Dateien vorab gespeichert; tools/check.mjs prüft, dass DATEIEN
   jede Datei aus index.html enthält. */

'use strict';

// Ein Speicher pro Ort: die Hauptseite und jede PR-Vorschau (Unterordner
// pr-N/, siehe .github/workflows/pages.yml) haben ihren eigenen.
const VERSION = 'geomaster-v1';
const SPEICHER = `${VERSION} ${self.registration.scope}`;
const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/geo-ch.js',
  'js/data-ch.js',
  'js/wappen.js',
  'js/geo-eu.js',
  'js/data-eu.js',
  'js/flaggen-eu.js',
  'js/klima-eu.js',
  'js/klimadiagramm.js',
  'js/sets.js',
  'js/app.js',
  'js/pwa.js',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SPEICHER).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // Nur alte Versionen dieses Orts löschen, nicht die Speicher anderer Orte.
    .then(alle => Promise.all(alle
      .filter(k => k === VERSION ||               // Speicher der ersten Fassung (ohne Ort)
        (k !== SPEICHER && k.startsWith('geomaster-') && k.endsWith(' ' + self.registration.scope)))
      .map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== location.origin) return;
  // PR-Vorschauen in Unterordnern gehören nicht zur Hauptseite.
  if (/^pr-\d+\//.test(anfrage.url.slice(self.registration.scope.length))) return;
  e.respondWith(
    fetch(anfrage)
      .then(antwort => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(SPEICHER).then(c => c.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(() => caches.match(anfrage, { ignoreSearch: true })
        .then(t => t || (anfrage.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
