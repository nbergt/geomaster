// Lernstoff Europa ausser den Ländern (die stehen in laender-europa.csv).
// Hier wird von Hand gepflegt; danach:
//   node tools/fetch-wikidata-eu.mjs   (nur wenn Gipfel dazukommen: holt Koordinaten/Höhe)
//   node tools/build-data-eu.mjs       (erzeugt js/data-eu.js)
//
// Schreibweise: traditionelle deutsche Namen, Schweizer Schreibweise (kein ß).
// `alias` = weitere Formen, die als richtig gelten (Landessprache, moderne Form).
// `artikel` und `frageName` ergeben den Fragetext («Wo fliesst die Donau?»,
// «Wo liegt das Dinarische Gebirge?»); `mehrzahl` für «Wo liegen die Alpen?».
// Flüsse und Gebirge verweisen über `geo` auf eine Geometrie in js/geo-eu.js
// (Namen siehe tools/build-geo-eu.mjs, FLUSS_NAME und GEBIRGE_NAME).

// Anhang A, Stand 26.10.2026 (Entscheid Thomas: vorerst nur die Hauptlisten).
export const FLUESSE = [
  { name: 'Wolga',   artikel: 'die', geo: 'Wolga',   alias: ['Volga'] },
  { name: 'Donau',   artikel: 'die', geo: 'Donau' },
  { name: 'Dnepr',   artikel: 'der', geo: 'Dnepr',   alias: ['Dnjepr', 'Dnipro'] },
  { name: 'Don',     artikel: 'der', geo: 'Don' },
  { name: 'Rhein',   artikel: 'der', geo: 'Rhein',   alias: ['Rhin'] },
  { name: 'Elbe',    artikel: 'die', geo: 'Elbe',    alias: ['Labe'] },
  { name: 'Weichsel', artikel: 'die', geo: 'Weichsel', alias: ['Wisła'] },
  { name: 'Oder',    artikel: 'die', geo: 'Oder',    alias: ['Odra'] },
  { name: 'Loire',   artikel: 'die', geo: 'Loire' },
  { name: 'Seine',   artikel: 'die', geo: 'Seine' },
  { name: 'Rhone',   artikel: 'die', geo: 'Rhone',   alias: ['Rhône', 'Rotten'] },
  { name: 'Po',      artikel: 'der', geo: 'Po' },
  { name: 'Tajo',    artikel: 'der', geo: 'Tajo',    alias: ['Tejo'] },
  { name: 'Ebro',    artikel: 'der', geo: 'Ebro' },
  { name: 'Themse',  artikel: 'die', geo: 'Themse',  alias: ['Thames'] },
  // Lernkontrolle Europa (13.11.2026), Flüsse n und o
  { name: 'Nördliche Dwina', artikel: 'die', frageName: 'Nördliche Dwina', geo: 'Nördliche Dwina', alias: ['Dwina', 'Sewernaja Dwina'] },
  { name: 'Ural',    artikel: 'der', geo: 'Ural',    alias: ['Uralfluss'] },
];

export const GEBIRGE = [
  { name: 'Alpen',    artikel: 'die', mehrzahl: true, geo: 'Alpen' },
  { name: 'Pyrenäen', artikel: 'die', mehrzahl: true, geo: 'Pyrenäen' },
  { name: 'Apennin',  artikel: 'der', geo: 'Apennin', alias: ['Apenninen'] },
  { name: 'Karpaten', artikel: 'die', mehrzahl: true, geo: 'Karpaten' },
  { name: 'Skandinavisches Gebirge', artikel: 'das', frageName: 'Skandinavische Gebirge', geo: 'Skandinavisches Gebirge', alias: ['Skanden'] },
  { name: 'Ural',     artikel: 'der', geo: 'Ural' },
  { name: 'Kaukasus', artikel: 'der', geo: 'Kaukasus' },
  { name: 'Dinarisches Gebirge', artikel: 'das', frageName: 'Dinarische Gebirge', geo: 'Dinarisches Gebirge', alias: ['Dinariden'] },
  { name: 'Balkangebirge', artikel: 'das', geo: 'Balkangebirge', alias: ['Balkan'] },
  { name: 'Jura',     artikel: 'der', geo: 'Jura' },
  // Lernkontrolle Europa (13.11.2026), Gebirge 4 und 5
  { name: 'Zentralmassiv', artikel: 'das', geo: 'Zentralmassiv', alias: ['Massif Central', 'Französisches Zentralmassiv'] },
  { name: 'Deutsche Mittelgebirge', artikel: 'die', mehrzahl: true, frageName: 'Deutschen Mittelgebirge', geo: 'Deutsche Mittelgebirge', alias: ['Deutsches Mittelgebirge', 'Mittelgebirge'] },
];

