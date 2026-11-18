# Prüfliste fürs Handy

Stand 18.11.2026, App-Version 0.1.25. Fasst alle Prüfungen zusammen, die laut [CLAUDE.md](CLAUDE.md) und [SPEC.md](SPEC.md) noch offen sind. Dauer: rund 60 Minuten am Handy, dazu 15 Minuten am PC. Die Preisprüfung in Teil 4 läuft über drei Tage.

Das Menü heißt ab Version 0.1.26: Sammlung, Scannen, Punkte, Events, Info. In älteren Versionen steht „Sicherung“ statt „Info“ und „Spieler“ statt „Events“.

Zu jedem Punkt: abhaken, wenn es stimmt. Stimmt etwas nicht, kurz dazuschreiben, was stattdessen passiert ist.

**Bereitlegen:** 20 verschiedene Karten (darunter 5 in Hüllen, 2 Foils, 1 Promo, 2 Legenden, wenn vorhanden 1 Metal), eine helle und eine dunkle Unterlage, für Teil 6 nach Möglichkeit eine zweite Person.

## 0. Vorab: sichern, dann die neue APK

Version 0.1.25 braucht einmal eine neue APK von Hand. Die Reihenfolge ist wichtig.

- [ ] In der **alten** App, Seite „Sicherung“ (dort heißt sie noch so): Zahl der Karten notieren, die oben steht: ______
- [ ] „Sicherung speichern“ antippen, dann „Teilen“ und die Datei an Google Drive oder E-Mail schicken. Diese Datei ist die Rückversicherung für alle folgenden Schritte.
- [ ] Die APK laden (https://github.com/Minusprivat/personal-card-scanner/releases/download/apk/card-scanner.apk) und **über die vorhandene App installieren, ohne sie vorher zu deinstallieren**.
- [ ] Verlangt Android, die alte App erst zu entfernen? Dann nicht weitermachen, sondern den Wortlaut der Meldung notieren.
- [ ] Seite „Info“, ganz unten: Dort steht „Version 0.1.25 · Android-App“ (oder höher).
- [ ] Oben auf der Seite steht dieselbe Kartenzahl wie vor der Installation.

## 1. Bleibt die Sammlung bei einem Update erhalten?

Am 18.11.2026 gemeldet: Nach einem Update war die Sammlung leer und musste neu eingespielt werden. Wahrscheinliche Ursache: Für einen Schritt war eine neue APK nötig, und die alte App wurde dabei entfernt. Eine Deinstallation löscht die Sammlung, und Android lässt die neu installierte App die alten Sicherungen nicht von selbst lesen (deshalb kam auch kein Angebot zum Wiederherstellen). Im Code löscht bei einem Update nichts die Sammlung. Die Punkte hier bestätigen oder widerlegen das.

Ist die Sammlung nach einer Neuinstallation leer: Seite „Info“ → „Sicherung einspielen“ → Ordner „Dokumente/CardScanner“ → neueste Datei „card-scanner-auto-…“.

- [ ] **Selbst-Update:** Nach dem nächsten Versionswechsel (Seite „Info“ → „Nach Updates suchen“ → „Jetzt neu starten“) steht dieselbe Kartenzahl wie vorher.
- [ ] Ist die Sammlung doch leer: Erscheint oben der Hinweis „Im Ordner ‚Dokumente/CardScanner‘ liegt eine Sicherung …“ mit „Wiederherstellen“?
- [ ] Nur falls es zu einer Neuinstallation mit leerer Sammlung kommt: Oben steht der Hinweis „War die App schon einmal installiert? …“ mit „Zur Sicherung“ und „Ausblenden“. Der beschriebene Weg führt zur Datei und bringt die Sammlung zurück.
- [ ] Ist die Sammlung doch leer: Was steht auf der Seite „Info“ (0 Karten, oder Karten mit dem Zusatz „… Fassungen stehen nicht mehr im Katalog“)?

## 2. Gerüst und Sammlung (M1)

- [ ] Flugmodus an, App schließen und neu öffnen: Sie startet und zeigt die Sammlung mit Bildern der schon gesehenen Karten.
- [ ] Eine Karte öffnen und jedes Finish für sich hoch- und herunterzählen (Normal, Foil, bei Metal-Karten Metal und Metal Deluxe).
- [ ] Die Kachel in der Übersicht zeigt danach den Bestand je Art, z. B. „Normal: 2 | Foil: 0 | Promo: 1“.
- [ ] In der Kartenansicht bleibt der Kopf mit „Zurück“, Name und Bestand beim Scrollen oben stehen; die Zurück-Taste des Handys führt zur Übersicht.
- [ ] Filter: zwei Farben zugleich wählen (z. B. Calm und Body), dazu einen Kartentyp. Die Liste passt.
- [ ] Suche im Kartentext: „move“ findet Karten mit „move“, aber keine, die nur „remove“ enthalten.
- [ ] „Besitze ich“ zeigt nur Karten mit Bestand, „Fehlt mir“ nur die anderen.
- [ ] Legenden: Die Suche nach „Jinx“ zeigt vier Karten, darunter „Jinx, Loose Cannon“.
- [ ] Legenden: Filter → Kartentyp „Legend“ zeigt die Legenden, jede mit dem Champion im Namen (z. B. „Irelia, Blade Dancer“).
- [ ] Legenden: Die Kartenansicht einer Legende zeigt die normale Fassung, Overnumbered und die signierte (Nummer mit Sternchen); jede lässt sich für sich zählen.
- [ ] Legenden: Die Fassungen stehen in dieser Reihenfolge: normales Motiv, Overnumbered, Overnumbered signiert, danach die Promos und Metal-Fassungen.
- [ ] Legenden: Eine eigene Legende über ihren Champion suchen und den Bestand eintragen. Fehlt eine Fassung, die du besitzt: Nummer notieren.
- [ ] Sicherung und zurück: „Sicherung speichern“, eine Menge ändern, „Sicherung einspielen“ mit der eben gespeicherten Datei. Die alte Menge ist wieder da.
- [ ] „Teilen“ bei der Sicherung: Die Datei kommt als `.json.txt` an und lässt sich über „Sicherung einspielen“ wieder einlesen.
- [ ] Am PC: „Für Piltover Archive speichern“ und die Datei bei Piltover Archive importieren. Notieren, ob der Import durchläuft und welche Zeilen Piltover ablehnt.

## 3. Automatische Sicherung (nur Android-App)

- [ ] Eine Menge ändern, zehn Sekunden warten: Auf der Seite „Info“ steht „Automatische Sicherung: zuletzt am … mit … Karten, Datei ‚card-scanner-auto-…‘“.
- [ ] In der Dateien-App des Handys liegt diese Datei unter „Dokumente/CardScanner“.
- [ ] Es steht **kein** roter Hinweis „Die automatische Sicherung ist zuletzt gescheitert“. Wenn doch: Wortlaut notieren.
- [ ] Am nächsten Tag noch einmal ändern: Es gibt eine zweite Datei mit dem neuen Datum.
- [ ] Wiederherstellen (nur mit der Rückversicherung aus Teil 0): Android-Einstellungen → Apps → Card Scanner → Speicher → „Daten löschen“. App öffnen: Sie bietet die Sicherung an, „Wiederherstellen“ bringt die Kartenzahl zurück.

## 4. Preise (M2)

- [ ] Drei Tage in Folge: Das Stand-Datum der Preise in der App ist jeweils das neue. Daten notieren: ______ / ______ / ______
- [ ] Der Sammlungswert steht in der Übersicht und nennt, wie viele Karten ohne Preis nicht mitzählen.
- [ ] Am PC: die zehn Stichproben aus [docs/m2-stichproben.md](docs/m2-stichproben.md) mit Cardmarket vergleichen. Die Datei ist vom 15.11.; vor dem Vergleich bei Claude neue Stichproben vom Vortag anfordern.
- [ ] „Auf Cardmarket (EN) öffnen“ bei einer Foil-Karte: Die Seite zeigt nur englische Foil-Angebote (prüft den Filter `isFoil=Y`).

## 5. Scanner (M3 und M4)

Erst auf heller Unterlage, dann auf dunkler. Die graue Zeile ganz unten auf der Scan-Seite („Abstand … · Vorsprung … · … ms“) ist die Diagnosezeile.

- [ ] „Scannen“ öffnen: Die App fragt nach der Kamera, das Bild der Rückkamera erscheint, „Erkennung wird geladen …“ verschwindet. Dauer bis dahin: ______ Sekunden
- [ ] Eine Karte ins Bild halten: Umriss wird eingezeichnet, „Erkannt“, das Handy vibriert kurz, die Karte steht unter „Sitzung“.
- [ ] Die Karte liegen lassen: Sie wird nicht ein zweites Mal gezählt.
- [ ] Karte wegnehmen und wieder hinlegen: Der Zähler der Zeile steigt auf 2.
- [ ] **20 Karten nacheinander:** Am Ende stehen 20 Karten in der Sitzung, keine doppelt. Anzahl richtig von selbst gezählt: ______ · Auswahl angeboten: ______ · **falsche Karte von selbst gezählt: ______** · falsche Fassung von selbst gezählt (z. B. Promo als normale): ______
- [ ] Zu jeder falsch gezählten oder nicht erkannten Karte: aufgedruckte Nummer und die Diagnosezeile notieren, die Karte fotografieren (Foto für `testdata/photos/`).
- [ ] Geschwindigkeit: Bei fünf Karten die Millisekunden aus der Diagnosezeile notieren: ______ Ziel: unter 1000.
- [ ] Nummernlesen: Bei einer Promo oder einer Karte mit Auswahl erscheint in der Diagnosezeile „Nummer ‚…‘“ und **nicht** „Nummernlesen nicht verfügbar“.
- [ ] 5 Karten in Hüllen auf dunkler Unterlage: erkannt ______ von 5.
- [ ] 2 Legenden scannen: erkannt ______ von 2, angezeigt als „Champion, Titel“. Notieren, ob die richtige Fassung (normal, Overnumbered, signiert) gezählt wurde.
- [ ] Eine Karte in der Hand gehalten: erkannt ja / nein.
- [ ] „Licht an“ schaltet das Kameralicht (fehlt der Knopf, lässt das Handy es nicht zu: notieren).
- [ ] Bei „Welche Karte ist es?“ zählt das Antippen einer Fassung genau diese.
- [ ] Bei der zuletzt gescannten Karte: Finish auf Foil umstellen, „Andere Fassung dieser Karte“ wählen, „Rückgängig“ nimmt den Scan zurück.
- [ ] Warnung: Eine Karte scannen, von der schon 4 vorhanden sind (Sammlung plus Sitzung). Roter Hinweis, langes Vibrationsmuster, die Zeile in der Sitzung ist markiert.
- [ ] In der Sitzung zwei Zeilen abwählen, „Auswahl übernehmen“: Nur die angehakten Karten sind in der Sammlung.
- [ ] Mit offener Sitzung die App ganz schließen und neu öffnen: Die Sitzung ist noch da.
- [ ] Das Handy wird nach fünf Minuten Scannen nicht unangenehm heiß.

## 6. Punktezähler

- [ ] „Punkte“ öffnet den Zähler auch im Flugmodus.
- [ ] „Conquer“ und „Hold“ zählen je einen Punkt; „−1“ und „Zurück“ nehmen zurück, auch den Siegpunkt; bei 8 endet die Partie.
- [ ] Der Bildschirm bleibt an, solange der Zähler offen ist (zwei Minuten nichts antippen).
- [ ] Optionen → Zeitlimit „eigene“ 1 Minute: Nach Ablauf steht „Overtime“, das Handy vibriert einmal, die Partie läuft weiter.
- [ ] Optionen → „Gegenüber sitzen“: Die obere Hälfte steht auf dem Kopf; zu zweit lässt sich bequem bedienen, niemand trifft die Knöpfe des anderen.
- [ ] Handy quer halten (automatisches Drehen in Android eingeschaltet): Der Zähler bleibt im Hochformat.
- [ ] Optionen → „Expertenmodus“: „Wer beginnt?“ erscheint, „Pass turn“ wechselt den Zug und zählt die Zugnummer, „History“ zeigt Zeit, Zug, Spieler, Punkt und Stand.
- [ ] Laufende Partie, App schließen und öffnen: Stand und Uhr stimmen noch.

## 7. Spielerdaten

- [ ] „Events“ → „Events finden und anmelden“: Die Seite von Riot öffnet sich als Fenster **über** der App (mit Schließen-Kreuz oben), nicht in einem getrennten Chrome.
- [ ] In diesem Fenster bist du bei Riot angemeldet oder kannst dich anmelden; nach dem Schließen und erneuten Öffnen bist du es noch.
- [ ] Schließen des Fensters führt zurück in die App, an dieselbe Stelle.
- [ ] Den Link zur eigenen BoundRift-Seite einfügen und „Speichern“: „Mein Profil öffnen“ zeigt danach das eigene Profil. Ein falscher Link ergibt die rote Meldung.

## 8. Gestaltung

- [ ] Die Kopfzeile zeigt alle fünf Einträge in einer Zeile (Sammlung, Scannen, Punkte, Events, Info), nichts ist abgeschnitten, und jeder Eintrag führt auf die richtige Seite.
- [ ] Goldene Überschriften und der helle Text sind bei Tageslicht draußen lesbar.
- [ ] Alle Knöpfe lassen sich mit dem Daumen sicher treffen; besonders Filter, Mengen-Knöpfe und die Zeilen der Sitzung.
- [ ] Karten im Besitz sind in der Übersicht auf einen Blick von fehlenden zu unterscheiden.
- [ ] Nichts ruckelt beim Scrollen durch die ganze Sammlung.
- [ ] Handy quer halten, auf jeder der fünf Seiten: Die App bleibt im Hochformat. Auf der Scan-Seite steht das Kamerabild dabei aufrecht.

## Rückmeldung

Am meisten helfen: die Zahlen aus Teil 5, Fotos der Karten, die der Scanner nicht oder falsch erkannt hat, der Wortlaut jeder Fehlermeldung und die Antworten aus Teil 1.
