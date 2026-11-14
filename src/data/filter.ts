import { printCode, printName, type CatalogIndex } from './catalog-index';
import type { Print } from './model';

export type VariantFilter = 'all' | 'standard' | 'altart' | 'overnumbered' | 'signed' | 'stamp' | 'metal';
export type OwnedFilter = 'all' | 'owned' | 'missing';

export interface Filters {
  query: string;
  setId: string;
  variant: VariantFilter;
  domain: string;
  owned: OwnedFilter;
}

export const NO_FILTERS: Filters = { query: '', setId: 'all', variant: 'all', domain: 'all', owned: 'all' };

export const VARIANT_LABELS: Record<VariantFilter, string> = {
  all: 'Alle Varianten',
  standard: 'Standard',
  altart: 'Alt-Art',
  overnumbered: 'Overnumbered',
  signed: 'Signiert',
  stamp: 'Promo / Stempel',
  metal: 'Metal',
};

export const DOMAIN_LABELS: Record<string, string> = {
  fury: 'Fury',
  calm: 'Calm',
  mind: 'Mind',
  body: 'Body',
  chaos: 'Chaos',
  order: 'Order',
  neutral: 'Neutral',
  colorless: 'Farblos',
};

/** Kleinschreibung ohne Akzente und Satzzeichen, damit „jinx demol“ und „OGN 142“ treffen. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Apostrophe fallen weg, damit „kaisa“ die Karte „Kai’Sa“ findet.
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9*]+/g, ' ')
    .trim();

function matchesVariant(print: Print, v: VariantFilter): boolean {
  const s = print.skus[0]!;
  switch (v) {
    case 'all':
      return true;
    case 'standard':
      return s.artVariant === 'normal' && !s.isOvernumbered && !s.isSigned && s.markers.length === 0;
    case 'altart':
      return s.artVariant !== 'normal';
    case 'overnumbered':
      return s.isOvernumbered;
    case 'signed':
      return s.isSigned;
    case 'stamp':
      return s.markers.length > 0;
    case 'metal':
      return print.skus.some((x) => x.finish === 'metal' || x.finish === 'metal-deluxe');
  }
}

/** Suchtext eines Drucks: Name, aufgedruckter Name und Nummer in beiden Schreibweisen. */
function haystack(index: CatalogIndex, print: Print): string {
  const s = print.skus[0]!;
  return normalize(`${printName(index, print)} ${s.printedName} ${printCode(print)} ${s.shortCode}`);
}

export function filterPrints(
  index: CatalogIndex,
  filters: Filters,
  ownedQty: (print: Print) => number,
): Print[] {
  const tokens = normalize(filters.query).split(' ').filter(Boolean);
  return index.prints.filter((print) => {
    if (filters.setId !== 'all' && print.setId !== filters.setId) return false;
    if (!matchesVariant(print, filters.variant)) return false;
    if (filters.domain !== 'all' && !index.cardById.get(print.cardId)?.domains.includes(filters.domain)) {
      return false;
    }
    if (filters.owned !== 'all') {
      const owned = ownedQty(print) > 0;
      if (owned !== (filters.owned === 'owned')) return false;
    }
    if (tokens.length) {
      const hay = haystack(index, print);
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}
