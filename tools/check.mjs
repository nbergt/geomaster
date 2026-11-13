// GeoMaster — Prüfskript (Regression und Datenprüfung).
//
//   node tools/check.mjs --ch              CH-Stand mit tools/baseline-ch.json vergleichen
//   node tools/check.mjs --ch --baseline   Baseline schreiben (nur wenn noch keine existiert)
//   node tools/check.mjs --eu              Europa-Geometrie (js/geo-eu.js) prüfen;
//                                          braucht `npm install` in tools/ (d3-geo)
//
// Die Browser-Scripts werden in der Reihenfolge aus index.html in einer
// Node-vm geladen, mit einem DOM-Platzhalter, der alles schluckt. Geprüft wird
// also der echte Code der App, nicht eine Kopie davon.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_CH = join(WURZEL, 'tools', 'baseline-ch.json');

// Diese Dateien gehören zum Schweizer Modus und dürfen sich nie ändern.
const CH_DATEIEN = [
  'js/geo-ch.js', 'js/data-ch.js', 'js/wappen.js',
  'tools/build-geo.mjs', 'tools/fetch-wappen.mjs',
  ...readdirSync(join(WURZEL, 'tools', 'raw')).sort().map(f => `tools/raw/${f}`),
];

/* ══ App in der vm laden ═════════════════════════════════════════════════ */

// Ein Objekt, das jede Eigenschaft, jeden Aufruf und jedes `new` mit sich
// selbst beantwortet. Reicht, damit app.js beim Laden die Oberfläche "baut".
function platzhalter() {
  const p = new Proxy(function () {}, {
    get(_, k) {
      if (k === Symbol.iterator) return function* () {};
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      return p;
    },
    set: () => true,
    apply: () => p,
    construct: () => p,
  });
  return p;
}

function speicherAttrappe() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
  };
}

