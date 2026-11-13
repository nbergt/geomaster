// Veröffentlicht die App (nur die Dateien, die der Browser braucht) auf
// GitHub Pages: https://nbergt.github.io/geomaster/
//   node tools/veroeffentlichen.mjs
//
// Die Dateien werden in einen eigenen Ordner neben dem Projekt kopiert
// (C:\Apps\GeoMaster-web, eigenes git-Repo mit dem öffentlichen Remote) und
// dort committet und gepusht. Das Entwicklungs-Repo hier hat keinen Remote;
// Fotos, Handoff, Werkzeuge und Rohdaten bleiben lokal.
// Vorher müssen die Prüfungen bestehen (check.mjs --ch --eu).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, '..', 'GeoMaster-web');
const APP = ['index.html', 'css', 'js', 'LICENSES'];

const lauf = (cmd, args, cwd = ZIEL) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

// 1. Prüfen
lauf(process.execPath, [path.join(WURZEL, 'tools', 'check.mjs'), '--ch', '--eu'], WURZEL);

// 2. App-Dateien spiegeln (Veraltetes im Ziel entfernen, .git und README bleiben)
if (!fs.existsSync(path.join(ZIEL, '.git'))) throw new Error(`${ZIEL} ist kein git-Repo (einmalig einrichten, siehe README)`);
for (const f of APP) fs.rmSync(path.join(ZIEL, f), { recursive: true, force: true });
for (const f of APP) fs.cpSync(path.join(WURZEL, f), path.join(ZIEL, f), { recursive: true });
fs.writeFileSync(path.join(ZIEL, '.nojekyll'), '');

// 3. Committen und pushen, falls sich etwas geändert hat
lauf('git', ['add', '-A']);
const status = execFileSync('git', ['status', '--porcelain'], { cwd: ZIEL, encoding: 'utf8' });
if (!status.trim()) {
  console.log('Keine Änderungen — nichts zu veröffentlichen.');
} else {
  const stand = execFileSync('git', ['log', '-1', '--format=%h %s'], { cwd: WURZEL, encoding: 'utf8' }).trim();
  lauf('git', ['commit', '-q', '-m', `App aktualisiert (Entwicklungsstand ${stand})`]);
  lauf('git', ['push', '-q']);
  console.log('Veröffentlicht: https://nbergt.github.io/geomaster/ (GitHub braucht 1–2 Minuten)');
}
