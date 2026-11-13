// Lädt die Flaggen der Länder aus tools/laender-europa.csv von flag-icons
// (github.com/lipis/flag-icons, MIT) und bettet sie als SVG-Data-URL in
// js/flaggen-eu.js ein (Global FLAGGEN_EU[iso]).
//   node tools/fetch-flaggen.mjs
//
// Feste Version, damit das Ergebnis reproduzierbar ist. Fehlt eine Flagge
// oder sieht eine Datei nicht nach SVG aus, wird nichts geschrieben.
// Den Lizenztext legt das Skript nach LICENSES/flag-icons.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { laenderLaden } from './lib/laender.mjs';

const VERSION = 'v7.6.0';
const BASIS = `https://raw.githubusercontent.com/lipis/flag-icons/${VERSION}`;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'js', 'flaggen-eu.js');
const LIZENZ = path.join(HERE, '..', 'LICENSES', 'flag-icons.txt');

// flag-icons benennt die Dateien nach ISO-3166-alpha-2, klein geschrieben;
// Kosovo als «xk», Vereinigtes Königreich als «gb».
const datei = iso => `${iso.toLowerCase()}.svg`;

async function holen(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'GeoMaster-Build/1.0' } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.text();
}

// Kommentare und überflüssige Leerräume weg; der Inhalt bleibt gleich.
// (Die Pfade von flag-icons haben schon nur eine Nachkommastelle. Grösster
// Brocken ist das Wappen in der Flagge Serbiens; Entscheid Thomas: alle
// Flaggen bleiben SVG, auch wenn die Datei damit rund 490 KB gross wird.)
const schlank = svg => svg
  .replace(/<\?xml[^>]*>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Für eine Data-URL nur die nötigen Zeichen kodieren (kürzer als base64).
const alsDataUrl = svg => 'data:image/svg+xml,' + svg
  .replace(/"/g, "'")
  .replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')
  .replace(/\s+/g, ' ');

const laender = laenderLaden();
const flaggen = {};
const fehler = [];
for (const l of laender) {
  try {
    const svg = schlank(await holen(`${BASIS}/flags/4x3/${datei(l.iso)}`));
    if (!/^<svg[\s>]/.test(svg) || !svg.endsWith('</svg>')) throw new Error('kein SVG');
    if (/<script|\bon\w+\s*=|javascript:|<foreignObject|xlink:href\s*=\s*["']https?:/i.test(svg)) {
      throw new Error('enthält Skript, Ereignis-Attribut oder externen Verweis');
    }
    flaggen[l.iso] = alsDataUrl(svg);
  } catch (e) {
    fehler.push(`${l.iso} (${datei(l.iso)}): ${e.message}`);
  }
}

let lizenz = '';
try { lizenz = await holen(`${BASIS}/LICENSE`); } catch (e) { fehler.push(`LICENSE: ${e.message}`); }
if (lizenz && !/MIT License/i.test(lizenz)) fehler.push('LICENSE ist nicht der erwartete MIT-Text');

if (fehler.length) {
  console.error('NICHT geschrieben:\n  ' + fehler.join('\n  '));
  process.exit(1);
}

const js = `// AUTOGENERIERT von tools/fetch-flaggen.mjs - nicht von Hand ändern.
// Flaggen: flag-icons ${VERSION} (github.com/lipis/flag-icons), MIT-Lizenz,
// siehe LICENSES/flag-icons.txt. Format 4:3, als SVG-Data-URL.
const FLAGGEN_EU = {
${Object.entries(flaggen).map(([iso, url]) => `  ${iso}: ${JSON.stringify(url)},`).join('\n')}
};
`;
fs.mkdirSync(path.dirname(LIZENZ), { recursive: true });
fs.writeFileSync(LIZENZ, `flag-icons ${VERSION} — https://github.com/lipis/flag-icons\n` +
  `Verwendet für die Flaggen in js/flaggen-eu.js (GeoMaster, Datenset Europa).\n\n${lizenz.trim()}\n`);
fs.writeFileSync(OUT, js);
const groesste = Object.entries(flaggen).sort((a, b) => b[1].length - a[1].length).slice(0, 5)
  .map(([iso, u]) => `${iso} ${(u.length / 1024).toFixed(1)} KB`).join(', ');
console.log(`geschrieben: ${OUT}  (${(Buffer.byteLength(js) / 1024).toFixed(0)} KB, ${Object.keys(flaggen).length} Flaggen; grösste: ${groesste})`);
console.log(`geschrieben: ${LIZENZ}`);
