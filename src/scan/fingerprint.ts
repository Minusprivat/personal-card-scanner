/**
 * Bild-Fingerabdruck einer entzerrten Karte. Datenskript (Katalogbilder) und App
 * (Kamerabild) rechnen mit genau diesem Modul, damit beide Seiten zusammenpassen.
 *
 * Verfahren: Helligkeitsbild → 32 × 32 Felder → Kosinus-Transformation → die 63
 * gröbsten Anteile, je ein Bit „über oder unter dem Median“ (Perceptual Hash).
 * Das ist unempfindlich gegen Helligkeit, Kontrast, Unschärfe und leichte Farbstiche.
 * Es gibt zwei solche Hashes: einen über die ganze Karte, einen über das Motiv.
 */

/** Ändert sich das Verfahren, muss diese Zahl steigen; alte Fingerabdrücke gelten dann nicht mehr. */
export const FP_VERSION = 1;

/** Länge eines Fingerabdrucks: 8 Byte ganze Karte + 8 Byte Motiv. */
export const FP_BYTES = 16;

/** RGB- oder RGBA-Pixel, zeilenweise. */
export interface Pixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
  channels: 3 | 4;
}

interface Gray {
  data: Float32Array;
  width: number;
  height: number;
}

/** Ausschnitt mit dem Motiv, als Anteil der hochkant gestellten Karte. */
const ART = { x0: 0.08, x1: 0.92, y0: 0.12, y1: 0.52 };
const FULL = { x0: 0.03, x1: 0.97, y0: 0.03, y1: 0.97 };

const GRID = 32;
const LOW = 8;

/** Helligkeit; liegende Bilder (Battlefields) werden hochkant gedreht, damit alle Karten gleich liegen. */
function toGray(px: Pixels): Gray {
  const { width: w, height: h, channels: c, data } = px;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lum.length; i++, p += c) {
    lum[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
  }
  if (w <= h) return { data: lum, width: w, height: h };

  // 90° im Uhrzeigersinn: Ziel (x, y) kommt aus Quelle (y, h - 1 - x).
  const out = new Float32Array(w * h);
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < h; x++) out[y * h + x] = lum[(h - 1 - x) * w + y]!;
  }
  return { data: out, width: h, height: w };
}

function rotate180(g: Gray): Gray {
  const out = new Float32Array(g.data.length);
  for (let i = 0, n = out.length; i < n; i++) out[i] = g.data[n - 1 - i]!;
  return { data: out, width: g.width, height: g.height };
}

interface Region {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Zieht einen Ausschnitt um die Kartenmitte zusammen (zoom < 1) oder auseinander. */
const zoomed = (r: Region, zoom: number): Region => ({
  x0: 0.5 + (r.x0 - 0.5) * zoom,
  x1: 0.5 + (r.x1 - 0.5) * zoom,
  y0: 0.5 + (r.y0 - 0.5) * zoom,
  y1: 0.5 + (r.y1 - 0.5) * zoom,
});

/** Mittelt den Ausschnitt auf GRID × GRID Felder. */
function grid(g: Gray, r: Region): Float64Array {
  const out = new Float64Array(GRID * GRID);
  const rx = r.x0 * g.width;
  const ry = r.y0 * g.height;
  const rw = (r.x1 - r.x0) * g.width;
  const rh = (r.y1 - r.y0) * g.height;
  // Angeschnittene Pixel zählen anteilig. Sonst hinge das Ergebnis davon ab, wie die
  // Feldgrenzen zufällig auf das Pixelraster fallen, also von der Bildgröße.
  for (let j = 0; j < GRID; j++) {
    const fy0 = ry + (j * rh) / GRID;
    const fy1 = ry + ((j + 1) * rh) / GRID;
    for (let i = 0; i < GRID; i++) {
      const fx0 = rx + (i * rw) / GRID;
      const fx1 = rx + ((i + 1) * rw) / GRID;
      let sum = 0;
      let weight = 0;
      for (let y = Math.max(0, Math.floor(fy0)); y < fy1 && y < g.height; y++) {
        const wy = Math.min(fy1, y + 1) - Math.max(fy0, y);
        const row = y * g.width;
        for (let x = Math.max(0, Math.floor(fx0)); x < fx1 && x < g.width; x++) {
          const w = wy * (Math.min(fx1, x + 1) - Math.max(fx0, x));
          sum += g.data[row + x]! * w;
          weight += w;
        }
      }
      out[j * GRID + i] = weight > 0 ? sum / weight : 0;
    }
  }
  return out;
}

const COS = (() => {
  const t = new Float64Array(LOW * GRID);
  for (let u = 0; u < LOW; u++) {
    for (let x = 0; x < GRID; x++) t[u * GRID + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * GRID));
  }
  return t;
})();

