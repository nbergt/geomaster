/* GeoMaster — Spiellogik.
   Erwartet SETS (js/sets.js); Karte, Stoff, Bilder, Themen und Speicher
   kommen aus dem aktiven Set (SET). */

'use strict';

const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(
    tag === 'svg' || SVG_TAGS.has(tag) ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};
const SVG_TAGS = new Set(['g', 'path', 'circle', 'line', 'text', 'rect', 'polygon']);

const SPEICHER_SET = 'geomaster.set.v1';
const FRAGEN_PRO_RUNDE = 12;
const GELERNT_AB = 3;               // dreimal richtig = sitzt

/* ══ Datenset ════════════════════════════════════════════════════════════ */

function setLaden() {
  try {
    const id = localStorage.getItem(SPEICHER_SET);
    if (id && SETS[id]) return SETS[id];
  } catch { /* Speicher gesperrt: Standard-Set */ }
  return SETS.ch;
}

// Alles, was vom Set abhängt, wird in setAktivieren() (unten) neu gesetzt.
let SET = setLaden();
let STOFF, FORM, KM_PRO_EINHEIT, THEMEN, FORTSCHRITT;

/* ══ Stoff ═══════════════════════════════════════════════════════════════ */

function stoffLaden() {
  try {
    const roh = localStorage.getItem(SET.speicher.stoff);
    if (roh) return JSON.parse(roh);
  } catch { /* kaputter Eintrag: Standardstoff verwenden */ }
  return SET.stoff;
}

/* ══ Geometrie ═══════════════════════════════════════════════════════════ */

// Die Pfade aus geo-ch.js bestehen nur aus M/L/Z und lassen sich direkt
// in Punktlisten zurückverwandeln — gebraucht für Treffer und Distanzen.
function pfadZerlegen(d) {
  return d.split('M').filter(Boolean).map(stueck => {
    const zu = stueck.endsWith('Z');
    const pts = (zu ? stueck.slice(0, -1) : stueck).split('L')
      .map(p => p.trim().split(/\s+/).map(Number))
      .filter(p => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    return { pts, zu };
  }).filter(r => r.pts.length > 1);
}

// Pro Zieltyp des Sets (kanton, see, fluss …) eine Map Schlüssel -> Form.
function formenBauen(set) {
  const form = {};
  for (const art of set.formen) {
    form[art.typ] = new Map(art.quelle.map(o => [o[art.schluessel], { ringe: pfadZerlegen(o.d), anker: o.a }]));
  }
  return form;
}

const formArt = typ => SET.formen.find(f => f.typ === typ);

function inRing(p, ring) {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

const inForm = (p, form) => form.ringe.filter(r => r.zu).reduce(
  (drin, r) => (inRing(p, r.pts) ? !drin : drin), false);

function distZuStrecke(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}

function distZuForm(p, form) {
  let min = Infinity;
  for (const ring of form.ringe) {
    for (let i = 1; i < ring.pts.length; i++) {
      const d = distZuStrecke(p, ring.pts[i - 1], ring.pts[i]);
      if (d < min) min = d;
    }
    if (ring.zu && ring.pts.length > 2) {
      const d = distZuStrecke(p, ring.pts[ring.pts.length - 1], ring.pts[0]);
      if (d < min) min = d;
    }
  }
  return min;
}

// Der Randpunkt einer Form, der p am nächsten liegt (für geografische Distanzen).
function naechsterPunkt(p, form) {
  let best = null, min = Infinity;
  const pruefe = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = dx * dx + dy * dy;
    let t = len ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const q = [a[0] + t * dx, a[1] + t * dy];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < min) { min = d; best = q; }
  };
  for (const ring of form.ringe) {
    for (let i = 1; i < ring.pts.length; i++) pruefe(ring.pts[i - 1], ring.pts[i]);
    if (ring.zu && ring.pts.length > 2) pruefe(ring.pts[ring.pts.length - 1], ring.pts[0]);
  }
  return best;
}

