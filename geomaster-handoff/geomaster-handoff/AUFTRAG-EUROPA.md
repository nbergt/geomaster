# Auftrag: GeoMaster um Europa erweitern

Projekt: `C:\Apps\GeoMaster`. Arbeite **Phase für Phase** (Abschnitt 6). Nach jeder Phase hältst du an, fasst kurz zusammen, was geändert wurde und wie es geprüft wurde, und wartest auf Thomas' OK. Bei Unklarheiten fragst du nach und erfindest keine Daten.

---

## 1. Kontext: was die App ist

GeoMaster ist ein Lernspiel für die Geografieprüfung (7. Klasse, Schweiz). Geübt werden Kantone, Autokennzeichen, Wappen, Hauptorte, weitere Orte, Seen, Flüsse, Gebirge und Pässe auf einer SVG-Karte, je in 4 Stufen. Die App ist Vanilla HTML/CSS/JS ohne Build, und Lernstand sowie eigener Stoff liegen im `localStorage`. Der Start erfolgt per Doppelklick auf `index.html` (`file://`).

Architektur (Ist-Zustand):
- `index.html` lädt **klassische Scripts** in fester Reihenfolge: `js/geo-ch.js` → `js/data-ch.js` → `js/wappen.js` → `js/app.js`. Diese setzen die Globals `GEO`, `DATA` und `WAPPEN`. ES-Module sind keine vorgesehen, weil sie unter `file://` in Chromium blockiert werden.
- `js/geo-ch.js` wird von `tools/build-geo.mjs` erzeugt. Es enthält:
  - `viewBox` 1000×641
  - `project(lon,lat)` / `unproject(x,y)`, eine Zylinderprojektion mit fixem cos 46.8°
  - `country`
  - `cantons[{iso,d,a}]`, `lakes[{name,d,a}]` und `rivers[{name,d,a}]`
  
  Die Pfade bestehen nur aus M/L/Z, `a` ist der Beschriftungsanker in SVG-Koordinaten.
- `js/data-ch.js` enthält `DATA` mit `kantone`, `hauptorte`, `orte`, `seen`, `fluesse`, `berge` und `paesse`. Punktobjekte haben lon/lat, Seen und Flüsse verweisen über `geo` auf Namen in GEO.
- `js/wappen.js` wird von `tools/fetch-wappen.mjs` erzeugt und enthält `WAPPEN[iso]` als PNG-Data-URL.
- `js/app.js`:
  - `pfadZerlegen()` + `FORM` (Z. ~37–50): Pfade → Punktringe, Maps für kanton/see/fluss.
  - `inRing`/`inForm`/`distZuForm`/`kmZwischen`: Treffer- und Distanzrechnung. `KM_PRO_EINHEIT` (Z. ~96) ist ein **fixer** km-Faktor pro SVG-Einheit.
  - `themenBauen(S)` (Z. ~102–206): 9 **fest codierte** CH-Themen. Jedes hat `modus` `karte|nennen`, `kat` und Items `{key,name,alias,frage,frageAlt,ziel,beigabe}`.
  - `STUFEN_TEXT`, Fortschritt in `geomaster.fortschritt.v1` mit Schlüssel `fKey = thema|stufe|key` (Z. ~224) und **ohne Datenset-Präfix**.
  - Weitere Funktionen: `karteBauen`, `kartenSchichtSetzen`, `markenPlatzieren` (Label-Entzerrung), `klickBewerten` (Stufe 1–2: nächster Kandidat, Stufe 3–4: `TOLERANZ_KM = {punkt:15,fluss:8,see:5,kanton:0}`), `textPasst` (Levenshtein ≤ 1 ab 6 Zeichen), `frageZeigen`, `zielMarkieren`, `aufloesungZeichnen`, `auswahlZeigen`, `tippfeldZeigen`.
  - Kartenklick über `pointerdown` auf `#karte` (Z. ~624).
  - Stoff-Editor (`<dialog id="stoff">`) mit Override in `geomaster.stoff.v1` und fester Liste der 7 CH-Listen (Z. ~806).
