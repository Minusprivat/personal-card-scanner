# Riftbound-Scanner – Spezifikation für Claude Code

Nov 13, 2026 · @Minus

## Ziel und Rahmen

Eine private Web-App für ein Android-Handy erkennt Riftbound-Karten per Kamera, zeigt Cardmarket-Preis und eigenen Bestand und führt die Sammlung. Sie läuft ohne Konto, ohne eigenen Server und ohne laufende Kosten.

- **Nutzer:** eine Person, ein Handy.
- **Umsetzung:** Claude Code (Opus) in einem eigenen GitHub-Repository.
- **Betrieb:** GitHub Pages liefert die App, GitHub Actions aktualisiert einmal täglich Katalog und Preise.
- **Nicht enthalten:** Deckbau, Spielsimulation, Kaufen und Verkaufen, Abgleich zwischen mehreren Geräten, Veröffentlichung im Play Store.
- **Android-App (seit 15.11.2026):** Zusätzlich zur Web-App gibt es dieselbe App als APK zum direkten Installieren, gebaut mit Capacitor von GitHub Actions. Download: https://github.com/Minusprivat/personal-card-scanner/releases/download/apk/card-scanner.apk

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
| Android-App | APK aus demselben Code. Speichert Dateien direkt unter „Dokumente/CardScanner“. Seit Version 0.1.11 aktualisiert sie sich selbst: Beim Start, beim Zurückkehren nach mehr als einer Stunde Pause und über den Knopf „Nach Updates suchen“ (Seite „Sicherung“) prüft sie die Versionsdatei auf GitHub Pages, lädt den neuen Web-Teil im Hintergrund und nutzt ihn ab dem nächsten Öffnen (oder sofort über „Jetzt neu starten“). Nur wenn sich die Android-Hülle geändert hat (Berechtigungen, Bausteine), installiert der Nutzer von Hand eine neue APK; die App sagt das dann. Web-App und APK führen getrennte Bestände; der Umzug läuft über die Sicherungsdatei. Alle Builds tragen dieselbe, öffentlich im Repository liegende Signatur, damit Updates die Sammlung behalten. |
| Speicherung | Lokal je Gerät, Sicherung als Datei. Handy und PC führen getrennte Bestände; die Sicherungsdatei überträgt die Sammlung von einem Gerät aufs andere. Updates lassen die Sammlung unberührt; verloren geht sie nur durch Deinstallation oder „Daten löschen“. Dagegen sichert die Android-App von selbst: Nach jeder Änderung schreibt sie eine Sicherungsdatei nach „Dokumente/CardScanner“ (eine je Tag, die letzten fünf Tage bleiben) und bietet sie bei leerer Sammlung zum Wiederherstellen an. Die Web-App kann das nicht; sie erinnert ab 20 geänderten Karten an eine Sicherung. |
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
- Bei mehreren Kameras lässt sich die Kamera wählen (am PC zum Beispiel das Handy als Webcam).
- „Foto wählen“ erkennt eine Karte aus einem gespeicherten Foto, zum Testen oder wenn keine Kamera verfügbar ist.
- Unter dem Kamerabild steht eine Diagnosezeile (Abstand, Vorsprung, Rechenzeit); sie hilft beim Einstellen der Erkennung.

### Scan-Sitzung

- Jede erkannte Karte landet in einer Sitzungsliste, nicht direkt in der Sammlung.
- Dieselbe Karte ein zweites Mal gescannt erhöht den Zähler um eins. Eine Karte, die nur im Bild liegen bleibt, zählt nicht doppelt.
- Am Ende zeigt die Liste jede Zeile mit Häkchen, Menge und Normal/Foil, alles änderbar.
- „Auswahl übernehmen“ schreibt die angehakten Zeilen in die Sammlung, der Rest wird verworfen.
- Eine offene Sitzung übersteht das Schließen der App.
- Die zuletzt gescannte Karte und jede Zeile der Sitzung tragen einen Link „Auf Cardmarket (EN) öffnen“: Produktseite mit Sprachfilter Englisch, bei Foil zusätzlich mit Foil-Filter.
- **Warnung ab 4 Karten:** Sind von einer Fassung schon 4 Karten vorhanden (Sammlung plus laufende Sitzung), warnt der Scanner beim nächsten Scan dieser Fassung deutlich, zählt die Karte aber trotzdem; „Rückgängig“ nimmt sie wieder heraus. Gezählt wird je Druck: Normal und Foil zusammen, Promo- und Alt-Art-Fassungen jeweils für sich. In der Sitzungsliste sind betroffene Zeilen markiert.

