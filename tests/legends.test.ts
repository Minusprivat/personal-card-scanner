import { describe, expect, it } from 'vitest';
import { buildIndex, cardTitle, printName } from '../src/data/catalog-index';
import { filterCards, NO_FILTERS } from '../src/data/filter';
import type { Card, Catalog, Sku } from '../src/data/model';

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
  rank: Number(code.slice(4)),
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
