import { findCandidates, warp, type Detection, type OpenCv } from './detect';
import { matchCard, type FingerprintSet, type Match } from './matcher';

export interface Recognition {
  detection: Detection;
  /** Ähnlichste Katalogbilder, ähnlichstes zuerst. */
  matches: Match[];
  /** true, wenn die Karte im Bild kopfstand. */
  flipped: boolean;
}

/**
 * Ein Kamerabild (cv.Mat, RGBA) → Karte finden, entzerren, mit dem Katalog abgleichen.
 *
 * Die Umrisssuche liefert mehrere mögliche Vierecke. Es gilt das, dessen Inhalt einem
 * Katalogbild am ähnlichsten ist: Ein falscher Umriss (Tischkante, nur das Motiv)
 * ergibt einen schlechten Abgleich und fällt so von selbst heraus.
 */
export function recognize(cv: OpenCv, frame: OpenCv, fingerprints: FingerprintSet, k = 3): Recognition | null {
  let best: Recognition | null = null;
  for (const candidate of findCandidates(cv, frame)) {
    const card = warp(cv, frame, candidate.corners);
    const { matches, flipped } = matchCard(fingerprints, card, k);
    if (matches.length && (!best || matches[0]!.distance < best.matches[0]!.distance)) {
      best = { detection: { ...candidate, card }, matches, flipped };
    }
  }
  return best;
}