function kmZwischen(a, b) {                       // a, b: [lon, lat]
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const kmProEinheit = geo => kmZwischen(geo.unproject(0, 300), geo.unproject(100, 300)) / 100;

/* ══ Themen ══════════════════════════════════════════════════════════════ */

// Die Themen selbst liefert das Set (SETS.<id>.themen); gleich sind die Stufen.
const STUFEN_TEXT = {
  karte: ['Karte mit Namen', 'Karte ohne Namen', 'Blanko-Karte', 'Markiertes benennen'],
  nennen: ['Auswahl, Karte beschriftet', 'Auswahl', 'Eintippen', 'Auf der Blanko-Karte zeigen'],
};

/* ══ Fortschritt ═════════════════════════════════════════════════════════ */

function fortschrittLaden() {
  try { return JSON.parse(localStorage.getItem(SET.speicher.fortschritt)) || {}; }
  catch { return {}; }
}

// Ohne Set-Präfix: jedes Set hat seinen eigenen Speicher-Schlüssel.
const fKey = (thema, item, stufe) => `${thema.id}|${stufe}|${item.key}`;

function fortschrittMerken(thema, item, stufe, richtig) {
  const k = fKey(thema, item, stufe);
  const e = FORTSCHRITT[k] || { serie: 0, versuche: 0, treffer: 0 };
  e.versuche++;
  if (richtig) { e.treffer++; e.serie++; } else { e.serie = 0; }
  FORTSCHRITT[k] = e;
  try { localStorage.setItem(SET.speicher.fortschritt, JSON.stringify(FORTSCHRITT)); }
  catch { /* Speicher voll oder gesperrt: Fortschritt gilt nur für diese Sitzung */ }
}

const serieVon = (thema, item, stufe) => FORTSCHRITT[fKey(thema, item, stufe)]?.serie ?? 0;

function stufeGelernt(thema, stufe) {
  return thema.items.every(it => serieVon(thema, it, stufe) >= GELERNT_AB);
}

// Anteil des Themas, der über alle vier Stufen sitzt.
function themaStand(thema) {
  let sitzt = 0, angefangen = 0;
  for (const it of thema.items) for (let s = 1; s <= 4; s++) {
    const serie = serieVon(thema, it, s);
    if (serie >= GELERNT_AB) sitzt++;
    else if (serie > 0 || FORTSCHRITT[fKey(thema, it, s)]) angefangen++;
  }
  const gesamt = thema.items.length * 4;
  return { sitzt: sitzt / gesamt, angefangen: angefangen / gesamt };
}

/* ══ Karte ═══════════════════════════════════════════════════════════════ */

const karte = $('#karte');
const marken = el('g', { class: 'marken' });
const punkte = el('g', { class: 'punkte' });
const aufloesung = el('g', { class: 'aufloesung' });

function karteBauen() {
  const geo = SET.geo;
  ansichtSetzen(1, 0, 0);
  karte.replaceChildren();

  karte.append(el('rect', {
    class: 'fangflaeche', x: 0, y: 0, width: geo.width, height: geo.height,
  }));
  // Nur zum Anschauen: Meer, graue Nachbarländer (Europa).
  for (const h of SET.hintergrund || []) karte.append(el('path', { class: h.klasse, d: h.d }));
  karte.append(el('path', { class: 'land', d: geo.country }));

  // Eine Gruppe pro Formart, z. B. <g class="kantone"> mit <path class="kanton">.
  for (const art of SET.formen) {
    const g = el('g', { class: art.gruppe });
    for (const o of art.quelle) {
      g.append(el('path', { class: art.typ, d: o.d, 'data-key': o[art.schluessel] }));
    }
    karte.append(g);
  }
  karte.append(punkte, marken, aufloesung);
}

// Symbol-Vokabular wie auf einer Landeskarte: Dreieck für Gipfel,
// Doppelkeil für Pässe, Kreis für Orte, Ring für Hauptorte.
function punktSymbol(kat, x, y) {
  if (kat === 'berge' || kat === 'gipfel') {
    return el('polygon', { class: 'punkt-form', points: `${x},${y - 5} ${x + 4.5},${y + 3} ${x - 4.5},${y + 3}` });
  }
  if (kat === 'paesse') {
    return el('path', {
      class: 'punkt-form pass',
      d: `M${x - 5} ${y + 3.5}L${x} ${y - 1.5}L${x + 5} ${y + 3.5}M${x - 5} ${y - 3.5}L${x} ${y + 1.5}L${x + 5} ${y - 3.5}`,
    });
  }
  const hauptort = kat === 'hauptorte' || kat === 'hauptstaedte';
  return el('circle', { class: `punkt-form ${hauptort ? 'hauptort' : ''}`, cx: x, cy: y, r: 3.2 });
}

// Ein Beschriftungs-Anker je Eintrag; wird für Marken und Auflösung gebraucht.
function ankerVon(ziel) {
  if (ziel.typ === 'punkt') return SET.geo.project(ziel.lon, ziel.lat);
  return FORM[ziel.typ]?.get(ziel.id)?.anker ?? [SET.geo.width / 2, SET.geo.height / 2];
}

/* ── Beschriftungen ohne Überlagerung ────────────────────────────────────
   In der Zentralschweiz liegen ein Dutzend Pässe so dicht beieinander, dass
   die Namen sich überdecken. Jede Marke bekommt deshalb Ausweichplätze auf
   Ringen um ihr Objekt; wer weit ausweichen muss, wird mit einer feinen
   Führungslinie an sein Objekt zurückgebunden. */

const RINGE = (() => {
  const liste = [];
  for (const r of [13, 21, 31, 44, 60]) {
    for (const grad of [90, -90, 0, 180, 55, 125, -55, -125, 25, 155, -25, -155]) {
      const bogen = grad * Math.PI / 180;
      const dx = Math.cos(bogen) * r, dy = Math.sin(bogen) * r + 3.5;
      liste.push({ dx, dy, an: dx > 5 ? 'start' : dx < -5 ? 'end' : 'middle' });
    }
  }
  return liste;
})();

const PLAETZE = {
  punkt: [{ dx: 0, dy: 11.5, an: 'middle' }, ...RINGE],
  flaeche: [{ dx: 0, dy: 3.5, an: 'middle' }, ...RINGE],
};

const ueberlappt = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x, b.x)) *
                             Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y, b.y));

const summeUeberlapp = (kasten, andere) => andere.reduce((s, b) => s + ueberlappt(kasten, b), 0);

// Gemessen am sichtbaren Ausschnitt, damit Namen auch gezoomt im Bild bleiben.
function ragtRaus(k) {
  const x0 = ANSICHT.x, y0 = ANSICHT.y;
  return Math.max(0, x0 - k.x) + Math.max(0, k.x2 - (x0 + SET.geo.width / ANSICHT.s)) +
         Math.max(0, y0 - k.y) + Math.max(0, k.y2 - (y0 + SET.geo.height / ANSICHT.s));
}

