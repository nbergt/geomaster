/* GeoMaster — Duell-Modus (Issue #9).
   Zeitversetzt und ohne eigenen Server: Ein Duell steckt vollständig im Link
   (#duell=…), ebenso ein Ergebnis (#ergebnis=…). Beim Öffnen geht der Teil
   hinter dem # nicht an den Server von GitHub Pages. Wer über WhatsApp teilt,
   gibt den Link (mit Nicknames und Ergebnis) aber an WhatsApp weiter.
   Alle spielen dieselben Fragen mit denselben Antwortmöglichkeiten aus dem
   eingebauten Stoff des Sets; Rangliste und Verlauf liegen nur im Browser
   (geomaster.duell.v1). Duelle zählen nicht zum Lernfortschritt.
   Erwartet app.js (lauf, SET, SETS, setAktivieren, frageZeigen …). */

'use strict';

const DUELL_SPEICHER = 'geomaster.duell.v1';
const DUELL_FRAGEN = 10;
const DUELL_SEKUNDEN = 10;
const DUELL_SEKUNDEN_TIPPEN = 20;
const DUELL_ADRESSE = 'https://nbergt.github.io/geomaster/';
const DUELL_MAX_GESPEICHERT = 100;   // ältere Duelle fallen aus dem Verlauf
const DUELL_MAX_ERGEBNISSE = 200;    // pro Duell
const DUELL_MAX_GESPIELT = 2000;     // Merkliste «schon gespielt»
const NICK_MAX = 16;
const TAG_MS = 864e5;
const DUELL_FRUEHESTENS = Date.UTC(2026, 0, 1);

/* ══ Speicher ════════════════════════════════════════════════════════════
   { nick, duelle: { <id>: { d, ergebnisse: [{ n, r, z, eigen? }], zuletzt } },
     gespielt: ['<id>|<Nickname-Schlüssel>'] }
   duelle hat keinen Prototyp: eine Duell-ID wie «constructor» bleibt ein
   gewöhnlicher Schlüssel. */

function duellSpeicherLaden() {
  let roh = null;
  try { roh = JSON.parse(localStorage.getItem(DUELL_SPEICHER) || 'null'); } catch { /* kaputt: leer */ }
  const duelle = Object.create(null);
  if (roh && typeof roh.duelle === 'object' && roh.duelle) {
    for (const eintrag of Object.values(roh.duelle)) {
      const d = duellPruefen(eintrag?.d);
      if (!d) continue;
      const ergebnisse = (Array.isArray(eintrag.ergebnisse) ? eintrag.ergebnisse : [])
        .map(e => {
          const gut = ergebnisPruefen(e, d);
          return gut && (e.eigen === true ? { ...gut, eigen: true } : gut);
        }).filter(Boolean).slice(0, DUELL_MAX_ERGEBNISSE);
      duelle[d.i] = { d, ergebnisse, zuletzt: Number(eintrag.zuletzt) || d.d };
    }
  }
  const gespielt = Array.isArray(roh?.gespielt)
    ? roh.gespielt.filter(g => typeof g === 'string' && g.length <= 120).slice(-DUELL_MAX_GESPIELT) : [];
  return { nick: nickBereinigen(roh?.nick), duelle, gespielt };
}

function duellSpeichern() {
  const ids = Object.keys(DUELL.duelle).sort((a, b) => DUELL.duelle[b].zuletzt - DUELL.duelle[a].zuletzt);
  for (const id of ids.slice(DUELL_MAX_GESPEICHERT)) delete DUELL.duelle[id];
  DUELL.gespielt = DUELL.gespielt.slice(-DUELL_MAX_GESPIELT);
  try { localStorage.setItem(DUELL_SPEICHER, JSON.stringify(DUELL)); }
  catch { /* Speicher voll oder gesperrt: gilt nur für diese Sitzung */ }
}

// Ohne Object.hasOwn und .at(): läuft auch auf älteren iPads (Safari < 15.4).
const hatEigen = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const duellEintrag = id => (hatEigen(DUELL.duelle, id) ? DUELL.duelle[id] : null);

// Ein zweiter Tab kann inzwischen gespeichert haben: vor jeder Änderung den
// Stand neu lesen, damit nichts überschrieben oder doppelt gespielt wird.
function duellNeuLesen() {
  const frisch = duellSpeicherLaden();
  DUELL.nick = frisch.nick;
  DUELL.duelle = frisch.duelle;
  DUELL.gespielt = frisch.gespielt;
}

/* ══ Prüfen fremder Daten ════════════════════════════════════════════════
   Alles aus einem Link ist fremd: Typen, Längen und Wertebereiche werden
   geprüft, Texte gelangen nur über textContent in die Seite. */

// Füllzeichen, die wie ein Leerzeichen aussehen, aber keins sind.
const NICK_FUELLER = new Set([0x034f, 0x115f, 0x1160, 0x180e, 0x2800, 0x3164, 0xffa0].map(c => String.fromCharCode(c)));
const ZWJ = String.fromCharCode(0x200d);   // hält zusammengesetzte Emojis zusammen