### Preise für neue Sonderausgaben

- Die Katalogquelle verknüpft neue Promos und Bundles erst mit Verzögerung mit Cardmarket. Bis dahin ordnet das Datenskript sie über die öffentliche Produktliste von Cardmarket selbst zu, aber nur, wenn die Zuordnung eindeutig ist: Der Kartenname kommt bei den offenen Produkten und den offenen Fassungen je genau einmal vor und das Set passt zur Edition, oder eine ganze Edition deckt sich eins zu eins mit den offenen Fassungen eines Sets.
- Metal und Metal Deluxe bleiben ausgenommen und ohne Preis, bis die Katalogquelle sie verknüpft. Verknüpfungen der Quelle haben immer Vorrang.

### Spielerdaten: Events und Profil

- Der Eintrag „Spielerdaten“ in der Kopfzeile (auf dem Handy kurz „Spieler“) bündelt Events und Profil.
- „Events finden und anmelden“ öffnet die Event-Seite von Riot (playriftbound.com). In der Android-App erscheint sie als Browser-Fenster über der App; es gehört zu Chrome und nutzt dessen Anmeldung bei Riot. Die App selbst sieht weder Seite noch Zugangsdaten und baut keine Anmeldung nach.
- „Mein Profil“ öffnet die eigene Spielerseite bei BoundRift (Match-Historie, Bilanz, inoffizielle Elo). Der Link dazu wird einmal eingefügt und bleibt nur auf dem Gerät. BoundRift ist ein unabhängiges Fan-Projekt; die App verlinkt nur und ruft dort nichts ab.

### Punktezähler

- Eigener Eintrag „Punktezähler“ in der Kopfzeile (auf dem Handy kurz „Punkte“); braucht weder Katalog noch Netz.
- Standardmodus 1 gegen 1: Beide Spieler beginnen bei 0, wer zuerst 8 Punkte hat, gewinnt. Danach nimmt die Partie keine Punkte mehr an.
- Je Spieler zwei große Knöpfe „Conquer“ und „Hold“; jedes Antippen zählt einen Punkt. „−1“ nimmt den letzten Punkt des Spielers zurück, „Zurück“ den letzten Schritt überhaupt, auch den Siegpunkt.
- Ein Ring mit acht Feldern zeigt den Stand, darunter steht der Verlauf der Punkte (C/H). Die Leiste in der Mitte zeigt die Spieldauer ab dem ersten Punkt.
- **Zeitlimit** (unter „Optionen“): aus, 15, 30, 45, 60 oder eigene Minuten (1 bis 180). Mit Limit zeigt die Uhr die Restzeit; sie startet mit dem ersten Punkt, durch Antippen der Uhr oder – im Expertenmodus – sobald feststeht, wer beginnt. Ist die Zeit abgelaufen, steht dort „Overtime“ samt überzogener Zeit, das Handy vibriert einmal, und die Partie läuft weiter.
- **Expertenmodus** (unter „Optionen“): Vor der Partie wird festgelegt, wer beginnt (oder ausgelost). Wer am Zug ist, ist hervorgehoben und hat den Knopf „Pass turn“; jedes Antippen gibt den Zug an den anderen und zählt die Zugnummer weiter. Punkten dürfen jederzeit beide. „History“ zeigt je Punkt Spielzeit, Zug, Spieler, Art und Stand; Punkte in der Overtime sind markiert. Wird der Modus mitten in einer Partie eingeschaltet, fragt die App, wer gerade am Zug ist.
- „Gegenüber sitzen“ (unter „Optionen“) stellt die obere Hälfte auf den Kopf, damit zwei Spieler am selben Handy sitzen können; im Querformat stehen beide Hälften nebeneinander.
- Die laufende Partie übersteht das Schließen der App; der Bildschirm bleibt an, solange der Zähler offen ist.

### Sammlung

