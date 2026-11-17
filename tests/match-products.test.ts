import { describe, expect, it } from 'vitest';
import {
  cardmarketName,
  matchProducts,
  nameKey,
  withMatchedLinks,
} from '../scripts/build-data/match-products';
import { parseProductList, type CardmarketProduct } from '../scripts/build-data/sources/cardmarket';
import type { Card, CardmarketLink, Catalog, Sku } from '../src/data/model';
import { sku } from './fixtures';

const card = (id: string, name: string, over: Partial<Card> = {}): Card => ({
  id,
  slug: id,
  name,
  types: ['unit'],
  superTypes: [],
  domains: ['fury'],
  energy: 1,
  might: 1,
  power: null,
  keywords: [],
  tags: [],
  ...over,
});

const product = (productId: number, name: string, expansionId: number): CardmarketProduct => ({
  productId,
  name,
  expansionId,
});

const link = (productId: number): CardmarketLink => ({ productId, url: `https://example.test/${productId}` });

/** Cardmarket-Editionen im Test: 10 = Origins, 11 = Origins-Promos, 20 = K/DA-Bundle (neu, noch ohne Beleg). */
const ORIGINS = 10;
const PROMOS = 11;
const BUNDLE = 20;

function catalogOf(cards: Card[], skus: Sku[]): Catalog {
  return {
    source: 'Test',
    fetchedAt: '2026-11-17T00:00:00.000Z',
    images: { template: '', thumb: '', detail: '', full: '' },
    sets: [],
    cards,
    skus,
  };
}

/** Grundstock: zwei Karten, deren Fassungen die Katalogquelle schon verknüpft hat. */
const baseCards = [card('c-scorcher', 'Blazing Scorcher'), card('c-hush', 'Hush')];
const baseSkus = [
  sku({ id: 'scorcher-n', cardId: 'c-scorcher', setId: 'set-ogn', publicCode: 'OGN-001/298' }),
  sku({ id: 'scorcher-promo', cardId: 'c-scorcher', setId: 'set-ogn', publicCode: 'OGN-001/298', markers: ['promo'], channels: ['nexus-ogn'] }),
];
const baseLinks = new Map([
  ['scorcher-n', link(1)],
  ['scorcher-promo', link(2)],
]);
const baseProducts = [product(1, 'Blazing Scorcher', ORIGINS), product(2, 'Blazing Scorcher', PROMOS)];

function run(cards: Card[], skus: Sku[], products: CardmarketProduct[], links = baseLinks) {
  return matchProducts(catalogOf([...baseCards, ...cards], [...baseSkus, ...skus]), links, [...baseProducts, ...products]);
}

describe('Name, wie Cardmarket ihn schreibt', () => {
  it('lässt gewöhnliche Karten unverändert', () => {
    expect(cardmarketName(card('c', 'Jinx, Demolitionist', { tags: ['Jinx', 'Zaun'] }))).toBe('Jinx, Demolitionist');
  });

  it('stellt bei Legenden den Champion voran', () => {
    const legend = card('c', 'Loose Cannon', { types: ['legend'], tags: ['Jinx'] });
    expect(cardmarketName(legend)).toBe('Jinx, Loose Cannon');
    const starter = card('c', 'Dark Child, Starter', { types: ['legend'], tags: ['Annie'] });
    expect(cardmarketName(starter)).toBe('Annie, Dark Child');
  });

  it('vergleicht ohne Satzzeichen, Akzente und Großschreibung', () => {
    expect(nameKey('Lillia Fae Fawn')).toBe(nameKey('Lillia, Fae Fawn'));
    expect(nameKey('Ziggs, Short Fused')).toBe(nameKey('Ziggs, Short-Fused'));
    expect(nameKey('Kai’Sa, Survivor')).toBe(nameKey("Kai'Sa, Survivor"));
  });
});