- `css/style.css` steuert die Sichtbarkeit pro Stufe über Klassen auf `#karte` (`stufe-N`, `blanko`, `messen`), ca. Z. 589–611.

Auf die Schweiz festgelegt sind: Titel, Untertitel «Blatt 1 : Schweiz» und `aria-label` in `index.html`, die Script-Tags, `themenBauen`, `FORM`-Typen, `TOLERANZ_KM`, `KM_PRO_EINHEIT`, die Speicher-Schlüssel, der Alt-Text «Kantonswappen» und im Build die Projektion, Toleranzen und Dateilisten.

## 2. Ziel

Ein zweites Datenset **Europa** in derselben App, auswählbar auf der Startseite. Themen:

| Thema | Modus | Ziel | Hinweis |
|---|---|---|---|
| Länder | karte | Länderfläche (Kleinstaaten: Punkt) | |
| Hauptstädte | nennen | Land → Hauptstadt; Stufe 4: Hauptstadt auf der Blanko-Karte zeigen (Punkt) | wie CH «Hauptorte» |
| Flaggen | nennen | Flagge → Land | wie CH «Wappen» |
| Autokennzeichen | nennen | int. Kennzeichen → Land | Kennzeichen ≠ ISO (D, F, I, A, UK …) |
| Flüsse | karte | Flusslauf (Linie) | Liste in Anhang A |
| Gebirge | karte | Gebirgsfläche | Liste in Anhang A |
| Gipfel | karte | Punkt | Liste in Anhang A |

## 3. Entscheide von Thomas (verbindlich)

1. **Der Schweizer Modus bleibt unverändert**, inklusive gespeichertem Fortschritt und Stoff-Override. Die 15-km-Toleranz für CH bleibt, sie ist **nicht** zu «korrigieren».
2. **Länder:** alle europäischen Länder **inklusive Kosovo, Russland, Türkei und Zypern** (Liste: `laender-europa.csv`, 47 Länder).
3. **Kleinstaaten** (Vatikanstadt, Monaco, San Marino, Liechtenstein, Andorra, Malta, Luxemburg) sind dabei und werden als **Punkt** dargestellt und angeklickt. Luxemburg behält zusätzlich die Fläche.
4. **Zusatzthemen:** Flaggen, internationale Autokennzeichen, Flüsse, Gebirge und Gipfel.
5. **Schreibweise:** **traditionelle deutsche Namen** (Kiew, Weissrussland, Moldawien …) in Schweizer Schreibweise (**kein ß**, also «Weissrussland», «Grossglockner»). Moderne bzw. offizielle Formen gelten als Alias und werden als richtig akzeptiert.
6. **Klicktoleranz Europa:** grosszügig und an die Kartengrösse gekoppelt (Regel in 5.4).
7. **Tablet und Handy** müssen gut funktionieren: Touch, responsives Layout, Zoom/Pan (Pinch, Ziehen, Knöpfe).
8. **Prinzipien bleiben:** offline über `file://`, keine Laufzeit-Abhängigkeiten, kein Server.
9. **Ausgeschlossen: Georgien, Armenien, Aserbaidschan und Kasachstan** (Entscheid Thomas). Sie werden **nicht** im Lernstoff erfasst und nicht abgefragt, es gibt keine Flagge, kein Kennzeichen und keine Hauptstadt. Auf der Karte erscheinen sie nur als **neutrale graue Umgebung** (wie die übrigen Nachbarflächen, z. B. Nordafrika oder der Nahe Osten): ohne Namen, nicht klickbar, nicht als Antwortkandidat. Ein Klick dorthin wird wie ein Klick ins Leere bewertet. Es gibt keinen Schalter und kein `grenzfall`-Feld.

## 4. Datenquellen und Lizenzen

