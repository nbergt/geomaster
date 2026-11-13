# GeoMaster: Review und Ausbauplan «Europa»

Stand: 26.10.2026. Grundlage sind die hochgeladenen Dateien (index.html, README.md, css/style.css, js/app.js, js/data-ch.js, js/geo-ch.js, js/wappen.js, tools/build-geo.mjs, tools/fetch-wappen.mjs) und die zwei Fotos der Arbeitsblätter. `tools/raw/*` lag nicht vor. Am Original wurde nichts verändert. Für die Prüfung habe ich Kopien unter `/workspace/geomaster` verwendet und die App dort einmal headless in Chrome per `file://` geladen. Sie startete ohne JavaScript-Fehler. Eine vollständige Klick-Runde habe ich nicht automatisiert durchgespielt.

---

## 1. Review der heutigen App

### 1.1 Architektur

- **Kein Build, keine Module.** `index.html` lädt vier klassische `<script>`-Dateien nacheinander. Diese legen die globalen Objekte `GEO` (geo-ch.js), `DATA` (data-ch.js) und `WAPPEN` (wappen.js) an, danach folgt `app.js`. Dadurch läuft die App per Doppelklick über `file://`. Das ist eine bewusste und wichtige Eigenschaft: ES-Module (`type="module"`) würden über `file://` in Chromium-Browsern blockiert.
- **Geometrie (`geo-ch.js`, generiert von `tools/build-geo.mjs`).** Sie enthält `viewBox` 1000×641, `project()`/`unproject()` (Zylinderprojektion mit fixem Faktor cos 46.8°), den Landesumriss `country`, 26 `cantons` {iso, d, a}, 21 `lakes` und 13 `rivers` {name, d, a}. Die Pfade bestehen nur aus M/L/Z. `d` ist der SVG-Pfad, `a` der Beschriftungsanker in SVG-Koordinaten.
- **Lernstoff (`data-ch.js`).** `DATA` enthält 7 Listen: `kantone` (nr, iso, name, hauptort, Aliasse), `hauptorte` und `orte` (lon/lat), `seen` und `fluesse` (Verweis `geo` auf einen Namen in GEO), `berge` und `paesse` (lon/lat, Höhe, Artikel).
- **Spiellogik (`app.js`).**
  - `pfadZerlegen()` (Z. 37) wandelt die SVG-Pfade zurück in Punktlisten. Daraus entsteht `FORM` (Z. 47–50), getrennt nach kanton/see/fluss. Treffer werden mit `inRing`/`inForm` (Point-in-Polygon) geprüft, Distanzen mit `distZuForm`.
  - `themenBauen()` (Z. 102–206) erzeugt aus dem Stoff 9 fest einprogrammierte Themen. Jedes hat einen `modus` (`karte` = auf der Karte zeigen, `nennen` = zuordnen oder benennen), eine `kat` und Items mit `ziel` (Kanton, See, Fluss oder Punkt).
  - 4 Stufen pro Thema (`STUFEN_TEXT`, Z. 210). `frageZeigen()` (Z. 522) setzt je nach Modus und Stufe CSS-Klassen auf dem SVG (`stufe-N`, `blanko`). Über diese Klassen blendet `style.css` Namen, Marker und Grenzen ein oder aus (ca. Z. 589–611).
  - Bewertung: `klickBewerten()` (Z. 446). Auf Stufe 1–2 zählt das nächstgelegene Objekt der Kategorie, auf Stufe 3–4 gilt eine km-Toleranz aus `TOLERANZ_KM` (Z. 444). Texteingaben prüft `textPasst()` (Z. 486) normalisiert mit Levenshtein ≤ 1 ab 6 Zeichen.
  - Fortschritt: `localStorage` `geomaster.fortschritt.v1`, Schlüssel `thema|stufe|key` (Z. 224). «Gelernt» heisst 3× in Folge richtig. Schwache Einträge kommen zuerst dran (`rundeStarten`, Z. 504).
  - Stoff-Editor: Der `<dialog>` speichert ein JSON-Override in `geomaster.stoff.v1` (Z. 801–817).
  - Beschriftung: `markenPlatzieren()` (Z. 343) platziert die Namen kollisionsarm auf Ausweichringen und zieht bei Bedarf Führungslinien.
