# M0-Bericht: Datenprüfung

Erzeugt von `npm run data:report`. Nicht von Hand bearbeiten; Änderungen gehören in `scripts/build-data/report.ts`.

- **Katalog:** OpenRift, abgerufen am 14.11.2026
- **Preise:** Cardmarket-Preisdatei vom 13.11.2026 (2001 Produkte)
- **Umfang:** 1100 Karten, 1889 Drucke, 2529 Druck-Finish-Kombinationen in 11 Sets (nur Englisch)

## Abnahme

| Kriterium | Ergebnis | Erfüllt |
| --- | --- | --- |
| Bericht nennt Drucke je Set und Variante, Variantenfelder und Preisanteil | siehe unten | ja |
| Mindestens 95 % der Normal- und Foil-Drucke regulärer Sets haben einen Preis | 96,0 % (2195 von 2286) | ja |
| Alle übrigen stehen namentlich in einer Liste | [m0-ohne-preis.md](m0-ohne-preis.md): 107 Normal/Foil, 165 Metal | ja |

Die Grenze gilt für Normal und Foil. Metal und Metal Deluxe sind ausgenommen, weil Cardmarket für sie keinen Preis liefert (siehe Abweichungen).

## Drucke je Set und Variante

Ein Druck ist eine physische Fassung (Set, Nummer, Variante, Stempel). Die vier rechten Spalten zählen, in welchen Finishes die Drucke vorkommen.

| Set | Name | Art | Drucke | Alt-Art | Overnumbered | Signiert | Mit Stempel | Übergröße | Ohne Bild | Normal | Foil | Metal | Metal Deluxe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OGS | Proving Grounds | Zusatz | 45 | 0 | 4 | 0 | 21 | 0 | 0 | 25 | 16 | 4 | 8 |
| OGN | Origins | regulär | 431 | 54 | 36 | 12 | 75 | 7 | 12 | 178 | 404 | 12 | 24 |
| SFD | Spiritforged | regulär | 368 | 38 | 54 | 12 | 65 | 2 | 14 | 135 | 329 | 12 | 24 |
| UNL | Unleashed | regulär | 382 | 50 | 43 | 12 | 80 | 2 | 18 | 142 | 327 | 12 | 24 |
| VEN | Vendetta | regulär | 317 | 37 | 49 | 9 | 69 | 2 | 33 | 108 | 276 | 9 | 18 |
| RAD | Radiance | regulär | 311 | 45 | 42 | 15 | 71 | 10 | 18 | 116 | 271 | 9 | 9 |
| T1A | T1 2025 Worlds Champion Player Bundle | Zusatz | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |
| T1S | T1 2025 Worlds Champion Signature Edition | Zusatz | 10 | 0 | 0 | 5 | 5 | 0 | 5 | 0 | 10 | 0 | 0 |
| SGN | Secret Garden | Zusatz | 11 | 8 | 0 | 0 | 11 | 0 | 0 | 8 | 5 | 0 | 0 |
| KDA | K/DA Couture Collection | Zusatz | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |
| W26 | Worlds 2026 Bundle | Zusatz | 4 | 4 | 0 | 0 | 4 | 0 | 0 | 0 | 4 | 0 | 0 |

### Finishes je Druck

| Finishes | Drucke |
| --- | --- |
| Foil | 1037 |
| Normal + Foil | 599 |
| Normal | 113 |
| Metal Deluxe | 82 |
| Metal | 33 |
| Foil + Metal + Metal Deluxe | 16 |
| Metal + Metal Deluxe | 9 |

1037 Drucke gibt es nur als Foil. Bei ihnen ist der Foil-Schalter vorbelegt.

### Stempel

| Stempel | Drucke |
| --- | --- |
| (kein Stempel) | 1488 |
| promo | 342 |
| summoner | 18 |
| regional-qualifier | 9 |
| champion + summoner | 9 |
| serial-number | 5 |
| judge + promo | 4 |
| origins + promo | 3 |
| prerelease + promo | 3 |
| regional-championship | 3 |
| summoner + top-8 | 2 |
| launch-exclusive + promo | 1 |
| champion + regional-qualifier | 1 |
| champion + regional-championship | 1 |

## Variantenfelder des Katalogs

Jeder Eintrag unter `printings` ist eine Kombination aus Druck und Finish.

| Feld | Bedeutung | Werte |
| --- | --- | --- |
| `artVariant` | Motiv-Variante | normal (1653), altart (235), ultimate (1) |
| `isOvernumbered` | Nummer über der Setgröße, z. B. 222/219 | true, false |
| `isSigned` | Signatur-Fassung | true, false |
| `markers` | Stempel auf der Karte (Promo, Judge, Turnierplatzierung …) | Liste von Kürzeln, siehe oben |
| `finish` | Oberfläche | normal, foil, metal, metal-deluxe |
| `size` | Kartengröße | standard, oversized |
| `shortCode`, `publicCode` | Kartennummer kurz und wie aufgedruckt | z. B. OGN-142 und OGN-142/298 |
| `distributionChannels` | Vertriebsweg (Booster, Turnier, Bundle …) | Liste; für „Special Collection“ gibt es kein eigenes Feld |
| `images[].imageId` | Bild, abrufbar unter `/media/cards/{imageId}-{size}.webp` | 1804 verschiedene Bilder |

