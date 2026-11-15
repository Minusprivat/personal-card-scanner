import type { Corners } from './detect';
import type { FingerprintFile, Match } from './matcher';

/** Nachrichten zwischen Oberfläche und Erkennungs-Worker. */
export type ToWorker =
  | { type: 'init'; fingerprints: FingerprintFile }
  | { type: 'frame'; id: number; width: number; height: number; data: ArrayBuffer }
  /** Nummernzeile aus einem Bildausschnitt gerade ziehen; `quad` sind 8 Zahlen (x, y je Ecke) im Ausschnitt. */
  | { type: 'strip'; id: number; width: number; height: number; data: ArrayBuffer; quad: number[]; outWidth: number };

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

/** Aufbereitete Nummernzeile, bereit für die Texterkennung. */
export interface StripResult {
  type: 'strip';
  id: number;
  width: number;
  height: number;
  data: ArrayBuffer;
}

export type FromWorker = { type: 'ready' } | { type: 'error'; message: string } | FrameResult | StripResult;

/** So viele Kandidaten liefert der Worker je Bild. */
export const MATCHES_PER_FRAME = 6;
