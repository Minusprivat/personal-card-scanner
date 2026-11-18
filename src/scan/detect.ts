import type { Pixels } from './fingerprint';

/**
 * Findet die Karte im Kamerabild und entzerrt sie auf ein festes Format.
 *
 * OpenCV wird von außen hereingereicht: In der App läuft es in einem Web Worker,
 * in den Tests unter Node. Dieses Modul kennt nur die Bildverarbeitung.
 *
 * Zwei Verfahren suchen unabhängig nach dem Umriss, weil keines überall funktioniert:
 * - Kanten: findet die Karte auf unruhigem Untergrund, scheitert bei wenig Kontrast
 *   zwischen Kartenrand und Untergrund.
 * - Hintergrundfarbe: trennt alles, was anders aussieht als der Bildrand; funktioniert
 *   auf einfarbigem Untergrund auch bei dunklem Kartenrand.
 * Welcher Kandidat stimmt, entscheidet danach der Abgleich mit dem Katalog.
 */

// OpenCV.js bringt keine brauchbaren Typen für diesen Zweck mit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OpenCv = any;

/** Format der entzerrten Karte: 63 × 88 mm im Maßstab 4 px/mm. */
export const CARD_W = 252;
export const CARD_H = 352;

/** Seitenverhältnis einer Karte (88 / 63) mit Spielraum für Schrägsicht. */
const MIN_RATIO = 1.15;
const MAX_RATIO = 1.75;
/** Die Karte muss mindestens diesen Anteil des Bildes füllen und darf es nicht ganz ausfüllen. */
const MIN_AREA_SHARE = 0.05;
const MAX_AREA_SHARE = 0.97;
/** Arbeitsgröße für die Umrisssuche; größer bringt kaum Genauigkeit, kostet aber Zeit. */
const WORK_SIZE = 640;
/** So viele Kandidaten gibt die Suche höchstens zurück. */
const MAX_CANDIDATES = 10;
/** So oft werden die Kanten verdickt, um Lücken im Umriss zu schließen (je 1 Pixel pro Seite). */
const EDGE_DILATION = 2;

export interface Point {
  x: number;
  y: number;
}

export type Corners = [Point, Point, Point, Point];

export interface Candidate {
  /** Ecken im Ausgangsbild, im Uhrzeigersinn, beginnend an einer kurzen Kante. */
  corners: Corners;
  /** Anteil der Bildfläche, den das Viereck einnimmt. */
  areaShare: number;
  method: 'kanten' | 'hintergrund' | 'struktur';
}

export interface Detection extends Candidate {
  /** Entzerrte Karte, CARD_W × CARD_H, RGBA. Sie kann kopfstehen. */
  card: Pixels;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Fläche eines Vielecks (Betrag). */
const polygonArea = (pts: Point[]) =>
  Math.abs(pts.reduce((sum, p, i) => sum + p.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * p.y, 0)) / 2;

/**
 * Bringt vier Ecken in eine feste Reihenfolge: im Uhrzeigersinn, so dass die erste
 * Kante eine kurze Kante ist (die Karte also hochkant entzerrt wird).
 * Gibt null zurück, wenn das Viereck nicht wie eine Karte aussieht.
 */
export function orderCorners(points: Point[]): Corners | null {
  if (points.length !== 4) return null;
  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const [a, b, c, d] = sorted as Corners;

  const side1 = (dist(a, b) + dist(c, d)) / 2;
  const side2 = (dist(b, c) + dist(d, a)) / 2;
  const short = Math.min(side1, side2);
  const long = Math.max(side1, side2);
  if (short <= 0) return null;
  const ratio = long / short;
  if (ratio < MIN_RATIO || ratio > MAX_RATIO) return null;

  return side1 <= side2 ? [a, b, c, d] : [b, c, d, a];
}

/** Schnittpunkt zweier Geraden durch (p1, p2) und (p3, p4); null bei (fast) parallelen Geraden. */
function intersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-6) return null;
  const a = p1.x * p2.y - p1.y * p2.x;
  const b = p3.x * p4.y - p3.y * p4.x;
  return { x: (a * (p3.x - p4.x) - (p1.x - p2.x) * b) / d, y: (a * (p3.y - p4.y) - (p1.y - p2.y) * b) / d };
}

