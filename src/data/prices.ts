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
