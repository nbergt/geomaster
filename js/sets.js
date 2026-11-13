/* GeoMaster — Datensets.
   Jedes Set bringt seine Karte, seinen Stoff, seine Bilder, seine Themen und
   seine eigenen Speicher-Schlüssel mit; app.js arbeitet nur mit dem aktiven Set.
   Erwartet GEO (js/geo-ch.js), DATA (js/data-ch.js) und WAPPEN (js/wappen.js),
   für Europa zusätzlich GEO_EU, DATA_EU und FLAGGEN_EU (siehe unten). */

'use strict';

/* ══ Schweiz ═════════════════════════════════════════════════════════════ */

// Unverändert aus app.js übernommen (dort hiess sie themenBauen).
// Jeder Eintrag bekommt ein Kartenziel (für Klickaufgaben) und einen Namen
// (für Auswahl- und Tippaufgaben).
function themenSchweiz(S) {
  const punktZiel = o => ({ typ: 'punkt', lon: o.lon, lat: o.lat });
  // "die Aare", "das Matterhorn", "der Grosse St. Bernhard" — der Artikel und
  // die gebeugte Form stehen im Stoff, damit die Fragen sauber klingen.
  const mitArtikel = o => [o.artikel, o.frageName ?? o.name].filter(Boolean).join(' ');

  return [
    {
      id: 'kantone', titel: 'Kantone', info: 'Kanton auf der Karte zeigen',
      modus: 'karte', kat: 'kantone',
      items: S.kantone.map(k => ({
        key: k.iso, name: k.name, alias: k.alias,
        frage: `Wo liegt der Kanton ${k.name}?`,
        frageAlt: 'Welcher Kanton ist markiert?',
        ziel: { typ: 'kanton', id: k.iso },
      })),
    },
    {
      id: 'kennzeichen', titel: 'Autokennzeichen', info: 'Kürzel dem Kanton zuordnen',
      modus: 'nennen', kat: 'kantone',
      items: S.kantone.map(k => ({
        key: k.iso, name: k.name, alias: k.alias,
        frage: 'Zu welchem Kanton gehört dieses Kennzeichen?',
        frageAlt: 'Wo liegt der Kanton mit diesem Kennzeichen?',
        beigabe: { kuerzel: k.iso },
        ziel: { typ: 'kanton', id: k.iso },
      })),
    },
    {
      id: 'wappen', titel: 'Wappen', info: 'Wappen dem Kanton zuordnen',
      modus: 'nennen', kat: 'kantone',
      items: S.kantone.map(k => ({
        key: k.iso, name: k.name, alias: k.alias,
        frage: 'Zu welchem Kanton gehört dieses Wappen?',
        frageAlt: 'Wo liegt der Kanton mit diesem Wappen?',
        beigabe: { wappen: k.iso },
        ziel: { typ: 'kanton', id: k.iso },
      })),
    },
    {
      // Kanton -> Hauptort als Name, auf Stufe 4 zusätzlich auf der Karte.
      id: 'hauptorte', titel: 'Hauptorte', info: 'Kanton → Hauptort',
      modus: 'nennen', kat: 'hauptorte',
      items: S.kantone.map(k => {
        const ort = S.hauptorte.find(o => o.name === k.hauptort || o.kanton === k.iso);
        return {
          key: k.iso, name: k.hauptort, alias: k.hauptortAlias,
          frage: `Wie heisst der Hauptort des Kantons ${k.name}?`,
          frageAlt: `Wo liegt der Hauptort des Kantons ${k.name}?`,
          ziel: ort ? punktZiel(ort) : { typ: 'kanton', id: k.iso },
        };
      }),
    },
    {
      id: 'orte', titel: 'Weitere Orte', info: 'Ort auf der Karte zeigen',
      modus: 'karte', kat: 'orte',
      items: S.orte.map(o => ({
        key: o.name, name: o.name, hinweis: o.hinweis,
        frage: `Wo liegt ${o.name}?`,
        frageAlt: 'Welcher Ort ist markiert?',
        ziel: punktZiel(o),
      })),
    },
    {
      id: 'seen', titel: 'Seen', info: 'See auf der Karte zeigen',
      modus: 'karte', kat: 'seen',
      items: S.seen.map(s => ({
        key: s.geo, name: s.name, alias: s.alias,
        frage: `Wo liegt ${mitArtikel(s)}?`,
        frageAlt: 'Welcher See ist markiert?',
        ziel: { typ: 'see', id: s.geo },
      })),
    },
    {
      id: 'fluesse', titel: 'Flüsse', info: 'Flusslauf auf der Karte zeigen',
      modus: 'karte', kat: 'fluesse',
      items: S.fluesse.map(f => ({
        key: f.geo, name: f.name, alias: f.alias,
        frage: `Wo fliesst ${mitArtikel(f)}?`,
        frageAlt: 'Welcher Fluss ist markiert?',
        ziel: { typ: 'fluss', id: f.geo },
      })),
    },
    {
      id: 'berge', titel: 'Gebirge', info: 'Gipfel auf der Karte zeigen',
      modus: 'karte', kat: 'berge',
      items: S.berge.map(b => ({
        key: b.name, name: b.name, alias: b.alias, zusatz: b.hoehe ? `${b.hoehe} m` : null,
        frage: `Wo steht ${mitArtikel(b)}?`,
        frageAlt: 'Welcher Gipfel ist markiert?',
        ziel: punktZiel(b),
      })),
    },
    {
      id: 'paesse', titel: 'Pässe', info: 'Pass auf der Karte zeigen',
      modus: 'karte', kat: 'paesse',
      items: S.paesse.map(p => ({
        key: p.name, name: p.name, alias: p.alias, zusatz: p.hoehe ? `${p.hoehe} m` : null,
        frage: `Wo liegt ${mitArtikel(p)}?`,
        frageAlt: 'Welcher Pass ist markiert?',
        ziel: punktZiel(p),
      })),
    },
  ];
}

