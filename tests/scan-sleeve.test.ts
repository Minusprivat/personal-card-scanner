import { describe, expect, it } from 'vitest';
import type { Corners } from '../src/scan/detect';
import {
  distance,
  fingerprint,
  FP_BYTES,
  FP_VERSION,
  SLEEVE_ZOOMS,
  sleeveFingerprints,
  toHex,
  type CardRegion,
  type Pixels,
} from '../src/scan/fingerprint';
import { loadFingerprints, matchCard, matchSleeved, nearest } from '../src/scan/matcher';
import { cardCorners } from '../src/scan/recognize';

/**
 * Karte in einer Hülle: Der Umriss trifft die Hülle, die Karte sitzt darin verschoben.
 * Die Testbilder sind Formeln, keine Kartenbilder.
 */

const W = 252;
const H = 352;

function image(lum: (u: number, v: number) => number): Pixels {
  const data = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.max(0, Math.min(255, lum((x + 0.5) / W, (y + 0.5) / H)));
      data.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
  }
  return { data, width: W, height: H, channels: 3 };
}

const blobs = (u: number, v: number) =>
  128 +
  55 * Math.sin(u * 7 + 1) * Math.cos(v * 5) +
  25 * Math.sin(v * 23 + u * 3) +
  18 * Math.cos(u * 17 - v * 11) +
  12 * Math.sin(u * 31 + 2) * Math.sin(v * 29) +
  9 * Math.cos((u * u + v) * 40);
const stripes = (u: number, v: number) => 128 + 110 * Math.sin((u + v) * 13);
const rings = (u: number, v: number) => 128 + 110 * Math.cos(Math.hypot(u - 0.4, v - 0.3) * 30);

/** Bild einer Hülle: Die Karte füllt das Feld `at`, der Rest ist der glatte Rand der Hülle. */
function sleeved(lum: (u: number, v: number) => number, at: CardRegion, upsideDown = false): Pixels {
  return image((u, v) => {
    if (u < at.x0 || u > at.x1 || v < at.y0 || v > at.y1) return 60;
    const cu = (u - at.x0) / (at.x1 - at.x0);
    const cv = (v - at.y0) / (at.y1 - at.y0);
    return upsideDown ? lum(1 - cu, 1 - cv) : lum(cu, cv);
  });
}

const catalog = loadFingerprints({
  version: FP_VERSION,
  items: {
    blobs: toHex(fingerprint(image(blobs))),
    stripes: toHex(fingerprint(image(stripes))),
    rings: toHex(fingerprint(image(rings))),
  },
});

/** Karte füllt 92 % der Hülle und liegt unten rechts an. */
const BOTTOM_RIGHT: CardRegion = { x0: 0.08, x1: 1, y0: 0.08, y1: 1 };
/** Karte füllt 88 % der Hülle und liegt oben mittig an. */
const TOP_CENTER: CardRegion = { x0: 0.06, x1: 0.94, y0: 0, y1: 0.88 };

const near = (a: CardRegion, b: CardRegion) =>
  Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1));

