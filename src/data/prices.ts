import type { CardmarketLink, Finish, PriceGuide, PriceGuideRow } from './model';

export interface SkuPrice {
  /** Cardmarket Low in Euro (alle Sprachen). */
  low: number;
  trend: number | null;
  /** false, wenn Cardmarket keinen Durchschnitts- oder Trendwert kennt (Angebot ohne Verkäufe). */
  hasSales: boolean;
}

export type NoPriceReason = 'kein Cardmarket-Produkt' | 'Produkt fehlt in der Preisdatei' | 'kein Low-Preis';

export type PriceLookup = { price: SkuPrice } | { price: null; reason: NoPriceReason };

const positive = (v: number | null): v is number => v != null && v > 0;

/** Preis einer Zeile für ein Finish. Normal nutzt `low`, Foil nutzt `low-foil`. */
export function priceFromRow(finish: Finish, row: PriceGuideRow): SkuPrice | null {
  // Metal-Fassungen führt Cardmarket nicht als eigenes Finish; ein Normal- oder
  // Foil-Preis wäre für sie falsch.
  if (finish !== 'normal' && finish !== 'foil') return null;
  const foil = finish === 'foil';
  const low = foil ? row.lowFoil : row.low;
  if (!positive(low)) return null;
  const trend = foil ? row.trendFoil : row.trend;
  const avg = foil ? row.avgFoil : row.avg;
  return { low, trend: positive(trend) ? trend : null, hasSales: positive(trend) || positive(avg) };
}

export function lookupPrice(
  finish: Finish,
  link: CardmarketLink | undefined,
  guide: PriceGuide,
): PriceLookup {
  if (!link) return { price: null, reason: 'kein Cardmarket-Produkt' };
  const row = guide.rows.get(link.productId);
  if (!row) return { price: null, reason: 'Produkt fehlt in der Preisdatei' };
  const price = priceFromRow(finish, row);
  return price ? { price } : { price: null, reason: 'kein Low-Preis' };
}

/** Cardmarket-Sprachkennung für Englisch im Produktlink (`language=1`). */
export const CARDMARKET_LANGUAGE_EN = 1;

/** Produktseite bei Cardmarket mit Sprachfilter Englisch. */
export function cardmarketEnglishUrl(productId: number): string {
  return `https://www.cardmarket.com/en/Riftbound/Products?idProduct=${productId}&language=${CARDMARKET_LANGUAGE_EN}`;
}

/** Preis einer Sku in den Tagesdaten der App. `low` ist null, wenn Cardmarket keinen Preis nennt. */
export interface PriceEntry {
  productId: number;
  low: number | null;
  trend: number | null;
  /** false: Angebot ohne belegten Verkauf; zählt nicht in den Sammlungswert. */
  hasSales: boolean;
}

/** Tagesdatei `data/prices.json`. Skus ohne Cardmarket-Produkt fehlen in `entries`. */
export interface PriceData {
  source: string;
  /** Erstellzeit der Cardmarket-Preisdatei. */
  createdAt: string;
  entries: Record<string, PriceEntry>;
}

export function buildPriceData(
  skus: Array<{ id: string; finish: Finish }>,
  links: Map<string, CardmarketLink>,
  guide: PriceGuide,
): PriceData {
  const entries: Record<string, PriceEntry> = {};
  for (const sku of skus) {
    const link = links.get(sku.id);
    if (!link) continue;
    const result = lookupPrice(sku.finish, link, guide);
    entries[sku.id] = result.price
      ? { productId: link.productId, low: result.price.low, trend: result.price.trend, hasSales: result.price.hasSales }
      : { productId: link.productId, low: null, trend: null, hasSales: false };
  }
  return { source: 'Cardmarket', createdAt: guide.createdAt, entries };
}

export interface CollectionValue {
  /** Summe aus Low-Preis mal Menge in Euro. */
  total: number;
  /** Karten, die in die Summe eingehen. */
  pricedQty: number;
  /** Karten ohne Preis (kein Cardmarket-Produkt, kein Low, Metal). */
  unpricedQty: number;
  /** Karten mit Preis, aber ohne belegten Verkauf; bewusst nicht in der Summe. */
  placeholderQty: number;
}

export function collectionValue(stock: Map<string, number>, prices: PriceData | null): CollectionValue {
  const value: CollectionValue = { total: 0, pricedQty: 0, unpricedQty: 0, placeholderQty: 0 };
  for (const [skuId, qty] of stock) {
    if (qty <= 0) continue;
    const entry = prices?.entries[skuId];
    if (!entry || entry.low === null) value.unpricedQty += qty;
    else if (!entry.hasSales) value.placeholderQty += qty;
    else {
      // In Cent rechnen, damit sich keine Rundungsfehler aufsummieren.
      value.total += Math.round(entry.low * 100) * qty;
      value.pricedQty += qty;
    }
  }
  value.total /= 100;
  return value;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const formatEuro = (v: number): string => euro.format(v);

/** "2026-11-13T02:44:34+0100" → "13.11.2026". */
export const formatDay = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('.');