/* ══ Europa ══════════════════════════════════════════════════════════════
   Erwartet GEO_EU (js/geo-eu.js), DATA_EU (js/data-eu.js), FLAGGEN_EU
   (js/flaggen-eu.js), KLIMA_EU (js/klima-eu.js) und klimadiagrammBauen
   (js/klimadiagramm.js). Kleinstaaten sind ein Punkt (Kreis) mit der Koordinate
   aus GEO_EU.kleinstaaten; ein Klick in ihre Fläche (z. B. Luxemburg) zählt
   ebenfalls (Feld `staat` im Ziel). */

function themenEuropa(S) {
  const klein = new Map((typeof GEO_EU !== 'undefined' ? GEO_EU.kleinstaaten : []).map(k => [k.iso, k]));
  const landZiel = l => (l.kleinstaat && klein.has(l.iso)
    ? { typ: 'punkt', lon: klein.get(l.iso).lon, lat: klein.get(l.iso).lat, staat: l.iso }
    : { typ: 'staat', id: l.iso });
  const punktZiel = o => ({ typ: 'punkt', lon: o.lon, lat: o.lat });
  // «die Donau», «das Dinarische Gebirge», «die Schweiz», «Frankreich»
  const mitArtikel = o => [o.artikel, o.frageName ?? o.name].filter(Boolean).join(' ');
  // «von Frankreich», «von der Schweiz», «von den Niederlanden»
  const vonLand = l => (l.mehrzahl ? `von den ${l.name}n` : l.artikel === 'die' ? `von der ${l.name}` : `von ${l.name}`);
  const liegt = o => (o.mehrzahl ? 'liegen' : 'liegt');
  const engen = new Map((typeof GEO_EU !== 'undefined' ? GEO_EU.meerengen || [] : []).map(m => [m.name, m]));
  const klimaWerte = new Map(Object.entries(typeof KLIMA_EU !== 'undefined' ? KLIMA_EU.orte : {}));

  return [
    {
      id: 'laender', titel: 'Länder', info: 'Land auf der Karte zeigen',
      modus: 'karte', kat: 'laender',
      items: S.laender.map(l => ({
        key: l.iso, name: l.name, alias: l.alias,
        frage: `Wo ${liegt(l)} ${mitArtikel(l)}?`,
        frageAlt: 'Welches Land ist markiert?',
        ziel: landZiel(l),
      })),
    },
    {
      // Land -> Hauptstadt als Name, auf Stufe 4 die Hauptstadt auf der Karte.
      id: 'hauptstaedte', titel: 'Hauptstädte', info: 'Land → Hauptstadt',
      modus: 'nennen', kat: 'hauptstaedte',
      items: S.laender.map(l => {
        const ort = S.hauptstaedte.find(h => h.iso === l.iso);
        return {
          key: l.iso, name: l.hauptstadt, alias: l.hauptstadtAlias, hinweis: l.hauptstadtHinweis,
          frage: `Wie heisst die Hauptstadt ${vonLand(l)}?`,
          frageAlt: `Wo liegt die Hauptstadt ${vonLand(l)}?`,
          ziel: ort ? punktZiel(ort) : landZiel(l),
        };
      }),
    },
    {
      // Hauptstädte und weitere Städte der Lernkontrolle, als Punkt auf der Karte.
      id: 'staedte', titel: 'Städte', info: 'Stadt auf der Karte zeigen',
      modus: 'karte', kat: 'staedte',
      items: [
        ...S.laender.map(l => {
          const ort = S.hauptstaedte.find(h => h.iso === l.iso);
          return ort && { key: ort.name, name: ort.name, alias: l.hauptstadtAlias, ziel: punktZiel(ort) };
        }).filter(Boolean),
        ...(S.staedte || []).map(o => ({ key: o.name, name: o.name, alias: o.alias, ziel: punktZiel(o) })),
      ].map(o => ({ ...o, frage: `Wo liegt ${o.name}?`, frageAlt: 'Welche Stadt ist markiert?' })),
    },
    {
      id: 'flaggen', titel: 'Flaggen', info: 'Flagge dem Land zuordnen',
      modus: 'nennen', kat: 'laender',
      items: S.laender.map(l => ({
        key: l.iso, name: l.name, alias: l.alias,
        frage: 'Zu welchem Land gehört diese Flagge?',
        frageAlt: 'Wo liegt das Land mit dieser Flagge?',
        beigabe: { bild: l.iso },
        ziel: landZiel(l),
      })),
    },
    {
      id: 'kennzeichen', titel: 'Autokennzeichen', info: 'Internationales Kennzeichen dem Land zuordnen',
      modus: 'nennen', kat: 'laender',
      items: S.laender.map(l => ({
        key: l.iso, name: l.name, alias: l.alias,
        frage: 'Zu welchem Land gehört dieses Kennzeichen?',
        frageAlt: 'Wo liegt das Land mit diesem Kennzeichen?',
        beigabe: { kuerzel: l.kfz },
        ziel: landZiel(l),
      })),
    },
    {
      id: 'fluesse', titel: 'Flüsse', info: 'Flusslauf auf der Karte zeigen',
      modus: 'karte', kat: 'fluesse',
      items: S.fluesse.map(f => ({
        key: f.geo, name: f.name, alias: f.alias,
        frage: `Wo fliesst ${mitArtikel(f)}?`,
        frageAlt: 'Welcher Fluss ist markiert?',
        ziel: { typ: 'fluss', id: f.geo },
      })),
    },
    {
      id: 'gebirge', titel: 'Gebirge', info: 'Gebirge auf der Karte zeigen',
      modus: 'karte', kat: 'gebirge',
      items: S.gebirge.map(g => ({
        key: g.geo, name: g.name, alias: g.alias,
        frage: `Wo ${liegt(g)} ${mitArtikel(g)}?`,
        frageAlt: 'Welches Gebirge ist markiert?',
        ziel: { typ: 'gebirge', id: g.geo },
      })),
    },
    {
      id: 'gipfel', titel: 'Gipfel', info: 'Gipfel auf der Karte zeigen',
      modus: 'karte', kat: 'gipfel',
      items: S.gipfel.map(g => ({
        key: g.name, name: g.name, alias: g.alias, zusatz: g.hoehe ? `${g.hoehe} m` : null,
        frage: `Wo steht ${mitArtikel(g)}?`,
        frageAlt: 'Welcher Gipfel ist markiert?',
        ziel: punktZiel(g),
      })),
    },
    {
      // Meere als Fläche, Meerengen als Punkt (zu schmal für eine Fläche).
      id: 'meere', titel: 'Meere und Meerengen', info: 'Meer oder Meerenge auf der Karte zeigen',
      modus: 'karte', kat: 'meere',
      items: (S.meere || []).map(m => {
        const enge = m.meerenge && engen.get(m.name);
        if (m.meerenge && !enge) return null;
        return {
          key: m.name, name: m.name, alias: m.alias,
          frage: `Wo ${liegt(m)} ${mitArtikel(m)}?`,
          frageAlt: enge ? 'Welche Meerenge ist markiert?' : 'Welches Meer ist markiert?',
          ziel: enge ? punktZiel(enge) : { typ: 'meerflaeche', id: m.geo },
        };
      }).filter(Boolean),
    },
    {
      id: 'inseln', titel: 'Inseln und Halbinseln', info: 'Insel oder Halbinsel auf der Karte zeigen',
      modus: 'karte', kat: 'inseln',
      items: (S.inseln || []).map(i => ({
        key: i.geo, name: i.name, alias: i.alias,
        frage: `Wo ${liegt(i)} ${mitArtikel(i)}?`,
        frageAlt: 'Welche Insel oder Halbinsel ist markiert?',
        ziel: { typ: 'insel', id: i.geo },
      })),
    },
    {
      id: 'klimazonen', titel: 'Klimazonen', info: 'Klimazone auf der Karte zeigen',
      modus: 'karte', kat: 'klimazonen',
      items: (S.klimazonen || []).map(z => ({
        key: z.key, name: z.name, alias: z.alias, hinweis: z.merkmal,
        frage: `Wo herrscht das ${z.frageName ?? z.name}?`,
        frageAlt: 'Welche Klimazone ist markiert?',
        ziel: { typ: 'klimazone', id: z.key },
      })),
    },
    {
      // Diagramm lesen und der Zone zuordnen; auf Stufe 4 die Zone zeigen.
      id: 'klimadiagramme', titel: 'Klimadiagramme', info: 'Klimadiagramm der Klimazone zuordnen',
      modus: 'nennen', kat: 'klimazonen',
      items: (S.klimaorte || []).map(o => {
        const z = (S.klimazonen || []).find(k => k.key === o.zone);
        if (!z || !klimaWerte.has(o.name)) return null;
        const land = S.laender.find(l => l.iso === o.land);
        return {
          key: o.name, name: z.name, alias: z.alias,
          hinweis: `${o.name}${land ? ` (${land.name})` : ''}: ${z.merkmal}`,
          frage: 'Zu welcher Klimazone passt dieses Klimadiagramm?',
          frageAlt: 'Wo liegt die Klimazone, zu der dieses Klimadiagramm passt?',
          beigabe: { klima: o.name },
          ziel: { typ: 'klimazone', id: z.key },
        };
      }).filter(Boolean),
    },
  ];
}