// Meere und Meerengen (Lernkontrolle Europa, A–L). `geo` = Fläche in
// js/geo-eu.js (meere); Meerengen sind ein Punkt (geo-eu.js, meerengen).
export const MEERE = [
  { name: 'Atlantischer Ozean', artikel: 'der', frageName: 'Atlantische Ozean', geo: 'Atlantischer Ozean', alias: ['Atlantik', 'Nordatlantik'] },
  { name: 'Nordpolarmeer', artikel: 'das', geo: 'Nordpolarmeer', alias: ['Nördliches Eismeer', 'Arktischer Ozean', 'Barentssee'] },
  { name: 'Europäisches Nordmeer', artikel: 'das', frageName: 'Europäische Nordmeer', geo: 'Europäisches Nordmeer', alias: ['Nordmeer', 'Norwegisches Meer'] },
  { name: 'Nordsee', artikel: 'die', geo: 'Nordsee' },
  { name: 'Ostsee', artikel: 'die', geo: 'Ostsee', alias: ['Baltisches Meer'] },
  { name: 'Ärmelkanal', artikel: 'der', geo: 'Ärmelkanal', alias: ['Kanal', 'English Channel', 'La Manche'] },
  { name: 'Golf von Biskaya', artikel: 'der', geo: 'Golf von Biskaya', alias: ['Biskaya'] },
  { name: 'Strasse von Gibraltar', artikel: 'die', meerenge: true, alias: ['Gibraltar', 'Meerenge von Gibraltar'] },
  { name: 'Mittelmeer', artikel: 'das', geo: 'Mittelmeer', alias: ['Mittelländisches Meer'] },
  { name: 'Adriatisches Meer', artikel: 'das', frageName: 'Adriatische Meer', geo: 'Adriatisches Meer', alias: ['Adria'] },
  { name: 'Ionisches Meer', artikel: 'das', frageName: 'Ionische Meer', geo: 'Ionisches Meer' },
  { name: 'Ägäisches Meer', artikel: 'das', frageName: 'Ägäische Meer', geo: 'Ägäisches Meer', alias: ['Ägäis'] },
  { name: 'Schwarzes Meer', artikel: 'das', frageName: 'Schwarze Meer', geo: 'Schwarzes Meer' },
  { name: 'Bosporus', artikel: 'der', meerenge: true },
  { name: 'Dardanellen', artikel: 'die', mehrzahl: true, meerenge: true },
];

// Inseln und Halbinseln (Lernkontrolle Europa, 1–15). `geo` = Fläche in
// js/geo-eu.js (inseln).
export const INSELN = [
  { name: 'Island', geo: 'Island' },
  { name: 'Skandinavien', geo: 'Skandinavien', alias: ['Skandinavische Halbinsel'] },
  { name: 'Kola', artikel: 'die', frageName: 'Halbinsel Kola', geo: 'Kola', alias: ['Halbinsel Kola', 'Kolahalbinsel'] },
  { name: 'Irland', geo: 'Irland' },
  { name: 'Grossbritannien', geo: 'Grossbritannien' },
  { name: 'Iberische Halbinsel', artikel: 'die', geo: 'Iberische Halbinsel', alias: ['Pyrenäenhalbinsel', 'Iberien'] },
  { name: 'Balearen', artikel: 'die', mehrzahl: true, geo: 'Balearen', alias: ['Balearische Inseln', 'Mallorca'] },
  { name: 'Apenninenhalbinsel', artikel: 'die', geo: 'Apenninenhalbinsel', alias: ['Italienische Halbinsel', 'Italien', 'Apenninhalbinsel'] },
  { name: 'Korsika', geo: 'Korsika', alias: ['Corse'] },
  { name: 'Sardinien', geo: 'Sardinien', alias: ['Sardegna'] },
  { name: 'Sizilien', geo: 'Sizilien', alias: ['Sicilia'] },
  { name: 'Peloponnes', artikel: 'der', geo: 'Peloponnes', alias: ['Peloponnesos'] },
  { name: 'Kreta', geo: 'Kreta' },
  { name: 'Zypern', geo: 'Zypern' },
  { name: 'Krim', artikel: 'die', geo: 'Krim', alias: ['Halbinsel Krim'] },
  { name: 'Jütland', geo: 'Jütland' },
];