describe('Regel „Name“', () => {
  const hushPromo = sku({ id: 'hush-promo', cardId: 'c-hush', setId: 'set-ogn', publicCode: 'OGN-041/298-P', finish: 'foil', markers: ['promo'], channels: ['nexus-ogn'] });

  it('ordnet zu, wenn der Name auf beiden Seiten genau einmal offen ist und das Set zur Edition passt', () => {
    const { matches } = run([], [hushPromo], [product(50, 'Hush', PROMOS)]);
    expect(matches).toEqual([{ productId: 50, skuIds: ['hush-promo'], rule: 'name' }]);
  });

  it('gibt Normal und Foil derselben Fassung dasselbe Produkt', () => {
    const normal = sku({ ...hushPromo, id: 'hush-promo-n', finish: 'normal' });
    const { matches } = run([], [hushPromo, normal], [product(50, 'Hush', PROMOS)]);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.skuIds.sort()).toEqual(['hush-promo', 'hush-promo-n']);
  });

  it('ordnet nicht zu, wenn es zwei Produkte dieses Namens gibt', () => {
    const result = run([], [hushPromo], [product(50, 'Hush', PROMOS), product(51, 'Hush', PROMOS)]);
    expect(result.matches).toEqual([]);
    expect(result.ambiguous.map((p) => p.productId)).toEqual([50, 51]);
  });

  it('ordnet nicht zu, wenn es zwei offene Fassungen dieses Namens gibt', () => {
    const second = sku({ ...hushPromo, id: 'hush-top8', markers: ['summoner', 'top-8'], channels: ['summoner-top8'] });
    const result = run([], [hushPromo, second], [product(50, 'Hush', PROMOS)]);
    expect(result.matches).toEqual([]);
    expect(result.ambiguous).toHaveLength(1);
  });

  it('ordnet nicht zu, wenn das Set der Fassung nicht zur Edition des Produkts passt', () => {
    const elsewhere = sku({ ...hushPromo, id: 'hush-sfd', setId: 'set-sfd' });
    expect(run([], [elsewhere], [product(50, 'Hush', PROMOS)]).matches).toEqual([]);
  });

  it('ordnet nicht zu, wenn die Edition neu ist und noch kein Beleg für sie vorliegt', () => {
    expect(run([], [hushPromo], [product(50, 'Hush', 999)]).matches).toEqual([]);
  });

  it('rührt Produkte und Fassungen nicht an, die die Katalogquelle schon verknüpft hat', () => {
    const links = new Map([...baseLinks, ['hush-promo', link(77)]]);
    const result = run([], [hushPromo], [product(77, 'Hush', PROMOS), product(50, 'Hush', PROMOS)], links);
    expect(result.matches).toEqual([]);
    // Das zweite Produkt gehört zu einer Fassung, die der Katalog nicht kennt.
    expect(result.unknown.map((p) => p.productId)).toEqual([50]);
  });
});

describe('Metal', () => {
  const legend = card('c-jinx', 'Loose Cannon', { types: ['legend'], tags: ['Jinx'] });
  const metal = sku({ id: 'jinx-metal', cardId: 'c-jinx', setId: 'set-ogn', publicCode: 'OGN-251/298', finish: 'metal', markers: ['promo'], channels: ['prize-wall'] });
  const deluxe = sku({ ...metal, id: 'jinx-deluxe', finish: 'metal-deluxe', channels: ['best-of'] });

  it('wird nie zugeordnet, auch wenn Name und Edition eindeutig wären', () => {
    const result = run([legend], [metal], [product(60, 'Jinx, Loose Cannon', ORIGINS)]);
    expect(result.matches).toEqual([]);
    expect(result.ambiguous.map((p) => p.productId)).toEqual([60]);
  });

  it('macht ein einzelnes Produkt mehrdeutig, solange eine Metal-Fassung desselben Namens offen ist', () => {
    // Das Produkt könnte die signierte Karte sein – oder die Metal-Karte.
    const signed = sku({ id: 'jinx-signed', cardId: 'c-jinx', setId: 'set-ogn', publicCode: 'OGN-301*/298', finish: 'foil', isSigned: true });
    const result = run([legend], [signed, metal, deluxe], [product(60, 'Jinx, Loose Cannon', ORIGINS)]);
    expect(result.matches).toEqual([]);
  });
});

describe('Tokens', () => {
  it('bleiben außen vor: Cardmarket benennt sie anders', () => {
    const token = card('c-buff', 'Buff', { superTypes: ['token'] });
    const buff = sku({ id: 'buff', cardId: 'c-buff', setId: 'set-ogn', publicCode: 'OGN-T01' });
    const result = run([token], [buff], [product(70, 'Buff', ORIGINS)]);
    expect(result.matches).toEqual([]);
    expect(result.unknown.map((p) => p.productId)).toEqual([70]);
  });
});

