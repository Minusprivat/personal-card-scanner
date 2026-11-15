import type { PriceGuide, PriceGuideRow } from '../../../src/data/model';
import { fetchJsonCached, type FetchOptions } from '../http';

/** Öffentliche Tages-Preisdatei von Cardmarket; 22 ist die Spielkennung von Riftbound. */
export const CARDMARKET_PRICE_GUIDE_URL =
  'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parsePriceGuide(raw: unknown): PriceGuide {
  const root = raw as { createdAt?: unknown; priceGuides?: unknown } | null;
  if (!root || typeof root.createdAt !== 'string' || !Array.isArray(root.priceGuides)) {
    throw new Error('Cardmarket-Preisdatei hat ein unerwartetes Format.');
  }
  const rows = new Map<number, PriceGuideRow>();
  for (const v of root.priceGuides as Array<Record<string, unknown>>) {
    if (typeof v.idProduct !== 'number') continue;
    rows.set(v.idProduct, {
      productId: v.idProduct,
      low: num(v.low),
      trend: num(v.trend),
      avg: num(v.avg),
      avg30: num(v.avg30),
      lowFoil: num(v['low-foil']),
      trendFoil: num(v['trend-foil']),
      avgFoil: num(v['avg-foil']),
      avg30Foil: num(v['avg30-foil']),
    });
  }
  return { createdAt: root.createdAt, rows };
}

export async function loadPriceGuide(opts: FetchOptions): Promise<PriceGuide> {
  const res = await fetchJsonCached<unknown>('cardmarket-price-guide', CARDMARKET_PRICE_GUIDE_URL, opts);
  return parsePriceGuide(res.data);
}