/** 64 Bit aus den 8 × 8 gröbsten Anteilen; der Gleichanteil (mittlere Helligkeit) zählt nicht. */
function phash(cells: Float64Array, out: Uint8Array, offset: number): void {
  // Erst über die Zeilen, dann über die Spalten.
  const rows = new Float64Array(GRID * LOW);
  for (let y = 0; y < GRID; y++) {
    for (let u = 0; u < LOW; u++) {
      let s = 0;
      for (let x = 0; x < GRID; x++) s += cells[y * GRID + x]! * COS[u * GRID + x]!;
      rows[y * LOW + u] = s;
    }
  }
  const coef = new Float64Array(LOW * LOW);
  for (let v = 0; v < LOW; v++) {
    for (let u = 0; u < LOW; u++) {
      let s = 0;
      for (let y = 0; y < GRID; y++) s += rows[y * LOW + u]! * COS[v * GRID + y]!;
      coef[v * LOW + u] = s;
    }
  }

  const ac = Array.from(coef.subarray(1)).sort((a, b) => a - b);
  const median = (ac[31]! + ac[30]!) / 2;
  for (let i = 0; i < 8; i++) out[offset + i] = 0;
  for (let i = 1; i < LOW * LOW; i++) {
    if (coef[i]! > median) out[offset + (i >> 3)]! |= 1 << (i & 7);
  }
}

function fromGray(g: Gray, zoom = 1): Uint8Array {
  const fp = new Uint8Array(FP_BYTES);
  phash(grid(g, zoom === 1 ? FULL : zoomed(FULL, zoom)), fp, 0);
  phash(grid(g, zoom === 1 ? ART : zoomed(ART, zoom)), fp, 8);
  return fp;
}

/** Fingerabdruck eines Kartenbilds, das die Karte randlos und gerade zeigt. */
export function fingerprint(px: Pixels): Uint8Array {
  return fromGray(toGray(px));
}

/**
 * Der gefundene Umriss sitzt selten genau auf dem Kartenrand; meist ist er etwas zu groß
 * (Schatten, Hülle). Die Karte füllt den entzerrten Ausschnitt dann nicht ganz aus.
 * Deshalb wird das Kamerabild zusätzlich mit leicht nach innen gezogenem Ausschnitt geprüft.
 */
export const QUERY_ZOOMS = [1, 0.96, 0.92] as const;

export interface QueryFingerprint {
  fp: Uint8Array;
  /** true für die um 180° gedrehte Lage. */
  flipped: boolean;
  zoom: number;
  /**
   * Wo die Karte im entzerrten Umriss liegt, als Anteile seiner Breite und Höhe und in der
   * Lage, in der er entzerrt wurde (also ohne die Drehung um 180°). Fehlt bei den mittigen
   * Ausschnitten: Dort gilt der Umriss selbst als Kartenrand.
   */
  card?: CardRegion;
}

