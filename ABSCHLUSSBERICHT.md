# Abschlussbericht: GeoMaster um Europa erweitert

Stand: 26.10.2026. Grundlage: `geomaster-handoff/geomaster-handoff/AUFTRAG-EUROPA.md`.
Die Arbeit lief Phase für Phase mit Freigabe nach jeder Phase. Jede Phase ist ein
eigener git-Commit; die Sicherung des Originals liegt in
`C:\Apps\GeoMaster_backup_20261026`.

## Ergebnis in Kürze

- Auf der Startseite gibt es den Umschalter **Schweiz | Europa**.
- **Europa** umfasst 7 Themen mit je 4 Stufen: 47 Länder, Hauptstädte, Flaggen, Kennzeichen, 15 Flüsse, 10 Gebirge und 10 Gipfel.
- Die **Schweiz** ist unverändert:
  - Der Browser-Vergleich mit der Sicherungskopie ist identisch, geprüft mit 144 Quiz-Zügen und dem Stoff-Editor.
  - `geo-ch.js`, `data-ch.js` und `wappen.js` sind byte-identisch.
  - Speicher-Schlüssel und CH-Toleranzen sind gleich geblieben.
- **Zoom, Verschieben und Pinch** funktionieren in beiden Sets. Eine Antwort zählt erst beim Tipp, Ziehen und Pinchen lösen keine aus.
- Die App läuft weiterhin offline per Doppelklick. Alles liegt in `js/`, zusammen 1.9 MB.

## Testcheckliste

| Test | Stand | Wie geprüft |
|---|---|---|
| T1 CH-Fortschritt bleibt | automatisch ✓, **von Hand offen** | Browser-Vergleich mit vorbelegtem Fortschritt; mit deinem echten Browser-Speicher noch prüfen |
| T2 keine Kollision (BE, FR, LU, GE) | ✓ | `tools/browser/europa.mjs`, in beide Richtungen |
| T3 CH-Snapshot | ✓ | `node tools/check.mjs --ch` |
| T4 Stoff-Editor | ✓ | CH: Browser-Vergleich; EU: nur `geomaster.eu.stoff.v1` (europa.mjs) |
| T5 offline | Chrome ✓, **Edge/Firefox von Hand offen** | nur `file://`/`data:` geladen, keine Konsolenfehler |
| T6 Touch | ✓ in Chrome-Emulation, **echtes Gerät offen** | Pinch, Ziehen, ⤢; Tipp auf Vatikanstadt und Monaco bei 1× und 4× (Handy, iPad) |
| T7 Responsive | ✓ | 360×740 und iPad: kein horizontales Scrollen, Knöpfe ≥ 44 px, Tippfeld sichtbar |
| T8 Toleranz EU | ✓ | 60 km neben Paris richtig, 150 km falsch (Desktop); Mailand ≠ Vatikanstadt |
| T9 Text | ✓ | Irland ≠ Island; Kyjiw, Belarus, Moldau gelten |
| T10 Kennzeichen | ✓ | D, UK, NMK, RKS |
| T11 ausgeschlossene Länder | ✓ | grau, ohne Namen, in keiner Frage/Auswahl/Stoff; `check.mjs --eu` meldet sie |
| T12 Stufe 4 EU | ✓ | Land, Kleinstaat, Fluss, Gebirge, Gipfel markiert und benennbar |

Die Prüfbefehle stehen im README unter «Prüfen».

## Entscheide während der Umsetzung (von Thomas)

- **Anhang A:** Vorerst gelten nur die Hauptlisten mit 15 Flüssen, 10 Gebirgen und 10 Gipfeln. Weitere Einträge folgen anhand der Lernstoff-Liste. Die Geometrie der optionalen Flüsse und Gebirge ist schon gebaut.
- **Schreibweisen:** Beide Formen gelten als richtig. Angezeigt werden Grossbritannien, Nordmazedonien und Chisinau; Vereinigtes Königreich, Mazedonien und Kischinau gelten als Alias.
- **Karte:**
  - Azoren, Madeira und Kanaren sind nicht auf der Karte, ebenso Jan Mayen.
  - Zypern ist eine ganze Insel; Akrotiri und Dhekelia gehören dazu.
  - Die Seen sind ergänzt.
