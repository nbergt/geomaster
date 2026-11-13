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
