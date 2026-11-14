import type { CatalogIndex } from './catalog-index';
import { parseCsvRecords, toCsv } from './csv';
import { normalize } from './filter';
import type { Finish, Sku } from './model';

/**
 * Sammlungsdatei von Piltover Archive (CSV). Der Aufbau stammt aus einer echten
 * Exportdatei vom 14.11.2026; Piltover Archive beschreibt das Format nicht öffentlich.
 */
export const PILTOVER_HEADER = [
  'Variant Number',
  'Card Name',
  'Set',
  'Set Prefix',
  'Rarity',
  'Variant Type',
  'Variant Label',
  'Foil',
  'Quantity',
  'Language',
  'Condition',
  'Grading Company',
  'Grading Value',
  'Grading Label',
  'Notes',
] as const;

/** Die Felder, die eine Fassung bei Piltover Archive beschreiben. */
export interface PiltoverTemplate {
  variantNumber: string;
  cardName: string;
  set: string;
  setPrefix: string;
  rarity: string;
  variantType: string;
  variantLabel: string;
  foil: boolean;
}

export interface PiltoverRow extends PiltoverTemplate {
  quantity: number;
  language: string;
  condition: string;
  /** Zeilennummer in der Datei, die Kopfzeile ist Zeile 1. */
  line: number;
}

export interface PiltoverUnmatched {
  row: PiltoverRow;
  reason: string;
}

/** Zugeordnet, aber ohne Bestätigung durch den Katalog (z. B. anderer Vertriebsweg). */
export interface PiltoverUncertain {
  row: PiltoverRow;
  sku: Sku;
  note: string;
}

export interface PiltoverImport {
  rows: number;
  totalQty: number;
  matchedQty: number;
  /** Sku-Id → Menge, über alle Zeilen summiert. */
  stock: Map<string, number>;
  /** Sku-Id → Originalfelder, damit der Export dieselbe Fassung wieder trifft. */
  templates: Map<string, PiltoverTemplate>;
  unmatched: PiltoverUnmatched[];
  uncertain: PiltoverUncertain[];
}

export function parsePiltoverCsv(text: string): PiltoverRow[] {
  const records = parseCsvRecords(text, ['Variant Number', 'Card Name', 'Foil', 'Quantity']);
  return records.map((r, i) => {
    const quantity = Number.parseInt(r.Quantity ?? '', 10);
    return {
      variantNumber: (r['Variant Number'] ?? '').trim(),
      cardName: (r['Card Name'] ?? '').trim(),
      set: r.Set ?? '',
      setPrefix: r['Set Prefix'] ?? '',
      rarity: r.Rarity ?? '',
      variantType: r['Variant Type'] ?? 'Standard',
      variantLabel: r['Variant Label'] ?? 'Standard',
      foil: (r.Foil ?? '').trim().toLowerCase() === 'true',
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
      language: r.Language || 'English',
      condition: r.Condition || 'Near Mint',
      line: i + 2,
    };
  });
}

/** "OGN-001-Nexus" → Set "OGN", Nummer "001", Zusatz "Nexus". */
const NUMBER = /^([A-Z0-9]+)-([A-Z]*\d+[a-z*]?)(?:-(.+))?$/i;

/** Zusatz an der Nummer → Teil des Vertriebsweg-Kürzels im Katalog. */
const TAG_CHANNEL: Record<string, string> = {
  nexus: 'nexus',
  skirmish: 'summoner',
  prerift: 'prerift',
  learn: 'learn',
  worlds: 'worlds',
};

type MatchResult = { sku: Sku; note?: string } | { sku: null; reason: string };

const pick = (list: Sku[], test: (s: Sku) => boolean) => {
  const hit = list.filter(test);
  return hit.length ? hit : list;
};