## Preisabdeckung

Gezählt werden Normal- und Foil-Fassungen. Preis heißt: Cardmarket-Produkt verknüpft und `low` (Normal) oder `low-foil` (Foil) größer als 0.

| Set | Art | Normal + Foil | Mit Preis | Anteil |
| --- | --- | --- | --- | --- |
| OGS | Zusatz | 41 | 41 | 100,0 % |
| OGN | regulär | 582 | 573 | 98,5 % |
| SFD | regulär | 464 | 460 | 99,1 % |
| UNL | regulär | 469 | 462 | 98,5 % |
| VEN | regulär | 384 | 374 | 97,4 % |
| RAD | regulär | 387 | 326 | 84,2 % |
| T1A | Zusatz | 5 | 0 | 0,0 % |
| T1S | Zusatz | 10 | 10 | 100,0 % |
| SGN | Zusatz | 13 | 11 | 84,6 % |
| KDA | Zusatz | 5 | 0 | 0,0 % |
| W26 | Zusatz | 4 | 0 | 0,0 % |
| **Reguläre Sets** |  | 2286 | 2195 | **96,0 %** |
| Alle Sets |  | 2364 | 2257 | 95,5 % |

Gründe für fehlende Preise in regulären Sets: kein Cardmarket-Produkt (89), kein Low-Preis (2).

## Antworten auf die offenen Punkte

1. **Variantenfelder:** siehe Tabelle oben. Alt-Art steht in `artVariant`, Overnumbered in `isOvernumbered`, Signature in `isSigned`, das Finish in `finish`. Promos und Turnierkarten tragen einen Eintrag in `markers`. „Special Collection“ ist kein Feld, sondern ergibt sich aus Set und Vertriebsweg.
2. **Abdeckung von `/api/v1/prices/links`:** 2259 von 2529 Einträgen haben ein Cardmarket-Produkt. Jeder Eintrag verweist auf genau ein Produkt; bei mehreren passenden Produkten liefert OpenRift das günstigste. 2 Produkte werden von mehr als einem Druck genutzt.
3. **`low-foil`:** Bei Drucken mit Normal und Foil sind beide Werte getrennt vorhanden. Bei reinen Foil-Drucken stehen `low` und `low-foil` beide in der Datei und sind gleich (965 von 965 geprüften Produkten). Nur als Foil gibt es 1037 Drucke. Preise ohne Trend und ohne Durchschnitt, also ohne belegten Verkauf: 1. Sie gelten in M2 als mögliche Platzhalter.
4. **Englisch-Filter bei Cardmarket:** `language=1`. Alle Produktlinks von OpenRift haben die Form `https://www.cardmarket.com/en/Riftbound/Products?idProduct=…&language=1`. Auf der Cardmarket-Seite selbst ließ sich das nicht automatisch gegenprüfen, weil sie automatische Zugriffe abweist; die Sichtprüfung gehört zur Abnahme von M2.
5. **CardTrader-Spracheigenschaft:** offen. Die Antwort braucht einen Abruf mit Token und wird erst für M5 benötigt.
6. **GitHub Pages:** Im kostenlosen Tarif nur für öffentliche Repositorys (GitHub-Dokumentation, „What is GitHub Pages“). Die Sammlung liegt nur auf dem Handy und ist davon nicht betroffen.

## Abweichungen von der SPEC

| Annahme der SPEC | Tatsächlich | Umsetzung |
| --- | --- | --- |
| Zwei Finishes: Normal und Foil | Vier: zusätzlich Metal und Metal Deluxe (165 Einträge, 0 mit Cardmarket-Produkt) | Eigene Zähler für alle vier; Metal zeigt „kein Preis“ und zählt nicht in den Sammlungswert |
| Ein Druck hat eine Liste verfügbarer Finishes | Der Katalog führt jedes Finish als eigenen Eintrag | Die App fasst Einträge zu Drucken zusammen (`src/data/prints.ts`); der Bestand hängt am Eintrag |
| 95 % aller Drucke regulärer Sets haben einen Preis | Mit Metal wären es weniger; ohne Metal 96,0 % | Grenze gilt für Normal und Foil |
| Preise ersatzweise aus `/api/v1/prices` | Enthält Platzhalter (z. B. SFD-178a mit 100.000 €) | Preise kommen nur aus der Cardmarket-Datei |
| Jeder Druck hat ein Bild | 100 Drucke ohne Bild | Nicht scanbar, nur über die Suche hinzufügbar |
| Motiv unterscheidet die Drucke | 297 von 1313 Motiven gibt es in mehreren Drucken (Stempel, andere Nummer) | Kartennummer per Texterkennung, sonst Kandidatenauswahl |

## Noch offen

- **Piltover Archive:** Das Import- und Exportformat ist nur angemeldet einsehbar. Für M1 wird eine echte Exportdatei aus dem Konto des Nutzers als Vorlage gebraucht.
- **CardTrader:** siehe Punkt 5.
