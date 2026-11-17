import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/data/catalog-index';
import { filterCards, NO_FILTERS, type Filters } from '../src/data/filter';
import type { Card, Catalog } from '../src/data/model';
import {
  compactOrigins,
  countByKind,
  isPromo,
  kindSummary,
  originLabels,
  printOrigins,
  versionKind,
} from '../src/data/versions';
import { sku } from './fixtures';

const card = (id: string, name: string): Card => ({
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
});

/** Jinx gibt es in allen Arten, Flash als Normal und Promo, Poro nur als Foil. */
const catalog: Catalog = {
  source: 'Test',
  fetchedAt: '2026-11-17T00:00:00.000Z',
  images: { template: 'https://example.test/{id}-{size}.webp', thumb: 's', detail: 'm', full: 'l' },
  sets: [
    { id: 'set-ogn', code: 'OGN', name: 'Origins', type: 'main', releasedAt: '2025-10-31' },
    { id: 'set-w26', code: 'W26', name: 'Worlds 2026 Bundle', type: 'supplemental', releasedAt: null },
  ],
  cards: [card('c-jinx', 'Jinx, Loose Cannon'), card('c-flash', 'Flash'), card('c-poro', 'Pouty Poro')],
  skus: [
    sku({ id: 'jinx-n', cardId: 'c-jinx', shortCode: 'OGN-251', publicCode: 'OGN-251/298' }),
    sku({ id: 'jinx-f', cardId: 'c-jinx', shortCode: 'OGN-251', publicCode: 'OGN-251/298', finish: 'foil' }),
    sku({ id: 'jinx-alt', cardId: 'c-jinx', shortCode: 'OGN-301', publicCode: 'OGN-301/298', finish: 'foil', artVariant: 'altart' }),
    sku({ id: 'jinx-nexus', cardId: 'c-jinx', shortCode: 'OGN-251', publicCode: 'OGN-251/298', finish: 'foil', markers: ['promo'], channels: ['nexus-ogn'] }),
    sku({ id: 'jinx-bestof', cardId: 'c-jinx', shortCode: 'OGN-251', publicCode: 'OGN-251/298', finish: 'foil', markers: ['promo'], channels: ['rq-ogn-best-of', 'rq-sfd-best-of'], comment: 'Best Of' }),
    sku({ id: 'jinx-worlds', cardId: 'c-jinx', setId: 'set-w26', shortCode: 'W26-001', publicCode: 'W26-001', finish: 'foil', channels: ['worlds-2026'] }),
    sku({ id: 'jinx-metal', cardId: 'c-jinx', shortCode: 'OGN-251', publicCode: 'OGN-251/298', finish: 'metal', markers: ['promo'], channels: ['vault'] }),
    sku({ id: 'jinx-deluxe', cardId: 'c-jinx', shortCode: 'OGN-251', publicCode: 'OGN-251/298', finish: 'metal-deluxe', markers: ['promo'], channels: ['vault'] }),
    sku({ id: 'flash-n', cardId: 'c-flash', shortCode: 'OGN-011', publicCode: 'OGN-011/298' }),
    sku({ id: 'flash-p', cardId: 'c-flash', shortCode: 'OGN-011', publicCode: 'OGN-011/298-P', markers: ['promo'], channels: ['gamestore'] }),
    sku({ id: 'poro-f', cardId: 'c-poro', shortCode: 'OGN-013', publicCode: 'OGN-013/298', finish: 'foil' }),
  ],
  channels: {
    'nexus-ogn': 'Nexus Night › Origins',
    'rq-ogn-best-of': 'Regional Qualifier › Origins Season › Best Of',
    'rq-sfd-best-of': 'Regional Qualifier › Spiritforged Season › Best Of',
    'worlds-2026': 'Worlds 2026 Bundle',
    gamestore: 'Local Game Store Promo',
  },
};

const index = buildIndex(catalog);
const bySku = (id: string) => index.skuById.get(id)!;
const printsOf = (cardId: string) => index.printsByCardId.get(cardId)!;

describe('Art einer Fassung', () => {
  it('zählt Karten aus den Boostern als Normal oder Foil, auch Alt-Art', () => {
    expect(versionKind(bySku('jinx-n'))).toBe('normal');
    expect(versionKind(bySku('jinx-f'))).toBe('foil');
    expect(versionKind(bySku('jinx-alt'))).toBe('foil');
  });

  it('zählt als Promo, was einen Stempel oder eine besondere Herkunft hat', () => {
    expect(versionKind(bySku('jinx-nexus'))).toBe('promo');
    expect(versionKind(bySku('flash-p'))).toBe('promo');
    // Bundle-Karten tragen keinen Stempel, stammen aber nicht aus Boostern.
    expect(bySku('jinx-worlds').markers).toEqual([]);
    expect(isPromo(bySku('jinx-worlds'))).toBe(true);
    expect(versionKind(bySku('jinx-worlds'))).toBe('promo');
  });

  it('zählt Metal und Metal Deluxe für sich, obwohl sie einen Promo-Stempel tragen', () => {
    expect(versionKind(bySku('jinx-metal'))).toBe('metal');
    expect(versionKind(bySku('jinx-deluxe'))).toBe('metal');
  });
});

