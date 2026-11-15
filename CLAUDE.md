# Personal Card Scanner via Claude

Private Riftbound-Sammlungs-App als PWA für Android und PC, zusätzlich als Android-APK (Capacitor). Maßgeblich ist [SPEC.md](SPEC.md); die Meilensteine werden der Reihe nach abgearbeitet. Oberfläche und alle Texte der App sind auf Deutsch.

## Stand

- **M0 Datenprüfung:** fertig, Ergebnis in [docs/m0-bericht.md](docs/m0-bericht.md).
- **M1 Gerüst und Sammlung:** gebaut; wartet auf die Prüfung durch den Nutzer (Handy, Import bei Piltover Archive).
- **M2 Preise:** gebaut; Abnahme offen (drei tägliche Läufe in Folge, zehn Stichproben aus `docs/m2-stichproben.md` durch den Nutzer).
- **M3 Erkennung:** vorbereitet (Fingerabdrücke, Umrisssuche, Abgleich, Prüfprogramme). Die Kartennummer wird gelesen (Tesseract). Mit 43 Fotos des Nutzers: 93,0 % richtige Karte vorn, kein falscher Selbstzähler ([docs/m3-fotos.md](docs/m3-fotos.md)); Ziel 95 % / 99 % noch nicht erreicht. Offen: Karten in Hüllen auf dunklem Untergrund, Geschwindigkeit auf dem Handy.
- **M4 Scan-Sitzung:** gebaut (Scan-Seite, Sitzungsliste, Übernahme). Offen: Test mit echter Kamera durch den Nutzer; die Schwellen in `src/scan/tracker.ts` sind geschätzt und nach seinen Rückmeldungen einzustellen.

Repository: https://github.com/Minusprivat/personal-card-scanner · Web-App: https://minusprivat.github.io/personal-card-scanner/ · APK: https://github.com/Minusprivat/personal-card-scanner/releases/download/apk/card-scanner.apk

## Befehle

| Zweck | Befehl |
| --- | --- |
| Abhängigkeiten installieren | `npm install` |
| App lokal starten | `npm run data:build` (einmal), dann `npm run dev` |
| App bauen | `npm run build` (für GitHub Pages mit `BASE_PATH=/personal-card-scanner/`) |
| Tests | `npm test` |
| Typprüfung | `npm run typecheck` |
| Katalog und Preise laden, M0-Bericht neu schreiben | `npm run data:report` |
| Katalog für die App schreiben (`public/data/`) | `npm run data:build` |
| Beides ohne Netz, aus `.cache/` | `npm run data:report:offline`, `npm run data:build:offline` |
| Stichproben für den Preisvergleich schreiben | `npm run data:samples` |
| App-Symbole neu erzeugen | `npm run icons` |
| Kartenbilder für die Entwicklung laden (einmalig, gedrosselt, nach `.cache/images/`) | `npm run data:images` |
| Fingerabdrücke für neue Katalogbilder berechnen | `npm run data:fingerprints` |
| Erkennung prüfen: verzerrte Katalogbilder | `npm run scan:selftest` |
| Erkennung prüfen: künstliche Szenen, ganze Kette | `npm run scan:scenes` |
| Erkennung prüfen: echte Fotos aus `testdata/photos/` (Abnahme M3) | `npm run scan:photos` |
| Gefundene Umrisse für einzelne Fotos einzeichnen (nach `.cache/debug/umrisse.jpg`) | `npx tsx scripts/scan/debug.ts 3,7,19` |
| Nummernlesen prüfen (braucht große Katalogbilder unter `.cache/full/`) | `npm run scan:numbers` |
| Dateien der Texterkennung nach `public/ocr/` kopieren (läuft vor `dev` und `build` von selbst) | `npm run ocr:copy` |

Deploy: Jeder Push auf `main` startet `.github/workflows/deploy.yml`: testen, Katalog und Preise laden, Web-App auf GitHub Pages, APK bauen und im Release `apk` ersetzen. Derselbe Workflow läuft täglich um 04:30 UTC und aktualisiert nur die Daten (keine neue APK). GitHub schaltet geplante Läufe ab, wenn 60 Tage lang nichts ins Repository kommt; dann unter Actions wieder einschalten.

Version: `0.1.<Zahl der Commits>`. Sie steht in der App unter „Sicherung“, in `data/version.json` und als `versionCode` der APK. `data/version.json` nennt außerdem unter `apk` die älteste APK, mit der die Version läuft (letzter Commit, der `android/`, `capacitor.config.ts` oder `package.json` berührt hat).

