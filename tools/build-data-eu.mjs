// Erzeugt js/data-eu.js (DATA_EU, Lernstoff Europa), offline aus:
//   tools/laender-europa.csv        Länder, Hauptstädte, Kennzeichen, Aliasse
//   tools/stoff-eu.mjs              Flüsse, Gebirge, Gipfel, Meere, Inseln, Städte,
//                                   Klimazonen, Klimadiagramm-Orte, Filter (von Hand gepflegt)
//   tools/raw-eu/wikidata-eu.json   Koordinaten und Höhen (tools/fetch-wikidata-eu.mjs)
//   node tools/build-data-eu.mjs
//
// Namen kommen nie aus Wikidata, nur Koordinaten und Höhen. Die Wikidata-
// Bezeichnung der Hauptstadt muss aber zum Namen oder einem Alias aus der CSV
// passen, sonst wird nichts geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { laenderLaden, AUSGESCHLOSSEN } from './lib/laender.mjs';
import {
  FLUESSE, GEBIRGE, GIPFEL, HAUPTSTADT_HINWEIS, LAND_ARTIKEL, MEERE, INSELN, STAEDTE, KLIMAZONEN, KLIMAORTE, FILTER,
} from './stoff-eu.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'js', 'data-eu.js');
const WD = JSON.parse(fs.readFileSync(path.join(HERE, 'raw-eu', 'wikidata-eu.json'), 'utf8'));

const fehler = [];
const hinweise = [];
const normal = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
const r4 = n => Math.round(n * 1e4) / 1e4;

// --- Länder und Hauptstädte ------------------------------------------------
const laender = laenderLaden();
for (const l of laender) {
  if (AUSGESCHLOSSEN[l.iso]) fehler.push(`${l.iso} ist ausgeschlossen, steht aber in der CSV`);
  if (/[?]|bitte/i.test(l.status) || l.status !== 'fix') hinweise.push(`${l.iso}: status «${l.status}»`);
}

const hauptstaedte = laender.map(l => {
  const namen = [l.hauptstadt, ...l.hauptstadtAlias].map(normal);
  const kand = WD.hauptstaedte.filter(h => h.iso === l.iso && h.coord && namen.includes(normal(h.label)));
  if (!kand.length) {
    const wd = WD.hauptstaedte.filter(h => h.iso === l.iso).map(h => h.label).join(', ') || '—';
    fehler.push(`${l.iso}: Hauptstadt «${l.hauptstadt}» passt zu keinem Wikidata-Eintrag (dort: ${wd})`);
    return null;
  }
  // Mehrere Treffer (z. B. zwei Länder-Objekte für Zypern): bevorzugter Rang zuerst.
  kand.sort((a, b) => (b.rang === 'preferred') - (a.rang === 'preferred'));
  const orte = new Set(kand.map(k => k.coord.map(r4).join(',')));
  if (orte.size > 1) hinweise.push(`${l.iso}: Wikidata hat mehrere Koordinaten für ${l.hauptstadt}, genommen: ${kand[0].coord.map(r4)}`);
  if (normal(kand[0].label) !== normal(l.hauptstadt)) {
    hinweise.push(`${l.iso}: Wikidata nennt die Hauptstadt «${kand[0].label}», CSV «${l.hauptstadt}» (Alias passt)`);
  }
  return { iso: l.iso, name: l.hauptstadt, lon: r4(kand[0].coord[0]), lat: r4(kand[0].coord[1]), wikidata: kand[0].stadt };
}).filter(Boolean);

const laenderStoff = laender.map(l => {
  const e = { iso: l.iso, name: l.name };
  if (LAND_ARTIKEL[l.iso]) Object.assign(e, LAND_ARTIKEL[l.iso]);
  if (l.alias.length) e.alias = l.alias;
  e.hauptstadt = l.hauptstadt;
  if (l.hauptstadtAlias.length) e.hauptstadtAlias = l.hauptstadtAlias;
  if (HAUPTSTADT_HINWEIS[l.iso]) e.hauptstadtHinweis = HAUPTSTADT_HINWEIS[l.iso];
  e.kfz = l.kfz;
  if (l.kleinstaat) e.kleinstaat = true;
  return e;
});