// Städte ausser den Hauptstädten (Lernkontrolle Europa, «Städte»). Die
// Hauptstädte kommen aus laender-europa.csv. Koordinaten: Wikidata (P625),
// die Wikidata-Bezeichnung muss zum Namen oder einem Alias passen.
export const STAEDTE = [
  { name: 'Barcelona',       wikidata: 'Q1492',  land: 'ES' },
  { name: 'Birmingham',      wikidata: 'Q2256',  land: 'GB' },
  { name: 'Danzig',          wikidata: 'Q1792',  land: 'PL', alias: ['Gdańsk', 'Gdansk'] },
  { name: 'Hamburg',         wikidata: 'Q1055',  land: 'DE' },
  { name: 'Istanbul',        wikidata: 'Q406',   land: 'TR', alias: ['İstanbul', 'Konstantinopel'] },
  { name: 'Mailand',         wikidata: 'Q490',   land: 'IT', alias: ['Milano'] },
  { name: 'Marseille',       wikidata: 'Q23482', land: 'FR' },
  { name: 'Neapel',          wikidata: 'Q2634',  land: 'IT', alias: ['Napoli'] },
  { name: 'St. Petersburg',  wikidata: 'Q656',   land: 'RU', alias: ['Sankt Petersburg', 'Petersburg', 'Leningrad'] },
];

// `wikidata`: Objekt für Koordinaten (P625) und Höhe (P2044); gesucht über die
// Wikidata-Suche und anhand von Bezeichnung, Typ und Höhe geprüft.
// `land`: ISO-Codes aus Anhang A (check.mjs prüft, dass der Gipfel dort liegt).
export const GIPFEL = [
  { name: 'Elbrus',        artikel: 'der', land: ['RU'],       wikidata: 'Q43105' },
  { name: 'Mont Blanc',    artikel: 'der', land: ['FR', 'IT'], wikidata: 'Q583', alias: ['Monte Bianco'] },
  { name: 'Zugspitze',     artikel: 'die', land: ['DE'],       wikidata: 'Q3375' },
  { name: 'Grossglockner', artikel: 'der', land: ['AT'],       wikidata: 'Q3388', alias: ['Glockner'] },
  { name: 'Ätna',          artikel: 'der', land: ['IT'],       wikidata: 'Q16990', alias: ['Etna'] },
  { name: 'Vesuv',         artikel: 'der', land: ['IT'],       wikidata: 'Q524', alias: ['Vesuvio'] },
  // Q80344 «Berg Olymp»; der höchste Gipfel Mýtikas (Q545768) ist gleich hoch und < 1 km entfernt.
  { name: 'Olymp',         artikel: 'der', land: ['GR'],       wikidata: 'Q80344', alias: ['Olympos'] },
  { name: 'Mulhacén',      artikel: 'der', land: ['ES'],       wikidata: 'Q209528' },
  { name: 'Triglav',       artikel: 'der', land: ['SI'],       wikidata: 'Q1024' },
  { name: 'Ben Nevis',     artikel: 'der', land: ['GB'],       wikidata: 'Q104674' },
];

// Länder, die im Satz einen Artikel brauchen («Wo liegt die Schweiz?»,
// «Wo liegen die Niederlande?», «die Hauptstadt von der Türkei»).
// Alle übrigen stehen ohne Artikel («Wo liegt Frankreich?»).
export const LAND_ARTIKEL = {
  CH: { artikel: 'die' },
  NL: { artikel: 'die', mehrzahl: true },
  SK: { artikel: 'die' },
  TR: { artikel: 'die' },
  UA: { artikel: 'die' },
  VA: { artikel: 'die' },
};