function appLaden() {
  const html = readFileSync(join(WURZEL, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
  const dom = platzhalter();
  const ctx = vm.createContext({
    console, document: dom, localStorage: speicherAttrappe(),
    confirm: () => false, DOMPoint: dom, navigator: dom,
  });
  ctx.window = ctx;
  for (const s of scripts) {
    vm.runInContext(readFileSync(join(WURZEL, s), 'utf8'), ctx, { filename: s });
  }
  return { ctx, scripts };
}

/* ══ CH-Snapshot ═════════════════════════════════════════════════════════ */

const sha = f => createHash('sha256').update(readFileSync(join(WURZEL, f))).digest('hex');

// Ein Tippfehler in der Wortmitte, reproduzierbar.
function mitTippfehler(s) {
  const i = Math.floor(s.length / 2);
  return s.slice(0, i) + (/[xX]/.test(s[i]) ? 'q' : 'x') + s.slice(i + 1);
}

const runden = (x, n = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** n) / 10 ** n : String(x));

function chSnapshot() {
  const { ctx } = appLaden();
  // Nach der Set-Abstraktion liegen die CH-Themen in SETS.ch, vorher in themenBauen.
  const api = vm.runInContext(`({
    themen: typeof SETS !== 'undefined' ? SETS.ch.themen(DATA) : themenBauen(DATA),
    textPasst, klickBewerten, GEO: typeof SETS !== 'undefined' ? SETS.ch.geo : GEO,
  })`, ctx);

  // Struktur aller Themen.
  const themen = api.themen.map(t => ({
    id: t.id, titel: t.titel, info: t.info, modus: t.modus, kat: t.kat,
    items: t.items.map(it => ({
      key: it.key, name: it.name, alias: it.alias ?? null, hinweis: it.hinweis ?? null,
      zusatz: it.zusatz ?? null, frage: it.frage, frageAlt: it.frageAlt,
      ziel: it.ziel, beigabe: it.beigabe ?? null,
    })),
  }));

  // Texteingaben: welche Einträge des Themas akzeptieren welche Eingabe?
  const text = {};
  for (const t of api.themen) {
    const eingaben = new Set();
    for (const it of t.items) {
      for (const n of [it.name, ...(it.alias || [])]) { eingaben.add(n); eingaben.add(mitTippfehler(n)); }
    }
    text[t.id] = {};
    for (const e of [...eingaben].sort()) {
      text[t.id][e] = t.items.filter(it => api.textPasst(e, it, t)).map(it => it.key);
    }
  }

  // Kartenklicks auf einem festen Raster: Stufe 1–2 (nächster Kandidat)
  // und Stufe 3 (welche Einträge innerhalb der Toleranz liegen).
  const raster = [];
  for (let y = 20.5; y < api.GEO.height; y += 50) {
    for (let x = 25; x < api.GEO.width; x += 50) raster.push([x, y]);
  }
  const klick = {};
  for (const t of api.themen) {
    const erster = t.items[0];
    klick[t.id] = raster.map(pt => {
      const s1 = api.klickBewerten(pt, t, erster, 1);
      return {
        pt,
        naechster: s1.getippt?.key ?? null,
        km: runden(api.klickBewerten(pt, t, s1.getippt ?? erster, 3).km),
        stufe3: t.items.filter(it => api.klickBewerten(pt, t, it, 3).richtig).map(it => it.key),
      };
    });
  }

  const dateien = Object.fromEntries(CH_DATEIEN.map(f => [f, sha(f)]));
  return { dateien, themen, text, klick };
}

/* ══ Vergleich ═══════════════════════════════════════════════════════════ */

function unterschiede(a, b, pfad = '', aus = []) {
  if (aus.length >= 25) return aus;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) {
    aus.push(`${pfad}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  } else if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) unterschiede(a[k], b[k], `${pfad}/${k}`, aus);
  } else if (a !== b) {
    aus.push(`${pfad}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  }
  return aus;
}

function chPruefen(baselineSchreiben) {
  const jetzt = chSnapshot();
  if (baselineSchreiben) {
    if (existsSync(BASELINE_CH)) {
      console.error('tools/baseline-ch.json existiert schon — wird nicht überschrieben.');
      return false;
    }
    writeFileSync(BASELINE_CH, JSON.stringify(jetzt, null, 1) + '\n');
    console.log(`Baseline geschrieben: ${jetzt.themen.length} Themen, ` +
      `${jetzt.themen.reduce((s, t) => s + t.items.length, 0)} Items, ${Object.keys(jetzt.dateien).length} Dateien.`);
    return true;
  }
  if (!existsSync(BASELINE_CH)) {
    console.error('tools/baseline-ch.json fehlt — zuerst mit --ch --baseline erzeugen.');
    return false;
  }
  // Über JSON abgleichen, damit vm-Objekte und gelesene Werte gleich aussehen.
  const diff = unterschiede(JSON.parse(readFileSync(BASELINE_CH, 'utf8')), JSON.parse(JSON.stringify(jetzt)));
  if (diff.length) {
    console.error('CH: ABWEICHUNG gegenüber baseline-ch.json');
    for (const d of diff) console.error('  ' + d);
    return false;
  }
  console.log('CH: OK');
  return true;
}

/* ══ Europa ══════════════════════════════════════════════════════════════ */

// Punkt-in-Fläche mit gerader/ungerader Regel, wie inForm() in app.js.
function pfadRinge(d) {
  return d.split('M').filter(Boolean).map(s => s.replace(/Z$/, '').split('L').map(p => p.trim().split(/\s+/).map(Number)));
}
function inPfad(p, d) {
  let drin = false;
  for (const r of pfadRinge(d)) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) &&
          p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) drin = !drin;
    }
  }
  return drin;
}

