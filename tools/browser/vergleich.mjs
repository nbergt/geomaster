// Browser-Vergleich zweier Stände (z. B. Sicherungskopie gegen Arbeitsstand)
// per Chrome DevTools Protocol, headless, mit festem Zufall.
// Aufruf: node tools/browser/vergleich.mjs <ordnerA> <ordnerB> [szenario.mjs]
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromeStarten, sleep, FESTER_ZUFALL } from './cdp.mjs';

const b = await chromeStarten();
await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source: FESTER_ZUFALL });

const szenario = process.argv[4] ? (await import(pathToFileURL(resolve(process.argv[4])))).default : null;

async function lauf(ordner) {
  b.fehler.length = 0; b.netz.length = 0;
  await b.laden(pathToFileURL(join(ordner, 'index.html')).href);
  // Fortschritt vorbelegen wie ein Kind, das schon geübt hat.
  await b.neuLaden(`(() => { localStorage.clear(); const f = {};
    for (const iso of ['VD','FR','NE','BE','JU','BS','BL','VS','TI','GR','AI','AR','SG','TG','SH','ZH','AG','LU','ZG','UR','GE','OW','SO','GL','SZ','NW'])
      f['kantone|2|' + iso] = { serie: 3, versuche: 4, treffer: 3 };
    f['kantone|1|BE'] = { serie: 1, versuche: 2, treffer: 1 };
    f['seen|3|Zürichsee'] = { serie: 2, versuche: 2, treffer: 2 };
    localStorage.setItem('geomaster.fortschritt.v1', JSON.stringify(f));
    location.reload(); })()`);
  await sleep(150);
  const res = {};
  res.rahmen = await b.js(`({ title: document.title, sub: document.querySelector('.wortmarke-sub').textContent,
    aria: document.querySelector('#karte').getAttribute('aria-label') })`);
  res.home = await b.js(`document.querySelector('#themenliste').outerHTML`);
  res.karte = await b.js(`document.querySelector('#karte').outerHTML`);
  if (szenario) res.szenario = await szenario(b.js, sleep);
  res.speicher = await b.js(`Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))`);
  res.fehler = [...b.fehler];
  res.nichtFile = b.netz.filter(u => !u.startsWith('file:') && !u.startsWith('data:'));
  return res;
}

try {
  const a = await lauf(process.argv[2]);
  const c = await lauf(process.argv[3]);
  writeFileSync(join(tmpdir(), 'gm-vergleich.json'), JSON.stringify({ a, b: c }, null, 1));
  let gleich = true;
  for (const k of Object.keys(a)) {
    const sa = JSON.stringify(a[k]), sb = JSON.stringify(c[k]);
    if (sa !== sb) {
      gleich = false;
      let i = 0; while (sa[i] === sb[i]) i++;
      console.log(`UNGLEICH ${k} @${i}:\n  A …${sa.slice(Math.max(0, i - 80), i + 120)}\n  B …${sb.slice(Math.max(0, i - 80), i + 120)}`);
    } else console.log(`gleich   ${k} (${sa.length} Zeichen)`);
  }
  console.log('Fehler A:', a.fehler, ' Fehler B:', c.fehler, ' Netz B:', c.nichtFile);
  console.log(gleich ? 'ERGEBNIS: identisch' : 'ERGEBNIS: Unterschiede');
  process.exitCode = gleich ? 0 : 1;
} finally {
  b.ende();
}