/**
 * Vier Ecken aus einem konvexen Vieleck: Die vier längsten Kanten werden verlängert und
 * geschnitten. So entstehen auch bei abgerundeten Kartenecken die richtigen Eckpunkte.
 */
export function quadFromPolygon(polygon: Point[]): Point[] | null {
  const n = polygon.length;
  if (n < 4) return null;
  if (n === 4) return polygon;
  const edges = polygon.map((p, i) => ({ i, from: p, to: polygon[(i + 1) % n]!, length: dist(p, polygon[(i + 1) % n]!) }));
  const longest = [...edges].sort((a, b) => b.length - a.length).slice(0, 4).sort((a, b) => a.i - b.i);
  const corners: Point[] = [];
  for (let k = 0; k < 4; k++) {
    const e1 = longest[k]!;
    const e2 = longest[(k + 1) % 4]!;
    const p = intersect(e1.from, e1.to, e2.from, e2.to);
    if (!p) return null;
    corners.push(p);
  }
  return corners;
}

function polygonOf(mat: OpenCv): Point[] {
  const d = mat.data32S as Int32Array;
  return Array.from({ length: mat.rows }, (_, i) => ({ x: d[i * 2]!, y: d[i * 2 + 1]! }));
}

/**
 * Kartenförmige Vierecke zu einem Umriss: das Viereck aus den vier längsten Kanten
 * (folgt auch schräger Sicht) und das kleinste umschließende Rechteck (verträgt
 * ausgefranste oder unvollständige Umrisse). Beide können gelten; welcher stimmt,
 * zeigt später der Abgleich.
 */
function quadsFromContour(cv: OpenCv, contour: OpenCv, width: number, height: number): Array<{ corners: Corners; area: number }> {
  const hull = new cv.Mat();
  const approx = new cv.Mat();
  const result: Array<{ corners: Corners; area: number }> = [];
  // Die Ecken dürfen nur knapp außerhalb des Bilds liegen, und das Viereck muss
  // den Umriss gut ausfüllen – sonst ist es kein Rechteck, sondern etwas anderes.
  const margin = 0.03 * Math.max(width, height);
  const accept = (points: Point[] | null, hullArea: number, minFill: number) => {
    const corners = points && orderCorners(points);
    if (!corners) return;
    if (corners.some((p) => p.x < -margin || p.y < -margin || p.x > width + margin || p.y > height + margin)) return;
    const area = polygonArea(corners);
    if (hullArea / area < minFill || hullArea / area > 1.08) return;
    result.push({ corners, area });
  };
  try {
    cv.convexHull(contour, hull, false, true);
    const hullArea = cv.contourArea(hull);
    cv.approxPolyDP(hull, approx, 0.012 * cv.arcLength(hull, true), true);
    accept(quadFromPolygon(polygonOf(approx)), hullArea, 0.9);
    const rect = cv.RotatedRect.points(cv.minAreaRect(hull)) as Point[];
    accept(rect.map((p) => ({ x: p.x, y: p.y })), hullArea, 0.86);
    return result;
  } finally {
    hull.delete();
    approx.delete();
  }
}

/** Schiebt die Ecken eines Vierecks um `px` Bildpunkte von der Mitte weg. */
function growQuad(corners: Corners, px: number): Corners {
  if (px === 0) return corners;
  const cx = corners.reduce((s, p) => s + p.x, 0) / 4;
  const cy = corners.reduce((s, p) => s + p.y, 0) / 4;
  return corners.map((p) => {
    const d = Math.hypot(p.x - cx, p.y - cy) || 1;
    // Eine Ecke liegt diagonal: je Achse `px`, entlang der Diagonale also das √2-Fache.
    const f = (d + px * Math.SQRT2) / d;
    return { x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f };
  }) as Corners;
}

