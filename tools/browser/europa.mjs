// Prüft das Set Europa im Browser (Testcheckliste T2, T6–T15) mit echten
// Maus- und Touch-Ereignissen. Fragen werden gezielt gesetzt (lauf.fragen),
// geklickt wird auf Bildschirmkoordinaten wie ein Mensch.
// Aufruf: node tools/browser/europa.mjs [ordner] [bilder-ordner]
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
const bild = async name => {
  if (!BILDER) return;
  const { data } = await b.cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(BILDER, name + '.png'), Buffer.from(data, 'base64'));
};

// ── Hilfen in der Seite ──────────────────────────────────────────────────
const setWaehlen = titel => b.js(`[...document.querySelectorAll('.set-knopf')].find(k => k.textContent === ${JSON.stringify(titel)}).click()`);
// Runde starten und die erste Frage auf den gewünschten Eintrag setzen.
const frageSetzen = (themaId, stufe, key) => b.js(`(() => {
  const t = THEMEN.find(t => t.id === ${JSON.stringify(themaId)});
  rundeStarten(t, ${stufe});
  const it = t.items.find(i => i.key === ${JSON.stringify(key)});
  if (!it) throw new Error('kein Eintrag ' + ${JSON.stringify(key)});
  lauf.fragen = [it]; lauf.idx = 0; frageZeigen();
  return it.frage;
})()`);
// Bildschirmpunkt zu geografischen Koordinaten bzw. zum Anker eines Eintrags.
const bildschirm = ausdruck => b.js(`(() => {
  const [x, y] = ${ausdruck};
  const p = new DOMPoint(x, y).matrixTransform(karte.getScreenCTM());
  return [p.x, p.y];
})()`);
const geoPunkt = (lon, lat) => bildschirm(`SET.geo.project(${lon}, ${lat})`);
const ergebnis = () => b.js(`({ offen: document.querySelector('#rueckmeldung').hidden,
  text: document.querySelector('#rueck-text').textContent })`);
const speicher = () => b.js(`Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))`);

const maus = (type, x, y) => b.cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
async function klick([x, y]) { await maus('mousePressed', x, y); await maus('mouseReleased', x, y); await sleep(20); }
async function tipp([x, y]) {
  await b.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await b.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(20);
}
async function antwort(punkt, art = klick) {
  await art(punkt);
  const e = await ergebnis();
  return { richtig: !e.offen && e.text.startsWith('✓'), text: e.text, beantwortet: !e.offen };
}
const eintippen = async text => {
  await b.js(`document.querySelector('.tippfeld input').value = ${JSON.stringify(text)}; document.querySelector('.tippfeld .knopf').click()`);
  return ergebnis();
};