// Hinweise zur Hauptstadt (aus laender-europa.csv, Spalte bemerkung):
// werden bei der Rückmeldung angezeigt, gelten aber nicht als Antwort.
export const HAUPTSTADT_HINWEIS = {
  NL: 'Regierungssitz ist Den Haag',
  CH: 'Bern ist Bundesstadt',
};

// Klimazonen Europas (Arbeitsblatt «Klimazonen Europas», November 2026). Die
// Merkmale stammen vom Blatt; die Einteilung der Karte steht in
// tools/build-klima-eu.mjs. `key` verbindet Stoff, Regeln und Flächen.
export const KLIMAZONEN = [
  { key: 'nordeuropaeisch', name: 'Nordeuropäisches Klima', frageName: 'nordeuropäische Klima', alias: ['Nordeuropäisch', 'Subpolares Klima', 'Polarklima'],
    merkmal: 'Kalte Polarluft; kein Monat ohne Regen; kältester Monat unter −3 °C' },
  { key: 'ozeanisch', name: 'Ozeanisches Klima', frageName: 'ozeanische Klima', alias: ['Ozeanisch', 'Seeklima', 'Meeresklima'],
    merkmal: 'Nähe zum Meer; keine Trockenmonate; kältester Monat nicht unter 3 °C; Unterschied kältester–wärmster Monat etwa 10 °C' },
  { key: 'uebergang', name: 'Übergangsklima', frageName: 'Übergangsklima', alias: ['Übergang'],
    merkmal: 'Zwischen ozeanischem und kontinentalem Klima; Meeresluft wirkt noch; Unterschied Sommer–Winter etwa 20 °C' },
  { key: 'kontinental', name: 'Kontinentales Klima', frageName: 'kontinentale Klima', alias: ['Kontinentalklima', 'Kontinental', 'Landklima'],
    merkmal: 'Weit vom Meer; trockene Luft; heisse Sommer, sehr kalte Winter; sehr grosser Unterschied Sommer–Winter' },
  { key: 'mittelmeer', name: 'Mittelmeerklima', frageName: 'Mittelmeerklima', alias: ['Mediterranes Klima', 'Mittelmeer'],
    merkmal: 'Mild wegen des Meeres; Trockenzeit im Sommer; kältester Monat nicht unter 3 °C' },
  { key: 'hochgebirge', name: 'Hochgebirgsklima', frageName: 'Hochgebirgsklima', alias: ['Gebirgsklima', 'Hochgebirge'],
    merkmal: 'Von der Höhe bestimmt: je höher, desto kälter und desto mehr Niederschlag (Steigungsregen)' },
];

// Orte für Klimadiagramme. Werte: WorldClim 2.1 (tools/fetch-worldclim-eu.mjs),
// Rasterzelle am Ort. `zone` muss zur Einteilung der Zelle passen, sonst
// schreibt build-klima-eu.mjs nichts. Koordinaten: Hauptstädte und STAEDTE
// über den Namen, die übrigen über `wikidata` (tools/fetch-wikidata-eu.mjs).
export const KLIMAORTE = [
  { name: 'Kiruna',          land: 'SE', zone: 'nordeuropaeisch', wikidata: 'Q83232' },
  { name: 'Archangelsk',     land: 'RU', zone: 'nordeuropaeisch', wikidata: 'Q1851' },
  { name: 'Tromsø',          land: 'NO', zone: 'nordeuropaeisch', wikidata: 'Q42328401' },
  { name: 'London',          land: 'GB', zone: 'ozeanisch' },
  { name: 'Dublin',          land: 'IE', zone: 'ozeanisch' },
  { name: 'Bergen',          land: 'NO', zone: 'ozeanisch', wikidata: 'Q26793' },
  { name: 'Brest',           land: 'FR', zone: 'ozeanisch', wikidata: 'Q12193' },
  { name: 'Kassel',          land: 'DE', zone: 'uebergang', wikidata: 'Q2865' },
  { name: 'Berlin',          land: 'DE', zone: 'uebergang' },
  { name: 'Warschau',        land: 'PL', zone: 'uebergang' },
  { name: 'Prag',            land: 'CZ', zone: 'uebergang' },
  { name: 'Moskau',          land: 'RU', zone: 'kontinental' },
  { name: 'Kiew',            land: 'UA', zone: 'kontinental' },
  { name: 'Bukarest',        land: 'RO', zone: 'kontinental' },
  { name: 'Wolgograd',       land: 'RU', zone: 'kontinental', wikidata: 'Q914' },
  { name: 'Rom',             land: 'IT', zone: 'mittelmeer' },
  { name: 'Athen',           land: 'GR', zone: 'mittelmeer' },
  { name: 'Lissabon',        land: 'PT', zone: 'mittelmeer' },
  { name: 'Marseille',       land: 'FR', zone: 'mittelmeer' },
  { name: 'Davos',           land: 'CH', zone: 'hochgebirge', wikidata: 'Q68097' },
  { name: 'Jungfraujoch',    land: 'CH', zone: 'hochgebirge', wikidata: 'Q665676' },
  { name: 'Hoher Sonnblick', land: 'AT', zone: 'hochgebirge', wikidata: 'Q877393' },
];