const alsKasten = (b, luft = 0) => ({
  x: b.x - luft, y: b.y - luft, x2: b.x + b.width + luft, y2: b.y + b.height + luft,
});

function markenPlatzieren() {
  karte.classList.add('messen');
  for (const f of marken.querySelectorAll('.fuehrer')) f.remove();

  // Die Ausweichplätze sind für die Schriftgrösse 12.5 angelegt und wachsen
  // mit ihr: Schrift und Symbole bleiben beim Zoomen gleich gross (die Abstände
  // in Karteneinheiten schrumpfen also) und sind im Set Europa grösser.
  const probe = marken.querySelector('.marke');
  const k = probe ? parseFloat(getComputedStyle(probe).fontSize) / 12.5 : massstab();

  // Die Symbole selbst sind Hindernisse — kein Name soll auf einem Marker liegen.
  const belegt = [...punkte.children].map(g => alsKasten(g.getBBox(), 1.5 * k));
  const fuehrer = [];

  for (const t of marken.querySelectorAll('.marke')) {
    const bx = +t.dataset.bx, by = +t.dataset.by;
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('x', bx);
    t.setAttribute('y', by);
    const { width: w, height: h } = t.getBBox();

    let bester = null, besteKosten = Infinity;
    for (const p of PLAETZE[t.dataset.art]) {
      const x = bx + p.dx * k, y = by + p.dy * k;
      const links = p.an === 'start' ? x : p.an === 'end' ? x - w : x - w / 2;
      const kasten = { x: links, y: y - h * 0.8, x2: links + w, y2: y - h * 0.8 + h };
      const kosten = summeUeberlapp(kasten, belegt) / (k * k) * 3
        + ragtRaus(kasten) / k * 40
        + Math.hypot(p.dx, p.dy - 3.5) * 0.6;
      if (kosten < besteKosten) { besteKosten = kosten; bester = { p, x, y, kasten }; }
    }

    t.setAttribute('x', bester.x);
    t.setAttribute('y', bester.y);
    t.setAttribute('text-anchor', bester.p.an);
    belegt.push(bester.kasten);

    if (Math.hypot(bester.p.dx, bester.p.dy - 3.5) > 17) {
      // Linie bis zur nächstgelegenen Kante des Namens, nicht in ihn hinein.
      const k = bester.kasten;
      fuehrer.push(el('line', {
        class: 'fuehrer', x1: bx, y1: by,
        x2: Math.max(k.x, Math.min(bx, k.x2)), y2: Math.max(k.y, Math.min(by, k.y2)),
      }));
    }
  }

  marken.prepend(...fuehrer);              // Linien hinter die Namen legen
  karte.classList.remove('messen');
}

// Punkte und Marken hängen an der Kategorie und werden pro Thema neu gesetzt.
function kartenSchichtSetzen(thema) {
  punkte.replaceChildren();
  marken.replaceChildren();

  for (const it of thema.items) {
    const [x, y] = ankerVon(it.ziel);
    if (it.ziel.typ === 'punkt') {
      const g = el('g', { class: 'punkt', 'data-key': it.key });
      g.append(punktSymbol(thema.kat, x, y));
      punkte.append(g);
    }
    const t = el('text', {
      class: `marke ${formArt(it.ziel.typ)?.wasser ? 'wasser' : ''}`,
      x, y, 'data-key': it.key, 'data-bx': x, 'data-by': y,
      'data-art': it.ziel.typ === 'punkt' ? 'punkt' : 'flaeche',
    }, it.name);
    marken.append(t);
  }

  // Nur auf Stufe 1 sind Namen zu sehen — nur dort lohnt das Entzerren.
  if (karte.classList.contains('stufe-1')) markenPlatzieren();

  // Nur die Formen der aktuellen Kategorie sind Ziel und werden hervorgehoben.
  for (const p of karte.querySelectorAll('.ziel-el')) p.classList.remove('ziel-el');
  const wahl = SET.katForm[thema.kat];
  if (wahl) {
    const keys = new Set(thema.items.map(i => i.ziel.id ?? i.ziel.staat));
    for (const p of karte.querySelectorAll(`.${wahl}`)) {
      if (keys.has(p.dataset.key)) p.classList.add('ziel-el');
    }
  }
}

function karteStufeSetzen(stufe, blanko) {
  karte.setAttribute('class', `stufe-${stufe}${blanko ? ' blanko' : ''}`);
}

function klickPunkt(ev) {
  const ctm = karte.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
  return [p.x, p.y];
}

/* ══ Zoom und Gesten ═════════════════════════════════════════════════════
   Gezoomt wird über die viewBox: Faktor s (1–8) und linke obere Ecke x/y in
   Karteneinheiten. Striche, Schrift und Symbole teilen ihre Grösse in der CSS
   durch --z und bleiben so auf dem Bildschirm gleich gross. Bei 1× ist alles
   genau wie ohne Zoom: keine --z-Angabe, die viewBox des Sets. Ein Set kann
   alles zusätzlich mit --m vergrössern (SET.massstab, Europa). */

const ZOOM_MAX = 8;
const TIPP_PX = 8;                  // mehr Bewegung ist Ziehen, kein Tipp
const FINGER_PX = 22;               // Radius eines Fingertipps in CSS-Pixeln
let ANSICHT = { s: 1, x: 0, y: 0 };