/** Rechteck im entzerrten Umriss, Anteile von 0 bis 1. */
export interface CardRegion {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Für das Kamerabild: Ob die Karte kopfsteht und wie genau der Umriss sitzt, ist nach
 * dem Entzerren nicht bekannt. Liefert deshalb Fingerabdrücke für beide Lagen und
 * mehrere Ausschnitte; der Abgleich nimmt den, der am besten passt.
 */
export function queryFingerprints(px: Pixels): QueryFingerprint[] {
  const upright = toGray(px);
  const turned = rotate180(upright);
  return QUERY_ZOOMS.flatMap((zoom) => [
    { fp: fromGray(upright, zoom), flipped: false, zoom },
    { fp: fromGray(turned, zoom), flipped: true, zoom },
  ]);
}

/**
 * Ausschnitte für Karten in Hüllen: Der Umriss trifft dann die Hülle, und die Karte sitzt
 * darin selten mittig, meist an einer Kante oder in einer Ecke. Anteil der Hülle, den die
 * Karte einnimmt; 0.88 deckt dickere Hüllen ab.
 *
 * Bewusst in Breite und Höhe derselbe Anteil. Getrennte Anteile je Richtung (rund 330
 * Ausschnitte statt 48) fanden zwar mehr Karten in weiten Hüllen, ließen aber an den Fotos
 * vom 18.11.2026 zwei falsche Karten von selbst zählen: Mit so vielen Versuchen passt
 * irgendein Ausschnitt zufällig gut zu einer fremden Karte.
 */
export const SLEEVE_ZOOMS = [0.96, 0.92, 0.88] as const;

/** Lagen des verkleinerten Ausschnitts entlang einer Richtung: am Anfang, mittig, am Ende. */
const sleeveSpans = (zoom: number): Array<[number, number]> => [
  [0, zoom],
  [(1 - zoom) / 2, (1 + zoom) / 2],
  [1 - zoom, 1],
];

/**
 * Wie `queryFingerprints`, aber für Karten in Hüllen: der verkleinerte Ausschnitt an jeder
 * Kante und in jeder Ecke des Umrisses, in beiden Drehungen. Das sind 48 Fingerabdrücke; der
 * Abgleich rechnet sie nur, wenn die mittigen Ausschnitte keinen sicheren Treffer ergeben.
 */
export function sleeveFingerprints(px: Pixels): QueryFingerprint[] {
  const gray = toGray(px);
  const sums = integral(gray);
  const out: QueryFingerprint[] = [];
  for (const zoom of SLEEVE_ZOOMS) {
    const spans = sleeveSpans(zoom);
    for (const [y0, y1] of spans) {
      for (const [x0, x1] of spans) {
        // Der mittige Ausschnitt ist schon mit `queryFingerprints` geprüft.
        if (x0 === spans[1]![0] && y0 === spans[1]![0]) continue;
        const card = { x0, x1, y0, y1 };
        for (const flipped of [false, true]) {
          const fp = new Uint8Array(FP_BYTES);
          phash(gridFromSums(sums, gray, within(card, FULL, flipped), flipped), fp, 0);
          phash(gridFromSums(sums, gray, within(card, ART, flipped), flipped), fp, 8);
          out.push({ fp, flipped, zoom, card });
        }
      }
    }
  }
  return out;
}

/**
 * Ausschnitt `r` der Karte (Anteile der Karte), umgerechnet auf den entzerrten Umriss, in
 * dem die Karte das Feld `card` füllt. Steht die Karte kopf, liegt der Ausschnitt gespiegelt.
 */
function within(card: CardRegion, r: Region, flipped: boolean): Region {
  const w = card.x1 - card.x0;
  const h = card.y1 - card.y0;
  return flipped
    ? { x0: card.x1 - r.x1 * w, x1: card.x1 - r.x0 * w, y0: card.y1 - r.y1 * h, y1: card.y1 - r.y0 * h }
    : { x0: card.x0 + r.x0 * w, x1: card.x0 + r.x1 * w, y0: card.y0 + r.y0 * h, y1: card.y0 + r.y1 * h };
}

/**
 * Summenbild: Wert an (x, y) = Summe aller Pixel links oberhalb. Damit kostet der Mittelwert
 * eines Feldes vier Zugriffe statt einer Schleife über seine Pixel; bei 48 Ausschnitten je
 * Umriss ist das der Unterschied zwischen brauchbar und zu langsam.
 */
function integral(g: Gray): Float64Array {
  const w = g.width + 1;
  const sums = new Float64Array(w * (g.height + 1));
  for (let y = 0; y < g.height; y++) {
    let row = 0;
    for (let x = 0; x < g.width; x++) {
      row += g.data[y * g.width + x]!;
      sums[(y + 1) * w + x + 1] = sums[y * w + x + 1]! + row;
    }
  }
  return sums;
}

/**
 * Wie `grid`, aber aus dem Summenbild. Zwischen den Pixelgrenzen wird das Summenbild
 * linear gelesen; das zählt angeschnittene Pixel genau anteilig, wie `grid` es tut.
 * `flipped` liefert die Felder so, als wäre das Bild um 180° gedreht.
 */
function gridFromSums(sums: Float64Array, g: Gray, r: Region, flipped: boolean): Float64Array {
  const w = g.width + 1;
  const n = GRID + 1;
  // Feldgrenzen: ganzzahliger Teil und Rest, je Richtung einmal gerechnet.
  const xi = new Int32Array(n);
  const xt = new Float64Array(n);
  const yi = new Int32Array(n);
  const yt = new Float64Array(n);
  const cw = ((r.x1 - r.x0) * g.width) / GRID;
  const ch = ((r.y1 - r.y0) * g.height) / GRID;
  for (let k = 0; k < n; k++) {
    const x = Math.min(Math.max(r.x0 * g.width + k * cw, 0), g.width);
    const y = Math.min(Math.max(r.y0 * g.height + k * ch, 0), g.height);
    xi[k] = Math.min(Math.floor(x), g.width - 1);
    xt[k] = x - xi[k]!;
    yi[k] = Math.min(Math.floor(y), g.height - 1);
    yt[k] = y - yi[k]!;
  }
  // Summe links oberhalb jeder Feldecke.
  const corner = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const row = yi[j]! * w;
    const ty = yt[j]!;
    for (let i = 0; i < n; i++) {
      const at = row + xi[i]!;
      const tx = xt[i]!;
      const a = sums[at]!;
      const b = sums[at + 1]!;
      const c = sums[at + w]!;
      const d = sums[at + w + 1]!;
      corner[j * n + i] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  const out = new Float64Array(GRID * GRID);
  const area = cw * ch;
  const last = GRID * GRID - 1;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const at = j * n + i;
      const mean = (corner[at + n + 1]! - corner[at + n]! - corner[at + 1]! + corner[at]!) / area;
      out[flipped ? last - (j * GRID + i) : j * GRID + i] = mean;
    }
  }
  return out;
}