Selbst-Update der Android-App: Beim Start vergleicht sie die Versionsdatei, lädt `bundle/app-<Version>.zip` von GitHub Pages (derselbe Web-Teil wie in der APK) und nutzt ihn ab dem nächsten Öffnen. Ist die installierte APK älter als `apk`, zeigt sie stattdessen den Hinweis auf die neue APK. Startet ein nachgeladenes Paket nicht, nimmt der Baustein es nach zehn Sekunden von selbst zurück.

Die APK lässt sich lokal nicht bauen (kein Android SDK, nur Java 8 auf dem PC). `npx cap sync android` läuft lokal; den Gradle-Bau macht nur GitHub Actions. Nach Änderungen an `android/` deshalb den Workflow-Lauf abwarten und prüfen.

Commits in diesem Repository nutzen die GitHub-noreply-Adresse (lokale Git-Einstellung), weil das Repository öffentlich ist.

## Aufbau

- `src/data/` – Datenmodell und reine Logik, von App und Datenskript gemeinsam genutzt.
  - `model.ts`: Card, Print (Druck), Sku (Druck + Finish), `CatalogSource`.
  - `prints.ts`: fasst Skus zu Drucken zusammen.
  - `prices.ts`: Cardmarket Low je Finish, „kein Preis“ statt 0 €.
  - `catalog-index.ts`, `filter.ts`: Nachschlagetabellen, Suche und Filter.
  - `csv.ts`, `backup.ts`, `piltover.ts`: Sicherung (JSON), Tabelle (CSV), Piltover-Archive-Format.
- `src/scan/` – Kartenerkennung, von App und Prüfprogrammen gemeinsam genutzt.
  - `fingerprint.ts`: Bild-Fingerabdruck (Perceptual Hash über ganze Karte und Motiv). Bei Änderungen `FP_VERSION` erhöhen und alle Fingerabdrücke neu berechnen.
  - `matcher.ts`: sucht die ähnlichsten Katalogbilder.
  - `detect.ts`: Kartenumriss finden und entzerren; OpenCV wird hereingereicht.
  - `recognize.ts`: ganze Kette für ein Kamerabild.
  - `worker.ts`, `protocol.ts`: Erkennung im Web Worker (lädt OpenCV, rund 13 MB, erst beim Öffnen des Scanners).
  - `tracker.ts`: wann ein Treffer zählt (stabil über mehrere Bilder, keine Doppelzählung liegender Karten).
  - `candidates.ts`: übersetzt Treffer in Drucke, sortiert die Auswahl und wendet die gelesene Nummer an.
  - `ocr-guard.ts`: Zeitgrenzen für die Texterkennung; lädt oder antwortet sie nicht, läuft der Scanner ohne Nummer weiter.
  - `number.ts`: Lage der Nummernzeile, Aufbereitung für die Texterkennung, unscharfer Vergleich mit den Nummern der Kandidaten.
- `src/app/scan/` – Scan-Seite: Kamera (`useCamera.ts`), Worker-Anbindung (`useRecognizer.ts`), Texterkennung (`ocr.ts`), `ScanView.tsx`, `SessionList.tsx`.
- `public/ocr/` – Rechenkern und Sprachmodell der Texterkennung; entsteht durch `scripts/copy-ocr.mjs` aus `node_modules` und ist von Git ausgenommen.
- `scripts/scan/` – Prüfprogramme der Erkennung (laufen unter Node mit OpenCV.js und sharp).
- `data/fingerprints.json` – Fingerabdrücke aller Katalogbilder. Liegt im Repository, damit der tägliche Lauf nur neue Bilder abruft; nach `npm run data:fingerprints` mit einchecken.
- `src/app/` – React-Oberfläche. `db.ts` hält den Bestand in IndexedDB (Dexie).
  - `save.ts`: Speichern und Teilen je Umgebung (Android-App, PC-Browser, Handy-Browser).
  - `catalog-loader.ts`: lädt Katalog, Preise und Fingerabdrücke; die Android-App holt sie von GitHub Pages und merkt sie sich.
  - `updater.ts`: Selbst-Update der Android-App mit `@capgo/capacitor-updater` im Handbetrieb; die Entscheidung (nichts, Web-Teil nachladen, neue APK nötig) steht in `src/data/update.ts`.