| Zweck | Quelle | Lizenz | Fallstricke (geprüft) |
|---|---|---|---|
| Ländergrenzen | **Natural Earth** `ne_10m_admin_0_countries_deu.geojson` (Sichtweise Deutschland). Repo: github.com/nvkelso/natural-earth-vector, Ordner `geojson/` | Public Domain, keine Namensnennung nötig | Die **Standard-Datei** (`ne_50m/ne_10m_admin_0_countries`) ordnet die **Krim Russland zu** (de facto). In der `_deu`-Variante gehört die Krim zur Ukraine, Kosovo ist eigenständig, Zypern ist eine ganze Insel. Deshalb `_deu` verwenden (eine CHE-Sicht gibt es nicht). **`ISO_A2` ist `-99` bei Frankreich, Norwegen und Kosovo**, deshalb `ISO_A2_EH` (FR, NO, XK) oder `ADM0_A3` verwenden. **Zypern und Türkei haben `CONTINENT = Asia`.** Nicht nach Kontinent filtern, sondern nach der expliziten Liste aus der CSV. GEO, ARM, AZE und KAZ gehören nur in die graue Umgebung. Frankreich hat 21 Teilflächen (Überseegebiete), Norwegen hat Svalbard, Russland reicht bis Chukotka über den Antimeridian. Deshalb auf den Europa-Ausschnitt **clippen**. Italien enthält Löcher für Vatikan und San Marino. Die Datei ist 13 MB gross, also vereinfachen. `NAME_DE` nur als Hinweis verwenden (z. B. «Republik Zypern»), die Namen kommen aus der CSV. |
| Flüsse | Natural Earth `ne_10m_rivers_lake_centerlines` (+ `ne_10m_rivers_europe` für Details) | Public Domain | Namen sind **pro Teilstück** verschieden und teils fehlerhaft kodiert. Der Rhein steht unter «Rhein», «Rhin» und «Rhine» mit verschiedenen `rivernum` (105/140/150), die Rhone unter «Rhône» und «Rhne», der Tajo unter «Tajo» und «Tejo», der Dnepr unter «Dnipro» und «Dnepre». Es gibt keinen `wikidataid`. Deshalb eine **explizite Zuordnungstabelle** anlegen (wie `RIVER_ALIAS` in `build-geo.mjs`) und nach Bounding-Box filtern, denn «Don» gibt es z. B. auch in Grossbritannien. |
| Gebirge | Natural Earth `ne_10m_geography_regions_polys` (`FEATURECLA = Range/mtn`) | Public Domain | Vorhanden sind u. a. ALPS, PYRENEES, CARPATHIAN MOUNTAINS, APPENNINI, KJØLEN MOUNTAINS, URAL MOUNTAINS, CAUCASUS MTS., Dinaric Alps, Balkan Mts. **`NAME_DE` von APPENNINI lautet fälschlich «Ligurischer Apennin»**, deshalb die Namen aus Anhang A nehmen. |
| Gipfel (Koordinaten, Höhe) | **Wikidata** (P625 Koordinaten, P2044 Höhe) | CC0 | **Nicht** `ne_10m_geography_regions_elevation_points` verwenden. Dort ist z. B. das Matterhorn um ca. 6 km verschoben, und Namen sind kaputt («Galdhpiggen», «Hvannadalshnkur»). |
| Hauptstädte (Koordinaten) | **Wikidata** (P36 Hauptstadt, P625) | CC0 | Koordinaten auf 4 Nachkommastellen. Die abgerufenen Werte als JSON in `tools/raw-eu/` ablegen, damit der Build reproduzierbar offline läuft. |
| Flaggen | **flag-icons** (github.com/lipis/flag-icons), `flags/4x3/<iso>.svg` | MIT, LICENSE-Text beilegen | Geprüft vorhanden sind u. a. `xk`, `va`, `mc`, `sm`, `li`, `ad`, `mt`, `cy`, `tr`, `ru`, `by`, `md`, `ge`, `am`, `az`, `gb`. Für das Vereinigte Königreich `gb` verwenden. |
| Autokennzeichen | CSV (abgeglichen mit de.wikipedia «Liste der Kfz-Nationalitätszeichen», Stand 26.10.2026) | – | UK seit 2021 (vorher GB), NMK seit 2019, RKS für Kosovo. |