// Steuer-, Format- und Füllzeichen weg (auch Schreibrichtungs-Umschalter),
// Leerraum zusammenfassen. Ein Buchstabe, eine Ziffer oder ein Emoji muss bleiben.
function nickBereinigen(s, kuerzen = true) {
  if (typeof s !== 'string') return '';
  const sauber = s.normalize('NFKC')
    .replace(/[\p{Cc}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\p{Cf}/gu, c => (c === ZWJ ? c : ''))
    .replace(/./gu, c => (NICK_FUELLER.has(c) ? '' : c))
    .replace(/\s+/gu, ' ').trim()
    .replace(/^\p{M}+/u, '')
    .replace(/(\p{M}{2})\p{M}+/gu, '$1');          // höchstens zwei Zeichen übereinander
  if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(sauber)) return '';
  return kuerzen ? zeichenListe(sauber).slice(0, NICK_MAX).join('').trim() : sauber;
}

// Sichtbare Zeichen (Grapheme): ein Familien-Emoji zählt als eins und wird
// beim Kürzen nicht zerschnitten. Ohne Intl.Segmenter: Codepunkte.
const zeichenListe = s => (typeof Intl !== 'undefined' && Intl.Segmenter
  ? [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(s)].map(x => x.segment)
  : Array.from(s));

// Vergleichsschlüssel: «Anna» und «anna» sind derselbe Spieler.
const nickSchluessel = n => n.normalize('NFKC').toLocaleLowerCase('de-CH');

const duellGanz = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;

function duellPruefen(d) {
  if (!d || typeof d !== 'object') return null;
  const { v, i, s, t, l, k, z, n } = d;
  if (v !== 1 || typeof i !== 'string' || !/^[a-z0-9]{6,20}$/.test(i)) return null;
  if (typeof s !== 'string' || !hatEigen(SETS, s)) return null;
  if (typeof t !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(t)) return null;
  if (!duellGanz(l, 1, 4) || !duellGanz(z, 0, 0xffffffff)) return null;
  if (!Array.isArray(k) || k.length < 1 || k.length > DUELL_FRAGEN) return null;
  if (!k.every(x => typeof x === 'string' && x.length >= 1 && x.length <= 80)) return null;
  if (new Set(k).size !== k.length) return null;
  const nick = nickBereinigen(n);
  if (!nick) return null;
  // Datum nur als Tag; ausserhalb von 2026 bis morgen: unbekannt.
  const datum = Number.isFinite(d.d) && d.d >= DUELL_FRUEHESTENS && d.d <= Date.now() + TAG_MS
    ? new Date(d.d).setHours(0, 0, 0, 0) : 0;
  return { v: 1, i, s, t, l, k: [...k], z, n: nick, d: datum };
}

// Höchstzeit in Zehntelsekunden: jede Frage höchstens mit der Tippzeit.
const duellHoechstzeit = d => d.k.length * DUELL_SEKUNDEN_TIPPEN * 10;

// Sekunden pro Frage in diesem Duell: Tippaufgaben sind «nennen» auf Stufe 3
// und «karte» auf Stufe 4 (wie in frageZeigen, app.js).
function duellSekunden(d) {
  const modus = duellThemen(d.s).find(t => t.id === d.t)?.modus;
  const tippen = (modus === 'nennen' && d.l === 3) || (modus === 'karte' && d.l === 4);
  return tippen ? DUELL_SEKUNDEN_TIPPEN : DUELL_SEKUNDEN;
}

function ergebnisPruefen(e, d) {
  if (!e || typeof e !== 'object') return null;
  const n = nickBereinigen(e.n);
  if (!n || !duellGanz(e.r, 0, d.k.length) || !duellGanz(e.z, 0, duellHoechstzeit(d))) return null;
  return { n, r: e.r, z: e.z };
}

// Dasselbe Duell? (gleiche ID, aber auch gleiche Fragen)
const duellGleich = (a, b) => a.s === b.s && a.t === b.t && a.l === b.l && a.z === b.z &&
  a.k.length === b.k.length && a.k.every((k, i) => k === b.k[i]);

/* ══ Links ═══════════════════════════════════════════════════════════════ */

