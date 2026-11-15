import { FINISH_LABELS, FINISHES, type Catalog } from '../../src/data/model';
import { cardmarketEnglishUrl, formatDay, formatEuro, type PriceData } from '../../src/data/prices';
import { variantLabel } from '../../src/data/prints';
import { pct, type Coverage, type M0Stats, type UnpricedSku } from './stats';

/** Abnahmegrenze M0: Anteil der Normal- und Foil-Drucke regulärer Sets mit Preis. */
export const MIN_MAIN_COVERAGE_PCT = 95;

const de = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');
const percent = (c: Coverage) => `${de(pct(c))} %`;
const date = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');
const table = (head: string[], rows: Array<Array<string | number>>) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join(
    '\n',
  );
const sortedEntries = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]);
const setTypeLabel = (t: string) => (t === 'main' ? 'regulär' : 'Zusatz');

export function renderReport(s: M0Stats): string {
  const ok = pct(s.coverageMain) >= MIN_MAIN_COVERAGE_PCT;
  const unpricedMain = s.unpriced.filter((u) => u.setType === 'main');
  const reasonCounts: Record<string, number> = {};
  for (const u of unpricedMain) reasonCounts[u.reason] = (reasonCounts[u.reason] ?? 0) + 1;

  return `# M0-Bericht: Datenprüfung

Erzeugt von \`npm run data:report\`. Nicht von Hand bearbeiten; Änderungen gehören in \`scripts/build-data/report.ts\`.

- **Katalog:** OpenRift, abgerufen am ${date(s.catalogFetchedAt)}
- **Preise:** Cardmarket-Preisdatei vom ${date(s.priceGuideCreatedAt)} (${s.checks.priceGuideProducts} Produkte)
- **Umfang:** ${s.cards} Karten, ${s.prints} Drucke, ${s.skus} Druck-Finish-Kombinationen in ${s.sets} Sets (nur Englisch)

## Abnahme

| Kriterium | Ergebnis | Erfüllt |
| --- | --- | --- |
| Bericht nennt Drucke je Set und Variante, Variantenfelder und Preisanteil | siehe unten | ja |
| Mindestens ${MIN_MAIN_COVERAGE_PCT} % der Normal- und Foil-Drucke regulärer Sets haben einen Preis | ${percent(s.coverageMain)} (${s.coverageMain.priced} von ${s.coverageMain.eligible}) | ${ok ? 'ja' : '**nein**'} |
| Alle übrigen stehen namentlich in einer Liste | [m0-ohne-preis.md](m0-ohne-preis.md): ${s.unpriced.length} Normal/Foil, ${s.metalList.length} Metal | ja |

Die Grenze gilt für Normal und Foil. Metal und Metal Deluxe sind ausgenommen, weil Cardmarket für sie keinen Preis liefert (siehe Abweichungen).

## Drucke je Set und Variante

Ein Druck ist eine physische Fassung (Set, Nummer, Variante, Stempel). Die vier rechten Spalten zählen, in welchen Finishes die Drucke vorkommen.

${table(
  ['Set', 'Name', 'Art', 'Drucke', 'Alt-Art', 'Overnumbered', 'Signiert', 'Mit Stempel', 'Übergröße', 'Ohne Bild', ...FINISHES.map((f) => FINISH_LABELS[f])],
  s.bySet.map((x) => [
    x.code,
    x.name,
    setTypeLabel(x.type),
    x.prints,
    x.altArt,
    x.overnumbered,
    x.signed,
    x.withMarker,
    x.oversized,
    x.printsWithoutImage,
    ...FINISHES.map((f) => x.skusByFinish[f]),
  ]),
)}

### Finishes je Druck

${table(
  ['Finishes', 'Drucke'],
  sortedEntries(s.finishCombos).map(([k, v]) => [k.split(' + ').map((f) => FINISH_LABELS[f as keyof typeof FINISH_LABELS] ?? f).join(' + '), v]),
)}

${s.foilOnlyPrints} Drucke gibt es nur als Foil. Bei ihnen ist der Foil-Schalter vorbelegt.

### Stempel

${table(['Stempel', 'Drucke'], sortedEntries(s.markerCombos).map(([k, v]) => [k, v]))}

## Variantenfelder des Katalogs

Jeder Eintrag unter \`printings\` ist eine Kombination aus Druck und Finish.

| Feld | Bedeutung | Werte |
| --- | --- | --- |
| \`artVariant\` | Motiv-Variante | ${sortedEntries(s.artVariants).map(([k, v]) => `${k} (${v})`).join(', ')} |
| \`isOvernumbered\` | Nummer über der Setgröße, z. B. 222/219 | true, false |
| \`isSigned\` | Signatur-Fassung | true, false |
| \`markers\` | Stempel auf der Karte (Promo, Judge, Turnierplatzierung …) | Liste von Kürzeln, siehe oben |
| \`finish\` | Oberfläche | normal, foil, metal, metal-deluxe |
| \`size\` | Kartengröße | standard, oversized |
| \`shortCode\`, \`publicCode\` | Kartennummer kurz und wie aufgedruckt | z. B. OGN-142 und OGN-142/298 |
| \`distributionChannels\` | Vertriebsweg (Booster, Turnier, Bundle …) | Liste; für „Special Collection“ gibt es kein eigenes Feld |
| \`images[].imageId\` | Bild, abrufbar unter \`/media/cards/{imageId}-{size}.webp\` | ${s.distinctImages} verschiedene Bilder |

## Preisabdeckung

Gezählt werden Normal- und Foil-Fassungen. Preis heißt: Cardmarket-Produkt verknüpft und \`low\` (Normal) oder \`low-foil\` (Foil) größer als 0.

${table(
  ['Set', 'Art', 'Normal + Foil', 'Mit Preis', 'Anteil'],
  [
    ...s.coverageBySet.map((c) => [c.code, setTypeLabel(c.type), c.eligible, c.priced, percent(c)]),
    ['**Reguläre Sets**', '', s.coverageMain.eligible, s.coverageMain.priced, `**${percent(s.coverageMain)}**`],
    ['Alle Sets', '', s.coverageAll.eligible, s.coverageAll.priced, percent(s.coverageAll)],
  ],
)}

Gründe für fehlende Preise in regulären Sets: ${sortedEntries(reasonCounts).map(([k, v]) => `${k} (${v})`).join(', ') || 'keine'}.

## Antworten auf die offenen Punkte

1. **Variantenfelder:** siehe Tabelle oben. Alt-Art steht in \`artVariant\`, Overnumbered in \`isOvernumbered\`, Signature in \`isSigned\`, das Finish in \`finish\`. Promos und Turnierkarten tragen einen Eintrag in \`markers\`. „Special Collection“ ist kein Feld, sondern ergibt sich aus Set und Vertriebsweg.
2. **Abdeckung von \`/api/v1/prices/links\`:** ${s.skusWithCardmarketProduct} von ${s.skus} Einträgen haben ein Cardmarket-Produkt. Jeder Eintrag verweist auf genau ein Produkt; bei mehreren passenden Produkten liefert OpenRift das günstigste. ${s.checks.productsUsedBySeveralPrints} Produkte werden von mehr als einem Druck genutzt.
3. **\`low-foil\`:** Bei Drucken mit Normal und Foil sind beide Werte getrennt vorhanden. Bei reinen Foil-Drucken stehen \`low\` und \`low-foil\` beide in der Datei und sind gleich (${s.checks.foilOnlyProductsLowEqualsLowFoil} von ${s.checks.foilOnlyProductsWithBothLows} geprüften Produkten). Nur als Foil gibt es ${s.foilOnlyPrints} Drucke. Preise ohne Trend und ohne Durchschnitt, also ohne belegten Verkauf: ${s.checks.pricedSkusWithoutSales}. Sie gelten in M2 als mögliche Platzhalter.
4. **Englisch-Filter bei Cardmarket:** \`language=1\`. Alle Produktlinks von OpenRift haben die Form \`https://www.cardmarket.com/en/Riftbound/Products?idProduct=…&language=1\`. Auf der Cardmarket-Seite selbst ließ sich das nicht automatisch gegenprüfen, weil sie automatische Zugriffe abweist; die Sichtprüfung gehört zur Abnahme von M2.
5. **CardTrader-Spracheigenschaft:** offen. Die Antwort braucht einen Abruf mit Token und wird erst für M5 benötigt.
6. **GitHub Pages:** Im kostenlosen Tarif nur für öffentliche Repositorys (GitHub-Dokumentation, „What is GitHub Pages“). Die Sammlung liegt nur auf dem Handy und ist davon nicht betroffen.

## Abweichungen von der SPEC

| Annahme der SPEC | Tatsächlich | Umsetzung |
| --- | --- | --- |
| Zwei Finishes: Normal und Foil | Vier: zusätzlich Metal und Metal Deluxe (${s.metalSkus} Einträge, ${s.metalSkusWithProduct} mit Cardmarket-Produkt) | Eigene Zähler für alle vier; Metal zeigt „kein Preis“ und zählt nicht in den Sammlungswert |
| Ein Druck hat eine Liste verfügbarer Finishes | Der Katalog führt jedes Finish als eigenen Eintrag | Die App fasst Einträge zu Drucken zusammen (\`src/data/prints.ts\`); der Bestand hängt am Eintrag |
| 95 % aller Drucke regulärer Sets haben einen Preis | Mit Metal wären es weniger; ohne Metal ${percent(s.coverageMain)} | Grenze gilt für Normal und Foil |
| Preise ersatzweise aus \`/api/v1/prices\` | Enthält Platzhalter (z. B. SFD-178a mit 100.000 €) | Preise kommen nur aus der Cardmarket-Datei |
| Jeder Druck hat ein Bild | ${s.printsWithoutImage} Drucke ohne Bild | Nicht scanbar, nur über die Suche hinzufügbar |
| Motiv unterscheidet die Drucke | ${s.motifsWithSeveralPrints} von ${s.motifs} Motiven gibt es in mehreren Drucken (Stempel, andere Nummer) | Kartennummer per Texterkennung, sonst Kandidatenauswahl |

## Noch offen

- **Piltover Archive:** Das Import- und Exportformat ist nur angemeldet einsehbar. Für M1 wird eine echte Exportdatei aus dem Konto des Nutzers als Vorlage gebraucht.
- **CardTrader:** siehe Punkt 5.
`;
}

