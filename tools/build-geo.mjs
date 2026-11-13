// Baut js/geo-ch.js aus den Rohdaten in tools/raw/.
//   node tools/build-geo.mjs
//
// Quellen (alle offen lizenziert):
//   cantons.geojson   swisstopo via geoBoundaries (gbOpen)
//   country.geojson   ZHB/switzerland-geojson
//   lake-*.geojson    ZHB/switzerland-geojson
//   zugersee.json     OpenStreetMap via Overpass (ODbL)
//   rivers-ch.json    OpenStreetMap via Overpass (ODbL)
//   zihl.json         OpenStreetMap via Overpass (ODbL)
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const RAW = path.join(HERE, 'raw');
const OUT = path.join(HERE, '..', 'js', 'geo-ch.js');
const read = f => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));

// --- Projektion -------------------------------------------------------------
// Einfache Zylinderprojektion. Für die Ausdehnung der Schweiz ist der Fehler
// gegenüber einer echten Kegelprojektion im Zehntelmillimeter-Bereich.
const K = Math.cos(46.8 * Math.PI / 180);
const proj = ([lon, lat]) => [lon * K, -lat];

// --- Douglas-Peucker --------------------------------------------------------
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sq = tol * tol;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sq && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const ringArea = r => Math.abs(r.reduce((s, p, i) => {
  const q = r[(i + 1) % r.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);

function ringsOf(geom) {
  const out = [];
  const push = poly => poly.forEach(r => out.push(r));
  if (geom.type === 'Polygon') push(geom.coordinates);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(push);
  else if (geom.type === 'LineString') out.push(geom.coordinates);
  else if (geom.type === 'MultiLineString') geom.coordinates.forEach(l => out.push(l));
  return out;
}

// --- viewBox aus dem Landesumriss ------------------------------------------
const countryFC = read('country.geojson');
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const f of countryFC.features) for (const r of ringsOf(f.geometry)) for (const c of r) {
  const [x, y] = proj(c);
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const PAD = 0.012;                       // 1.2 % Rand, damit nichts anstösst
const spanX = maxX - minX, spanY = maxY - minY;
minX -= spanX * PAD; maxX += spanX * PAD;
minY -= spanY * PAD; maxY += spanY * PAD;

const W = 1000;
const scale = W / (maxX - minX);
const H = Math.round((maxY - minY) * scale);
const toSvg = c => { const [x, y] = proj(c); return [(x - minX) * scale, (y - minY) * scale]; };

// 1000 SVG-Einheiten entsprechen rund 350 km, also 1 Einheit ≈ 350 m.
const TOL = { canton: 0.4, lake: 0.3, river: 0.5 };
const r1 = n => Math.round(n * 10) / 10;

function toPath(geom, tol, closed = true, minArea = 0) {
  const parts = [];
  for (const ring of ringsOf(geom)) {
    const pts = simplify(ring.map(toSvg), tol);
    if (pts.length < (closed ? 4 : 2)) continue;
    if (closed && minArea && ringArea(pts) < minArea) continue;
    parts.push('M' + pts.map(p => `${r1(p[0])} ${r1(p[1])}`).join('L') + (closed ? 'Z' : ''));
  }
  return parts.join('');
}

// Ankerpunkt für die Beschriftung: Schwerpunkt des grössten Rings. Für die
// paar Kantone, bei denen der Schwerpunkt ungünstig liegt (Wallis, Tessin,
// Graubünden), wird unten von Hand nachjustiert.
function anchor(geom) {
  const rings = ringsOf(geom).map(r => r.map(toSvg));
  if (!rings.length) return null;
  const big = rings.reduce((a, b) => (ringArea(a) > ringArea(b) ? a : b));
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < big.length; i++) {
    const [x0, y0] = big[i], [x1, y1] = big[(i + 1) % big.length];
    const f = x0 * y1 - x1 * y0;
    a2 += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (!a2) {                                   // Linie statt Fläche: Mittelpunkt
    const m = big[Math.floor(big.length / 2)];
    return [r1(m[0]), r1(m[1])];
  }
  return [r1(cx / (3 * a2)), r1(cy / (3 * a2))];
}

// Beschriftung mittig auf dem längsten Teilstück eines Flusses.
function lineAnchor(segs) {
  const projected = segs.map(s => s.map(toSvg));
  const longest = projected.reduce((a, b) => (b.length > a.length ? b : a), projected[0]);
  const m = longest[Math.floor(longest.length / 2)];
  return [r1(m[0]), r1(m[1])];
}

// --- Kantone ----------------------------------------------------------------
// Schwerpunkt liegt bei diesen Kantonen ungünstig (Talform, Enklaven).
const CANTON_ANCHOR_FIX = {
  VS: [7.55, 46.20], TI: [8.90, 46.30], GR: [9.65, 46.70], BE: [7.60, 46.90],
  SG: [9.30, 47.20], VD: [6.65, 46.65], FR: [7.05, 46.72], GE: [6.13, 46.22],
  BS: [7.60, 47.56], AI: [9.42, 47.32], AR: [9.30, 47.38], NW: [8.38, 46.94],
  OW: [8.25, 46.85], UR: [8.65, 46.80],
};

const cantons = read('cantons.geojson').features.map(f => {
  const iso = f.properties.shapeISO.replace('CH-', '');
  const fix = CANTON_ANCHOR_FIX[iso];
  return {
    iso,
    d: toPath(f.geometry, TOL.canton, true, 0.8),
    a: fix ? toSvg(fix).map(r1) : anchor(f.geometry),
  };
}).sort((a, b) => a.iso.localeCompare(b.iso));

const country = toPath({
  type: 'MultiPolygon',
  coordinates: countryFC.features.flatMap(f =>
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates),
}, TOL.canton, true, 0.8);

// --- Seen -------------------------------------------------------------------
const LAKE_FILES = {
  'lake-geneva': 'Genfersee', 'lake-constance': 'Bodensee', 'lake-neuchatel': 'Neuenburgersee',
  'lake-maggiore': 'Lago Maggiore', 'lake-lucerne': 'Vierwaldstättersee', 'lake-zurich': 'Zürichsee',
  'lake-lugano': 'Luganersee', 'lake-thun': 'Thunersee', 'lake-biel': 'Bielersee',
  'lake-of-gruyere': 'Greyerzersee', 'lake-brienz': 'Brienzersee', 'lake-walensee': 'Walensee',
  'lake-morat': 'Murtensee', 'lake-sempach': 'Sempachersee', 'lake-hallwil': 'Hallwilersee',
  'lake-sihl': 'Sihlsee', 'lake-baldegg': 'Baldeggersee', 'lake-sarnen': 'Sarnersee',
  'lake-lac-de-joux': 'Lac de Joux', 'lake-wagitalersee': 'Wägitalersee',
};

const lakes = Object.entries(LAKE_FILES).map(([file, name]) => {
  const fc = read(file + '.geojson');
  const geom = {
    type: 'MultiPolygon',
    coordinates: fc.features.flatMap(f =>
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates),
  };
  return { name, d: toPath(geom, TOL.lake, true, 0.3), a: anchor(geom) };
}).filter(l => l.d);

// Der Zugersee fehlt im Seen-Datensatz und kommt aus OSM (Relation mit Teilstücken,
// die erst zu geschlossenen Ringen zusammengesetzt werden müssen).
function stitch(members) {
  const open = members.filter(m => m.geometry?.length).map(m => m.geometry.map(p => [p.lon, p.lat]));
  const rings = [];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  while (open.length) {
    let ring = open.shift();
    let joined = true;
    while (joined && !same(ring[0], ring[ring.length - 1])) {
      joined = false;
      for (let i = 0; i < open.length; i++) {
        const seg = open[i];
        const end = ring[ring.length - 1];
        if (same(end, seg[0])) { ring = ring.concat(seg.slice(1)); open.splice(i, 1); joined = true; break; }
        if (same(end, seg[seg.length - 1])) { ring = ring.concat(seg.slice(0, -1).reverse()); open.splice(i, 1); joined = true; break; }
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

const zugRel = read('zugersee.json').elements.find(e => e.type === 'relation');
const zugRings = stitch((zugRel.members || []).filter(m => m.role !== 'inner'));
if (zugRings.length) {
  const geom = { type: 'MultiPolygon', coordinates: zugRings.map(r => [r]) };
  lakes.push({ name: 'Zugersee', d: toPath(geom, TOL.lake, true, 0.3), a: anchor(geom) });
}
lakes.sort((a, b) => a.name.localeCompare(b.name, 'de'));

// --- Flüsse -----------------------------------------------------------------
// OSM führt dieselben Flüsse unter mehreren Sprachnamen; hier zusammengeführt.
const RIVER_ALIAS = {
  'Ticino': 'Ticino', 'Maggia': 'Maggia',
  'Rotten': 'Rhone', 'Le Rhône': 'Rhone', 'Rhone': 'Rhone', 'Rhône': 'Rhone',
  'Sense': 'Sense', 'Singine': 'Sense',
  'La Thièle / Zihl': 'Thièle / Zihl', 'La Thièle': 'Thièle / Zihl',
  'Canal de la Thielle': 'Thièle / Zihl', 'Zihl': 'Thièle / Zihl', 'Thielle': 'Thièle / Zihl',
  "L'Areuse": 'Areuse', 'Areuse': 'Areuse',
  'Aare': 'Aare', 'Emme': 'Emme', 'Suhre': 'Suhre', 'Reuss': 'Reuss',
  'Saane': 'Saane', 'La Sarine': 'Saane', 'Sarine': 'Saane',
  'Limmat': 'Limmat',
  'Rhein': 'Rhein', 'Vorderrhein': 'Rhein', 'Rein Anteriur': 'Rhein', 'Hinterrhein': 'Rhein',
};

const riverSegs = new Map();
for (const file of ['rivers-ch.json', 'zihl.json']) {
  for (const el of read(file).elements) {
    const name = RIVER_ALIAS[el.tags?.name];
    if (!name || !el.geometry) continue;
    if (!riverSegs.has(name)) riverSegs.set(name, []);
    riverSegs.get(name).push(el.geometry.map(p => [p.lon, p.lat]));
  }
}
// Beschriftung dort, wo der Fluss gut erkennbar ist statt am zufälligen Mittelstück.
const RIVER_ANCHOR_FIX = {
  Rhein: [9.45, 47.05], Rhone: [7.30, 46.25], Aare: [7.75, 47.15], Reuss: [8.45, 47.05],
  Ticino: [8.85, 46.35], Emme: [7.70, 47.05], Saane: [7.15, 46.65], Sense: [7.35, 46.85],
  'Thièle / Zihl': [7.05, 47.02], Areuse: [6.75, 46.93], Suhre: [8.05, 47.25],
  Limmat: [8.35, 47.42], Maggia: [8.68, 46.30],
};

const rivers = [...riverSegs].map(([name, segs]) => ({
  name,
  d: toPath({ type: 'MultiLineString', coordinates: segs }, TOL.river, false),
  a: RIVER_ANCHOR_FIX[name] ? toSvg(RIVER_ANCHOR_FIX[name]).map(r1) : lineAnchor(segs),
})).filter(r => r.d).sort((a, b) => a.name.localeCompare(b.name, 'de'));

// --- schreiben --------------------------------------------------------------
const js = `// AUTOGENERIERT von tools/build-geo.mjs - nicht von Hand ändern.
// Kantone/Umriss: swisstopo via geoBoundaries. Seen/Flüsse: OpenStreetMap (ODbL)
// und ZHB/switzerland-geojson.
const GEO = {
  viewBox: "0 0 ${W} ${H}",
  width: ${W},
  height: ${H},
  // geografische Koordinaten -> SVG-Koordinaten
  project(lon, lat) {
    return [(lon * ${K} - (${minX})) * ${scale}, (-lat - (${minY})) * ${scale}];
  },
  // SVG-Koordinaten -> geografische Koordinaten (für Klicks auf die Blanko-Karte)
  unproject(x, y) {
    return [(x / ${scale} + (${minX})) / ${K}, -(y / ${scale} + (${minY}))];
  },
  country: ${JSON.stringify(country)},
  cantons: ${JSON.stringify(cantons)},
  lakes: ${JSON.stringify(lakes)},
  rivers: ${JSON.stringify(rivers)}
};
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, js);
console.log(`geschrieben: ${OUT}  (${(js.length / 1024).toFixed(0)} KB, viewBox 0 0 ${W} ${H})`);
console.log(`Kantone ${cantons.length}: ${cantons.map(c => c.iso).join(' ')}`);
console.log(`Seen ${lakes.length}: ${lakes.map(l => l.name).join(', ')}`);
console.log(`Flüsse ${rivers.length}: ${rivers.map(r => r.name).join(', ')}`);
