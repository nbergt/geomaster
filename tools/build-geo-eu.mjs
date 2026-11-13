// Baut js/geo-eu.js aus den Rohdaten in tools/raw-eu/ und tools/laender-europa.csv.
//   cd tools && npm install      (einmalig: d3-geo, topojson-*)
//   node tools/build-geo-eu.mjs
//
// Quellen (Natural Earth, Public Domain), heruntergeladen aus
// github.com/nvkelso/natural-earth-vector, Ordner geojson/ (Stand 2022-05-13):
//   ne_10m_admin_0_countries_deu.geojson   Länder, Sichtweise Deutschland
//                                          (Krim bei UA, Kosovo eigenständig, Zypern ganz)
//   ne_10m_rivers_lake_centerlines.geojson Flüsse
//   ne_10m_rivers_europe.geojson           Flüsse, Ergänzungen (Quellläufe)
//   ne_10m_geography_regions_polys.geojson Gebirge, Inseln, Halbinseln
//   ne_10m_geography_marine_polys.geojson  Meere, Meerengen (heruntergeladen 13.11.2026)
//   ne_10m_lakes.geojson                   Seen
//
// Ablauf: projizieren (LAEA, Zentrum 52° N / 10° O, wie EPSG:3035) und auf den
// Europa-Ausschnitt zuschneiden (d3-geo), dann topologisch vereinfachen
// (topojson): gemeinsame Grenzen werden nur einmal vereinfacht, so entstehen
// zwischen Nachbarländern keine Lücken. Bei einem Fehler wird nichts geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoAzimuthalEqualArea, geoStream } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { feature, merge } from 'topojson-client';
import { laenderLaden, AUSGESCHLOSSEN } from './lib/laender.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(HERE, 'raw-eu');
const OUT = path.join(HERE, '..', 'js', 'geo-eu.js');
const read = f => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));

const LAENDER = laenderLaden();
const NE_ZU_ISO = new Map(LAENDER.map(l => [l.ne, l.iso]));
// Eigene Features in Natural Earth, die zum Land gezählt werden: Åland zu
// Finnland, die britischen Stützpunkte Akrotiri und Dhekelia zu Zypern
// (Entscheid Thomas: Zypern als ganze Insel, ohne graue Flecken).
const ZUGESCHLAGEN = { ALD: 'FI', WSB: 'CY', ESB: 'CY' };
for (const [ne, iso] of Object.entries(ZUGESCHLAGEN)) NE_ZU_ISO.set(ne, iso);
for (const ne of Object.values(AUSGESCHLOSSEN)) {
  if (NE_ZU_ISO.has(ne)) throw new Error(`${ne} ist ausgeschlossen, steht aber in der Länderliste`);
}

// --- Projektion und Ausschnitt ---------------------------------------------
// Lambert Azimuthal Equal Area auf der Kugel. Die gleiche Formel steht unten
// als kleine Funktion in geo-eu.js; check.mjs vergleicht beide mit d3.
const ZENTRUM = [10, 52];

// Diese Punkte müssen auf der Karte liegen: Island, Nordkap, Ural (60° O),
// ganze Türkei, Zypern, Kreta, Portugal, Gibraltar, Malta.
const RAHMEN_PUNKTE = [
  [-24.6, 65.5], [-22.0, 63.3], [-13.5, 66.6], [25.8, 71.2], [60, 68.5], [60, 56], [60, 50],
  [44.8, 39.7], [44.6, 37.1], [34.6, 35.7], [32.3, 34.6], [24.0, 34.8], [26.3, 35.3],
  [-9.5, 38.7], [-9.3, 43.1], [-5.6, 36.0], [14.5, 35.8],
];
const RAND = 0.025;                    // 2.5 % Luft um die Rahmenpunkte
const W = 1000;

const roh = geoAzimuthalEqualArea().rotate([-ZENTRUM[0], -ZENTRUM[1]]).scale(1).translate([0, 0]);
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (const p of RAHMEN_PUNKTE) {
  const [x, y] = roh(p);
  x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
}
const bx = (x1 - x0) * RAND, by = (y1 - y0) * RAND;
x0 -= bx; x1 += bx; y0 -= by; y1 += by;
const S = W / (x1 - x0);
const H = Math.round((y1 - y0) * S);
const TX = -x0 * S, TY = -y0 * S;

// precision(0): keine Zwischenpunkte, damit gemeinsame Grenzen auf beiden
// Seiten dieselben Punkte haben (topojson erkennt sie sonst nicht als gemeinsam).
const projektion = geoAzimuthalEqualArea()
  .rotate([-ZENTRUM[0], -ZENTRUM[1]]).scale(S).translate([TX, TY])
  .precision(0).clipExtent([[0, 0], [W, H]]);