- **Build-Tools.** `build-geo.mjs` liest lokale GeoJSON- und Overpass-Dateien aus `tools/raw/`, projiziert und vereinfacht sie (Douglas-Peucker), setzt die Anker (teils von Hand) und schreibt `geo-ch.js`. `fetch-wappen.mjs` holt 26 PNG-Thumbnails über die Commons-API und bettet sie als Data-URLs ein.

### 1.2 Was gut gemacht ist

- Die App läuft komplett offline und ohne Abhängigkeiten. Daten und Logik sind sauber getrennt, und die generierten Dateien sind als «nicht von Hand ändern» markiert.
- Die Didaktik ist durchdacht: 4 Stufen von «Namen sichtbar» bis «Blanko-Karte» bzw. Umkehraufgabe. Dazu kommen eine Wiederholung schwacher Einträge, Luftlinie und km-Angabe als Rückmeldung sowie Aliasse für die französischen und italienischen Namen.
- Die Abweichungen vom Arbeitsblatt sind im Stoff kommentiert (Allschwil, Bergün, Ajoie, Suhre, rote Korrekturen).
- Die Geometrie-Hilfen sind schlank selbst geschrieben, ohne Bibliothek (Point-in-Polygon, Segmentdistanz, Haversine).
- Die Beschriftung ohne Überlappung ist für dicht gesetzte Pässe gut gelöst.
- Die Quellen und Lizenzen sind im README und in den Tool-Köpfen dokumentiert.

### 1.3 Konkrete Probleme und Risiken

