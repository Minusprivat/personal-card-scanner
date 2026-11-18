import type { Card, Catalog, Print, Sku } from './model';

/**
 * Fassungen einer Karte, wie die Übersicht der Sammlung sie zählt:
 * „Normal: 2 | Foil: 1 | Promo: 1“.
 *
 * - Normal und Foil: Karten aus den Boostern, auch Alt-Art, Overnumbered und signiert.
 * - Promo: alles mit Stempel oder besonderer Herkunft (Events, Turniere, Bundles).
 * - Metal: Metal und Metal Deluxe; sie sind immer Sonderausgaben, zählen aber für sich.
 */
export const VERSION_KINDS = ['normal', 'foil', 'promo', 'metal'] as const;
export type VersionKind = (typeof VERSION_KINDS)[number];

export const VERSION_LABELS: Record<VersionKind, string> = {
  normal: 'Normal',
  foil: 'Foil',
  promo: 'Promo',
  metal: 'Metal',
};

/** true für Fassungen mit Stempel oder besonderer Herkunft (Event, Turnier, Bundle). */
export const isPromo = (sku: Sku): boolean => sku.markers.length > 0 || sku.channels.length > 0;

export function versionKind(sku: Sku): VersionKind {
  if (sku.finish === 'metal' || sku.finish === 'metal-deluxe') return 'metal';
  if (isPromo(sku)) return 'promo';
  return sku.finish;
}

export interface KindCount {
  /** So viele Fassungen dieser Art gibt es von der Karte. */
  versions: number;
  /** So viele Karten davon liegen in der Sammlung. */
  qty: number;
}

/** Zählt je Art, wie viele Fassungen es gibt und wie viele Karten im Bestand sind. */
export function countByKind(prints: Print[], stock: Map<string, number>): Record<VersionKind, KindCount> {
  const counts: Record<VersionKind, KindCount> = {
    normal: { versions: 0, qty: 0 },
    foil: { versions: 0, qty: 0 },
    promo: { versions: 0, qty: 0 },
    metal: { versions: 0, qty: 0 },
  };
  for (const print of prints) {
    for (const sku of print.skus) {
      const count = counts[versionKind(sku)];
      count.versions++;
      count.qty += stock.get(sku.id) ?? 0;
    }
  }
  return counts;
}

/** Die Arten, die es von der Karte gibt, in fester Reihenfolge; Arten ohne Fassung fehlen. */
export function kindSummary(
  counts: Record<VersionKind, KindCount>,
): Array<{ kind: VersionKind; label: string; qty: number }> {
  return VERSION_KINDS.filter((kind) => counts[kind].versions > 0).map((kind) => ({
    kind,
    label: VERSION_LABELS[kind],
    qty: counts[kind].qty,
  }));
}

/**
 * Platz eines Drucks in der Kartenansicht einer Legende: erst die Karten aus den Boostern
 * (normales Motiv, Overnumbered, Overnumbered signiert, sonstige), dann alle Sonderausgaben.
 * Ein Druck gilt als Sonderausgabe, sobald eines seiner Finishes Promo oder Metal ist.
 */
function legendRank(print: Print): number {
  const booster = print.skus.every((s) => versionKind(s) === 'normal' || versionKind(s) === 'foil');
  if (!booster) return 4;
  const s = print.skus[0]!;
  if (s.isOvernumbered) return s.isSigned ? 2 : 1;
  return s.artVariant === 'normal' && !s.isSigned ? 0 : 3;
}

/**
 * Drucke einer Karte in der Reihenfolge der Kartenansicht. Legenden zeigen erst das normale
 * Motiv, dann Overnumbered, dann Overnumbered signiert und danach die Promos; innerhalb einer
 * Gruppe bleibt die Reihenfolge des Katalogs. Alle anderen Karten bleiben, wie sie sind.
 * Gilt nur für die Anzeige: Der Scanner arbeitet mit der Reihenfolge des Katalogs.
 */
export function detailOrder(card: Card | undefined, prints: Print[]): Print[] {
  if (!card?.types.includes('legend')) return prints;
  return prints
    .map((print, at) => ({ print, at, rank: legendRank(print) }))
    .sort((a, b) => a.rank - b.rank || a.at - b.at)
    .map((entry) => entry.print);
}

/**
 * Woher eine Fassung stammt, z. B. ["Nexus Night › Origins"] oder ["Worlds 2026 Bundle"].
 * Leer für Karten aus den Boostern. Kennt der Katalog den Namen nicht, steht das Kürzel da.
 */
export function originLabels(sku: Sku, catalog: Catalog): string[] {
  return sku.channels.map((slug) => catalog.channels?.[slug] ?? slug);
}

/**
 * Fasst Herkünfte zusammen, die sich nur in der Saison unterscheiden:
 * „Regional Qualifier › Origins Season › Best Of“ und „… › Spiritforged Season › Best Of“
 * werden zu „Regional Qualifier › Best Of (Origins, Spiritforged)“.
 */
export function compactOrigins(labels: string[]): string[] {
  const result: string[] = [];
  const seasons = new Map<string, string[]>();
  for (const label of labels) {
    const parts = label.split(' › ');
    if (parts.length !== 3) {
      result.push(label);
      continue;
    }
    const key = `${parts[0]} › ${parts[2]}`;
    const list = seasons.get(key);
    if (list) list.push(parts[1]!);
    else {
      seasons.set(key, [parts[1]!]);
      // Platzhalter an der Stelle des ersten Vorkommens; unten wird er ersetzt.
      result.push(key);
    }
  }
  return result.map((entry) => {
    const list = seasons.get(entry);
    return list ? `${entry} (${list.map((s) => s.replace(/ Season$/, '')).join(', ')})` : entry;
  });
}

/** Herkunft eines Drucks über alle seine Finishes, ohne Doppelte. */
export function printOrigins(print: Print, catalog: Catalog): string[] {
  return [...new Set(print.skus.flatMap((sku) => originLabels(sku, catalog)))];
}
