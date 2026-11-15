import type { CatalogIndex } from '../data/catalog-index';
import type { Print, Sku } from '../data/model';
import type { Match } from './matcher';
import { pickByNumber } from './number';

/** Ein Abgleich-Ergebnis, übersetzt in Drucke aus dem Katalog. */
export interface ScanHit {
  /** Karte + Art-Variante; Drucke mit gleichem Motiv sehen (fast) gleich aus. */
  motif: string;
  cardId: string;
  /** Abstand des besten Treffers, 0 bis 128. */
  distance: number;
  /** Vorsprung vor dem besten Treffer eines anderen Motivs. */
  margin: number;
  /** Mögliche Drucke, wahrscheinlichster zuerst. */
  prints: Print[];
  /** Drucke der nächstbesten anderen Motive; die Kartennummer kann auch für einen von ihnen sprechen. */
  others: Print[];
}

/** Bilder, die höchstens so viele Bits schlechter passen als das beste, gelten als gleich gut. */
const SAME_LOOK = 6;
const MAX_PRINTS = 8;

const motifOf = (print: Print) => `${print.cardId}|${print.skus[0]!.artVariant}`;

/** Ein gewöhnlicher Druck ohne Stempel und Signatur ist häufiger als seine Sonderfassungen. */
const isPlain = (print: Print) => {
  const s = print.skus[0]!;
  return s.markers.length === 0 && !s.isSigned && s.size === 'standard';
};

export function interpretMatches(matches: Match[], index: CatalogIndex): ScanHit | null {
  const ranked = matches
    .map((m) => ({ match: m, prints: index.printsByImageId.get(m.imageId) ?? [] }))
    .filter((r) => r.prints.length > 0);
  const best = ranked[0];
  if (!best) return null;

  const motif = motifOf(best.prints[0]!);
  const other = ranked.find((r) => motifOf(r.prints[0]!) !== motif);
  const distance = best.match.distance;

  // Erst die Drucke, deren Bild praktisch gleich gut passt (gewöhnliche zuerst), dann die
  // übrigen Drucke derselben Karte: gleiche Art-Variante vor anderen.
  const lookAlike = ranked
    .filter((r) => motifOf(r.prints[0]!) === motif && r.match.distance <= distance + SAME_LOOK)
    .flatMap((r) => r.prints);
  const sameCard = index.printsByCardId.get(best.prints[0]!.cardId) ?? [];
  const ordered = [
    ...lookAlike.filter(isPlain),
    ...lookAlike.filter((p) => !isPlain(p)),
    ...sameCard.filter((p) => motifOf(p) === motif),
    ...sameCard,
  ];

  return {
    motif,
    cardId: best.prints[0]!.cardId,
    distance,
    margin: (other ? other.match.distance : 128) - distance,
    prints: [...new Set(ordered)].slice(0, MAX_PRINTS),
    others: [...new Set(ranked.flatMap((r) => r.prints).filter((p) => motifOf(p) !== motif))],
  };
}

/** true für Karten im Querformat; ihre Nummernzeile liegt an der langen Kante. */
export const isLandscape = (print: Print, index: CatalogIndex): boolean =>
  index.cardById.get(print.cardId)?.types.includes('battlefield') ?? false;

/**
 * Braucht dieser Treffer die Kartennummer? Ja, wenn Drucke mit unterschiedlicher Nummer
 * zur Wahl stehen: gleich aussehende Drucke derselben Karte oder ähnliche andere Karten.
 */
export function numberCanHelp(hit: ScanHit, anyCard: boolean): boolean {
  const codes = new Set(numberCandidates(hit, anyCard).map((p) => p.skus[0]!.publicCode));
  return codes.size > 1;
}

/**
 * Drucke, zwischen denen die Nummer entscheiden darf. Ist der Bildabgleich sicher
 * (`anyCard` false), nur Drucke mit demselben Motiv: Ein Lesefehler soll einen sicheren
 * Treffer nicht auf eine andere Karte oder eine anders aussehende Fassung umbiegen.
 */
const numberCandidates = (hit: ScanHit, anyCard: boolean): Print[] => {
  const sameMotif = hit.prints.filter((p) => motifOf(p) === hit.motif);
  return anyCard ? [...sameMotif, ...hit.others] : sameMotif;
};

/**
 * Lesefehler, die bei der Zuordnung noch durchgehen. Zwischen gleich aussehenden Drucken
 * einer Karte reichen zwei; ihre Nummern liegen weit auseinander. Soll die Nummer dagegen
 * einen unsicheren Bildtreffer bestätigen oder auf eine andere Karte zeigen, muss sie
 * fehlerfrei gelesen sein: Nachbarkarten im Set unterscheiden sich oft nur in einer Ziffer.
 */
const allowedErrors = (anyCard: boolean) => (anyCard ? 0 : 2);

/**
 * Ordnet den gelesenen Text einem der möglichen Drucke zu und stellt ihn an die erste Stelle.
 * Passt die Nummer zu einer Karte eines anderen Motivs, wird der Treffer auf diese Karte umgestellt.
 * Gibt null zurück, wenn der Text zu keinem Kandidaten eindeutig passt.
 */
export function applyNumber(hit: ScanHit, text: string, index: CatalogIndex, anyCard: boolean): ScanHit | null {
  const candidates = numberCandidates(hit, anyCard).map((p) => ({
    item: p,
    code: p.skus[0]!.publicCode || p.skus[0]!.shortCode,
  }));
  const picked = pickByNumber(text, candidates, allowedErrors(anyCard));
  if (!picked) return null;

  // Mehrere Drucke können dieselbe Nummer tragen (mit und ohne Stempel): der gewöhnliche zuerst.
  const code = picked.skus[0]!.publicCode;
  const sameNumber = candidates.map((c) => c.item).filter((p) => p.skus[0]!.publicCode === code);
  const first = sameNumber.find(isPlain) ?? picked;
  const sameCard = index.printsByCardId.get(first.cardId) ?? [];
  const motif = motifOf(first);
  const prints = [
    ...new Set([
      first,
      ...sameNumber,
      ...hit.prints.filter((p) => p.cardId === first.cardId),
      ...sameCard.filter((p) => motifOf(p) === motif),
      ...sameCard,
    ]),
  ];
  return { ...hit, motif, cardId: first.cardId, prints: prints.slice(0, MAX_PRINTS) };
}

/** Finish, das beim Scannen vorbelegt wird: das einzige vorhandene, sonst Normal. */
export function defaultSku(print: Print): Sku {
  return print.skus.find((s) => s.finish === 'normal') ?? print.skus[0]!;
}