async function euPruefen() {
  const { laenderLaden, AUSGESCHLOSSEN } = await import('./lib/laender.mjs');
  const { geoAzimuthalEqualArea } = await import('d3-geo');
  const fehler = [];
  const melde = (ok, text) => { if (!ok) fehler.push(text); };

  const datei = join(WURZEL, 'js', 'geo-eu.js');
  const quelltext = readFileSync(datei, 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(quelltext + '\nthis.GEO_EU = GEO_EU;', ctx, { filename: 'js/geo-eu.js' });
  const G = ctx.GEO_EU;
  const L = laenderLaden();

  // Datei
  const kb = Buffer.byteLength(quelltext) / 1024;
  melde(kb <= 600, `geo-eu.js ist ${kb.toFixed(0)} KB (erlaubt: 600)`);
  melde(/^\/\/ AUTOGENERIERT/.test(quelltext), 'geo-eu.js: Kopf «AUTOGENERIERT» fehlt');

  // Jedes Land der CSV hat eine Fläche oder einen Punkt; Ausgeschlossene fehlen.
  for (const l of L) {
    const c = G.countries.find(x => x.iso === l.iso);
    const k = G.kleinstaaten.find(x => x.iso === l.iso);
    melde(c?.d || k, `${l.iso} ${l.name}: weder Fläche noch Punkt`);
    if (l.kleinstaat) melde(k, `${l.iso} ist Kleinstaat, hat aber keinen Punkt`);
  }
  for (const iso of Object.keys(AUSGESCHLOSSEN)) {
    melde(!G.countries.some(c => c.iso === iso) && !G.kleinstaaten.some(k => k.iso === iso),
      `${iso} ist ausgeschlossen, steht aber in der Geometrie`);
  }
  melde(G.countries.every(c => L.some(l => l.iso === c.iso)), 'countries enthält Länder, die nicht in der CSV stehen');

  // Pfade nur aus M/L/Z, Anker und Punkte im Bild.
  const imBild = ([x, y]) => x >= 0 && x <= G.width && y >= 0 && y <= G.height;
  for (const [art, liste] of [['countries', G.countries], ['rivers', G.rivers], ['ranges', G.ranges]]) {
    for (const o of liste) {
      const name = o.iso || o.name;
      melde(/^(M[-\d. L]+Z?)+$/.test(o.d), `${art} ${name}: Pfad nicht nur aus M/L/Z`);
      melde(imBild(o.a), `${art} ${name}: Anker ${o.a} ausserhalb der Karte`);
    }
  }
  for (const k of G.kleinstaaten) melde(imBild(G.project(k.lon, k.lat)), `Kleinstaat ${k.iso} ausserhalb der Karte`);
  for (const s of ['country', 'umgebung']) melde(/^(M[-\d. L]+Z)+$/.test(G[s]), `${s}: Pfad nicht nur aus M/L/Z`);

  // Krim gehört zur Ukraine (Natural Earth, Sichtweise Deutschland).
  const krim = G.project(34.1, 45.0);
  const land = iso => G.countries.find(c => c.iso === iso).d;
  melde(inPfad(krim, land('UA')), 'Krim (34.1° O / 45.0° N) liegt nicht in UA');
  melde(!inPfad(krim, land('RU')), 'Krim (34.1° O / 45.0° N) liegt in RU');

  // Überseegebiete und Svalbard sind weggeschnitten.
  melde(!imBild(G.project(15.6, 78.2)), 'Svalbard liegt im Kartenausschnitt');
  melde(!imBild(G.project(-53, 4)), 'Französisch-Guayana liegt im Kartenausschnitt');
  const punkteVon = iso => pfadRinge(land(iso)).flat().map(([x, y]) => G.unproject(x, y));
  melde(punkteVon('NO').every(([, lat]) => lat < 72), 'Norwegen hat Punkte nördlich von 72° N (Svalbard?)');
  melde(punkteVon('NO').every(([lon]) => lon > -5), 'Norwegen hat Punkte westlich von 5° W (Jan Mayen?)');
  // Zypern als ganze Insel: auch die Stützpunkte Akrotiri und Dhekelia gehören dazu.
  for (const [lon, lat, ort] of [[32.95, 34.60, 'Akrotiri'], [33.75, 35.00, 'Dhekelia'], [33.36, 35.20, 'Nordzypern']]) {
    melde(inPfad(G.project(lon, lat), land('CY')), `${ort} (${lon}/${lat}) liegt nicht in CY`);
  }
  melde(punkteVon('FR').every(([lon, lat]) => lon > -6 && lon < 10 && lat > 41 && lat < 52), 'Frankreich hat Punkte ausserhalb Europas');
  melde(punkteVon('ES').every(([lon, lat]) => lat > 35), 'Spanien hat Punkte südlich von 35° N (Kanaren?)');

  // project/unproject: Hin und zurück, und Umkehrung gegen d3.
  const [tx, ty] = G.project(10, 52);
  const s = (ty - G.project(10, 52.0001)[1]) / (0.0001 * Math.PI / 180);
  const d3p = geoAzimuthalEqualArea().rotate([-10, -52]).scale(s).translate([tx, ty]);
  let maxRund = 0, maxD3 = 0;
  for (let i = 0; i < 20; i++) {
    const p = [-24 + (i * 4.3) % 84, 35 + (i * 7.9) % 36];
    const q = G.unproject(...G.project(...p));
    maxRund = Math.max(maxRund, Math.hypot(q[0] - p[0], q[1] - p[1]));
    const xy = [((i * 53) % 100) / 100 * G.width, ((i * 31) % 100) / 100 * G.height];
    const a = G.unproject(...xy), b = d3p.invert(xy);
    maxD3 = Math.max(maxD3, Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  melde(maxRund < 0.01, `unproject(project(p)) weicht um ${maxRund}° ab`);
  melde(maxD3 < 0.01, `unproject weicht um ${maxD3}° von d3 ab`);
  melde(G.breiteKm > 4000 && G.breiteKm < 6500, `breiteKm = ${G.breiteKm} ist unplausibel`);

  /* ── Lernstoff (js/data-eu.js) ── */
  const stoffText = readFileSync(join(WURZEL, 'js', 'data-eu.js'), 'utf8');
  vm.runInContext(stoffText + '\nthis.DATA_EU = DATA_EU;', ctx, { filename: 'js/data-eu.js' });
  const D = ctx.DATA_EU;
  const hinweise = [];
  melde(/^\/\/ AUTOGENERIERT/.test(stoffText), 'data-eu.js: Kopf «AUTOGENERIERT» fehlt');

  // geo-Verweise
  for (const f of D.fluesse) melde(G.rivers.some(r => r.name === f.geo), `Fluss ${f.name}: geo «${f.geo}» fehlt in geo-eu.js`);
  for (const g of D.gebirge) melde(G.ranges.some(r => r.name === g.geo), `Gebirge ${g.name}: geo «${g.geo}» fehlt in geo-eu.js`);

  // Koordinaten im Bild; Hauptstadt im eigenen Land, Gipfel in einem seiner Länder.
  const kmZw = (a, b) => {
    const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  };
  // Abstand eines Ortes zur Landesfläche in km (0 = drin): nächster Randpunkt in SVG, dann Haversine.
  function kmZumLand(lonlat, iso) {
    const c = G.countries.find(x => x.iso === iso);
    if (!c) return Infinity;
    const p = G.project(...lonlat);
    if (inPfad(p, c.d)) return 0;
    let best = null, bestD = Infinity;
    for (const r of pfadRinge(c.d)) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
      const q = [a[0] + t * dx, a[1] + t * dy];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bestD) { bestD = d; best = q; }
    }
    return kmZw(lonlat, G.unproject(...best));
  }
  const laenderListe = D.laender;
  for (const h of D.hauptstaedte) {
    melde(imBild(G.project(h.lon, h.lat)), `Hauptstadt ${h.name}: ausserhalb der Karte`);
    const land = laenderListe.find(l => l.iso === h.iso);
    melde(land, `Hauptstadt ${h.name}: Land ${h.iso} fehlt`);
    if (!land) continue;
    if (land.kleinstaat) {
      const k = G.kleinstaaten.find(x => x.iso === h.iso);
      const km = Math.min(kmZumLand([h.lon, h.lat], h.iso), k ? kmZw([h.lon, h.lat], [k.lon, k.lat]) : Infinity);
      melde(km <= 5, `Hauptstadt ${h.name} liegt ${km.toFixed(1)} km von ${land.name} entfernt (Kleinstaat, erlaubt 5 km)`);
    } else {
      // Küstenstädte können durch die vereinfachte Küstenlinie knapp draussen
      // liegen (1 SVG-Einheit ≈ 5 km); bis 2 km ist das ein Hinweis, kein Fehler.
      const km = kmZumLand([h.lon, h.lat], h.iso);
      melde(km <= 2, `Hauptstadt ${h.name} liegt nicht in ${land.name} (${km.toFixed(1)} km daneben)`);
      if (km > 0 && km <= 2) hinweise.push(`Hauptstadt ${h.name} liegt ${km.toFixed(1)} km neben der vereinfachten Fläche von ${land.name} (Küstenlinie)`);
    }
  }
  for (const g of D.gipfel) {
    melde(imBild(G.project(g.lon, g.lat)), `Gipfel ${g.name}: ausserhalb der Karte`);
    const km = Math.min(...g.land.map(iso => kmZumLand([g.lon, g.lat], iso)));
    melde(km <= 5, `Gipfel ${g.name} liegt ${km.toFixed(1)} km ausserhalb von ${g.land.join('/')}`);
  }

  // Namen und Aliasse sind innerhalb eines Themas eindeutig (normalisiert wie textPasst).
  const norm = s => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
  const themen = {
    'Länder': laenderListe.map(l => [l.name, ...(l.alias || [])]),
    'Hauptstädte': laenderListe.map(l => [l.hauptstadt, ...(l.hauptstadtAlias || [])]),
    'Kennzeichen': laenderListe.map(l => [l.kfz]),
    'Flüsse': D.fluesse.map(f => [f.name, ...(f.alias || [])]),
    'Gebirge': D.gebirge.map(g => [g.name, ...(g.alias || [])]),
    'Gipfel': D.gipfel.map(g => [g.name, ...(g.alias || [])]),
  };
  const lev = (a, b) => {
    let v = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const n = [i];
      for (let j = 1; j <= b.length; j++) n[j] = Math.min(v[j] + 1, n[j - 1] + 1, v[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      v = n;
    }
    return v[b.length];
  };
  for (const [thema, eintraege] of Object.entries(themen)) {
    const gesehen = new Map();
    eintraege.forEach((namen, i) => {
      for (const n of new Set(namen.map(norm))) {
        melde(!gesehen.has(n) || gesehen.get(n) === i, `${thema}: «${n}» kommt bei mehreren Einträgen vor`);
        gesehen.set(n, i);
      }
    });
    // Verwechselbare Paare (ein Tippfehler auseinander) — textPasst darf sie nicht verzeihen.
    const alle = [...gesehen];
    for (let a = 0; a < alle.length; a++) for (let b = a + 1; b < alle.length; b++) {
      if (alle[a][1] !== alle[b][1] && Math.max(alle[a][0].length, alle[b][0].length) >= 6 && lev(alle[a][0], alle[b][0]) <= 1) {
        hinweise.push(`${thema}: «${alle[a][0]}» und «${alle[b][0]}» sind nur einen Tippfehler auseinander`);
      }
    }
  }

  // Kein ß; ausgeschlossene Länder kommen nicht vor (T11).
  melde(!stoffText.includes('ß'), 'data-eu.js enthält «ß»');
  const stoffJson = JSON.stringify(D);
  for (const [iso, ne] of Object.entries(AUSGESCHLOSSEN)) {
    melde(!new RegExp(`"(${iso}|${ne})"`).test(stoffJson), `ausgeschlossenes Land ${iso} kommt im Stoff vor`);
  }
  for (const name of ['Georgien', 'Armenien', 'Aserbaidschan', 'Kasachstan', 'Tiflis', 'Eriwan', 'Baku', 'Astana']) {
    melde(!stoffJson.includes(name), `«${name}» kommt im Stoff vor (ausgeschlossen)`);
  }

  /* ── Themen der App (SETS.eu, wie im Browser geladen) ── */
  const { ctx: appCtx } = appLaden();
  const T = vm.runInContext(`typeof SETS !== 'undefined' && SETS.eu ? SETS.eu.themen(DATA_EU) : null`, appCtx);
  melde(T, 'SETS.eu fehlt (index.html lädt geo-eu.js, data-eu.js, flaggen-eu.js vor sets.js?)');
  for (const t of T || []) {
    for (const it of t.items) {
      const z = it.ziel;
      const ok = z.typ === 'punkt' ? imBild(G.project(z.lon, z.lat))
        : z.typ === 'staat' ? G.countries.some(c => c.iso === z.id)
        : z.typ === 'fluss' ? G.rivers.some(r => r.name === z.id)
        : z.typ === 'gebirge' ? G.ranges.some(r => r.name === z.id) : false;
      melde(ok, `Thema ${t.id}, ${it.name}: Ziel ${JSON.stringify(z)} fehlt auf der Karte`);
      melde(it.frage && !/undefined|null/.test(it.frage + it.frageAlt), `Thema ${t.id}, ${it.name}: Fragetext «${it.frage}»`);
    }
  }

  /* ── Flaggen (js/flaggen-eu.js) ── */
  const flaggenText = readFileSync(join(WURZEL, 'js', 'flaggen-eu.js'), 'utf8');
  vm.runInContext(flaggenText + '\nthis.FLAGGEN_EU = FLAGGEN_EU;', ctx, { filename: 'js/flaggen-eu.js' });
  const F = ctx.FLAGGEN_EU;
  const flaggenKb = Buffer.byteLength(flaggenText) / 1024;
  melde(/^\/\/ AUTOGENERIERT/.test(flaggenText), 'flaggen-eu.js: Kopf «AUTOGENERIERT» fehlt');
  // Entscheid Thomas: alle Flaggen als SVG, rund 490 KB (geplant waren < 400 KB).
  melde(flaggenKb < 520, `flaggen-eu.js ist ${flaggenKb.toFixed(0)} KB (erwartet: rund 490 KB)`);
  for (const l of L) melde(/^data:image\/svg\+xml,%3Csvg/.test(F[l.iso] || ''), `${l.iso} ${l.name}: keine Flagge`);
  for (const iso of Object.keys(F)) melde(L.some(l => l.iso === iso), `Flagge ${iso} gehört zu keinem Land der CSV`);
  melde(existsSync(join(WURZEL, 'LICENSES', 'flag-icons.txt')), 'LICENSES/flag-icons.txt fehlt');

  // Abweichungen von der CSV melden.
  const gleich = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  for (const l of L) {
    const s = laenderListe.find(x => x.iso === l.iso);
    if (!s) { hinweise.push(`${l.iso}: steht in der CSV, fehlt im Stoff`); continue; }
    for (const [feld, csv, st] of [['name', l.name, s.name], ['alias', l.alias, s.alias], ['hauptstadt', l.hauptstadt, s.hauptstadt],
      ['hauptstadtAlias', l.hauptstadtAlias, s.hauptstadtAlias], ['kfz', l.kfz, s.kfz], ['kleinstaat', l.kleinstaat, !!s.kleinstaat]]) {
      if (Array.isArray(csv) ? !gleich(csv.length ? csv : null, st) : csv !== st) {
        hinweise.push(`${l.iso} ${feld}: Stoff «${st}» weicht von der CSV «${csv}» ab`);
      }
    }
  }
  for (const s of laenderListe) if (!L.some(l => l.iso === s.iso)) hinweise.push(`${s.iso}: im Stoff, aber nicht in der CSV`);

  if (hinweise.length) {
    console.log('EU: Hinweise');
    for (const h of hinweise) console.log('  ' + h);
  }

  if (fehler.length) {
    console.error('EU: FEHLER');
    for (const f of fehler) console.error('  ' + f);
    return false;
  }
  console.log(`EU: OK  (geo-eu.js ${kb.toFixed(0)} KB, ${G.countries.length} Länder, ${G.kleinstaaten.length} Kleinstaaten-Punkte, ` +
    `${G.rivers.length} Flüsse, ${G.ranges.length} Gebirge; Hin-und-zurück ${maxRund.toExponential(1)}°, gegen d3 ${maxD3.toExponential(1)}°)`);
  return true;
}

/* ══ Aufruf ══════════════════════════════════════════════════════════════ */

const args = new Set(process.argv.slice(2));
let ok = true;
if (args.has('--ch')) ok = chPruefen(args.has('--baseline')) && ok;
if (args.has('--eu')) ok = (await euPruefen()) && ok;
if (!args.has('--ch') && !args.has('--eu')) {
  console.error('Aufruf: node tools/check.mjs --ch [--baseline] | --eu');
  ok = false;
}
process.exit(ok ? 0 : 1);
