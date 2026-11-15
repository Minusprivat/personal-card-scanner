/**
 * Prüft die ganze Kette ohne echte Fotos: legt Katalogbilder schräg und perspektivisch
 * verzerrt auf verschiedene Untergründe und lässt die Erkennung darüber laufen
 * (Karte finden → entzerren → Fingerabdruck → Abgleich).
 *
 * Aufruf: npm run scan:scenes   (braucht `npm run data:images` und `npm run data:fingerprints`)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FP_VERSION } from '../../src/scan/fingerprint';
import type { OpenCv, Point } from '../../src/scan/detect';
import { recognize } from '../../src/scan/recognize';
import { loadTestData, localImages, pct, ROOT, seededRandom } from './common';
import { getCv, matFromImage } from './cv';

const SCENE_W = 960;
const SCENE_H = 720;
const SAMPLE = 200;

const BACKGROUNDS: Array<[name: string, rgb: [number, number, number]]> = [
  ['dunkles Holz', [86, 58, 40]],
  ['grauer Tisch', [150, 150, 152]],
  ['weißer Tisch', [236, 236, 232]],
  ['schwarze Spielmatte', [24, 24, 28]],
  ['grüne Spielmatte', [38, 92, 60]],
];

/** Untergrund mit leichtem Helligkeitsverlauf und Körnung, wie ein Foto. */
function background(cv: OpenCv, rgb: [number, number, number], rnd: () => number): OpenCv {
  const mat = new cv.Mat(SCENE_H, SCENE_W, cv.CV_8UC4);
  const d = mat.data as Uint8Array;
  const tilt = (rnd() - 0.5) * 50;
  for (let y = 0; y < SCENE_H; y++) {
    for (let x = 0; x < SCENE_W; x++) {
      const shade = (x / SCENE_W - 0.5) * tilt + (rnd() - 0.5) * 18;
      const i = (y * SCENE_W + x) * 4;
      d[i] = Math.max(0, Math.min(255, rgb[0] + shade));
      d[i + 1] = Math.max(0, Math.min(255, rgb[1] + shade));
      d[i + 2] = Math.max(0, Math.min(255, rgb[2] + shade));
      d[i + 3] = 255;
    }
  }
  return mat;
}

/** Zufällige Lage der Karte: gedreht bis ±35°, 45–80 % der Bildhöhe, Ecken perspektivisch verschoben. */
function randomQuad(rnd: () => number): Point[] {
  const h = SCENE_H * (0.45 + rnd() * 0.35);
  const w = (h * 63) / 88;
  const angle = ((rnd() - 0.5) * 70 * Math.PI) / 180;
  const cx = SCENE_W / 2 + (rnd() - 0.5) * 120;
  const cy = SCENE_H / 2 + (rnd() - 0.5) * 60;
  const jitter = () => (rnd() - 0.5) * 0.1 * h;
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({
    x: cx + x! * Math.cos(angle) - y! * Math.sin(angle) + jitter(),
    y: cy + x! * Math.sin(angle) + y! * Math.cos(angle) + jitter(),
  }));
}

function placeCard(cv: OpenCv, scene: OpenCv, card: OpenCv, quad: Point[]): void {
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, card.cols, 0, card.cols, card.rows, 0, card.rows]);
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, quad.flatMap((p) => [p.x, p.y]));
  const m = cv.getPerspectiveTransform(from, to);
  cv.warpPerspective(card, scene, m, new cv.Size(SCENE_W, SCENE_H), cv.INTER_LINEAR, cv.BORDER_TRANSPARENT);
  from.delete();
  to.delete();
  m.delete();
}

/** Größter Abstand einer wahren Ecke zur nächsten gefundenen Ecke. */
const cornerError = (truth: Point[], found: Point[]) =>
  Math.max(...truth.map((t) => Math.min(...found.map((f) => Math.hypot(t.x - f.x, t.y - f.y)))));

async function main() {
  const cv = await getCv();
  const data = await loadTestData();
  const images = await localImages();
  const ids = [...images.keys()].filter((id) => data.motifOf.has(id));
  if (ids.length === 0) throw new Error('Keine Bilder unter .cache/images. Zuerst `npm run data:images` ausführen.');
  const step = Math.max(1, Math.floor(ids.length / SAMPLE));
  const sample = ids.filter((_, i) => i % step === 0).slice(0, SAMPLE);

  const rows: string[] = [];
  let totalMs = 0;
  let runs = 0;
  for (const [bgIndex, [name, rgb]] of BACKGROUNDS.entries()) {
    const rnd = seededRandom(1000 + bgIndex);
    let found = 0;
    let motif = 0;
    let top3 = 0;
    for (const id of sample) {
      const card = await matFromImage(cv, images.get(id)!);
      const scene = background(cv, rgb, rnd);
      const quad = randomQuad(rnd);
      placeCard(cv, scene, card, quad);

      const start = performance.now();
      const result = recognize(cv, scene, data.fingerprints, 3);
      totalMs += performance.now() - start;
      runs++;

      const side = Math.hypot(quad[0]!.x - quad[3]!.x, quad[0]!.y - quad[3]!.y);
      if (result) {
        // Der Umriss darf ungenau sein, solange die Karte erkannt wird; beides wird getrennt gezählt.
        if (cornerError(quad, result.detection.corners) < side * 0.05) found++;
        if (data.motifOf.get(result.matches[0]!.imageId) === data.motifOf.get(id)) motif++;
        if (result.matches.some((m) => data.motifOf.get(m.imageId) === data.motifOf.get(id))) top3++;
      }
      card.delete();
      scene.delete();
    }
    const n = sample.length;
    rows.push(`| ${name} | ${pct(motif, n)} | ${pct(top3, n)} | ${pct(found, n)} |`);
    console.log(`${name}: richtiges Motiv vorn ${pct(motif, n)}, unter den ersten drei ${pct(top3, n)}, Umriss genau ${pct(found, n)}`);
  }
  const avg = totalMs / runs;
  console.log(`Mittlere Dauer je Bild auf diesem PC: ${avg.toFixed(0)} ms`);

  const report = `# M3: Szenentest der ganzen Erkennungskette

Erzeugt von \`npm run scan:scenes\`. ${sample.length} Katalogbilder je Untergrund, Fingerabdruck-Version ${FP_VERSION}.

Jedes Bild wird gedreht (bis ±35°), perspektivisch verzerrt und auf einen Untergrund gelegt. Danach läuft die ganze Kette: Karte finden, entzerren, Fingerabdruck, Abgleich mit allen ${data.fingerprints.imageIds.length} Katalogbildern. Die Szenen sind künstlich: ohne Schatten, Hülle, Spiegelung und Finger. Echte Fotos fallen schlechter aus.

Alle Anteile beziehen sich auf alle Szenen. „Umriss genau“ heißt: Alle vier Ecken liegen höchstens 5 % der Kartenlänge daneben. Eine Karte kann auch bei ungenauem Umriss richtig erkannt werden.

| Untergrund | richtiges Motiv an erster Stelle | richtiges Motiv unter den ersten drei | Umriss genau |
| --- | --- | --- | --- |
${rows.join('\n')}

Mittlere Dauer je Bild auf dem Entwicklungs-PC: ${avg.toFixed(0)} ms (ohne Laden von OpenCV). Auf dem Handy ist erst nach einem Test dort eine Aussage möglich.
`;
  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'm3-szenentest.md'), report);
  console.log('Bericht: docs/m3-szenentest.md');
}

await main();