// Filter-Vorlagen: welche Themen und Einträge abgefragt werden. `themen` ordnet
// jeder Themen-ID ("laender", "hauptstaedte", "staedte", "fluesse", "gebirge",
// "meere", "inseln", "klimazonen", "klimadiagramme", "flaggen", "kennzeichen",
// "gipfel") "alle" oder eine Liste von Schlüsseln bzw. Namen zu. Themen, die
// fehlen, sind ausgeblendet. In der App lassen sich die Vorlagen kopieren,
// anpassen und als eigene Filter speichern.
export const FILTER = [
  {
    id: 'test-europa-2026-11',
    name: 'Test Europa (16.11.2026)',
    quelle: 'Lernziele «Test Europa 2026» und rot markierte Einträge der Lernkontrolle (Fotos vom 13.11.2026)',
    themen: {
      // Lernziele: Länder und Hauptstädte Europas, auf der Karte erkennen
      laender: 'alle',
      hauptstaedte: 'alle',
      // Lernkontrolle «Städte»: rot umkreist, «Alle»
      staedte: [
        'Amsterdam', 'Andorra la Vella', 'Ankara', 'Athen', 'Bern', 'Barcelona', 'Birmingham', 'Bukarest',
        'Berlin', 'Budapest', 'Brüssel', 'Bratislava', 'Dublin', 'Danzig', 'Helsinki', 'Hamburg',
        'Istanbul', 'Kopenhagen', 'Kiew', 'London', 'Ljubljana', 'Lissabon', 'Luxemburg', 'Madrid',
        'Moskau', 'Mailand', 'Minsk', 'Marseille', 'Neapel', 'Nikosia', 'Oslo', 'Paris', 'Prag', 'Rom',
        'Riga', 'Reykjavik', 'Stockholm', 'St. Petersburg', 'Sofia', 'Sarajevo', 'Skopje', 'Tirana',
        'Vilnius', 'Wien', 'Warschau', 'Zagreb',
      ],
      // Lernkontrolle: rot mit ✗ markiert
      fluesse: ['Loire', 'Seine', 'Rhein', 'Elbe', 'Donau', 'Po', 'Wolga', 'Rhone'],
      gebirge: ['Ural', 'Pyrenäen', 'Zentralmassiv', 'Alpen', 'Karpaten', 'Apennin', 'Balkangebirge'],
      meere: [
        'Atlantischer Ozean', 'Nordsee', 'Ostsee', 'Ärmelkanal', 'Strasse von Gibraltar', 'Mittelmeer',
        'Ionisches Meer', 'Ägäisches Meer', 'Schwarzes Meer', 'Bosporus',
      ],
      inseln: [
        'Island', 'Skandinavien', 'Irland', 'Grossbritannien', 'Iberische Halbinsel', 'Balearen',
        'Korsika', 'Sardinien', 'Sizilien', 'Kreta', 'Zypern', 'Krim',
      ],
      // Lernziele: Klimazonen kennen, Klimadiagramme zuordnen
      klimazonen: 'alle',
      klimadiagramme: 'alle',
    },
  },
];
