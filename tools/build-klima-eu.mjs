// Baut js/klima-eu.js (KLIMA_EU): Klimazonen Europas als Flächen und die
// Monatswerte der Klimadiagramm-Orte. Offline aus:
//   tools/raw-eu/worldclim-eu.json.gz   WorldClim 2.1, 1970–2000 (tools/fetch-worldclim-eu.mjs)
//   js/geo-eu.js                        Projektion und Landfläche (tools/build-geo-eu.mjs)
//   js/data-eu.js                       Zonen und Orte samt Koordinaten (tools/build-data-eu.mjs)
//   node tools/build-klima-eu.mjs
//
// Die sechs Zonen und ihre Merkmale stammen vom Arbeitsblatt «Klimazonen
// Europas» (Lernstoff Europa, November 2026). Wo das Blatt eine Zahl nennt,
// wird sie verwendet; die übrigen Grenzen sind hier festgelegt und gelten für
// jede Rasterzelle (rund 18 km) gleich:
//
//   1. Hochgebirgsklima   Zelle im Mittel ≥ 1500 m hoch, oder ≥ 800 m und der
//                         wärmste Monat unter 10 °C (Blatt: «von der Höhe bestimmt»)
//   2. Mittelmeerklima    Trockenzeit im Sommer (Blatt) nach Köppen: der
//                         trockenste Sommermonat (Jun–Aug) hat < 40 mm und
//                         weniger als ein Drittel des nassesten Wintermonats
//                         (Dez–Feb); kältester Monat ≥ 3 °C (Blatt)
//   3. Nordeuropäisches   kältester Monat unter −3 °C (Blatt) und weniger als
//      Klima              vier Monate mit ≥ 10 °C (kurzer Sommer, Köppen Dfc);
//                         oder wärmster Monat unter 10 °C (Tundra)
//   4. Ozeanisches Klima  Unterschied wärmster–kältester Monat < 16 °C (Blatt: ≈ 10 °C)
//   5. Übergangsklima     Unterschied 16 bis < 22 °C (Blatt: ≈ 20 °C)
//   6. Kontinentales      Unterschied ≥ 22 °C (Blatt: «sehr gross»)
//      Klima
//
// Ablauf: Zellen einteilen, einzelne Ausreisser glätten, Meerzellen mit der Zone der Nachbarn auffüllen
// (damit die Küste lückenlos bedeckt ist), Zonengrenzen mit d3-contour
// nachzeichnen, projizieren, topologisch vereinfachen und mit der Landfläche
// aus geo-eu.js verschneiden. Bei einem Fehler wird nichts geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { contours } from 'd3-contour';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { merge } from 'topojson-client';
import polygonClipping from 'polygon-clipping';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(HERE, '..', 'js');
const OUT = path.join(JS, 'klima-eu.js');
const laden = (datei, name) => new Function(fs.readFileSync(path.join(JS, datei), 'utf8') + `;return ${name}`)();
const GEO = laden('geo-eu.js', 'GEO_EU');
const DATA = laden('data-eu.js', 'DATA_EU');
const WC = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(HERE, 'raw-eu', 'worldclim-eu.json.gz'))));

const fehler = [];
const ZONEN = DATA.klimazonen.map(z => z.key);
const REGELN = ['hochgebirge', 'mittelmeer', 'nordeuropaeisch', 'ozeanisch', 'uebergang', 'kontinental'];
if (JSON.stringify([...ZONEN].sort()) !== JSON.stringify([...REGELN].sort())) {
  fehler.push(`Zonen im Stoff (${ZONEN}) passen nicht zu den Regeln (${REGELN})`);
}

// --- Zellen einteilen -------------------------------------------------------
const { spalten: NX, zeilen: NY, west: W0, nord: N0, schritt: DS } = WC;
const werte = i => {
  if (WC.elev[i] === null || WC.tavg.some(m => m[i] === null) || WC.prec.some(m => m[i] === null)) return null;
  return { t: WC.tavg.map(m => m[i] / 10), n: WC.prec.map(m => m[i]), z: WC.elev[i] };
};