// Eigene LAEA-Formeln (Kugel, Radius 1), genau so auch in geo-eu.js.
const RAD = Math.PI / 180;
const L0 = ZENTRUM[0] * RAD, P1 = ZENTRUM[1] * RAD;
const SIN1 = Math.sin(P1), COS1 = Math.cos(P1);
function project(lon, lat) {
  const l = lon * RAD - L0, p = lat * RAD;
  const k = Math.sqrt(2 / (1 + SIN1 * Math.sin(p) + COS1 * Math.cos(p) * Math.cos(l)));
  return [TX + S * k * Math.cos(p) * Math.sin(l), TY - S * k * (COS1 * Math.sin(p) - SIN1 * Math.cos(p) * Math.cos(l))];
}
function unproject(x, y) {
  const u = (x - TX) / S, v = (TY - y) / S;
  const rho = Math.hypot(u, v);
  if (rho < 1e-12) return [ZENTRUM[0], ZENTRUM[1]];
  const c = 2 * Math.asin(Math.min(1, rho / 2));
  const lat = Math.asin(Math.cos(c) * SIN1 + v * Math.sin(c) * COS1 / rho);
  const lon = L0 + Math.atan2(u * Math.sin(c), rho * COS1 * Math.cos(c) - v * SIN1 * Math.sin(c));
  return [lon / RAD, lat / RAD];
}

// Selbsttest: eigene Formel gegen d3, Hin und zurück.
for (let i = 0; i < 40; i++) {
  const p = [-24 + (i * 37) % 84, 35 + (i * 13) % 36];
  const a = project(...p), b = projektion(p);
  const q = unproject(...a);
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6) throw new Error(`Projektion weicht von d3 ab bei ${p}`);
  if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) throw new Error(`Umkehrung ungenau bei ${p}`);
}

// --- projizieren und zuschneiden -------------------------------------------
// Liefert Polygone bzw. Linien in SVG-Koordinaten; was ausserhalb liegt, fällt weg.
function projizieren(geom) {
  const polys = [], linien = [];
  let poly = null, ring = null, inPoly = false;
  const senke = {
    polygonStart() { inPoly = true; poly = []; },
    polygonEnd() { inPoly = false; if (poly.length) polys.push(poly); },
    lineStart() { ring = []; },
    lineEnd() {
      if (inPoly) { if (ring.length > 2) { ring.push(ring[0]); poly.push(ring); } }
      else if (ring.length > 1) linien.push(ring);
    },
    point(x, y) { ring.push([x, y]); },
    sphere() {},
  };
  geoStream(geom, projektion.stream(senke));
  return { polys, linien };
}

const alsGeom = ({ polys, linien }) =>
  polys.length ? { type: 'MultiPolygon', coordinates: polys }
  : linien.length ? { type: 'MultiLineString', coordinates: linien } : null;

// --- Rohdaten einsammeln ---------------------------------------------------
const objekte = { laender: [], umgebung: [], seen: [], fluesse: [], gebirge: [] };

// Teilflächen, die nicht auf die Karte gehören, obwohl sie knapp im
// Ausschnitt liegen: Svalbard samt Bäreninsel (74.5° N) und Jan Mayen (8° W).
const TEILFLAECHE_WEG = {
  NOR: poly => Math.min(...poly[0].map(p => p[1])) >= 73 || Math.max(...poly[0].map(p => p[0])) < -5,
};
function ohneTeilflaechen(geom, weg) {
  if (!weg || geom.type !== 'MultiPolygon') return geom;
  return { type: 'MultiPolygon', coordinates: geom.coordinates.filter(poly => !weg(poly)) };
}

// Ein Land kann aus mehreren Natural-Earth-Features bestehen (ZUGESCHLAGEN);
// sie bleiben in der Topologie getrennt und werden unten verschmolzen, damit
// keine inneren Grenzen übrig bleiben. Der Labelpunkt kommt vom Hauptfeature.
const nachIso = new Map();
const LAND_NE = new Map(LAENDER.map(l => [l.iso, l.ne]));
for (const f of read('ne_10m_admin_0_countries_deu.geojson').features) {
  const ne = f.properties.ADM0_A3;
  const g = alsGeom(projizieren(ohneTeilflaechen(f.geometry, TEILFLAECHE_WEG[ne])));
  if (!g) continue;
  const iso = NE_ZU_ISO.get(ne);
  if (iso) {
    if (!nachIso.has(iso)) nachIso.set(iso, { label: null });
    if (LAND_NE.get(iso) === ne) nachIso.get(iso).label = [f.properties.LABEL_X, f.properties.LABEL_Y];
    objekte.laender.push({ type: 'Feature', properties: { iso, ne }, geometry: g });
  } else {
    objekte.umgebung.push({ type: 'Feature', properties: { ne }, geometry: g });
  }
}