describe('Zählung je Karte', () => {
  const stock = new Map([
    ['jinx-n', 2],
    ['jinx-alt', 1],
    ['jinx-bestof', 1],
    ['jinx-worlds', 3],
    ['flash-n', 4],
  ]);

  it('zählt je Art die Fassungen und die Karten im Bestand', () => {
    expect(countByKind(printsOf('c-jinx'), stock)).toEqual({
      normal: { versions: 1, qty: 2 },
      foil: { versions: 2, qty: 1 },
      promo: { versions: 3, qty: 4 },
      metal: { versions: 2, qty: 0 },
    });
  });

  it('schreibt „Normal: X | Foil: Y | Promo: Z“ in fester Reihenfolge', () => {
    const line = (cardId: string) =>
      kindSummary(countByKind(printsOf(cardId), stock))
        .map((k) => `${k.label}: ${k.qty}`)
        .join(' | ');
    expect(line('c-jinx')).toBe('Normal: 2 | Foil: 1 | Promo: 4 | Metal: 0');
    expect(line('c-flash')).toBe('Normal: 4 | Promo: 0');
  });

  it('lässt Arten weg, die es von der Karte nicht gibt', () => {
    expect(kindSummary(countByKind(printsOf('c-poro'), stock)).map((k) => k.kind)).toEqual(['foil']);
  });

  it('zeigt ohne Bestand überall null', () => {
    expect(kindSummary(countByKind(printsOf('c-flash'), new Map())).map((k) => k.qty)).toEqual([0, 0]);
  });
});

describe('Herkunft einer Fassung', () => {
  it('nennt Event oder Bundle beim Namen', () => {
    expect(originLabels(bySku('jinx-nexus'), catalog)).toEqual(['Nexus Night › Origins']);
    expect(originLabels(bySku('jinx-worlds'), catalog)).toEqual(['Worlds 2026 Bundle']);
  });

  it('nennt jede Herkunft, wenn es eine Fassung bei mehreren Gelegenheiten gab', () => {
    expect(originLabels(bySku('jinx-bestof'), catalog)).toEqual([
      'Regional Qualifier › Origins Season › Best Of',
      'Regional Qualifier › Spiritforged Season › Best Of',
    ]);
  });

  it('ist leer für Karten aus den Boostern', () => {
    expect(originLabels(bySku('jinx-n'), catalog)).toEqual([]);
  });

  it('fällt auf das Kürzel zurück, wenn der Katalog den Namen nicht kennt', () => {
    expect(originLabels(bySku('jinx-metal'), catalog)).toEqual(['vault']);
    // Ältere Katalogstände tragen die Namen noch gar nicht.
    expect(originLabels(bySku('jinx-nexus'), { ...catalog, channels: undefined })).toEqual(['nexus-ogn']);
  });

  it('fasst Herkünfte zusammen, die sich nur in der Saison unterscheiden', () => {
    expect(compactOrigins(originLabels(bySku('jinx-bestof'), catalog))).toEqual([
      'Regional Qualifier › Best Of (Origins, Spiritforged)',
    ]);
    expect(
      compactOrigins([
        'Release Event › Origins',
        'Regional Qualifier › Origins Season › Prize Wall',
        'Worlds 2026 Bundle',
        'Regional Qualifier › Unleashed Season › Prize Wall',
        'Regional › Radiance Season › Best Of',
      ]),
    ).toEqual([
      'Release Event › Origins',
      'Regional Qualifier › Prize Wall (Origins, Unleashed)',
      'Worlds 2026 Bundle',
      'Regional › Best Of (Radiance)',
    ]);
    expect(compactOrigins([])).toEqual([]);
  });

  it('fasst die Herkunft eines Drucks über seine Finishes zusammen, ohne Doppelte', () => {
    const metal = index.printBySkuId.get('jinx-metal')!;
    expect(metal.skus.map((s) => s.id)).toContain('jinx-deluxe');
    expect(printOrigins(metal, catalog)).toEqual(['vault']);
  });
});

describe('Übersicht nach Karten', () => {
  const stock = new Map([
    ['jinx-n', 2],
    ['flash-p', 1],
  ]);
  const find = (filters: Partial<Filters>, s = stock) =>
    filterCards(index, { ...NO_FILTERS, ...filters }, s).map((g) => g.cardId);

  it('zeigt jede Karte einmal, mit allen ihren Fassungen', () => {
    const groups = filterCards(index, NO_FILTERS, stock);
    expect(groups.map((g) => g.card?.name)).toEqual(['Jinx, Loose Cannon', 'Flash', 'Pouty Poro']);
    expect(groups[0]!.prints.flatMap((p) => p.skus)).toHaveLength(8);
  });

  it('zeigt eine Karte, sobald eine ihrer Fassungen zu den Filtern passt', () => {
    expect(find({ variants: ['stamp'] })).toEqual(['c-jinx', 'c-flash']);
    expect(find({ variants: ['metal'] })).toEqual(['c-jinx']);
    expect(find({ setIds: ['set-w26'] })).toEqual(['c-jinx']);
    expect(find({ query: 'flash' })).toEqual(['c-flash']);
  });

  it('nimmt als Bild die erste passende Fassung, zählt aber über alle', () => {
    const [jinx] = filterCards(index, { ...NO_FILTERS, setIds: ['set-w26'] }, stock);
    expect(jinx!.matched.map((p) => p.skus[0]!.id)).toEqual(['jinx-worlds']);
    expect(jinx!.prints.flatMap((p) => p.skus)).toHaveLength(8);
  });

  it('bezieht „Besitze ich“ und „Fehlt mir“ auf die passenden Fassungen', () => {
    expect(find({ owned: 'owned' })).toEqual(['c-jinx', 'c-flash']);
    expect(find({ owned: 'missing' })).toEqual(['c-poro']);
    // Von Jinx liegt keine Promo in der Sammlung, von Flash schon.
    expect(find({ variants: ['stamp'], owned: 'missing' })).toEqual(['c-jinx']);
    expect(find({ variants: ['stamp'], owned: 'owned' })).toEqual(['c-flash']);
  });

  it('kommt mit leerem Bestand zurecht', () => {
    expect(find({ owned: 'owned' }, new Map())).toEqual([]);
    expect(find({ owned: 'missing' }, new Map())).toHaveLength(3);
  });
});