| # | Wo | Problem | Gewicht |
|---|---|---|---|
| 1 | `app.js` `TOLERANZ_KM` Z. 444 + `klickBewerten` Z. 460 | Auf Stufe 3–4 genügen 15 km für Punkte. Mehrere Ziele liegen aber näher beieinander, nachgerechnet mit den Koordinaten aus data-ch.js: Herisau–St. Gallen 8.5 km, Appenzell–St. Gallen 10.7, Luzern–Stans 11.1, Sarnen–Stans 11.5, Basel–Liestal 13.8, Furka–Grimsel 6.1, Nufenen–Grimsel 9.9, Nufenen–Furka 10.7, San Bernardino–Splügen 12.2, Gotthard–Furka 11.7, Finsteraarhorn–Eiger/Mönch/Jungfrau 10.8. Ein Klick auf den falschen Pass oder Hauptort kann deshalb als richtig gelten. Vorschlag: zusätzlich verlangen, dass das gesuchte Objekt der nächste Kandidat ist, oder die Toleranz auf etwa die halbe Distanz zum nächsten Nachbarn begrenzen. | hoch (Lernwirkung) |
| 2 | `app.js` `stoffLaden` Z. 23–29 | Sobald einmal Stoff im Editor gespeichert wurde, ignoriert die App `data-ch.js` dauerhaft. Spätere Korrekturen an der Datei kommen in diesem Browser nie an, und es gibt keinen Hinweis darauf. Vorschlag: eine Version im Stoff mitführen oder einen Hinweis «eigener Stoff aktiv» anzeigen. | mittel |
| 3 | `app.js` Z. 806–808 | Die Stoff-Validierung prüft nur, ob die 7 Listen vorhanden sind. Fehlende `lon`/`lat` führen in `GEO.project` zu NaN. Ein `geo`-Verweis auf einen nicht vorhandenen See oder Fluss ergibt `abstandKm = Infinity`, die Antwort ist immer falsch, und die Rückmeldung lautet «… liegt Infinity km entfernt» (Z. 637–642). | mittel |
| 4 | `app.js` `fKey` Z. 224 | Der Fortschrittsschlüssel enthält kein Datenset. Bei einem zweiten Datenset (Europa) kollidieren die Kürzel direkt: BE (Bern/Belgien), FR (Freiburg/Frankreich), LU (Luzern/Luxemburg), GE (Genf/Georgien) usw. | hoch für den Ausbau |
| 5 | `app.js` `textPasst` Z. 493 | Ein Tippfehler wird ab 6 Zeichen verziehen, ohne zu prüfen, ob die Eingabe ein anderer gültiger Eintrag ist. In der Schweiz ist mir kein Konflikt aufgefallen. In Europa würde aber «Irland» als «Island» akzeptiert (und umgekehrt). | hoch für den Ausbau |
| 6 | `app.js` Z. 96 `KM_PRO_EINHEIT` + `abstandKm` Z. 439 | Die Distanz zu Flächen und Linien wird in SVG-Einheiten mal einem festen km-Faktor gerechnet. Das ist nur bei kleiner Ausdehnung wie der Schweiz korrekt, für Europa nicht. | Ausbau |
| 7 | `app.js` `frageZeigen` Z. 539–545 | Fehlt ein Wappen in `WAPPEN`, erscheint gar keine Beigabe, weil Wappen-Items kein `kuerzel` haben. Die Frage ist dann nicht beantwortbar. | niedrig |
| 8 | `tools/fetch-wappen.mjs` Z. 77–87 | Fehlen Wappen beim Download, wird `wappen.js` trotzdem mit dem unvollständigen Satz überschrieben, nur der Exit-Code ist 1. Besser: bei Fehlern nicht schreiben. | niedrig |
| 9 | `build-geo.mjs` Z. 14, `fetch-wappen.mjs` Z. 9 | Der Pfad wird aus `new URL(import.meta.url).pathname` gebaut. Bei Leerzeichen oder Umlauten im Ordnerpfad ist er URL-kodiert und bricht. `fileURLToPath()` aus `node:url` ist robust. | niedrig |
| 10 | README «Kartendaten neu bauen» | Dort steht «Braucht Internet». `build-geo.mjs` liest aber nur lokale Dateien aus `tools/raw/`, Internet braucht nur `fetch-wappen.mjs` (bzw. das vorgelagerte Holen der Rohdaten). | Doku |
| 11 | `app.js` `railSetzen` Z. 835 | Verwendet `innerHTML`. Heute ist das unkritisch, weil die Titel nur aus dem Code stammen. Kommen Titel später aus Datensätzen oder JSON, sollte stattdessen `textContent` verwendet werden. | niedrig |
| 12 | `app.js` Kartenklick Z. 624 | Kartenaufgaben gehen nur per Zeiger, es gibt keine Tastaturbedienung. Der `pointerdown`-Handler reagiert auf jede Maustaste und auf jeden Touch-Beginn. | niedrig |
| 13 | `style.css` Z. 609–611 | Auf der Blanko-Karte bleiben Seen und Flüsse als sehr blasse Formen sichtbar. Bei «Seen» und «Flüsse» auf Stufe 3 ist das eine Hilfe. Das kann gewollt sein, ich frage nur nach. | Frage |
| 14 | `data-ch.js` | `nr` (Kantone, Pässe) und `buchstabe` (Seen, Flüsse, Berge) werden in der App nirgends verwendet. Die Nummerierung des Arbeitsblatts erscheint also nicht. Das ist kein Fehler, aber vielleicht nützlich, falls die Prüfung mit Nummern arbeitet. | Hinweis |

Es gibt keine automatisierten Tests und kein `package.json`. Das ist für ein Ein-Personen-Projekt in Ordnung. Für den Ausbau wäre aber ein kleiner Node-Check sinnvoll, der prüft, ob jeder `geo`-Verweis existiert, ob alle lon/lat innerhalb der Karte liegen und ob Namen und Aliasse eindeutig sind.