/* ══ Registry ════════════════════════════════════════════════════════════ */

const SETS = {
  ch: {
    id: 'ch',
    titel: 'Schweiz',
    untertitel: 'Blatt 1 : Schweiz',
    dokTitel: 'GeoMaster — Schweizer Geografie',
    ariaKarte: 'Karte der Schweiz',
    geo: GEO,
    stoff: DATA,
    bilder: typeof WAPPEN !== 'undefined' ? WAPPEN : {},
    bildAlt: 'Kantonswappen',
    themen: themenSchweiz,
    // Flächen und Linien der Karte, in Zeichenreihenfolge. `typ` ist der
    // Zieltyp im Stoff, `gruppe` die SVG-Gruppe, `schluessel` das Feld in GEO.
    formen: [
      { typ: 'kanton', gruppe: 'kantone', quelle: GEO.cantons, schluessel: 'iso' },
      { typ: 'see',    gruppe: 'seen',    quelle: GEO.lakes,   schluessel: 'name', wasser: true },
      { typ: 'fluss',  gruppe: 'fluesse', quelle: GEO.rivers,  schluessel: 'name', wasser: true, linie: true },
    ],
    // Welche Formen bei welcher Themen-Kategorie als Ziel hervorgehoben werden.
    katForm: { kantone: 'kanton', seen: 'see', fluesse: 'fluss' },
    // Auf der Blanko-Karte ist nichts eingezeichnet; ein Klick in die Nähe zählt.
    // Kantone sind gross genug, dass der Klick wirklich hineingehen muss.
    toleranz: { punkt: 15, fluss: 8, see: 5, kanton: 0 },
    speicher: { fortschritt: 'geomaster.fortschritt.v1', stoff: 'geomaster.stoff.v1' },
    pflichtListen: ['kantone', 'hauptorte', 'orte', 'seen', 'fluesse', 'berge', 'paesse'],
    zoom: true,
  },
};

