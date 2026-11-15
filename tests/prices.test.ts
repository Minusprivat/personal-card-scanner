import { describe, expect, it } from 'vitest';
import { parsePriceGuide } from '../scripts/build-data/sources/cardmarket';
import { parseOpenRiftCatalog, parseOpenRiftLinks } from '../scripts/build-data/sources/openrift';
import { buildPriceData, collectionValue, formatDay, formatEuro, type PriceData } from '../src/data/prices';
import { rawCatalog, rawLinks, rawPriceGuide } from './fixtures';

const catalog = parseOpenRiftCatalog(rawCatalog, '2026-11-14T08:00:00.000Z');
const prices = buildPriceData(catalog.skus, parseOpenRiftLinks(rawLinks), parsePriceGuide(rawPriceGuide));

describe('Tagesdatei der Preise', () => {
  it('trägt das Stand-Datum der Cardmarket-Preisdatei', () => {
    expect(prices.source).toBe('Cardmarket');
    expect(formatDay(prices.createdAt)).toBe('13.11.2026');
  });

  it('nimmt je Finish den passenden Low-Preis und merkt sich das Produkt für den Cardmarket-Knopf', () => {
    expect(prices.entries['p-normal']).toEqual({ productId: 100, low: 0.2, trend: 0.6, hasSales: true });
    expect(prices.entries['p-foil']).toEqual({ productId: 100, low: 1.5, trend: 2.1, hasSales: true });
  });

  it('führt Produkte ohne Low-Preis mit „kein Preis“, damit der Knopf trotzdem erscheint', () => {
    expect(prices.entries['p-alt']).toEqual({ productId: 101, low: null, trend: null, hasSales: false });
  });

  it('lässt Fassungen ohne Cardmarket-Produkt weg (Metal, Tokens)', () => {
    expect(prices.entries['p-metal']).toBeUndefined();
    expect(prices.entries['p-token']).toBeUndefined();
  });
});

describe('Sammlungswert', () => {
  it('rechnet Low-Preis mal Menge und zählt Karten ohne Preis getrennt', () => {
    const stock = new Map([
      ['p-normal', 3], // 3 × 0,20 €
      ['p-foil', 2], // 2 × 1,50 €
      ['p-alt', 1], // kein Low
      ['p-metal', 4], // kein Produkt
      ['unbekannt', 1],
    ]);
    expect(collectionValue(stock, prices)).toEqual({ total: 3.6, pricedQty: 5, unpricedQty: 6, placeholderQty: 0 });
  });

  it('lässt Angebote ohne belegten Verkauf aus der Summe', () => {
    const placeholder: PriceData = {
      ...prices,
      entries: { teuer: { productId: 1, low: 100000, trend: null, hasSales: false }, ...prices.entries },
    };
    const value = collectionValue(new Map([['teuer', 1], ['p-normal', 1]]), placeholder);
    expect(value).toEqual({ total: 0.2, pricedQty: 1, unpricedQty: 0, placeholderQty: 1 });
  });

  it('summiert ohne Rundungsfehler', () => {
    const many: PriceData = { ...prices, entries: { a: { productId: 1, low: 0.1, trend: null, hasSales: true } } };
    expect(collectionValue(new Map([['a', 3]]), many).total).toBe(0.3);
  });

  it('ergibt ohne Preisdaten null Euro und zählt alles als „ohne Preis“', () => {
    expect(collectionValue(new Map([['p-normal', 2]]), null)).toEqual({
      total: 0,
      pricedQty: 0,
      unpricedQty: 2,
      placeholderQty: 0,
    });
  });

  it('schreibt Beträge deutsch', () => {
    expect(formatEuro(1234.5).replace(/\s/g, ' ')).toBe('1.234,50 €');
  });
});