### 1.4 Prüfung der Schweizer Daten

Abgleich mit den Fotos der Arbeitsblätter, soweit lesbar:
- **Kantone, Kennzeichen, Hauptorte:** Alle 26 stimmen mit dem Blatt überein. Die Kennzeichen entsprechen den Kantonskürzeln. Herisau als Hauptort von AR steht so auf dem Blatt.
- **Weitere Orte:** Die Zuordnung von Allschwil (BL) und Bergün (GR) ist korrekt kommentiert. Ajoie ist richtig als Landschaft erklärt.
- **Seen a–l, Flüsse, Gebirge, Pässe:** Sie stimmen mit den korrigierten Einträgen überein (Oberalp statt Flüelen, Splügen statt Albula, Dufourspitze bei G, Matterhorn bei A, «Lac Léman» und «Zihl» als rote Ergänzungen).
- **Geometrie-Verweise:** Alle 12 Seen und 13 Flüsse aus data-ch.js haben eine passende Geometrie in geo-ch.js (geprüft). Alle 26 Kantone haben eine Fläche und ein Wappen.
- Die Höhen der Berge stimmen mit den gängigen Werten überein (Matterhorn 4478, Dufourspitze 4634, Piz Bernina 4049, Finsteraarhorn 4274, Säntis 2502, Titlis 3238, Jungfrau 4158).

Kleinere Abweichung, belegt:
- **Vue des Alpes** (`paesse` nr 12): Die Koordinate 47.0631 / 6.8567 liegt rund 1.5 km südwestlich der Passhöhe. Laut Wikipedia liegt diese bei 47.0728 N / 6.8697 E. Für das Spiel ist das praktisch egal, auf Stufe 1–2 sitzt der Marker aber leicht daneben.

Fragen, da unsicher:
- Fluss I, rot «Sure»: Der Stoff interpretiert das als **Suhre** (Sempachersee → Aare). Das ist plausibel, bitte trotzdem bestätigen, dass die Lehrperson die Suhre meint.
- Gebirge A: Auf dem Foto ist ein blauer Eintrag durchgestrichen und rot überschrieben. Ich lese «Matterhorn», sicher entziffern kann ich es auf dem Foto aber nicht. Der Stoff hat Matterhorn.
- Gebirge H: Als Punkt und Höhe verwendet der Stoff die Jungfrau (4158 m) stellvertretend für die ganze Gruppe Eiger, Mönch und Jungfrau. Ist das so gewollt?

---

## 2. Ausbau auf europäische Länder und Hauptstädte

### 2.1 Wie stark ist die App auf die Schweiz festgelegt?

Ziemlich stark, aber an gut abgegrenzten Stellen:
- **index.html:** Titel «Schweizer Geografie», Untertitel «Blatt 1 : Schweiz», `aria-label="Karte der Schweiz"`, die 4 fest verdrahteten Script-Tags `geo-ch.js`, `data-ch.js` und `wappen.js`.
- **app.js:**
  - Globale `GEO`/`DATA`/`WAPPEN` (Z. 1–2).
  - `FORM` nur mit den Typen kanton/see/fluss, gelesen aus `GEO.cantons/lakes/rivers` (Z. 47–50, 575, 651).
  - `themenBauen()` mit 9 Schweizer Themen und deutschen Fragetexten («Kanton», «Hauptort des Kantons»).
  - Die Pflichtlisten der Stoff-Validierung (Z. 806).
  - `TOLERANZ_KM` in absoluten km, `KM_PRO_EINHEIT`, Speicher-Schlüssel ohne Datenset, Alt-Text «Kantonswappen».
