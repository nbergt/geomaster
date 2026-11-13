// Holt Koordinaten der Hauptstädte und Koordinaten/Höhen der Gipfel aus
// Wikidata (CC0) und legt sie in tools/raw-eu/wikidata-eu.json ab, damit
// tools/build-data-eu.mjs danach offline und reproduzierbar läuft.
//   node tools/fetch-wikidata-eu.mjs
//
// Hauptstädte: Land über den ISO-Code (P297), Hauptstadt (P36, ohne Enddatum
// und ohne «deprecated»), Koordinaten (P625). Gipfel: die Objekte aus
// tools/stoff-eu.mjs, Koordinaten (P625) und alle Höhenangaben (P2044) mit Rang.
// Weitere Orte: STAEDTE und KLIMAORTE mit `wikidata` aus tools/stoff-eu.mjs, Koordinaten (P625).
// Bei einem Fehler wird nichts geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { laenderLaden } from './lib/laender.mjs';
import { GIPFEL, STAEDTE, KLIMAORTE } from './stoff-eu.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'raw-eu', 'wikidata-eu.json');
const KOPF = { 'User-Agent': 'GeoMaster-Build/1.0 (private Lern-App, Build-Skript)', Accept: 'application/json' };

async function holen(url) {
  for (let versuch = 1; ; versuch++) {
    const r = await fetch(url, { headers: KOPF });
    if (r.ok) return r.json();
    if (versuch >= 3 || (r.status !== 429 && r.status < 500)) throw new Error(`${r.status} ${r.statusText}: ${url.slice(0, 120)}`);
    await new Promise(res => setTimeout(res, 5000 * versuch));   // Wikidata bremst: warten
  }
}

const id = uri => uri.split('/').pop();
const punkt = wkt => { const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(wkt); return m ? [+m[1], +m[2]] : null; };

// --- Hauptstädte -----------------------------------------------------------
const laender = laenderLaden();
const sparql = `SELECT ?iso ?land ?stadt ?stadtLabel ?coord ?rang WHERE {
  VALUES ?iso { ${laender.map(l => `"${l.iso}"`).join(' ')} }
  ?land wdt:P297 ?iso .
  ?land p:P36 ?aussage . ?aussage ps:P36 ?stadt . ?aussage wikibase:rank ?rang .
  FILTER NOT EXISTS { ?aussage pq:P582 ?ende }
  FILTER (?rang != wikibase:DeprecatedRank)
  OPTIONAL { ?stadt wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". }
}`;
const antwort = await holen('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql));

const hauptstaedte = [];
for (const b of antwort.results.bindings) {
  const e = {
    iso: b.iso.value, land: id(b.land.value), stadt: id(b.stadt.value),
    label: b.stadtLabel.value, coord: b.coord ? punkt(b.coord.value) : null,
    rang: b.rang.value.split('#').pop().replace('Rank', '').toLowerCase(),
  };
  // Dieselbe Aussage kommt über mehrere Koordinaten oder Länder-Objekte mehrfach.
  if (!hauptstaedte.some(h => h.iso === e.iso && h.stadt === e.stadt && h.land === e.land && String(h.coord) === String(e.coord))) {
    hauptstaedte.push(e);
  }
}
hauptstaedte.sort((a, b) => a.iso.localeCompare(b.iso) || a.stadt.localeCompare(b.stadt));

// --- Gipfel ----------------------------------------------------------------
const ids = GIPFEL.map(g => g.wikidata);
if (ids.some(x => !/^Q\d+$/.test(x || ''))) throw new Error('Gipfel ohne gültige Wikidata-ID in tools/stoff-eu.mjs');
const ent = await holen(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=de|en&ids=${ids.join('|')}`);

const gipfel = GIPFEL.map(g => {
  const e = ent.entities[g.wikidata];
  if (!e || e.missing !== undefined) throw new Error(`Wikidata ${g.wikidata} (${g.name}) nicht gefunden`);
  const c = e.claims || {};
  const koord = (c.P625 || []).filter(a => a.rank !== 'deprecated').map(a => ({
    lon: a.mainsnak.datavalue?.value.longitude, lat: a.mainsnak.datavalue?.value.latitude, rang: a.rank,
  }));
  const hoehen = (c.P2044 || []).filter(a => a.rank !== 'deprecated').map(a => ({
    wert: +a.mainsnak.datavalue?.value.amount,
    einheit: a.mainsnak.datavalue?.value.unit.split('/').pop(),
    rang: a.rank,
    zeitpunkt: a.qualifiers?.P585?.[0]?.datavalue?.value.time ?? null,
  }));
  return {
    name: g.name, wikidata: g.wikidata,
    label: e.labels?.de?.value ?? e.labels?.en?.value ?? null,
    typ: (c.P31 || []).map(a => a.mainsnak.datavalue?.value.id),
    koord, hoehen,
  };
});

// --- weitere Orte (Städte, Klimadiagramm-Orte) ------------------------------
const ORTE = [...STAEDTE, ...KLIMAORTE.filter(o => o.wikidata)];
const sIds = ORTE.map(s => s.wikidata);
if (sIds.some(x => !/^Q\d+$/.test(x || ''))) throw new Error('Ort ohne gültige Wikidata-ID in tools/stoff-eu.mjs');
const sEnt = await holen(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=de|en&ids=${sIds.join('|')}`);
const orte = ORTE.map(s => {
  const e = sEnt.entities[s.wikidata];
  if (!e || e.missing !== undefined) throw new Error(`Wikidata ${s.wikidata} (${s.name}) nicht gefunden`);
  const koord = (e.claims?.P625 || []).filter(a => a.rank !== 'deprecated').map(a => ({
    lon: a.mainsnak.datavalue?.value.longitude, lat: a.mainsnak.datavalue?.value.latitude, rang: a.rank,
  }));
  return { name: s.name, wikidata: s.wikidata, label: e.labels?.de?.value ?? e.labels?.en?.value ?? null, koord };
});

// --- prüfen und schreiben --------------------------------------------------
const fehler = [];
for (const s of orte) if (!s.koord.length) fehler.push(`${s.name}: keine Koordinaten`);
for (const l of laender) {
  if (!hauptstaedte.some(h => h.iso === l.iso && h.coord)) fehler.push(`${l.iso}: keine Hauptstadt mit Koordinaten`);
}
for (const g of gipfel) {
  if (!g.koord.length) fehler.push(`${g.name}: keine Koordinaten`);
  if (!g.hoehen.some(h => h.einheit === 'Q11573')) fehler.push(`${g.name}: keine Höhe in Metern`);
}
if (fehler.length) {
  console.error('NICHT geschrieben:\n  ' + fehler.join('\n  '));
  process.exit(1);
}

const daten = { quelle: 'Wikidata (CC0)', abgerufen: new Date().toISOString().slice(0, 10), hauptstaedte, gipfel, orte };
fs.writeFileSync(OUT, JSON.stringify(daten, null, 1) + '\n');
console.log(`geschrieben: ${OUT}  (${hauptstaedte.length} Hauptstadt-Einträge, ${gipfel.length} Gipfel, ${orte.length} weitere Orte)`);
