import type { Card, CardSet, Catalog, Print, Sku } from './model';
import { groupPrints } from './prints';

/** Katalog mit Nachschlagetabellen; wird einmal nach dem Laden aufgebaut. */
export interface CatalogIndex {
  catalog: Catalog;
  /** Alle Drucke, sortiert nach Set-Reihenfolge und Rang. */
  prints: Print[];
  setById: Map<string, CardSet>;
  cardById: Map<string, Card>;
  skuById: Map<string, Sku>;
  printBySkuId: Map<string, Print>;
  printsByCardId: Map<string, Print[]>;
  skusByShortCode: Map<string, Sku[]>;
}

export function buildIndex(catalog: Catalog): CatalogIndex {
  const setOrder = new Map(catalog.sets.map((s, i) => [s.id, i]));
  const prints = groupPrints(catalog.skus).sort(
    (a, b) =>
      (setOrder.get(a.setId) ?? 0) - (setOrder.get(b.setId) ?? 0) || a.skus[0]!.rank - b.skus[0]!.rank,
  );

  const printBySkuId = new Map<string, Print>();
  const printsByCardId = new Map<string, Print[]>();
  for (const p of prints) {
    for (const s of p.skus) printBySkuId.set(s.id, p);
    const list = printsByCardId.get(p.cardId);
    if (list) list.push(p);
    else printsByCardId.set(p.cardId, [p]);
  }

  const skusByShortCode = new Map<string, Sku[]>();
  for (const s of catalog.skus) {
    const key = s.shortCode.toUpperCase();
    const list = skusByShortCode.get(key);
    if (list) list.push(s);
    else skusByShortCode.set(key, [s]);
  }

  return {
    catalog,
    prints,
    setById: new Map(catalog.sets.map((s) => [s.id, s])),
    cardById: new Map(catalog.cards.map((c) => [c.id, c])),
    skuById: new Map(catalog.skus.map((s) => [s.id, s])),
    printBySkuId,
    printsByCardId,
    skusByShortCode,
  };
}

/** Kartenname eines Drucks; fällt auf den aufgedruckten Namen zurück. */
export const printName = (index: CatalogIndex, print: Print) =>
  index.cardById.get(print.cardId)?.name ?? print.skus[0]!.printedName;

export const printCode = (print: Print) => print.skus[0]!.publicCode || print.skus[0]!.shortCode;

export const printImageId = (print: Print) => print.skus.find((s) => s.imageId)?.imageId ?? null;

export function imageUrl(catalog: Catalog, imageId: string, size: 'thumb' | 'detail' | 'full'): string {
  return catalog.images.template.replace('{id}', imageId).replace('{size}', catalog.images[size]);
}