const POPCOUNT = (() => {
  const t = new Uint8Array(256);
  for (let i = 1; i < 256; i++) t[i] = t[i >> 1]! + (i & 1);
  return t;
})();

/**
 * Zahl der unterschiedlichen Bits zweier Fingerabdrücke (0 = gleich, 128 = völlig verschieden).
 * Mit `giveUpAt` bricht die Zählung nach der ersten Hälfte ab, sobald dieser Wert erreicht
 * ist; das Ergebnis ist dann nur „mindestens so viel“. Die Suche im Katalog spart so Zeit.
 */
export function distance(a: Uint8Array, aOffset: number, b: Uint8Array, bOffset = 0, giveUpAt = Infinity): number {
  let d = 0;
  const half = FP_BYTES >> 1;
  for (let i = 0; i < half; i++) d += POPCOUNT[a[aOffset + i]! ^ b[bOffset + i]!]!;
  if (d >= giveUpAt) return d;
  for (let i = half; i < FP_BYTES; i++) d += POPCOUNT[a[aOffset + i]! ^ b[bOffset + i]!]!;
  return d;
}

export const toHex = (fp: Uint8Array): string => Array.from(fp, (b) => b.toString(16).padStart(2, '0')).join('');

export function fromHex(hex: string, out: Uint8Array, offset: number): void {
  for (let i = 0; i < FP_BYTES; i++) out[offset + i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
}