// Faktor für Symbolgrössen und Abstände in Karteneinheiten.
const massstab = () => (SET.massstab || 1) / ANSICHT.s;

// Der Fingerradius beim aktuellen Zoom, umgerechnet in km.
function fingerKm() {
  const ctm = karte.getScreenCTM();
  if (!ctm || !ctm.a) return 0;
  const kmJeEinheit = SET.geo.breiteKm ? SET.geo.breiteKm / SET.geo.width : KM_PRO_EINHEIT;
  return FINGER_PX / ctm.a * kmJeEinheit;
}

function ansichtSetzen(s, x, y) {
  const { width: W, height: H } = SET.geo;
  s = Math.min(ZOOM_MAX, Math.max(1, s));
  if (s < 1.001) s = 1;
  const w = W / s, h = H / s;
  x = Math.min(W - w, Math.max(0, x));
  y = Math.min(H - h, Math.max(0, y));
  ANSICHT = { s, x, y };

  if (s === 1) {
    karte.setAttribute('viewBox', SET.geo.viewBox);
    karte.style.removeProperty('--z');
    if (!karte.style.length) karte.removeAttribute('style');
  } else {
    karte.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    karte.style.setProperty('--z', s);
  }
  $('#zoom-rein').disabled = s >= ZOOM_MAX;
  $('#zoom-raus').disabled = s <= 1;
  $('#zoom-reset').disabled = s <= 1;
}

// Um einen Bildschirmpunkt zoomen: der Kartenpunkt darunter bleibt stehen.
function zoomUm(clientX, clientY, faktor) {
  const ctm = karte.getScreenCTM();
  if (!ctm) return;
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const { s, x, y } = ANSICHT;
  const s2 = Math.min(ZOOM_MAX, Math.max(1, s * faktor));
  ansichtSetzen(s2, p.x - (p.x - x) * s / s2, p.y - (p.y - y) * s / s2);
}

function verschieben(dxPx, dyPx) {
  const ctm = karte.getScreenCTM();
  if (!ctm || ANSICHT.s === 1) return;
  ansichtSetzen(ANSICHT.s, ANSICHT.x - dxPx / ctm.a, ANSICHT.y - dyPx / ctm.d);
}

function zoomMitte(faktor) {
  const r = karte.getBoundingClientRect();
  zoomUm(r.left + r.width / 2, r.top + r.height / 2, faktor);
  zoomFertig();
}

// Nach einer Zoom-Geste die Namen für den neuen Massstab neu verteilen.
let zoomZeitgeber = null;
function zoomFertig() {
  clearTimeout(zoomZeitgeber);
  zoomZeitgeber = setTimeout(() => {
    if (karte.classList.contains('stufe-1')) markenPlatzieren();
  }, 120);
}

$('#zoom-rein').addEventListener('click', () => zoomMitte(1.6));
$('#zoom-raus').addEventListener('click', () => zoomMitte(1 / 1.6));
$('#zoom-reset').addEventListener('click', () => { ansichtSetzen(1, 0, 0); zoomFertig(); });

karte.addEventListener('wheel', ev => {
  if (!SET.zoom) return;
  ev.preventDefault();
  zoomUm(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.002));
  zoomFertig();
}, { passive: false });

// Eine Geste beginnt mit dem ersten Zeiger und endet, wenn alle weg sind.
// Antwort gibt es nur für einen kurzen Tipp: ein Zeiger, kaum bewegt,
// kein zweiter Finger dazwischen, bei der Maus nur die Haupttaste.
const zeiger = new Map();           // pointerId -> [clientX, clientY]
let geste = null;

karte.addEventListener('pointerdown', ev => {
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  try { karte.setPointerCapture(ev.pointerId); } catch { /* synthetische Ereignisse */ }
  zeiger.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (zeiger.size === 1) geste = { start: [ev.clientX, ev.clientY], bewegt: false, mehrfinger: false };
  else if (geste) geste.mehrfinger = true;
});

karte.addEventListener('pointermove', ev => {
  const alt = zeiger.get(ev.pointerId);
  if (!alt || !geste) return;
  const neu = [ev.clientX, ev.clientY];

  if (zeiger.size === 2 && SET.zoom) {
    // Pinch: Abstand und Mitte beider Finger vorher/nachher vergleichen.
    const anderer = [...zeiger].find(([id]) => id !== ev.pointerId)[1];
    const d0 = Math.hypot(alt[0] - anderer[0], alt[1] - anderer[1]);
    const d1 = Math.hypot(neu[0] - anderer[0], neu[1] - anderer[1]);
    const m0 = [(alt[0] + anderer[0]) / 2, (alt[1] + anderer[1]) / 2];
    const m1 = [(neu[0] + anderer[0]) / 2, (neu[1] + anderer[1]) / 2];
    if (d0 > 0) zoomUm(m1[0], m1[1], d1 / d0);
    verschieben(m1[0] - m0[0], m1[1] - m0[1]);
  } else if (zeiger.size === 1) {
    if (!geste.bewegt && Math.hypot(neu[0] - geste.start[0], neu[1] - geste.start[1]) >= TIPP_PX) {
      geste.bewegt = true;
      karte.classList.add('zieht');
    }
    if (geste.bewegt && SET.zoom) verschieben(neu[0] - alt[0], neu[1] - alt[1]);
  }
  zeiger.set(ev.pointerId, neu);
});