**Länderliste `laender-europa.csv`** (liegt bei; UTF-8 mit BOM, Trennzeichen `;`, Mehrfachwerte mit `|`): 47 Länder, alle mit `status=fix`. Die Spalten sind iso, name, alias, hauptstadt, hauptstadt_alias, kfz, ne_adm0_a3, kleinstaat, status und bemerkung. Die Kennzeichen wurden mit de.wikipedia abgeglichen. Einträge mit «bitte bestätigen/wählen» in `bemerkung` muss Thomas noch entscheiden. Abhängige Gebiete in Natural Earth (Färöer, Åland, Gibraltar, Jersey, Guernsey, Isle of Man) werden grau dargestellt und nicht abgefragt. Ausnahme ist Åland, das zu Finnland gezählt wird.

**Nicht verwenden:** Eurostat GISCO (nur nicht-kommerziell, Pflichtvermerk) und keine CDN-Links zur Laufzeit.

Build-Tools dürfen **devDependencies** nutzen (`tools/package.json`): `d3-geo` (ISC) für Projektion, Clipping und Antimeridian, optional `mapshaper` (MPL-2.0) zum Vereinfachen. In die App gelangt **nur generiertes JS**.

## 5. Zielarchitektur

### 5.1 Dateien
```
index.html                 (lädt CH wie bisher + EU-Dateien + js/sets.js vor js/app.js)
js/geo-ch.js  js/data-ch.js  js/wappen.js     UNVERÄNDERT (Byte-identisch)
js/geo-eu.js               generiert: GEO_EU
js/data-eu.js              DATA_EU (Lernstoff, von Hand pflegbar, aus CSV erzeugt)
js/flaggen-eu.js           generiert: FLAGGEN_EU[iso] = SVG-Data-URL
js/sets.js                 Registry: SETS = { ch: {...}, eu: {...} } (Themen, Texte, Toleranzen, Speicher-Schlüssel)
js/app.js                  generisch, liest das aktive Set
tools/build-geo-eu.mjs  tools/fetch-flaggen.mjs  tools/fetch-wikidata-eu.mjs  tools/check.mjs
tools/raw-eu/              Rohdaten Europa (heruntergeladen, versioniert)
tools/package.json         nur devDependencies
```
Schweizer Build-Skripte und `tools/raw/` bleiben unangetastet.

### 5.2 Datenset-Konfiguration (`js/sets.js`)
Pro Set: `id`, `titel`, `untertitel`, `ariaKarte`, `geo`, `stoff`, `bilder`, `themen(S)` (die heutige `themenBauen` wandert **wörtlich** in `SETS.ch.themen`), `toleranz`, `speicher: { fortschritt, stoff }`, `pflichtListen` (für die Stoff-Validierung) und `zoom`.

### 5.3 Speicher (Kollisionsschutz ohne Migration)
- CH: **weiterhin** `geomaster.fortschritt.v1` und `geomaster.stoff.v1` mit **unverändertem** Schlüsselformat `thema|stufe|key`.
- EU: **eigene** Schlüssel `geomaster.eu.fortschritt.v1` und `geomaster.eu.stoff.v1`.
- Damit kollidieren z. B. `hauptorte|1|BE` (Bern) und Belgien nicht, und es braucht keine Migration.
- Zuletzt gewähltes Set in `geomaster.set.v1` speichern, Standard ist `ch`.

