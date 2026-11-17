import {
  FINISHES,
  type Card,
  type CardmarketLink,
  type CardSet,
  type Catalog,
  type CatalogSource,
  type Finish,
  type Sku,
} from '../../../src/data/model';
import { fetchJsonCached, type FetchOptions } from '../http';

const BASE = 'https://openrift.app';
export const OPENRIFT_CATALOG_URL = `${BASE}/api/v1/catalog?langs=EN`;
export const OPENRIFT_LINKS_URL = `${BASE}/api/v1/prices/links`;

type Obj = Record<string, unknown>;

function obj(v: unknown, what: string): Obj {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`OpenRift: "${what}" fehlt oder hat ein unerwartetes Format.`);
  }
  return v as Obj;
}
function arr(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`OpenRift: "${what}" ist keine Liste.`);
  return v;
}
function str(v: unknown, what: string): string {
  if (typeof v !== 'string') throw new Error(`OpenRift: "${what}" ist kein Text.`);
  return v;
}
const strList = (v: unknown, what: string) => arr(v ?? [], what).map((x) => str(x, what));
const numOrNull = (v: unknown) => (typeof v === 'number' ? v : null);

const DOMAIN_NAMES: Record<string, string> = {
  fury: 'Fury',
  calm: 'Calm',
  mind: 'Mind',
  body: 'Body',
  chaos: 'Chaos',
  order: 'Order',
};

/**
 * Übersetzt die Auszeichnung von OpenRift in Klartext: Symbole wie `:rb_might:` werden zu
 * Wörtern, die Kursiv-Marken um Erklärungen (`_(…)_`) fallen weg. Schlagwörter behalten
 * ihre eckigen Klammern, z. B. „[Reaction]“.
 */
