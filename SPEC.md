# Riftbound-Scanner – Spezifikation für Claude Code

Nov 13, 2026 · @Minus

## Ziel und Rahmen

Eine private Web-App für ein Android-Handy erkennt Riftbound-Karten per Kamera, zeigt Cardmarket-Preis und eigenen Bestand und führt die Sammlung. Sie läuft ohne Konto, ohne eigenen Server und ohne laufende Kosten.

- **Nutzer:** eine Person, ein Handy.
- **Umsetzung:** Claude Code (Opus) in einem eigenen GitHub-Repository.
- **Betrieb:** GitHub Pages liefert die App, GitHub Actions aktualisiert einmal täglich Katalog und Preise.
- **Nicht enthalten:** Deckbau, Spielsimulation, Kaufen und Verkaufen, Abgleich zwischen mehreren Geräten, Veröffentlichung im Play Store.

## Festgelegte Entscheidungen

| Thema | Entscheidung |
| --- | --- |
| Gerät | Android, Chrome, als installierbare Web-App (PWA). Dieselbe App läuft im Browser am PC; dort lässt sich beim Scannen eine angeschlossene Kamera wählen, auch das Handy als Webcam. Es gibt keine getrennte PC-Version. |
| Preis | Cardmarket Low je Druck; englische Variante bevorzugt, siehe Abschnitt Preise |
| Projektname | Personal Card Scanner via Claude |
| Bestand | Je Druck und Finish getrennt gezählt, Anzeige „Normal: X · Foil: Y“; bei Metal-Fassungen zusätzlich „Metal: X · Metal Deluxe: Y“ |
| Finishes | Normal, Foil, Metal, Metal Deluxe (der Nutzer besitzt Metal-Karten) |
| Piltover Archive | Import und Export im Format von Piltover Archive, zum Übernehmen der bestehenden Sammlung und als Sicherung dort |
| Varianten | Alt-Art, Overnumbered, Special Collection und Promos sind eigene Drucke mit eigenem Bestand und eigenem Preis |
| Nutzung | Zunächst privat, keine Weitergabe |
| Speicherung | Lokal je Gerät, Sicherung als Datei. Handy und PC führen getrennte Bestände; die Sicherungsdatei überträgt die Sammlung von einem Gerät aufs andere. |
| Hosting | GitHub Pages, Repository https://github.com/Minusprivat/personal-card-scanner (öffentlich), App unter https://minusprivat.github.io/personal-card-scanner/ |
| Testmaterial | Fotos echter Karten liefert der Nutzer |
| Gerät des Nutzers | Motorola Edge 60 Fusion |
| Kontakt gegenüber OpenRift | Projektname und Repository-Adresse im User-Agent, keine E-Mail-Adresse |
| Kartenbilder | Einmaliger, gedrosselter Abruf für die Fingerabdrücke ist freigegeben; Bilder werden nicht gespeichert |

## Funktionsumfang

Die erste Version deckt drei Dinge ab: scannen, in einer Sitzung sammeln und auswählen, Sammlung verwalten.

### Scannen

- Die Karte wird im laufenden Kamerabild automatisch erkannt, ohne Auslöser.
- Ein Treffer zeigt Bild, Name, Set und Nummer, Variante, Cardmarket Low für Normal und Foil sowie den Bestand „Normal: X · Foil: Y“.
- Bei unsicherem Treffer stehen bis zu drei Kandidaten zur Auswahl. Das betrifft vor allem Varianten desselben Motivs.
- Eine Auswahl legt pro Scan das Finish fest (Normal, Foil, Metal, Metal Deluxe); angeboten werden nur die Finishes, die es für den Druck gibt. Die Kamera kann das nicht verlässlich unterscheiden.
- Ein Knopf schaltet das Kameralicht, soweit das Handy es zulässt.

### Scan-Sitzung

- Jede erkannte Karte landet in einer Sitzungsliste, nicht direkt in der Sammlung.
- Dieselbe Karte ein zweites Mal gescannt erhöht den Zähler um eins. Eine Karte, die nur im Bild liegen bleibt, zählt nicht doppelt.
- Am Ende zeigt die Liste jede Zeile mit Häkchen, Menge und Normal/Foil, alles änderbar.
- „Auswahl übernehmen“ schreibt die angehakten Zeilen in die Sammlung, der Rest wird verworfen.
- Eine offene Sitzung übersteht das Schließen der App.

### Sammlung

