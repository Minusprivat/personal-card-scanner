import { printCode, printName, type CatalogIndex } from './catalog-index';
import type { Card, Print } from './model';
import { isPromo } from './versions';

export type Variant = 'standard' | 'altart' | 'overnumbered' | 'signed' | 'stamp' | 'metal';
export type OwnedFilter = 'all' | 'owned' | 'missing';

/**
 * Filter der Sammlung. Jede Liste erlaubt mehrere Werte; eine leere Liste schränkt nicht ein.
 * Innerhalb einer Liste genügt einer der Werte, zwischen den Listen müssen alle passen.
 * Bei Farben und Schlagwörtern lässt sich umstellen, dass die Karte alle gewählten trägt.
 */
export interface Filters {
  /** Name oder Kartennummer. */
  query: string;
  /** Wörter aus dem Kartentext, z. B. „move“. */
  text: string;
  setIds: string[];
  variants: Variant[];
  domains: string[];
  /** true: Die Karte muss alle gewählten Farben haben (zweifarbige Karten). */
  allDomains: boolean;
  types: string[];
  rarities: string[];
  keywords: string[];
  /** true: Die Karte muss alle gewählten Schlagwörter tragen. */
  allKeywords: boolean;
  owned: OwnedFilter;
}

export const NO_FILTERS: Filters = {
  query: '',
  text: '',
  setIds: [],
  variants: [],
  domains: [],
  allDomains: false,
  types: [],
  rarities: [],
  keywords: [],
  allKeywords: false,
  owned: 'all',
};

export const VARIANT_LABELS: Record<Variant, string> = {
  standard: 'Standard',
  altart: 'Alt-Art',
  overnumbered: 'Overnumbered',
  signed: 'Signiert',
  stamp: 'Promo',
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

/** Kartentypen und Obertypen der Quelle; die Namen bleiben englisch wie auf der Karte. */
export const TYPE_LABELS: Record<string, string> = {
  unit: 'Unit',
  spell: 'Spell',
  gear: 'Gear',
  legend: 'Legend',
  battlefield: 'Battlefield',
  rune: 'Rune',
  champion: 'Champion',
  signature: 'Signature',
  token: 'Token',
};

export const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  showcase: 'Showcase',
};

/** Zahl der gesetzten Filter ohne die beiden Suchfelder; steht am Knopf „Filter“. */
export const activeFilterCount = (f: Filters): number =>
  f.setIds.length +
  f.variants.length +
  f.domains.length +
  f.types.length +
  f.rarities.length +
  f.keywords.length +
  (f.owned === 'all' ? 0 : 1);

export const hasFilters = (f: Filters): boolean =>
  activeFilterCount(f) > 0 || f.query.trim() !== '' || f.text.trim() !== '';

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

function matchesVariant(print: Print, v: Variant): boolean {
  const s = print.skus[0]!;
  switch (v) {
    case 'standard':
      return s.artVariant === 'normal' && !s.isOvernumbered && !s.isSigned && s.markers.length === 0;
    case 'altart':
      return s.artVariant !== 'normal';
    case 'overnumbered':
      return s.isOvernumbered;
    case 'signed':
      return s.isSigned;
    case 'stamp':
      return isPromo(s);
    case 'metal':
      return print.skus.some((x) => x.finish === 'metal' || x.finish === 'metal-deluxe');
  }
}

/** Eine leere Auswahl passt immer; sonst muss einer (oder jeder) der gewählten Werte vorkommen. */
function matchesList(chosen: string[], present: string[], all = false): boolean {
  if (chosen.length === 0) return true;
  return all ? chosen.every((c) => present.includes(c)) : chosen.some((c) => present.includes(c));
}

/**
 * Suchtext eines Drucks: Name, aufgedruckter Name, Nummer in beiden Schreibweisen und die
 * Namen, zu denen die Karte gehört (`Card.tags`, meist der Champion). So findet „Jinx“ auch
 * die Legende „Loose Cannon“ und den Signature Spell.
 */
