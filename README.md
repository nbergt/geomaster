# GeoMaster

**Spielen:** https://nbergt.github.io/geomaster/

**Weiterentwickeln mit Claude:** Dieses Repository enthält App, Projektregeln,
Prüfskripte, Generatoren und Rohdaten. Einstieg: `CLAUDE.md` und
[`ENTWICKLUNG.md`](ENTWICKLUNG.md). Die Unterlagen im Handoff-Ordner sind historisch.

Lernspiel für die Geografieprüfung 7. Klasse, auf einer Karte und in vier
Schwierigkeitsstufen. Zwei Karten, auf der Startseite umschaltbar:

- **Schweiz** (Blatt 1): Kantone, Autokennzeichen, Wappen, Hauptorte, weitere
  Orte, Seen, Flüsse, Gebirge und Pässe.
- **Europa** (Blatt 2): Länder, Hauptstädte, Flaggen, internationale
  Autokennzeichen, Flüsse, Gebirge und Gipfel.

## Starten

`index.html` doppelklicken. Kein Server, kein Build, kein Internet nötig.
Der Ordner lässt sich auf einen Stick oder ein Tablet kopieren und läuft dort
genauso; der Lernfortschritt wird pro Gerät im Browser gespeichert, für die
Schweiz und für Europa getrennt.

Die Karte lässt sich vergrössern und verschieben: Mausrad, zwei Finger
(Pinch), Ziehen oder die Knöpfe **+ / − / ⤢** (⤢ zeigt wieder die ganze Karte).
Eine Antwort zählt erst beim Loslassen und nur, wenn kaum gezogen wurde.

## Die vier Stufen

Bei Kartenaufgaben (Schweiz: Kantone, weitere Orte, Seen, Flüsse, Gebirge,
Pässe; Europa: Länder, Flüsse, Gebirge, Gipfel):

| Stufe | Was zu sehen ist |
|---|---|
| 1 | Karte mit allen Namen der Kategorie — den richtigen anklicken |
| 2 | Formen und Marker ohne Namen |
| 3 | Blanko-Karte, nur Umrisse und blasse Grenzen; frei klicken, die Luftlinie wird in Kilometern angezeigt |
| 4 | Umgekehrt: das gesuchte Objekt ist rot markiert — Flächen als Fläche, Flüsse als Linie, Gipfel, Orte und Kleinstaaten als pulsender Punkt — und wird benannt |

Bei Zuordnungsaufgaben (Schweiz: Autokennzeichen, Wappen, Hauptorte; Europa:
Hauptstädte, Flaggen, Autokennzeichen):

| Stufe | Aufgabe |
|---|---|
| 1 | Vier Antworten, Karte beschriftet |
| 2 | Vier Antworten |
| 3 | Namen eintippen (ein Tippfehler wird ab 6 Buchstaben verziehen, aber nicht, wenn die Eingabe zu einem anderen Eintrag passt: «Irland» ist nicht «Island») |
| 4 | Auf der Blanko-Karte zeigen |

Eine Stufenzahl auf der Startseite wird grün, sobald jeder Eintrag des Themas
auf dieser Stufe dreimal hintereinander richtig war. Schwach sitzende Einträge
kommen in der nächsten Runde zuerst dran.

**Wie genau muss man treffen?** Auf Stufe 1–2 zählt das nächstgelegene Objekt.
Auf der Blanko-Karte (Stufe 3–4) gilt eine Toleranz:

- Schweiz: Punkte 15 km, Flüsse 8 km, Seen 5 km, Kantone: Klick muss hinein.
- Europa (an die Kartenbreite von rund 5200 km gekoppelt): Punkte rund 80 km,
  aber nie weniger als ein Finger breit (22 Bildschirmpunkte; auf dem Handy
  ohne Zoom also deutlich mehr), Flüsse rund 50 km, Länder und Gebirge: Klick
  hinein oder bis rund 25 km vom Rand. Kleinstaaten (Vatikanstadt, Monaco, San
  Marino, Liechtenstein, Andorra, Malta, Luxemburg) sind als Punkt anklickbar;
  liegt ein Klick im Fingerradius eines solchen Punkts, gewinnt er auf Stufe
  1–2 vor dem umgebenden Land.

## Neuen Stoff einfügen

- **In der App:** oben rechts auf *Stoff*, den JSON-Text ersetzen, speichern.
  Das überschreibt den eingebauten Stoff der gerade gewählten Karte nur in
  diesem Browser; *Zurücksetzen* stellt ihn wieder her.
- **Schweiz dauerhaft:** `js/data-ch.js` direkt bearbeiten. Neue Berge, Pässe
  und Orte brauchen `lon`/`lat` (WGS84). Seen und Flüsse verweisen über `geo`
  auf eine Geometrie in `js/geo-ch.js`; fehlt sie dort, muss sie über das
  Build-Skript nachgezogen werden.
