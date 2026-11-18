import { describe, expect, it } from 'vitest';
import { buildIndex, cardTitle, printName } from '../src/data/catalog-index';
import { filterCards, NO_FILTERS } from '../src/data/filter';
import type { Card, Catalog, Sku } from '../src/data/model';
import { detailOrder } from '../src/data/versions';

/**
 * Legenden führt der Katalog nur unter ihrem Titel („Loose Cannon“), der Champion steht als
 * Schlagwort dabei. Ohne Hilfe findet die Suche nach „Jinx“ sie nicht, und die Kachel verrät
 * nicht, zu wem sie gehört.
 */

const card = (id: string, name: string, type: string, tags: string[]): Card => ({
  id,
  slug: id,
  name,
  types: [type],
  superTypes: [],
  domains: ['fury', 'chaos'],
  energy: null,
  might: null,
  power: null,
  keywords: [],
  tags,
});

const sku = (id: string, cardId: string, code: string, change: Partial<Sku> = {}): Sku => ({
  id,
  cardId,
  setId: 'ogn',
  shortCode: code,
  publicCode: `${code}/298`,
  printedName: '',
  rarity: 'rare',
  artVariant: 'normal',
  isSigned: false,
  isOvernumbered: false,
  markers: [],
  size: 'standard',
  finish: 'foil',
  language: 'EN',
  imageId: null,
  channels: [],
  comment: null,
  // parseInt: Die signierte Fassung trägt ein Sternchen an der Nummer.
  rank: Number.parseInt(code.slice(4), 10),
  ...change,
});

const catalog: Catalog = {
  source: 'test',
  fetchedAt: '2026-11-18T00:00:00Z',
  images: { template: '', thumb: '', detail: '', full: '' },
  sets: [{ id: 'ogn', code: 'OGN', name: 'Origins', type: 'main', releasedAt: null }],
  cards: [
    card('jinx-unit', 'Jinx, Demolitionist', 'unit', ['Jinx']),
    card('jinx-legend', 'Loose Cannon', 'legend', ['Jinx']),
    card('jinx-spell', 'Super Mega Death Rocket!', 'spell', ['Jinx']),
    card('irelia-legend', 'Blade Dancer', 'legend', ['Irelia']),
    card('odd-legend', 'Nameless', 'legend', []),
    card('named-legend', 'Annie, Dark Child', 'legend', ['Annie']),
    card('two-tags', 'Shared Fate', 'legend', ['Xayah', 'Rakan']),
    card('ahri-legend', 'Nine-Tailed Fox', 'legend', ['Ahri']),
    card('ahri-unit', 'Ahri, Alluring', 'unit', ['Ahri']),
  ],
  skus: [
    sku('jinx-unit', 'jinx-unit', 'OGN-030'),
    sku('jinx-legend', 'jinx-legend', 'OGN-251'),
    sku('jinx-legend-over', 'jinx-legend', 'OGN-301', { isOvernumbered: true }),
    sku('jinx-legend-signed', 'jinx-legend', 'OGN-301*', { isOvernumbered: true, isSigned: true }),
    sku('jinx-spell', 'jinx-spell', 'OGN-252'),
    sku('irelia-legend', 'irelia-legend', 'OGN-195'),
    sku('odd-legend', 'odd-legend', 'OGN-260'),
    sku('named-legend', 'named-legend', 'OGN-261'),
    sku('two-tags', 'two-tags', 'OGN-262'),
    // Reihenfolge des Katalogs: Promos stehen zwischen den Karten aus den Boostern.
    sku('ahri-promo', 'ahri-legend', 'OGN-255', { rank: 500, markers: ['promo'], channels: ['release-event'] }),
    sku('ahri-promo-metal', 'ahri-legend', 'OGN-255', { rank: 501, markers: ['promo'], finish: 'metal' }),
    sku('ahri-standard', 'ahri-legend', 'OGN-255', { rank: 502 }),
    sku('ahri-signed', 'ahri-legend', 'OGN-299*', { rank: 503, isOvernumbered: true, isSigned: true }),
    sku('ahri-bundle', 'ahri-legend', 'KDA-002', { rank: 504, channels: ['kda-bundle'] }),
    sku('ahri-altart', 'ahri-legend', 'OGN-255a', { rank: 505, artVariant: 'altart' }),
    sku('ahri-over-deluxe', 'ahri-legend', 'OGN-299', { rank: 506, isOvernumbered: true, markers: ['promo'], finish: 'metal-deluxe' }),
    sku('ahri-over', 'ahri-legend', 'OGN-299', { rank: 507, isOvernumbered: true }),
    sku('ahri-unit-promo', 'ahri-unit', 'OGN-066', { rank: 600, markers: ['promo'] }),
    sku('ahri-unit', 'ahri-unit', 'OGN-066', { rank: 601 }),
  ],
};

const index = buildIndex(catalog);
const byId = (id: string) => catalog.cards.find((c) => c.id === id)!;
const found = (query: string, types: string[] = []) =>
  filterCards(index, { ...NO_FILTERS, query, types }, new Map()).map((g) => g.cardId);

