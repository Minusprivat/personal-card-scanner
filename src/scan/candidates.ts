import type { CatalogIndex } from '../data/catalog-index';
import type { Print, Sku } from '../data/model';
import type { Match } from './matcher';

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
  };
}

/** Finish, das beim Scannen vorbelegt wird: das einzige vorhandene, sonst Normal. */
export function defaultSku(print: Print): Sku {
  return print.skus.find((s) => s.finish === 'normal') ?? print.skus[0]!;
}
