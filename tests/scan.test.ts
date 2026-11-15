import { describe, expect, it } from 'vitest';
import { orderCorners, quadFromPolygon, type Point } from '../src/scan/detect';
import {
  distance,
  fingerprint,
  FP_BYTES,
  FP_VERSION,
  fromHex,
  queryFingerprints,
  toHex,
  type Pixels,
} from '../src/scan/fingerprint';
import { loadFingerprints, matchCard, nearest } from '../src/scan/matcher';

/** Erzeugt ein Testbild aus einer Formel für die Helligkeit an der Stelle (u, v) in 0..1. */
function image(width: number, height: number, lum: (u: number, v: number) => number): Pixels {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(255, lum((x + 0.5) / width, (y + 0.5) / height)));
      data.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  return { data, width, height, channels: 3 };
}

// Drei deutlich verschiedene „Motive“. Das erste mischt mehrere Wellen, wie ein echtes Bild
// mit groben und feinen Strukturen.
const blobs = (u: number, v: number) =>
  128 +
  55 * Math.sin(u * 7 + 1) * Math.cos(v * 5) +
  25 * Math.sin(v * 23 + u * 3) +
  18 * Math.cos(u * 17 - v * 11) +
  12 * Math.sin(u * 31 + 2) * Math.sin(v * 29) +
  9 * Math.cos((u * u + v) * 40);
const stripes = (u: number, v: number) => 128 + 110 * Math.sin((u + v) * 13);
const rings = (u: number, v: number) => 128 + 110 * Math.cos(Math.hypot(u - 0.4, v - 0.3) * 30);

const card = (lum: (u: number, v: number) => number, w = 240, h = 336) => image(w, h, lum);
const dist = (a: Uint8Array, b: Uint8Array) => distance(a, 0, b, 0);

describe('Fingerabdruck', () => {
  const base = fingerprint(card(blobs));

  it('ist 16 Byte lang und für dasselbe Bild immer gleich', () => {
    expect(base).toHaveLength(FP_BYTES);
    expect(dist(base, fingerprint(card(blobs)))).toBe(0);
  });

  it('bleibt bei anderer Helligkeit, anderem Kontrast und anderer Bildgröße fast gleich', () => {
    expect(dist(base, fingerprint(card((u, v) => blobs(u, v) * 0.6)))).toBeLessThanOrEqual(8);
    expect(dist(base, fingerprint(card((u, v) => 70 + blobs(u, v) * 0.5)))).toBeLessThanOrEqual(8);
    expect(dist(base, fingerprint(card(blobs, 120, 168)))).toBeLessThanOrEqual(8);
    expect(dist(base, fingerprint(card(blobs, 480, 672)))).toBeLessThanOrEqual(8);
  });

  it('unterscheidet verschiedene Motive deutlich', () => {
    expect(dist(base, fingerprint(card(stripes)))).toBeGreaterThan(35);
    expect(dist(base, fingerprint(card(rings)))).toBeGreaterThan(35);
  });

  it('stellt liegende Bilder hochkant, damit Battlefields wie alle Karten verglichen werden', () => {
    // Liegendes Bild: Inhalt des Hochkant-Bilds um 90° gegen den Uhrzeigersinn gedreht.
    const landscape = image(336, 240, (u, v) => blobs(1 - v, u));
    expect(dist(base, fingerprint(landscape))).toBeLessThanOrEqual(6);
  });

  it('liefert für das Kamerabild beide Lagen; die gedrehte passt zur kopfstehenden Karte', () => {
    const upsideDown = card((u, v) => blobs(1 - u, 1 - v));
    const queries = queryFingerprints(upsideDown);
    const at = (flipped: boolean) => queries.find((q) => q.flipped === flipped && q.zoom === 1)!.fp;
    expect(dist(at(true), base)).toBeLessThanOrEqual(2);
    expect(dist(at(false), base)).toBeGreaterThan(20);
  });

  it('findet die Karte auch, wenn sie den Ausschnitt nicht ganz füllt (Umriss zu groß)', () => {
    // Die Karte belegt nur die inneren 92 % des Bilds, außen ist grauer Rand.
    const inset = card((u, v) => {
      const cu = 0.5 + (u - 0.5) / 0.92;
      const cv = 0.5 + (v - 0.5) / 0.92;
      return cu < 0 || cu > 1 || cv < 0 || cv > 1 ? 120 : blobs(cu, cv);
    });
    const exact = dist(fingerprint(inset), base);
    const bestQuery = Math.min(...queryFingerprints(inset).map((q) => dist(q.fp, base)));
    expect(bestQuery).toBeLessThanOrEqual(6);
    expect(bestQuery).toBeLessThan(exact);
  });

  it('lässt sich als Hex-Text speichern und wieder lesen', () => {
    const hex = toHex(base);
    expect(hex).toMatch(/^[0-9a-f]{32}$/);
    const back = new Uint8Array(FP_BYTES);
    fromHex(hex, back, 0);
    expect(back).toEqual(base);
  });
});