- Rasteransicht mit Kartenbildern, Filter nach Set, Variante, Farbe und „besitze ich / fehlt“.
- Suche nach Name und Kartennummer, Hinzufügen auch ohne Scan.
- Die Detailseite zeigt alle Drucke einer Karte nebeneinander, jeweils mit Bestand und Preis.
- Gesamtwert der Sammlung als Summe aus Low-Preis mal Menge.
- Export und Import als JSON (Sicherung) und als CSV.
- Export und Import im Format von Piltover Archive (CSV), nachgebaut anhand einer Exportdatei des Nutzers vom 14.11.2026.
  - Import: Zeilen derselben Fassung werden summiert. Was sich nicht zuordnen lässt, steht in einer Liste, bleibt gespeichert und geht beim Export unverändert zurück.
  - Export: Fassungen aus einem früheren Import behalten ihre Piltover-Felder. Für alle anderen sind Nummer und Bezeichnung nach den Mustern der Datei geschätzt, weil Piltover Archive seinen Katalog nicht zum automatischen Abruf freigibt.
  - Grenzen: Zustand, Grading und Notizen führt die App nicht (Export schreibt „Near Mint“). Metal-Fassungen kennt das Format nicht; sie fehlen im Export.

### Später, nicht in der ersten Version

Preisverlauf, Wunschliste, Set-Fortschritt in Prozent und Abgleich zwischen mehreren Geräten.

## Datenquellen

Alle benötigten Daten sind ohne API-Schlüssel frei abrufbar; nur der optionale Englisch-Preis braucht ein eigenes CardTrader-Token.