function haystack(index: CatalogIndex, print: Print): string {
  const s = print.skus[0]!;
  const tags = index.cardById.get(print.cardId)?.tags ?? [];
  return normalize(`${printName(index, print)} ${s.printedName} ${printCode(print)} ${s.shortCode} ${tags.join(' ')}`);
}

/** Kartentexte in Suchform, je Katalogstand einmal aufbereitet. */
const textCache = new WeakMap<CatalogIndex, Map<string, string>>();

function cardText(index: CatalogIndex, card: Card): string {
  let texts = textCache.get(index);
  if (!texts) textCache.set(index, (texts = new Map()));
  let text = texts.get(card.id);
  if (text === undefined) {
    // Führendes Leerzeichen: So lässt sich jeder Wortanfang als „ wort“ finden.
    text = ` ${normalize(card.text ?? '')}`;
    texts.set(card.id, text);
  }
  return text;
}

/**
 * Suche im Kartentext: Jedes Suchwort muss am Anfang eines Wortes stehen. „move“ findet
 * „Move“, „moves“ und „moved“, aber nicht „remove“.
 */
export function matchesCardText(index: CatalogIndex, card: Card | undefined, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  if (!card) return false;
  const text = cardText(index, card);
  return tokens.every((t) => text.includes(` ${t}`));
}

export function filterPrints(
  index: CatalogIndex,
  filters: Filters,
  ownedQty: (print: Print) => number,
): Print[] {
  const tokens = normalize(filters.query).split(' ').filter(Boolean);
  const textTokens = normalize(filters.text).split(' ').filter(Boolean);
  return index.prints.filter((print) => {
    if (filters.setIds.length && !filters.setIds.includes(print.setId)) return false;
    if (filters.variants.length && !filters.variants.some((v) => matchesVariant(print, v))) return false;
    if (filters.rarities.length && !filters.rarities.includes(print.skus[0]!.rarity)) return false;

    const card = index.cardById.get(print.cardId);
    if (!matchesList(filters.domains, card?.domains ?? [], filters.allDomains)) return false;
    if (!matchesList(filters.types, card ? [...card.types, ...card.superTypes] : [])) return false;
    if (!matchesList(filters.keywords, card?.keywords ?? [], filters.allKeywords)) return false;

    if (filters.owned !== 'all') {
      const owned = ownedQty(print) > 0;
      if (owned !== (filters.owned === 'owned')) return false;
    }
    if (tokens.length) {
      const hay = haystack(index, print);
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return matchesCardText(index, card, textTokens);
  });
}

/** Eine Karte in der Übersicht der Sammlung, mit allen ihren Fassungen. */
export interface CardGroup {
  cardId: string;
  card: Card | undefined;
  /** Alle Drucke der Karte, unabhängig von den Filtern. */
  prints: Print[];
  /** Die Drucke, auf die die Filter zutreffen; der erste liefert das Bild der Kachel. */
  matched: Print[];
}

/**
 * Filtert wie `filterPrints`, fasst das Ergebnis aber je Karte zusammen. Eine Karte erscheint,
 * sobald eine ihrer Fassungen zu den Filtern passt.
 *
 * „Besitze ich“ und „Fehlt mir“ beziehen sich auf die passenden Fassungen: Mit dem Filter
 * „Promo“ zeigt „Fehlt mir“ die Karten, von deren Promos keine in der Sammlung liegt.
 */
export function filterCards(index: CatalogIndex, filters: Filters, stock: Map<string, number>): CardGroup[] {
  const groups = new Map<string, CardGroup>();
  for (const print of filterPrints(index, { ...filters, owned: 'all' }, () => 0)) {
    const group = groups.get(print.cardId);
    if (group) group.matched.push(print);
    else {
      groups.set(print.cardId, {
        cardId: print.cardId,
        card: index.cardById.get(print.cardId),
        prints: index.printsByCardId.get(print.cardId) ?? [print],
        matched: [print],
      });
    }
  }
  const all = [...groups.values()];
  if (filters.owned === 'all') return all;
  const owns = (g: CardGroup) => g.matched.some((p) => p.skus.some((s) => (stock.get(s.id) ?? 0) > 0));
  return all.filter((g) => owns(g) === (filters.owned === 'owned'));
}
