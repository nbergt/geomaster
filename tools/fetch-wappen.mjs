// Holt die 26 Kantonswappen von Wikimedia Commons und schreibt sie als
// eingebettete PNGs nach js/wappen.js, damit die App offline läuft.
//   node tools/fetch-wappen.mjs
//
// Die Wappen der Schweizer Kantone sind amtliche Werke und gemeinfrei.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT = path.join(HERE, '..', 'js', 'wappen.js');
const UA = 'GeoMaster-Lernspiel/1.0 (privates Lernprojekt)';

const FILES = {
  AG: 'Wappen Aargau matt.svg',
  AI: 'Wappen Appenzell Innerrhoden matt.svg',
  AR: 'Wappen Appenzell Ausserrhoden matt.svg',
  BE: 'Wappen Bern matt.svg',
  BL: 'Wappen Basel-Landschaft matt.svg',
  BS: 'Wappen Basel-Stadt matt.svg',
  FR: 'Wappen Freiburg matt.svg',
  GE: 'Wappen Genf matt.svg',
  GL: 'Wappen Glarus matt.svg',
  GR: 'Wappen Graubünden matt.svg',
  JU: 'Wappen Jura matt.svg',
  LU: 'Wappen Luzern matt.svg',
  NE: 'Wappen Neuenburg matt.svg',
  NW: 'Wappen Nidwalden matt.svg',
  OW: 'Wappen Obwalden matt.svg',
  SG: 'Wappen St. Gallen matt.svg',
  SH: 'Wappen Schaffhausen matt.svg',
  SO: 'Wappen Solothurn matt.svg',
  SZ: 'Wappen Schwyz matt.svg',
  TG: 'Wappen Thurgau matt.svg',
  TI: 'Wappen Tessin matt.svg',
  UR: 'Wappen Uri matt.svg',
  VD: 'Wappen Waadt matt.svg',
  VS: 'Wappen Wallis matt.svg',
  ZG: 'Wappen Zug matt.svg',
  ZH: 'Wappen Zürich matt.svg',
};

const WIDTH = 200;

async function resolve(titles) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo',
    iiprop: 'url', iiurlwidth: String(WIDTH),
    titles: titles.map(t => 'File:' + t).join('|'),
  });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API: ${res.status}`);
  const json = await res.json();
  const map = new Map();
  for (const page of Object.values(json.query.pages)) {
    if (page.missing !== undefined) { map.set(page.title.replace(/^File:/, ''), null); continue; }
    map.set(page.title.replace(/^File:/, ''), page.imageinfo?.[0]?.thumburl ?? null);
  }
  return map;
}

const entries = Object.entries(FILES);
const urls = await resolve(entries.map(([, f]) => f));

const out = {};
const missing = [];
for (const [iso, file] of entries) {
  const url = urls.get(file.replace(/_/g, ' '));
  if (!url) { missing.push(`${iso} (${file})`); continue; }
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) { missing.push(`${iso} HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  out[iso] = 'data:image/png;base64,' + buf.toString('base64');
  process.stdout.write(`${iso} `);
}
console.log();

if (missing.length) {
  console.error('FEHLEND: ' + missing.join(', '));
  process.exitCode = 1;
}

const js = `// AUTOGENERIERT von tools/fetch-wappen.mjs - nicht von Hand ändern.
// Kantonswappen von Wikimedia Commons; amtliche Wappen der Schweizer Kantone,
// gemeinfrei. Als Data-URL eingebettet, damit die App ohne Internet läuft.
const WAPPEN = ${JSON.stringify(out, null, 0)};
`;
fs.writeFileSync(OUT, js);
console.log(`geschrieben: ${OUT}  (${Object.keys(out).length} Wappen, ${(js.length / 1024).toFixed(0)} KB)`);
