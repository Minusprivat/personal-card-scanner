# Personal Card Scanner via Claude

Private Riftbound-Sammlungs-App als PWA für Android. Maßgeblich ist [SPEC.md](SPEC.md); die Meilensteine werden der Reihe nach abgearbeitet. Oberfläche und alle Texte der App sind auf Deutsch.

## Stand

- **M0 Datenprüfung:** fertig, Ergebnis in [docs/m0-bericht.md](docs/m0-bericht.md).
- **M1 Gerüst und Sammlung:** offen. Vite, React und die PWA kommen erst hier dazu.

## Befehle

| Zweck | Befehl |
| --- | --- |
| Abhängigkeiten installieren | `npm install` |
| Tests | `npm test` |
| Typprüfung | `npm run typecheck` |
| Katalog und Preise laden, M0-Bericht neu schreiben | `npm run data:report` |
| Dasselbe ohne Netz, aus `.cache/` | `npm run data:report:offline` |

Build und Deploy gibt es noch nicht; sie folgen mit M1 (GitHub Pages) und M2 (tägliche GitHub Action).

## Aufbau

- `src/data/` – Datenmodell und reine Logik, von App und Datenskript gemeinsam genutzt.
  - `model.ts`: Card, Print (Druck), Sku (Druck + Finish), `CatalogSource`.
  - `prints.ts`: fasst Skus zu Drucken zusammen.
  - `prices.ts`: Cardmarket Low je Finish, „kein Preis“ statt 0 €.
- `scripts/build-data/` – Node-Datenskript.
  - `sources/openrift.ts`: einzige Stelle, die das OpenRift-Format kennt.
  - `sources/cardmarket.ts`: Cardmarket-Preisdatei.
  - `http.ts`: Abruf mit User-Agent, Zwischenspeicher und ETag.
  - `stats.ts`, `report.ts`: Auswertung und M0-Bericht.
- `tests/` – Vitest. `m0-abnahme.test.ts` prüft die Abnahmekriterien gegen die Daten in `.cache/` und wird ohne Zwischenspeicher übersprungen.
- `docs/` – erzeugte Berichte. Nicht von Hand ändern.

## Regeln

- Die Katalogquelle bleibt austauschbar: Außerhalb von `scripts/build-data/sources/` kennt kein Code das OpenRift-Format.
- Fremde Schnittstellen sparsam abrufen: Katalog und Preise höchstens einmal pro Stunde (`http.ts` erzwingt das), Bilder nur für neue Drucke und gedrosselt.
- Keine Kartenbilder im Repository, nur daraus berechnete Fingerabdrücke.
- Preise kommen nur aus der Cardmarket-Preisdatei, nicht aus OpenRifts `/api/v1/prices` (enthält Platzhalter).
- Bestand und Preis hängen an der Sku. Es gibt vier Finishes: Normal, Foil, Metal, Metal Deluxe. Metal hat keinen Cardmarket-Preis.
- Stimmt eine Annahme der SPEC nicht: anhalten, Abweichung mit Vorschlag nennen, dann weiterbauen.
- Jeder Meilenstein endet mit Tests für die Abnahmekriterien und einer Prüfanleitung fürs Handy; danach auf Freigabe warten.
