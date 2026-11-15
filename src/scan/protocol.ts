import type { Corners } from './detect';
import type { FingerprintFile, Match } from './matcher';

/** Nachrichten zwischen Oberfläche und Erkennungs-Worker. */
export type ToWorker =
  | { type: 'init'; fingerprints: FingerprintFile }
  | { type: 'frame'; id: number; width: number; height: number; data: ArrayBuffer };

export interface FrameResult {
  type: 'result';
  id: number;
  /** Rechenzeit für dieses Bild in Millisekunden. */
  ms: number;
  /** Ecken der Karte im übergebenen Bild; null, wenn keine Karte gefunden wurde. */
  corners: Corners | null;
  /** Ähnlichste Katalogbilder, ähnlichstes zuerst. Leer ohne Karte. */
  matches: Match[];
  flipped: boolean;
}

export type FromWorker = { type: 'ready' } | { type: 'error'; message: string } | FrameResult;

/** So viele Kandidaten liefert der Worker je Bild. */
export const MATCHES_PER_FRAME = 6;
