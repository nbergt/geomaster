/* GeoMaster — als App installierbar machen (nur über http(s), z. B. GitHub Pages).
   Per Doppelklick (file://) tut diese Datei nichts: kein Manifest, kein
   Service Worker, kein Knopf. Unabhängig von app.js und den Sets. */

'use strict';

(() => {
  if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;

  // Manifest erst hier einhängen: unter file:// würde Chrome es nicht laden dürfen.
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = 'manifest.webmanifest';
  document.head.append(link);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ohne Offline-Speicher weiter */ });
    });
  }

  const knopf = document.querySelector('#installieren');
  const hinweis = document.querySelector('#installieren-hinweis');
  if (!knopf) return;
  const installiert = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (installiert) return;

  // Chrome, Edge, Android: eigener Knopf über das Ereignis des Browsers.
  let angebot = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    angebot = e;
    knopf.hidden = false;
  });
  knopf.addEventListener('click', async () => {
    if (!angebot) return;
    angebot.prompt();
    await angebot.userChoice.catch(() => null);
    angebot = null;
    knopf.hidden = true;
  });
  window.addEventListener('appinstalled', () => { knopf.hidden = true; if (hinweis) hinweis.hidden = true; });

  // iPhone/iPad (Safari) kennen das Ereignis nicht: kurzer Hinweis statt Knopf.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && hinweis) hinweis.hidden = false;
})();