describe('Karte in einer Hülle', () => {
  it('passt mittig schlecht, mit verschobenem Ausschnitt gut', () => {
    const photo = sleeved(blobs, BOTTOM_RIGHT);
    const centered = matchCard(catalog, photo, 3);
    const found = matchSleeved(catalog, photo, 3, centered);
    expect(found.matches[0]!.imageId).toBe('blobs');
    expect(found.matches[0]!.distance).toBeLessThanOrEqual(8);
    expect(found.matches[0]!.distance).toBeLessThan(centered.matches[0]!.distance);
  });

  it('meldet, wo die Karte in der Hülle liegt', () => {
    for (const at of [BOTTOM_RIGHT, TOP_CENTER]) {
      const photo = sleeved(blobs, at);
      const found = matchSleeved(catalog, photo, 3, matchCard(catalog, photo, 3));
      expect(found.card).toBeDefined();
      expect(near(found.card!, at)).toBeLessThan(0.021);
      expect(found.flipped).toBe(false);
    }
  });

  it('erkennt eine kopfstehende Karte in der Hülle und nennt ihre Lage im Bild, nicht gedreht', () => {
    const photo = sleeved(blobs, BOTTOM_RIGHT, true);
    const found = matchSleeved(catalog, photo, 3, matchCard(catalog, photo, 3));
    expect(found.matches[0]!.imageId).toBe('blobs');
    expect(found.matches[0]!.distance).toBeLessThanOrEqual(8);
    expect(found.flipped).toBe(true);
    expect(near(found.card!, BOTTOM_RIGHT)).toBeLessThan(0.021);
  });

  it('lässt den mittigen Treffer stehen, wenn die Karte den Umriss schon füllt', () => {
    const photo = image(blobs);
    const centered = matchCard(catalog, photo, 3);
    expect(centered.matches[0]!.distance).toBe(0);
    const found = matchSleeved(catalog, photo, 3, centered);
    expect(found).toBe(centered);
    expect(found.card).toBeUndefined();
  });

  it('macht aus einem fremden Motiv keinen Treffer', () => {
    // Ein Motiv, das der Katalog nicht führt: Auch mit allen Ausschnitten bleibt es weit weg.
    const foreign = sleeved((u, v) => 128 + 100 * Math.sin(u * 41) * Math.sin(v * 37 + u * 9), BOTTOM_RIGHT);
    const found = matchSleeved(catalog, foreign, 3, matchCard(catalog, foreign, 3));
    expect(found.matches[0]!.distance).toBeGreaterThan(30);
  });

  it('prüft je Verkleinerung acht Lagen in beiden Drehungen und nie den mittigen Ausschnitt', () => {
    const queries = sleeveFingerprints(image(blobs));
    expect(queries).toHaveLength(SLEEVE_ZOOMS.length * 8 * 2);
    for (const q of queries) {
      const { x0, x1, y0, y1 } = q.card!;
      expect(x1 - x0).toBeCloseTo(q.zoom, 10);
      expect(y1 - y0).toBeCloseTo(q.zoom, 10);
      expect(x0 >= 0 && y0 >= 0 && x1 <= 1 + 1e-9 && y1 <= 1 + 1e-9).toBe(true);
      const centeredX = Math.abs(x0 + x1 - 1) < 1e-9;
      const centeredY = Math.abs(y0 + y1 - 1) < 1e-9;
      expect(centeredX && centeredY).toBe(false);
    }
  });
});

describe('Ecken der Karte in der Hülle', () => {
  const outline: Corners = [
    { x: 100, y: 50 },
    { x: 300, y: 50 },
    { x: 300, y: 450 },
    { x: 100, y: 450 },
  ];

  it('rechnet die Lage im Umriss auf das Kamerabild um', () => {
    const corners = cardCorners(outline, { x0: 0.1, x1: 1, y0: 0.25, y1: 1 });
    const expected = [
      [120, 150],
      [300, 150],
      [300, 450],
      [120, 450],
    ];
    corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i]![0]!, 6);
      expect(p.y).toBeCloseTo(expected[i]![1]!, 6);
    });
  });

  it('gibt für den ganzen Umriss den Umriss zurück, auch bei schräger Sicht', () => {
    const skewed: Corners = [
      { x: 120, y: 40 },
      { x: 310, y: 70 },
      { x: 290, y: 430 },
      { x: 90, y: 400 },
    ];
    const corners = cardCorners(skewed, { x0: 0, x1: 1, y0: 0, y1: 1 });
    corners.forEach((p, i) => {
      expect(p.x).toBeCloseTo(skewed[i]!.x, 6);
      expect(p.y).toBeCloseTo(skewed[i]!.y, 6);
    });
  });
});

describe('Suche im Katalog mit vorzeitigem Abbruch', () => {
  // Fester Zufall, damit jeder Lauf dieselben Fingerabdrücke prüft.
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  const randomFp = () => Uint8Array.from({ length: FP_BYTES }, () => Math.floor(random() * 256));
  const items: Record<string, string> = {};
  for (let i = 0; i < 400; i++) items[`bild-${i}`] = toHex(randomFp());
  const set = loadFingerprints({ version: FP_VERSION, items });

  it('zählt genau, solange die Grenze nicht erreicht ist, und meldet sonst mindestens die Grenze', () => {
    const a = randomFp();
    const b = randomFp();
    const exact = distance(a, 0, b, 0);
    expect(distance(a, 0, b, 0, exact + 1)).toBe(exact);
    expect(distance(a, 0, b, 0, 1)).toBeGreaterThanOrEqual(1);
    expect(distance(a, 0, b, 0, 1)).toBeLessThanOrEqual(exact);
  });

  it('findet dieselben Nachbarn wie die Suche ohne Abbruch', () => {
    for (let round = 0; round < 20; round++) {
      const query = randomFp();
      const all = set.imageIds
        .map((imageId, i) => ({ imageId, distance: distance(set.hashes, i * FP_BYTES, query) }))
        .sort((x, y) => x.distance - y.distance);
      const found = nearest(set, query, 3);
      expect(found.map((m) => m.distance)).toEqual(all.slice(0, 3).map((m) => m.distance));
      expect(found[0]!.distance).toBe(all[0]!.distance);
    }
  });
});
