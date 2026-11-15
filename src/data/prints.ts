import { FINISHES, type Print, type Sku } from './model';

const finishOrder = (s: Sku) => FINISHES.indexOf(s.finish);

/** Alles, was einen Druck ausmacht – außer dem Finish. */
function baseKey(s: Sku): string {
  const parts = [s.publicCode || s.shortCode, s.artVariant];
  if (s.isSigned) parts.push('signed');
  if (s.markers.length) parts.push([...s.markers].sort().join('+'));
  if (s.size !== 'standard') parts.push(s.size);
  if (s.language !== 'EN') parts.push(s.language);
  // Karten ohne aufgedruckte Nummer (z. B. Tokens) teilen sich den Code; die Karte trennt sie.
  return `${parts.join('|')}@${s.cardId}`;
}

/** Kurzbeschreibung der Fassung für Listen, z. B. "Alt-Art, Overnumbered, Stempel: promo". */
export function variantLabel(s: Sku): string {
  const parts: string[] = [];
  if (s.artVariant === 'altart') parts.push('Alt-Art');
  else if (s.artVariant !== 'normal') parts.push(s.artVariant);
  if (s.isOvernumbered) parts.push('Overnumbered');
  if (s.isSigned) parts.push('signiert');
  if (s.markers.length) parts.push(`Stempel: ${s.markers.join(', ')}`);
  if (s.size !== 'standard') parts.push('Übergröße');
  return parts.length ? parts.join(', ') : 'Standard';
}

const hasDuplicateFinish =(skus: Sku[]) => new Set(skus.map((s) => s.finish)).size !== skus.length;

/**
 * Fasst Skus zu Drucken zusammen: gleiche Fassung, nur das Finish unterscheidet sich.
 *
 * Manche Drucke sind in der Quelle bis auf Vertriebsweg oder Kommentar identisch
 * (z. B. Messe-Exemplare). Käme dadurch ein Finish doppelt vor, wird die Gruppe
 * erst nach Vertriebsweg und Kommentar, zuletzt nach Reihenfolge geteilt.
 */
export function groupPrints(skus: Sku[]): Print[] {
  const groups = new Map<string, Sku[]>();
  const add = (key: string, s: Sku) => {
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  };

  const sorted = [...skus].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  for (const s of sorted) add(baseKey(s), s);

  const prints: Print[] = [];
  for (const [key, members] of groups) {
    for (const [subKey, list] of splitUntilUnique(key, members)) {
      list.sort((a, b) => finishOrder(a) - finishOrder(b));
      const first = list[0]!;
      prints.push({ key: subKey, cardId: first.cardId, setId: first.setId, skus: list });
    }
  }
  return prints;
}

function splitUntilUnique(key: string, members: Sku[]): Array<[string, Sku[]]> {
  if (!hasDuplicateFinish(members)) return [[key, members]];

  const byDetail = new Map<string, Sku[]>();
  for (const s of members) {
    const detail = `${[...s.channels].sort().join('+')}~${s.comment ?? ''}`;
    const list = byDetail.get(detail);
    if (list) list.push(s);
    else byDetail.set(detail, [s]);
  }

  const result: Array<[string, Sku[]]> = [];
  let n = 0;
  for (const list of byDetail.values()) {
    if (!hasDuplicateFinish(list)) {
      result.push([`${key}#${++n}`, list]);
      continue;
    }
    // Letzter Ausweg: jedes Exemplar wird ein eigener Druck.
    for (const s of list) result.push([`${key}#${++n}`, [s]]);
  }
  return result;
}

/**
 * Ab so vielen Karten derselben Fassung warnt der Scanner. Gezählt wird je Druck:
 * Normal und Foil zusammen, Promo- und Alt-Art-Fassungen jeweils für sich.
 */
export const COPY_LIMIT = 4;

export interface CopyCount {
  /** In der Sammlung, über alle Finishes des Drucks. */
  collection: number;
  /** In der laufenden Scan-Sitzung, noch nicht übernommen. */
  session: number;
}

/** Wie viele Karten eines Drucks vorhanden sind. Beide Maps: Sku-Id → Menge. */
export function copyCount(print: Print, stock: Map<string, number>, session: Map<string, number>): CopyCount {
  let collection = 0;
  let inSession = 0;
  for (const sku of print.skus) {
    collection += stock.get(sku.id) ?? 0;
    inSession += session.get(sku.id) ?? 0;
  }
  return { collection, session: inSession };
}

export const copyTotal = (c: CopyCount): number => c.collection + c.session;
