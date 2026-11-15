import type { Corners, Point } from './detect';

/**
 * Kartennummer lesen: Wo die Nummernzeile auf der Karte steht, wie der Ausschnitt für
 * die Texterkennung aufbereitet wird und wie der gelesene Text einem Druck zugeordnet wird.
 *
 * Aufgedruckt ist die Nummer unten links, zum Beispiel „OGN • 121/298“, bei Promos mit
 * angehängtem „• P“. Bei Battlefields (Querformat) steht sie an der langen Kante.
 */

/** Höhe des entzerrten Streifens für die Texterkennung. */
export const STRIP_H = 64;

/** Punkt auf der entzerrten Karte, beide Achsen von 0 bis 1. */
interface CardPoint {
  u: number;
  v: number;
}

export interface NumberStrip {
  /** Ecken der Nummernzeile im Ausgangsbild in Leserichtung: oben links, oben rechts, unten rechts, unten links. */
  quad: [Point, Point, Point, Point];
  /** Breite des entzerrten Streifens; die Höhe ist STRIP_H. */
  width: number;
}

/** Nummernzeile einer Hochkant-Karte, in Leserichtung. */
const PORTRAIT: CardPoint[] = [
  { u: 0.03, v: 0.945 },
  { u: 0.45, v: 0.945 },
  { u: 0.45, v: 0.99 },
  { u: 0.03, v: 0.99 },
];

/**
 * Nummernzeile eines Battlefields. Katalogbilder im Querformat werden für den Abgleich
 * um 90° im Uhrzeigersinn gedreht; die Zeile läuft danach von oben nach unten.
 */
const LANDSCAPE: CardPoint[] = [
  { u: 0.09, v: 0.03 },
  { u: 0.09, v: 0.42 },
  { u: 0.025, v: 0.42 },
  { u: 0.025, v: 0.03 },
];

/** Seitenverhältnis der Zeile (Breite : Höhe) in Millimetern auf der Karte. */
const PORTRAIT_RATIO = ((0.45 - 0.03) * 63) / ((0.99 - 0.945) * 88);
const LANDSCAPE_RATIO = ((0.42 - 0.03) * 88) / ((0.09 - 0.025) * 63);

/**
 * Abbildung von der entzerrten Karte ins Ausgangsbild. `corners` sind die Ecken der
 * Karte im Bild in der Reihenfolge der Entzerrung: (0,0), (1,0), (1,1), (0,1).
 */
export function projector(corners: Corners): (u: number, v: number) => Point {
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + p0.x) / w, y: (d * u + e * v + p0.y) / w };
  };
}

/**
 * Lage der Nummernzeile im Ausgangsbild.
 *
 * @param corners   Ecken der gefundenen Karte, wie von der Umrisssuche geliefert
 * @param flipped   true, wenn die Karte im Bild kopfsteht (meldet der Abgleich)
 * @param landscape true für Karten im Querformat (Battlefields)
 */
export function numberStrip(corners: Corners, flipped: boolean, landscape: boolean): NumberStrip {
  const project = projector(corners);
  const points = (landscape ? LANDSCAPE : PORTRAIT).map(({ u, v }) =>
    flipped ? project(1 - u, 1 - v) : project(u, v),
  ) as [Point, Point, Point, Point];
  return { quad: points, width: Math.round(STRIP_H * (landscape ? LANDSCAPE_RATIO : PORTRAIT_RATIO)) };
}

/**
 * Macht aus dem farbigen Streifen ein Bild mit dunkler Schrift auf hellem Grund.
 *
 * Die Schrift ist weiß. Statt der Helligkeit zählt deshalb der kleinste Farbkanal:
 * Er ist nur bei Weiß hoch, bei buntem Hintergrund (rosa, türkis, gold) dagegen niedrig.
 * Gibt RGBA-Pixel in Graustufen zurück.
 */