### 5.4 Geometrie, Distanz, Toleranz Europa
- **Projektion:** Lambert Azimuthal Equal Area mit Zentrum 52° N / 10° E (entspricht EPSG:3035), im Build mit `d3.geoAzimuthalEqualArea().rotate([-10,-52])`. Den Ausschnitt so wählen, dass er Island, Nordkap, Ural (ca. 60° O), Zypern und Kreta enthält. In `geo-eu.js` werden `project`/`unproject` als **eigene, kleine Funktionen** ausgegeben (Kugel-LAEA, Vorwärts- und Umkehrformel, gleiche Konstanten wie im Build). Die Umkehrung im Build muss auf < 0.01° genau mit d3 übereinstimmen.
- Zusätzlich exportiert `geo-eu.js` `breiteKm`, die Kartenbreite in km entlang der Mittellinie.
- **Distanzen für EU** werden immer geografisch berechnet: Klick per `unproject` → lon/lat, Haversine. Bei Flächen und Linien den nächsten Punkt in SVG suchen, beide unprojizieren und die Haversine-Distanz rechnen. Für CH bleibt `KM_PRO_EINHEIT` aktiv, sodass das Verhalten identisch bleibt.
- **Toleranz EU (Stufe 3–4)**, relativ zur Kartenbreite `B = GEO_EU.breiteKm` (ca. 5000 km):
  - Punkt (Hauptstadt, Kleinstaat, Gipfel): `max(0.015·B, Fingerradius)`, also etwa 75 km
  - Fläche (Land, Gebirge): Klick im Polygon **oder** ≤ `0.005·B` (ca. 25 km) vom Rand
  - Fluss: ≤ `0.01·B` (ca. 50 km)
  - Fingerradius = **22 CSS-Pixel**, beim aktuellen Zoom in km umgerechnet, damit es auf dem Handy nie kleiner als der Finger ist.
- Stufe 1–2 bleibt bei «nächster Kandidat gewinnt». **Punktziele gewinnen vor Flächen**, wenn der Klick innerhalb ihres Fingerradius liegt. So schlägt Vatikanstadt nicht Italien, und San Marino ebenfalls nicht.
- Dass Wien und Bratislava (ca. 55 km) oder Rom und Vatikanstadt in Stufe 3–4 gegenseitig akzeptiert werden, ist **gewollt** («ungefähre Lage zählt»).
- **Kleinstaaten:** Ziel ist `{typ:'punkt'}` mit Koordinate der Hauptstadt bzw. des Zentrums, gezeichnet als Kreis. Auf Stufe 4 pulst der Punkt (wie heute in `zielMarkieren` für Punkte).
- **Textvergleich (`textPasst`):** Einen Tippfehler nicht verzeihen, wenn die Eingabe einem **anderen** Eintrag desselben Themas exakt oder mit gleicher Distanz entspricht. Beispiel: «Irland» darf nicht als «Island» gelten. Die Regel gilt für beide Sets. Für CH gibt es keine solchen Paare, deshalb muss Test T3 unverändert bestehen.

### 5.5 Oberfläche und Touch
- Startseite mit einem Umschalter **Schweiz | Europa** über der Themenliste. Untertitel («Blatt 1 : Schweiz» bzw. «Blatt 2 : Europa»), `<title>`, `aria-label` und Alt-Texte («Kantonswappen»/«Flagge») stammen aus dem Set.
- **Zoom/Pan** über die `viewBox`: Pinch mit 2 Pointern, Ziehen mit 1 Pointer, Mausrad und Knöpfe **+ / − / ⤢** (Zurücksetzen). `touch-action: none` auf `#karte`. Zoom auf 1×–8× begrenzen.
- Zoom ist für EU aktiv. Für CH ist Zoom ebenfalls aktiv (`zoom:true`), über `SETS.ch.zoom = false` aber abschaltbar.
- **Antwort erst bei Tap:** `pointerup`, wenn die Bewegung < 8 px und keine Pinch-Geste aktiv war (ersetzt `pointerdown`, Z. ~624). Nur die Primärtaste zählt.
- Beim Wechsel zur nächsten Frage den Zoom zurücksetzen.
- Strichstärken, Symbole und Schrift mit `vector-effect: non-scaling-stroke` bzw. mit 1/Zoom skalieren, damit sie beim Zoomen gleich gross bleiben.
- Auf Stufe 1 im EU-Set nur die Namen der aktuellen Kategorie anzeigen. `markenPlatzieren()` mit Radien in Abhängigkeit von der Schriftgrösse (nicht in fixen SVG-Einheiten).
- Layout bis 360 px Breite: Karte füllt die Breite, Antwortknöpfe sind mindestens 44 px hoch, das Tippfeld wird nicht von der Tastatur verdeckt (`scrollIntoView`).
- Quellenvermerk im Fuss der Startseite: «Karten: Natural Earth; Flaggen: flag-icons (MIT); Daten: Wikidata (CC0)». Den bestehenden CH-Vermerk (OSM ODbL, swisstopo/geoBoundaries) ebenfalls anzeigen.