function zeigerWeg(ev) {
  if (!zeiger.delete(ev.pointerId) || zeiger.size) return;
  const g = geste;
  geste = null;
  karte.classList.remove('zieht');
  if (g.bewegt || g.mehrfinger) { zoomFertig(); return; }
  if (ev.type === 'pointerup' &&
      Math.hypot(ev.clientX - g.start[0], ev.clientY - g.start[1]) < TIPP_PX) kartenTipp(ev);
}

karte.addEventListener('pointerup', zeigerWeg);
karte.addEventListener('pointercancel', zeigerWeg);

/* ══ Bewertung ═══════════════════════════════════════════════════════════ */

function abstandKm(pt, ziel) {
  if (ziel.typ === 'punkt') {
    const km = kmZwischen(SET.geo.unproject(pt[0], pt[1]), [ziel.lon, ziel.lat]);
    // Kleinstaat (Europa): auch ein Klick in seine Fläche zählt, z. B. Luxemburg.
    return ziel.staat ? Math.min(km, abstandKm(pt, { typ: 'staat', id: ziel.staat })) : km;
  }
  const form = FORM[ziel.typ]?.get(ziel.id);
  if (!form) return Infinity;
  if (!formArt(ziel.typ).linie && inForm(pt, form)) return 0;
  // Europa: nächsten Randpunkt suchen, beide Punkte unprojizieren, Haversine.
  if (SET.distanz === 'geo') {
    return kmZwischen(SET.geo.unproject(pt[0], pt[1]), SET.geo.unproject(...naechsterPunkt(pt, form)));
  }
  return distZuForm(pt, form) * KM_PRO_EINHEIT;
}

// Die km-Toleranz für Stufe 3–4 steht im Set (SET.toleranz): eine Tabelle
// nach Zieltyp oder eine Funktion, die auch den Fingerradius bekommt.
function toleranzKm(typ) {
  return typeof SET.toleranz === 'function'
    ? SET.toleranz(typ, { fingerKm: fingerKm() })
    : SET.toleranz[typ] ?? 0;
}

function klickBewerten(pt, thema, item, stufe) {
  const km = abstandKm(pt, item.ziel);

  // Stufe 1 und 2 sind eine Auswahl unter sichtbaren Objekten: es zählt,
  // welcher Eintrag der Kategorie dem Klick am nächsten liegt.
  if (stufe <= 2) {
    let bester = null, bestKm = Infinity;
    // Mischen sich Punkte und Flächen (Kleinstaaten unter den Ländern), gewinnt
    // ein Punkt, wenn der Klick innerhalb eines Fingerradius liegt — sonst
    // wäre Vatikanstadt neben Italien nie wählbar.
    const punktZiele = thema.items.filter(i => i.ziel.typ === 'punkt');
    if (punktZiele.length && punktZiele.length < thema.items.length) {
      const radius = fingerKm();
      const wo = SET.geo.unproject(pt[0], pt[1]);
      for (const kand of punktZiele) {
        const d = kmZwischen(wo, [kand.ziel.lon, kand.ziel.lat]);
        if (d <= radius && d < bestKm) { bestKm = d; bester = kand; }
      }
    }
    if (!bester) {
      for (const kand of thema.items) {
        const d = abstandKm(pt, kand.ziel);
        if (d < bestKm) { bestKm = d; bester = kand; }
      }
    }
    return { richtig: bester?.key === item.key, km, getippt: bester };
  }

  return { richtig: km <= toleranzKm(item.ziel.typ), km, getippt: null };
}

/* ══ Textvergleich ═══════════════════════════════════════════════════════ */

const normal = s => (s ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]/g, '');