function zoneVon({ t, n, z }) {
  const tmin = Math.min(...t), tmax = Math.max(...t);
  const sommerTrocken = Math.min(n[5], n[6], n[7]);
  const winterNass = Math.max(n[11], n[0], n[1]);
  const warmeMonate = t.filter(x => x >= 10).length;
  if (z >= 1500 || (z >= 800 && tmax < 10)) return 'hochgebirge';
  if (sommerTrocken < 40 && sommerTrocken < winterNass / 3 && tmin >= 3) return 'mittelmeer';
  if ((tmin < -3 && warmeMonate < 4) || tmax < 10) return 'nordeuropaeisch';
  const spanne = tmax - tmin;
  if (spanne < 16) return 'ozeanisch';
  if (spanne < 22) return 'uebergang';
  return 'kontinental';
}

const zone = new Array(NX * NY).fill(null);
for (let i = 0; i < NX * NY; i++) {
  const w = werte(i);
  if (w) zone[i] = REGELN.indexOf(zoneVon(w));
}
// Meerzellen an der Küste: häufigste Zone der Nachbarn, in mehreren Ringen.
for (let runde = 0; runde < 4; runde++) {
  const neu = zone.slice();
  for (let r = 0; r < NY; r++) for (let c = 0; c < NX; c++) {
    const i = r * NX + c;
    if (zone[i] !== null) continue;
    const zaehler = new Map();
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= NY || cc >= NX) continue;
      const z = zone[rr * NX + cc];
      if (z !== null) zaehler.set(z, (zaehler.get(z) || 0) + 1);
    }
    if (zaehler.size) neu[i] = [...zaehler].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  }
  for (let i = 0; i < neu.length; i++) zone[i] = neu[i];
}

// Einzelne abweichende Zellen glätten: jede Zelle bekommt die Zone, die in
// ihrer 3×3-Nachbarschaft am häufigsten ist, wenn diese mindestens 5 von 9
// Zellen hat. Die Klimadiagramm-Orte werden unten an den Rohwerten geprüft.
{
  const neu = zone.slice();
  for (let r = 1; r < NY - 1; r++) for (let c = 1; c < NX - 1; c++) {
    const i = r * NX + c;
    if (zone[i] === null) continue;
    const zaehler = new Map();
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const z = zone[(r + dr) * NX + c + dc];
      if (z !== null) zaehler.set(z, (zaehler.get(z) || 0) + 1);
    }
    const [z, n] = [...zaehler].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (n >= 5) neu[i] = z;
  }
  for (let i = 0; i < neu.length; i++) zone[i] = neu[i];
}

// --- Flächen nachzeichnen und projizieren -----------------------------------
// d3-contour liefert Ringe in Rasterkoordinaten (0..NX, 0..NY); eine Zelle
// (c, r) deckt c..c+1 ab, ihr Mittelpunkt liegt bei c+0.5.
const zuGeo = ([x, y]) => [W0 + x * DS, N0 - y * DS];
const features = REGELN.map((key, k) => {
  const maske = zone.map(z => (z === k ? 1 : 0));
  const [mp] = contours().size([NX, NY]).thresholds([0.5])(maske);
  const coordinates = mp.coordinates.map(poly => poly.map(ring => ring.map(p => GEO.project(...zuGeo(p)))));
  return { type: 'Feature', properties: { key }, geometry: { type: 'MultiPolygon', coordinates } };
});
const topo = presimplify(topology({ zonen: { type: 'FeatureCollection', features } }, 1e5));
const einfach = simplify(topo, 0.6);

// Landfläche: die Ringe des Umrisses aus geo-eu.js (nur M/L/Z).
const landRinge = GEO.country.split('M').filter(Boolean).map(s =>
  s.replace(/Z$/, '').split('L').map(p => p.trim().split(/\s+/).map(Number)));
// Gerade-ungerade wie beim Zeichnen: Ringe in Ringen sind Löcher (z. B. Meer am Kartenrand).
const land = polygonClipping.xor(...landRinge.map(r => [[...r, r[0]]]));

const r1 = n => Math.round(n * 10) / 10;
const flaeche = r => Math.abs(r.reduce((s, p, i) => {
  const q = r[(i + 1) % r.length];
  return s + (p[0] * q[1] - q[0] * p[1]);
}, 0) / 2);

