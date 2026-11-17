import type { Card, CardmarketLink, Catalog, Sku } from '../../src/data/model';
import { cardmarketEnglishUrl } from '../../src/data/prices';
import type { CardmarketProduct } from './sources/cardmarket';

/**
 * Eigene Zuordnung von Cardmarket-Produkten zu Fassungen im Katalog.
 *
 * Die Katalogquelle liefert die Verknüpfung zu Cardmarket mit Verzögerung; neue Promos und
 * Bundles stehen deshalb eine Weile ohne Preis da. Die Produktliste von Cardmarket nennt je
 * Produkt nur Name und Edition. Zugeordnet wird deshalb ausschließlich, was eindeutig ist:
 *
 * - Regel „Name“: Der Kartenname kommt unter den offenen Produkten und unter den offenen
 *   Fassungen genau einmal vor, und das Set der Fassung passt zur Edition des Produkts
 *   (belegt durch Verknüpfungen, die die Katalogquelle für diese Edition schon liefert).
 * - Regel „Edition“: Eine ganze Edition deckt sich eins zu eins mit den offenen Fassungen
 *   eines Sets (so bei Bundles wie K/DA Couture oder Worlds 2026).
 *
 * Alles andere bleibt ohne Preis. Ein falscher Preis wäre schlimmer als keiner.
 * Metal und Metal Deluxe werden nie zugeordnet: Cardmarket führt je Karte mehrere Produkte
 * gleichen Namens, und die Liste verrät nicht, welches welche Fassung ist. Sie zählen aber
 * als offene Fassungen mit: Gibt es zu einem Namen noch eine Metal-Fassung ohne Produkt,
 * ist ein einzelnes Produkt dieses Namens nicht mehr eindeutig.
 */

/** Ab so vielen Produkten gilt eine Edition als Ganzes; darunter wäre es Zufall. */
export const MIN_EXPANSION_SIZE = 3;

export interface ProductMatch {
  productId: number;
  /** Alle Finishes der Fassung; Normal und Foil teilen sich bei Cardmarket ein Produkt. */
  skuIds: string[];
  rule: 'name' | 'expansion';
}

export interface MatchResult {
  matches: ProductMatch[];
  /** Produkte, zu deren Namen es offene Fassungen gibt, aber keine eindeutige. */
  ambiguous: CardmarketProduct[];
  /** Produkte, zu deren Namen der Katalog keine offene Fassung kennt. */
  unknown: CardmarketProduct[];
}

/** Vergleichsform eines Namens: ohne Akzente, Satzzeichen und Großschreibung. */
export const nameKey = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Name einer Karte, wie Cardmarket ihn schreibt. Legenden heißen dort „Jinx, Loose Cannon“,
 * im Katalog nur „Loose Cannon“ mit dem Champion als erstem Schlagwort.
 */
export function cardmarketName(card: Card): string {
  const name = card.name.replace(/, Starter$/, '');
  return card.types.includes('legend') && card.tags[0] ? `${card.tags[0]}, ${name}` : name;
}

const isMetal = (sku: Sku) => sku.finish === 'metal' || sku.finish === 'metal-deluxe';

/** Eine Fassung, wie Cardmarket sie als ein Produkt führt: Normal und Foil gehören zusammen. */
interface Version {
  key: string;
  name: string;
  setId: string;
  /** Metal oder Metal Deluxe: blockiert die Eindeutigkeit, wird aber nie zugeordnet. */
  metal: boolean;
  skus: Sku[];
}

function versionKey(sku: Sku): string {
  return [
    sku.cardId,
    sku.publicCode || sku.shortCode,
    sku.artVariant,
    sku.isSigned,
    sku.size,
    [...sku.markers].sort().join('+'),
    [...sku.channels].sort().join('+'),
    // Metal und Metal Deluxe sind bei Cardmarket eigene Produkte.
    isMetal(sku) ? sku.finish : 'papier',
  ].join('|');
}

