# GeoMaster: Projektregeln für Claude Code

- Dieser Ordner archiviert den abgeschlossenen Europa-Auftrag vom 26.10.2026. Massgeblich sind der aktuelle Benutzerauftrag und die `CLAUDE.md` im Repository-Wurzelverzeichnis. Die alten Phasenfreigaben begrenzen keine neuen Aufträge.
- Die App ist Vanilla HTML/CSS/JS, gestartet per Doppelklick (`file://`). Klassische `<script>`-Tags mit Globals, **keine** ES-Module, Frameworks, Bundler oder TypeScript im Browser.
- Zur Laufzeit gibt es keine Netzwerkzugriffe (kein CDN, keine Webfonts). Netzwerk ist nur in `tools/*` beim Bauen erlaubt, mit devDependencies in `tools/package.json`.
- Der Schweizer Modus ist tabu, er wird nur über die Set-Abstraktion eingebunden:
  - `js/geo-ch.js`, `js/data-ch.js`, `js/wappen.js`, `tools/build-geo.mjs`, `tools/fetch-wappen.mjs` und `tools/raw/` nicht ändern.
  - Die `localStorage`-Schlüssel `geomaster.fortschritt.v1` und `geomaster.stoff.v1` und das Format `thema|stufe|key` bleiben unverändert.
  - Die CH-Toleranzen (15/8/5/0 km) bleiben.
- Das Europa-Set bekommt eigene Speicher-Schlüssel (`geomaster.eu.*`).
- Georgien, Armenien, Aserbaidschan und Kasachstan sind ausgeschlossen: nur graue Umgebung auf der Karte, nicht klickbar, nicht im Stoff.
- Sprache der Oberfläche und Daten ist Deutsch (Schweiz): kein «ß», traditionelle deutsche Ländernamen, offizielle bzw. moderne Formen als Alias.
- Keine Daten erfinden. Quellen sind nur `laender-europa.csv`, Natural Earth (`_deu`-Variante), Wikidata und flag-icons. Unsicheres im Bericht melden.
- Vor jedem Abschluss einer Phase `node tools/check.mjs --ch` (Regression gegen `tools/baseline-ch.json`) und ab Phase 4 `--eu` ausführen und die Ergebnisse berichten.
- Generierte Dateien tragen den Kopf «AUTOGENERIERT … nicht von Hand ändern». Generatoren schreiben bei Fehlern **nichts**.
- Kommentare und Bezeichner im bestehenden Stil (deutsch) halten.
