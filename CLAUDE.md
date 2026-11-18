# Personal Card Scanner via Claude

Private Riftbound-Sammlungs-App als PWA für Android und PC, zusätzlich als Android-APK (Capacitor). Maßgeblich ist [SPEC.md](SPEC.md); die Meilensteine werden der Reihe nach abgearbeitet. Oberfläche und alle Texte der App sind auf Deutsch.

## Stand

- **M0 Datenprüfung:** fertig, Ergebnis in [docs/m0-bericht.md](docs/m0-bericht.md).
- **M1 Gerüst und Sammlung:** gebaut; wartet auf die Prüfung durch den Nutzer (Handy, Import bei Piltover Archive).
- **M2 Preise:** gebaut; Abnahme offen (drei tägliche Läufe in Folge, zehn Stichproben aus `docs/m2-stichproben.md` durch den Nutzer).
- **M3 Erkennung:** vorbereitet (Fingerabdrücke, Umrisssuche, Abgleich, Prüfprogramme). Die Kartennummer wird gelesen (Tesseract). Mit 43 Fotos des Nutzers: 93,0 % richtige Karte vorn, kein falscher Selbstzähler ([docs/m3-fotos.md](docs/m3-fotos.md)); Ziel 95 % / 99 % noch nicht erreicht. Offen: Karten in Hüllen auf dunklem Untergrund, Geschwindigkeit auf dem Handy.
- **M4 Scan-Sitzung:** gebaut (Scan-Seite, Sitzungsliste, Übernahme). Offen: Test mit echter Kamera durch den Nutzer; die Schwellen in `src/scan/tracker.ts` sind geschätzt und nach seinen Rückmeldungen einzustellen.
- **Wünsche vom 17.11.2026:** gebaut: automatische Sicherung, Knopf „Nach Updates suchen“, Cardmarket-Link im Scanner, Filter mit Mehrfachauswahl, Suche im Kartentext. Im Browser geprüft; offen ist die Prüfung auf dem Handy, vor allem der automatischen Sicherung und des Wiederherstellens (laufen nur in der Android-App). Der Foil-Filter im Cardmarket-Link (`isFoil=Y`) ist nicht an der echten Seite geprüft.
- **Punktezähler:** gebaut (1 gegen 1 bis 8, Conquer/Hold), dazu Zeitlimit mit Overtime und Expertenmodus (wer beginnt, „Pass turn“, Zugnummer, History). Im Browser geprüft; offen: Prüfung auf dem Handy (Bildschirm bleibt an, Vibration, Bedienung zu zweit).
- **Seite „Spielerdaten“ (17.11.2026):** Events bei Riot und BoundRift-Profil als Browser-Fenster in der App. Der Punktezähler hat seit dem 18.11.2026 wieder einen eigenen Menüpunkt; die Kopfzeile hat damit fünf Einträge und zeigt auf schmalen Bildschirmen kurze Namen („Spieler“, „Punkte“). Braucht den Baustein `@capacitor/browser`, also eine APK ab dieser Version. Offen: Prüfung auf dem Handy (öffnet sich das Fenster über der App, ist man dort bei Riot angemeldet).
- **Gestaltung (18.11.2026):** Hextech-Stil nach einem vom Nutzer freigegebenen Entwurf: Nachtblau, Gold, Türkis, Pergament; angelehnt an League of Legends und Legends of Runeterra, ohne deren Schriften, Logos oder Grafiken. Offen: Eindruck auf dem Handy.
- **Prüfliste (18.11.2026):** [PRUEFLISTE.md](PRUEFLISTE.md) fasst alle offenen Prüfungen auf dem Handy in einer Sitzung zusammen. Bei neuen offenen Prüfungen dort ergänzen.
- **Sammlung leer nach Update (gemeldet 18.11.2026):** Im Code löscht bei einem Update nichts die Sammlung (Adresse der App, Signatur und Versionsnummer geprüft). Wahrscheinliche Ursache war die Deinstallation vor einer neuen APK; vom Nutzer nicht bestätigt, Teil 1 der Prüfliste klärt es. Seitdem: Hinweis auf den Sicherungsordner bei leerer Sammlung, und der APK-Hinweis sagt „nicht deinstallieren“. Offen: Anzeige des Hinweises auf dem Handy.
- **Nur Hochformat auf dem Handy (18.11.2026):** `android:screenOrientation="portrait"` in `AndroidManifest.xml` und `orientation: 'portrait'` im Web-Manifest (`vite.config.ts`). Braucht eine APK ab dieser Version. Die Anordnung nebeneinander im Punktezähler gibt es damit nur noch am PC. Offen: Prüfung auf dem Handy.
- **Selbst-Update:** ab 0.1.15 repariert (Hänger beim Laden des Bausteins, Prüfsumme). Vom Nutzer am 17.11.2026 auf dem Handy bestätigt: Die Version wechselt von selbst.
- **Sammlung nach Karten:** Die Übersicht zeigt eine Kachel je Karte mit dem Bestand je Art (Normal, Foil, Promo, Metal); die Kartenansicht nennt die Herkunft jeder Sonderausgabe. Für rund 200 Cardmarket-Produkte liefert OpenRift noch keine Verknüpfung. Das Datenskript ordnet davon selbst zu, was eindeutig ist (Stand 17.11.2026: 39, darunter K/DA Couture und Worlds 2026 Bundle; Bericht in `docs/cardmarket-zuordnung.md`). Offen bleiben die Metal-Karten (116 Produkte, je Legende zwei gleichnamige, nicht unterscheidbar) und rund 15 Karten, die im Katalog ganz fehlen (z. B. Lillia, Fae Fawn als Promo); beides löst sich erst, wenn OpenRift nachzieht.

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
| Bericht über die eigene Cardmarket-Zuordnung schreiben (`docs/cardmarket-zuordnung.md`) | `npx tsx scripts/build-data/index.ts match` (bewusst ohne Eintrag in `package.json`, siehe Regeln) |
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

