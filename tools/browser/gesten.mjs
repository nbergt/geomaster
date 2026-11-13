// Prüft Zoom, Verschieben, Pinch und Tipp-Erkennung mit echten (trusted)
// Maus- und Touch-Ereignissen sowie das Layout auf Handy und Tablet (T5–T7).
// Aufruf: node tools/browser/gesten.mjs [ordner] [bilder-ordner]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromeStarten, sleep, FESTER_ZUFALL } from './cdp.mjs';

const ORDNER = resolve(process.argv[2] || join(fileURLToPath(import.meta.url), '..', '..', '..'));
const BILDER = process.argv[3] ? resolve(process.argv[3]) : null;
if (BILDER) mkdirSync(BILDER, { recursive: true });

const b = await chromeStarten();
await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source: FESTER_ZUFALL });

let fehlschlaege = 0;
function pruefe(name, ok, info = '') {
  if (!ok) fehlschlaege++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${info ? '  — ' + info : ''}`);
}

const zustand = () => b.js(`(() => {
  const k = document.querySelector('#karte');
  const vb = k.getAttribute('viewBox').split(' ').map(Number);
  return { vb, s: 1000 / vb[2] * (vb[2] ? 1 : 0), antwort: !document.querySelector('#rueckmeldung').hidden,
           rueck: document.querySelector('#rueck-text').textContent };
})()`);
const karteRect = () => b.js(`(() => { const r = document.querySelector('#karte').getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const themaStarten = (titel, stufe) => b.js(`(() => {
  document.querySelector('#nach-hause').click();
  const li = [...document.querySelectorAll('#themenliste .thema')].find(l => l.querySelector('.thema-titel').textContent === ${JSON.stringify(titel)});
  li.querySelectorAll('.stufe-knopf')[${stufe - 1}].click(); })()`);
// Die Rückmeldung unter der Karte macht das Kartenfeld kleiner; deshalb den
// Kartenpunkt vor dem Tipp bestimmen und mit der gezeichneten Marke vergleichen.
const kartenPunkt = (x, y) => b.js(`(() => { const k = document.querySelector('#karte');
  const m = k.getScreenCTM(); const p = new DOMPoint(${x}, ${y}).matrixTransform(m.inverse());
  return { x: p.x, y: p.y, pxProEinheit: m.a }; })()`);
const markenAbstandPx = async erwartet => {
  const m = await b.js(`(() => { const c = document.querySelector('#karte .tipp-marke');
    return [+c.getAttribute('cx'), +c.getAttribute('cy')]; })()`);
  return Math.hypot(m[0] - erwartet.x, m[1] - erwartet.y) * erwartet.pxProEinheit;
};
const weiter = () => b.js(`document.querySelector('#weiter').click()`);
const bild = async name => {
  if (!BILDER) return;
  const { data } = await b.cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(BILDER, name + '.png'), Buffer.from(data, 'base64'));
};

// ── Maus ─────────────────────────────────────────────────────────────────
const maus = (type, x, y, extra = {}) => b.cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
async function klick(x, y, button = 'left') {
  await maus('mousePressed', x, y, { button, buttons: button === 'left' ? 1 : 2 });
  await maus('mouseReleased', x, y, { button, buttons: 0 });
}
async function ziehenMaus(x, y, dx, dy) {
  await maus('mousePressed', x, y);
  for (let i = 1; i <= 10; i++) await maus('mouseMoved', x + dx * i / 10, y + dy * i / 10);
  await maus('mouseReleased', x + dx, y + dy);
}

// ── Touch ────────────────────────────────────────────────────────────────
const touch = (type, punkte) => b.cdp('Input.dispatchTouchEvent', { type, touchPoints: punkte });
async function tipp(x, y) {
  await touch('touchStart', [{ x, y, id: 1 }]);
  await touch('touchEnd', []);
}
async function wischen(x, y, dx, dy) {
  await touch('touchStart', [{ x, y, id: 1 }]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: x + dx * i / 10, y: y + dy * i / 10, id: 1 }]);
  await touch('touchEnd', []);
}
async function pinch(cx, cy, von, bis) {
  await touch('touchStart', [{ x: cx - von / 2, y: cy, id: 1 }, { x: cx + von / 2, y: cy, id: 2 }]);
  for (let i = 1; i <= 12; i++) {
    const d = von + (bis - von) * i / 12;
    await touch('touchMove', [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }]);
  }
  await touch('touchEnd', []);
}

// Layout: kein horizontales Scrollen, sichtbare Knöpfe ≥ 44 px hoch.
const layout = () => b.js(`(() => {
  const zuKlein = [...document.querySelectorAll('button')].filter(k => {
    const r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; })
    .map(k => (k.id || k.className) + ':' + Math.round(k.getBoundingClientRect().height));
  const breit = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth,
    ...[...document.querySelectorAll('.schirm')].filter(s => !s.hidden).map(s => s.scrollWidth - s.clientWidth + innerWidth));
  return { hscroll: breit > innerWidth + 0.5, breit, innen: innerWidth, zuKlein };
})()`);