describe('Abgleich', () => {
  const set = loadFingerprints({
    version: FP_VERSION,
    items: {
      blobs: toHex(fingerprint(card(blobs))),
      stripes: toHex(fingerprint(card(stripes))),
      rings: toHex(fingerprint(card(rings))),
    },
  });

  it('findet das ähnlichste Bild und sortiert die Kandidaten nach Abstand', () => {
    const matches = nearest(set, fingerprint(card((u, v) => stripes(u, v) * 0.7)), 3);
    expect(matches.map((m) => m.imageId)[0]).toBe('stripes');
    expect(matches).toHaveLength(3);
    expect(matches[0]!.distance).toBeLessThanOrEqual(matches[1]!.distance);
    expect(matches[1]!.distance).toBeLessThanOrEqual(matches[2]!.distance);
  });

  it('gibt höchstens k Kandidaten zurück', () => {
    expect(nearest(set, fingerprint(card(rings)), 2)).toHaveLength(2);
  });

  it('erkennt eine kopfstehende Karte und meldet die Lage', () => {
    const result = matchCard(set, card((u, v) => rings(1 - u, 1 - v)));
    expect(result.matches[0]!.imageId).toBe('rings');
    expect(result.flipped).toBe(true);
    expect(matchCard(set, card(rings)).flipped).toBe(false);
  });

  it('lehnt Fingerabdrücke eines anderen Verfahrens ab', () => {
    expect(() => loadFingerprints({ version: FP_VERSION + 1, items: {} })).toThrow(/Version/);
  });
});

describe('Ecken der Karte ordnen', () => {
  const portrait: Point[] = [
    { x: 100, y: 50 },
    { x: 163, y: 50 },
    { x: 163, y: 138 },
    { x: 100, y: 138 },
  ];
  const edge = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  it('beginnt unabhängig von der Eingabereihenfolge mit einer kurzen Kante', () => {
    for (const order of [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0]]) {
      const c = orderCorners(order.map((i) => portrait[i]!))!;
      expect(edge(c[0], c[1])).toBeCloseTo(63);
      expect(edge(c[1], c[2])).toBeCloseTo(88);
    }
  });

  it('läuft im Uhrzeigersinn um die Karte', () => {
    const c = orderCorners(portrait)!;
    const area = c.reduce((sum, p, i) => {
      const q = c[(i + 1) % 4]!;
      return sum + (p.x * q.y - q.x * p.y);
    }, 0);
    // In Bildkoordinaten (y nach unten) ist die Fläche bei Uhrzeigersinn positiv.
    expect(area).toBeGreaterThan(0);
  });

  it('stellt eine liegende Karte hochkant', () => {
    const landscape = portrait.map((p) => ({ x: p.y, y: p.x }));
    const c = orderCorners(landscape)!;
    expect(edge(c[0], c[1])).toBeCloseTo(63);
  });

  it('verwirft Vierecke, die nicht wie eine Karte aussehen', () => {
    const square = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }, { x: 0, y: 80 }];
    const strip = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 88 }, { x: 0, y: 88 }];
    expect(orderCorners(square)).toBeNull();
    expect(orderCorners(strip)).toBeNull();
    expect(orderCorners(portrait.slice(0, 3))).toBeNull();
  });
});

describe('Ecken aus einem Umriss mit abgerundeten Ecken', () => {
  it('verlängert die vier langen Kanten bis zu ihren Schnittpunkten', () => {
    // Rechteck 63 × 88 mit abgeschrägten Ecken (je 4 Einheiten).
    const octagon: Point[] = [
      { x: 4, y: 0 }, { x: 59, y: 0 }, { x: 63, y: 4 }, { x: 63, y: 84 },
      { x: 59, y: 88 }, { x: 4, y: 88 }, { x: 0, y: 84 }, { x: 0, y: 4 },
    ];
    const quad = quadFromPolygon(octagon)!;
    const sorted = quad.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).sort();
    expect(sorted).toEqual(['0,0', '0,88', '63,0', '63,88']);
  });

  it('lässt ein echtes Viereck unverändert und lehnt Dreiecke ab', () => {
    const quad: Point[] = [{ x: 0, y: 0 }, { x: 63, y: 0 }, { x: 63, y: 88 }, { x: 0, y: 88 }];
    expect(quadFromPolygon(quad)).toEqual(quad);
    expect(quadFromPolygon(quad.slice(0, 3))).toBeNull();
  });
});