// Seen, nur zur Darstellung (kein Quiz). Der Kachowka-Stausee ist seit der
// Zerstörung des Damms 2023 leer, in Natural Earth (2022) aber noch enthalten.
const SEE_WEG = new Set(['Kakhovka Reservoir']);
for (const f of read('ne_10m_lakes.geojson').features) {
  if (SEE_WEG.has(f.properties.name)) continue;
  const g = alsGeom(projizieren(f.geometry));
  if (g?.type === 'MultiPolygon') objekte.seen.push({ type: 'Feature', properties: { name: f.properties.name }, geometry: g });
}

// Flüsse: Natural Earth führt Teilstücke unter verschiedenen Namen und teils
// kaputter Kodierung; deshalb eine explizite Zuordnung. Gefiltert wird
// zusätzlich nach Lage (es gibt z. B. auch einen Don in Grossbritannien).
const FLUSS_NAME = {
  Volga: 'Wolga', Donau: 'Donau', Danube: 'Donau', Dnipro: 'Dnepr', Dnepre: 'Dnepr', Don: 'Don',
  Rhein: 'Rhein', Rhin: 'Rhein', Rhine: 'Rhein', Nederrijn: 'Rhein', Lek: 'Rhein', Waal: 'Rhein',
  Elbe: 'Elbe', Vistula: 'Weichsel', Oder: 'Oder', Loire: 'Loire', Seine: 'Seine',
  'Rhône': 'Rhone', Rhne: 'Rhone', Po: 'Po', Tajo: 'Tajo', Tejo: 'Tajo', Ebro: 'Ebro', Thames: 'Themse',
  Ural: 'Ural', Duero: 'Duero', Garonne: 'Garonne', Maas: 'Maas', Mosel: 'Mosel', Sava: 'Save',
  Dniester: 'Dnister', Daugava: 'Düna', Neman: 'Memel', 'Severnaya Dvina': 'Nördliche Dwina',
};
// Bounding-Box [W, S, O, N], in der ein Teilstück liegen muss.
const FLUSS_LAGE = { Don: [35, 46, 45, 55] };
// Quellläufe aus ne_10m_rivers_europe, über die Wikidata-ID zugeordnet.
const FLUSS_WIKIDATA = { Q626: 'Wolga', Q552: 'Oder', Q1644: 'Elbe', Q8197: 'Düna', Q40855: 'Dnepr', Q14383: 'Save' };

function bbox(geom) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const lauf = c => (typeof c[0] === 'number'
    ? (b[0] = Math.min(b[0], c[0]), b[1] = Math.min(b[1], c[1]), b[2] = Math.max(b[2], c[0]), b[3] = Math.max(b[3], c[1]))
    : c.forEach(lauf));
  lauf(geom.coordinates);
  return b;
}
const liegtIn = (b, r) => b[0] >= r[0] && b[1] >= r[1] && b[2] <= r[2] && b[3] <= r[3];

const flussLinien = new Map();
function flussDazu(name, geom) {
  if (!geom || (FLUSS_LAGE[name] && !liegtIn(bbox(geom), FLUSS_LAGE[name]))) return;
  const { linien } = projizieren(geom);
  if (!linien.length) return;
  if (!flussLinien.has(name)) flussLinien.set(name, []);
  flussLinien.get(name).push(...linien);
}
for (const f of read('ne_10m_rivers_lake_centerlines.geojson').features) {
  const name = FLUSS_NAME[f.properties.name];
  if (name && f.geometry) flussDazu(name, f.geometry);
}
for (const f of read('ne_10m_rivers_europe.geojson').features) {
  const name = FLUSS_WIKIDATA[f.properties.wikidataid];
  if (name && f.geometry) flussDazu(name, f.geometry);
}
for (const [name, linien] of flussLinien) {
  objekte.fluesse.push({ type: 'Feature', properties: { name }, geometry: { type: 'MultiLineString', coordinates: linien } });
}