describe('Regel „Edition“', () => {
  const cards = [
    card('c-ahri', 'Nine-Tailed Fox', { types: ['legend'], tags: ['Ahri'] }),
    card('c-eve', 'Agony’s Embrace', { types: ['legend'], tags: ['Evelynn'] }),
    card('c-arena', 'Packed Amphitheater', { types: ['battlefield'] }),
  ];
  const bundle = [
    sku({ id: 'kda-ahri', cardId: 'c-ahri', setId: 'set-kda', publicCode: 'KDA-001/005', finish: 'foil', channels: ['kda-couture'] }),
    sku({ id: 'kda-eve', cardId: 'c-eve', setId: 'set-kda', publicCode: 'KDA-002/005', finish: 'foil', channels: ['kda-couture'] }),
    sku({ id: 'kda-arena', cardId: 'c-arena', setId: 'set-kda', publicCode: 'KDA-005/005', finish: 'foil', channels: ['kda-couture'] }),
  ];
  // Dieselben Legenden gibt es auch als offene Metal-Karten und als Promo in einem anderen Set.
  const noise = [
    sku({ id: 'ahri-metal', cardId: 'c-ahri', setId: 'set-ogn', publicCode: 'OGN-255/298', finish: 'metal', markers: ['promo'], channels: ['prize-wall'] }),
    sku({ id: 'arena-promo', cardId: 'c-arena', setId: 'set-rad', publicCode: 'RAD-164/167-P', markers: ['promo'], channels: ['prize-wall'] }),
  ];
  const products = [
    product(80, 'Ahri, Nine-Tailed Fox', BUNDLE),
    product(81, "Evelynn, Agony's Embrace", BUNDLE),
    product(82, 'Packed Amphitheater', BUNDLE),
  ];

  it('ordnet eine ganze Edition zu, die sich eins zu eins mit den offenen Fassungen eines Sets deckt', () => {
    const { matches } = run(cards, [...bundle, ...noise], products);
    expect(matches).toEqual([
      { productId: 80, skuIds: ['kda-ahri'], rule: 'expansion' },
      { productId: 81, skuIds: ['kda-eve'], rule: 'expansion' },
      { productId: 82, skuIds: ['kda-arena'], rule: 'expansion' },
    ]);
  });

  it('ordnet nichts zu, wenn im Set eine offene Fassung übrig bliebe', () => {
    const extra = sku({ id: 'kda-extra', cardId: 'c-hush', setId: 'set-kda', publicCode: 'KDA-004/005', finish: 'foil', channels: ['kda-couture'] });
    expect(run(cards, [...bundle, extra], products).matches).toEqual([]);
  });

  it('ordnet nichts zu, wenn ein Produkt der Edition keine Fassung im Set hat', () => {
    expect(run(cards, bundle, [...products, product(83, 'Hush', BUNDLE)]).matches).toEqual([]);
  });

  it('gilt erst ab drei Produkten; darunter wäre die Übereinstimmung Zufall', () => {
    expect(run(cards, bundle.slice(0, 2), products.slice(0, 2)).matches).toEqual([]);
  });
});

describe('Verknüpfungen zusammenführen', () => {
  it('ergänzt die eigene Zuordnung mit dem Link auf die englische Produktseite', () => {
    const merged = withMatchedLinks(baseLinks, [{ productId: 50, skuIds: ['hush-promo'], rule: 'name' }]);
    expect(merged.get('hush-promo')).toEqual({
      productId: 50,
      url: 'https://www.cardmarket.com/en/Riftbound/Products?idProduct=50&language=1',
    });
    expect(merged.size).toBe(3);
    // Die Vorlage bleibt unverändert.
    expect(baseLinks.size).toBe(2);
  });

  it('lässt der Katalogquelle den Vorrang', () => {
    const merged = withMatchedLinks(baseLinks, [{ productId: 999, skuIds: ['scorcher-n'], rule: 'name' }]);
    expect(merged.get('scorcher-n')).toEqual(link(1));
  });
});

describe('Produktliste von Cardmarket', () => {
  it('liest Nummer, Name und Edition', () => {
    const raw = {
      version: 1,
      createdAt: '2026-11-16T13:57:02+0100',
      products: [
        { idProduct: 845712, name: 'Blazing Scorcher', idCategory: 1655, categoryName: 'Riftbound Single', idExpansion: 6286, idMetacard: 1, dateAdded: '2025-08-28 14:10:58' },
        { idProduct: 'kaputt', name: 'Ohne Nummer', idExpansion: 1 },
      ],
    };
    expect(parseProductList(raw)).toEqual([{ productId: 845712, name: 'Blazing Scorcher', expansionId: 6286 }]);
  });

  it('weist ein fremdes Format zurück', () => {
    expect(() => parseProductList({ priceGuides: [] })).toThrow(/Produktliste/);
  });
});