// Innerer Punkt mit grösstem Randabstand im grössten Teil (wie build-geo-eu.mjs).
function innerPunkt(polys) {
  const gross = polys.reduce((a, b) => (flaeche(a[0]) > flaeche(b[0]) ? a : b));
  const ringe = gross;
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
      const [ax, ay] = r[i - 1], [bx, by] = r[i];
      const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l)) : 0;
      m = Math.min(m, Math.hypot(ax + t * dx - p[0], ay + t * dy - p[1]));
    }
    return m;
  };
  const xs = gross[0].map(p => p[0]), ys = gross[0].map(p => p[1]);
  let best = null, bestD = -1, schritt = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 40;
  const pruefen = p => { if (drin(p)) { const d = rand(p); if (d > bestD) { bestD = d; best = p; } } };
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += schritt) for (let y = Math.min(...ys); y <= Math.max(...ys); y += schritt) pruefen([x, y]);
  for (let n = 0; n < 4 && best; n++) {
    const [cx, cy] = best;
    schritt /= 4;
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) pruefen([cx + i * schritt, cy + j * schritt]);
  }
  return best ? best.map(r1) : null;
}

const zonen = REGELN.map(key => {
  const geom = merge(einfach, einfach.objects.zonen.geometries.filter(g => g.properties.key === key));
  const geschnitten = polygonClipping.intersection(geom.coordinates, land)
    .filter(poly => flaeche(poly[0]) >= 8);             // Splitter unter ≈ 200 km² (eine Zelle) weg
  if (!geschnitten.length) { fehler.push(`Zone ${key}: keine Fläche`); return null; }
  const d = geschnitten.map(poly => poly.map(ring => {
    const pts = ring.slice(0, -1).map(p => [r1(p[0]), r1(p[1])])
      .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
    return 'M' + pts.map(p => `${p[0]} ${p[1]}`).join('L') + 'Z';
  }).join('')).join('');
  return { key, d, a: innerPunkt(geschnitten) };
}).filter(Boolean);

// --- Klimadiagramm-Orte -----------------------------------------------------
const zelle = (lon, lat) => {
  const c = Math.floor((lon - W0) / DS), r = Math.floor((N0 - lat) / DS);
  return c >= 0 && r >= 0 && c < NX && r < NY ? r * NX + c : -1;
};
const orte = DATA.klimaorte.map(o => {
  const i = zelle(o.lon, o.lat);
  const w = i >= 0 ? werte(i) : null;
  if (!w) { fehler.push(`${o.name}: keine WorldClim-Werte am Ort`); return null; }
  const z = zoneVon(w);
  if (z !== o.zone) fehler.push(`${o.name}: Rasterzelle ergibt ${z}, im Stoff steht ${o.zone}`);
  return { name: o.name, hoehe: w.z, t: w.t.map(x => Math.round(x * 10) / 10), n: w.n };
}).filter(Boolean);

for (const key of REGELN) {
  if (!DATA.klimaorte.some(o => o.zone === key)) fehler.push(`Zone ${key}: kein Klimadiagramm-Ort`);
}
if (fehler.length) {
  console.error('NICHT geschrieben:\n  ' + fehler.join('\n  '));
  process.exit(1);
}

const js = `// AUTOGENERIERT von tools/build-klima-eu.mjs - nicht von Hand ändern.
// Klimazonen und Klimadiagramme Europas aus ${WC.quelle},
// abgerufen ${WC.abgerufen}. Einteilung und Grenzwerte: siehe tools/build-klima-eu.mjs.
const KLIMA_EU = {
  // Zonen als Flächen (SVG-Koordinaten wie js/geo-eu.js), mit der Landfläche verschnitten
  zonen: ${JSON.stringify(zonen)},
  // Monatswerte der Rasterzelle am Ort: t = Mitteltemperatur °C, n = Niederschlag mm,
  // hoehe = mittlere Höhe der Zelle in m
  orte: {
${orte.map(o => `    ${JSON.stringify(o.name)}: ${JSON.stringify({ hoehe: o.hoehe, t: o.t, n: o.n })}`).join(',\n')}
  },
};
`;
fs.writeFileSync(OUT, js);
const kb = s => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`geschrieben: ${OUT}  (${kb(js)} KB)`);
for (const z of zonen) console.log(`  ${z.key.padEnd(16)} ${kb(z.d).padStart(4)} KB  Anker ${z.a}`);
console.log(`Orte ${orte.length}: ${orte.map(o => o.name).join(', ')}`);
