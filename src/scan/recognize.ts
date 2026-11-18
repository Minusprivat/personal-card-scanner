import { findCandidates, warp, type Corners, type Detection, type OpenCv } from './detect';
import type { CardRegion } from './fingerprint';
import { matchCard, matchSleeved, type FingerprintSet, type Match } from './matcher';
import { projector } from './number';

export interface Recognition {
  detection: Detection;
  /** Ähnlichste Katalogbilder, ähnlichstes zuerst. */
  matches: Match[];
  /** true, wenn die Karte im Bild kopfstand. */
  flipped: boolean;
}

/** Ab diesem Abstand gilt der beste mittige Treffer als unsicher; dann folgt die Suche für Hüllen. */
const SLEEVE_SEARCH_FROM = 24;
/** So viele Umrisse (die mit dem besten mittigen Treffer) durchlaufen die Suche für Hüllen. */
const SLEEVE_CANDIDATES = 3;

/**
 * Ein Kamerabild (cv.Mat, RGBA) → Karte finden, entzerren, mit dem Katalog abgleichen.
 *
 * Die Umrisssuche liefert mehrere mögliche Vierecke. Es gilt das, dessen Inhalt einem
 * Katalogbild am ähnlichsten ist: Ein falscher Umriss (Tischkante, nur das Motiv)
 * ergibt einen schlechten Abgleich und fällt so von selbst heraus.
 *
 * Steckt die Karte in einer Hülle, trifft der Umriss die Hülle, und die Karte sitzt darin
 * verschoben. Passt kein Umriss gut, werden die besten deshalb noch einmal mit
 * verschobenem Ausschnitt geprüft (`matchSleeved`).
 */
export function recognize(cv: OpenCv, frame: OpenCv, fingerprints: FingerprintSet, k = 3): Recognition | null {
  const found: Recognition[] = [];
  for (const candidate of findCandidates(cv, frame)) {
    const card = warp(cv, frame, candidate.corners);
    const { matches, flipped } = matchCard(fingerprints, card, k);
    if (matches.length) found.push({ detection: { ...candidate, card }, matches, flipped });
  }
  if (found.length === 0) return null;
  found.sort((a, b) => a.matches[0]!.distance - b.matches[0]!.distance);
  let best = found[0]!;
  if (best.matches[0]!.distance <= SLEEVE_SEARCH_FROM) return best;

  for (const recognition of found.slice(0, SLEEVE_CANDIDATES)) {
    const sleeved = matchSleeved(fingerprints, recognition.detection.card, k, recognition);
    if (!sleeved.card || sleeved.matches[0]!.distance >= best.matches[0]!.distance) continue;
    // Der Umriss war die Hülle. Ab hier gelten die Ecken der Karte darin: Daran hängen die
    // Lage der Nummernzeile und der eingezeichnete Rahmen.
    const corners = cardCorners(recognition.detection.corners, sleeved.card);
    best = {
      detection: { ...recognition.detection, corners, card: warp(cv, frame, corners) },
      matches: sleeved.matches,
      flipped: sleeved.flipped,
    };
  }
  return best;
}

/** Ecken des Felds `card` (Anteile des Umrisses) im Ausgangsbild, in der Reihenfolge des Umrisses. */
export function cardCorners(outline: Corners, card: CardRegion): Corners {
  const project = projector(outline);
  return [project(card.x0, card.y0), project(card.x1, card.y0), project(card.x1, card.y1), project(card.x0, card.y1)];
}