- **Datenmodell:** `iso` dient gleichzeitig als Kennzeichen, Geometrie-Schlüssel und Wappen-Schlüssel. Bei Ländern passt das nicht mehr: Die Autokennzeichen D, F, I, A, CH weichen von ISO DE, FR, IT, AT, CH ab.
- **build-geo.mjs:** Projektion fix bei 46.8°, Toleranzen für einen Massstab von etwa 350 m pro Einheit, Schweizer Dateilisten, Ankerkorrekturen und Fluss-Aliasse.
- **fetch-wappen.mjs:** Liste der 26 Kantonswappen.
- **Kartendarstellung:** Bei 1000 Einheiten Breite für ganz Europa entspricht 1 Einheit grob 4–5 km. Vatikan, Monaco, San Marino, Liechtenstein, Andorra, Malta und Luxemburg sind dann nur wenige Pixel gross oder gar nicht sichtbar. Ohne Zoom oder Punktersatz sind sie nicht klickbar.

### 2.2 Empfohlener Umbau

Grundsatz: Doppelklick-Start und Offline-Betrieb behalten, also weiterhin klassische Scripts und keine ES-Module.

1. **Datenset-Abstraktion.** Jedes Datenset registriert sich in einer globalen Liste, zum Beispiel `GEOMASTER.datasets.push({ id: 'ch', titel: 'Schweiz', geo, stoff, bilder, themen })`. Die Dateien wären `js/ch/geo.js`, `js/ch/stoff.js`, `js/ch/wappen.js`, `js/eu/geo.js`, `js/eu/stoff.js`, `js/eu/flaggen.js`. `index.html` lädt beide Sets. Bei Ladezeitsorgen kann man das Script per `document.createElement('script')` erst bei der Wahl nachladen, das funktioniert auch über `file://`.
2. **Themen pro Datenset deklarativ.** Statt der fest einprogrammierten `themenBauen()` liefert jedes Set seine Themen-Definitionen. Beispiel für Europa: «Länder» (karte), «Hauptstädte» (nennen), «Hauptstädte zeigen» (karte), optional «Flaggen» (nennen, Beigabe Bild). Die bisherigen Fragetexte wandern als Vorlagen ins Set. Die Logik für Stufen, Bewertung und Runde bleibt generisch.
3. **Generische Geometrie.** `GEO.flaechen` (Kantone oder Länder), `GEO.seen`, `GEO.fluesse` sowie `GEO.punkte` für Kleinstaaten. Die `FORM`-Maps werden pro Set aufgebaut.
4. **Distanzen geografisch statt in SVG-Einheiten.** Den Klick mit `unproject` in lon/lat umrechnen und die Distanz zu Punkten per Haversine bestimmen. Bei Flächen und Linien zuerst den nächsten Punkt in SVG suchen, dann diesen Punkt und den Klick unprojizieren und die Haversine-Distanz rechnen. `KM_PRO_EINHEIT` entfällt.
5. **Toleranzen pro Set und Item.** Statt fester km-Werte die «Hälfte der Distanz zum nächsten Nachbarn», mit Ober- und Untergrenze. Das behebt nebenbei Problem 1 in der Schweiz.
6. **Fortschritt und Stoff pro Set.** Schlüssel nach dem Muster `set|thema|stufe|key`. Die bestehenden Schweizer Einträge werden einmalig migriert (Präfix `ch|` voranstellen), damit der bisherige Fortschritt erhalten bleibt. Den Stoff-Override ebenfalls pro Set speichern.
7. **Textvergleich schärfen.** Eine Eingabe mit Tippfehler nur akzeptieren, wenn sie keinem anderen Eintrag des Themas exakt oder näher entspricht (Fall Island/Irland).
8. **Kleinstaaten.** Länder unter einer Mindestfläche bekommen zusätzlich einen Punkt mit Kreis als Klickziel. Auf Stufe 4 pulst ein Punkt statt einer unsichtbaren Fläche. Optional kommt eine Zoom-Funktion dazu (siehe UI).

### 2.3 Benötigte Daten