// Gebirge: Namen aus Anhang A, nicht aus NAME_DE (APPENNINI heisst dort
// fälschlich «Ligurischer Apennin»). Schwarzwald fehlt in Natural Earth.
const GEBIRGE_NAME = {
  'ALPS': 'Alpen', 'PYRENEES': 'Pyrenäen', 'APPENNINI': 'Apennin', 'CARPATHIAN MOUNTAINS': 'Karpaten',
  'KJØLEN MOUNTAINS': 'Skandinavisches Gebirge', 'URAL MOUNTAINS': 'Ural', 'CAUCASUS MTS.': 'Kaukasus',
  'Dinaric Alps': 'Dinarisches Gebirge', 'Balkan Mts.': 'Balkangebirge', 'Jura': 'Jura',
  'Vosges': 'Vogesen', 'Ardennes': 'Ardennen', 'Erzgebirge': 'Erzgebirge', 'Sudetes Mts.': 'Sudeten',
  'Tatra Mts.': 'Tatra', 'Cord. Cantábrica': 'Kantabrisches Gebirge', 'S. Nevada': 'Sierra Nevada',
  'Pindus Mts.': 'Pindos', 'Grampian Mts.': 'Schottisches Hochland',
  'Massif Central': 'Zentralmassiv',
};
// Natural Earth führt das Zentralmassiv als Hochebene, nicht als Gebirge.
const GEBIRGE_KLASSE = { 'Massif Central': 'Plateau' };
// «Deutsche Mittelgebirge» (Lernkontrolle Europa, Nr. 5) gibt es in Natural
// Earth nicht als ein Objekt; zusammengesetzt aus den dort vorhandenen
// Mittelgebirgen in Deutschland und an seiner Grenze. Schwarzwald, Rheinisches
// Schiefergebirge u. a. fehlen in Natural Earth.
const GEBIRGE_TEIL = { Harz: ['Deutsche Mittelgebirge'], Erzgebirge: ['Deutsche Mittelgebirge'], 'Böhmerwald': ['Deutsche Mittelgebirge'] };
for (const f of read('ne_10m_geography_regions_polys.geojson').features) {
  const ne = f.properties.NAME;
  const namen = [GEBIRGE_NAME[ne], ...(GEBIRGE_TEIL[ne] || [])].filter(Boolean);
  if (!namen.length || f.properties.FEATURECLA !== (GEBIRGE_KLASSE[ne] ?? 'Range/mtn')) continue;
  const g = alsGeom(projizieren(f.geometry));
  if (g?.type !== 'MultiPolygon') continue;
  for (const name of namen) objekte.gebirge.push({ type: 'Feature', properties: { name }, geometry: g });
}

// --- topologisch vereinfachen ----------------------------------------------
// Gewicht = Dreiecksfläche in SVG-Einheiten² (1 Einheit ≈ 5 km).
const VEREINFACHUNG = 0.2;
const topo = presimplify(topology(Object.fromEntries(Object.entries(objekte)
  .map(([k, features]) => [k, { type: 'FeatureCollection', features }])), 1e5));
const einfach = simplify(topo, VEREINFACHUNG);

const r1 = n => Math.round(n * 10) / 10;
const ringFlaeche = r => Math.abs(r.reduce((s, p, i) => {
  const q = r[(i + 1) % r.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);

function ringeVon(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  if (geom.type === 'LineString') return [geom.coordinates];
  if (geom.type === 'MultiLineString') return geom.coordinates;
  return [];
}

// Pfad nur aus M/L/Z wie in geo-ch.js. Kleine Inseln fallen weg; der grösste
// Ring einer Fläche bleibt immer (Kleinstaaten).
function pfad(geom, zu, minFlaeche = 0) {
  const ringe = ringeVon(geom).map(r => r.map(p => [r1(p[0]), r1(p[1])])
    .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]));
  const groesster = zu ? Math.max(0, ...ringe.map(ringFlaeche)) : 0;
  const teile = [];
  for (let r of ringe) {
    if (zu) {
      if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
      if (r.length < 3) continue;
      const fl = ringFlaeche(r);
      if (fl < minFlaeche && fl < groesster) continue;
    } else if (r.length < 2) continue;
    teile.push('M' + r.map(p => `${p[0]} ${p[1]}`).join('L') + (zu ? 'Z' : ''));
  }
  return teile.join('');
}

// Anker in einer Fläche: der innere Punkt mit dem grössten Randabstand
// (grobes Raster, dann verfeinert). Schwerpunkte liegen bei Bögen wie den
// Karpaten ausserhalb.
function innerPunkt(geom) {
  const ringe = ringeVon(geom);
  if (!ringe.length) return null;
  const drin = p => ringe.reduce((d, r) => {
    let x = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) &&
          p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) x = !x;
    }
    return x ? !d : d;
  }, false);
  const rand = p => {
    let m = Infinity;
    for (const r of ringe) for (let i = 1; i < r.length; i++) {
      const [ax, ay] = r[i - 1], [bx2, by2] = r[i];
      const dx = bx2 - ax, dy = by2 - ay, l = dx * dx + dy * dy;
      let t = l ? ((p[0] - ax) * dx + (p[1] - ay) * dy) / l : 0;
      t = Math.max(0, Math.min(1, t));
      m = Math.min(m, Math.hypot(ax + t * dx - p[0], ay + t * dy - p[1]));
    }
    return m;
  };
  // Nur im grössten Ring suchen, damit Inseln den Anker nicht wegziehen.
  const gross = ringe.reduce((a, b) => (ringFlaeche(a) > ringFlaeche(b) ? a : b));
  const b = bbox({ coordinates: gross });
  let best = null, bestD = -1;
  let schritt = Math.max(b[2] - b[0], b[3] - b[1]) / 40;
  const pruefen = p => { if (drin(p)) { const d = rand(p); if (d > bestD) { bestD = d; best = p; } } };
  for (let x = b[0]; x <= b[2]; x += schritt) for (let y = b[1]; y <= b[3]; y += schritt) pruefen([x, y]);
  for (let n = 0; n < 4 && best; n++) {
    const [cx, cy] = best;
    schritt /= 4;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) pruefen([cx + i * schritt, cy + j * schritt]);
  }
  return best ? best.map(r1) : null;
}

