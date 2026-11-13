// Erzeugt die PNG-Icons der App aus icons/icon.svg und icons/icon-maskable.svg
// (headless Chrome wie die Browser-Prüfungen; Pfad über die Umgebungsvariable CHROME).
//   node tools/build-icons.mjs
//
// icons/apple-touch-icon.png   180 px  iPhone/iPad «Zum Home-Bildschirm»
// icons/icon-192.png           192 px  Manifest
// icons/icon-512.png           512 px  Manifest
// icons/icon-maskable-512.png  512 px  Manifest, «maskable» (Android schneidet zu)
// Bei einem Fehler wird nichts geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeStarten } from './browser/cdp.mjs';

const ICONS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const AUFTRAG = [
  ['icon.svg', 'apple-touch-icon.png', 180, true],     // iOS rundet selbst: randlos, ohne Transparenz
  ['icon.svg', 'icon-192.png', 192, false],
  ['icon.svg', 'icon-512.png', 512, false],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512, false],
];

const b = await chromeStarten({ breite: 600, hoehe: 600 });
const fertig = new Map();
try {
  for (const [quelle, ziel, px, randlos] of AUFTRAG) {
    const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fs.readFileSync(path.join(ICONS, quelle), 'utf8'));
    await b.cdp('Emulation.setDeviceMetricsOverride', { width: px, height: px, deviceScaleFactor: 1, mobile: false });
    await b.cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    // Für das Apple-Icon den Hintergrund der Kachel randlos füllen (iOS rundet selbst ab).
    const html = `<!doctype html><html><body style="margin:0;background:${randlos ? '#2a241c' : 'transparent'}">` +
      `<img src="${svg}" style="display:block;width:${px}px;height:${px}px"></body></html>`;
    await b.laden('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const ok = await b.js(`new Promise(r => { const i = document.querySelector('img'); i.complete ? r(i.naturalWidth > 0) : (i.onload = () => r(true), i.onerror = () => r(false)); })`);
    if (!ok) throw new Error(`${quelle} lässt sich nicht laden`);
    const { data } = await b.cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: px, height: px, scale: 1 } });
    fertig.set(ziel, Buffer.from(data, 'base64'));
  }
} finally {
  b.ende();
}

// Erst schreiben, wenn alle Bilder da sind.
for (const [ziel, png] of fertig) {
  if (png.readUInt32BE(16) !== png.readUInt32BE(20)) throw new Error(`${ziel}: nicht quadratisch`);
}
for (const [ziel, png] of fertig) {
  fs.writeFileSync(path.join(ICONS, ziel), png);
  console.log(`geschrieben: icons/${ziel}  (${png.readUInt32BE(16)} px, ${(png.length / 1024).toFixed(1)} KB)`);
}