- **Länderliste:** Welche Länder zu Europa zählen, ist eine Definitionsfrage und von Thomas zu entscheiden (siehe Fragen). Für jedes Land braucht es: Schlüssel (ISO-3166-1 alpha-2), deutscher Name in Schweizer Schreibweise und Aliasse (z. B. Belarus/Weissrussland, Tschechien/Tschechische Republik, Moldau/Moldawien/Republik Moldau, Nordmazedonien), Hauptstadt mit Aliassen (Kiew/Kyjiw, Bukarest, Warschau …) und deren lon/lat. Optional kommen das internationale Autokennzeichen (falls man das Kennzeichen-Thema übernehmen will) und eine Flagge dazu.
- **Sonderfälle bei Hauptstädten, zu entscheiden:**
  - Niederlande: Amsterdam (Hauptstadt) oder Den Haag (Regierungssitz)?
  - Schweiz: Bern als «Bundesstadt».
  - Stadtstaaten mit gleichnamiger Hauptstadt: Luxemburg, Monaco, San Marino, Vatikanstadt.
  - Kosovo: international nicht von allen Staaten anerkannt.
  - Zypern (Nikosia, geteilte Insel).
- **Grenzgeometrie:** Länderflächen, Küstenlinie, optional Seen und Flüsse Europas.
- **Projektion und Ausschnitt:** Die bisherige Zylinderprojektion verzerrt bei 35–71° N zu stark. Empfehlenswert ist Lambert Azimuthal Equal Area mit Zentrum 52° N / 10° E (entspricht EPSG:3035, dem EU-Standard). Die Formel samt Umkehrung lässt sich in wenigen Zeilen als `project`/`unproject` in die generierte Datei schreiben.
  - Ausschnitt: etwa Island bis Ural, Nordkap bis Kreta. Wie weit Russland gezeigt wird, ist ebenfalls zu entscheiden.
  - Überseegebiete müssen abgeschnitten werden. In Natural Earth enthält «Frankreich» zum Beispiel auch Französisch-Guayana.

### 2.4 Datenquellen und Lizenzen (geprüft)

| Zweck | Quelle | Lizenz und Bedingungen | Anmerkungen |
|---|---|---|---|
| Ländergrenzen, Küsten, Seen, Flüsse, Städte | **Natural Earth** (naturalearthdata.com), Admin-0 Countries 1:50m oder 1:10m | **Public Domain**, laut Terms of Use keine Namensnennung nötig | Ich habe `ne_50m_admin_0_countries` heruntergeladen und geprüft: 242 Features, davon 50 mit `CONTINENT = Europe`, inklusive Vatikan, Monaco, San Marino, Liechtenstein, Malta, Andorra und Kosovo. **Fallstricke:** Frankreich, Norwegen und Kosovo haben `ISO_A2 = -99`, deshalb `ISO_A2_EH` (FR, NO, XK) oder `ADM0_A3` verwenden. Zypern und die Türkei sind als `Asia` klassiert. Åland, Färöer, Guernsey, Jersey und Isle of Man sind eigene Features. Ein Feld `NAME_DE` ist vorhanden (z. B. «Republik Moldau», «Vatikanstadt», «Vereinigtes Königreich»), muss aber auf die Schweizer Schulschreibweise geprüft werden. |
| Alternative Grenzen | Eurostat **GISCO** Countries | **Nur nicht-kommerziell**, Quellenvermerk «© EuroGeographics bezüglich der Verwaltungsgrenzen» Pflicht, Geometrie höchstens 1:1 Mio. | Bietet direkt EPSG:3035 an. Wegen der Auflagen ist Natural Earth vorzuziehen. |
| Flaggen | **flag-icons** (github.com/lipis/flag-icons) | **MIT** (Lizenzhinweis beilegen) | SVG nach ISO-alpha-2, Kosovo als `xk`. Alternative: Wikimedia Commons, dort die Lizenz pro Datei prüfen. |
| Ländernamen deutsch | Im Browser vorhanden: `Intl.DisplayNames('de-CH', {type:'region'})` (CLDR-Daten) | – | Getestet: liefert u. a. «Belarus», «Republik Moldau», «Vatikanstadt», «Nordmazedonien», «Tschechien», «Kosovo». Gut als Ausgangsliste, die Namen sollten aber fest im Stoff stehen, damit sie nicht je nach Browser variieren. |
| Hauptstädte und Koordinaten | **Wikidata** (P36 Hauptstadt, P625 Koordinaten) | **CC0** | Alternativ Natural Earth Populated Places. Ob deren Kennzeichnung der Hauptstädte für alle gewünschten Länder stimmt, habe ich nicht geprüft. |
| Build-Werkzeuge (optional) | **d3-geo** | ISC | Projektionen, Clipping, Pfade. |
| | **mapshaper** | MPL-2.0 | Vereinfachen, Zuschneiden, CLI. |
| | topojson-server | ISC | Nur nötig, falls TopoJSON verwendet wird. |