Selbst-Update der Android-App: Beim Start vergleicht sie die Versionsdatei, lädt `bundle/app-<Version>.zip` von GitHub Pages (derselbe Web-Teil wie in der APK) und nutzt ihn ab dem nächsten Öffnen. Der Update-Baustein lädt nur mit Prüfsumme: Die veröffentlichte `data/version.json` nennt unter `sha256` die SHA-256 des Pakets, die App reicht sie beim Laden mit. Bis Version 0.1.14 hat das Selbst-Update nie funktioniert, aus zwei Gründen: Die Prüfung blieb beim Laden des Update-Bausteins für immer hängen (ein Capacitor-Baustein darf nie direkt aus einer async-Funktion zurückgegeben oder mit `await` erwartet werden, weil er auch auf `then` mit einer Funktion antwortet), und bis 0.1.13 fehlte die Prüfsumme. Solche APKs brauchen einmal eine neue APK von Hand; `apk` ist deshalb mindestens 15. Ist die installierte APK älter als `apk`, zeigt sie stattdessen den Hinweis auf die neue APK. Startet ein nachgeladenes Paket nicht, nimmt der Baustein es nach zehn Sekunden von selbst zurück.

Die APK lässt sich lokal nicht bauen (kein Android SDK, nur Java 8 auf dem PC). `npx cap sync android` läuft lokal; den Gradle-Bau macht nur GitHub Actions. Nach Änderungen an `android/` deshalb den Workflow-Lauf abwarten und prüfen.

Commits in diesem Repository nutzen die GitHub-noreply-Adresse (lokale Git-Einstellung), weil das Repository öffentlich ist.

## Aufbau