## 6. Phasenplan

Jede Phase endet mit einem lauffähigen Stand. Wenn Git vorhanden ist, pro Phase ein Commit, sonst vor Phase 1 eine Sicherungskopie des Ordners anlegen.

**Phase 0: Sicherung und Baseline (≈ 0.5 h)**
- Ordnerkopie `C:\Apps\GeoMaster_backup_<datum>` anlegen, `git init`, Baseline-Commit.
- `tools/check.mjs` erzeugt mit Node (`vm`) aus den Original-Dateien einen **CH-Snapshot** `tools/baseline-ch.json`. Dieser enthält alle Themen mit `id`, `modus`, `kat`, allen Items (`key`, `name`, `alias`, `frage`, `frageAlt`, `ziel`, `beigabe`) und `textPasst`-Ergebnisse für alle Namen und Aliasse plus je eine Variante mit einem Tippfehler.
- Abnahme: Der Snapshot existiert. `node tools/check.mjs --ch` meldet «OK».

**Phase 1: Set-Abstraktion ohne neue Funktion (≈ 1 Tag)**
- `js/sets.js` anlegen, `themenBauen` 1:1 nach `SETS.ch` verschieben. `app.js` liest alles über das aktive Set (GEO, Stoff, Bilder, Toleranzen, Speicher, Texte). `index.html` bleibt optisch gleich.
- Abnahme: `check.mjs --ch` ist identisch mit der Baseline. `geo-ch.js`, `data-ch.js` und `wappen.js` sind byte-identisch (Hash prüfen). Ein bestehender CH-Fortschritt in `localStorage` wird unverändert angezeigt (T1).

**Phase 2: Zoom/Pan und Tap-Erkennung (≈ 0.5–1 Tag)**
- Umsetzung gemäss 5.5, zunächst auf der CH-Karte.
- Abnahme: T5–T7 auf Desktop und im DevTools-Gerätemodus (360×740). Kein versehentlicher Antwort-Klick beim Ziehen oder Pinchen. Ein CH-Quiz liefert dieselben Ergebnisse wie vorher.

**Phase 3: Build Europa-Geometrie (≈ 1–1.5 Tage)**
- `tools/build-geo-eu.mjs` gemäss 4 und 5.4 erzeugt `js/geo-eu.js` mit `countries[{iso,d,a}]`, `kleinstaaten[{iso,lon,lat}]`, `rivers[{name,d,a}]`, `ranges[{name,d,a}]`, `country` (Umriss aller Länder), Umgebung (Nachbarflächen in Grau, ohne Quiz), `project`, `unproject` und `breiteKm`.
- Länderliste und ISO-Zuordnung kommen aus `laender-europa.csv`. GEO, ARM, AZE und KAZ gehen nur in die graue Umgebung.
- Abnahme:
  - Datei ≤ 600 KB.
  - Jeder CSV-Eintrag hat eine Fläche oder einen Punkt.
  - Die Krim liegt in UA (Punkt-in-Polygon-Test 34.1° O / 45.0° N).
  - Svalbard und Französisch-Guayana sind nicht sichtbar.
  - Der Roundtrip `unproject(project(p))` weicht für 20 Testpunkte um < 0.01° ab.
  - Screenshot zur Sichtprüfung für Thomas.

**Phase 4: Lernstoff Europa (≈ 0.5–1 Tag)**
- `tools/fetch-wikidata-eu.mjs` holt die Koordinaten der Hauptstädte und Gipfel (einmalig, Rohdaten in `tools/raw-eu/`).
- Daraus `js/data-eu.js` erzeugen: `laender` (iso, name, alias, hauptstadt, hauptstadtAlias, kfz, kleinstaat), `hauptstaedte` (lon/lat), `fluesse`/`gebirge` (mit `geo`-Verweis), `gipfel` (lon/lat, Höhe).
- Abnahme: `check.mjs --eu` prüft:
  - Alle `geo`-Verweise sind vorhanden.
  - Alle lon/lat liegen innerhalb der Karte.
  - Jede Hauptstadt liegt im eigenen Land (Punkt-in-Polygon). Ausnahme: Kleinstaaten, dort ≤ 5 km.
  - Namen und Aliasse sind innerhalb eines Themas eindeutig.
  - Kein «ß» im Stoff.
  - Werte, die von der CSV abweichen, werden gemeldet.

