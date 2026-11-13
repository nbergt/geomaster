// Liest tools/laender-europa.csv (UTF-8 mit BOM, Trennzeichen ";",
// Mehrfachwerte mit "|", Felder mit ";" in Anführungszeichen).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CSV_PFAD = join(dirname(fileURLToPath(import.meta.url)), '..', 'laender-europa.csv');

function zeileZerlegen(zeile) {
  const felder = [];
  let feld = '', inAnf = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (inAnf) {
      if (c === '"' && zeile[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inAnf = false;
      else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === ';') { felder.push(feld); feld = ''; }
    else feld += c;
  }
  felder.push(feld);
  return felder;
}

const liste = s => (s ? s.split('|').map(t => t.trim()).filter(Boolean) : []);

export function laenderLaden(pfad = CSV_PFAD) {
  const zeilen = readFileSync(pfad, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(z => z.trim());
  const kopf = zeileZerlegen(zeilen.shift());
  return zeilen.map((z, nr) => {
    const w = zeileZerlegen(z);
    if (w.length !== kopf.length) throw new Error(`laender-europa.csv Zeile ${nr + 2}: ${w.length} statt ${kopf.length} Felder`);
    const r = Object.fromEntries(kopf.map((k, i) => [k, w[i].trim()]));
    return {
      iso: r.iso, name: r.name, alias: liste(r.alias),
      hauptstadt: r.hauptstadt, hauptstadtAlias: liste(r.hauptstadt_alias),
      kfz: r.kfz, ne: r.ne_adm0_a3, kleinstaat: r.kleinstaat === 'ja',
      status: r.status, bemerkung: r.bemerkung,
    };
  });
}

// Entscheid Thomas: nur graue Umgebung, nie im Stoff.
export const AUSGESCHLOSSEN = { GE: 'GEO', AM: 'ARM', AZ: 'AZE', KZ: 'KAZ' };