/** Ordnet eine Zeile genau einer Sku zu oder nennt den Grund, warum das nicht geht. */
export function matchPiltoverRow(row: PiltoverRow, index: CatalogIndex): MatchResult {
  if (normalize(row.language) !== 'english') {
    return { sku: null, reason: `Sprache „${row.language}“ führt der Katalog nicht` };
  }
  const m = NUMBER.exec(row.variantNumber);
  if (!m) return { sku: null, reason: 'Nummer nicht lesbar' };
  const [, setCode, number, tag] = m as unknown as [string, string, string, string | undefined];
  const finish: Finish = row.foil ? 'foil' : 'normal';

  let note: string | undefined;
  let cands = index.skusByShortCode.get(`${setCode}-${number}`.toUpperCase()) ?? [];
  if (cands.length === 0) {
    cands = byName(row, setCode, index);
    if (cands.length) note = 'Nummer fehlt im Katalog, über den Namen zugeordnet';
  }
  if (cands.length === 0) return { sku: null, reason: 'Karte nicht im Katalog' };

  cands = cands.filter((s) => s.finish === finish);
  if (cands.length === 0) {
    return { sku: null, reason: `Fassung gibt es laut Katalog nicht als ${row.foil ? 'Foil' : 'Normal'}` };
  }

  const promo = normalize(row.variantType) === 'promo';
  cands = pick(cands, (s) => s.markers.length > 0 === promo);
  cands = pick(cands, (s) => s.size === 'standard');
  cands = pick(cands, (s) => s.isSigned === /signed/i.test(row.variantLabel));
  const channel = tag ? TAG_CHANNEL[tag.toLowerCase()] : undefined;
  if (channel) {
    const viaChannel = cands.filter((s) => s.channels.some((c) => c.includes(channel)));
    if (viaChannel.length) cands = viaChannel;
    else note = `Katalog kennt für diese Nummer keine Fassung „${row.variantLabel}“`;
  }

  if (cands.length === 1) return note ? { sku: cands[0]!, note } : { sku: cands[0]! };
  return { sku: null, reason: `Nicht eindeutig: ${cands.length} mögliche Fassungen` };
}

/** Karten ohne aufgedruckte Nummer im Katalog (Tokens) findet nur der Name. */
function byName(row: PiltoverRow, setCode: string, index: CatalogIndex): Sku[] {
  const set = index.catalog.sets.find((s) => s.code.toUpperCase() === setCode.toUpperCase());
  if (!set) return [];
  const inSet = index.catalog.skus.filter((s) => s.setId === set.id);
  const quoted = inSet.filter((s) => s.comment?.includes(`"${row.cardName}"`));
  if (quoted.length) return quoted;
  const name = normalize(row.cardName);
  const sameName = inSet.filter((s) => normalize(index.cardById.get(s.cardId)?.name ?? s.printedName) === name);
  return pick(sameName, (s) => s.comment === null);
}