- `src/data/` – Datenmodell und reine Logik, von App und Datenskript gemeinsam genutzt.
  - `model.ts`: Card, Print (Druck), Sku (Druck + Finish), `CatalogSource`.
  - `prints.ts`: fasst Skus zu Drucken zusammen.
  - `prices.ts`: Cardmarket Low je Finish, „kein Preis“ statt 0 €.
  - `catalog-index.ts`, `filter.ts`: Nachschlagetabellen, Suche und Filter (Mehrfachauswahl, Suche im Kartentext am Wortanfang). `filterCards` fasst das Ergebnis je Karte zusammen.
  - `csv.ts`, `backup.ts`, `piltover.ts`: Sicherung (JSON), Tabelle (CSV), Piltover-Archive-Format.
  - `auto-backup.ts`: Dateinamen, Aufräumen und Erinnerung der automatischen Sicherung.
  - `versions.ts`: Art einer Fassung (Normal, Foil, Promo, Metal), Zählung je Karte und lesbare Herkunft der Sonderausgaben.
  - `links.ts`: Ziele bei PlayRiftbound und BoundRift; liest die Spielernummer aus einem eingefügten BoundRift-Link.
  - `score.ts`: Punktezähler. Die Partie ist eine Liste von Ereignissen mit Zeitpunkt (Punkt, Korrektur, „Pass turn“, Beginn); Stand, Sieg bei 8, Spieldauer, Zeitlimit mit Overtime, Züge und Verlauf werden daraus berechnet, nichts davon wird eigens gespeichert.
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
- `src/app/styles.css` und `src/app/theme.css` – Gestaltung. `styles.css` enthält Aufbau und die Farbwerte (`:root`), `theme.css` die Schicht des Hextech-Stils (abgeschrägte Ecken, Rahmen, Serifenschrift Cinzel aus `src/app/fonts/`, Farben der Domänen) und wird danach geladen. Neue Stile in `styles.css`; in `theme.css` nur Form und Schrift.
- `src/app/play/` – Seite „Spielerdaten“ (`PlayView.tsx`, `#/spiel`): Link zu den Events bei Riot und zum eigenen Profil bei BoundRift. Verlinkt nur, ruft nichts ab.
- `src/app/browser.ts` – öffnet fremde Seiten in der Android-App als Browser-Fenster über der App (`@capacitor/browser`, Chrome Custom Tab), in der Web-App im neuen Tab.
- `src/app/score/` – Punktezähler (`ScoreView.tsx`), Seite `#/punkte`. Liegt als feste Fläche unter der Kopfzeile (`--topbar-h` in `styles.css`) und wird unabhängig vom Katalog angezeigt.
- `src/app/scan/` – Scan-Seite: Kamera (`useCamera.ts`), Worker-Anbindung (`useRecognizer.ts`), Texterkennung (`ocr.ts`), `ScanView.tsx`, `SessionList.tsx`.
- `public/ocr/` – Rechenkern und Sprachmodell der Texterkennung; entsteht durch `scripts/copy-ocr.mjs` aus `node_modules` und ist von Git ausgenommen.
- `scripts/scan/` – Prüfprogramme der Erkennung (laufen unter Node mit OpenCV.js und sharp).
- `data/fingerprints.json` – Fingerabdrücke aller Katalogbilder. Liegt im Repository, damit der tägliche Lauf nur neue Bilder abruft; nach `npm run data:fingerprints` mit einchecken.
- `src/app/` – React-Oberfläche. `db.ts` hält den Bestand in IndexedDB (Dexie).
  - `save.ts`: Speichern und Teilen je Umgebung (Android-App, PC-Browser, Handy-Browser).
  - `catalog-loader.ts`: lädt Katalog, Preise und Fingerabdrücke; die Android-App holt sie von GitHub Pages und merkt sie sich.
  - `updater.ts`: Update-Prüfung beim Start, nach einer Stunde Pause und über „Nach Updates suchen“. Android-App: Selbst-Update mit `@capgo/capacitor-updater` im Handbetrieb; Web-App: stößt den Service Worker an. Die Entscheidung (nichts, Web-Teil nachladen, neue APK nötig) steht in `src/data/update.ts`.
  - `auto-backup.ts`: Die Android-App schreibt nach jeder Änderung eine Sicherung nach „Dokumente/CardScanner“ und bietet sie bei leerer Sammlung zum Wiederherstellen an. Findet sie bei leerer Sammlung keine lesbare Sicherung (so nach einer Neuinstallation: Android gibt die alten Dateien nicht frei), zeigt sie einen Hinweis auf den Ordner und „Sicherung einspielen“; die Entscheidung steht in `restoreStep` (`src/data/auto-backup.ts`). Die Web-App merkt sich nur die letzte Sicherung von Hand und erinnert daran.
  - `local-store.ts`: kleine Merker in localStorage, auf die die Oberfläche hört.
