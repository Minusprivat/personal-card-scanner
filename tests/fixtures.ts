import type { Sku } from '../src/data/model';

let counter = 0;

/** Baut eine Sku mit sinnvollen Vorgaben; Tests überschreiben nur, was sie prüfen. */
export function sku(over: Partial<Sku> = {}): Sku {
  counter++;
  return {
    id: `sku-${counter}`,
    cardId: 'card-1',
    setId: 'set-ogn',
    shortCode: 'OGN-142',
    publicCode: 'OGN-142/298',
    printedName: 'Testkarte',
    rarity: 'rare',
    artVariant: 'normal',
    isSigned: false,
    isOvernumbered: false,
    markers: [],
    size: 'standard',
    finish: 'normal',
    language: 'EN',
    imageId: 'img-1',
    channels: [],
    comment: null,
    rank: counter,
    ...over,
  };
}

/** Ausschnitt im Format von OpenRift `/api/v1/catalog`. */
export const rawCatalog = {
  sets: [
    { id: 'set-ogn', slug: 'OGN', name: 'Origins', setType: 'main', releases: { EN: { releasedAt: '2025-10-31' } } },
    { id: 'set-sgn', slug: 'SGN', name: 'Secret Garden', setType: 'supplemental', releases: {} },
  ],
  cards: {
    'card-1': {
      slug: 'annie-fiery',
      name: 'Annie, Fiery',
      types: ['unit'],
      superTypes: [],
      domains: ['fury'],
      might: 3,
      energy: 5,
      power: null,
      keywords: [],
      tags: ['Annie'],
    },
    'card-2': {
      slug: 'buff',
      name: 'Buff',
      types: ['other'],
      superTypes: [],
      domains: [],
      might: null,
      energy: null,
      power: null,
      keywords: [],
      tags: [],
    },
  },
  printings: {
    'p-normal': printing({ finish: 'normal', canonicalRank: 1 }),
    'p-foil': printing({ finish: 'foil', canonicalRank: 2 }),
    'p-alt': printing({
      finish: 'foil',
      shortCode: 'OGN-142a',
      publicCode: 'OGN-142a/298',
      artVariant: 'altart',
      images: [{ imageId: 'img-alt' }],
      canonicalRank: 3,
    }),
    'p-metal': printing({ finish: 'metal', markers: ['promo'], publicCode: 'OGN-142/298-P', canonicalRank: 4 }),
    'p-token': printing({
      cardId: 'card-2',
      setId: 'set-sgn',
      shortCode: 'SGN-T04',
      publicCode: 'SGN-T04',
      printedName: null,
      images: [],
      distributionChannels: [{ channel: 'bundle' }],
      canonicalRank: 5,
    }),
  },
};

function printing(over: Record<string, unknown>) {
  return {
    shortCode: 'OGN-142',
    setId: 'set-ogn',
    rarity: 'epic',
    artVariant: 'normal',
    isSigned: false,
    isOvernumbered: false,
    markers: [],
    finish: 'normal',
    images: [{ imageId: 'img-1' }],
    publicCode: 'OGN-142/298',
    printedName: 'Annie, Fiery',
    language: 'EN',
    canonicalRank: 1,
    cardId: 'card-1',
    size: 'standard',
    comment: null,
    distributionChannels: [],
    ...over,
  };
}

/** Ausschnitt im Format von OpenRift `/api/v1/prices/links`. */
export const rawLinks = {
  links: {
    'p-normal': { cardmarket: { available: true, productId: 100, url: 'https://www.cardmarket.com/en/Riftbound/Products?idProduct=100&language=1' } },
    'p-foil': { cardmarket: { available: true, productId: 100, url: 'https://www.cardmarket.com/en/Riftbound/Products?idProduct=100&language=1' } },
    'p-alt': { cardmarket: { available: true, productId: 101, url: 'https://www.cardmarket.com/en/Riftbound/Products?idProduct=101&language=1' } },
    'p-metal': { cardmarket: { available: false, productId: null, url: null } },
  },
};

/** Ausschnitt im Format der Cardmarket-Preisdatei. */
export const rawPriceGuide = {
  version: 1,
  createdAt: '2026-11-13T02:44:34+0100',
  priceGuides: [
    { idProduct: 100, idCategory: 1655, avg: 0.5, low: 0.2, trend: 0.6, avg30: 0.5, 'avg-foil': 2, 'low-foil': 1.5, 'trend-foil': 2.1, 'avg30-foil': 2 },
    { idProduct: 101, idCategory: 1655, avg: null, low: null, trend: null, avg30: null, 'avg-foil': null, 'low-foil': null, 'trend-foil': 0, 'avg30-foil': null },
  ],
};