export function prepareStrip(rgba: ArrayLike<number>, width: number, height: number): Uint8ClampedArray {
  const n = width * height;
  const white = new Uint8Array(n);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const v = Math.min(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!);
    white[i] = v;
    histogram[v]!++;
  }
  const percentile = (q: number) => {
    let sum = 0;
    for (let v = 0; v < 256; v++) {
      sum += histogram[v]!;
      if (sum >= q * n) return v;
    }
    return 255;
  };
  const low = percentile(0.005);
  const high = Math.max(low + 1, percentile(0.995));

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const t = Math.max(0, Math.min(1, (white[i]! - low) / (high - low)));
    // Quadrieren drückt den Hintergrund weiter weg von der Schrift.
    const v = 255 - Math.round(255 * t * t);
    out[p] = v;
    out[p + 1] = v;
    out[p + 2] = v;
    out[p + 3] = 255;
  }
  return out;
}

/** Zeichen, die die Texterkennung für die Nummernzeile kennen darf. */
export const NUMBER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/*ab ';

/**
 * Vereinheitlicht eine Nummer zum Vergleichen: nur Großbuchstaben, Ziffern und „/“;
 * Zeichen, die die Texterkennung ständig verwechselt, fallen zusammen (O, Q, D → 0; I, L → 1).
 *
 * Das Sternchen fällt weg: Die Texterkennung liest den Trennpunkt „•“ oft als „*“, das echte
 * Sternchen signierter Karten dagegen nie. Signierte und unsignierte Fassungen haben damit
 * dieselbe Vergleichsnummer und lassen sich über die Nummer nicht trennen.
 */
export const normalizeCode = (text: string): string =>
  text
    .toUpperCase()
    .replace(/[^A-Z0-9/]/g, '')
    .replace(/[OQD]/g, '0')
    .replace(/[IL]/g, '1');

/**
 * Kleinste Zahl an Einzelfehlern (falsches, fehlendes oder überzähliges Zeichen), mit der
 * `pattern` irgendwo in `text` vorkommt. Zeichen vor und nach der Fundstelle kosten nichts;
 * die Texterkennung liest am Rand oft Stücke des Rahmens mit.
 */
export function substringDistance(pattern: string, text: string): number {
  let previous = new Array<number>(text.length + 1).fill(0);
  for (let i = 1; i <= pattern.length; i++) {
    const current = [i];
    for (let j = 1; j <= text.length; j++) {
      current[j] = Math.min(
        previous[j - 1]! + (pattern[i - 1] === text[j - 1] ? 0 : 1),
        previous[j]! + 1,
        current[j - 1]! + 1,
      );
    }
    previous = current;
  }
  return Math.min(...previous);
}

/**
 * Wählt unter den Kandidaten den, dessen Nummer zum gelesenen Text passt.
 * Gibt null zurück, wenn nichts passt oder zwei verschiedene Nummern gleich gut passen.
 * Kandidaten mit derselben Nummer gelten als ein Treffer; zurück kommt der erste davon.
 *
 * @param maxErrors So viele Einzelfehler darf der Text gegenüber der Nummer haben. Nummern
 *   desselben Sets unterscheiden sich oft nur in einer Ziffer; großzügig darf man deshalb
 *   nur sein, wenn die Kandidaten ohnehin dieselbe Karte sind.
 */
export function pickByNumber<T>(text: string, candidates: Array<{ item: T; code: string }>, maxErrors = 2): T | null {
  const read = normalizeCode(text);
  if (read.length < 4) return null;

  let best: { item: T; code: string; errors: number } | null = null;
  let tie = false;
  for (const c of candidates) {
    const code = normalizeCode(c.code);
    if (!code) continue;
    const errors = substringDistance(code, read);
    // Bei gleich vielen Fehlern gewinnt die längere Nummer: „UNL086/219“ steckt fehlerfrei
    // auch in „UNL086/219P“; nur die längere erklärt den ganzen gelesenen Text.
    const better = !best || errors < best.errors || (errors === best.errors && code.length > best.code.length);
    if (better) {
      best = { item: c.item, code, errors };
      tie = false;
    } else if (errors === best!.errors && code.length === best!.code.length && code !== best!.code) {
      tie = true;
    }
  }
  if (!best || tie || best.errors > maxErrors) return null;
  return best.item;
}