- **Flaggen:** Alle bleiben SVG, auch wenn die Datei damit 489 KB statt der geplanten < 400 KB gross ist.

## Abweichungen vom Auftrag

1. **`topojson` statt `mapshaper`** zum Vereinfachen. Gemeinsame Grenzen werden so nur einmal vereinfacht, und zwischen Nachbarländern entstehen keine Lücken. Alle Pakete stehen unter ISC-Lizenz.
2. **Hauptstadt im eigenen Land:** Lissabon liegt 0.1 km ausserhalb der vereinfachten Küstenlinie Portugals. Die Prüfung erlaubt für Hauptstädte bis 2 km und meldet das als Hinweis.
3. **`flaggen-eu.js` ist 489 KB gross** statt < 400 KB, wie oben entschieden.
4. **Vatikanstadt** hat keine Fläche, sie ist zum Vereinfachen zu klein. Sie existiert als Punkt, und das genügt laut Abnahme («Fläche oder Punkt»).
5. **Gebirge** werden nur im Thema «Gebirge» auf Stufe 1–2 eingezeichnet. In anderen Themen verdecken sie die Karte, auf der Blanko-Karte würden sie die Lösung verraten.
6. **Zusätzliche Dateien,** die im Auftrag nicht aufgeführt sind:
   - `tools/build-data-eu.mjs` (Stoff offline erzeugen) und `tools/stoff-eu.mjs` (von Hand gepflegte Listen)
   - `tools/lib/laender.mjs` (CSV-Leser)
   - `tools/vorschau-eu.html` (Sichtprüfung der Karte)
   - `tools/browser/*` (Browser-Tests)
   - `tools/laender-europa.csv` (Kopie der Länderliste im Projekt)

## Unsicherheiten und Hinweise

- **Gipfelhöhen** (Wikidata):
  - Mont Blanc 4806 m (Messung 2023), Ätna 3357 m (2021, veränderlich), Ben Nevis 1345 m (1344.5 m gerundet).
  - Für den Olymp habe ich den Eintrag «Berg Olymp» genommen (2918 m). Der höchste Gipfel Mýtikas ist gleich hoch und liegt weniger als 1 km entfernt.
- **Kachowka-Stausee:** Er fehlt absichtlich. Natural Earth (Stand 2022) zeigt ihn noch, seit 2023 ist er leer.
- **Aliasse** für Flüsse, Gebirge und Gipfel habe ich in der Landessprache ergänzt, zum Beispiel Wisła, Odra, Rhône, Tejo, Thames, Dnipro, Monte Bianco und Etna. Bitte in `tools/stoff-eu.mjs` streichen, was nicht gelten soll.
- **Fingerradius:** Auf dem Handy ist die Punkt-Toleranz bei 1× sehr grosszügig, etwa 340 km, weil die Karte nur rund 334 px breit ist. Mit Zoom wird sie kleiner, bei 4× sind es etwa 85 km. So verlangt es die Regel «nie kleiner als der Finger».
- **Kleinstaaten auf Stufe 1–2:** Am Desktop wählt ein Klick näher als etwa 115 km an Rom die Vatikanstadt statt Italien. Mit Zoom lässt sich Italien gezielt treffen.
- **Grammatik:** «Hauptstadt von der Schweiz» ist korrekt, aber eher umgangssprachlich. Auf Wunsch stelle ich auf den Genitiv um («Hauptstadt der Schweiz»).
- **Punktsymbole** sind auf dem Handy bei 1× sehr klein, wie schon vorher in der Schweiz. Getroffen werden sie dank Fingerradius trotzdem.
- **Kleinstaaten-Punkte:** Ihre Koordinaten stammen aus dem Labelpunkt von Natural Earth, nicht von der Hauptstadt. Laut Entscheid nicht wichtig.

## Noch von Hand zu testen

- T1 mit deinem echten Browser-Speicher: CH-Fortschritt vorher exportieren und nachher vergleichen.
- T5 in Edge und Firefox: per `file://`, Konsole offen.
- T6 auf einem echten Tablet und Handy: Pinch, Ziehen, Tipp auf Vatikanstadt und Monaco.
