import { type CatalogIndex } from './catalog-index';
import { parseCsvRecords, toCsv } from './csv';
import { FINISH_LABELS, type Finish } from './model';
import type { PiltoverRow, PiltoverTemplate } from './piltover';
import { variantLabel } from './prints';

/** Alles, was die Sammlung ausmacht und in die Sicherung gehört. */
export interface CollectionState {
  /** Sku-Id → Menge. */
  stock: Map<string, number>;
  /** Sku-Id → Felder aus einem Piltover-Import, für den verlustfreien Rückweg. */
  templates: Map<string, PiltoverTemplate>;
  /** Piltover-Zeilen, die sich keiner Sku zuordnen ließen. */
  extraRows: PiltoverRow[];
}

export const emptyCollection = (): CollectionState => ({ stock: new Map(), templates: new Map(), extraRows: [] });

export const BACKUP_FORMAT = 'personal-card-scanner-backup';

interface BackupItem {
  skuId: string;
  qty: number;
  /** Lesbare Angaben, damit die Datei auch ohne Katalog verständlich bleibt. */
  code?: string;
  name?: string;
  variant?: string;
  finish?: string;
}

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  stock: BackupItem[];
  piltoverTemplates: Record<string, PiltoverTemplate>;
  piltoverExtraRows: PiltoverRow[];
}

export function createBackup(state: CollectionState, index: CatalogIndex, exportedAt: string): string {
  const stock: BackupItem[] = [];
  for (const [skuId, qty] of state.stock) {
    if (qty <= 0) continue;
    const sku = index.skuById.get(skuId);
    stock.push(
      sku
        ? {
            skuId,
            qty,
            code: sku.publicCode || sku.shortCode,
            name: index.cardById.get(sku.cardId)?.name ?? sku.printedName,
            variant: variantLabel(sku),
            finish: sku.finish,
          }
        : { skuId, qty },
    );
  }
  stock.sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'en', { numeric: true }));
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt,
    stock,
    piltoverTemplates: Object.fromEntries(state.templates),
    piltoverExtraRows: state.extraRows,
  };
  return JSON.stringify(file, null, 1);
}

/** Liest eine Sicherung. Wirft mit verständlicher Meldung, wenn die Datei nicht passt. */
export function parseBackup(text: string): CollectionState {
  let file: Partial<BackupFile>;
  try {
    file = JSON.parse(text) as Partial<BackupFile>;
  } catch {
    throw new Error('Die Datei ist keine gültige JSON-Datei.');
  }
  if (file?.format !== BACKUP_FORMAT || !Array.isArray(file.stock)) {
    throw new Error('Die Datei ist keine Sicherung dieser App.');
  }
  if (file.version !== 1) throw new Error(`Unbekannte Sicherungs-Version ${String(file.version)}.`);

  const state = emptyCollection();
  for (const item of file.stock) {
    if (typeof item?.skuId !== 'string' || !Number.isInteger(item.qty) || item.qty <= 0) continue;
    state.stock.set(item.skuId, (state.stock.get(item.skuId) ?? 0) + item.qty);
  }
  for (const [skuId, t] of Object.entries(file.piltoverTemplates ?? {})) state.templates.set(skuId, t);
  state.extraRows = Array.isArray(file.piltoverExtraRows) ? file.piltoverExtraRows : [];
  return state;
}

const CSV_HEADER = ['Nummer', 'Name', 'Set', 'Variante', 'Finish', 'Menge', 'ID'] as const;

/** Tabelle für Excel und Co. Die Spalte ID macht den Import eindeutig. */
export function exportCollectionCsv(stock: Map<string, number>, index: CatalogIndex): string {
  const rows: Array<Array<string | number>> = [];
  for (const [skuId, qty] of stock) {
    if (qty <= 0) continue;
    const sku = index.skuById.get(skuId);
    if (!sku) {
      rows.push(['', '', '', '', '', qty, skuId]);
      continue;
    }
    rows.push([
      sku.publicCode || sku.shortCode,
      index.cardById.get(sku.cardId)?.name ?? sku.printedName,
      index.setById.get(sku.setId)?.code ?? '',
      variantLabel(sku),
      FINISH_LABELS[sku.finish],
      qty,
      skuId,
    ]);
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'en', { numeric: true }));
  return toCsv([[...CSV_HEADER], ...rows]);
}

export interface CsvImport {
  stock: Map<string, number>;
  /** Zeilen, die sich keiner Fassung zuordnen ließen (Zeilennummern). */
  unknownLines: number[];
}

const finishByLabel = new Map<string, Finish>(
  (Object.entries(FINISH_LABELS) as Array<[Finish, string]>).map(([f, label]) => [label.toLowerCase(), f]),
);

export function importCollectionCsv(text: string, index: CatalogIndex): CsvImport {
  const records = parseCsvRecords(text, ['Menge']);
  const result: CsvImport = { stock: new Map(), unknownLines: [] };
  records.forEach((r, i) => {
    const qty = Number.parseInt(r.Menge ?? '', 10);
    if (!Number.isFinite(qty) || qty <= 0) return;

    let skuId = r.ID && index.skuById.has(r.ID) ? r.ID : undefined;
    if (!skuId && r.Nummer) {
      // Ohne ID: Nummer, Variante und Finish müssen zusammen genau eine Fassung treffen.
      const finish = finishByLabel.get((r.Finish ?? 'Normal').trim().toLowerCase());
      const hits = index.catalog.skus.filter(
        (s) =>
          (s.publicCode === r.Nummer || s.shortCode === r.Nummer) &&
          s.finish === finish &&
          (!r.Variante || variantLabel(s) === r.Variante),
      );
      if (hits.length === 1) skuId = hits[0]!.id;
    }
    if (!skuId) {
      result.unknownLines.push(i + 2);
      return;
    }
    result.stock.set(skuId, (result.stock.get(skuId) ?? 0) + qty);
  });
  return result;
}