| Zweck | Quelle | Zugang | Hinweis |
| --- | --- | --- | --- |
| Katalog: Karten, Drucke, Sets | [OpenRift API](https://openrift.app/developers), `/api/v1/catalog` | frei, kein Schlüssel | Sprachfilter `?langs=EN`; Antworten eine Stunde cachebar; kein festes Limit, aber Massenabrufe werden gesperrt |
| Kartenbilder | OpenRift, `/media/cards/{imageId}-{size}.webp` | frei | Größen 120w, 240w, 400w, full; Bilder nicht massenhaft spiegeln |
| Preise | Cardmarket-Preisdatei, `downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json` | öffentlich, täglich | Felder `low`, `trend`, `avg`, `avg1/7/30` und jeweils `-foil`, in Euro ([Beschreibung](https://github.com/Mickael-Desclaux/riftbound-collection/issues/3)) |
| Zuordnung Druck zu Cardmarket-Produkt | OpenRift, `/api/v1/prices/links` | frei | Nötig, weil Cardmarkets Katalog weder Kartennummer noch Variante führt |
| Ersatz für Preise | OpenRift, `/api/v1/prices` | frei | Liefert Cardmarket Low bereits je Druck, einmal täglich |
| Zweitquelle Katalog | [Riftcodex API](https://riftcodex.com/faq) | frei, kein Schlüssel | Zum Gegenprüfen von Nummern und Bild-Links |
| Englisch-Preis, optional | [CardTrader API](https://www.cardtrader.com/en/docs/api/full), `/marketplace/products` | Token aus dem eigenen Profil | Angebote lassen sich nach Sprache filtern; anderer Marktplatz als Cardmarket |

Die offizielle [Cardmarket-API](https://help.cardmarket.com/en/cardmarket-api) scheidet aus: Cardmarket nimmt derzeit keine neuen Anträge an.

## Datenmodell

Bestand und Preis hängen am Druck, nicht an der Karte: Die normale Fassung und die Alt-Art-Fassung derselben Karte sind zwei Drucke mit eigenem Zähler.

| Objekt | Wichtige Felder | Zweck |
| --- | --- | --- |
| Karte | Name, Typ, Farbe, Regeltext | Die Spielkarte, unabhängig von der Fassung |
| Druck | Karte, Set, Kartennummer (z. B. OGN-142/298), Variante, Sprache EN, Bild, verfügbare Finishes, Cardmarket-Produkt | Eine physische Fassung; hieran hängen Bestand und Preis |
| Bestand | Druck, Finish (Normal, Foil, Metal oder Metal Deluxe), Menge, zuletzt geändert | Was der Nutzer besitzt |
| Sitzungszeile | Druck, Finish, Menge, angehakt, Treffergüte, Zeitpunkt | Gescannte Karten vor der Übernahme |
| Preis | Druck, Finish, Low, Trend, Stand-Datum, Quelle | Tagespreis aus der Preisdatei |

- **Varianten** kommen aus dem Katalog und werden nicht selbst erfunden. Welche Felder Alt-Art, Overnumbered, Signature und Special Collection kennzeichnen, klärt Meilenstein 0.
- **Anzeige:** pro Druck „Normal: X · Foil: Y“. Die Kartenansicht summiert über alle Drucke und listet sie darunter einzeln.
- **Nur-Foil-Drucke:** Gibt es einen Druck nur in einem Finish, ist es beim Scan vorbelegt.
- **Katalogaufbau:** OpenRift führt jedes Finish als eigenen Eintrag. Die App fasst die Einträge zu Drucken zusammen; der Bestand hängt am einzelnen Eintrag (Druck + Finish).
- **Metal:** Cardmarket liefert für Metal und Metal Deluxe keinen Preis. Sie zeigen „kein Preis“ und zählen nicht in den Sammlungswert.
- **Speicher:** Bestand und Sitzung liegen in IndexedDB auf dem Handy. Katalog und Preise sind austauschbare Tagesdaten und gehören nicht in die Sicherung.

## Kartenerkennung

Die Erkennung läuft vollständig auf dem Handy und gleicht das Kamerabild mit vorberechneten Fingerabdrücken aller Drucke ab. Sie ist das größte technische Risiko und wird deshalb gegen echte Testfotos gemessen.

1. **Karte finden:** Kartenumriss im Kamerabild erkennen und perspektivisch auf ein festes Format entzerren.
2. **Motiv abgleichen:** Bild-Fingerabdruck (Perceptual Hash) von Artwork und Gesamtkarte berechnen und die ähnlichsten Drucke suchen.
3. **Nummer lesen:** Die Zeile mit der Kartennummer per Texterkennung auslesen. Sie entscheidet, wenn mehrere Drucke dasselbe Motiv tragen.
4. **Entscheiden:** Ist ein Treffer über mehrere Bilder hinweg stabil und eindeutig, geht er in die Sitzung. Sonst erscheinen die Kandidaten zur Auswahl.

- **Fingerabdrücke** entstehen im täglichen Datenskript aus den Katalogbildern. Gespeichert werden nur die Fingerabdrücke, keine Bildkopien.
- **Varianten:** Alt-Art und Overnumbered unterscheiden sich im Motiv und werden über den Fingerabdruck getrennt. Gleiches Motiv mit anderer Nummer trennt die Texterkennung.
- **Foil** wird nicht erkannt, sondern per Schalter gesetzt.
- **Ausweichlösung:** Reicht der Fingerabdruck nicht, ersetzt ein kleines Bildmodell im Browser (ONNX Runtime Web oder TensorFlow.js) Schritt 2. Der Rest bleibt gleich.

### Testsatz und Zielwerte

- Der Nutzer liefert mindestens 30 Fotos: normale Karten, Foils, Alt-Art, Overnumbered, mit und ohne Hülle, bei gutem und schlechtem Licht.
- Ablage unter `testdata/photos/`, der Dateiname nennt die erwartete Kartennummer, zum Beispiel `OGN-142_foil_huelle.jpg`.
- Ein automatischer Test lässt die Erkennung über alle Fotos laufen und meldet die Trefferquote.
- Ziel: richtiger Druck an erster Stelle bei mindestens 95 % der Fotos, unter den ersten drei bei mindestens 99 %, unter einer Sekunde pro Karte auf dem Handy des Nutzers.

## Preise

Angezeigt wird Cardmarket Low je Druck und Finish mit Stand-Datum. Einen Low-Preis nur für englische Karten geben die freien Cardmarket-Daten nicht her: Cardmarket fasst alle Sprachen in einem Preis zusammen ([OpenRift](https://openrift.app/developers)).

| Stufe | Was die App zeigt | Aufwand | Einschränkung |
| --- | --- | --- | --- |
| 1, Standard | „CM Low (alle Sprachen)“ für Normal und Foil, Trend klein daneben | Teil der ersten Version | Kann von einer günstigeren chinesischen oder französischen Kopie stammen |
| 2, Standard | Knopf „Auf Cardmarket (EN) öffnen“: Produktseite mit Sprachfilter Englisch | Teil der ersten Version | Ein Antippen pro Karte, kein Wert in der Liste |
| 3, optional | „EN ab X €“ als günstigstes englisches Angebot von CardTrader | Späterer Meilenstein, braucht ein CardTrader-Token | Anderer Marktplatz, Preise weichen von Cardmarket ab |

- **Nicht vorgesehen:** automatisches Auslesen der Cardmarket-Angebotsseiten. Sie sind gegen automatische Zugriffe gesperrt.
- **Prüfregeln:** Fehlt ein Preis, steht „kein Preis“ statt 0 €. Offensichtliche Platzhalterangebote ohne Verkäufe fließen nicht in den Sammlungswert ein.
- **Sammlungswert** rechnet mit Stufe 1 und nennt das Stand-Datum der Preisdatei.
- **Aktualität:** einmal täglich. Ein Live-Preis ist nur über den Knopf aus Stufe 2 sichtbar.

## Architektur und Tech-Stack

Die App ist eine statische Web-App ohne eigenen Server: Erkennung, Sitzung und Sammlung laufen auf dem Handy, GitHub liefert nur App-Dateien und Tagesdaten.

&#91;embedded content: Architektur · 3 Bereiche, 8 Bausteine\]

Das tägliche Skript holt Katalog und Preise, berechnet die Fingerabdrücke und legt alles als Dateien neben die App. Das Handy lädt sie beim Start und arbeitet danach auch ohne Netz.

| Baustein | Wahl | Grund |
| --- | --- | --- |
| App | TypeScript, React, Vite, vite-plugin-pwa | Weit verbreitet, PWA-Unterstützung fertig |
| Speicher | IndexedDB über Dexie | Bestand und Sitzung lokal, auch ohne Netz |
| Kamera | `getUserMedia`, Rückkamera | Braucht HTTPS, das GitHub Pages mitbringt |
| Bildverarbeitung | OpenCV.js im Web Worker | Umriss finden und entzerren, ohne die Oberfläche zu blockieren |
| Texterkennung | Tesseract.js, nur die Zeile der Kartennummer | Kleiner Ausschnitt, eingeschränkter Zeichensatz |
| Fingerabdruck | Eigenes Modul, in App und Datenskript identisch | Beide Seiten müssen exakt gleich rechnen |
| Datenskript | Node.js unter `scripts/build-data` | Gleiche Sprache wie die App |
| Automatik | GitHub Actions, einmal täglich nachts | Kostenlos; die Preisdatei erscheint täglich |
| Hosting | GitHub Pages | Kostenlos, HTTPS |
| Tests | Vitest, Erkennungstest gegen `testdata/photos/` | Abnahmekriterien automatisch prüfbar |

## Meilensteine

Die Sammlung kommt vor dem Scanner: So ist die App schon nutzbar, während die Erkennung noch verbessert wird. Jeder Meilenstein endet mit einer Version, die der Nutzer auf dem Handy prüft.

1. **M0 Datenprüfung, ohne Oberfläche.** Das Skript lädt Katalog, Preisdatei und Zuordnung und schreibt einen Bericht.
   - Abnahme: Der Bericht nennt Zahl der Drucke je Set und Variante, die Variantenfelder des Katalogs und den Anteil der Drucke mit Preis.
   - Abnahme: Mindestens 95 % der Normal- und Foil-Drucke aus regulären Sets haben einen Preis; alle übrigen stehen namentlich in einer Liste.
   - Stand: erfüllt am 14.11.2026, siehe `docs/m0-bericht.md`.
2. **M1 Gerüst und Sammlung.** Installierbare PWA mit Katalog, Suche, Filtern, Bestand je Druck und Sicherung.
   - Abnahme: Die App lässt sich auf dem Android-Handy installieren und startet ohne Netz.
   - Abnahme: Alle Finishes lassen sich je Druck getrennt zählen; Export und anschließender Import stellen den Bestand vollständig wieder her.
   - Abnahme: Eine Exportdatei aus Piltover Archive lässt sich einlesen; der Export der App lässt sich dort wieder importieren.
   - Stand 14.11.2026: gebaut und automatisch getestet. Offen sind die Prüfung auf dem Handy und der Import-Test bei Piltover Archive durch den Nutzer.
3. **M2 Preise.** Tägliche GitHub Action, Preisanzeige, Sammlungswert, Cardmarket-Knopf.
   - Abnahme: Die Action läuft drei Tage in Folge ohne Eingriff, die App zeigt das jeweils neue Stand-Datum.
   - Abnahme: Zehn Stichproben stimmen mit dem Low-Wert auf der Cardmarket-Seite des Vortags überein.
4. **M3 Erkennung.** Fingerabdrücke, Erkennungskette, automatischer Test gegen die Fotos.
   - Abnahme: Die Zielwerte aus dem Abschnitt Kartenerkennung sind auf dem Testsatz erreicht.
   - Abnahme: Der Test läuft bei jeder Änderung automatisch mit.
5. **M4 Scan-Sitzung.** Fortlaufendes Scannen, Sitzungsliste, Übernahme der Auswahl.
   - Abnahme: 20 Karten nacheinander gescannt ergeben 20 Zeilen ohne Doppelzählung.
   - Abnahme: Nur angehakte Zeilen landen in der Sammlung; eine offene Sitzung ist nach einem Neustart noch da.
6. **M5 Optional.** Englisch-Preis über CardTrader, Preisverlauf, Wunschliste.

## Offene Punkte

Diese Fragen sind nicht abschließend geklärt und gehören an den Anfang von M0.

### Von Claude Code zu prüfen

Die Antworten stehen in `docs/m0-bericht.md`.

- [x] Welche Katalogfelder kennzeichnen Alt-Art, Overnumbered, Signature, Special Collection und das Finish?
- [x] Deckt `/api/v1/prices/links` für alle Drucke ein Cardmarket-Produkt ab, auch für Promos mit mehreren gleichnamigen Produkten?
- [x] Liefert die Preisdatei für Riftbound verlässliche `low-foil`-Werte, und welche Drucke gibt es nur als Foil?
- [x] Mit welchem URL-Parameter filtert eine Cardmarket-Produktseite auf Englisch? Antwort: `language=1`.
- [ ] Wie heißt bei CardTrader die Spracheigenschaft für Riftbound? Braucht ein Token, wird erst für M5 benötigt.
- [x] Braucht GitHub Pages im kostenlosen Tarif ein öffentliches Repository? Antwort: ja.

### Vom Nutzer zu liefern

- [ ] Mindestens 30 Testfotos nach dem Schema im Abschnitt Kartenerkennung, darunter einige Metal-Karten. Nötig ab M3.
- [x] Handymodell: Motorola Edge 60 Fusion.
- [x] Öffentliches GitHub-Repository: https://github.com/Minusprivat/personal-card-scanner.
- [x] Eine Exportdatei der eigenen Sammlung aus Piltover Archive, abgelegt unter `testdata/piltoverarchive/` (bleibt lokal, nicht im Repository).
- [ ] Probe-Import einer von der App erzeugten Piltover-Datei bei Piltover Archive.

### Riot-Richtlinie

Riot verlangt für Riftbound-Apps eine schriftliche Lizenz oder einen eigenen API-Schlüssel und erlaubt nur Kartenmaterial aus der Riot-API ([Riot Developer Portal](https://developer.riotgames.com/docs/riftbound)). Ob das auch für ein Werkzeug gilt, das nur sein Ersteller benutzt, sagt die Seite nicht. Sammlungsverwaltung und Scanner nennt sie weder als erlaubt noch als verboten.

- Privat genutzt bleibt die App ohne Werbung, ohne Bezahlfunktion und ohne Weitergabe.
- Vor einer Weitergabe an andere: API-Schlüssel im Developer Portal beantragen und Kartendaten auf die Riot-API umstellen. Die Datenschicht wird deshalb austauschbar gebaut.

## Startprompt für Claude Code

Dieses Dokument als Markdown exportieren, als `SPEC.md` ins leere Repository legen und Claude Code mit dem folgenden Text starten.

```text
Lies SPEC.md vollständig. Sie beschreibt eine private Riftbound-Scanner-App als PWA für Android.

Arbeite die Meilensteine der Reihe nach ab und beginne mit M0. Baue in M0 keine Oberfläche.

Regeln:
- Kläre zuerst die Punkte unter „Von Claude Code zu prüfen“ und halte die Antworten in docs/m0-bericht.md fest. Prüfe jede API-Annahme gegen die echte Antwort der Schnittstelle, nicht aus dem Gedächtnis.
- Stimmt eine Annahme der SPEC nicht, halte an und nenne mir die Abweichung mit einem Vorschlag, bevor du weiterbaust.
- Halte dich an den Tech-Stack der SPEC. Weiche nur mit Begründung ab.
- Baue die Datenschicht so, dass sich die Katalogquelle austauschen lässt.
- Rufe fremde Schnittstellen sparsam ab: Katalog und Preise höchstens einmal pro Lauf, Bilder nur für neue Drucke, mit Kontaktangabe im User-Agent.
- Lege keine Kartenbilder im Repository ab, nur die daraus berechneten Fingerabdrücke.
- Schreibe zu jedem Meilenstein Tests für die Abnahmekriterien und führe sie aus, bevor du ihn als fertig meldest.
- Beende jeden Meilenstein mit einer kurzen Anleitung, wie ich ihn auf meinem Android-Handy prüfe, und warte auf meine Freigabe.
- Lege eine CLAUDE.md mit Build-, Test- und Deploy-Befehlen an und halte sie aktuell.

Oberfläche und alle Texte der App sind auf Deutsch.
```
