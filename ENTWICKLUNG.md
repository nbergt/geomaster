# Weiterentwicklung auf GitHub

Stand: 13.11.2026. Repository: https://github.com/nbergt/geomaster

## Einstieg für Claude

1. Repository klonen und `CLAUDE.md` lesen. Der nächste Benutzerauftrag bestimmt die Arbeit.
2. Für Änderungen einen Branch vom aktuellen `main` anlegen.
3. Node.js ab Version 22 verwenden. Für Generatoren `npm ci --prefix tools` im Repository-Wurzelverzeichnis ausführen.
4. Vor und nach Änderungen `node tools/check.mjs --ch --eu` ausführen. Bei Änderungen der Oberfläche kommen die in `CLAUDE.md` genannten Browser-Prüfungen dazu.
5. Änderungen als Pull Request gegen `main` bereitstellen, sofern der Benutzer nichts anderes beauftragt. Prüfergebnisse und offene Punkte berichten.

Die App selbst braucht keinen Build und keine Pakete. `index.html` lässt sich
direkt öffnen; HTML, CSS und die Dateien unter `js/` sind die Laufzeitdateien.
Die Generatoren verwenden ihre Pakete aus `tools/node_modules/`.

## Enthaltene Entwicklungsunterlagen

- `CLAUDE.md`: aktuelle Projektregeln, Schutz des Schweizer Modus und Prüfungen.
- `README.md`: Bedienung, Architektur, Datenquellen und Generatorbefehle.
- `tools/`: Prüfungen, Browser-Tests, Generatoren, gepflegte Europa-Listen und Rohdaten für Schweiz und Europa.
- `ABSCHLUSSBERICHT.md`: Ergebnis, Entscheidungen und noch offene manuelle Tests der Europa-Erweiterung vom 26.10.2026.
- `geomaster-handoff/geomaster-handoff/`: ursprünglicher Auftrag, Review und Länderliste als historische Referenz. Die massgebliche Liste für neue Generierungen ist `tools/laender-europa.csv`.

Die beiden ursprünglichen Arbeitsblatt-Fotos bleiben lokal und wurden nicht in
das öffentliche Repository übernommen. Die daraus erfassten Lerndaten sind enthalten.

## Lernstoff aus Fotos (Filter)

Der Benutzer gibt Fotos der Lernkontrolle bzw. der Lernziele. Daraus:

1. Fehlende Einträge in `tools/stoff-eu.mjs` ergänzen (Geometrie in
   `tools/build-geo-eu.mjs`, Koordinaten über Wikidata), dann die Generatoren
   in der Reihenfolge aus dem README laufen lassen.
2. Eine Vorlage in `FILTER` (`tools/stoff-eu.mjs`) anlegen: je Thema `"alle"`
   oder die Liste der markierten Einträge. `build-data-eu.mjs` und
   `check.mjs --eu` melden Einträge, die zu nichts passen.
3. Was auf den Fotos unsicher ist (unleserlich, nicht markiert, nicht in den
   Quellen), im Bericht nennen.

## Netzwerk in Claude Code im Web

Die Umgebung braucht für die Abrufe die Hosts `query.wikidata.org`,
`www.wikidata.org` und `geodata.ucdavis.edu` (WorldClim). Node.js nutzt den
Proxy nur mit `NODE_USE_ENV_PROXY=1`. Chrome für die Browser-Prüfungen läuft
dort als Root nur mit `--no-sandbox`; dafür ein kleines Startskript als `CHROME`
angeben, das Chromium mit diesem Schalter aufruft.

## Browser-Prüfungen

Die Tests verwenden installiertes Chrome im Headless-Modus und Node.js ab Version
22. Auf Windows ist der übliche Chrome-Pfad voreingestellt. Auf anderen Systemen
oder bei abweichender Installation `CHROME` auf die Chrome-Programmdatei setzen.
Alle Befehle vom Repository-Wurzelverzeichnis ausführen.

Für `tools/browser/vergleich.mjs` wird zusätzlich ein unveränderter Basis-Checkout
benötigt. Die früher verwendete lokale Sicherung unter `C:/Apps/` ist auf GitHub
nicht verfügbar. Fehlende Browser-Prüfungen ausdrücklich als nicht ausgeführt melden.

## Veröffentlichung und bisherige lokale Ordner

Seit 13.11.2026 veröffentlicht der Workflow `.github/workflows/pages.yml`:
Bei jedem Push auf `main` (oder von Hand unter *Actions → Pages → Run
workflow*) laufen `check.mjs --ch --eu`, `gesten.mjs` und `europa.mjs`; nur
wenn alles besteht, gehen `index.html`, `css/`, `js/` und `LICENSES/` auf
GitHub Pages. Pull Requests gegen `main` werden gleich geprüft, zusätzlich mit
dem CH-Browser-Vergleich gegen `main`, aber nicht veröffentlicht. Dafür muss
unter *Settings → Pages → Build and deployment → Source* «GitHub Actions»
gewählt sein.

Die bestehende GitHub-Pages-Bereitstellung veröffentlicht die App unter
https://nbergt.github.io/geomaster/. In dieser Übergabe bleiben die App-Dateien
unverändert. Entwicklungsdateien allein erfordern keinen App-Build.

Vor dieser Übergabe waren Entwicklung und Veröffentlichung getrennt:

- `C:/Apps/GeoMaster`: vollständiges Entwicklungsprojekt ohne GitHub-Remote; Stand `37bd693`.
- `C:/Apps/GeoMaster-web`: lokale Veröffentlichungskopie mit Remote auf dieses Repository; Stand vor der Übergabe `da0289e`.

Die drei Bereiche wurden am 13.11.2026 geprüft: Alle elf App- und Lizenzdateien
waren zwischen Entwicklungsprojekt, Veröffentlichungskopie, GitHub `da0289e`
und Live-Seite bytegleich. `node tools/check.mjs --ch --eu` bestand.

`tools/veroeffentlichen.mjs` bleibt als historisches Werkzeug enthalten. Es kopiert
App-Dateien aus dem alten lokalen Entwicklungsprojekt in die Veröffentlichungskopie
und pusht sie. Für die Weiterentwicklung auf GitHub dieses Skript nicht verwenden:
Die alten lokalen Ordner werden durch neue GitHub-Änderungen nicht automatisch
aktualisiert. Vor einer späteren lokalen Arbeit einen aktuellen GitHub-Checkout
verwenden, damit alte App-Dateien keine neueren Änderungen überschreiben.