- `android/` – Capacitor-Projekt. `app/debug.p12` ist der feste, bewusst öffentliche Signaturschlüssel; nicht ersetzen, sonst lassen sich Updates nur nach Deinstallation (Datenverlust) einspielen.
- `scripts/build-data/` – Node-Datenskript.
  - `sources/openrift.ts`: einzige Stelle, die das OpenRift-Format kennt; übersetzt auch die Auszeichnung des Kartentexts in Klartext (`Card.text`).
  - `sources/cardmarket.ts`: Cardmarket-Preisdatei und Produktliste.
  - `match-products.ts`: eigene Zuordnung neuer Cardmarket-Produkte zu Fassungen, solange die Katalogquelle sie noch nicht verknüpft. Ordnet nur Eindeutiges zu (Regeln „Name“ und „Edition“), nie Metal; die Verknüpfungen der Quelle haben Vorrang.
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
- Keine Anmeldung bei Riot in der App nachbauen und keine Zugangsdaten durch eigenen Code führen: Die App öffnet nur die echte Seite im Browser-Fenster. PlayRiftbound und BoundRift werden verlinkt, nicht abgerufen (BoundRift ist ein Hobbyprojekt ohne dokumentierte Schnittstelle; vor einem Abruf den Betreiber fragen).
- Preise kommen nur aus der Cardmarket-Preisdatei, nicht aus OpenRifts `/api/v1/prices` (enthält Platzhalter).
- Die eigene Cardmarket-Zuordnung rät nie: Ein falscher Preis ist schlimmer als keiner. Neue Regeln nur, wenn sie an den vorhandenen Verknüpfungen der Quelle nachweislich keinen Fehlgriff ergeben; Metal bleibt ausgenommen, bis die Quelle die Produkte unterscheidet.
- `package.json` nicht für neue Hilfsbefehle anfassen: Jede Änderung daran hebt die Mindest-APK an und zwingt alle Handys zu einer neuen APK von Hand. Hilfsbefehle direkt mit `npx tsx …` aufrufen.
- Bestand und Preis hängen an der Sku. Es gibt vier Finishes: Normal, Foil, Metal, Metal Deluxe. Metal hat keinen Cardmarket-Preis.
- Keine `.gz`-Dateien unter `public/`: Der Android-Bau packt sie aus und benennt sie um, die App findet sie in der APK dann nicht (so fiel das Nummernlesen bis Version 0.1.9 in der APK aus). Der Workflow prüft nach dem Bau, dass jede Datei aus `dist/` unverändert in der APK liegt.
- Der Scanner wartet nie unbegrenzt auf die Texterkennung; ein sicherer Bildtreffer zählt auch ohne gelesene Nummer.
- Der Update-Baustein bleibt im Handbetrieb (`autoUpdate: false`, `statsUrl: ''` in `capacitor.config.ts`): Er darf nur GitHub Pages ansprechen, nie die Server seines Herstellers.
- Änderungen an `android/`, `capacitor.config.ts` oder `package.json` verlangen vom Nutzer eine neue APK von Hand. Solche Änderungen deshalb sammeln und im Abschlussbericht ausdrücklich nennen.
- Keine Schriften, Logos oder Grafiken von Riot in die App nehmen; der Stil ist angelehnt, nicht kopiert. Schriften liegen in der App (kein Abruf von Schrift-Servern) und brauchen eine freie Lizenz, die als Datei daneben liegt.
- Abgeschrägte Elemente (`clip-path`) schneiden äußere Fokusrahmen ab: Für neue angeschrägte Bedienelemente den Fokusrahmen nach innen legen (Liste in `theme.css`).
- Web-App und APK müssen beide funktionieren: Plattform-Unterschiede gehören hinter `isNativeApp()` in `save.ts` oder `catalog-loader.ts`.
- Die automatische Sicherung schreibt nie eine leere Sammlung: Eine leere Sammlung ist oft gerade der Verlustfall und darf die vorhandenen Sicherungen nicht verdrängen.
- Ein Druck (`Print`) kann mehrere Sonderausgaben bündeln, weil er nur nach Nummer, Variante und Stempel gruppiert: z. B. Foil vom Release Event, Metal von der Prize Wall und Metal Deluxe als Best Of. Herkunft und Art deshalb immer an der Sku ablesen (`versions.ts`), nicht am Druck.
- `Catalog.channels` und `Catalog.markerLabels` sind wahlfrei wie `Card.text`.
- `Card.text` ist wahlfrei: Die Android-App startet mit dem zuletzt gespeicherten Katalog, der das Feld noch nicht tragen muss.
- `data/version.json` läuft nicht über den Zwischenspeicher des Service Workers (`vite.config.ts`), sonst sähe die Update-Prüfung einen alten Stand.
- Fehler der Update-Prüfung nie still verschlucken: Die Meldung steht unter „Nach Updates suchen“ (`reason` in `updater.ts`).
- Capacitor-Bausteine (`CapacitorUpdater`, `Filesystem`, `Share` …) nie aus einer async-Funktion zurückgeben, nie in ein Promise auflösen und nie mit `await` erwarten; in ein Objekt stecken (`loadUpdater` in `updater.ts`). Jeder Schritt der Update-Prüfung hat eine Zeitgrenze, damit „Suche läuft“ nie stehen bleibt. `tests/updater.test.ts` prüft beides mit einem nachgebauten Baustein.
- Nach einem Wechsel der Version von `@capgo/capacitor-updater` dessen Android-Quelltext auf neue Pflichtangaben beim Laden prüfen (`downloadBundle` in `CapacitorUpdaterPlugin.java`); das Selbst-Update lässt sich nur auf dem Handy testen.
- Stimmt eine Annahme der SPEC nicht: anhalten, Abweichung mit Vorschlag nennen, dann weiterbauen.
- Jeder Meilenstein endet mit Tests für die Abnahmekriterien und einer Prüfanleitung fürs Handy; danach auf Freigabe warten.