/**
 * Sammelt kartenförmige Vierecke aus einem Schwarzweißbild.
 *
 * @param inner Auch Innenränder weißer Flächen prüfen. Im Kantenbild ist der Kartenumriss eine
 *   geschlossene Linie; an ihrer Außenseite hängen Störungen des Untergrunds (Holzmaserung,
 *   Körnung der Matte), ihre Innenseite ist sauber. `grow` gleicht die Verdickung der Linie aus.
 */
function quadsFromMask(
  cv: OpenCv,
  mask: OpenCv,
  method: Candidate['method'],
  out: Array<Candidate & { area: number }>,
  inner = false,
  grow = 0,
): void {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(mask, contours, hierarchy, inner ? cv.RETR_LIST : cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const imageArea = mask.cols * mask.rows;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      try {
        if (cv.contourArea(contour) < imageArea * MIN_AREA_SHARE * 0.6) continue;
        for (const quad of quadsFromContour(cv, contour, mask.cols, mask.rows)) {
          const areaShare = quad.area / imageArea;
          if (areaShare < MIN_AREA_SHARE || areaShare > MAX_AREA_SHARE) continue;
          out.push({ corners: growQuad(quad.corners, grow), area: quad.area, areaShare, method });
        }
      } finally {
        contour.delete();
      }
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
}

/**
 * Schwellen der Kantensuche. Die feine Stufe findet auch den schwachen Rand einer dunklen
 * Karte auf dunkler Matte, nimmt aber Holzmaserung und den Rand einer Hülle mit; beides
 * hängt sich an den Kartenumriss und macht ihn unbrauchbar. Die grobe Stufe sieht nur
 * kräftige Kanten: den schwarzen Kartenrand auf hellem Holz, nicht die Maserung.
 */
const EDGE_LEVELS = [
  { low: 25, high: 75 },
  { low: 70, high: 200 },
] as const;

/** Verfahren 1: Kanten im Helligkeitsbild. */
function edgeMask(cv: OpenCv, small: OpenCv, level: (typeof EDGE_LEVELS)[number]): OpenCv {
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  try {
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, level.low, level.high);
    // Kleine Lücken im Umriss schließen, sonst zerfällt er in Stücke.
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), EDGE_DILATION);
    return edges;
  } finally {
    gray.delete();
    kernel.delete();
  }
}

/**
 * Verfahren 3: Fläche mit viel Struktur. Eine Karte ist voller Kanten (Motiv, Rahmen,
 * Text), ein Tisch oder eine Spielmatte kaum. Die Kanten werden zu einer Fläche
 * zusammengezogen; das überbrückt auch den schwarzen Kartenrand bis zur äußeren Kante,
 * der sich auf dunklem Untergrund farblich nicht abhebt. Dünne Reste (Maserung,
 * Körnung) fallen danach wieder weg.
 */
function structureMask(cv: OpenCv, small: OpenCv): OpenCv {
  const gray = new cv.Mat();
  const mask = new cv.Mat();
  const size = Math.max(small.cols, small.rows);
  const odd = (n: number) => Math.max(3, Math.round(n) | 1);
  const close = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(size * 0.035), odd(size * 0.035)));
  const open = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(size * 0.05), odd(size * 0.05)));
  try {
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, mask, 25, 75);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, close);
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, open);
    return mask;
  } finally {
    gray.delete();
    close.delete();
    open.delete();
  }
}

const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1]!;

/** Verfahren 2: alles, was sich farblich vom Bildrand (dem Untergrund) abhebt. */
function backgroundMask(cv: OpenCv, small: OpenCv): OpenCv {
  const blurred = new cv.Mat();
  const diff = new cv.Mat(small.rows, small.cols, cv.CV_8UC1);
  const mask = new cv.Mat();
  const close = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
  const open = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  try {
    cv.GaussianBlur(small, blurred, new cv.Size(7, 7), 0);
    const d = blurred.data as Uint8Array;
    const w = small.cols;
    const h = small.rows;

    // Farbe des Untergrunds: Median über einen schmalen Streifen am Bildrand.
    const ring = Math.max(2, Math.round(Math.min(w, h) * 0.03));
    const r: number[] = [];
    const g: number[] = [];
    const b: number[] = [];
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
        const i = (y * w + x) * 4;
        r.push(d[i]!);
        g.push(d[i + 1]!);
        b.push(d[i + 2]!);
      }
    }
    const br = median(r);
    const bg = median(g);
    const bb = median(b);

    const out = diff.data as Uint8Array;
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
      const v = Math.abs(d[p]! - br) + Math.abs(d[p + 1]! - bg) + Math.abs(d[p + 2]! - bb);
      out[i] = v > 255 ? 255 : v;
    }
    cv.threshold(diff, mask, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, close);
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, open);
    return mask;
  } finally {
    blurred.delete();
    diff.delete();
    close.delete();
    open.delete();
  }
}