- Rasteransicht mit einer Kachel je Karte (nicht je Druck). Unter dem Bild steht der Bestand je Art, z. B. „Normal: 2 | Foil: 0 | Promo: 1“; Arten, die es von der Karte nicht gibt, fehlen. Normal und Foil sind Karten aus den Boostern (auch Alt-Art, Overnumbered, signiert), Promo ist alles mit Stempel oder besonderer Herkunft (Events, Turniere, Bundles), Metal und Metal Deluxe zählen als „Metal“ für sich.
- Antippen öffnet die Karte mit allen Fassungen. Bei Sonderausgaben steht die Herkunft dabei, z. B. „Nexus Night › Origins“, „Worlds 2026 Bundle“ oder „Regional Qualifier › Best Of (Origins, Spiritforged)“; bündelt ein Eintrag mehrere Sonderausgaben, steht sie bei jedem Finish.
- Filter nach Farbe, Kartentyp, Seltenheit, Variante, Set, Schlagwort und „besitze ich / fehlt“. Eine Karte erscheint, sobald eine ihrer Fassungen passt; „besitze ich / fehlt“ bezieht sich auf die passenden Fassungen.
- Jeder Filter erlaubt mehrere Werte, z. B. Calm und Body. Innerhalb eines Filters genügt einer der Werte, verschiedene Filter gelten gemeinsam. Bei Farbe und Schlagwort lässt sich umstellen, dass die Karte alle gewählten Werte tragen muss.
- Suche nach Name und Kartennummer, Hinzufügen auch ohne Scan.
- Suche im Kartentext in einem eigenen Feld: „move“ findet alle Karten, auf denen ein Wort mit „move“ beginnt (nicht „remove“). Der Text stammt aus dem Katalog und gilt je Karte, so wie er auf ihrem ersten Druck steht, samt Erklärungen in Klammern. Die Detailseite zeigt ihn an.
- Die Detailseite zeigt alle Drucke einer Karte nebeneinander, jeweils mit Bestand und Preis.
- Gesamtwert der Sammlung als Summe aus Low-Preis mal Menge.
- Export und Import als JSON (Sicherung) und als CSV.
- Jede Exportdatei lässt sich speichern (am PC mit Ortsauswahl, sonst als Download) oder über das Teilen-Menü des Handys weitergeben. Das Teilen-Menü nimmt keine .json-Dateien an; die Sicherung geht dort als .json.txt hinaus und lässt sich so auch wieder einspielen.
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
   - Gelesen wird nur an Entscheidungsstellen: wenn gleich aussehende Drucke verschiedene Nummern tragen oder der Bildabgleich unsicher ist. Der Text wird unscharf mit den Nummern der Kandidaten verglichen.
   - Ist der Bildabgleich sicher, wählt die Nummer nur zwischen gleich aussehenden Drucken (bis zu zwei Lesefehler). Einen unsicheren Bildtreffer bestätigt sie nur, wenn sie fehlerfrei gelesen wurde.
   - Die Zeile wird an mehreren leicht verschobenen Stellen gesucht, weil der Umriss auf echten Fotos selten genau sitzt.
   - Steht eine fehlerfrei gelesene Nummer im Katalog, obwohl der Bildabgleich die Karte nicht vorschlägt, rückt sie in der Auswahl nach vorn; von selbst gezählt wird auf dieser Grundlage nie.
   - Die Texterkennung ist eine Zugabe und hält den Scanner nie auf: Lädt sie nicht oder antwortet sie nicht innerhalb fester Fristen, zählt ein sicherer Bildtreffer ohne Nummer; die Diagnosezeile meldet dann „Nummernlesen nicht verfügbar“.
   - Grenzen: Drucke mit gleicher Nummer (mit und ohne Promo-Stempel) und signierte Fassungen (Sternchen) trennt die Nummer nicht; dort schlägt die App die gewöhnliche Fassung vor. Die Karte muss im Kamerabild etwa 480 Bildpunkte hoch sein.
4. **Entscheiden:** Ist ein Treffer über mehrere Bilder hinweg stabil und eindeutig, geht er in die Sitzung. Sonst erscheinen die Kandidaten zur Auswahl.

- **Fingerabdrücke** entstehen im täglichen Datenskript aus den Katalogbildern. Im Repository liegen nur die Fingerabdrücke (`data/fingerprints.json`), keine Bildkopien. Für die Entwicklung der Erkennung liegen die Bilder vorübergehend auf dem Entwicklungs-PC unter `.cache/images/` (nicht im Repository); nach Abschluss von M3 werden sie gelöscht.
- **Umrisssuche:** Drei Verfahren schlagen Vierecke vor: geschlossene Kanten, Abweichung von der Hintergrundfarbe und zusammenhängende Fläche mit viel Struktur (überbrückt den schwarzen Kartenrand auf dunklem Untergrund). Es gilt das Viereck, dessen Inhalt am besten zu einem Katalogbild passt.
- **Varianten:** Alt-Art und Overnumbered unterscheiden sich im Motiv und werden über den Fingerabdruck getrennt. Gleiches Motiv mit anderer Nummer trennt die Texterkennung.
- **Foil** wird nicht erkannt, sondern per Schalter gesetzt.
- **Ausweichlösung:** Reicht der Fingerabdruck nicht, ersetzt ein kleines Bildmodell im Browser (ONNX Runtime Web oder TensorFlow.js) Schritt 2. Der Rest bleibt gleich.