**Phase 5: Flaggen (≈ 0.5 Tag)**
- `tools/fetch-flaggen.mjs` lädt die SVGs von flag-icons und erzeugt daraus `js/flaggen-eu.js`. Bei einem Fehler wird **nichts** geschrieben (anders als das heutige `fetch-wappen.mjs`, Z. ~77–87). `fileURLToPath` statt `URL.pathname` verwenden.
- Den MIT-Lizenztext als `LICENSES/flag-icons.txt` beilegen.
- Abnahme: Alle 47 Länder haben eine Flagge, die Dateigrösse ist plausibel (< 400 KB).

**Phase 6: Europa-Themen und Oberfläche (≈ 1–1.5 Tage)**
- `SETS.eu` mit den 7 Themen aus Abschnitt 2, Fragetexten mit Artikel («Wo fliesst **die** Donau?», «Wo liegt **der** Ural?»), Set-Umschalter, Kleinstaaten-Punkten, Toleranzen gemäss 5.4 und `textPasst`-Regel.
- Abnahme: T1–T12 bestehen.

**Phase 7: Abschluss (≈ 0.5 Tag)**
- README um Europa, Build-Befehle und Quellen ergänzen, Quellenvermerk in der App einbauen, Test auf echtem Tablet und Handy (Thomas).
- Abnahme: Checkliste vollständig abgehakt.

## 7. Testcheckliste

- **T1 CH-Fortschritt bleibt:** Vor dem Update in CH ein paar Runden spielen und den `localStorage`-Inhalt exportieren. Nach dem Update sind Skala und grüne Stufen identisch. Die Schlüssel `geomaster.fortschritt.v1`/`geomaster.stoff.v1` existieren unverändert.
- **T2 Keine Kollision (BE):** In EU «Länder» Stufe 1 Belgien 3× richtig beantworten. Danach ist in CH das Thema «Kantone» bzw. «Hauptorte» für Bern unverändert. Das Gleiche umgekehrt, und ebenso für FR, LU und GE.
- **T3 CH-Snapshot:** `node tools/check.mjs --ch` ist identisch mit `baseline-ch.json`.
- **T4 CH-Stoff-Editor:** Öffnen, speichern und zurücksetzen funktioniert wie bisher. Der EU-Stoff-Editor verwendet nur EU-Schlüssel.
- **T5 Offline:** Netzwerk getrennt und Start per `file://` in Chrome, Edge und Firefox. Der DevTools-Netzwerk-Tab zeigt nur `file://`, die Konsole bleibt ohne Fehler.
- **T6 Touch:** 360×740 und iPad-Hochformat. Pinch, Ziehen und ⤢ funktionieren, Ziehen löst keine Antwort aus, ein Tap auf Vatikanstadt bzw. Monaco bei Zoom 1× und 4× ist möglich.
- **T7 Responsive:** Kein horizontales Scrollen. Knöpfe sind mindestens 44 px hoch, das Tippfeld bleibt sichtbar.
- **T8 Toleranz EU:** Ein Klick 60 km neben Paris auf Stufe 3 ist richtig, 150 km daneben falsch. Ein Klick in Italien bei der Frage «Vatikanstadt» ist auf Stufe 1–2 nur dann richtig, wenn er nahe am Punkt liegt.
- **T9 Text:** «Irland» bei der Frage nach Island ist falsch. «Kyjiw» gilt für Kiew, «Belarus» für Weissrussland, «Moldau» für Moldawien.
- **T10 Kennzeichen:** Deutschland = «D», Grossbritannien = «UK», Nordmazedonien = «NMK», Kosovo = «RKS».
- **T11 Ausgeschlossene Länder:** Georgien, Armenien, Aserbaidschan und Kasachstan sind grau, ohne Namen und nicht klickbar. Sie erscheinen in keiner Frage, keiner Auswahl und keinem Stoff. `check.mjs --eu` meldet einen Fehler, falls GE, AM, AZ oder KZ im Stoff vorkommen.
- **T12 Stufe 4 EU:** Die markierten Länder, Flüsse, Gebirge und Kleinstaaten-Punkte sind gut sichtbar, und die Benennung funktioniert.