export function matchProducts(
  catalog: Catalog,
  links: Map<string, CardmarketLink>,
  products: CardmarketProduct[],
): MatchResult {
  const cardById = new Map(catalog.cards.map((c) => [c.id, c]));
  const skuById = new Map(catalog.skus.map((s) => [s.id, s]));

  // Was die Katalogquelle schon verknüpft hat, bleibt unberührt und dient als Beleg,
  // welche Sets zu welcher Edition gehören.
  const linkedProducts = new Set<number>();
  const productExpansion = new Map(products.map((p) => [p.productId, p.expansionId]));
  const setsOfExpansion = new Map<number, Set<string>>();
  for (const [skuId, link] of links) {
    linkedProducts.add(link.productId);
    const expansion = productExpansion.get(link.productId);
    const sku = skuById.get(skuId);
    if (expansion === undefined || !sku) continue;
    const sets = setsOfExpansion.get(expansion);
    if (sets) sets.add(sku.setId);
    else setsOfExpansion.set(expansion, new Set([sku.setId]));
  }

  const versions = new Map<string, Version>();
  for (const sku of catalog.skus) {
    const card = cardById.get(sku.cardId);
    // Tokens benennt Cardmarket anders („Recruit“, „Brush // Bird“).
    if (links.has(sku.id) || !card || card.superTypes.includes('token')) continue;
    const key = versionKey(sku);
    const version = versions.get(key);
    if (version) version.skus.push(sku);
    else {
      versions.set(key, { key, name: nameKey(cardmarketName(card)), setId: sku.setId, metal: isMetal(sku), skus: [sku] });
    }
  }

  const open = products.filter((p) => !linkedProducts.has(p.productId));
  const versionsByName = new Map<string, Version[]>();
  for (const v of versions.values()) versionsByName.set(v.name, [...(versionsByName.get(v.name) ?? []), v]);
  const productsByName = new Map<string, CardmarketProduct[]>();
  for (const p of open) productsByName.set(nameKey(p.name), [...(productsByName.get(nameKey(p.name)) ?? []), p]);

  const matches = new Map<number, ProductMatch>();
  const taken = new Set<string>();
  const assign = (product: CardmarketProduct, version: Version, rule: ProductMatch['rule']) => {
    matches.set(product.productId, { productId: product.productId, skuIds: version.skus.map((s) => s.id), rule });
    taken.add(version.key);
  };

  // Regel „Name“.
  for (const [name, sameName] of productsByName) {
    const candidates = versionsByName.get(name) ?? [];
    if (sameName.length !== 1 || candidates.length !== 1) continue;
    const [product, version] = [sameName[0]!, candidates[0]!];
    if (!version.metal && setsOfExpansion.get(product.expansionId)?.has(version.setId)) assign(product, version, 'name');
  }

  // Regel „Edition“.
  const byExpansion = new Map<number, CardmarketProduct[]>();
  for (const p of open) byExpansion.set(p.expansionId, [...(byExpansion.get(p.expansionId) ?? []), p]);
  for (const expansion of byExpansion.values()) {
    const rest = expansion.filter((p) => !matches.has(p.productId));
    if (rest.length < MIN_EXPANSION_SIZE) continue;
    const free = (name: string) => (versionsByName.get(name) ?? []).filter((v) => !v.metal && !taken.has(v.key));
    const sets = new Set(rest.flatMap((p) => free(nameKey(p.name)).map((v) => v.setId)));
    for (const setId of sets) {
      const pairs = rest.map((p) => [p, free(nameKey(p.name)).filter((v) => v.setId === setId)] as const);
      const openInSet = [...versions.values()].filter((v) => v.setId === setId && !v.metal && !taken.has(v.key));
      const each = pairs.every(([, candidates]) => candidates.length === 1);
      // Jedes Produkt trifft genau eine Fassung des Sets, keine doppelt, und keine bleibt übrig.
      if (each && openInSet.length === rest.length && new Set(pairs.map(([, c]) => c[0]!.key)).size === rest.length) {
        for (const [product, candidates] of pairs) assign(product, candidates[0]!, 'expansion');
        break;
      }
    }
  }

  const ambiguous: CardmarketProduct[] = [];
  const unknown: CardmarketProduct[] = [];
  for (const product of open) {
    if (matches.has(product.productId)) continue;
    const left = (versionsByName.get(nameKey(product.name)) ?? []).filter((v) => !taken.has(v.key));
    (left.length ? ambiguous : unknown).push(product);
  }
  return { matches: [...matches.values()], ambiguous, unknown };
}