export function plainCardText(markup: string): string {
  return markup
    .replace(/:rb_energy_(\d+):/g, '($1)')
    .replace(/:rb_rune_([a-z]+):/g, (_, name: string) => (DOMAIN_NAMES[name] ? `${DOMAIN_NAMES[name]}-Rune` : 'Rune'))
    .replace(/:rb_might:/g, 'Might')
    .replace(/:rb_exhaust:/g, 'Exhaust')
    .replace(/:rb_([a-z0-9_]+):/g, '$1')
    .replace(/\[>\]/g, '→')
    .replace(/_/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

/** Text eines Eintrags: Regeltext und, falls vorhanden, der zweite Textkasten. */
function printingText(p: Obj): string {
  return [p.printedRulesText, p.printedEffectText]
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map(plainCardText)
    .join('\n');
}

/**
 * Namen der Vertriebswege. Die Quelle führt sie als Baum (Turnier › Regional Qualifier ›
 * Origins Season › Best Of); daraus wird ein lesbarer Pfad je Kürzel. Der Oberbegriff
 * „Tournament“ fällt weg, er sagt nichts über die Karte.
 */
function channelNames(raw: unknown): Record<string, string> {
  const list = Array.isArray(raw) ? raw.filter((c): c is Obj => typeof c === 'object' && c !== null) : [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const path = (c: Obj, depth = 0): string[] => {
    const parent = typeof c.parentId === 'string' ? byId.get(c.parentId) : undefined;
    const label = typeof c.label === 'string' ? c.label : String(c.slug);
    // Die Tiefe begrenzt den Aufstieg, falls die Quelle einmal einen Kreis enthält.
    return parent && depth < 8 ? [...path(parent, depth + 1), label] : [label];
  };
  const names: Record<string, string> = {};
  for (const c of list) {
    if (typeof c.slug !== 'string') continue;
    const parts = path(c);
    names[c.slug] = (parts.length > 1 && parts[0] === 'Tournament' ? parts.slice(1) : parts).join(' › ');
  }
  return names;
}

function markerNames(raw: unknown): Record<string, string> {
  const names: Record<string, string> = {};
  for (const m of Array.isArray(raw) ? raw : []) {
    const marker = m as Obj | null;
    if (marker && typeof marker.slug === 'string' && typeof marker.label === 'string') names[marker.slug] = marker.label;
  }
  return names;
}

/** Wandelt die Antwort von /api/v1/catalog in das Modell der App. Wirft bei unbekanntem Aufbau. */
export function parseOpenRiftCatalog(raw: unknown, fetchedAt: string): Catalog {
  const root = obj(raw, 'catalog');

  const sets: CardSet[] = arr(root.sets, 'sets').map((v) => {
    const s = obj(v, 'set');
    const releases = (s.releases ?? {}) as Record<string, { releasedAt?: string | null } | undefined>;
    return {
      id: str(s.id, 'set.id'),
      code: str(s.slug, 'set.slug'),
      name: str(s.name, 'set.name'),
      type: s.setType === 'main' ? 'main' : 'supplemental',
      releasedAt: releases.EN?.releasedAt ?? null,
    };
  });

  const rawCards = obj(root.cards, 'cards');

  // Der Text steht in der Quelle am Eintrag. Für die Karte gilt der Text des ersten Eintrags
  // (kleinster Rang), der einen trägt; spätere Drucke kürzen oft nur die Erklärungen.
  const cardText = new Map<string, { rank: number; text: string }>();
  for (const v of Object.values(obj(root.printings, 'printings'))) {
    const p = obj(v, 'printing');
    const text = printingText(p);
    if (!text || typeof p.cardId !== 'string') continue;
    const rank = numOrNull(p.canonicalRank) ?? Number.MAX_SAFE_INTEGER;
    const known = cardText.get(p.cardId);
    if (!known || rank < known.rank) cardText.set(p.cardId, { rank, text });
  }

  const cards: Card[] = Object.entries(rawCards).map(([id, v]) => {
    const c = obj(v, 'card');
    const text = cardText.get(id)?.text;
    return {
      id,
      slug: str(c.slug, 'card.slug'),
      name: str(c.name, 'card.name'),
      types: strList(c.types, 'card.types'),
      superTypes: strList(c.superTypes, 'card.superTypes'),
      domains: strList(c.domains, 'card.domains'),
      energy: numOrNull(c.energy),
      might: numOrNull(c.might),
      power: numOrNull(c.power),
      keywords: strList(c.keywords, 'card.keywords'),
      tags: strList(c.tags, 'card.tags'),
      ...(text ? { text } : {}),
    };
  });

  const cardNames = new Map(cards.map((c) => [c.id, c.name]));

  const skus: Sku[] = Object.entries(obj(root.printings, 'printings')).map(([id, v]) => {
    const p = obj(v, 'printing');
    const finish = str(p.finish, 'printing.finish');
    if (!(FINISHES as readonly string[]).includes(finish)) {
      throw new Error(`OpenRift: unbekanntes Finish "${finish}" bei ${String(p.publicCode)}.`);
    }
    const images = arr(p.images ?? [], 'printing.images');
    const firstImage = images.length ? obj(images[0], 'printing.images[0]') : null;
    const channels = arr(p.distributionChannels ?? [], 'printing.distributionChannels').map((c) =>
      typeof c === 'string' ? c : str(obj(c, 'distributionChannel').channel, 'distributionChannel.channel'),
    );
    return {
      id,
      cardId: str(p.cardId, 'printing.cardId'),
      setId: str(p.setId, 'printing.setId'),
      shortCode: str(p.shortCode, 'printing.shortCode'),
      publicCode: str(p.publicCode, 'printing.publicCode'),
      // Nicht jeder Eintrag führt einen aufgedruckten Namen; dann gilt der Kartenname.
      printedName:
        typeof p.printedName === 'string' ? p.printedName : (cardNames.get(str(p.cardId, 'printing.cardId')) ?? ''),
      rarity: str(p.rarity, 'printing.rarity'),
      artVariant: str(p.artVariant, 'printing.artVariant'),
      isSigned: p.isSigned === true,
      isOvernumbered: p.isOvernumbered === true,
      markers: strList(p.markers, 'printing.markers'),
      size: typeof p.size === 'string' ? p.size : 'standard',
      finish: finish as Finish,
      language: str(p.language, 'printing.language'),
      imageId: firstImage ? str(firstImage.imageId, 'image.imageId') : null,
      channels,
      comment: typeof p.comment === 'string' ? p.comment : null,
      rank: numOrNull(p.canonicalRank) ?? Number.MAX_SAFE_INTEGER,
    };
  });

  return {
    source: 'OpenRift',
    fetchedAt,
    images: { template: `${BASE}/media/cards/{id}-{size}.webp`, thumb: '240w', detail: '400w', full: 'full' },
    sets,
    cards,
    skus,
    channels: channelNames(root.distributionChannels),
    markerLabels: markerNames(root.markers),
  };
}

/** Wandelt /api/v1/prices/links in Sku-Id → Cardmarket-Produkt. Einträge ohne Produkt entfallen. */
export function parseOpenRiftLinks(raw: unknown): Map<string, CardmarketLink> {
  const links = obj(obj(raw, 'links-Antwort').links, 'links');
  const result = new Map<string, CardmarketLink>();
  for (const [skuId, v] of Object.entries(links)) {
    const cm = (v as Obj | null)?.cardmarket as Obj | null | undefined;
    if (!cm || typeof cm.productId !== 'number' || typeof cm.url !== 'string') continue;
    result.set(skuId, { productId: cm.productId, url: cm.url });
  }
  return result;
}

export class OpenRiftSource implements CatalogSource {
  readonly name = 'OpenRift';
  constructor(private readonly opts: FetchOptions) {}

  async loadCatalog(): Promise<Catalog> {
    const res = await fetchJsonCached<unknown>('openrift-catalog', OPENRIFT_CATALOG_URL, this.opts);
    return parseOpenRiftCatalog(res.data, res.fetchedAt);
  }

  async loadCardmarketLinks(): Promise<Map<string, CardmarketLink>> {
    const res = await fetchJsonCached<unknown>('openrift-links', OPENRIFT_LINKS_URL, this.opts);
    return parseOpenRiftLinks(res.data);
  }
}