describe('Legenden: angezeigter Name', () => {
  it('stellt den Champion vor den Titel, so wie die Units heißen', () => {
    expect(cardTitle(byId('jinx-legend'))).toBe('Jinx, Loose Cannon');
    expect(cardTitle(byId('irelia-legend'))).toBe('Irelia, Blade Dancer');
  });

  it('lässt alle anderen Karten unverändert', () => {
    expect(cardTitle(byId('jinx-unit'))).toBe('Jinx, Demolitionist');
    expect(cardTitle(byId('jinx-spell'))).toBe('Super Mega Death Rocket!');
  });

  it('rät nicht: ohne oder mit mehreren Schlagworten bleibt der Name der Quelle', () => {
    expect(cardTitle(byId('odd-legend'))).toBe('Nameless');
    expect(cardTitle(byId('two-tags'))).toBe('Shared Fate');
  });

  it('verdoppelt den Champion nicht, wenn die Quelle ihn schon nennt', () => {
    expect(cardTitle(byId('named-legend'))).toBe('Annie, Dark Child');
  });

  it('gilt für jede Fassung der Legende: normal, Overnumbered und signiert', () => {
    const names = index.printsByCardId.get('jinx-legend')!.map((p) => printName(index, p));
    expect(names).toEqual(['Jinx, Loose Cannon', 'Jinx, Loose Cannon', 'Jinx, Loose Cannon']);
  });
});

describe('Legenden: Suche', () => {
  it('findet mit dem Namen des Champions auch Legende und Signature Spell', () => {
    expect(found('jinx')).toEqual(['jinx-unit', 'jinx-legend', 'jinx-spell']);
  });

  it('findet die Legende weiter über ihren Titel und über beides zusammen', () => {
    expect(found('loose cannon')).toEqual(['jinx-legend']);
    expect(found('jinx loose')).toEqual(['jinx-legend']);
  });

  it('zeigt mit dem Kartentyp „Legend“ nur die Legende des gesuchten Champions', () => {
    expect(found('jinx', ['legend'])).toEqual(['jinx-legend']);
    expect(found('irelia', ['legend'])).toEqual(['irelia-legend']);
  });

  it('fasst alle Fassungen einer Legende zu einer Karte zusammen', () => {
    const [group] = filterCards(index, { ...NO_FILTERS, query: 'loose cannon' }, new Map());
    expect(group!.prints.map((p) => p.skus[0]!.id)).toEqual(['jinx-legend', 'jinx-legend-over', 'jinx-legend-signed']);
  });
});

describe('Legenden: Reihenfolge der Fassungen in der Kartenansicht', () => {
  const order = (cardId: string) =>
    detailOrder(byId(cardId), index.printsByCardId.get(cardId)!).map((p) => p.skus[0]!.id);

  it('zeigt normales Motiv, Overnumbered, Overnumbered signiert und dann die Promos', () => {
    expect(order('ahri-legend')).toEqual([
      'ahri-standard',
      'ahri-over',
      'ahri-signed',
      'ahri-altart',
      'ahri-promo',
      'ahri-bundle',
      'ahri-over-deluxe',
    ]);
  });

  it('lässt die Promos untereinander in der Reihenfolge des Katalogs', () => {
    const promos = order('ahri-legend').slice(4);
    const catalogOrder = index.printsByCardId.get('ahri-legend')!.map((p) => p.skus[0]!.id);
    expect(promos).toEqual(catalogOrder.filter((id) => promos.includes(id)));
  });

  it('zählt einen Druck als Sonderausgabe, sobald eines seiner Finishes Promo oder Metal ist', () => {
    const promo = index.printBySkuId.get('ahri-promo-metal')!;
    expect(promo.skus.map((x) => x.id)).toEqual(['ahri-promo', 'ahri-promo-metal']);
    expect(order('ahri-legend').indexOf('ahri-promo')).toBeGreaterThan(order('ahri-legend').indexOf('ahri-signed'));
  });

  it('ändert bei anderen Karten nichts', () => {
    // Im Katalog steht hier die Promo vor der gewöhnlichen Fassung; das bleibt so.
    expect(index.printsByCardId.get('ahri-unit')!.map((p) => p.skus[0]!.id)).toEqual(['ahri-unit-promo', 'ahri-unit']);
    expect(order('ahri-unit')).toEqual(['ahri-unit-promo', 'ahri-unit']);
    expect(detailOrder(undefined, [])).toEqual([]);
  });

  it('verändert die Reihenfolge im Katalog nicht (der Scanner arbeitet damit)', () => {
    const before = index.printsByCardId.get('ahri-legend')!.map((p) => p.key);
    detailOrder(byId('ahri-legend'), index.printsByCardId.get('ahri-legend')!);
    expect(index.printsByCardId.get('ahri-legend')!.map((p) => p.key)).toEqual(before);
  });
});
