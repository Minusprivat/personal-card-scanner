import {
  FINISHES,
  type CardmarketLink,
  type Catalog,
  type Finish,
  type PriceGuide,
  type Print,
  type SetType,
  type Sku,
} from '../../src/data/model';
import { lookupPrice } from '../../src/data/prices';
import { groupPrints, variantLabel } from '../../src/data/prints';

export interface SetStats {
  code: string;
  name: string;
  type: SetType;
  prints: number;
  altArt: number;
  overnumbered: number;
  signed: number;
  withMarker: number;
  oversized: number;
  printsWithoutImage: number;
  skusByFinish: Record<Finish, number>;
}

export interface Coverage {
  eligible: number;
  priced: number;
}

export interface UnpricedSku {
  setCode: string;
  setType: SetType;
  code: string;
  name: string;
  variant: string;
  finish: Finish;
  reason: string;
}

export interface M0Stats {
  catalogFetchedAt: string;
  priceGuideCreatedAt: string;
  sets: number;
  cards: number;
  skus: number;
  prints: number;
  distinctImages: number;
  printsWithoutImage: number;
  bySet: SetStats[];
  artVariants: Record<string, number>;
  markerCombos: Record<string, number>;
  finishCombos: Record<string, number>;
  foilOnlyPrints: number;
  /** Motiv = Karte + Art-Variante + signiert. */
  motifs: number;
  motifsWithSeveralPrints: number;
  skusWithCardmarketProduct: number;
  /** Normal- und Foil-Skus je Set. */
  coverageBySet: Array<Coverage & { code: string; type: SetType }>;
  coverageMain: Coverage;
  coverageAll: Coverage;
  metalSkus: number;
  metalSkusWithProduct: number;
  /** Normal- und Foil-Skus ohne Preis, alle Sets. */
  unpriced: UnpricedSku[];
  metalList: UnpricedSku[];
  checks: {
    foilOnlyProductsWithBothLows: number;
    foilOnlyProductsLowEqualsLowFoil: number;
    productsUsedBySeveralPrints: number;
    pricedSkusWithoutSales: number;
    priceGuideProducts: number;
  };
}

export const pct = (c: Coverage) => (c.eligible === 0 ? 100 : (100 * c.priced) / c.eligible);

const inc = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1;
};
const emptyFinishCounts = (): Record<Finish, number> => ({ normal: 0, foil: 0, metal: 0, 'metal-deluxe': 0 });
const isMetal = (f: Finish) => f === 'metal' || f === 'metal-deluxe';