function b64Kodieren(text) {
  let bin = '';
  for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64Dekodieren(s) {
  if (!/^[A-Za-z0-9_-]{1,6000}$/.test(s)) throw new Error('Zeichen');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

// Über https (GitHub Pages, auch PR-Testversionen) die eigene Adresse,
// per Doppelklick (file://) die öffentliche.
function duellAdresse() {
  return location.protocol === 'https:' ? location.origin + location.pathname : DUELL_ADRESSE;
}

function duellLinkBauen(art, daten) {
  return `${duellAdresse()}#${art}=${b64Kodieren(JSON.stringify(daten))}`;
}

const DUELL_KAPUTT = 'Dieser Duell-Link ist unvollständig oder beschädigt. Lass ihn dir nochmal schicken.';

// Liest «#duell=…» oder «#ergebnis=…». Ergebnis: { duell, ergebnis? } oder { fehler }.
function duellLesen(hash) {
  const m = /^#(duell|ergebnis)=(.*)$/s.exec(hash || '');
  if (!m) return null;
  const kaputt = { fehler: DUELL_KAPUTT };
  let daten;
  try { daten = JSON.parse(b64Dekodieren(m[2])); } catch { return kaputt; }
  if (m[1] === 'duell') {
    const duell = duellPruefen(daten);
    return duell ? { duell } : kaputt;
  }
  const duell = duellPruefen(daten?.d);
  const e = duell && ergebnisPruefen(daten, duell);
  return e ? { duell, ergebnis: { d: duell, ...e } } : kaputt;
}

/* ══ Stoff eines Duells ══════════════════════════════════════════════════
   Immer der eingebaute Stoff: Ein selbst bearbeiteter Stoff oder ein Filter
   auf dem Gerät des Empfängers ändert weder Fragen noch Antworten. */

const duellThemenCache = Object.create(null);
function duellThemen(setId) {
  if (!duellThemenCache[setId]) duellThemenCache[setId] = SETS[setId].themen(SETS[setId].stoff);
  return duellThemenCache[setId];
}

// { thema, fragen } oder { fehler }. Unbekannte Schlüssel werden nur gezählt,
// nicht angezeigt: sie stammen aus einem fremden Link.
function duellStoff(d) {
  const thema = duellThemen(d.s).find(t => t.id === d.t);
  const fehler = 'Dieses Duell passt nicht zu deiner GeoMaster-Version' +
    ' — lade die App neu und öffne den Link nochmal.';
  if (!thema) return { fehler };
  const fragen = d.k.map(k => thema.items.find(it => it.key === k));
  const fehlt = fragen.filter(f => !f).length;
  if (fehlt) return { fehler: `${fehler} (${fehlt} ${fehlt === 1 ? 'Frage fehlt' : 'Fragen fehlen'}.)` };
  return { thema, fragen };
}

/* ══ Zufall mit Startwert ════════════════════════════════════════════════ */

// mulberry32; je Frage ein eigener Strom, damit jede Frage für sich gleich ist.
function duellZufall(startwert, nr) {
  let a = (startwert ^ Math.imul(nr + 1, 0x9e3779b1)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function duellZufallsId() {
  const z = crypto.getRandomValues(new Uint32Array(2));
  return (z[0].toString(36) + z[1].toString(36)).padEnd(8, '0').slice(0, 12);
}

/* ══ Ergebnisse und Rangliste ════════════════════════════════════════════ */

// Legt ein Duell an, falls unbekannt. Fremde Ergebnisse: eins pro Nickname,
// das erste bleibt. Das eigene Ergebnis ersetzt immer den Eintrag mit
// gleichem Nickname (es wurde auf diesem Gerät gespielt).
function duellMerken(d, ergebnis, eigen) {
  duellNeuLesen();
  let eintrag = duellEintrag(d.i);
  if (!eintrag) eintrag = DUELL.duelle[d.i] = { d, ergebnisse: [], zuletzt: Date.now() };
  eintrag.zuletzt = Date.now();
  if (ergebnis) {
    const schluessel = nickSchluessel(ergebnis.n);
    const i = eintrag.ergebnisse.findIndex(e => nickSchluessel(e.n) === schluessel);
    const neu = { n: ergebnis.n, r: ergebnis.r, z: ergebnis.z, ...(eigen ? { eigen: true } : {}) };
    if (eigen && i >= 0) eintrag.ergebnisse[i] = neu;
    else if (i < 0 && eintrag.ergebnisse.length < DUELL_MAX_ERGEBNISSE) eintrag.ergebnisse.push(neu);
  }
  duellSpeichern();
  return eintrag;
}

const gespieltMarke = (d, nick) => `${d.i}|${nickSchluessel(nick)}`;

// Pro Gerät und Nickname nur einmal (auch nach Abbruch oder Löschen im Verlauf).
function duellGespielt(d, nick) {
  if (!nick) return false;
  return DUELL.gespielt.includes(gespieltMarke(d, nick)) ||
    !!duellEintrag(d.i)?.ergebnisse.some(e => e.eigen && nickSchluessel(e.n) === nickSchluessel(nick));
}

// Meiste Treffer, dann kürzeste Zeit; Gleichstand teilt den Rang.
function duellRangliste(eintrag) {
  const liste = [...eintrag.ergebnisse].sort((a, b) => b.r - a.r || a.z - b.z || a.n.localeCompare(b.n, 'de'));
  let rang = 0;
  return liste.map((e, i) => {
    if (i === 0 || e.r !== liste[i - 1].r || e.z !== liste[i - 1].z) rang = i + 1;
    return { ...e, rang };
  });
}

// Das eigene Ergebnis: zum aktuellen Nickname, sonst das letzte auf diesem Gerät.
function eigenesErgebnis(eintrag) {
  const eigene = eintrag.ergebnisse.filter(e => e.eigen);
  return eigene.find(e => DUELL.nick && nickSchluessel(e.n) === nickSchluessel(DUELL.nick)) ?? eigene[eigene.length - 1];
}

const duellZeitText = z => `${(z / 10).toFixed(1).replace('.', ',')} s`;

function duellBeschreibung(d) {
  const thema = duellThemen(d.s).find(t => t.id === d.t);
  return `${SETS[d.s].titel} · ${thema?.titel ?? d.t} · Stufe ${d.l}`;
}

/* ══ Spielen ═════════════════════════════════════════════════════════════ */

let duellVorherSet = null;            // Set vor dem Duell, wird beim Verlassen wieder aktiv
let duellUhr = null;                  // { start, limit, abgelaufen, takt, ende }

function duellSpielen(d, nick) {
  const stoff = duellStoff(d);
  if (stoff.fehler) return duellMeldung(stoff.fehler);
  // Schon beim Start als gespielt merken, mit 0 richtig und voller Zeit:
  // Wer abbricht, kann nicht mit bekannten Fragen nochmal anfangen.
  duellNeuLesen();
  DUELL.gespielt.push(gespieltMarke(d, nick));
  duellMerken(d, { n: nick, r: 0, z: d.k.length * duellSekunden(d) * 10 }, true);
  if (SET.id !== d.s) {
    if (!duellVorherSet) duellVorherSet = SET;
    setAktivieren(SETS[d.s]);
  }
  // Fragen des eingebauten Stoffs (auch für Karte und Bewertung).
  const { thema, fragen } = stoff;
  lauf = { thema, stufe: d.l, fragen, idx: 0, protokoll: [], offen: true, duell: d, nick, zeiten: [] };
  schirmZeigen('quiz');
  frageZeigen();
}

function uhrAnhalten() {
  if (!duellUhr) return;
  clearInterval(duellUhr.takt);
  clearTimeout(duellUhr.ende);
}

// Aufgerufen von frageZeigen() (app.js).
function duellUhrStarten(tippen) {
  uhrAnhalten();
  const limit = tippen ? DUELL_SEKUNDEN_TIPPEN : DUELL_SEKUNDEN;
  const anzeige = $('#duell-uhr');
  duellUhr = { start: performance.now(), limit, abgelaufen: false };
  const zeichnen = () => {
    const rest = Math.max(0, limit - (performance.now() - duellUhr.start) / 1000);
    anzeige.textContent = `${Math.ceil(rest)} s`;
    anzeige.style.setProperty('--rest', (rest / limit).toFixed(3));
    anzeige.classList.toggle('knapp', rest <= 3);
  };
  anzeige.hidden = false;
  anzeige.classList.remove('vorbei');
  zeichnen();
  duellUhr.takt = setInterval(zeichnen, 100);
  duellUhr.ende = setTimeout(duellZeitAbgelaufen, limit * 1000);
}

// Zeit um: wie eine falsche Antwort, mit voller Zeit.
function duellZeitAbgelaufen() {
  if (!lauf?.duell || !lauf.offen || !duellUhr) return;
  duellUhr.abgelaufen = true;
  const item = lauf.fragen[lauf.idx];
  for (const b of document.querySelectorAll('#antwortfeld .wahl')) {
    b.disabled = true;
    if (b.textContent === item.name) b.classList.add('richtig');
  }
  for (const e of document.querySelectorAll('#antwortfeld input, #antwortfeld .knopf')) e.disabled = true;
  if (!document.querySelector('#antwortfeld .wahl, #antwortfeld input')) aufloesungZeichnen(null, item, false);
  antwortVerbuchen(false, `Zeit abgelaufen — richtig ist ${item.name}.`, item, 'Zeit abgelaufen');
  // Wer gerade tippt, soll mit Enter nicht gleich die nächste Frage auslösen.
  const weiter = $('#weiter');
  weiter.disabled = true;
  setTimeout(() => {
    weiter.disabled = false;
    const a = document.activeElement;
    if (!a || a === document.body || a === weiter) weiter.focus();
  }, 800);
}

// Ist die Zeit schon um, obwohl der Ablauf noch nicht gemeldet wurde
// (Handy ruckelt, App war im Hintergrund)? Für die Antwort-Wege in app.js.
const duellZuSpaet = () => !!duellUhr && !duellUhr.abgelaufen &&
  performance.now() - duellUhr.start >= duellUhr.limit * 1000;

// Aufgerufen von antwortVerbuchen() (app.js): Zeit der Frage festhalten.
// Liefert true, wenn die Antwort erst nach Ablauf kam (Handy ruckelt, App
// war im Hintergrund): dann zählt sie als abgelaufen.
function duellAntwort() {
  if (!duellUhr) return false;
  uhrAnhalten();
  const limitMs = duellUhr.limit * 1000;
  const zuSpaet = !duellUhr.abgelaufen && performance.now() - duellUhr.start >= limitMs;
  const ms = duellUhr.abgelaufen || zuSpaet ? limitMs : performance.now() - duellUhr.start;
  lauf.zeiten.push(ms);
  const anzeige = $('#duell-uhr');
  anzeige.textContent = `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
  anzeige.classList.remove('knapp');
  anzeige.classList.add('vorbei');
  duellUhr = null;
  return zuSpaet;
}

// Aufgerufen nach der letzten Frage (app.js).
function duellFertig() {
  const { duell: d, nick } = lauf;
  const r = lauf.protokoll.filter(p => p.richtig).length;
  const z = Math.min(Math.round(lauf.zeiten.reduce((s, ms) => s + ms, 0) / 100), duellHoechstzeit(d));
  const eintrag = duellMerken(d, { n: nick, r, z }, true);
  lauf = null;
  duellVerlassen();
  duellRanglisteZeigen(eintrag);
}

// Aufgerufen von homeZeigen() (app.js) und nach einem Duell: Uhr weg,
// vorheriges Set zurück.
function duellVerlassen() {
  uhrAnhalten();
  duellUhr = null;
  $('#duell-uhr').hidden = true;
  if (duellVorherSet) {
    const s = duellVorherSet;
    duellVorherSet = null;
    if (s !== SET) setAktivieren(s);
  }
}

/* ══ Oberfläche ══════════════════════════════════════════════════════════ */

function duellSchirm(...teile) {
  if (lauf) duellVerlassen();
  lauf = null;
  schirmZeigen('duell');
  railSetzen('<b>Duell</b>', '');
  $('#duell-inhalt').replaceChildren(...teile);
  $('#duell').scrollTop = 0;
  // Fokus auf die Überschrift, damit Tastatur und Screenreader oben anfangen.
  const h1 = $('#duell-inhalt h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

const duellBlock = (klasse, ...kinder) => {
  const b = el('section', { class: `duell-block ${klasse}` });
  b.append(...kinder);
  return b;
};

function duellKnopf(text, klasse, aktion, id) {
  const b = el('button', { class: klasse, type: 'button', id }, text);
  b.addEventListener('click', aktion);
  return b;
}

const zurStartseite = () => duellKnopf('Zur Startseite', 'knopf-schlicht', () => homeZeigen());

// Nickname-Feld; speichern() liefert den bereinigten Namen oder '' (mit Meldung).
// pruefen(nick) kann zusätzlich einen Fehlertext liefern (z. B. Name vergeben).
// merken=false: Name gilt nur für dieses Spiel (Mitspielen unter anderem Namen).
function nickFeld(pruefen, merken = true) {
  const wrap = el('div', { class: 'duell-nick' });
  const lab = el('label', { for: 'duell-nick' }, 'Dein Nickname');
  const input = el('input', {
    id: 'duell-nick', type: 'text', maxlength: String(NICK_MAX * 2), autocomplete: 'nickname',
    autocapitalize: 'words', spellcheck: 'false', placeholder: 'z. B. Kartenfuchs',
  });
  input.value = DUELL.nick;
  const hinweis = el('p', { class: 'duell-hinweis' },
    `Nur einen Spitznamen (höchstens ${NICK_MAX} Zeichen), nicht den echten vollen Namen.`);
  const meldung = el('p', { class: 'stoff-meldung', 'aria-live': 'polite' });
  wrap.append(lab, input, hinweis, meldung);
  const fehler = text => { meldung.textContent = text; input.focus(); return ''; };
  const speichern = () => {
    const voll = nickBereinigen(input.value, false);
    if (!voll) return fehler('Bitte einen Nickname mit mindestens einem Buchstaben eingeben.');
    if (Array.from(voll).length > NICK_MAX) return fehler(`Höchstens ${NICK_MAX} Zeichen, bitte kürzer.`);
    const problem = pruefen?.(voll);
    if (problem) return fehler(problem);
    input.value = voll;
    meldung.textContent = '';
    if (merken) {
      duellNeuLesen();
      DUELL.nick = voll;
      duellSpeichern();
    }
    return voll;
  };
  return { wrap, input, speichern };
}

// Teilen: Teilen-Menü des Geräts, sonst WhatsApp; dazu immer «Link kopieren».
function teilenBlock(link, text, linkId, wasLabel, knopfText) {
  const wrap = el('div', { class: 'duell-teilen' });
  const feld = el('input', { id: linkId, type: 'text', readonly: '', 'aria-label': wasLabel, value: link });
  feld.addEventListener('focus', () => feld.select());
  const knoepfe = el('div', { class: 'duell-knoepfe' });
  if (navigator.share) {
    knoepfe.append(duellKnopf(knopfText, 'knopf', () => {
      navigator.share({ title: 'GeoMaster-Duell', text, url: link }).catch(() => { /* abgebrochen */ });
    }));
  } else {
    const wa = el('a', {
      class: 'knopf duell-whatsapp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`,
      target: '_blank', rel: 'noopener noreferrer',
    }, `${knopfText} (WhatsApp)`);
    knoepfe.append(wa);
  }
  const kopiert = el('span', { class: 'duell-kopiert', 'aria-live': 'polite' });
  knoepfe.append(duellKnopf('Link kopieren', 'knopf-schlicht', async () => {
    try { await navigator.clipboard.writeText(link); kopiert.textContent = 'Kopiert.'; }
    catch { feld.focus(); feld.select(); kopiert.textContent = 'Markiert — jetzt kopieren.'; }
  }), kopiert);
  wrap.append(feld, knoepfe);
  return wrap;
}

function duellMeldung(text) {
  duellSchirm(duellBlock('duell-fehler',
    el('h1', {}, 'Duell'),
    el('p', { class: 'lauftext', id: 'duell-meldung', role: 'alert' }, text),
    duellKnopf('Zur Duell-Übersicht', 'knopf', () => duellUebersicht()),
  ), zurStartseite());
}

/* ── Übersicht: Nickname, neues Duell, Link einfügen, Verlauf ─────────── */

function duellUebersicht(neu) {
  const nick = nickFeld();
  const kopf = el('div', { class: 'duell-kopf' });
  kopf.append(
    el('h1', {}, 'Duell'),
    el('p', { class: 'lauftext' },
      'Alle spielen dieselben 10 Fragen, je 10 Sekunden (beim Eintippen 20). ' +
      'Wer mehr richtig hat, gewinnt; bei Gleichstand die schnellere Zeit.'),
  );
  const teile = [kopf,
    duellBlock('duell-ich', nick.wrap, duellKnopf('Speichern', 'knopf-schlicht', () => nick.speichern(), 'duell-nick-speichern'))];

  if (neu) {
    teile.push(duellBlock('duell-neu',
      el('h2', {}, 'Duell erstellt'),
      el('p', { class: 'lauftext' }, `${duellBeschreibung(neu)} · ${neu.k.length} Fragen. Schick den Link deinen Gegnern:`),
      teilenBlock(duellLinkBauen('duell', neu),
        `${neu.n} fordert dich zum GeoMaster-Duell heraus (${duellBeschreibung(neu)}):`,
        'duell-link', 'Einladungs-Link', 'Einladen'),
      duellGespielt(neu, DUELL.nick) ? el('span')
        : duellKnopf('Jetzt selber spielen', 'knopf', () => duellStartPruefen(neu, nick), 'duell-spielen'),
    ));
  } else {
    teile.push(erstellenBlock(nick));
  }
  teile.push(linkEinfuegenBlock(), verlaufBlock(), zurStartseite());
  duellSchirm(...teile);
}

// Vor dem Start: Nickname gültig, im Duell noch frei und noch nicht gespielt.
function duellStartPruefen(d, nick) {
  const name = nick.speichern();
  if (!name) return;
  duellNeuLesen();                    // ein anderer Tab hat vielleicht schon gespielt
  if (duellGespielt(d, name)) return duellRanglisteZeigen(duellMerken(d, null, false));
  duellSpielen(d, name);
}

// Für nickFeld(): Name im Duell schon von jemand anderem belegt?
const nickVergeben = d => name => {
  duellNeuLesen();
  const belegt = duellEintrag(d.i)?.ergebnisse.some(e => !e.eigen && nickSchluessel(e.n) === nickSchluessel(name));
  return belegt ? `«${name}» spielt in diesem Duell schon mit. Wähle einen anderen Nickname.` : '';
};

function erstellenBlock(nick) {
  const auswahl = (id, label) => {
    const lab = el('label', { class: 'duell-feld', for: id }, label);
    const sel = el('select', { id });
    lab.append(sel);
    return [lab, sel];
  };
  const [labSet, selSet] = auswahl('duell-set', 'Karte');
  const [labThema, selThema] = auswahl('duell-thema', 'Thema');
  const [labStufe, selStufe] = auswahl('duell-stufe', 'Stufe');
  for (const s of Object.values(SETS)) selSet.append(el('option', { value: s.id }, s.titel));
  selSet.value = SET.id;

  const stufenFuellen = () => {
    const thema = THEMEN.find(t => t.id === selThema.value);
    const alt = selStufe.value || '1';
    selStufe.replaceChildren();
    for (let s = 1; s <= 4; s++) {
      selStufe.append(el('option', { value: String(s) }, `${s} — ${thema ? STUFEN_TEXT[thema.modus][s - 1] : ''}`));
    }
    selStufe.value = alt;
  };
  const themenFuellen = () => {
    const alt = selThema.value;
    selThema.replaceChildren();
    for (const t of THEMEN) selThema.append(el('option', { value: t.id }, t.titel));
    if (THEMEN.some(t => t.id === alt)) selThema.value = alt;
    stufenFuellen();
  };
  // Die Karte umschalten wie auf der Startseite: dann gilt auch ihr Filter.
  selSet.addEventListener('change', () => {
    if (!hatEigen(SETS, selSet.value) || SETS[selSet.value] === SET) return;
    duellVorherSet = null;            // bewusst gewählt: bleibt auch auf der Startseite
    setAktivieren(SETS[selSet.value]);
    try { localStorage.setItem(SPEICHER_SET, SET.id); } catch { /* nur für diese Sitzung */ }
    themenFuellen();
  });
  selThema.addEventListener('change', stufenFuellen);
  themenFuellen();

  const meldung = el('p', { class: 'stoff-meldung', 'aria-live': 'polite' });
  const erstellen = () => {
    const name = nick.speichern();
    if (!name) return;
    const gefiltert = THEMEN.find(t => t.id === selThema.value);
    const eingebaut = duellThemen(SET.id).find(t => t.id === selThema.value);
    if (!gefiltert || !eingebaut) { meldung.textContent = 'Bitte ein Thema wählen.'; return; }
    // Nur Einträge, die es im eingebauten Stoff gibt (jeder Empfänger hat sie).
    const keys = mischen(gefiltert.items.map(it => it.key).filter(k => eingebaut.items.some(it => it.key === k)))
      .filter((k, i, a) => a.indexOf(k) === i).slice(0, DUELL_FRAGEN);
    if (!keys.length) { meldung.textContent = 'In diesem Thema gibt es keine Einträge für ein Duell.'; return; }
    const d = duellPruefen({
      v: 1, i: duellZufallsId(), s: SET.id, t: eingebaut.id, l: Number(selStufe.value),
      k: keys, z: crypto.getRandomValues(new Uint32Array(1))[0], n: name, d: Date.now(),
    });
    if (!d) { meldung.textContent = 'Das Duell liess sich nicht erstellen.'; return; }
    duellMerken(d, null, false);
    duellUebersicht(d);
  };

  return duellBlock('duell-erstellen-block',
    el('h2', {}, 'Neues Duell'),
    labSet, labThema, labStufe,
    duellKnopf('Duell erstellen', 'knopf', erstellen, 'duell-erstellen'),
    meldung,
  );
}

// Für die installierte App (iPhone): Links öffnen dort Safari, nicht die App.
function linkEinfuegenBlock() {
  const lab = el('label', { class: 'duell-feld', for: 'duell-link-einfuegen' }, 'Duell- oder Ergebnis-Link');
  const input = el('input', { id: 'duell-link-einfuegen', type: 'text', autocomplete: 'off', spellcheck: 'false',
    placeholder: 'https://…#duell=…' });
  lab.append(input);
  const meldung = el('p', { class: 'stoff-meldung', 'aria-live': 'polite' });
  const oeffnen = () => {
    // Auch die ganze WhatsApp-Nachricht darf drinstehen.
    const m = /#(duell|ergebnis)=[A-Za-z0-9_-]+/.exec(input.value);
    if (!m) { meldung.textContent = 'Das ist kein Duell- oder Ergebnis-Link.'; return; }
    duellLinkOeffnen(m[0]);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') oeffnen(); });
  return duellBlock('duell-einfuegen-block',
    el('h2', {}, 'Link bekommen?'),
    el('p', { class: 'duell-hinweis' }, 'In der installierten App hier einfügen und öffnen.'),
    lab, duellKnopf('Öffnen', 'knopf-schlicht', oeffnen, 'duell-link-oeffnen'), meldung);
}

function verlaufBlock() {
  const eintraege = Object.values(DUELL.duelle).sort((a, b) => (b.d.d || b.zuletzt) - (a.d.d || a.zuletzt) || b.zuletzt - a.zuletzt);
  const b = duellBlock('duell-verlauf-block', el('h2', {}, 'Verlauf'));
  if (!eintraege.length) {
    b.append(el('p', { class: 'lauftext' }, 'Noch keine Duelle auf diesem Gerät.'));
    return b;
  }
  const liste = el('ul', { class: 'duell-verlauf', id: 'duell-verlauf' });
  for (const e of eintraege) {
    const rang = duellRangliste(e);
    const sieger = rang.filter(x => x.rang === 1).map(x => x.n).join(', ');
    const eigen = eigenesErgebnis(e);
    const ich = eigen && rang.find(x => x.eigen && x.n === eigen.n);
    const li = el('li');
    const oeffnen = el('button', { class: 'duell-verlauf-eintrag', type: 'button' });
    oeffnen.append(
      el('span', { class: 'duell-verlauf-titel' }, duellBeschreibung(e.d)),
      el('span', { class: 'duell-verlauf-info' }, [
        e.d.d ? new Date(e.d.d).toLocaleDateString('de-CH') : '',
        `von ${e.d.n}`,
        `${e.ergebnisse.length} Spieler`,
        sieger ? `Sieger: ${sieger}` : 'noch kein Ergebnis',
        ich ? `dein Rang: ${ich.rang}` : 'noch nicht gespielt',
      ].filter(Boolean).join(' · ')),
    );
    oeffnen.addEventListener('click', () => duellRanglisteZeigen(e));
    const weg = duellKnopf('Löschen', 'knopf-schlicht duell-loeschen', () => {
      if (!confirm(`Das Duell «${duellBeschreibung(e.d)}» aus dem Verlauf löschen?`)) return;
      duellNeuLesen();
      delete DUELL.duelle[e.d.i];
      duellSpeichern();
      duellUebersicht();
    });
    weg.setAttribute('aria-label', `Duell ${duellBeschreibung(e.d)} löschen`);
    li.append(oeffnen, weg);
    liste.append(li);
  }
  b.append(liste);
  return b;
}

/* ── Einladung und Rangliste ──────────────────────────────────────────── */

function duellRanglisteZeigen(eintrag) {
  const d = eintrag.d;
  const stoff = duellStoff(d);
  const eigen = eigenesErgebnis(eintrag);
  const ichGespielt = duellGespielt(d, DUELL.nick);
  const teile = [];
  const kopf = el('div', { class: 'duell-kopf' });
  kopf.append(
    el('h1', {}, eigen || ichGespielt ? 'Duell' : `${d.n} fordert dich heraus`),
    el('p', { class: 'lauftext' }, `${duellBeschreibung(d)} · ${d.k.length} Fragen · erstellt von ${d.n}`),
  );
  teile.push(kopf);

  // Mitspielen: für den aktuellen Nickname, oder (schon gespielt) unter einem
  // anderen Nickname, z. B. Geschwister auf demselben Tablet.
  if (stoff.fehler) {
    teile.push(duellBlock('duell-fehler', el('p', { class: 'lauftext', id: 'duell-meldung', role: 'alert' }, stoff.fehler)));
  } else {
    const nick = nickFeld(nickVergeben(d), !ichGespielt);
    if (ichGespielt) nick.input.value = '';
    const start = [nick.wrap, duellKnopf('Duell starten', 'knopf', () => duellStartPruefen(d, nick), 'duell-start')];
    if (ichGespielt) {
      const mehr = el('details', { class: 'duell-block duell-anderer' });
      mehr.append(el('summary', {}, 'Mit einem anderen Nickname mitspielen'), ...start);
      teile.push(mehr);
    } else {
      teile.push(duellBlock('duell-ich', ...start));
    }
  }

  const rang = duellRangliste(eintrag);
  const liste = el('ol', { class: 'duell-rangliste', id: 'duell-rangliste' });
  for (const e of rang) {
    const li = el('li', { class: e.eigen ? 'eigen' : '', 'data-rang': String(e.rang) });
    li.append(
      el('span', { class: 'duell-rang', 'aria-label': e.rang === 1 ? 'Rang 1, Sieger' : `Rang ${e.rang}` },
        e.rang === 1 ? '🏆' : `${e.rang}.`),
      el('span', { class: 'duell-name' }, e.n),
      el('span', { class: 'duell-punkte' }, `${e.r}/${d.k.length}`),
      el('span', { class: 'duell-zeit' }, duellZeitText(e.z)),
    );
    liste.append(li);
  }
  teile.push(duellBlock('duell-rang-block', el('h2', {}, 'Rangliste'),
    rang.length ? liste : el('p', { class: 'lauftext' }, 'Noch keine Ergebnisse.')));

  if (eigen) {
    teile.push(duellBlock('duell-ergebnis-block',
      el('h2', {}, 'Dein Ergebnis teilen'),
      el('p', { class: 'lauftext' }, 'Wer den Link öffnet, sieht dein Ergebnis in seiner Rangliste.'),
      teilenBlock(duellLinkBauen('ergebnis', { d, n: eigen.n, r: eigen.r, z: eigen.z }),
        `Mein GeoMaster-Duell: ${eigen.r}/${d.k.length} richtig in ${duellZeitText(eigen.z)} (${duellBeschreibung(d)}).`,
        'duell-ergebnis-link', 'Ergebnis-Link', 'Ergebnis teilen'),
    ));
  }
  teile.push(duellBlock('duell-einladen-block',
    el('h2', {}, 'Weitere Gegner einladen'),
    teilenBlock(duellLinkBauen('duell', d),
      `${d.n} fordert dich zum GeoMaster-Duell heraus (${duellBeschreibung(d)}):`,
      'duell-link', 'Einladungs-Link', 'Einladen'),
  ));
  teile.push(duellKnopf('Zur Duell-Übersicht', 'knopf-schlicht', () => duellUebersicht()), zurStartseite());
  duellSchirm(...teile);
}

/* ══ Links öffnen ════════════════════════════════════════════════════════ */

function duellLinkOeffnen(hash) {
  const gelesen = duellLesen(hash);
  if (!gelesen) return;
  // Ein laufendes Spiel nicht ohne Rückfrage abbrechen.
  if (lauf && !$('#quiz').hidden && !confirm('Ein Spiel läuft gerade. Abbrechen und den Duell-Link öffnen?')) return;
  if (gelesen.fehler) return duellMeldung(gelesen.fehler);
  const bekannt = duellEintrag(gelesen.duell.i);
  // Gleiche ID, andere Fragen: gefälscht oder kaputt.
  if (bekannt && !duellGleich(bekannt.d, gelesen.duell)) return duellMeldung(DUELL_KAPUTT);
  // Ein Duell, das zu dieser App-Version nicht passt, kommt nicht in den Verlauf.
  const stoff = duellStoff(gelesen.duell);
  if (stoff.fehler && !bekannt) return duellMeldung(stoff.fehler);
  duellRanglisteZeigen(duellMerken(bekannt?.d ?? gelesen.duell, gelesen.ergebnis, false));
}

function duellHashVerarbeiten() {
  const hash = location.hash;
  if (!/^#(duell|ergebnis)=/.test(hash)) return;
  // Den Link aus dem Adressfeld nehmen: Neuladen spielt ihn nicht nochmal ab.
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* file:// in manchen Browsern */ }
  try { duellLinkOeffnen(hash); } catch { duellMeldung(DUELL_KAPUTT); }
}

const DUELL = duellSpeicherLaden();

$('#duell-oeffnen').addEventListener('click', () => duellUebersicht());
window.addEventListener('hashchange', duellHashVerarbeiten);
// Anderer Tab hat gespeichert: Stand übernehmen (laufendes Spiel bleibt).
window.addEventListener('storage', e => { if (e.key === DUELL_SPEICHER || e.key === null) duellNeuLesen(); });
duellHashVerarbeiten();