// --- Gipfel ----------------------------------------------------------------
// Höhe: Wert mit Rang «preferred», sonst der jüngste mit Zeitpunkt, sonst der
// erste; in Metern, auf ganze Meter gerundet.
function hoeheWaehlen(g) {
  const m = g.hoehen.filter(h => h.einheit === 'Q11573');
  const pref = m.filter(h => h.rang === 'preferred');
  const datiert = m.filter(h => h.zeitpunkt).sort((a, b) => b.zeitpunkt.localeCompare(a.zeitpunkt));
  const h = pref[0] ?? datiert[0] ?? m[0];
  return Math.round(h.wert);
}

const gipfel = GIPFEL.map(g => {
  const wd = WD.gipfel.find(x => x.wikidata === g.wikidata);
  if (!wd) { fehler.push(`${g.name}: ${g.wikidata} fehlt in wikidata-eu.json (fetch-wikidata-eu.mjs laufen lassen)`); return null; }
  const k = wd.koord.find(c => c.rang === 'preferred') ?? wd.koord[0];
  const e = { name: g.name, artikel: g.artikel };
  if (g.alias) e.alias = g.alias;
  Object.assign(e, { hoehe: hoeheWaehlen(wd), lon: r4(k.lon), lat: r4(k.lat), land: g.land, wikidata: g.wikidata });
  return e;
}).filter(Boolean);

// --- weitere Städte und Klimadiagramm-Orte -----------------------------------
// Koordinaten aus Wikidata; die Bezeichnung muss zum Namen oder Alias passen.
function wdOrt(o) {
  const wd = (WD.orte || []).find(x => x.wikidata === o.wikidata);
  if (!wd) { fehler.push(`${o.name}: ${o.wikidata} fehlt in wikidata-eu.json (fetch-wikidata-eu.mjs laufen lassen)`); return null; }
  if (![o.name, ...(o.alias || [])].map(normal).includes(normal(wd.label))) {
    fehler.push(`${o.name}: Wikidata nennt ${o.wikidata} «${wd.label}»`);
  }
  const k = wd.koord.find(c => c.rang === 'preferred') ?? wd.koord[0];
  return [r4(k.lon), r4(k.lat)];
}
const staedte = STAEDTE.map(o => {
  const k = wdOrt(o);
  if (!k) return null;
  const e = { name: o.name };
  if (o.alias) e.alias = o.alias;
  return Object.assign(e, { land: o.land, lon: k[0], lat: k[1], wikidata: o.wikidata });
}).filter(Boolean);

const ortNachName = new Map([...hauptstaedte, ...staedte].map(o => [o.name, o]));
const klimaorte = KLIMAORTE.map(o => {
  let k = null;
  if (o.wikidata) k = wdOrt(o);
  else if (ortNachName.has(o.name)) k = [ortNachName.get(o.name).lon, ortNachName.get(o.name).lat];
  else fehler.push(`Klimaort ${o.name}: weder Hauptstadt/Stadt noch Wikidata-ID`);
  if (!KLIMAZONEN.some(z => z.key === o.zone)) fehler.push(`Klimaort ${o.name}: unbekannte Zone ${o.zone}`);
  if (!laender.some(l => l.iso === o.land)) fehler.push(`Klimaort ${o.name}: unbekanntes Land ${o.land}`);
  return k ? { name: o.name, land: o.land, zone: o.zone, lon: k[0], lat: k[1] } : null;
}).filter(Boolean);

for (const m of MEERE) if (!m.geo && !m.meerenge) fehler.push(`Meer ${m.name}: weder geo noch meerenge`);

// --- Filter-Vorlagen ----------------------------------------------------------
// Jeder Eintrag muss zu einem Objekt des Themas passen (Schlüssel oder Name).
const auswahl = {
  laender: laenderStoff.flatMap(l => [l.iso, l.name]),
  hauptstaedte: laenderStoff.flatMap(l => [l.iso, l.name, l.hauptstadt]),
  flaggen: laenderStoff.flatMap(l => [l.iso, l.name]),
  kennzeichen: laenderStoff.flatMap(l => [l.iso, l.name, l.kfz]),
  staedte: [...hauptstaedte, ...staedte].map(o => o.name),
  fluesse: FLUESSE.flatMap(f => [f.geo, f.name]),
  gebirge: GEBIRGE.flatMap(g => [g.geo, g.name]),
  gipfel: gipfel.map(g => g.name),
  meere: MEERE.map(m => m.name),
  inseln: INSELN.flatMap(i => [i.geo, i.name]),
  klimazonen: KLIMAZONEN.flatMap(z => [z.key, z.name]),
  klimadiagramme: KLIMAORTE.map(o => o.name),
};
for (const f of FILTER) {
  if (!f.id || !f.name) fehler.push(`Filter ohne id/name: ${JSON.stringify(f).slice(0, 60)}`);
  for (const [thema, liste] of Object.entries(f.themen)) {
    if (!auswahl[thema]) { fehler.push(`Filter ${f.id}: unbekanntes Thema ${thema}`); continue; }
    if (liste === 'alle') continue;
    for (const e of liste) if (!auswahl[thema].includes(e)) fehler.push(`Filter ${f.id}, ${thema}: «${e}» gibt es nicht`);
  }
}