export function computeStats(
  catalog: Catalog,
  links: Map<string, CardmarketLink>,
  guide: PriceGuide,
  prints: Print[] = groupPrints(catalog.skus),
): M0Stats {
  const setById = new Map(catalog.sets.map((s) => [s.id, s]));
  const cardById = new Map(catalog.cards.map((c) => [c.id, c]));
  const setOf = (s: Sku) => {
    const set = setById.get(s.setId);
    if (!set) throw new Error(`Sku ${s.publicCode} verweist auf ein unbekanntes Set.`);
    return set;
  };

  const perSet = new Map<string, SetStats>();
  for (const set of catalog.sets) {
    perSet.set(set.id, {
      code: set.code,
      name: set.name,
      type: set.type,
      prints: 0,
      altArt: 0,
      overnumbered: 0,
      signed: 0,
      withMarker: 0,
      oversized: 0,
      printsWithoutImage: 0,
      skusByFinish: emptyFinishCounts(),
    });
  }

  const artVariants: Record<string, number> = {};
  const markerCombos: Record<string, number> = {};
  const finishCombos: Record<string, number> = {};
  const motifPrints = new Map<string, number>();
  const printsPerProduct = new Map<number, Set<string>>();
  let foilOnlyPrints = 0;
  let printsWithoutImage = 0;
  let foilOnlyBoth = 0;
  let foilOnlyEqual = 0;

  for (const print of prints) {
    const first = print.skus[0]!;
    const st = perSet.get(first.setId)!;
    st.prints++;
    if (first.artVariant !== 'normal') st.altArt++;
    if (first.isOvernumbered) st.overnumbered++;
    if (first.isSigned) st.signed++;
    if (first.markers.length) st.withMarker++;
    if (first.size !== 'standard') st.oversized++;
    if (print.skus.every((s) => !s.imageId)) {
      st.printsWithoutImage++;
      printsWithoutImage++;
    }
    inc(artVariants, first.artVariant);
    inc(markerCombos, first.markers.length ? [...first.markers].sort().join(' + ') : '(kein Stempel)');
    const finishes = print.skus.map((s) => s.finish);
    inc(finishCombos, finishes.join(' + '));
    const motif = `${first.cardId}|${first.artVariant}|${first.isSigned}`;
    motifPrints.set(motif, (motifPrints.get(motif) ?? 0) + 1);

    for (const s of print.skus) {
      const link = links.get(s.id);
      if (!link) continue;
      const users = printsPerProduct.get(link.productId) ?? new Set<string>();
      users.add(print.key);
      printsPerProduct.set(link.productId, users);
    }

    if (finishes.length === 1 && finishes[0] === 'foil') {
      foilOnlyPrints++;
      const link = links.get(first.id);
      const row = link ? guide.rows.get(link.productId) : undefined;
      if (row && row.low != null && row.lowFoil != null) {
        foilOnlyBoth++;
        if (row.low === row.lowFoil) foilOnlyEqual++;
      }
    }
  }

  const coverage = new Map<string, Coverage>();
  const coverageMain: Coverage = { eligible: 0, priced: 0 };
  const coverageAll: Coverage = { eligible: 0, priced: 0 };
  const unpriced: UnpricedSku[] = [];
  const metalList: UnpricedSku[] = [];
  let metalSkus = 0;
  let metalSkusWithProduct = 0;
  let pricedSkusWithoutSales = 0;

  const describe = (s: Sku, reason: string): UnpricedSku => ({
    setCode: setOf(s).code,
    setType: setOf(s).type,
    code: s.publicCode || s.shortCode,
    name: cardById.get(s.cardId)?.name ?? s.printedName,
    variant: variantLabel(s),
    finish: s.finish,
    reason,
  });

  const ordered = [...catalog.skus].sort((a, b) => a.rank - b.rank);
  for (const s of ordered) {
    const set = setOf(s);
    perSet.get(s.setId)!.skusByFinish[s.finish]++;
    const link = links.get(s.id);

    if (isMetal(s.finish)) {
      metalSkus++;
      if (link) metalSkusWithProduct++;
      metalList.push(describe(s, 'Cardmarket führt kein Metal-Finish in der Preisdatei'));
      continue;
    }

    const cov = coverage.get(s.setId) ?? { eligible: 0, priced: 0 };
    coverage.set(s.setId, cov);
    const result = lookupPrice(s.finish, link, guide);
    for (const c of set.type === 'main' ? [cov, coverageAll, coverageMain] : [cov, coverageAll]) {
      c.eligible++;
      if (result.price) c.priced++;
    }
    if (result.price) {
      if (!result.price.hasSales) pricedSkusWithoutSales++;
    } else {
      unpriced.push(describe(s, result.reason));
    }
  }

  const usedSets = catalog.sets.filter((s) => perSet.get(s.id)!.prints > 0);

  return {
    catalogFetchedAt: catalog.fetchedAt,
    priceGuideCreatedAt: guide.createdAt,
    sets: usedSets.length,
    cards: new Set(catalog.skus.map((s) => s.cardId)).size,
    skus: catalog.skus.length,
    prints: prints.length,
    distinctImages: new Set(catalog.skus.map((s) => s.imageId).filter(Boolean)).size,
    printsWithoutImage,
    bySet: usedSets.map((s) => perSet.get(s.id)!),
    artVariants,
    markerCombos,
    finishCombos,
    foilOnlyPrints,
    motifs: motifPrints.size,
    motifsWithSeveralPrints: [...motifPrints.values()].filter((n) => n > 1).length,
    skusWithCardmarketProduct: catalog.skus.filter((s) => links.has(s.id)).length,
    coverageBySet: usedSets.map((s) => ({
      code: s.code,
      type: s.type,
      ...(coverage.get(s.id) ?? { eligible: 0, priced: 0 }),
    })),
    coverageMain,
    coverageAll,
    metalSkus,
    metalSkusWithProduct,
    unpriced,
    metalList,
    checks: {
      foilOnlyProductsWithBothLows: foilOnlyBoth,
      foilOnlyProductsLowEqualsLowFoil: foilOnlyEqual,
      productsUsedBySeveralPrints: [...printsPerProduct.values()].filter((u) => u.size > 1).length,
      pricedSkusWithoutSales,
      priceGuideProducts: guide.rows.size,
    },
  };
}

export { FINISHES };