/**
 * Ergänzt die Verknüpfungen der Katalogquelle um die eigene Zuordnung. Was die Quelle
 * selbst verknüpft, hat immer Vorrang.
 */
export function withMatchedLinks(links: Map<string, CardmarketLink>, matches: ProductMatch[]): Map<string, CardmarketLink> {
  const merged = new Map(links);
  for (const match of matches) {
    for (const skuId of match.skuIds) {
      if (!merged.has(skuId)) merged.set(skuId, { productId: match.productId, url: cardmarketEnglishUrl(match.productId) });
    }
  }
  return merged;
}

const RULE_LABELS: Record<ProductMatch['rule'], string> = { name: 'Name', expansion: 'Edition' };

/** Bericht für docs/: was zugeordnet wurde und was offen bleibt. */
export function renderMatchReport(
  catalog: Catalog,
  result: MatchResult,
  products: CardmarketProduct[],
  createdAt: string,
): string {
  const productById = new Map(products.map((p) => [p.productId, p]));
  const skuById = new Map(catalog.skus.map((s) => [s.id, s]));
  const day = createdAt.slice(0, 10).split('-').reverse().join('.');
  const describe = (match: ProductMatch) => {
    const skus = match.skuIds.map((id) => skuById.get(id)).filter((s): s is Sku => s !== undefined);
    const code = skus[0] ? skus[0].publicCode || skus[0].shortCode : '?';
    return `${code} (${skus.map((s) => s.finish).join(', ')})`;
  };
  /** Namen alphabetisch; mehrere Produkte gleichen Namens stehen als „Name (3)“. */
  const tally = (list: CardmarketProduct[]) => {
    const counts = new Map<string, number>();
    for (const p of list) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
    return [...counts]
      .sort((a, b) => a[0].localeCompare(b[0], 'en'))
      .map(([name, n]) => (n > 1 ? `${name} (${n})` : name))
      .join(' · ');
  };
  const lines = [
    '# Eigene Zuordnung von Cardmarket-Produkten',
    '',
    `Stand ${day}. Erzeugt vom Datenskript (Befehl „match“); nicht von Hand ändern.`,
    '',
    'Die Katalogquelle verknüpft neue Promos und Bundles erst mit Verzögerung mit Cardmarket.',
    'Bis dahin ordnet das Datenskript zu, was eindeutig ist; die Regeln stehen in',
    'scripts/build-data/match-products.ts. Alles andere bleibt ohne Preis.',
    '',
    `- Zugeordnet: ${result.matches.length} Produkte`,
    `- Mehrdeutig, bleibt ohne Preis: ${result.ambiguous.length} Produkte`,
    `- Ohne Fassung im Katalog: ${result.unknown.length} Produkte`,
    '',
    '## Zugeordnet',
    '',
    '| Produkt | Name bei Cardmarket | Fassung im Katalog | Regel |',
    '| --- | --- | --- | --- |',
    ...[...result.matches]
      .sort((a, b) => a.productId - b.productId)
      .map((m) => `| ${m.productId} | ${productById.get(m.productId)?.name ?? '?'} | ${describe(m)} | ${RULE_LABELS[m.rule]} |`),
    '',
    '## Mehrdeutig',
    '',
    'Mehrere Produkte oder mehrere offene Fassungen tragen denselben Namen; in Klammern die Zahl der Produkte.',
    '',
    tally(result.ambiguous) || 'keine',
    '',
    '## Ohne Fassung im Katalog',
    '',
    'Diese Produkte führt Cardmarket, der Katalog kennt aber keine offene Fassung dazu (fehlende Karten, Tokens).',
    '',
    tally(result.unknown) || 'keine',
  ];
  return `${lines.join('\n')}\n`;
}