Hinweis zu den bestehenden Schweizer Quellen: OSM-Daten (Seen und Flüsse) stehen unter ODbL und verlangen eine Namensnennung. Das README nennt sie bereits, in der App selbst erscheint der Vermerk aber nicht. Für die private Nutzung ist das unkritisch. Falls die App weitergegeben wird, sollte der Vermerk sichtbar sein, etwa auf der Startseite oder im Fuss.

### 2.5 Änderungen an den Build-Tools

- `build-geo.mjs` parametrisieren oder in eine gemeinsame Bibliothek (`tools/lib/geo.mjs`) und zwei Konfigurationen aufteilen (`build-geo-ch.mjs`, `build-geo-eu.mjs`). Dabei Projektion, Ausschnitt, Toleranzen, Ausgabepfad, Ankerkorrekturen und Mindestflächen konfigurierbar machen.
- Für Europa: Natural Earth einlesen, nach Länderliste filtern (über `ISO_A2_EH`), Überseegebiete auf den Europa-Ausschnitt zuschneiden und mit LAEA projizieren. Die Vereinfachung bei 1:50m ist vermutlich ausreichend. Für jedes Land eine Fläche, einen Anker (`LABEL_X`/`LABEL_Y` aus Natural Earth sind ein guter Startwert) und für Kleinstaaten einen Ersatzpunkt erzeugen.
- Die Nachbarländer der Schweiz-Karte bleiben vorerst unberücksichtigt.
- `fetch-wappen.mjs` verallgemeinern zu «Bilder holen» (Flaggen aus flag-icons als lokale SVG-Dateien oder Data-URLs). Bei Fehlern nicht schreiben, `fileURLToPath` verwenden.
- Ein kleines Prüfskript (`tools/check.mjs`): Verweise vorhanden, Koordinaten innerhalb der Karte, Namen und Aliasse eindeutig, Toleranz kleiner als die Distanz zum Nachbarn.

### 2.6 Änderungen an der Oberfläche

- **Regionen-Wahl** auf der Startseite (Schweiz / Europa), der Untertitel «Blatt 1 : Schweiz» wird dynamisch, ebenso `aria-label`, `<title>` und die Alt-Texte («Kantonswappen» bzw. «Flagge»).
- **Zoom und Verschieben** der Karte über die `viewBox` (Mausrad, Pinch, Knöpfe +/−) oder ein Inset für Mitteleuropa. Ohne Zoom sind Mitteleuropa und der Balkan auf kleinen Bildschirmen schwer zu treffen.
- **Beschriftungen:** Auf Stufe 1 sind 45–50 Ländernamen plus Hauptstädte zu viel. Eventuell nur die Ländernamen zeigen, Hauptstädte als Punkte ohne Namen. Die Werte in `markenPlatzieren()` (Ringradien in SVG-Einheiten) müssen an den neuen Massstab angepasst werden.
- **Optionale Teilmengen:** Weil eine Runde nur 12 Fragen hat, eventuell Unterthemen wie «Nachbarländer der Schweiz», «Westeuropa», «Osteuropa», «Balkan» oder «Nordeuropa».