## 8. Offene Punkte

Es gibt keine offenen Entscheide zum Umfang mehr. Thomas bestätigt vor der Übergabe nur noch:
- Anhang A (Flüsse, Gebirge, Gipfel)
- die in `laender-europa.csv` unter `bemerkung` mit «bitte bestätigen/wählen» markierten Schreibweisen (Grossbritannien, Nordmazedonien, Chisinau/Kischinau)

## 9. Verbote (nicht tun)

- Keine Frameworks, keine Bundler, kein TypeScript, keine ES-Module im Browser, kein Service Worker als Pflicht.
- Keine CDN-, Font- oder Netzwerkzugriffe zur Laufzeit. Netzwerk nur in `tools/*` beim Bauen.
- Den CH-`localStorage` nicht umbenennen, nicht migrieren und das Schlüsselformat nicht ändern.
- `js/geo-ch.js`, `js/data-ch.js`, `js/wappen.js`, `tools/build-geo.mjs`, `tools/fetch-wappen.mjs` und `tools/raw/` nicht verändern.
- Die CH-Toleranz (15/8/5/0 km) und die CH-Fragen nicht «verbessern».
- Keine Daten erfinden: Werte nur aus der CSV, aus Wikidata oder Natural Earth. Abweichungen und Unsicherheiten im Abschlussbericht melden.
- GISCO und andere nicht-freie Quellen nicht verwenden.
- Kein «ß» in Texten oder im Stoff.
- Nicht ohne Freigabe über die aktuelle Phase hinausarbeiten.

---

## Anhang A: Flüsse, Gebirge, Gipfel (VORSCHLAG, BITTE BESTÄTIGEN)

> Thomas: Diese Listen bitte vor der Übergabe prüfen, streichen oder ergänzen. Höhen sind «ca.»-Werte, verbindlich ist Wikidata (Phase 4).

**Flüsse (15):** Wolga, Donau, Dnepr, Don, Rhein, Elbe, Weichsel, Oder, Loire, Seine, Rhone, Po, Tajo, Ebro, Themse
*Optional:* Ural, Duero, Garonne, Maas, Mosel, Save, Dnister, Düna (Daugava), Memel (Neman)

**Gebirge (10, als Flächen):** Alpen, Pyrenäen, Apennin, Karpaten, Skandinavisches Gebirge, Ural, Kaukasus (Fläche darf in die graue Umgebung reichen), Dinarisches Gebirge, Balkangebirge, Jura
*Optional:* Vogesen, Schwarzwald (in Natural Earth nicht als Range vorhanden, prüfen), Ardennen, Erzgebirge, Sudeten, Tatra, Kantabrisches Gebirge, Sierra Nevada, Pindos, Schottisches Hochland (Grampian Mountains)

**Gipfel (10, als Punkte):**
| Gipfel | Land | Höhe ca. |
|---|---|---|
| Elbrus | Russland | 5642 m |
| Mont Blanc | Frankreich/Italien | 4806 m |
| Zugspitze | Deutschland | 2962 m |
| Grossglockner | Österreich | 3798 m |
| Ätna | Italien | ca. 3300 m (veränderlich) |
| Vesuv | Italien | 1281 m |
| Olymp | Griechenland | 2918 m |
| Mulhacén | Spanien | 3479 m |
| Triglav | Slowenien | 2864 m |
| Ben Nevis | Grossbritannien | 1345 m |

*Optional:* Gerlsdorfer Spitze (Slowakei), Galdhøpiggen (Norwegen), Musala (Bulgarien), Kebnekaise (Schweden), Hvannadalshnúkur (Island)