try {
  await b.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await b.laden(pathToFileURL(join(ORDNER, 'index.html')).href);
  // CH-Fortschritt vorbelegen (wie T1), dann zu Europa wechseln.
  await b.neuLaden(`localStorage.clear(); localStorage.setItem('geomaster.fortschritt.v1', JSON.stringify({
    'kantone|1|BE': { serie: 2, versuche: 2, treffer: 2 }, 'hauptorte|1|BE': { serie: 1, versuche: 1, treffer: 1 },
    'kantone|1|FR': { serie: 3, versuche: 3, treffer: 3 }, 'kantone|1|GE': { serie: 1, versuche: 4, treffer: 1 } }));
    location.reload()`);
  const chVorher = (await speicher())['geomaster.fortschritt.v1'];

  await setWaehlen('Europa');
  let r = await b.js(`({ titel: document.title, sub: document.querySelector('.wortmarke-sub').textContent,
    aria: karte.getAttribute('aria-label'), set: localStorage.getItem('geomaster.set.v1'), themen: THEMEN.map(t => t.titel) })`);
  pruefe('Umschalter: Europa aktiv, Texte aus dem Set', r.sub === 'Blatt 2 : Europa' && r.aria === 'Karte von Europa' && r.set === 'eu',
    `${r.titel} | ${r.sub} | ${r.aria}`);
  const THEMEN_EU = 'Länder,Hauptstädte,Städte,Flaggen,Autokennzeichen,Flüsse,Gebirge,Gipfel,Meere und Meerengen,' +
    'Inseln und Halbinseln,Klimazonen,Klimadiagramme';
  pruefe('Europa hat 12 Themen', r.themen.join(',') === THEMEN_EU, r.themen.join(', '));

  /* ── T2: keine Kollision der Kürzel ── */
  for (const iso of ['BE', 'FR', 'LU']) {
    for (let i = 0; i < 3; i++) {
      await frageSetzen('laender', 1, iso);
      const a = await antwort(await bildschirm(`ankerVon(THEMEN[0].items.find(i => i.key === '${iso}').ziel)`));
      if (!a.richtig) pruefe(`T2: ${iso} in EU-Länder Stufe 1 richtig`, false, a.text);
    }
  }
  let sp = await speicher();
  const eu = JSON.parse(sp['geomaster.eu.fortschritt.v1'] || '{}');
  pruefe('T2: EU speichert unter geomaster.eu.fortschritt.v1', ['BE', 'FR', 'LU'].every(k => eu[`laender|1|${k}`]?.serie === 3),
    ['BE', 'FR', 'LU'].map(k => `${k}:${eu[`laender|1|${k}`]?.serie}`).join(' '));
  pruefe('T2: CH-Fortschritt (Bern, Freiburg, Genf) unverändert', sp['geomaster.fortschritt.v1'] === chVorher);

  await setWaehlen('Schweiz');
  for (let i = 0; i < 3; i++) {
    await frageSetzen('kantone', 1, 'BE');
    await antwort(await bildschirm(`ankerVon(THEMEN[0].items.find(i => i.key === 'BE').ziel)`));
  }
  sp = await speicher();
  const ch = JSON.parse(sp['geomaster.fortschritt.v1']);
  pruefe('T2: umgekehrt — CH Bern zählt, EU unverändert', ch['kantone|1|BE'].serie === 5 &&
    sp['geomaster.eu.fortschritt.v1'] === JSON.stringify(eu), `CH kantone|1|BE serie ${ch['kantone|1|BE'].serie}`);
  r = await b.js(`({ sub: document.querySelector('.wortmarke-sub').textContent, n: THEMEN.length, set: localStorage.getItem('geomaster.set.v1') })`);
  pruefe('Zurück zur Schweiz: Blatt 1, 9 Themen', r.sub === 'Blatt 1 : Schweiz' && r.n === 9 && r.set === 'ch');
  await setWaehlen('Europa');

  /* ── T8: Toleranz Europa ── */
  const finger = await b.js('fingerKm()');
  const tolPunkt = await b.js(`toleranzKm('punkt')`);
  await frageSetzen('hauptstaedte', 4, 'FR');
  const paris = [2.3522, 48.8567], kmProGrad = 111.32 * Math.cos(paris[1] * Math.PI / 180);
  let a = await antwort(await geoPunkt(paris[0] + 60 / kmProGrad, paris[1]));
  pruefe('T8: 60 km neben Paris ist richtig (Hauptstädte Stufe 4)', a.richtig, `${a.text} | Toleranz ${tolPunkt.toFixed(0)} km, Finger ${finger.toFixed(0)} km`);
  await frageSetzen('hauptstaedte', 4, 'FR');
  a = await antwort(await geoPunkt(paris[0] + 150 / kmProGrad, paris[1]));
  pruefe('T8: 150 km neben Paris ist falsch', !a.richtig && a.beantwortet, a.text);
  await frageSetzen('laender', 3, 'FR');
  a = await antwort(await geoPunkt(2.0, 47.0));
  pruefe('Länder Stufe 3: Klick mitten in Frankreich richtig', a.richtig, a.text);
  await frageSetzen('fluesse', 3, 'Donau');
  a = await antwort(await geoPunkt(19.05, 47.6));
  pruefe('Flüsse Stufe 3: Klick bei Budapest richtig für die Donau', a.richtig, a.text);
  await frageSetzen('fluesse', 3, 'Donau');
  a = await antwort(await geoPunkt(21.0, 52.2));
  pruefe('Flüsse Stufe 3: Klick bei Warschau falsch für die Donau', !a.richtig, a.text);

  // Vatikanstadt neben Italien (Stufe 1–2: Punkt gewinnt nur im Fingerradius).
  await frageSetzen('laender', 1, 'VA');
  a = await antwort(await geoPunkt(9.19, 45.46));                       // Mailand
  pruefe('T8: Frage Vatikanstadt, Klick in Mailand ist falsch', !a.richtig, a.text);
  await frageSetzen('laender', 1, 'VA');
  a = await antwort(await bildschirm(`SET.geo.project(...(() => { const k = SET.geo.kleinstaaten.find(k => k.iso === 'VA'); return [k.lon, k.lat]; })())`));
  pruefe('T8: Frage Vatikanstadt, Klick auf den Punkt ist richtig', a.richtig, a.text);
  await frageSetzen('laender', 1, 'IT');
  a = await antwort(await geoPunkt(9.19, 45.46));
  pruefe('Frage Italien, Klick in Mailand ist richtig', a.richtig, a.text);
  await frageSetzen('laender', 1, 'LU');
  a = await antwort(await geoPunkt(6.1, 49.8));
  pruefe('Frage Luxemburg, Klick in die Fläche ist richtig', a.richtig, a.text);

  /* ── T9: Text ── */
  r = await b.js(`(() => {
    const th = id => THEMEN.find(t => t.id === id), it = (t, k) => t.items.find(i => i.key === k);
    const L = th('laender'), H = th('hauptstaedte');
    return {
      irland: textPasst('Irland', it(L, 'IS'), L), island: textPasst('Island', it(L, 'IS'), L),
      tippfehler: textPasst('Islnd', it(L, 'IS'), L), irlandIE: textPasst('Irland', it(L, 'IE'), L),
      kyjiw: textPasst('Kyjiw', it(H, 'UA'), H), belarus: textPasst('Belarus', it(L, 'BY'), L),
      moldau: textPasst('Moldau', it(L, 'MD'), L), weissr: textPasst('Weißrussland', it(L, 'BY'), L),
      vk: textPasst('Vereinigtes Königreich', it(L, 'GB'), L), maz: textPasst('Mazedonien', it(L, 'MK'), L),
      kisch: textPasst('Kischinau', it(H, 'MD'), H), denhaag: textPasst('Den Haag', it(H, 'NL'), H),
      frankreich: textPasst('Frankreih', it(L, 'FR'), L), polen: textPasst('Pohlen', it(L, 'PL'), L),
    };
  })()`);
  pruefe('T9: «Irland» bei der Frage nach Island ist falsch', r.irland === false && r.island === true && r.irlandIE === true);
  pruefe('T9: «Kyjiw» gilt für Kiew, «Belarus»/«Weissrussland» für Weissrussland, «Moldau» für Moldawien', r.kyjiw && r.belarus && r.moldau && r.weissr);
  pruefe('Schreibweisen: Vereinigtes Königreich, Mazedonien, Kischinau gelten', r.vk && r.maz && r.kisch);
  pruefe('Den Haag gilt nicht als Hauptstadt der Niederlande', r.denhaag === false);
  pruefe('Ein Tippfehler wird ab 6 Buchstaben weiter verziehen («Frankreih»), darunter nicht («Pohlen»)', r.frankreich === true && r.polen === false);
  await frageSetzen('hauptstaedte', 3, 'UA');
  let e = await eintippen('Kyjiw');
  pruefe('T9 in der Oberfläche: «Kyjiw» eintippen ist richtig', e.text.startsWith('✓'), e.text);
  await frageSetzen('hauptstaedte', 3, 'NL');
  e = await eintippen('Amsterdam');
  pruefe('Hinweis zur Hauptstadt erscheint (Den Haag)', /Den Haag/.test(e.text), e.text);

  /* ── T10: Kennzeichen ── */
  r = await b.js(`Object.fromEntries(THEMEN.find(t => t.id === 'kennzeichen').items.filter(i => ['DE','GB','MK','XK'].includes(i.key)).map(i => [i.key, i.beigabe.kuerzel]))`);
  pruefe('T10: D, UK, NMK, RKS', r.DE === 'D' && r.GB === 'UK' && r.MK === 'NMK' && r.XK === 'RKS', JSON.stringify(r));
  await frageSetzen('kennzeichen', 1, 'GB');
  r = await b.js(`document.querySelector('#frage-beigabe .kuerzel')?.textContent`);
  pruefe('T10: Kennzeichen «UK» wird angezeigt', r === 'UK', r);
  await bild('eu-kennzeichen');

  /* ── T11: ausgeschlossene Länder ── */
  r = await b.js(`(() => {
    const verboten = ['GE', 'AM', 'AZ', 'KZ'], namen = ['Georgien', 'Armenien', 'Aserbaidschan', 'Kasachstan', 'Tiflis', 'Eriwan', 'Baku', 'Astana'];
    const items = THEMEN.flatMap(t => t.items);
    return {
      fragen: items.filter(i => verboten.includes(i.key) || namen.some(n => JSON.stringify(i).includes(n))).length,
      dom: [...karte.querySelectorAll('[data-key]')].filter(e => verboten.includes(e.dataset.key)).length,
      stoff: namen.filter(n => JSON.stringify(STOFF).includes(n)),
      formen: verboten.filter(v => FORM.staat.has(v)),
    };
  })()`);
  pruefe('T11: GE, AM, AZ, KZ nicht in Fragen, Stoff, Formen, Karte', !r.fragen && !r.dom && !r.stoff.length && !r.formen.length, JSON.stringify(r));
  await frageSetzen('laender', 1, 'TR');
  a = await antwort(await geoPunkt(44.8, 41.7));                        // Tiflis
  r = await b.js(`[...karte.querySelectorAll('.marke')].some(m => /Georgien|Armenien|Aserbaidschan|Kasachstan/.test(m.textContent))`);
  pruefe('T11: Klick auf Tiflis wird wie ein Klick ins Leere bewertet (nächstes Land), kein Name', !/Georgien/.test(a.text) && !r, a.text);
  await frageSetzen('flaggen', 1, 'TR');
  r = await b.js(`[...document.querySelectorAll('#antwortfeld .wahl')].map(w => w.textContent)`);
  pruefe('T11: Auswahl ohne ausgeschlossene Länder', !r.some(n => /Georgien|Armenien|Aserbaidschan|Kasachstan/.test(n)), r.join(', '));
  await bild('eu-flaggen-auswahl');

  /* ── T12: Stufe 4 ── */
  const markiert = () => b.js(`(() => {
    const m = karte.querySelector('.aufloesung .frage-form, .aufloesung .frage-punkt');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return { art: m.getAttribute('class'), b: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  for (const [thema, key, eingabe, name] of [['laender', 'FR', 'Frankreich', 'Land'], ['laender', 'MC', 'Monaco', 'Kleinstaat'],
    ['fluesse', 'Rhein', 'Rhein', 'Fluss'], ['gebirge', 'Karpaten', 'Karpaten', 'Gebirge'], ['gipfel', 'Mont Blanc', 'Mont Blanc', 'Gipfel']]) {
    await frageSetzen(thema, 4, key);
    await sleep(80);
    const m = await markiert();
    await bild(`eu-stufe4-${name}`);
    e = await eintippen(eingabe);
    pruefe(`T12: ${name} (${key}) auf Stufe 4 markiert und benennbar`, m && m.b >= 4 && m.h >= 4 && e.text.startsWith('✓'), `${JSON.stringify(m)} ${e.text}`);
  }

  /* ── T13: Meere, Meerengen, Inseln (Lernkontrolle Europa) auf der Blanko-Karte ── */
  for (const [thema, key, lon, lat] of [['meere', 'Bosporus', 29.05, 41.1], ['meere', 'Nordsee', 3.5, 56],
    ['meere', 'Ägäisches Meer', 25, 38.5], ['inseln', 'Sizilien', 14.2, 37.5], ['inseln', 'Krim', 34.2, 45.1],
    ['staedte', 'Hamburg', 10, 53.55], ['gebirge', 'Zentralmassiv', 2.8, 45.2], ['fluesse', 'Nördliche Dwina', 41.5, 63.5]]) {
    await frageSetzen(thema, 3, key);
    a = await antwort(await geoPunkt(lon, lat));
    pruefe(`T13: ${key} (${thema}) auf der Blanko-Karte`, a.richtig, a.text);
  }
  await frageSetzen('meere', 3, 'Nordsee');
  a = await antwort(await geoPunkt(19, 58));                       // Ostsee statt Nordsee
  pruefe('T13: Klick in die Ostsee zählt nicht als Nordsee', a.beantwortet && !a.richtig, a.text);

  /* ── T14: Klimazonen und Klimadiagramme ── */
  for (const [key, lon, lat] of [['ozeanisch', -1.5, 52.5], ['kontinental', 37.6, 55.7], ['mittelmeer', 14.3, 37.4]]) {
    await frageSetzen('klimazonen', 3, key);
    a = await antwort(await geoPunkt(lon, lat));
    pruefe(`T14: Klimazone ${key} auf der Blanko-Karte`, a.richtig, a.text);
  }
  await frageSetzen('klimadiagramme', 2, 'Kiruna');
  r = await b.js(`(() => {
    const svg = document.querySelector('#frage-beigabe svg.klimadiagramm');
    const wahl = [...document.querySelectorAll('#antwortfeld .wahl')].map(w => w.textContent);
    return { svg: !!svg, saeulen: svg ? svg.querySelectorAll('.kd-saeule').length : 0, wahl };
  })()`);
  await bild('eu-klimadiagramm-2');
  pruefe('T14: Klimadiagramm mit 12 Säulen, vier verschiedene Antworten', r.svg && r.saeulen === 12 && new Set(r.wahl).size === 4 &&
    r.wahl.includes('Nordeuropäisches Klima'), JSON.stringify(r));
  await b.js(`[...document.querySelectorAll('#antwortfeld .wahl')].find(w => w.textContent === 'Nordeuropäisches Klima').click()`);
  e = await ergebnis();
  pruefe('T14: richtige Zone gewählt, Ort und Merkmal in der Rückmeldung', e.text.startsWith('✓') && /Kiruna \(Schweden\)/.test(e.text), e.text);
  await frageSetzen('klimadiagramme', 3, 'London');
  e = await eintippen('Seeklima');
  pruefe('T14: Alias «Seeklima» gilt als Ozeanisches Klima', e.text.startsWith('✓'), e.text);
  await frageSetzen('klimadiagramme', 1, 'Rom');
  r = await b.js(`[...karte.querySelectorAll('.marke')].map(m => m.textContent)`);
  pruefe('T14: Stufe 1 beschriftet jede Zone genau einmal', r.length === 6 && new Set(r).size === 6, r.join(', '));

  /* ── T15: Filter (Lernstoff-Auswahl) ── */
  const vorFilter = await speicher();
  r = await b.js(`(() => {
    document.querySelector('#nach-hause').click();
    const sel = document.querySelector('#filter-auswahl');
    sel.value = 'test-europa-2026-11'; sel.dispatchEvent(new Event('change'));
    return { themen: THEMEN.map(t => t.id + ':' + t.items.length).join(' '), zeilen: document.querySelectorAll('#themenliste .thema').length };
  })()`);
  pruefe('T15: Vorlage «Test Europa» blendet Flaggen, Kennzeichen und Gipfel aus und schränkt Einträge ein',
    r.themen === 'laender:47 hauptstaedte:47 staedte:46 fluesse:8 gebirge:7 meere:10 inseln:12 klimazonen:6 klimadiagramme:22' && r.zeilen === 9, r.themen);
  r = await b.js(`(() => {
    document.querySelector('#filter-bearbeiten').click();
    const block = document.querySelector('.filter-thema[data-thema="gebirge"]');
    block.querySelector('input[value="Alpen"]').click();
    document.querySelector('#filter-name').value = 'Ohne Alpen';
    document.querySelector('#filter-speichern').click();
    return { name: document.querySelector('#filter-auswahl').selectedOptions[0].textContent,
      gebirge: THEMEN.find(t => t.id === 'gebirge').items.map(i => i.name).join(','),
      vorlagen: DATA_EU.filter.length, offen: document.querySelector('#filter-dialog').open };
  })()`);
  pruefe('T15: Anpassen legt einen eigenen Filter an, Vorlage bleibt', r.name === 'Ohne Alpen' && !r.gebirge.includes('Alpen') &&
    r.gebirge.split(',').length === 6 && !r.offen, JSON.stringify(r));
  sp = await speicher();
  const fSp = JSON.parse(sp['geomaster.eu.filter.v1'] || '{}');
  pruefe('T15: Filter nur unter geomaster.eu.filter.v1, CH-Speicher unverändert',
    fSp.eigene?.length === 1 && fSp.aktiv === fSp.eigene[0].id && sp['geomaster.fortschritt.v1'] === vorFilter['geomaster.fortschritt.v1'] &&
    sp['geomaster.stoff.v1'] === vorFilter['geomaster.stoff.v1'] && !Object.keys(sp).some(k => /filter/.test(k) && k !== 'geomaster.eu.filter.v1'),
    Object.keys(sp).join(', '));
  r = await b.js(`(() => {
    document.querySelector('#filter-bearbeiten').click();
    document.querySelector('#filter-json').value = JSON.stringify({ name: 'Nur Klima', themen: { klimazonen: 'alle', klimadiagramme: ['Kiruna', 'Rom'] } });
    document.querySelector('#filter-json-laden').click();
    document.querySelector('#filter-neu').click();
    return { themen: THEMEN.map(t => t.id + ':' + t.items.length).join(' '), optionen: document.querySelectorAll('#filter-auswahl option').length };
  })()`);
  pruefe('T15: Filter als Text einfügen und als neuen Filter speichern', r.themen === 'klimazonen:6 klimadiagramme:2' && r.optionen === 4, JSON.stringify(r));
  await setWaehlen('Schweiz');
  r = await b.js(`({ versteckt: document.querySelector('#filter-wahl').hidden, themen: THEMEN.length })`);
  pruefe('T15: Schweiz ohne Filterzeile, alle 9 Themen', r.versteckt && r.themen === 9, JSON.stringify(r));
  await setWaehlen('Europa');
  await b.js(`(() => { const sel = document.querySelector('#filter-auswahl'); sel.value = ''; sel.dispatchEvent(new Event('change')); })()`);
  await b.js(`localStorage.removeItem('geomaster.eu.filter.v1')`);

  /* ── T16: alter gespeicherter Stoff (vor Meeren/Inseln/Klima) ── */
  r = await b.js(`(() => {
    const alt = { ...DATA_EU };
    for (const k of ['meere', 'inseln', 'staedte', 'klimazonen', 'klimaorte', 'filter']) delete alt[k];
    localStorage.setItem('geomaster.eu.stoff.v1', JSON.stringify(alt));
    STOFF = stoffLaden(); THEMEN = themenFiltern(SET.themen(STOFF)); homeZeigen();
    const n = id => THEMEN.find(t => t.id === id)?.items.length ?? 0;
    return { meere: n('meere'), inseln: n('inseln'), klimazonen: n('klimazonen'), klimadiagramme: n('klimadiagramme'),
      zeilen: document.querySelectorAll('#themenliste .thema').length };
  })()`);
  pruefe('T16: alter gespeicherter Stoff bekommt die neuen Listen aus dem eingebauten Stoff',
    r.meere === 15 && r.inseln === 16 && r.klimazonen === 6 && r.klimadiagramme === 22 && r.zeilen === 12, JSON.stringify(r));
  await b.js(`localStorage.removeItem('geomaster.eu.stoff.v1'); STOFF = stoffLaden(); THEMEN = themenFiltern(SET.themen(STOFF));`);

  /* ── T4: Stoff-Editor Europa nur mit EU-Schlüsseln ── */
  const vorStoff = await speicher();
  r = await b.js(`(() => {
    document.querySelector('#nach-hause').click();
    document.querySelector('#stoff-oeffnen').click();
    const ta = document.querySelector('#stoff-text'), s = JSON.parse(ta.value);
    delete s.gipfel; ta.value = JSON.stringify(s); document.querySelector('#stoff-speichern').click();
    const meldung = document.querySelector('#stoff-meldung').textContent;
    s.gipfel = []; ta.value = JSON.stringify(s); document.querySelector('#stoff-speichern').click();
    const gipfel = THEMEN.find(t => t.id === 'gipfel').items.length;
    document.querySelector('#stoff-oeffnen').click(); document.querySelector('#stoff-reset').click(); document.querySelector('#stoff-speichern').click();
    return { meldung, gipfel, nachReset: THEMEN.find(t => t.id === 'gipfel').items.length };
  })()`);
  sp = await speicher();
  pruefe('T4: EU-Stoff-Editor prüft die EU-Listen, speichert nur unter geomaster.eu.stoff.v1, Zurücksetzen geht',
    /gipfel/.test(r.meldung) && r.gipfel === 0 && r.nachReset === 10 && sp['geomaster.eu.stoff.v1'] &&
    sp['geomaster.stoff.v1'] === vorStoff['geomaster.stoff.v1'], JSON.stringify(r));
  await b.js(`localStorage.removeItem('geomaster.eu.stoff.v1')`);

  /* ── T6: Tipp auf Vatikanstadt und Monaco (Handy, 1× und 4×) ── */
  for (const [geraet, w, h] of [['Handy', 360, 740], ['iPad', 768, 1024]]) {
    await b.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await b.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sleep(100);
    for (const iso of ['VA', 'MC']) {
      for (const zoom of [1, 4]) {
        for (const stufe of [1, 3]) {
          await frageSetzen('laender', stufe, iso);
          const ziel = `(() => { const k = SET.geo.kleinstaaten.find(k => k.iso === '${iso}'); return SET.geo.project(k.lon, k.lat); })()`;
          if (zoom > 1) {
            await b.js(`(() => { const [x, y] = ${ziel}; const p = new DOMPoint(x, y).matrixTransform(karte.getScreenCTM()); zoomUm(p.x, p.y, ${zoom}); })()`);
            await sleep(50);
          }
          const p = await bildschirm(ziel);
          a = await antwort([p[0] + 3, p[1] + 2], tipp);              // Finger trifft nie ganz genau
          pruefe(`T6 ${geraet}: Tipp auf ${iso}, Zoom ${zoom}×, Stufe ${stufe}`, a.richtig, a.text);
          if (iso === 'VA' && zoom === 4 && stufe === 1) await bild(`eu-${geraet}-vatikan-4x`);
        }
      }
    }
    // Layout (T7) für alle Europa-Themen und Stufen.
    let probleme = [];
    const titel = await b.js(`THEMEN.map(t => t.id)`);
    for (const t of titel) for (let s = 1; s <= 4; s++) {
      await b.js(`rundeStarten(THEMEN.find(t => t.id === '${t}'), ${s})`);
      await sleep(30);
      const l = await b.js(`(() => {
        const zuKlein = [...document.querySelectorAll('button')].filter(k => { const r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(k => k.id || k.className);
        const breit = Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('.schirm')].filter(s => !s.hidden).map(s => s.scrollWidth - s.clientWidth + innerWidth));
        const i = document.querySelector('.tippfeld input'); const ir = i?.getBoundingClientRect();
        return { hscroll: breit > innerWidth + .5, zuKlein, tipp: i ? ir.bottom <= innerHeight && ir.top >= 0 : true };
      })()`);
      if (l.hscroll || l.zuKlein.length || !l.tipp) probleme.push(`${t}/${s}: ${JSON.stringify(l)}`);
      if (t === 'flaggen' && s === 3) await bild(`eu-${geraet}-flaggen-tippen`);
      if (t === 'laender' && s === 1) await bild(`eu-${geraet}-laender-1`);
    }
    await b.js(`document.querySelector('#nach-hause').click()`);
    const l = await b.js(`document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('button')].filter(k => k.getBoundingClientRect().height > 0).every(k => k.getBoundingClientRect().height >= 43.5)`);
    if (!l) probleme.push('Startseite');
    await bild(`eu-${geraet}-start`);
    pruefe(`T7 ${geraet}: Europa ohne horizontales Scrollen, Knöpfe ≥ 44 px, Tippfeld sichtbar`, !probleme.length, probleme.join(' | '));
  }

  pruefe('Keine Konsolenfehler', !b.fehler.length, b.fehler.join(' | '));
  const fremd = b.netz.filter(u => !u.startsWith('file:') && !u.startsWith('data:'));
  pruefe('Nur file:// und data: geladen', !fremd.length, fremd.join(', '));
} finally {
  b.ende();
}
console.log(fehlschlaege ? `\n${fehlschlaege} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exitCode = fehlschlaege ? 1 : 0;
