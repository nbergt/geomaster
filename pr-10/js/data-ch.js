// Prüfungsstoff 7. Klasse, abgetippt von den beiden Arbeitsblättern
// "Kantone, Autokennzeichen, Hauptorte und weitere Orte" sowie
// "Seen, Flüsse, Gebirge und Pässe".
//
// Übernommen wurden jeweils die KORRIGIERTEN Antworten (rote Korrekturen der
// Lehrperson), Schreibweisen sind bereinigt. Abweichungen vom Blatt sind
// unten bei den einzelnen Einträgen kommentiert.
//
// lon/lat sind geografische Koordinaten (WGS84).

const DATA = {

  // --- 26 Kantone: Nummer wie auf dem Blatt, Kennzeichen, Hauptort ----------
  kantone: [
    { nr: 1,  iso: 'VD', name: 'Waadt',                   hauptort: 'Lausanne' },
    { nr: 2,  iso: 'FR', name: 'Freiburg',                hauptort: 'Freiburg',    alias: ['Fribourg'],  hauptortAlias: ['Fribourg'] },
    { nr: 3,  iso: 'NE', name: 'Neuenburg',               hauptort: 'Neuenburg',   alias: ['Neuchâtel'], hauptortAlias: ['Neuchâtel'] },
    { nr: 4,  iso: 'BE', name: 'Bern',                    hauptort: 'Bern' },
    { nr: 5,  iso: 'JU', name: 'Jura',                    hauptort: 'Delémont',    hauptortAlias: ['Delsberg'] },
    { nr: 6,  iso: 'BS', name: 'Basel-Stadt',             hauptort: 'Basel' },
    { nr: 7,  iso: 'BL', name: 'Basel-Landschaft',        hauptort: 'Liestal',     alias: ['Basel-Land', 'Baselland'] },
    { nr: 8,  iso: 'VS', name: 'Wallis',                  hauptort: 'Sion',        hauptortAlias: ['Sitten'] },
    { nr: 9,  iso: 'TI', name: 'Tessin',                  hauptort: 'Bellinzona' },
    { nr: 10, iso: 'GR', name: 'Graubünden',              hauptort: 'Chur' },
    { nr: 11, iso: 'AI', name: 'Appenzell Innerrhoden',   hauptort: 'Appenzell' },
    { nr: 12, iso: 'AR', name: 'Appenzell Ausserrhoden',  hauptort: 'Herisau' },
    { nr: 13, iso: 'SG', name: 'St. Gallen',              hauptort: 'St. Gallen' },
    { nr: 14, iso: 'TG', name: 'Thurgau',                 hauptort: 'Frauenfeld' },
    { nr: 15, iso: 'SH', name: 'Schaffhausen',            hauptort: 'Schaffhausen' },
    { nr: 16, iso: 'ZH', name: 'Zürich',                  hauptort: 'Zürich' },
    { nr: 17, iso: 'AG', name: 'Aargau',                  hauptort: 'Aarau' },
    { nr: 18, iso: 'LU', name: 'Luzern',                  hauptort: 'Luzern' },
    { nr: 19, iso: 'ZG', name: 'Zug',                     hauptort: 'Zug' },
    { nr: 20, iso: 'UR', name: 'Uri',                     hauptort: 'Altdorf' },
    { nr: 21, iso: 'GE', name: 'Genf',                    hauptort: 'Genf',        alias: ['Genève'], hauptortAlias: ['Genève'] },
    { nr: 22, iso: 'OW', name: 'Obwalden',                hauptort: 'Sarnen' },
    { nr: 23, iso: 'SO', name: 'Solothurn',               hauptort: 'Solothurn' },
    { nr: 24, iso: 'GL', name: 'Glarus',                  hauptort: 'Glarus' },
    { nr: 25, iso: 'SZ', name: 'Schwyz',                  hauptort: 'Schwyz' },
    { nr: 26, iso: 'NW', name: 'Nidwalden',               hauptort: 'Stans' },
  ],

  // --- Hauptorte als Punkte auf der Karte -----------------------------------
  hauptorte: [
    { name: 'Lausanne',     kanton: 'VD', lon: 6.6323, lat: 46.5197 },
    { name: 'Freiburg',     kanton: 'FR', lon: 7.1620, lat: 46.8065 },
    { name: 'Neuenburg',    kanton: 'NE', lon: 6.9310, lat: 46.9930 },
    { name: 'Bern',         kanton: 'BE', lon: 7.4474, lat: 46.9480 },
    { name: 'Delémont',     kanton: 'JU', lon: 7.3444, lat: 47.3644 },
    { name: 'Basel',        kanton: 'BS', lon: 7.5886, lat: 47.5596 },
    { name: 'Liestal',      kanton: 'BL', lon: 7.7350, lat: 47.4840 },
    { name: 'Sion',         kanton: 'VS', lon: 7.3606, lat: 46.2331 },
    { name: 'Bellinzona',   kanton: 'TI', lon: 9.0244, lat: 46.1944 },
    { name: 'Chur',         kanton: 'GR', lon: 9.5320, lat: 46.8508 },
    { name: 'Appenzell',    kanton: 'AI', lon: 9.4097, lat: 47.3306 },
    { name: 'Herisau',      kanton: 'AR', lon: 9.2792, lat: 47.3861 },
    { name: 'St. Gallen',   kanton: 'SG', lon: 9.3767, lat: 47.4245 },
    { name: 'Frauenfeld',   kanton: 'TG', lon: 8.8990, lat: 47.5580 },
    { name: 'Schaffhausen', kanton: 'SH', lon: 8.6349, lat: 47.6960 },
    { name: 'Zürich',       kanton: 'ZH', lon: 8.5417, lat: 47.3769 },
    { name: 'Aarau',        kanton: 'AG', lon: 8.0457, lat: 47.3906 },
    { name: 'Luzern',       kanton: 'LU', lon: 8.3093, lat: 47.0502 },
    { name: 'Zug',          kanton: 'ZG', lon: 8.5155, lat: 47.1662 },
    { name: 'Altdorf',      kanton: 'UR', lon: 8.6440, lat: 46.8807 },
    { name: 'Genf',         kanton: 'GE', lon: 6.1432, lat: 46.2044 },
    { name: 'Sarnen',       kanton: 'OW', lon: 8.2456, lat: 46.8959 },
    { name: 'Solothurn',    kanton: 'SO', lon: 7.5323, lat: 47.2088 },
    { name: 'Glarus',       kanton: 'GL', lon: 9.0680, lat: 47.0404 },
    { name: 'Schwyz',       kanton: 'SZ', lon: 8.6530, lat: 47.0207 },
    { name: 'Stans',        kanton: 'NW', lon: 8.3660, lat: 46.9580 },
  ],

  // --- "weitere Orte" (Spalte 5 des ersten Blattes) -------------------------
  orte: [
    { name: 'Yverdon-les-Bains', kanton: 'VD', lon: 6.6410, lat: 46.7785 },
    { name: 'Romont',            kanton: 'FR', lon: 6.9181, lat: 46.6944 },
    { name: 'La Chaux-de-Fonds', kanton: 'NE', lon: 6.8258, lat: 47.1042 },
    { name: 'Thun',              kanton: 'BE', lon: 7.6280, lat: 46.7580 },
    // Ajoie ist keine Stadt, sondern die Landschaft im Nordwesten des Jura;
    // Ankerpunkt ist ihr Hauptort Porrentruy.
    { name: 'Ajoie',             kanton: 'JU', lon: 7.0750, lat: 47.4156, hinweis: 'Landschaft im Kanton Jura (Hauptort Porrentruy)' },
    // Auf dem Blatt bei Basel-Stadt eingetragen, liegt aber in Basel-Landschaft.
    { name: 'Allschwil',         kanton: 'BL', lon: 7.5350, lat: 47.5522, hinweis: 'liegt in Basel-Landschaft (auf dem Blatt bei Basel-Stadt)' },
    { name: 'Sissach',           kanton: 'BL', lon: 7.8100, lat: 47.4633 },
    { name: 'Zermatt',           kanton: 'VS', lon: 7.7491, lat: 46.0207 },
    { name: 'Lugano',            kanton: 'TI', lon: 8.9511, lat: 46.0037 },
    { name: 'Davos',             kanton: 'GR', lon: 9.8370, lat: 46.8043 },
    // Auf dem Blatt in der Zeile von Appenzell/St. Gallen, liegt aber in Graubünden.
    { name: 'Bergün',            kanton: 'GR', lon: 9.7458, lat: 46.6297, hinweis: 'liegt in Graubünden (auf dem Blatt weiter oben eingetragen)' },
    { name: 'Winterthur',        kanton: 'ZH', lon: 8.7241, lat: 47.5000 },
  ],

  // --- Seen a-l -------------------------------------------------------------
  // "geo" verweist auf die Fläche in geo-ch.js.
  seen: [
    { buchstabe: 'a', name: 'Genfersee',           artikel: 'der', geo: 'Genfersee',           alias: ['Lac Léman', 'Lac Leman'] },
    { buchstabe: 'b', name: 'Neuenburgersee',      artikel: 'der', geo: 'Neuenburgersee',      alias: ['Lac de Neuchâtel'] },
    { buchstabe: 'c', name: 'Murtensee',           artikel: 'der', geo: 'Murtensee',           alias: ['Lac de Morat'] },
    { buchstabe: 'd', name: 'Bielersee',           artikel: 'der', geo: 'Bielersee',           alias: ['Lac de Bienne'] },
    { buchstabe: 'e', name: 'Thunersee',           artikel: 'der', geo: 'Thunersee' },
    { buchstabe: 'f', name: 'Brienzersee',         artikel: 'der', geo: 'Brienzersee' },
    { buchstabe: 'g', name: 'Vierwaldstättersee',  artikel: 'der', geo: 'Vierwaldstättersee' },
    { buchstabe: 'h', name: 'Zugersee',            artikel: 'der', geo: 'Zugersee' },
    { buchstabe: 'i', name: 'Zürichsee',           artikel: 'der', geo: 'Zürichsee' },
    { buchstabe: 'j', name: 'Bodensee',            artikel: 'der', geo: 'Bodensee' },
    { buchstabe: 'k', name: 'Lago Maggiore',       artikel: 'der', geo: 'Lago Maggiore',       alias: ['Langensee'] },
    { buchstabe: 'l', name: 'Luganersee',          artikel: 'der', geo: 'Luganersee',          alias: ['Lago di Lugano'] },
  ],

  // --- Flüsse A-M (I wurde von der Lehrperson rot ergänzt) ------------------
  fluesse: [
    { buchstabe: 'A', name: 'Ticino',        artikel: 'der', geo: 'Ticino' },
    { buchstabe: 'B', name: 'Maggia',        artikel: 'die', geo: 'Maggia' },
    { buchstabe: 'C', name: 'Rhone',         artikel: 'die', geo: 'Rhone',         alias: ['Rotten', 'Rhône'] },
    { buchstabe: 'D', name: 'Sense',         artikel: 'die', geo: 'Sense',         alias: ['Singine'] },
    { buchstabe: 'E', name: 'Thièle / Zihl', artikel: 'die', geo: 'Thièle / Zihl', alias: ['Zihl', 'Thièle', 'Thielle'] },
    { buchstabe: 'F', name: 'Areuse',        artikel: 'die', geo: 'Areuse' },
    { buchstabe: 'G', name: 'Aare',          artikel: 'die', geo: 'Aare' },
    { buchstabe: 'H', name: 'Emme',          artikel: 'die', geo: 'Emme' },
    // Zeile I war auf dem Blatt nicht gedruckt und wurde rot nachgetragen
    // ("Sure"): die Suhre, vom Sempachersee zur Aare bei Aarau.
    { buchstabe: 'I', name: 'Suhre',         artikel: 'die', geo: 'Suhre',         alias: ['Sure'] },
    { buchstabe: 'J', name: 'Reuss',         artikel: 'die', geo: 'Reuss' },
    { buchstabe: 'K', name: 'Saane',         artikel: 'die', geo: 'Saane',         alias: ['Sarine'] },
    { buchstabe: 'L', name: 'Limmat',        artikel: 'die', geo: 'Limmat' },
    { buchstabe: 'M', name: 'Rhein',         artikel: 'der', geo: 'Rhein',         alias: ['Vorderrhein', 'Hinterrhein'] },
  ],

  // --- Gebirge A-H ----------------------------------------------------------
  berge: [
    { buchstabe: 'A', name: 'Matterhorn',            artikel: 'das', lon: 7.6586, lat: 45.9763, hoehe: 4478 },
    { buchstabe: 'B', name: 'Piz Bernina',           artikel: 'der', lon: 9.9084, lat: 46.3826, hoehe: 4049 },
    { buchstabe: 'C', name: 'Finsteraarhorn',        artikel: 'das', lon: 8.1261, lat: 46.5372, hoehe: 4274 },
    { buchstabe: 'D', name: 'Säntis',                artikel: 'der', lon: 9.3431, lat: 47.2494, hoehe: 2502 },
    { buchstabe: 'E', name: 'Chasseral',             artikel: 'der', lon: 7.0597, lat: 47.1319, hoehe: 1607 },
    { buchstabe: 'F', name: 'Titlis',                artikel: 'der', lon: 8.4372, lat: 46.7717, hoehe: 3238 },
    { buchstabe: 'G', name: 'Dufourspitze',          artikel: 'die', lon: 7.8669, lat: 45.9369, hoehe: 4634 },
    { buchstabe: 'H', name: 'Eiger, Mönch, Jungfrau', artikel: 'die Gruppe', lon: 7.9883, lat: 46.5575, hoehe: 4158,
      alias: ['Eiger Mönch Jungfrau', 'Jungfrau', 'Eiger', 'Mönch'] },
  ],

  // --- Pässe 1-12 -----------------------------------------------------------
  paesse: [
    { nr: 1,  name: 'Grosser St. Bernhard', artikel: 'der', frageName: 'Grosse St. Bernhard', lon: 7.1706, lat: 45.8692, hoehe: 2469, alias: ['Grosser Sankt Bernhard', 'Gr. St. Bernhard'] },
    { nr: 2,  name: 'Nufenenpass',          artikel: 'der', lon: 8.3872, lat: 46.4783, hoehe: 2478, alias: ['Nufenen'] },
    { nr: 3,  name: 'Gotthardpass',         artikel: 'der', lon: 8.5661, lat: 46.5556, hoehe: 2106, alias: ['Gotthard', 'St. Gotthard'] },
    { nr: 4,  name: 'Furkapass',            artikel: 'der', lon: 8.4153, lat: 46.5722, hoehe: 2429, alias: ['Furka'] },
    // Auf dem Blatt stand "Flüelen", rot korrigiert zu Oberalp.
    { nr: 5,  name: 'Oberalppass',          artikel: 'der', lon: 8.6708, lat: 46.6589, hoehe: 2044, alias: ['Oberalp'] },
    { nr: 6,  name: 'Grimselpass',          artikel: 'der', lon: 8.3372, lat: 46.5606, hoehe: 2164, alias: ['Grimsel'] },
    { nr: 7,  name: 'Sustenpass',           artikel: 'der', lon: 8.4494, lat: 46.7261, hoehe: 2224, alias: ['Susten'] },
    { nr: 8,  name: 'Brünigpass',           artikel: 'der', lon: 8.1361, lat: 46.7583, hoehe: 1008, alias: ['Brünig'] },
    { nr: 9,  name: 'San Bernardino',       artikel: 'der', lon: 9.1719, lat: 46.4939, hoehe: 2065, alias: ['San Bernardino Pass'] },
    // Auf dem Blatt stand "Albula", rot korrigiert zu Splügen.
    { nr: 10, name: 'Splügenpass',          artikel: 'der', lon: 9.3306, lat: 46.5050, hoehe: 2113, alias: ['Splügen'] },
    { nr: 11, name: 'Berninapass',          artikel: 'der', lon: 10.0203, lat: 46.4108, hoehe: 2328, alias: ['Bernina'] },
    { nr: 12, name: 'Vue des Alpes',        artikel: 'die', lon: 6.8567, lat: 47.0631, hoehe: 1283, alias: ['Vuedes Alpes'] },
  ],
};