// Fluss-Anker: Mitte (nach Länge) des längsten Teilstücks.
function linienAnker(geom) {
  const linien = ringeVon(geom);
  const laenge = l => l.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);
  const l = linien.reduce((a, b) => (laenge(b) > laenge(a) ? b : a));
  let rest = laenge(l) / 2;
  for (let i = 1; i < l.length; i++) {
    const d = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
    if (rest <= d) {
      const t = d ? rest / d : 0;
      return [r1(l[i - 1][0] + t * (l[i][0] - l[i - 1][0])), r1(l[i - 1][1] + t * (l[i][1] - l[i - 1][1]))];
    }
    rest -= d;
  }
  return l[l.length - 1].map(r1);
}

const imBild = ([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H;

// Beschriftung von Hand, wo der Natural-Earth-Labelpunkt ungünstig liegt.
const LAND_ANKER_FIX = {};
const GEBIRGE_ANKER_FIX = {};
const FLUSS_ANKER_FIX = {};

// --- Länder ----------------------------------------------------------------
const countries = [...nachIso.keys()].map(iso => {
  const geom = merge(einfach, einfach.objects.laender.geometries.filter(g => g.properties.iso === iso));
  const label = nachIso.get(iso).label;
  const fix = LAND_ANKER_FIX[iso];
  let a = fix ? project(...fix).map(r1) : label ? project(...label).map(r1) : null;
  if (!a || !imBild(a)) a = innerPunkt(geom);
  return { iso, d: pfad(geom, true, 1.5), a };
}).filter(c => c.d)                    // Vatikanstadt ist zu klein: nur als Punkt
  .sort((a, b) => a.iso.localeCompare(b.iso));

// Kleinstaaten zusätzlich als Punkt: Labelpunkt von Natural Earth (im Land).
const kleinstaaten = LAENDER.filter(l => l.kleinstaat).map(l => {
  const label = nachIso.get(l.iso)?.label;
  if (!label) throw new Error(`Kleinstaat ${l.iso} ohne Labelpunkt`);
  return { iso: l.iso, lon: +label[0].toFixed(4), lat: +label[1].toFixed(4) };
});

// Umriss aller Länder zusammen (Aussengrenze, ohne innere Grenzen).
const country = pfad(merge(einfach, einfach.objects.laender.geometries), true, 1.5);
const umgebung = pfad({
  type: 'MultiPolygon',
  coordinates: feature(einfach, einfach.objects.umgebung).features.flatMap(f =>
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates),
}, true, 3);
// Seen ab etwa 160 km² (6 Einheiten²), als ein Pfad.
const seen = pfad({
  type: 'MultiPolygon',
  coordinates: feature(einfach, einfach.objects.seen).features.flatMap(f =>
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
    .filter(poly => ringFlaeche(poly[0]) >= 6),
}, true, 3);

// --- Flüsse und Gebirge ----------------------------------------------------
const rivers = feature(einfach, einfach.objects.fluesse).features.map(f => {
  const name = f.properties.name;
  const fix = FLUSS_ANKER_FIX[name];
  return { name, d: pfad(f.geometry, false), a: fix ? project(...fix).map(r1) : linienAnker(f.geometry) };
}).filter(r => r.d).sort((a, b) => a.name.localeCompare(b.name, 'de'));

// Gebirge aus mehreren Teilen (Deutsche Mittelgebirge) werden verschmolzen.
const gebirgeNamen = [...new Set(einfach.objects.gebirge.geometries.map(g => g.properties.name))];
const ranges = gebirgeNamen.map(name => {
  const teile = einfach.objects.gebirge.geometries.filter(g => g.properties.name === name);
  const geom = teile.length > 1 ? merge(einfach, teile) : feature(einfach, teile[0]).geometry;
  const fix = GEBIRGE_ANKER_FIX[name];
  return { name, d: pfad(geom, true, 0.5), a: fix ? project(...fix).map(r1) : innerPunkt(geom) };
}).filter(r => r.d).sort((a, b) => a.name.localeCompare(b.name, 'de'));

// --- Meere, Meerengen, Inseln und Halbinseln -------------------------------
// Eigene Topologie, damit die Vereinfachung der Länder, Flüsse und Gebirge
// oben unverändert bleibt. Quelle: ne_10m_geography_marine_polys (Meere) und
// ne_10m_geography_regions_polys (Inseln, Halbinseln). Namen nach der
// Lernkontrolle Europa; mehrere Natural-Earth-Teile ergeben ein Meer.
const MEER_TEILE = {
  'Atlantischer Ozean': ['North Atlantic Ocean'],
  // Nordpolarmeer im Kartenausschnitt: Arktischer Ozean, Barentssee, Weisses Meer.
  'Nordpolarmeer': ['Arctic Ocean', 'Barents Sea', 'White Sea'],
  'Europäisches Nordmeer': ['Norwegian Sea'],
  'Nordsee': ['North Sea'],
  'Ostsee': ['Baltic Sea', 'Gulf of Bothnia', 'Gulf of Finland', 'Gulf of Riga', 'Mecklenburger Bucht'],
  'Ärmelkanal': ['English Channel'],
  'Golf von Biskaya': ['Bay of Biscay'],
  // Mittelmeer ohne die eigenen Lernstoff-Meere (Adria, Ionisches, Ägäisches Meer).
  'Mittelmeer': ['Mediterranean Sea', 'Tyrrhenian Sea', 'Balearic Sea', 'Ligurian Sea', 'Alboran Sea',
    'Golfe du Lion', 'Gulf of Gabès', 'Gulf of Sidra'],
  'Adriatisches Meer': ['Adriatic Sea'],
  'Ionisches Meer': ['Ionian Sea'],
  // Das Kretische Meer gehört zum Ägäischen Meer.
  'Ägäisches Meer': ['Aegean Sea', 'Sea of Crete'],
  'Schwarzes Meer': ['Black Sea'],
};
// Meerengen sind auf der Karte zu schmal für eine Fläche: ein Punkt in der Mitte.
const MEERENGE = { 'Strasse von Gibraltar': 'Strait of Gibraltar', 'Bosporus': 'Bosporus', 'Dardanellen': 'Dardanelles' };
// NE-Name -> [Name, Klasse in Natural Earth]
const INSEL_NAME = {
  'ICELAND': 'Island', 'SCANDINAVIA': 'Skandinavien', 'KOLA PENINSULA': 'Kola', 'IRELAND': 'Irland',
  'GREAT BRITAIN': 'Grossbritannien', 'PENÍNSULA IBÉRICA': 'Iberische Halbinsel',
  'Balearic Islands': 'Balearen', 'Corse': 'Korsika', 'Sardegna': 'Sardinien', 'Sicilia': 'Sizilien',
  'Pelopónnisos': 'Peloponnes', 'Crete': 'Kreta', 'Cyprus': 'Zypern', 'CRIMEA': 'Krim', 'JUTLAND': 'Jütland',
};
// Die Apenninenhalbinsel fehlt in Natural Earth: der grösste Teil Italiens
// (Festland ohne Sizilien, Sardinien und kleinere Inseln) aus der Länderfläche.
const HALBINSEL_AUS_LAND = { 'Apenninenhalbinsel': 'ITA' };

const zusatz = { meere: [], inseln: [] };
const meerNe = new Map(Object.entries(MEER_TEILE).flatMap(([name, teile]) => teile.map(t => [t, name])));
const meerengen = [];
const flaechenSchwerpunkt = geom => {
  // geografischer Mittelpunkt der Aussenringe (für schmale Meerengen genügt das)
  const pts = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).flatMap(p => p[0]);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
};
for (const f of read('ne_10m_geography_marine_polys.geojson').features) {
  const ne = f.properties.name;
  const enge = Object.keys(MEERENGE).find(k => MEERENGE[k] === ne);
  if (enge) {
    const [lon, lat] = flaechenSchwerpunkt(f.geometry);
    meerengen.push({ name: enge, lon: +lon.toFixed(4), lat: +lat.toFixed(4) });
    continue;
  }
  const name = meerNe.get(ne);
  if (!name) continue;
  const g = alsGeom(projizieren(f.geometry));
  if (g?.type === 'MultiPolygon') zusatz.meere.push({ type: 'Feature', properties: { name, ne }, geometry: g });
}
for (const f of read('ne_10m_geography_regions_polys.geojson').features) {
  const name = INSEL_NAME[f.properties.NAME];
  if (!name) continue;
  const g = alsGeom(projizieren(f.geometry));
  if (g?.type === 'MultiPolygon') zusatz.inseln.push({ type: 'Feature', properties: { name }, geometry: g });
}
for (const [name, ne] of Object.entries(HALBINSEL_AUS_LAND)) {
  const f = read('ne_10m_admin_0_countries_deu.geojson').features.find(x => x.properties.ADM0_A3 === ne);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const festland = polys.reduce((a, b) => (b[0].length > a[0].length ? b : a));
  const g = alsGeom(projizieren({ type: 'Polygon', coordinates: [festland[0]] }));
  if (g) zusatz.inseln.push({ type: 'Feature', properties: { name }, geometry: g });
}
const topoZ = presimplify(topology(Object.fromEntries(Object.entries(zusatz)
  .map(([k, features]) => [k, { type: 'FeatureCollection', features }])), 1e5));
// Meere liegen unter dem Land, ihre Küsten sind kaum zu sehen: stärker
// vereinfacht. Inseln und Halbinseln etwas stärker als die Länder.
function verschmelzen(objekt, staerke) {
  const topo = simplify(topoZ, staerke);
  const obj = topo.objects[objekt];
  const namen = [...new Set(obj.geometries.map(g => g.properties.name))];
  return namen.map(name => {
    const geom = merge(topo, obj.geometries.filter(g => g.properties.name === name));
    return { name, d: pfad(geom, true, 0.5), a: innerPunkt(geom) };
  }).filter(r => r.d).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
const meere = verschmelzen('meere', 2);
const inseln = verschmelzen('inseln', 0.6);
meerengen.sort((a, b) => a.name.localeCompare(b.name, 'de'));

// Kartenbreite in km entlang der waagrechten Mittellinie.
const R_ERDE = 6371;
function kmZwischen(a, b) {
  const dLat = (b[1] - a[1]) * RAD, dLon = (b[0] - a[0]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_ERDE * Math.asin(Math.sqrt(h));
}
let breiteKm = 0;
for (let i = 0; i < 500; i++) breiteKm += kmZwischen(unproject(i * W / 500, H / 2), unproject((i + 1) * W / 500, H / 2));
breiteKm = Math.round(breiteKm);

// --- prüfen und schreiben --------------------------------------------------
const fehler = [];
for (const name of Object.keys(MEER_TEILE)) if (!meere.some(m => m.name === name)) fehler.push(`Meer ${name} fehlt`);
for (const name of Object.keys(MEERENGE)) if (!meerengen.some(m => m.name === name)) fehler.push(`Meerenge ${name} fehlt`);
for (const name of [...Object.values(INSEL_NAME), ...Object.keys(HALBINSEL_AUS_LAND)]) {
  if (!inseln.some(m => m.name === name)) fehler.push(`Insel/Halbinsel ${name} fehlt`);
}
for (const l of LAENDER) {
  const c = countries.find(x => x.iso === l.iso);
  const k = kleinstaaten.find(x => x.iso === l.iso);
  if (!c?.d && !k) fehler.push(`${l.iso} ${l.name}: weder Fläche noch Punkt`);
}
for (const iso of Object.keys(AUSGESCHLOSSEN)) {
  if (countries.some(c => c.iso === iso)) fehler.push(`${iso} ist ausgeschlossen, steht aber in countries`);
}
if (fehler.length) {
  console.error('NICHT geschrieben:\n  ' + fehler.join('\n  '));
  process.exit(1);
}

const n = v => +v.toPrecision(15);
const js = `// AUTOGENERIERT von tools/build-geo-eu.mjs - nicht von Hand ändern.
// Grenzen, Flüsse, Gebirge, Meere, Inseln: Natural Earth (Public Domain), Länder in der
// Sichtweise Deutschland (ne_10m_admin_0_countries_deu).
// Projektion: Lambert Azimuthal Equal Area, Zentrum ${ZENTRUM[1]}° N / ${ZENTRUM[0]}° O (Kugel).
const GEO_EU = {
  viewBox: "0 0 ${W} ${H}",
  width: ${W},
  height: ${H},
  // Kartenbreite in km entlang der Mittellinie (für die Klicktoleranz)
  breiteKm: ${breiteKm},
  // geografische Koordinaten -> SVG-Koordinaten
  project(lon, lat) {
    const r = Math.PI / 180, l = lon * r - ${n(L0)}, p = lat * r;
    const k = Math.sqrt(2 / (1 + ${n(SIN1)} * Math.sin(p) + ${n(COS1)} * Math.cos(p) * Math.cos(l)));
    return [${n(TX)} + ${n(S)} * k * Math.cos(p) * Math.sin(l),
            ${n(TY)} - ${n(S)} * k * (${n(COS1)} * Math.sin(p) - ${n(SIN1)} * Math.cos(p) * Math.cos(l))];
  },
  // SVG-Koordinaten -> geografische Koordinaten (für Klicks auf die Blanko-Karte)
  unproject(x, y) {
    const r = Math.PI / 180, u = (x - ${n(TX)}) / ${n(S)}, v = (${n(TY)} - y) / ${n(S)};
    const rho = Math.hypot(u, v);
    if (rho < 1e-12) return [${ZENTRUM[0]}, ${ZENTRUM[1]}];
    const c = 2 * Math.asin(Math.min(1, rho / 2));
    const lat = Math.asin(Math.cos(c) * ${n(SIN1)} + v * Math.sin(c) * ${n(COS1)} / rho);
    const lon = ${n(L0)} + Math.atan2(u * Math.sin(c), rho * ${n(COS1)} * Math.cos(c) - v * ${n(SIN1)} * Math.sin(c));
    return [lon / r, lat / r];
  },
  // Umriss aller Länder des Lernstoffs
  country: ${JSON.stringify(country)},
  // Nachbarflächen ohne Quiz (grau): Nordafrika, Naher Osten, Georgien,
  // Armenien, Aserbaidschan, Kasachstan, abhängige Gebiete
  umgebung: ${JSON.stringify(umgebung)},
  // Seen ab etwa 160 km², nur zur Darstellung
  seen: ${JSON.stringify(seen)},
  countries: ${JSON.stringify(countries)},
  kleinstaaten: ${JSON.stringify(kleinstaaten)},
  rivers: ${JSON.stringify(rivers)},
  ranges: ${JSON.stringify(ranges)},
  // Meere (Flächen) und Meerengen (Punkt, geografisch)
  meere: ${JSON.stringify(meere)},
  meerengen: ${JSON.stringify(meerengen)},
  // Inseln und Halbinseln
  inseln: ${JSON.stringify(inseln)}
};
`;
fs.writeFileSync(OUT, js);
console.log(`geschrieben: ${OUT}  (${(Buffer.byteLength(js) / 1024).toFixed(0)} KB, viewBox 0 0 ${W} ${H}, Breite ${breiteKm} km)`);
console.log(`Länder ${countries.length}: ${countries.map(c => c.iso).join(' ')}`);
console.log(`Kleinstaaten ${kleinstaaten.length}: ${kleinstaaten.map(k => k.iso).join(' ')}`);
console.log(`Flüsse ${rivers.length}: ${rivers.map(r => r.name).join(', ')}`);
console.log(`Gebirge ${ranges.length}: ${ranges.map(r => r.name).join(', ')}`);
console.log(`Meere ${meere.length}: ${meere.map(r => r.name).join(', ')}`);
console.log(`Meerengen ${meerengen.length}: ${meerengen.map(r => `${r.name} (${r.lon}, ${r.lat})`).join(', ')}`);
console.log(`Inseln/Halbinseln ${inseln.length}: ${inseln.map(r => r.name).join(', ')}`);
const kb = s => (Buffer.byteLength(JSON.stringify(s)) / 1024).toFixed(0);
console.log(`Anteile KB: Länder ${kb(countries)}, Umriss ${kb(country)}, Umgebung ${kb(umgebung)}, Seen ${kb(seen)}, Flüsse ${kb(rivers)}, Gebirge ${kb(ranges)}, Meere ${kb(meere)}, Inseln ${kb(inseln)}`);