try {
  /* ══ Desktop (Maus) ══════════════════════════════════════════════════ */
  await b.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.laden(pathToFileURL(join(ORDNER, 'index.html')).href);
  await b.neuLaden(`localStorage.clear(); location.reload()`);

  await themaStarten('Kantone', 3);
  let r = await karteRect();
  const mx = r.x + r.w / 2, my = r.y + r.h / 2;
  await b.cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mx, y: my, deltaX: 0, deltaY: -400 });
  await sleep(50);
  let z = await zustand();
  pruefe('Desktop: Mausrad zoomt', z.vb[2] < 1000, `viewBox ${z.vb.map(v => v.toFixed(1)).join(' ')}`);
  pruefe('Desktop: Mausrad löst keine Antwort aus', !z.antwort);

  const vorher = z.vb;
  await ziehenMaus(mx, my, 120, 60);
  z = await zustand();
  pruefe('Desktop: Ziehen verschiebt', z.vb[0] < vorher[0] && z.vb[1] < vorher[1], `x ${vorher[0].toFixed(1)}→${z.vb[0].toFixed(1)}`);
  pruefe('Desktop: Ziehen löst keine Antwort aus', !z.antwort);

  await klick(mx, my, 'right');
  z = await zustand();
  pruefe('Desktop: rechte Maustaste antwortet nicht', !z.antwort);

  const erwartetD = await kartenPunkt(mx, my);
  await klick(mx, my);
  z = await zustand();
  pruefe('Desktop: Klick antwortet (gezoomt)', z.antwort, z.rueck);
  const abD = await markenAbstandPx(erwartetD);
  pruefe('Desktop: Klickmarke sitzt unter dem Zeiger', abD < 1, `Abstand ${abD.toFixed(2)} px`);
  await bild('desktop-gezoomt-antwort');

  await weiter();
  z = await zustand();
  pruefe('Desktop: nächste Frage setzt Zoom zurück', z.vb.join(' ') === '0 0 1000 641', z.vb.join(' '));

  await b.js(`document.querySelector('#zoom-rein').click()`);
  z = await zustand();
  pruefe('Desktop: Knopf + zoomt', z.vb[2] < 1000);
  for (let i = 0; i < 8; i++) await b.js(`document.querySelector('#zoom-rein').click()`);
  z = await zustand();
  pruefe('Desktop: Zoom höchstens 8×', Math.abs(1000 / z.vb[2] - 8) < 1e-6, `${(1000 / z.vb[2]).toFixed(3)}×`);
  await b.js(`document.querySelector('#zoom-raus').click()`);
  z = await zustand();
  pruefe('Desktop: Knopf − verkleinert', 1000 / z.vb[2] < 8);
  await b.js(`document.querySelector('#zoom-reset').click()`);
  z = await zustand();
  pruefe('Desktop: Knopf ⤢ zeigt die ganze Karte', z.vb.join(' ') === '0 0 1000 641');

  // Schrift und Strich bleiben beim Zoomen gleich gross (Stufe 1, Namen sichtbar).
  await themaStarten('Kantone', 1);
  const mass = () => b.js(`(() => {
    const t = document.querySelector('#karte .marke'); const h = t.getBoundingClientRect().height;
    const k = document.querySelector('#karte .kanton'); const ctm = k.getScreenCTM();
    return { schrift: h, strich: parseFloat(getComputedStyle(k).strokeWidth) * ctm.a,
             punkt: null }; })()`);
  const m1 = await mass();
  await bild('desktop-stufe1-1x');
  r = await karteRect();
  for (let i = 0; i < 3; i++) await b.js(`document.querySelector('#zoom-rein').click()`);
  await sleep(300);
  const m4 = await mass();
  await bild('desktop-stufe1-zoom');
  pruefe('Desktop: Schrift bleibt gleich gross', Math.abs(m4.schrift / m1.schrift - 1) < 0.08, `${m1.schrift.toFixed(1)} → ${m4.schrift.toFixed(1)} px`);
  pruefe('Desktop: Kantonsgrenze bleibt gleich dick', Math.abs(m4.strich / m1.strich - 1) < 0.02, `${m1.strich.toFixed(2)} → ${m4.strich.toFixed(2)} px`);

  await themaStarten('Pässe', 1);
  const p1 = await b.js(`document.querySelector('#karte .punkt').getBoundingClientRect().width`);
  for (let i = 0; i < 3; i++) await b.js(`document.querySelector('#zoom-rein').click()`);
  await sleep(300);
  const p4 = await b.js(`document.querySelector('#karte .punkt').getBoundingClientRect().width`);
  pruefe('Desktop: Pass-Symbol bleibt gleich gross', Math.abs(p4 / p1 - 1) < 0.05, `${p1.toFixed(1)} → ${p4.toFixed(1)} px`);
  await bild('desktop-paesse-zoom');

  /* ══ Handy und Tablet (Touch) ═══════════════════════════════════════ */
  for (const [name, w, h] of [['Handy', 360, 740], ['iPad', 768, 1024]]) {
    await b.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await b.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await b.cdp('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    await b.neuLaden(`localStorage.clear(); location.reload()`);
    await sleep(100);

    let l = await layout();
    pruefe(`${name}: Startseite ohne horizontales Scrollen`, !l.hscroll, `${l.breit}/${l.innen}`);
    pruefe(`${name}: Startseite Knöpfe ≥ 44 px`, !l.zuKlein.length, l.zuKlein.join(', '));
    await bild(`${name}-start`);

    await themaStarten('Kantone', 3);
    await sleep(50);
    l = await layout();
    pruefe(`${name}: Quiz ohne horizontales Scrollen`, !l.hscroll, `${l.breit}/${l.innen}`);
    pruefe(`${name}: Quiz Knöpfe ≥ 44 px`, !l.zuKlein.length, l.zuKlein.join(', '));
    r = await karteRect();
    pruefe(`${name}: Karte füllt die Breite`, r.w >= w - 60, `${r.w.toFixed(0)} von ${w} px`);
    await bild(`${name}-quiz`);

    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    await pinch(cx, cy, 60, 220);
    z = await zustand();
    pruefe(`${name}: Pinch zoomt`, z.vb[2] < 1000, `${(1000 / z.vb[2]).toFixed(2)}×`);
    pruefe(`${name}: Pinch löst keine Antwort aus`, !z.antwort);

    const vb0 = z.vb;
    await wischen(cx, cy, -80, -40);
    z = await zustand();
    pruefe(`${name}: Ziehen verschiebt`, z.vb[0] > vb0[0], `x ${vb0[0].toFixed(1)}→${z.vb[0].toFixed(1)}`);
    pruefe(`${name}: Ziehen löst keine Antwort aus`, !z.antwort);

    const erwartetT = await kartenPunkt(cx + 5, cy + 3);
    await wischen(cx, cy, 5, 3);                      // kleines Zittern = Tipp
    z = await zustand();
    pruefe(`${name}: Tipp mit leichtem Zittern antwortet`, z.antwort, z.rueck);
    const abT = await markenAbstandPx(erwartetT);
    pruefe(`${name}: Tippmarke sitzt unter dem Finger`, abT < 1, `Abstand ${abT.toFixed(2)} px`);
    await bild(`${name}-gezoomt-antwort`);

    await weiter();
    z = await zustand();
    pruefe(`${name}: nächste Frage setzt Zoom zurück`, z.vb.join(' ') === '0 0 1000 641');
    await tipp(cx, cy);
    z = await zustand();
    pruefe(`${name}: Tipp bei 1× antwortet`, z.antwort);

    await b.js(`document.querySelector('#zoom-rein').click()`);
    await b.js(`document.querySelector('#zoom-reset').click()`);
    z = await zustand();
    pruefe(`${name}: ⤢ setzt zurück`, z.vb.join(' ') === '0 0 1000 641');

    // Alle Themen und Stufen: Layout und Tippfeld.
    const titel = await b.js(`[...document.querySelectorAll('.thema-titel')].map(t => t.textContent)`);
    for (const t of titel) for (let s = 1; s <= 4; s++) {
      await themaStarten(t, s);
      await sleep(20);
      l = await layout();
      if (l.hscroll || l.zuKlein.length) pruefe(`${name}: ${t} Stufe ${s} Layout`, false, `${l.breit}/${l.innen} ${l.zuKlein.join(', ')}`);
      const feld = await b.js(`(() => { const i = document.querySelector('.tippfeld input'); if (!i) return null;
        const r = i.getBoundingClientRect(); return { oben: r.top, unten: r.bottom, h: innerHeight }; })()`);
      if (feld) {
        if (feld.unten > feld.h || feld.oben < 0) pruefe(`${name}: ${t} Stufe ${s} Tippfeld sichtbar`, false, JSON.stringify(feld));
        if (t === 'Hauptorte' && s === 3) await bild(`${name}-tippfeld`);
      }
    }
    pruefe(`${name}: alle Themen/Stufen ohne Layoutfehler, Tippfeld sichtbar`, true);

    // Ergebnisschirm
    await themaStarten('Kantone', 1);
    for (let i = 0; i < 26; i++) {
      const fertig = await b.js(`!document.querySelector('#ergebnis').hidden`);
      if (fertig) break;
      const rr = await karteRect();
      await tipp(rr.x + rr.w * 0.5, rr.y + rr.h * 0.5);
      await weiter();
    }
    l = await layout();
    pruefe(`${name}: Ergebnis ohne horizontales Scrollen, Knöpfe ≥ 44 px`, !l.hscroll && !l.zuKlein.length, l.zuKlein.join(', '));
    await bild(`${name}-ergebnis`);
  }

  pruefe('Keine Konsolenfehler', !b.fehler.length, b.fehler.join(' | '));
  const fremd = b.netz.filter(u => !u.startsWith('file:') && !u.startsWith('data:'));
  pruefe('Nur file:// und data: geladen', !fremd.length, fremd.join(', '));
} finally {
  b.ende();
}
console.log(fehlschlaege ? `\n${fehlschlaege} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exitCode = fehlschlaege ? 1 : 0;
