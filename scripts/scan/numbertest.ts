/**
 * Prüft das Lesen der Kartennummer an Katalogbildern in voller Größe, verkleinert auf die
 * Kartenhöhe, die eine Handykamera typischerweise liefert.
 *
 * Braucht große Katalogbilder unter `.cache/full/` (nur für die Entwicklung, nicht im
 * Repository). Echte Fotos ersetzen diesen Test nicht: Unschärfe, Spiegelung und Hüllen fehlen.
 *
 * Aufruf: npm run scan:numbers
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildIndex } from '../../src/data/catalog-index';
import { extractStrip, type Corners, type OpenCv } from '../../src/scan/detect';
import { numberStrip, pickByNumber, prepareStrip, STRIP_H } from '../../src/scan/number';
import { loadTestData, pct, ROOT } from './common';
import { getCv } from './cv';
import { createOcr } from './ocr';

const FULL_DIR = path.join(ROOT, '.cache', 'full');
/** Kartenhöhe im Kamerabild in Bildpunkten (längere Kartenseite). */
const CARD_SIZES = [800, 600, 480, 400];

async function scaledMat(cv: OpenCv, file: string, long: number, upsideDown: boolean) {
  const meta = await sharp(file).metadata();
  const scale = long / Math.max(meta.width, meta.height);
  let img = sharp(file).flatten({ background: '#000' }).resize({ width: Math.round(meta.width * scale) });
  if (upsideDown) img = sharp(await img.png().toBuffer()).rotate(180);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mat = new cv.Mat(info.height, info.width, cv.CV_8UC4);
  mat.data.set(data);
  return { mat, width: info.width, height: info.height };
}

/** Ecken des ganzen Bilds in der Reihenfolge, die die Umrisssuche liefert: im Uhrzeigersinn ab einer kurzen Kante. */
function imageCorners(width: number, height: number): Corners {
  return width <= height
    ? [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }]
    : [{ x: 0, y: height }, { x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }];
}

async function main() {
  const files = (await readdir(FULL_DIR).catch(() => [] as string[])).filter((f) => f.endsWith('.webp')).sort();
  if (files.length === 0) {
    console.log('Keine großen Katalogbilder unter .cache/full/.');
    return;
  }
  const cv = await getCv();
  const ocr = await createOcr();
  const data = await loadTestData();
  const index = buildIndex(data.catalog);

  const rows: string[] = [];
  const misses: string[] = [];
  for (const long of CARD_SIZES) {
    let exact = 0;
    let picked = 0;
    let wrong = 0;
    let n = 0;
    for (const [i, file] of files.entries()) {
      const print = index.printsByImageId.get(file.replace(/\.webp$/, ''))?.[0];
      if (!print) continue;
      n++;
      const code = print.skus[0]!.publicCode;
      // Jede zweite Karte steht kopf, wie es beim Scannen vorkommt.
      const upsideDown = i % 2 === 1;
      const { mat, width, height } = await scaledMat(cv, path.join(FULL_DIR, file), long, upsideDown);
      const strip = numberStrip(imageCorners(width, height), upsideDown, width > height);
      const text = await ocr.readLine(extractStrip(cv, mat, strip.quad, strip.width, STRIP_H, prepareStrip));
      mat.delete();

      // Kandidaten wie im Scanner: alle Drucke derselben Karte.
      const candidates = (index.printsByCardId.get(print.cardId) ?? []).map((p) => ({
        item: p.skus[0]!.publicCode,
        code: p.skus[0]!.publicCode,
      }));
      const choice = pickByNumber(text, candidates);
      if (pickByNumber(text, [{ item: code, code }]) && choice === code) exact++;
      if (choice === code) picked++;
      else if (choice !== null) wrong++;
      if (choice !== code && long === 600) misses.push(`| ${code} | ${text || '(nichts)'} | ${choice ?? 'keine Zuordnung'} |`);
    }
    rows.push(`| ${long} px | ${pct(picked, n)} | ${pct(wrong, n)} | ${pct(n - picked - wrong, n)} |`);
    console.log(`Kartenhöhe ${long} px: richtig zugeordnet ${pct(picked, n)}, falsch ${pct(wrong, n)}, nicht lesbar ${pct(n - picked - wrong, n)} (${n} Karten)`);
  }
  await ocr.close();

  const report = `# M3: Lesen der Kartennummer

Erzeugt von \`npm run scan:numbers\`. ${files.length} Katalogbilder in voller Größe, verkleinert auf die angegebene Kartenhöhe; jede zweite Karte steht kopf.

Gelesen wird nur die Nummernzeile. Der Text wird unscharf mit den Nummern aller Drucke derselben Karte verglichen (bis zu zwei Zeichenfehler). „Falsch“ heißt: einem anderen Druck zugeordnet. „Nicht lesbar“ heißt: keine eindeutige Zuordnung; der Scanner fällt dann auf den Bildabgleich zurück.

| Kartenhöhe im Bild | richtig zugeordnet | falsch zugeordnet | nicht lesbar |
| --- | --- | --- | --- |
${rows.join('\n')}

Der Test nutzt saubere Katalogbilder. Echte Fotos mit Unschärfe, Spiegelung oder Hülle fallen schlechter aus. Das Sternchen signierter Karten liest die Texterkennung nicht; signierte und unsignierte Fassungen trennt sie deshalb nicht.

## Nicht richtig zugeordnet bei 600 px

| Erwartet | Gelesen | Zugeordnet |
| --- | --- | --- |
${misses.join('\n') || '| – | – | – |'}
`;
  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'm3-nummern.md'), report);
  console.log('Bericht: docs/m3-nummern.md');
}

await main();