### 2.7 Grobe Aufwandschätzung

Für eine routinierte Entwicklerin, einen routinierten Entwickler oder einen Coding-Agenten mit anschliessender Kontrolle durch Thomas:

| Schritt | Aufwand |
|---|---|
| 1. Datenset-Abstraktion in app.js/index.html, Fortschritts-Migration, Speicher pro Set | 1–1.5 Tage |
| 2. Bewertung verallgemeinern (geografische Distanz, Nachbar-Toleranz, Textvergleich), behebt auch Problem 1 und 5 | 0.5–1 Tag |
| 3. Build-Pipeline Europa (Natural Earth, LAEA, Zuschnitt, Kleinstaaten-Punkte, Anker) | 1–2 Tage |
| 4. Stoff Europa: Länder, Hauptstädte, Koordinaten, Aliasse, Schweizer Schreibweise | 0.5–1 Tag, plus Durchsicht durch Thomas |
| 5. Flaggen (falls gewünscht) | 0.5 Tag |
| 6. UI: Regionen-Wahl, Zoom/Pan, Beschriftung, Teilmengen | 1–2 Tage |
| 7. Prüfskript, Tests in Browsern und auf dem Tablet, README | 0.5–1 Tag |
| **Total Länder + Hauptstädte (+ Flaggen)** | **ca. 5–9 Personentage** |
| Optional: Flüsse, Gebirge und Meere Europas | +2–4 Tage, je nach Umfang |

Die Schätzung ist eine Erfahrungsgrösse und nicht gemessen.

### 2.8 Offene Entscheidungen für Thomas

1. **Welche Länder zählen?**
   - Nur souveräne Staaten oder auch Kosovo?
   - Was ist mit den transkontinentalen Staaten Russland, Türkei, Kasachstan, Georgien, Armenien, Aserbaidschan sowie Zypern?
   - Gibt es eine Liste aus dem Schulbuch oder vom Arbeitsblatt der Lehrperson? Die wäre am besten.
2. **Kleinstaaten** (Vatikan, Monaco, San Marino, Liechtenstein, Andorra, Malta): mit dabei? Falls ja, ist Zoom nötig oder reicht ein Punkt?
3. **Schreibweisen:** Welche Namen gelten als «richtig» und welche nur als Alias, z. B. Belarus/Weissrussland, Moldau/Moldawien, Kiew/Kyjiw, Tschechien/Tschechische Republik?
4. **Hauptstadt-Sonderfälle:** Amsterdam oder Den Haag, Bern als «Bundesstadt», Stadtstaaten.
5. **Umfang:** nur Länder und Hauptstädte oder auch Flaggen, internationale Autokennzeichen, Flüsse, Gebirge, Meere Europas?
6. **Sprache:** nur deutsche Namen oder auch Landessprache bzw. Englisch als Alias?
7. **Karte:** Wie weit nach Osten (Ural, Kaukasus)? Sollen Nordafrika und der Nahe Osten als graue Umgebung sichtbar sein?
8. **Ein Programm oder zwei?** Europa als zweites Datenset in derselben App (empfohlen) oder eine separate Kopie?
9. **Gerät:** Wird die App auf einem Tablet oder Handy genutzt? Das entscheidet über die Priorität von Zoom und Pinch.
10. Zur Schweiz: Ist Problem 1 (zu grosse Klick-Toleranz bei nahe liegenden Pässen und Hauptorten) so gewollt oder soll es behoben werden? Und die Datenfragen in 1.4 (Suhre, Matterhorn, Gruppe Eiger, Mönch und Jungfrau).