export function importPiltover(text: string, index: CatalogIndex): PiltoverImport {
  const rows = parsePiltoverCsv(text);
  const result: PiltoverImport = {
    rows: rows.length,
    totalQty: 0,
    matchedQty: 0,
    stock: new Map(),
    templates: new Map(),
    unmatched: [],
    uncertain: [],
  };
  for (const row of rows) {
    result.totalQty += row.quantity;
    const match = matchPiltoverRow(row, index);
    if (!match.sku) {
      result.unmatched.push({ row, reason: match.reason });
      continue;
    }
    const id = match.sku.id;
    if (match.note) result.uncertain.push({ row, sku: match.sku, note: match.note });
    result.matchedQty += row.quantity;
    result.stock.set(id, (result.stock.get(id) ?? 0) + row.quantity);
    if (!result.templates.has(id)) {
      const { quantity: _q, language: _l, condition: _c, line: _n, ...template } = row;
      result.templates.set(id, template);
    }
  }
  return result;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Schätzt die Piltover-Felder einer Sku nach den Mustern der Exportdatei.
 * Für Fassungen, die nie importiert wurden, gibt es keine sichere Quelle;
 * Metal-Fassungen kennt das Format gar nicht (→ null).
 */
export function derivePiltoverTemplate(sku: Sku, index: CatalogIndex): PiltoverTemplate | null {
  if (sku.finish !== 'normal' && sku.finish !== 'foil') return null;
  const set = index.setById.get(sku.setId);
  if (!set) return null;

  const foil = sku.finish === 'foil';
  const promo = sku.markers.length > 0;
  const nexus = sku.channels.find((c) => /^nexus-[a-z0-9]+$/.test(c) && c !== 'nexus-night');
  const has = (part: string) => sku.channels.some((c) => c.includes(part));
  const hasLetter = /[a-z]$/i.test(sku.shortCode);

  let tag = '';
  let label = 'Standard';
  let setName = set.name;
  let setPrefix = set.code;

  if (promo) {
    label = 'Promo';
    if (nexus) {
      const nexusCode = nexus.slice('nexus-'.length).toUpperCase();
      const nexusSet = index.catalog.sets.find((s) => s.code === nexusCode);
      setName = `${nexusSet?.name ?? set.name} | Nexus Night`;
      setPrefix = `${nexusCode}-NN`;
      label = 'Nexus Night Promo';
      tag = hasLetter ? '' : '-Nexus';
    } else if (sku.markers.includes('summoner')) {
      tag = '-Skirmish';
      label = 'Summoner Skirmish';
    } else if (has('prerift')) {
      tag = '-PreRift';
      label = 'Pre-Rift Promo';
    } else if (has('learn')) {
      tag = '-LEARN';
      label = 'Learn To Play Promo';
    } else if (has('worlds-2025')) {
      tag = '-Worlds';
      label = 'Worlds 2025 Bundle';
      setName = 'Worlds Bundle 2025';
      setPrefix = 'WRLD25';
    } else if (!hasLetter) {
      tag = '-Promo';
    }
  } else if (sku.artVariant === 'ultimate') label = 'Ultimate Rare';
  else if (sku.isOvernumbered) label = sku.isSigned ? 'Overnumbered Signed' : 'Overnumbered';
  else if (sku.artVariant === 'altart') label = 'Alt Art';

  const variantType = promo
    ? 'Promo'
    : sku.isOvernumbered
      ? 'Overnumbered'
      : sku.artVariant === 'altart'
        ? 'Alt Art'
        : 'Standard';

  return {
    variantNumber: `${sku.shortCode}${tag}`,
    // Piltover Archive schreibt gerade Apostrophe.
    cardName: (index.cardById.get(sku.cardId)?.name ?? sku.printedName).replace(/[‘’]/g, "'"),
    set: setName,
    setPrefix,
    rarity: capitalize(sku.rarity),
    variantType,
    variantLabel: label,
    foil,
  };
}

export interface PiltoverExport {
  csv: string;
  rows: number;
  totalQty: number;
  /** Zeilen, deren Piltover-Felder geschätzt sind, weil die Fassung nie importiert wurde. */
  derived: Sku[];
  /** Bestand, den das Format nicht ausdrücken kann (Metal) oder der nicht im Katalog steht. */
  skipped: Array<{ skuId: string; sku: Sku | null; qty: number }>;
}

export function exportPiltover(
  stock: Map<string, number>,
  index: CatalogIndex,
  learned: Map<string, PiltoverTemplate>,
  /** Zeilen eines früheren Imports, die sich nicht zuordnen ließen; sie werden unverändert mitgegeben. */
  extraRows: PiltoverRow[] = [],
): PiltoverExport {
  const result: PiltoverExport = { csv: '', rows: 0, totalQty: 0, derived: [], skipped: [] };
  const lines: Array<{ t: PiltoverTemplate; qty: number; language?: string; condition?: string }> = [];

  for (const [skuId, qty] of stock) {
    if (qty <= 0) continue;
    const sku = index.skuById.get(skuId) ?? null;
    const known = learned.get(skuId);
    const template = known ?? (sku ? derivePiltoverTemplate(sku, index) : null);
    if (!template) {
      result.skipped.push({ skuId, sku, qty });
      continue;
    }
    if (!known && sku) result.derived.push(sku);
    lines.push({ t: template, qty });
    result.totalQty += qty;
  }

  for (const row of extraRows) {
    if (row.quantity <= 0) continue;
    lines.push({ t: row, qty: row.quantity, language: row.language, condition: row.condition });
    result.totalQty += row.quantity;
  }

  lines.sort((a, b) => a.t.variantNumber.localeCompare(b.t.variantNumber, 'en', { numeric: true }));
  result.rows = lines.length;
  result.csv = toCsv([
    [...PILTOVER_HEADER],
    ...lines.map(({ t, qty, language, condition }) => [
      t.variantNumber,
      t.cardName,
      t.set,
      t.setPrefix,
      t.rarity,
      t.variantType,
      t.variantLabel,
      t.foil,
      qty,
      language ?? 'English',
      condition ?? 'Near Mint',
      '',
      '',
      '',
      '',
    ]),
  ]);
  return result;
}