// --- prüfen und schreiben --------------------------------------------------
const stoff = {
  laender: laenderStoff, hauptstaedte, fluesse: FLUESSE, gebirge: GEBIRGE, gipfel,
  meere: MEERE, inseln: INSELN, staedte, klimazonen: KLIMAZONEN, klimaorte, filter: FILTER,
};
const text = JSON.stringify(stoff);
if (text.includes('ß')) fehler.push('«ß» im Stoff (Schweizer Schreibweise: ss)');
for (const [iso, ne] of Object.entries(AUSGESCHLOSSEN)) {
  if (new RegExp(`"(${iso}|${ne})"`).test(text)) fehler.push(`ausgeschlossenes Land ${iso} kommt im Stoff vor`);
}
if (fehler.length) {
  console.error('NICHT geschrieben:\n  ' + fehler.join('\n  '));
  process.exit(1);
}

// Eine Zeile pro Eintrag, wie in data-ch.js.
const liste = (name, eintraege, kommentar) =>
  `  // ${kommentar}\n  ${name}: [\n${eintraege.map(e => '    ' + JSON.stringify(e)).join(',\n')},\n  ],`;

const js = `// AUTOGENERIERT von tools/build-data-eu.mjs - nicht von Hand ändern.
// Gepflegt wird in tools/laender-europa.csv (Länder, Hauptstädte, Kennzeichen)
// und tools/stoff-eu.mjs (übriger Stoff, Filter-Vorlagen); danach neu erzeugen.
// Koordinaten und Höhen: Wikidata (CC0), abgerufen ${WD.abgerufen}.
// lon/lat sind geografische Koordinaten (WGS84).

const DATA_EU = {
${liste('laender', laenderStoff, `${laenderStoff.length} Länder: Name, Hauptstadt, internationales Kennzeichen`)}
${liste('hauptstaedte', hauptstaedte, 'Hauptstädte mit Koordinaten (Wikidata P36/P625)')}
${liste('fluesse', FLUESSE, 'Flüsse; geo = Name der Geometrie in js/geo-eu.js')}
${liste('gebirge', GEBIRGE, 'Gebirge; geo = Name der Geometrie in js/geo-eu.js')}
${liste('gipfel', gipfel, 'Gipfel mit Höhe (m) und Koordinaten (Wikidata P2044/P625)')}
${liste('meere', MEERE, 'Meere (geo = Fläche in js/geo-eu.js) und Meerengen (Punkt in js/geo-eu.js)')}
${liste('inseln', INSELN, 'Inseln und Halbinseln; geo = Fläche in js/geo-eu.js')}
${liste('staedte', staedte, 'Weitere Städte (ausser Hauptstädten) mit Koordinaten (Wikidata P625)')}
${liste('klimazonen', KLIMAZONEN, 'Klimazonen; Flächen und Einteilung in js/klima-eu.js')}
${liste('klimaorte', klimaorte, 'Orte der Klimadiagramme; Monatswerte in js/klima-eu.js')}
${liste('filter', FILTER, 'Filter-Vorlagen: Thema -> "alle" oder Liste von Schlüsseln/Namen')}
};
`;
fs.writeFileSync(OUT, js);
console.log(`geschrieben: ${OUT}  (${(Buffer.byteLength(js) / 1024).toFixed(0)} KB)`);
console.log(`Länder ${laenderStoff.length}, Hauptstädte ${hauptstaedte.length}, Flüsse ${FLUESSE.length}, Gebirge ${GEBIRGE.length}, Gipfel ${gipfel.length}`);
console.log(`Meere ${MEERE.length}, Inseln ${INSELN.length}, Städte ${staedte.length}, Klimazonen ${KLIMAZONEN.length}, Klimaorte ${klimaorte.length}, Filter ${FILTER.length}`);
if (hinweise.length) console.log('Hinweise:\n  ' + hinweise.join('\n  '));