if (typeof GEO_EU !== 'undefined' && typeof DATA_EU !== 'undefined') {
  SETS.eu = {
    id: 'eu',
    titel: 'Europa',
    untertitel: 'Blatt 2 : Europa',
    dokTitel: 'GeoMaster — Europa',
    ariaKarte: 'Karte von Europa',
    loeschFrage: 'Den Lernfortschritt für Europa löschen? (Die Schweiz bleibt, wie sie ist.)',
    stoffHinweis: 'Der Stoff steht als JSON hier drin. Ein neues Kapitel fügst du ein, indem du ' +
      'den Text ersetzt und speicherst. Zurücksetzen stellt den eingebauten Europa-Stoff wieder her.',
    geo: GEO_EU,
    stoff: DATA_EU,
    bilder: typeof FLAGGEN_EU !== 'undefined' ? FLAGGEN_EU : {},
    bildAlt: 'Flagge',
    themen: themenEuropa,
    // Unter den Formen: Meer, graue Nachbarflächen (nicht klickbar).
    hintergrund: [
      { klasse: 'meer', d: `M0 0H${GEO_EU.width}V${GEO_EU.height}H0Z` },
      { klasse: 'umgebung', d: GEO_EU.umgebung },
    ],
    // `unten`: unter der Landfläche zeichnen (Meere, die das Land nicht verdecken dürfen).
    formen: [
      { typ: 'meerflaeche', gruppe: 'meere',   quelle: GEO_EU.meere || [], schluessel: 'name', wasser: true, unten: true },
      { typ: 'staat',   gruppe: 'staaten', quelle: GEO_EU.countries, schluessel: 'iso' },
      { typ: 'klimazone', gruppe: 'klimazonen', quelle: typeof KLIMA_EU !== 'undefined' ? KLIMA_EU.zonen : [], schluessel: 'key' },
      { typ: 'gebirge', gruppe: 'gebirgsflaechen', quelle: GEO_EU.ranges,    schluessel: 'name' },
      { typ: 'insel',   gruppe: 'inseln',  quelle: GEO_EU.inseln || [], schluessel: 'name' },
      // Seen nur zur Darstellung, kein Quiz.
      { typ: 'see',     gruppe: 'seen',    quelle: [{ name: 'seen', d: GEO_EU.seen }], schluessel: 'name', wasser: true },
      { typ: 'fluss',   gruppe: 'fluesse', quelle: GEO_EU.rivers,    schluessel: 'name', wasser: true, linie: true },
    ],
    katForm: { laender: 'staat', fluesse: 'fluss', gebirge: 'gebirge', meere: 'meerflaeche', inseln: 'insel', klimazonen: 'klimazone' },
    // Bild zur Frage, das nicht aus `bilder` kommt: das Klimadiagramm.
    beigabeBauen(beigabe) {
      const werte = beigabe.klima && typeof KLIMA_EU !== 'undefined' && KLIMA_EU.orte[beigabe.klima];
      return werte && typeof klimadiagrammBauen === 'function' ? klimadiagrammBauen(werte) : null;
    },
    // Auswahl, welche Themen und Einträge abgefragt werden (siehe app.js, Filter).
    filter: { speicher: 'geomaster.eu.filter.v1', vorlagen: DATA_EU.filter || [] },
    // Distanzen geografisch (Klick -> lon/lat, Haversine), nicht über einen
    // festen km-Faktor: bei Europas Ausdehnung verzerrt die Karte zu stark.
    distanz: 'geo',
    // Toleranz Stufe 3–4 in km, an die Kartenbreite B gekoppelt (≈ 5200 km);
    // bei Punkten nie kleiner als der Finger (22 CSS-Pixel beim aktuellen Zoom).
    toleranz(typ, { fingerKm }) {
      const B = GEO_EU.breiteKm;
      if (typ === 'punkt') return Math.max(0.015 * B, fingerKm);
      if (typ === 'fluss') return 0.01 * B;
      return 0.005 * B;                     // Land, Gebirge: drin oder ≈ 25 km vom Rand
    },
    // Ganz Europa auf 1000 Einheiten Breite: Schrift, Striche und Symbole
    // etwas grösser als auf der Schweizer Karte.
    massstab: 1.3,
    speicher: { fortschritt: 'geomaster.eu.fortschritt.v1', stoff: 'geomaster.eu.stoff.v1' },
    pflichtListen: ['laender', 'hauptstaedte', 'fluesse', 'gebirge', 'gipfel'],
    zoom: true,
  };
}