function abstandLev(a, b) {
  const m = a.length, n = b.length;
  let vor = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const akt = [i];
    for (let j = 1; j <= n; j++) {
      akt[j] = Math.min(vor[j] + 1, akt[j - 1] + 1, vor[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    vor = akt;
  }
  return vor[n];
}

// Ein Tippfehler wird verziehen, sobald das Wort lang genug ist — aber nicht,
// wenn die Eingabe einem anderen Eintrag des Themas genauso gut oder besser
// entspricht: «Irland» gilt nicht als «Island».
function textPasst(eingabe, item, thema) {
  const e = normal(eingabe);
  if (!e) return false;
  const namen = it => [it.name, ...(it.alias || [])].map(normal).filter(Boolean);
  let fehler = Infinity;
  for (const r of namen(item)) {
    if (e === r) return true;
    if (r.length >= 6) fehler = Math.min(fehler, abstandLev(e, r));
  }
  if (fehler > 1) return false;
  const andere = (thema?.items || []).filter(it => it.key !== item.key && it.name !== item.name);
  return !andere.some(it => namen(it).some(r => abstandLev(e, r) <= fehler));
}

/* ══ Runde ═══════════════════════════════════════════════════════════════ */

const mischen = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

let lauf = null;

function rundeStarten(thema, stufe) {
  // Schwach sitzende Einträge zuerst, innerhalb gleicher Stärke zufällig.
  const gemischt = mischen(thema.items)
    .map(it => ({ it, serie: Math.min(serieVon(thema, it, stufe), GELERNT_AB) }))
    .sort((a, b) => a.serie - b.serie)
    .map(x => x.it);

  lauf = {
    thema, stufe,
    fragen: gemischt.slice(0, Math.min(FRAGEN_PRO_RUNDE, gemischt.length)),
    idx: 0,
    protokoll: [],
    offen: true,
  };
  schirmZeigen('quiz');
  frageZeigen();
}

function frageZeigen() {
  const { thema, stufe, fragen, idx } = lauf;
  const item = fragen[idx];
  lauf.offen = true;

  $('#rueckmeldung').hidden = true;
  aufloesung.replaceChildren();
  ansichtSetzen(1, 0, 0);                    // jede Frage beginnt mit der ganzen Karte

  // Stufe 4 dreht die Aufgabe um; die normale Frage würde die Antwort nennen.
  $('#frage').textContent = stufe === 4 ? (item.frageAlt ?? item.frage) : item.frage;

  railSetzen(`<b>${thema.titel}</b> · Stufe ${stufe} — ${STUFEN_TEXT[thema.modus][stufe - 1]}`,
    `${idx + 1} / ${fragen.length}`);

  // Beigabe: Wappen bzw. Flagge (Bild aus dem Set) oder Kennzeichen zur Frage.
  const beigabe = $('#frage-beigabe');
  beigabe.replaceChildren();
  const bild = item.beigabe?.wappen ?? item.beigabe?.bild;
  if (bild && SET.bilder[bild]) {
    beigabe.append(el('img', {
      class: item.beigabe.bild ? 'wappen-gross flagge' : 'wappen-gross', src: SET.bilder[bild], alt: SET.bildAlt,
    }));
  } else if (item.beigabe?.kuerzel) {
    beigabe.append(el('span', { class: 'kuerzel' }, item.beigabe.kuerzel));
  }

  // Erst die Stufe setzen, dann die Schicht bauen: das Entzerren der Namen
  // misst ihre Grösse und braucht sie dafür sichtbar.
  const kartenAufgabe = (thema.modus === 'karte' && stufe <= 3) || (thema.modus === 'nennen' && stufe === 4);
  if (thema.modus === 'karte') karteStufeSetzen(stufe, stufe >= 3);
  else karteStufeSetzen(stufe === 4 ? 4 : Math.min(stufe, 2), stufe === 4);

  kartenSchichtSetzen(thema);
  if (thema.modus === 'karte' && stufe === 4) zielMarkieren(item);

  const antwortfeld = $('#antwortfeld');
  antwortfeld.replaceChildren();

  if (kartenAufgabe) return;                 // Antwort kommt über den Kartenklick
  if (thema.modus === 'nennen' && stufe <= 2) auswahlZeigen(item);
  else tippfeldZeigen();
}

// Auf Stufe 4 ist das Objekt die Frage: es wird markiert, benannt wird es
// vom Spieler. Flächen und Flussläufe werden nachgezeichnet, Punkte pulsen.
function zielMarkieren(item) {
  const [x, y] = ankerVon(item.ziel);
  if (item.ziel.typ === 'punkt') {
    aufloesung.append(
      el('circle', { class: 'puls', cx: x, cy: y, r: 3 }),
      el('circle', { class: 'frage-punkt', cx: x, cy: y, r: 2.8 }),
    );
    return;
  }
  const treffer = geoObjekt(item.ziel);
  if (treffer) {
    aufloesung.append(el('path', {
      class: `frage-form ${formArt(item.ziel.typ).linie ? 'linie' : ''}`, d: treffer.d,
    }));
  }
}

// Das Geometrie-Objekt (mit Pfad `d`) zu einem Flächen- oder Linienziel.
function geoObjekt(ziel) {
  const art = formArt(ziel.typ);
  return art ? art.quelle.find(o => o[art.schluessel] === ziel.id) : null;
}

function auswahlZeigen(item) {
  const feld = $('#antwortfeld');
  const andere = mischen(lauf.thema.items.filter(i => i.key !== item.key && i.name !== item.name)).slice(0, 3);
  for (const kand of mischen([item, ...andere])) {
    const b = el('button', { class: 'wahl', type: 'button' }, kand.name);
    b.addEventListener('click', () => {
      if (!lauf.offen) return;
      for (const other of feld.querySelectorAll('.wahl')) {
        other.disabled = true;
        if (other.textContent === item.name) other.classList.add('richtig');
      }
      const richtig = kand.key === item.key;
      if (!richtig) b.classList.add('falsch');
      antwortVerbuchen(richtig, richtig ? 'Richtig.' : `Falsch — richtig ist ${item.name}.`, item);
    });
    feld.append(b);
  }
}

function tippfeldZeigen() {
  const feld = $('#antwortfeld');
  const wrap = el('div', { class: 'tippfeld' });
  const input = el('input', { type: 'text', autocomplete: 'off', autocapitalize: 'words', placeholder: 'Name eintippen' });
  const knopf = el('button', { class: 'knopf', type: 'button' }, 'Prüfen');
  const pruefen = () => {
    if (!lauf.offen) return;
    const item = lauf.fragen[lauf.idx];
    const richtig = textPasst(input.value, item, lauf.thema);
    input.disabled = true; knopf.disabled = true;
    antwortVerbuchen(richtig,
      richtig ? `Richtig — ${item.name}.` : `Falsch — richtig ist ${item.name}.`, item);
  };
  knopf.addEventListener('click', pruefen);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') pruefen(); });
  wrap.append(input, knopf);
  feld.append(wrap);
  input.focus();
}

// Auf dem Handy schiebt die Bildschirmtastatur das Tippfeld sonst aus dem Bild.
window.visualViewport?.addEventListener('resize', () => {
  const a = document.activeElement;
  if (a && a.matches('.tippfeld input')) a.scrollIntoView({ block: 'nearest' });
});

// Ein Tipp auf die Karte (siehe Gesten oben) beantwortet die Kartenaufgabe.
function kartenTipp(ev) {
  if (!lauf || !lauf.offen) return;
  const { thema, stufe } = lauf;
  const kartenAufgabe = (thema.modus === 'karte' && stufe <= 3) || (thema.modus === 'nennen' && stufe === 4);
  if (!kartenAufgabe) return;

  const pt = klickPunkt(ev);
  if (!pt) return;
  const item = lauf.fragen[lauf.idx];
  const { richtig, km } = klickBewerten(pt, thema, item, stufe);

  aufloesungZeichnen(pt, item, richtig);

  const luft = km < 1 ? 'genau getroffen'
    : km < 10 ? `${km.toFixed(1)} km daneben`
    : `${Math.round(km)} km daneben`;
  antwortVerbuchen(richtig,
    richtig ? `Richtig — ${item.name}, ${luft}.`
            : `Daneben — ${item.name} liegt ${luft.replace(' daneben', ' entfernt')}.`,
    item, luft);
}

function aufloesungZeichnen(pt, item, richtig) {
  aufloesung.replaceChildren();
  const [zx, zy] = ankerVon(item.ziel);

  if (formArt(item.ziel.typ)) {
    const treffer = geoObjekt(item.ziel);
    if (treffer) {
      aufloesung.append(el('path', {
        class: `ziel-glanz ${formArt(item.ziel.typ).linie ? 'linie' : ''}`, d: treffer.d,
      }));
    }
  } else {
    aufloesung.append(el('circle', { class: 'ziel-glanz', cx: zx, cy: zy, r: 6 }));
  }

  if (pt) {
    if (!richtig) {
      aufloesung.append(el('line', { class: 'luftlinie', x1: pt[0], y1: pt[1], x2: zx, y2: zy }));
    }
    aufloesung.append(el('circle', { class: 'tipp-marke', cx: pt[0], cy: pt[1], r: 4 }));
  }
  aufloesung.append(el('text', { class: 'ziel-marke', x: zx, y: zy - 10 * massstab() }, item.name));
}

function antwortVerbuchen(richtig, text, item, notiz) {
  lauf.offen = false;
  fortschrittMerken(lauf.thema, item, lauf.stufe, richtig);
  lauf.protokoll.push({ item, richtig, notiz });

  const rueck = $('#rueckmeldung');
  const rt = $('#rueck-text');
  rt.className = 'rueck-text' + (richtig ? '' : ' daneben');
  rt.replaceChildren(el('b', {}, richtig ? '✓' : '✗'), document.createTextNode(' ' + text));
  if (item.hinweis) {
    rt.append(el('span', { class: 'notiz' }, ` (${item.hinweis})`));
  }
  rueck.hidden = false;
  $('#weiter').textContent = lauf.idx + 1 < lauf.fragen.length ? 'Weiter' : 'Runde abschliessen';
  $('#weiter').focus();
}

$('#weiter').addEventListener('click', () => {
  if (!lauf) return;
  lauf.idx++;
  if (lauf.idx < lauf.fragen.length) frageZeigen();
  else ergebnisZeigen();
});

/* ══ Ergebnis ════════════════════════════════════════════════════════════ */

function ergebnisZeigen() {
  const { thema, stufe, protokoll } = lauf;
  const treffer = protokoll.filter(p => p.richtig).length;
  schirmZeigen('ergebnis');
  railSetzen(`<b>${thema.titel}</b> · Stufe ${stufe}`, '');

  $('#ergebnis-zahl').textContent = `${treffer}/${protokoll.length}`;
  $('#ergebnis-titel').textContent =
    treffer === protokoll.length ? 'Alles richtig.' :
    treffer >= protokoll.length * 0.7 ? 'Sitzt fast.' : 'Da geht noch was.';

  const schwach = protokoll.filter(p => !p.richtig).map(p => p.item.name);
  $('#ergebnis-text').textContent = schwach.length
    ? `Nochmal anschauen: ${schwach.join(', ')}.`
    : 'Diese Runde war fehlerfrei — probier die nächste Stufe.';

  const liste = $('#protokoll');
  liste.replaceChildren();
  for (const p of protokoll) {
    const li = el('li', { class: p.richtig ? 'ok' : 'nicht' });
    li.append(
      el('span', { class: 'zeichen' }, p.richtig ? '✓' : '✗'),
      el('span', { class: 'titel' }, p.item.name),
      el('span', { class: 'notiz' }, p.notiz || p.item.zusatz || ''),
    );
    liste.append(li);
  }

  $('#stufe-hoch').hidden = !(stufe < 4 && treffer === protokoll.length);
}

$('#nochmal').addEventListener('click', () => rundeStarten(lauf.thema, lauf.stufe));
$('#stufe-hoch').addEventListener('click', () => rundeStarten(lauf.thema, lauf.stufe + 1));
$('#zurueck').addEventListener('click', () => homeZeigen());
$('#nach-hause').addEventListener('click', () => homeZeigen());

/* ══ Startseite ══════════════════════════════════════════════════════════ */

function skalaBauen(stand) {
  const g = el('div', { class: 'skala', role: 'img', 'aria-label': `${Math.round(stand.sitzt * 100)} Prozent gelernt` });
  const felder = 8;
  const voll = Math.round(stand.sitzt * felder);
  const halb = Math.min(felder - voll, Math.round(stand.angefangen * felder));
  for (let i = 0; i < felder; i++) {
    g.append(el('i', { class: i < voll ? 'voll' : i < voll + halb ? 'halb' : '' }));
  }
  return g;
}

// Umschalter Schweiz | Europa über der Themenliste (nur bei mehr als einem Set).
function setWahlZeigen() {
  const wahl = $('#set-wahl');
  wahl.replaceChildren();
  const sets = Object.values(SETS);
  wahl.hidden = sets.length < 2;
  for (const s of sets) {
    const b = el('button', { class: 'set-knopf', type: 'button', 'aria-pressed': String(s === SET) }, s.titel);
    b.addEventListener('click', () => {
      if (s === SET) return;
      setAktivieren(s);
      try { localStorage.setItem(SPEICHER_SET, s.id); } catch { /* nur für diese Sitzung */ }
      homeZeigen();
    });
    wahl.append(b);
  }
}

function homeZeigen() {
  lauf = null;
  schirmZeigen('home');
  railSetzen('', '');
  setWahlZeigen();

  const liste = $('#themenliste');
  liste.replaceChildren();

  for (const thema of THEMEN) {
    const li = el('li', { class: 'thema' });
    const name = el('div', { class: 'thema-name' });
    name.append(
      el('div', { class: 'thema-titel' }, thema.titel),
      el('div', { class: 'thema-info' }, `${thema.items.length} Einträge · ${thema.info}`),
    );

    const stufen = el('div', { class: 'stufen' });
    for (let s = 1; s <= 4; s++) {
      const b = el('button', {
        class: 'stufe-knopf', type: 'button',
        'data-erledigt': stufeGelernt(thema, s) ? 'ja' : 'nein',
        title: `Stufe ${s}: ${STUFEN_TEXT[thema.modus][s - 1]}`,
      }, String(s));
      b.addEventListener('click', () => rundeStarten(thema, s));
      stufen.append(b);
    }

    li.append(name, skalaBauen(themaStand(thema)), stufen);
    liste.append(li);
  }
}

$('#fortschritt-loeschen').addEventListener('click', () => {
  if (!confirm(SET.loeschFrage ?? 'Den gesamten Lernfortschritt löschen?')) return;
  FORTSCHRITT = {};
  try { localStorage.removeItem(SET.speicher.fortschritt); } catch { /* egal */ }
  homeZeigen();
});

/* ══ Stoff bearbeiten ════════════════════════════════════════════════════ */

const stoffDialog = $('#stoff');
const STOFF_HINWEIS = $('.stoff-form .lauftext').textContent;   // Text der Schweiz aus index.html

$('#stoff-oeffnen').addEventListener('click', () => {
  $('#stoff-text').value = JSON.stringify(STOFF, null, 2);
  $('#stoff-meldung').textContent = '';
  stoffDialog.showModal();
});

$('#stoff-reset').addEventListener('click', () => {
  $('#stoff-text').value = JSON.stringify(SET.stoff, null, 2);
  meldung('Standardstoff geladen — jetzt noch speichern.', true);
});

$('#stoff-speichern').addEventListener('click', () => {
  let neu;
  try { neu = JSON.parse($('#stoff-text').value); }
  catch (e) { return meldung('Das ist kein gültiges JSON: ' + e.message, false); }

  const fehlt = SET.pflichtListen.filter(k => !Array.isArray(neu[k]));
  if (fehlt.length) return meldung('Diese Listen fehlen oder sind kein Array: ' + fehlt.join(', '), false);

  try { localStorage.setItem(SET.speicher.stoff, JSON.stringify(neu)); }
  catch (e) { return meldung('Speichern fehlgeschlagen: ' + e.message, false); }

  STOFF = neu;
  THEMEN = SET.themen(STOFF);
  stoffDialog.close();
  homeZeigen();
});

function meldung(text, gut) {
  const m = $('#stoff-meldung');
  m.textContent = text;
  m.classList.toggle('gut', !!gut);
}

/* ══ Rahmen ══════════════════════════════════════════════════════════════ */

function schirmZeigen(id) {
  for (const s of document.querySelectorAll('.schirm')) s.hidden = s.id !== id;
}

function railSetzen(html, zaehler) {
  $('#rail-mitte').replaceChildren();
  if (html) {
    const span = el('span');
    span.innerHTML = html;                   // nur eigene Vorlagen, keine Fremddaten
    $('#rail-mitte').append(span);
  }
  if (zaehler) $('#rail-mitte').append(el('span', { class: 'rail-zaehler' }, zaehler));
}

// Schaltet alles Set-Abhängige um: Stoff, Formen, Themen, Fortschritt,
// Karte und die Texte im Rahmen.
function setAktivieren(set) {
  SET = set;
  STOFF = stoffLaden();
  FORM = formenBauen(set);
  KM_PRO_EINHEIT = kmProEinheit(set.geo);
  THEMEN = set.themen(STOFF);
  FORTSCHRITT = fortschrittLaden();

  document.title = set.dokTitel;
  $('.wortmarke-sub').textContent = set.untertitel;
  karte.setAttribute('aria-label', set.ariaKarte);
  $('.stoff-form .lauftext').textContent = set.stoffHinweis ?? STOFF_HINWEIS;
  $('#zoom-knoepfe').hidden = !set.zoom;
  if (set.massstab && set.massstab !== 1) karte.style.setProperty('--m', set.massstab);
  else karte.style.removeProperty('--m');
  karteBauen();
}

setAktivieren(SET);
homeZeigen();