- **Europa dauerhaft:** `js/data-eu.js` wird erzeugt und nicht von Hand
  geändert. Gepflegt wird in
  - `tools/laender-europa.csv`: Länder, Aliasse, Hauptstädte, Kennzeichen,
  - `tools/stoff-eu.mjs`: Flüsse, Gebirge, Gipfel (mit Artikel und Aliassen),
    Artikel der Länder («die Schweiz»), Hinweise zur Hauptstadt.

  Danach `node tools/build-data-eu.mjs`. Für einen neuen Gipfel zuerst die
  Wikidata-ID in `stoff-eu.mjs` eintragen und `node tools/fetch-wikidata-eu.mjs`
  laufen lassen (holt Koordinaten und Höhe). Flüsse und Gebirge müssen in
  `js/geo-eu.js` vorhanden sein; dort sind bereits auch Ural (Fluss), Duero,
  Garonne, Maas, Mosel, Save, Dnister, Düna, Memel sowie Vogesen, Ardennen,
  Erzgebirge, Sudeten, Tatra, Kantabrisches Gebirge, Sierra Nevada, Pindos
  und Schottisches Hochland enthalten.

Schreibweise: Schweizer Schreibweise ohne «ß», traditionelle deutsche Namen;
moderne oder offizielle Formen stehen als Alias und gelten als richtig.

## Kartendaten und Bilder neu bauen

Nur nötig, wenn Geometrien oder Bilder dazukommen sollen.

```
node tools/build-geo.mjs           # -> js/geo-ch.js      (offline, liest tools/raw/)
node tools/fetch-wappen.mjs        # -> js/wappen.js      (Internet: Wikimedia Commons)

npm ci --prefix tools             # einmalig, vom Projektverzeichnis aus
node tools/build-geo-eu.mjs        # -> js/geo-eu.js      (offline, liest tools/raw-eu/)
node tools/fetch-wikidata-eu.mjs   # -> tools/raw-eu/wikidata-eu.json (Internet: Wikidata)
node tools/build-data-eu.mjs       # -> js/data-eu.js     (offline)
node tools/fetch-flaggen.mjs       # -> js/flaggen-eu.js  (Internet: flag-icons)
```

Die Bezugsquellen stehen jeweils oben in den Skripten. Die Europa-Generatoren
schreiben bei einem Fehler nichts. `tools/vorschau-eu.html` zeigt die
Europa-Geometrie zur Sichtprüfung (per Doppelklick öffnen).

## Prüfen

```
node tools/check.mjs --ch          # Schweiz unverändert? (gegen tools/baseline-ch.json)
node tools/check.mjs --eu          # Europa: Geometrie, Stoff, Flaggen, Themen
node tools/browser/gesten.mjs      # Zoom, Gesten, Layout Handy/Tablet (braucht Chrome)
node tools/browser/europa.mjs      # Europa im Browser (Testfälle T2, T4, T6–T12)
node tools/browser/vergleich.mjs <alter Ordner> <neuer Ordner> tools/browser/szenario-quiz.mjs
```

## Herkunft der Daten

Schweiz:
- Kantonsgrenzen und Landesumriss: swisstopo, über geoBoundaries (gbOpen)
- Seen und Flüsse: OpenStreetMap (ODbL) sowie ZHB/switzerland-geojson
- Kantonswappen: Wikimedia Commons, amtliche Wappen, gemeinfrei
- Prüfungsstoff: die beiden Arbeitsblätter, mit den roten Korrekturen der
  Lehrperson und bereinigter Schreibweise

Europa:
- Ländergrenzen, Flüsse, Gebirge, Seen: Natural Earth (Public Domain), Länder
  in der Sichtweise Deutschland (`ne_10m_admin_0_countries_deu`: Krim bei der
  Ukraine, Kosovo eigenständig, Zypern ganz)
- Koordinaten der Hauptstädte und Gipfel, Höhen: Wikidata (CC0)
- Flaggen: flag-icons v7.6.0 (MIT, siehe `LICENSES/flag-icons.txt`)
- Länderliste, Schreibweisen, Kennzeichen: `tools/laender-europa.csv`
  (Kennzeichen abgeglichen mit de.wikipedia «Liste der Kfz-Nationalitätszeichen»)

Georgien, Armenien, Aserbaidschan und Kasachstan sind bewusst nicht im
Lernstoff; sie erscheinen nur als graue Umgebung.

## Dateien

```
index.html            Oberfläche
css/style.css
js/geo-ch.js          Kartengeometrie Schweiz (autogeneriert)
js/data-ch.js         Lernstoff Schweiz — hier wird inhaltlich gepflegt
js/wappen.js          Kantonswappen als eingebettete Bilder (autogeneriert)
js/geo-eu.js          Kartengeometrie Europa (autogeneriert)
js/data-eu.js         Lernstoff Europa (autogeneriert aus CSV und stoff-eu.mjs)
js/flaggen-eu.js      Flaggen als eingebettete Bilder (autogeneriert)
js/sets.js            Die beiden Karten: Themen, Texte, Toleranzen, Speicher
js/app.js             Spiellogik
LICENSES/             Lizenztexte
tools/                Build- und Prüfskripte, Rohdaten
```
