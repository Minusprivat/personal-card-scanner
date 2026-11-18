import {
  distance,
  FP_BYTES,
  FP_VERSION,
  fromHex,
  queryFingerprints,
  sleeveFingerprints,
  type CardRegion,
  type Pixels,
  type QueryFingerprint,
} from './fingerprint';

/** Tagesdatei `data/fingerprints.json`: Bild-Id → Fingerabdruck als Hex-Text. */
export interface FingerprintFile {
  version: number;
  items: Record<string, string>;
}

/** Alle Fingerabdrücke hintereinander in einem Speicherblock, für die schnelle Suche. */
export interface FingerprintSet {
  imageIds: string[];
  hashes: Uint8Array;
}

export function loadFingerprints(file: FingerprintFile): FingerprintSet {
  if (file.version !== FP_VERSION) {
    throw new Error(`Fingerabdrücke haben Version ${file.version}, die App erwartet ${FP_VERSION}.`);
  }
  const imageIds = Object.keys(file.items);
  const hashes = new Uint8Array(imageIds.length * FP_BYTES);
  imageIds.forEach((id, i) => fromHex(file.items[id]!, hashes, i * FP_BYTES));
  return { imageIds, hashes };
}

export interface Match {
  imageId: string;
  /** Unterschiedliche Bits, 0 bis 128. Kleiner ist ähnlicher. */
  distance: number;
}

/** Die k ähnlichsten Bilder zu einem Fingerabdruck, ähnlichstes zuerst. */
export function nearest(set: FingerprintSet, query: Uint8Array, k = 3): Match[] {
  const best: Match[] = [];
  for (let i = 0; i < set.imageIds.length; i++) {
    const d = distance(set.hashes, i * FP_BYTES, query, 0, best.length === k ? best[k - 1]!.distance : FP_BYTES * 8 + 1);
    if (best.length === k && d >= best[k - 1]!.distance) continue;
    let at = best.length;
    while (at > 0 && best[at - 1]!.distance > d) at--;
    best.splice(at, 0, { imageId: set.imageIds[i]!, distance: d });
    if (best.length > k) best.pop();
  }
  return best;
}

export interface CardMatch {
  matches: Match[];
  /** true, wenn die Karte im Bild kopfstand. */
  flipped: boolean;
  /** Lage der Karte im Umriss, wenn ein verschobener Ausschnitt am besten passte (Karte in Hülle). */
  card?: CardRegion;
}

/**
 * Sucht die ähnlichsten Katalogbilder zu einem entzerrten Kartenbild. Geprüft werden
 * beide Lagen und mehrere Ausschnitte; es gilt die Fassung mit dem besten Treffer.
 */
export function matchCard(set: FingerprintSet, px: Pixels, k = 3): CardMatch {
  return bestOf(set, queryFingerprints(px), k, { matches: [], flipped: false });
}

/**
 * Wie `matchCard`, aber für Karten in Hüllen: prüft zusätzlich Ausschnitte, die an Kanten
 * und Ecken des Umrisses anliegen. `start` ist das Ergebnis von `matchCard`; es bleibt,
 * wenn kein verschobener Ausschnitt besser passt.
 */
export function matchSleeved(set: FingerprintSet, px: Pixels, k: number, start: CardMatch): CardMatch {
  return bestOf(set, sleeveFingerprints(px), k, start);
}

function bestOf(set: FingerprintSet, queries: QueryFingerprint[], k: number, start: CardMatch): CardMatch {
  let best = start;
  for (const query of queries) {
    const matches = nearest(set, query.fp, k);
    if (matches.length && (best.matches.length === 0 || matches[0]!.distance < best.matches[0]!.distance)) {
      best = { matches, flipped: query.flipped, card: query.card };
    }
  }
  return best;
}
