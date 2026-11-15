# Personal Card Scanner via Claude

Private Riftbound-Sammlungs-App als PWA für Android und PC, zusätzlich als Android-APK (Capacitor). Maßgeblich ist [SPEC.md](SPEC.md); die Meilensteine werden der Reihe nach abgearbeitet. Oberfläche und alle Texte der App sind auf Deutsch.

## Stand

- **M0 Datenprüfung:** fertig, Ergebnis in [docs/m0-bericht.md](docs/m0-bericht.md).
- **M1 Gerüst und Sammlung:** gebaut; wartet auf die Prüfung durch den Nutzer (Handy, Import bei Piltover Archive).
- **M2 Preise:** gebaut; Abnahme offen (drei tägliche Läufe in Folge, zehn Stichproben aus `docs/m2-stichproben.md` durch den Nutzer).
- **M3 Erkennung:** offen; braucht die Testfotos des Nutzers.

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

Deploy: Jeder Push auf `main` startet `.github/workflows/deploy.yml`: testen, Katalog und Preise laden, Web-App auf GitHub Pages, APK bauen und im Release `apk` ersetzen. Derselbe Workflow läuft täglich um 04:30 UTC und aktualisiert nur die Daten (keine neue APK). GitHub schaltet geplante Läufe ab, wenn 60 Tage lang nichts ins Repository kommt; dann unter Actions wieder einschalten.

Version: `0.1.<Zahl der Commits>`. Sie steht in der App unter „Sicherung“, in `data/version.json` und als `versionCode` der APK. Die Android-App vergleicht sie und zeigt einen Update-Hinweis.

Die APK lässt sich lokal nicht bauen (kein Android SDK, nur Java 8 auf dem PC). `npx cap sync android` läuft lokal; den Gradle-Bau macht nur GitHub Actions. Nach Änderungen an `android/` deshalb den Workflow-Lauf abwarten und prüfen.

Commits in diesem Repository nutzen die GitHub-noreply-Adresse (lokale Git-Einstellung), weil das Repository öffentlich ist.

## Aufbau

- `src/data/` – Datenmodell und reine Logik, von App und Datenskript gemeinsam genutzt.
  - `model.ts`: Card, Print (Druck), Sku (Druck + Finish), `CatalogSource`.
  - `prints.ts`: fasst Skus zu Drucken zusammen.
  - `prices.ts`: Cardmarket Low je Finish, „kein Preis“ statt 0 €.
  - `catalog-index.ts`, `filter.ts`: Nachschlagetabellen, Suche und Filter.
  - `csv.ts`, `backup.ts`, `piltover.ts`: Sicherung (JSON), Tabelle (CSV), Piltover-Archive-Format.
- `src/app/` – React-Oberfläche. `db.ts` hält den Bestand in IndexedDB (Dexie).
  - `save.ts`: Speichern und Teilen je Umgebung (Android-App, PC-Browser, Handy-Browser).
  - `catalog-loader.ts`: lädt Katalog, Preise und Versionsdatei; die Android-App holt sie von GitHub Pages und merkt sie sich.
- `android/` – Capacitor-Projekt. `app/debug.p12` ist der feste, bewusst öffentliche Signaturschlüssel; nicht ersetzen, sonst lassen sich Updates nur nach Deinstallation (Datenverlust) einspielen.
- `scripts/build-data/` – Node-Datenskript.
  - `sources/openrift.ts`: einzige Stelle, die das OpenRift-Format kennt.
  - `sources/cardmarket.ts`: Cardmarket-Preisdatei.
  - `http.ts`: Abruf mit User-Agent, Zwischenspeicher und ETag.
  - `stats.ts`, `report.ts`: Auswertung und M0-Bericht.
- `tests/` – Vitest. `m0-abnahme.test.ts` prüft gegen die Daten in `.cache/`; `collection.test.ts` prüft zusätzlich die echte Piltover-Datei unter `testdata/piltoverarchive/`. Fehlen die lokalen Daten, werden diese Tests übersprungen.
- `testdata/piltoverarchive/` – echte Sammlungsdateien des Nutzers. Von Git ausgenommen, niemals einchecken.
- `docs/` – erzeugte Berichte. Nicht von Hand ändern.

## Regeln

- Die Katalogquelle bleibt austauschbar: Außerhalb von `scripts/build-data/sources/` kennt kein Code das OpenRift-Format.
- Fremde Schnittstellen sparsam abrufen: Katalog und Preise höchstens einmal pro Stunde (`http.ts` erzwingt das), Bilder nur für neue Drucke und gedrosselt.
- Keine Kartenbilder im Repository, nur daraus berechnete Fingerabdrücke.
- Piltover Archive nicht automatisch abrufen (Nutzungsbedingungen untersagen Scraping); das Format stammt allein aus den Dateien des Nutzers.
- Preise kommen nur aus der Cardmarket-Preisdatei, nicht aus OpenRifts `/api/v1/prices` (enthält Platzhalter).
- Bestand und Preis hängen an der Sku. Es gibt vier Finishes: Normal, Foil, Metal, Metal Deluxe. Metal hat keinen Cardmarket-Preis.
- Web-App und APK müssen beide funktionieren: Plattform-Unterschiede gehören hinter `isNativeApp()` in `save.ts` oder `catalog-loader.ts`.
- Stimmt eine Annahme der SPEC nicht: anhalten, Abweichung mit Vorschlag nennen, dann weiterbauen.
- Jeder Meilenstein endet mit Tests für die Abnahmekriterien und einer Prüfanleitung fürs Handy; danach auf Freigabe warten.
