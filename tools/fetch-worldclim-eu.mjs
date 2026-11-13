// Holt die Klima-Normalwerte von WorldClim 2.1 (Fick & Hijmans 2017, CC BY 4.0)
// und legt den Europa-Ausschnitt in tools/raw-eu/worldclim-eu.json.gz ab, damit
// tools/build-klima-eu.mjs danach offline und reproduzierbar läuft.
//   NODE_USE_ENV_PROXY=1 node tools/fetch-worldclim-eu.mjs   (Proxy nur, wenn nötig)
//
// Quelle: https://geodata.ucdavis.edu/climate/worldclim/2_1/base/
//   wc2.1_10m_tavg.zip  Monatsmittel der Lufttemperatur 1970–2000, °C
//   wc2.1_10m_prec.zip  Monatssummen des Niederschlags 1970–2000, mm
//   wc2.1_10m_elev.zip  Höhe über Meer, m
// Auflösung 10 Bogenminuten (rund 18 km). Ausschnitt 25° W – 85° O, 33° – 80° N (ganzer Kartenausschnitt).
// Gespeichert werden ganze Zahlen: Temperatur in Zehntelgrad, Niederschlag in mm,
// Höhe in m; fehlende Werte (Meer) als null. Bei einem Fehler wird nichts geschrieben.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fromArrayBuffer } from 'geotiff';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'raw-eu', 'worldclim-eu.json.gz');
const BASIS = 'https://geodata.ucdavis.edu/climate/worldclim/2_1/base/';
const AUSSCHNITT = { west: -25, ost: 85, sued: 33, nord: 80 };

const tmp = mkdtempSync(path.join(tmpdir(), 'gm-wc-'));
try {
  async function laden(name) {
    const ziel = path.join(tmp, name);
    const r = await fetch(BASIS + name);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${BASIS + name}`);
    fs.writeFileSync(ziel, Buffer.from(await r.arrayBuffer()));
    execFileSync('unzip', ['-o', '-q', ziel, '-d', tmp]);
  }
  for (const v of ['tavg', 'prec', 'elev']) await laden(`wc2.1_10m_${v}.zip`);

  // Ein Raster lesen und auf den Ausschnitt zuschneiden.
  let kopf = null;
  async function raster(datei, faktor) {
    const buf = fs.readFileSync(path.join(tmp, datei));
    const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const bild = await tiff.getImage();
    const [x0, y1] = bild.getOrigin();                 // linke obere Ecke (lon, lat)
    const [dx, dy] = bild.getResolution();             // dy ist negativ
    const nodata = Number(bild.getGDALNoData());
    const c0 = Math.round((AUSSCHNITT.west - x0) / dx), c1 = Math.round((AUSSCHNITT.ost - x0) / dx);
    const r0 = Math.round((AUSSCHNITT.nord - y1) / dy), r1 = Math.round((AUSSCHNITT.sued - y1) / dy);
    const [daten] = await bild.readRasters({ window: [c0, r0, c1, r1] });
    const k = { west: x0 + c0 * dx, nord: y1 + r0 * dy, schritt: dx, spalten: c1 - c0, zeilen: r1 - r0 };
    if (Math.abs(dx + dy) > 1e-9) throw new Error(`${datei}: Zellen nicht quadratisch`);
    if (kopf && JSON.stringify(kopf) !== JSON.stringify(k)) throw new Error(`${datei}: anderes Raster`);
    kopf = k;
    return Array.from(daten, w => (Number.isNaN(w) || w === nodata || w < -1e30 ? null : Math.round(w * faktor)));
  }

  const monate = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const tavg = [], prec = [];
  for (const m of monate) tavg.push(await raster(`wc2.1_10m_tavg_${m}.tif`, 10));
  for (const m of monate) prec.push(await raster(`wc2.1_10m_prec_${m}.tif`, 1));
  const elev = await raster('wc2.1_10m_elev.tif', 1);

  const land = elev.filter(v => v !== null).length;
  if (land < 1000) throw new Error(`nur ${land} Landzellen im Ausschnitt`);

  const daten = {
    quelle: 'WorldClim 2.1 (Fick & Hijmans 2017), 1970–2000, 10 Bogenminuten, CC BY 4.0',
    url: BASIS, abgerufen: new Date().toISOString().slice(0, 10),
    ...kopf, einheit: { tavg: '0.1 °C', prec: 'mm', elev: 'm' }, tavg, prec, elev,
  };
  fs.writeFileSync(OUT, zlib.gzipSync(JSON.stringify(daten), { level: 9 }));
  console.log(`geschrieben: ${OUT}  (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB, ${kopf.spalten}×${kopf.zeilen} Zellen, ${land} an Land)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