- `android/` – Capacitor-Projekt. `app/debug.p12` ist der feste, bewusst öffentliche Signaturschlüssel; nicht ersetzen, sonst lassen sich Updates nur nach Deinstallation (Datenverlust) einspielen.
- `scripts/build-data/` – Node-Datenskript.
  - `sources/openrift.ts`: einzige Stelle, die das OpenRift-Format kennt.
  - `sources/cardmarket.ts`: Cardmarket-Preisdatei.
  - `http.ts`: Abruf mit User-Agent, Zwischenspeicher und ETag.
  - `stats.ts`, `report.ts`: Auswertung und M0-Bericht.
- `tests/` – Vitest. `m0-abnahme.test.ts` prüft gegen die Daten in `.cache/`; `collection.test.ts` prüft zusätzlich die echte Piltover-Datei unter `testdata/piltoverarchive/`. Fehlen die lokalen Daten, werden diese Tests übersprungen.
- `testdata/piltoverarchive/` – echte Sammlungsdateien des Nutzers. Von Git ausgenommen, niemals einchecken.
- `testdata/photos/` – Testfotos des Nutzers samt `labels.json` (Foto → aufgedruckte Nummer, von Hand geprüft). Von Git ausgenommen, niemals einchecken; neue Fotos dort eintragen.
- `docs/` – erzeugte Berichte. Nicht von Hand ändern.

## Regeln

- Die Katalogquelle bleibt austauschbar: Außerhalb von `scripts/build-data/sources/` kennt kein Code das OpenRift-Format.
- Fremde Schnittstellen sparsam abrufen: Katalog und Preise höchstens einmal pro Stunde (`http.ts` erzwingt das), Bilder nur für neue Drucke und gedrosselt.
- Keine Kartenbilder im Repository, nur daraus berechnete Fingerabdrücke. `.cache/images/` ist ein Entwicklungs-Zwischenspeicher auf dem PC und wird nach Abschluss von M3 gelöscht.
- Der eingebaute Browser gibt keine Kamera frei. Die Scan-Seite dort über „Foto wählen“ prüfen; Testbilder nur vorübergehend unter `public/` ablegen und vor dem Commit löschen.
- Die Nummer darf einen unsicheren Bildtreffer nur bestätigen, wenn sie fehlerfrei gelesen wurde (`allowedErrors` in `candidates.ts`); Nachbarkarten im Set unterscheiden sich oft nur in einer Ziffer.
- Eine falsche Karte von selbst zu zählen ist der schlimmste Fehler des Scanners. Änderungen an Erkennung oder Schwellen nur behalten, wenn `npm run scan:photos` weiterhin „von selbst gezählt, falsche Karte: 0“ meldet.
- Erkennung nicht an künstlichen Tests feinschleifen: Maßgeblich sind die echten Fotos unter `testdata/photos/`.
- Piltover Archive nicht automatisch abrufen (Nutzungsbedingungen untersagen Scraping); das Format stammt allein aus den Dateien des Nutzers.
- Preise kommen nur aus der Cardmarket-Preisdatei, nicht aus OpenRifts `/api/v1/prices` (enthält Platzhalter).
- Bestand und Preis hängen an der Sku. Es gibt vier Finishes: Normal, Foil, Metal, Metal Deluxe. Metal hat keinen Cardmarket-Preis.
- Keine `.gz`-Dateien unter `public/`: Der Android-Bau packt sie aus und benennt sie um, die App findet sie in der APK dann nicht (so fiel das Nummernlesen bis Version 0.1.9 in der APK aus). Der Workflow prüft nach dem Bau, dass jede Datei aus `dist/` unverändert in der APK liegt.
- Der Scanner wartet nie unbegrenzt auf die Texterkennung; ein sicherer Bildtreffer zählt auch ohne gelesene Nummer.
- Der Update-Baustein bleibt im Handbetrieb (`autoUpdate: false`, `statsUrl: ''` in `capacitor.config.ts`): Er darf nur GitHub Pages ansprechen, nie die Server seines Herstellers.
- Änderungen an `android/`, `capacitor.config.ts` oder `package.json` verlangen vom Nutzer eine neue APK von Hand. Solche Änderungen deshalb sammeln und im Abschlussbericht ausdrücklich nennen.
- Web-App und APK müssen beide funktionieren: Plattform-Unterschiede gehören hinter `isNativeApp()` in `save.ts` oder `catalog-loader.ts`.
- Stimmt eine Annahme der SPEC nicht: anhalten, Abweichung mit Vorschlag nennen, dann weiterbauen.
- Jeder Meilenstein endet mit Tests für die Abnahmekriterien und einer Prüfanleitung fürs Handy; danach auf Freigabe warten.