### Testsatz und Zielwerte

- Der Nutzer liefert mindestens 30 Fotos: normale Karten, Foils, Alt-Art, Overnumbered, mit und ohne Hülle, bei gutem und schlechtem Licht.
- Ablage unter `testdata/photos/`. Die erwartete Kartennummer steht in `labels.json` im selben Ordner oder am Anfang des Dateinamens, zum Beispiel `OGN-142_foil_huelle.jpg`.
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
- **Sammlungswert** rechnet mit Stufe 1 und nennt das Stand-Datum der Preisdatei. Karten ohne Preis (auch alle Metal-Fassungen) und Angebote ohne belegten Verkauf zählen nicht mit; die App nennt ihre Anzahl.
- **Android-App:** holt Preise und Katalog beim Start von GitHub Pages und merkt sie sich. Neue Daten gelten ab dem nächsten Start. Neue Versionen der App lädt sie ebenfalls selbst nach; nur für Änderungen an der Android-Hülle zeigt sie einen Hinweis mit Link zur neuen APK.
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
| Texterkennung | Tesseract.js, nur die Zeile der Kartennummer; die App liefert Rechenkern und Sprachmodell selbst aus (rund 7 MB, erst beim Scannen geladen) | Kleiner Ausschnitt, eingeschränkter Zeichensatz, keine fremden Server |
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
   - Stand 15.11.2026: gebaut. Der tägliche Lauf ist eingerichtet (04:30 UTC); die drei Tage und die Stichproben (`docs/m2-stichproben.md`) stehen noch aus.
   - Abnahme: Zehn Stichproben stimmen mit dem Low-Wert auf der Cardmarket-Seite des Vortags überein.
4. **M3 Erkennung.** Fingerabdrücke, Erkennungskette, automatischer Test gegen die Fotos.
   - Abnahme: Die Zielwerte aus dem Abschnitt Kartenerkennung sind auf dem Testsatz erreicht.
   - Stand 15.11.2026: vorbereitet ohne echte Fotos. Fingerabdrücke aller 1.804 Katalogbilder liegen vor; Umrisssuche, Entzerrung und Abgleich sind gebaut und mit künstlich verzerrten Katalogbildern geprüft (`docs/m3-selbsttest.md`, `docs/m3-szenentest.md`). Seit 15.11.2026 liest die App auch die Kartennummer (`docs/m3-nummern.md`).
   - Stand 15.11.2026 mit 43 Fotos des Nutzers (`docs/m3-fotos.md`): richtige Karte an erster Stelle 93,0 %, unter den ersten drei 95,3 %; 38 Karten hätte die App von selbst gezählt, keine davon falsch. Die Zielwerte (95 % und 99 %) sind noch nicht erreicht. Schwachstellen: Karten in Hüllen auf dunklem Untergrund, eine in der Hand gehaltene Karte, Promo-Fassungen mit gleicher Nummernzeile. Offen bleibt die Geschwindigkeitsmessung auf dem Handy.
   - Abnahme: Der Test läuft bei jeder Änderung automatisch mit.
5. **M4 Scan-Sitzung.** Fortlaufendes Scannen, Sitzungsliste, Übernahme der Auswahl.
   - Stand 15.11.2026: Scan-Seite und Sitzungsliste sind gebaut, vorgezogen vor die Abnahme von M3, damit der Nutzer mit echten Karten testen kann. Geprüft mit Testfotos im Browser und automatischen Tests der Zähl-Logik; mit einer echten Kamera noch nicht. Drucke, die sich weder im Bild noch in der Nummer unterscheiden, wählt der Nutzer unter „Andere Fassung dieser Karte“.
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

- [x] 43 Testfotos liegen unter `testdata/photos/` (lokal, nicht im Repository). Welche Karte jedes Foto zeigt, steht in `testdata/photos/labels.json`. Metal-Karten sind noch nicht dabei.
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