export function renderUnpricedList(s: M0Stats): string {
  const rows = (list: UnpricedSku[]) =>
    table(
      ['Set', 'Nummer', 'Name', 'Variante', 'Finish', 'Grund'],
      list.map((u) => [u.setCode, u.code, u.name, u.variant, FINISH_LABELS[u.finish], u.reason]),
    );
  const main = s.unpriced.filter((u) => u.setType === 'main');
  const other = s.unpriced.filter((u) => u.setType !== 'main');
  return `# Drucke ohne Cardmarket-Preis

Preisdatei vom ${date(s.priceGuideCreatedAt)}. Erzeugt von \`npm run data:report\`.

## Reguläre Sets, Normal und Foil (${main.length})

${rows(main)}

## Zusatz-Sets, Normal und Foil (${other.length})

${rows(other)}

## Metal und Metal Deluxe (${s.metalList.length})

${rows(s.metalList)}
`;
}

/**
 * Zehn gleichmäßig über den Katalog verteilte Preise zum Gegenprüfen auf Cardmarket (Abnahme M2).
 * Cardmarket weist automatische Zugriffe ab; die Sichtprüfung macht der Nutzer.
 */
export function renderPriceSamples(catalog: Catalog, prices: PriceData, count = 10): string {
  const cards = new Map(catalog.cards.map((c) => [c.id, c.name]));
  const priced = catalog.skus.filter((s) => {
    const e = prices.entries[s.id];
    return e && e.low !== null && e.hasSales;
  });
  const lowOf = (id: string) => prices.entries[id]!.low!;
  // Je zur Hälfte Normal und Foil. Die meisten Karten kosten wenige Cent; damit trotzdem
  // alle Preislagen vorkommen, wird gleichmäßig über die verschiedenen Preise gewählt.
  const spread = (finish: string, n: number) => {
    const list = priced
      .filter((s) => s.finish === finish)
      .sort((a, b) => lowOf(a.id) - lowOf(b.id) || a.rank - b.rank);
    const levels = [...new Set(list.map((s) => lowOf(s.id)))];
    const take = Math.min(n, levels.length);
    return Array.from({ length: take }, (_, i) => {
      const level = levels[Math.floor(((i + 0.5) * levels.length) / take)]!;
      return list.find((s) => lowOf(s.id) === level)!;
    });
  };
  const half = Math.ceil(count / 2);
  const picks = [...spread('normal', half), ...spread('foil', count - half)];

  return `# M2: Stichproben für den Preisvergleich

Preisdatei von Cardmarket vom ${formatDay(prices.createdAt)}. Erzeugt von \`npm run data:samples\`.

Zum Prüfen den Link öffnen und den Wert „Ab“ (niedrigster Preis über alle Sprachen) vergleichen: bei Normal ohne Foil-Filter, bei Foil mit Foil-Filter. Der Link setzt den Sprachfilter Englisch; für den Vergleich mit „alle Sprachen“ den Filter entfernen. Der Live-Preis kann vom Stand der Datei abweichen, weil seitdem gekauft oder neu eingestellt wurde.

${table(
  ['Nr.', 'Nummer', 'Name', 'Variante', 'Finish', 'Low in der App', 'Cardmarket'],
  picks.map((s, i) => {
    const e = prices.entries[s.id]!;
    return [
      i + 1,
      s.publicCode || s.shortCode,
      cards.get(s.cardId) ?? s.printedName,
      variantLabel(s),
      FINISH_LABELS[s.finish],
      formatEuro(e.low!),
      `[öffnen](${cardmarketEnglishUrl(e.productId)})`,
    ];
  }),
)}
`;
}
