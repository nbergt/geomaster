// Prüft den Duell-Modus im Browser (Issue #9, Abnahmekriterien 1–7).
// Mehrere «Geräte» werden nachgestellt, indem der Speicher geleert und der
// Duell-Link neu geöffnet wird. Ohne festen Zufall: gleiche Fragen und
// Antworten dürfen nur aus dem Duell-Link kommen, nicht aus Math.random.
// Aufruf: node tools/browser/duell.mjs [ordner]
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromeStarten, sleep } from './cdp.mjs';

const ORDNER = resolve(process.argv[2] || join(fileURLToPath(import.meta.url), '..', '..', '..'));
const SEITE = pathToFileURL(join(ORDNER, 'index.html')).href;

const b = await chromeStarten({ port: 9334 });
await b.cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true;' });

let fehlschlaege = 0;
function pruefe(name, ok, info = '') {
  if (!ok) fehlschlaege++;
  console.log(`${ok ? 'ok  ' : 'FEHL'} ${name}${info ? '  — ' + info : ''}`);
}

// ── Hilfen in der Seite ──────────────────────────────────────────────────
const q = s => JSON.stringify(s);
const da = sel => b.js(`!!document.querySelector(${q(sel)}) && !document.querySelector(${q(sel)}).closest('[hidden]')`);
const text = sel => b.js(`document.querySelector(${q(sel)})?.textContent ?? null`);
const wert = sel => b.js(`document.querySelector(${q(sel)})?.value ?? null`);
const klicke = sel => b.js(`document.querySelector(${q(sel)}).click()`);
const setze = (sel, v) => b.js(`(() => { const e = document.querySelector(${q(sel)}); e.value = ${q(v)};
  e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
const speicher = () => b.js(`Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))`);
// Lernstand: Fortschritt, Stoff und Filter beider Sets (die Kartenwahl
// geomaster.set.v1 darf das Duell wie die Startseite umschalten).
const lernSpeicher = async () => Object.fromEntries(Object.entries(await speicher())
  .filter(([k]) => /fortschritt|stoff|filter/.test(k)));
const hashVon = link => link.slice(link.indexOf('#'));
// Link öffnen wie aus WhatsApp: neue Seite (nicht nur das # wechseln).
async function oeffne(hash) {
  await b.laden('about:blank');
  await b.laden(SEITE + hash);
  await sleep(100);
}

// Neues «Gerät»: Speicher leeren, Seite (optional mit Link-Hash) frisch laden.
async function geraet(hash = '', vorher = null) {
  await b.laden(SEITE);
  await b.js(`localStorage.clear(); ${vorher ? `for (const [k, v] of Object.entries(${JSON.stringify(vorher)})) localStorage.setItem(k, v);` : ''}`);
  await b.laden('about:blank');
  await b.laden(SEITE + hash);
  await sleep(100);
}

// Eine Duell-Runde spielen. antworten(i) liefert 'erste' (erste Auswahl),
// 'warten' (Zeit ablaufen lassen). Protokolliert Frage und Auswahl.
async function spielen(antworten) {
  const protokoll = [];
  for (let i = 0; i < 20; i++) {
    if (!(await da('#quiz'))) break;
    const zug = await b.js(`({ frage: document.querySelector('#frage').textContent,
      wahl: [...document.querySelectorAll('#antwortfeld .wahl')].map(w => w.textContent),
      uhr: document.querySelector('#duell-uhr')?.textContent ?? null })`);
    protokoll.push(zug);
    if (antworten(i) === 'warten') {
      await sleep(10600);
    } else {
      await b.js(`document.querySelector('#antwortfeld .wahl').click()`);
    }
    zug.rueck = await text('#rueck-text');
    zug.rueckSichtbar = await da('#rueckmeldung');
    await klicke('#weiter');
    await sleep(30);
  }
  return protokoll;
}

try {
  await b.cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  // ── Gerät A: Anna erstellt ein Duell (Europa, Hauptstädte, Stufe 2) ──
  // Lernfortschritt vorbelegen, um später zu prüfen, dass er unberührt bleibt.
  const lernstand = {
    'geomaster.fortschritt.v1': JSON.stringify({ 'kantone|2|BE': { serie: 1, versuche: 1, treffer: 1 } }),
    'geomaster.eu.fortschritt.v1': JSON.stringify({ 'hauptstaedte|2|FR': { serie: 2, versuche: 2, treffer: 2 } }),
  };
  await geraet('', lernstand);
  const lernVorher = await lernSpeicher();

  pruefe('Knopf «Duell» auf der Startseite', await da('#duell-oeffnen'));
  pruefe('Knopf «Duell» liegt nicht in der Themenliste', await b.js(`!document.querySelector('#themenliste #duell-oeffnen')`));
  await klicke('#duell-oeffnen');
  pruefe('Duell-Schirm sichtbar', await da('#duell'));
  pruefe('Nickname wird abgefragt', await da('#duell-nick'));
  await setze('#duell-nick', 'Anna');
  await klicke('#duell-nick-speichern');
  pruefe('Nickname gespeichert', JSON.parse((await speicher())['geomaster.duell.v1'] || '{}').nick === 'Anna');

  await setze('#duell-set', 'eu');
  await setze('#duell-thema', 'hauptstaedte');
  await setze('#duell-stufe', '2');
  await klicke('#duell-erstellen');
  const link = await wert('#duell-link');
  pruefe('Duell-Link erzeugt', typeof link === 'string' && link.includes('#duell='), String(link).slice(0, 80));
  pruefe('Link zeigt bei file:// auf die öffentliche Adresse', String(link).startsWith('https://nbergt.github.io/geomaster/'));

  await klicke('#duell-spielen');
  pruefe('Quiz startet', await da('#quiz'));
  pruefe('Countdown 10 s sichtbar', (await text('#duell-uhr'))?.trim().startsWith('10'), await text('#duell-uhr'));
  const annaZuege = await spielen(() => 'erste');
  pruefe('10 Fragen gespielt', annaZuege.length === 10, String(annaZuege.length));
  pruefe('Nach dem Spiel: Rangliste', await da('#duell-rangliste'));
  const annaErgebnis = await wert('#duell-ergebnis-link');
  pruefe('Ergebnis-Link erzeugt', String(annaErgebnis).includes('#ergebnis='));
  pruefe('Rangliste zeigt Anna', (await text('#duell-rangliste'))?.includes('Anna'));
  { const nachher = await lernSpeicher();
    pruefe('Lernfortschritt unverändert (Gerät A)', JSON.stringify(nachher) === JSON.stringify(lernVorher), JSON.stringify(nachher).slice(0, 300)); }
  pruefe('Verlauf enthält das Duell', await b.js(`(document.querySelector('#nach-hause').click(),
    document.querySelector('#duell-oeffnen').click(), document.querySelectorAll('#duell-verlauf li').length === 1)`));

  // ── Gerät B: Ben öffnet den Link ──────────────────────────────────────
  await geraet(hashVon(link));
  pruefe('Einladung nennt Anna', (await text('#duell'))?.includes('Anna'));
  pruefe('Einladung fragt nach Nickname', await da('#duell-nick'));
  await setze('#duell-nick', 'Ben');
  await klicke('#duell-start');
  // Erste Frage: Zeit ablaufen lassen.
  const benZuege = await spielen(i => (i === 0 ? 'warten' : 'erste'));
  const gleich = annaZuege.length === benZuege.length &&
    annaZuege.every((z, i) => z.frage === benZuege[i].frage && JSON.stringify(z.wahl) === JSON.stringify(benZuege[i].wahl));
  pruefe('K1: gleiche Fragen und Antwortmöglichkeiten auf beiden Geräten', gleich,
    gleich ? '' : JSON.stringify([annaZuege[0], benZuege[0]]));
  pruefe('K2: Zeitablauf beantwortet die Frage', benZuege[0].rueckSichtbar, String(benZuege[0].rueck));
  pruefe('K2: Zeitablauf zählt als falsch', String(benZuege[0].rueck).startsWith('✗'), String(benZuege[0].rueck));
  const benEigen = await b.js(`(() => { const d = Object.values(JSON.parse(localStorage.getItem('geomaster.duell.v1')).duelle)[0];
    return d.ergebnisse.find(e => e.n === 'Ben'); })()`);
  pruefe('K2: abgelaufene Frage zählt 10 s', benEigen && benEigen.z >= 100 && benEigen.z < 130, JSON.stringify(benEigen));
  const benErgebnis = await wert('#duell-ergebnis-link');

  // Annas Ergebnis-Link bei Ben öffnen, zweimal.
  await oeffne(hashVon(annaErgebnis));
  await oeffne(hashVon(annaErgebnis));
  const namen = await b.js(`[...document.querySelectorAll('#duell-rangliste li .duell-name')].map(n => n.textContent)`);
  pruefe('K3: Ergebnis-Link landet in der Rangliste', namen.includes('Anna') && namen.includes('Ben'), JSON.stringify(namen));
  pruefe('K3: doppelt geöffnet, kein doppelter Eintrag', namen.filter(n => n === 'Anna').length === 1, JSON.stringify(namen));

  // Erneutes Öffnen des Duell-Links: kein zweites Spiel, sondern Rangliste.
  await oeffne(hashVon(link));
  pruefe('Duell nur einmal spielbar: Link zeigt Rangliste', await da('#duell-rangliste') && !(await da('#duell-start')));

  // ── K4/K5: weitere Spieler mit Punktgleichheit ───────────────────────
  const bau = (n, r, z) => b.js(`(() => { const e = duellLesen(${q(hashVon(annaErgebnis))}).ergebnis;
    return duellLinkBauen('ergebnis', { ...e, n: ${q(n)}, r: ${r}, z: ${z} }); })()`);
  const dora = await bau('Dora', 9, 300), emil = await bau('Emil', 9, 200), fritz = await bau('<img src=x onerror="window.boese=1">', 1, 50);
  for (const l of [dora, emil, fritz]) await oeffne(hashVon(l));
  const rang = await b.js(`[...document.querySelectorAll('#duell-rangliste li')].map(li => li.querySelector('.duell-name').textContent)`);
  pruefe('K5: 5 Spieler in der Rangliste', rang.length === 5, JSON.stringify(rang));
  pruefe('K4: Punktgleichheit, kürzere Zeit gewinnt', rang.indexOf('Emil') === 0 && rang.indexOf('Dora') === 1, JSON.stringify(rang));
  pruefe('Sieger mit Pokal', (await b.js(`document.querySelector('#duell-rangliste li').textContent`)).includes('🏆'));
  pruefe('Fremder Nickname wird nicht als HTML eingefügt',
    await b.js(`!document.querySelector('#duell-rangliste img') && !window.boese`));

  // ── K6: Duell mit unbekannten Einträgen ───────────────────────────────
  const kaputt = await b.js(`(() => { const d = duellLesen(${q(hashVon(link))}).duell;
    return duellLinkBauen('duell', { ...d, i: 'kaputt01', k: ['XX', 'YY'] }); })()`);
  await oeffne(hashVon(kaputt));
  pruefe('K6: verständliche Meldung bei fehlenden Einträgen', (await text('#duell-meldung'))?.includes('passt nicht'), await text('#duell-meldung'));
  pruefe('K6: kein Start möglich', !(await da('#duell-start')));
  await oeffne('#duell=%%%kein-base64');
  pruefe('K6: kaputter Link ergibt Meldung', (await text('#duell-meldung'))?.length > 0, await text('#duell-meldung'));

  // ── Tippaufgabe: 20 s ────────────────────────────────────────────────
  await geraet();
  await klicke('#duell-oeffnen');
  await setze('#duell-nick', 'Cleo');
  await klicke('#duell-nick-speichern');
  await setze('#duell-set', 'ch');
  await setze('#duell-thema', 'hauptorte');
  await setze('#duell-stufe', '3');
  await klicke('#duell-erstellen');
  await klicke('#duell-spielen');
  pruefe('Tippaufgabe: Countdown 20 s', (await text('#duell-uhr'))?.trim().startsWith('20'), await text('#duell-uhr'));
  await b.js(`document.querySelector('#nach-hause').click()`);
  pruefe('Abbruch: Uhr stoppt, Startseite', await da('#home'));

  // ── K7 auf Gerät B und Netzwerk ──────────────────────────────────────
  pruefe('K7: kein Lernfortschritt geschrieben (Gerät C)',
    !Object.keys(await speicher()).some(k => k.includes('fortschritt')));
  pruefe('Keine Laufzeitfehler', b.fehler.length === 0, b.fehler.join(' | '));
  const fremd = b.netz.filter(u => !u.startsWith('file:') && !u.startsWith('data:') && u !== 'about:blank');
  pruefe('Nur file:// und data: geladen', fremd.length === 0, fremd.join(', '));
  void benErgebnis;
} catch (e) {
  fehlschlaege++;
  console.log('FEHL Abbruch: ' + e.message);
} finally {
  b.ende();
}

console.log(fehlschlaege ? `\n${fehlschlaege} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exitCode = fehlschlaege ? 1 : 0;