/** true, wenn zwei Vierecke praktisch dieselbe Stelle beschreiben. */
function sameQuad(a: Corners, b: Corners, tolerance: number): boolean {
  return a.every((p) => b.some((q) => dist(p, q) < tolerance));
}

/**
 * Sucht kartenförmige Vierecke im Bild, größtes zuerst. `src` ist ein RGBA-Bild
 * (cv.Mat) und bleibt unverändert.
 */
export function findCandidates(cv: OpenCv, src: OpenCv): Candidate[] {
  const scale = Math.min(1, WORK_SIZE / Math.max(src.cols, src.rows));
  const small = new cv.Mat();
  const found: Array<Candidate & { area: number }> = [];
  try {
    cv.resize(src, small, new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale)), 0, 0, cv.INTER_AREA);
    const background = backgroundMask(cv, small);
    const structure = structureMask(cv, small);
    try {
      quadsFromMask(cv, background, 'hintergrund', found);
      quadsFromMask(cv, structure, 'struktur', found);
    } finally {
      background.delete();
      structure.delete();
    }
    for (const level of EDGE_LEVELS) {
      const edges = edgeMask(cv, small, level);
      try {
        quadsFromMask(cv, edges, 'kanten', found, true, EDGE_DILATION);
      } finally {
        edges.delete();
      }
    }

    found.sort((a, b) => b.area - a.area);
    const tolerance = 0.02 * Math.max(small.cols, small.rows);
    const unique: typeof found = [];
    for (const c of found) {
      if (!unique.some((u) => sameQuad(u.corners, c.corners, tolerance))) unique.push(c);
    }
    return unique.slice(0, MAX_CANDIDATES).map(({ corners, areaShare, method }) => ({
      corners: corners.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Corners,
      areaShare,
      method,
    }));
  } finally {
    small.delete();
  }
}

/** Zieht das Viereck `corners` aus `src` auf das feste Kartenformat. */
export function warp(cv: OpenCv, src: OpenCv, corners: Corners): Pixels {
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap((p) => [p.x, p.y]));
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, CARD_W, 0, CARD_W, CARD_H, 0, CARD_H]);
  const m = cv.getPerspectiveTransform(from, to);
  const out = new cv.Mat();
  try {
    cv.warpPerspective(src, out, m, new cv.Size(CARD_W, CARD_H), cv.INTER_LINEAR);
    return { data: new Uint8Array(out.data), width: CARD_W, height: CARD_H, channels: 4 };
  } finally {
    from.delete();
    to.delete();
    m.delete();
    out.delete();
  }
}

/** Graustufenbild der Nummernzeile für die Texterkennung, RGBA. */
export interface StripImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Zieht die Nummernzeile aus dem Bild gerade und bereitet sie für die Texterkennung auf.
 * `quad` sind die Ecken der Zeile in `src` in Leserichtung.
 */
export function extractStrip(
  cv: OpenCv,
  src: OpenCv,
  quad: [Point, Point, Point, Point],
  width: number,
  height: number,
  prepare: (rgba: ArrayLike<number>, width: number, height: number) => Uint8ClampedArray,
): StripImage {
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, quad.flatMap((p) => [p.x, p.y]));
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
  const m = cv.getPerspectiveTransform(from, to);
  const out = new cv.Mat();
  try {
    cv.warpPerspective(src, out, m, new cv.Size(width, height), cv.INTER_CUBIC);
    return { data: prepare(out.data as Uint8Array, width, height), width, height };
  } finally {
    from.delete();
    to.delete();
    m.delete();
    out.delete();
  }
}
