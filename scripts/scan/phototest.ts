/**
 * Abnahmetest M3 mit echten Fotos unter `testdata/photos/`.
 *
 * Der Dateiname beginnt mit der erwarteten Kartennummer, danach folgen beliebige
 * Angaben hinter einem Unterstrich, zum Beispiel `OGN-142_foil_huelle.jpg`.
 *
 * Aufruf: npm run scan:photos   (braucht `npm run data:fingerprints`)
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FP_VERSION } from '../../src/scan/fingerprint';
import { recognize } from '../../src/scan/recognize';
import { loadTestData, pct, ROOT } from './common';
import { getCv, matFromImage } from './cv';

const PHOTO_DIR = path.join(ROOT, 'testdata', 'photos');
/** Zielwerte aus der SPEC. */
const TARGET_TOP1 = 95;
const TARGET_TOP3 = 99;

const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9*]/g, '');

async function main() {
  const files = (await readdir(PHOTO_DIR).catch(() => [] as string[]))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (files.length === 0) {
    console.log('Keine Fotos unter testdata/photos/. Dateinamen nach dem Muster OGN-142_foil_huelle.jpg.');
    return;
  }

  const cv = await getCv();
  const data = await loadTestData();
  const codesOf = (imageId: string) =>
    (data.skusByImage.get(imageId) ?? []).map((s) => normalizeCode(s.shortCode));

  let notFound = 0;
  let top1 = 0;
  let top3 = 0;
  let unknown = 0;
  let totalMs = 0;
  const rows: string[] = [];

  for (const file of files) {
    const expected = normalizeCode(file.split(/[_.]/)[0]!);
    const known = data.catalog.skus.some((s) => normalizeCode(s.shortCode) === expected);
    if (!known) unknown++;

    const frame = await matFromImage(cv, path.join(PHOTO_DIR, file));
    const start = performance.now();
    const result = recognize(cv, frame, data.fingerprints, 3);
    const ms = performance.now() - start;
    totalMs += ms;
    frame.delete();

    let verdict: string;
    let guess = '–';
    if (!result) {
      notFound++;
      verdict = 'Karte nicht gefunden';
    } else {
      const ranks = result.matches.map((m) => codesOf(m.imageId));
      const best = data.skusByImage.get(result.matches[0]!.imageId)?.[0];
      guess = `${best?.publicCode ?? '?'} (Abstand ${result.matches[0]!.distance})`;
      if (ranks[0]!.includes(expected)) {
        top1++;
        top3++;
        verdict = 'richtig';
      } else if (ranks.some((r) => r.includes(expected))) {
        top3++;
        verdict = 'unter den ersten drei';
      } else verdict = 'falsch';
    }
    if (!known) verdict += ' (Nummer im Dateinamen steht nicht im Katalog)';
    rows.push(`| ${file} | ${guess} | ${verdict} | ${ms.toFixed(0)} ms |`);
    console.log(`${file}: ${verdict}${result ? `, erkannt als ${guess}` : ''}`);
  }

  const n = files.length;
  const ok = (100 * top1) / n >= TARGET_TOP1 && (100 * top3) / n >= TARGET_TOP3;
  console.log(`\n${n} Fotos: an erster Stelle richtig ${pct(top1, n)}, unter den ersten drei ${pct(top3, n)}, nicht gefunden ${notFound}.`);

  const report = `# M3: Erkennung auf echten Fotos

Erzeugt von \`npm run scan:photos\`. ${n} Fotos aus \`testdata/photos/\`, Fingerabdruck-Version ${FP_VERSION}.

| Kennzahl | Ergebnis | Ziel |
| --- | --- | --- |
| Richtiger Druck an erster Stelle | ${pct(top1, n)} (${top1} von ${n}) | mindestens ${TARGET_TOP1} % |
| Richtiger Druck unter den ersten drei | ${pct(top3, n)} (${top3} von ${n}) | mindestens ${TARGET_TOP3} % |
| Karte im Bild nicht gefunden | ${notFound} | – |
| Mittlere Dauer je Foto (Entwicklungs-PC) | ${(totalMs / n).toFixed(0)} ms | unter 1 s auf dem Handy |

Ziele ${ok ? 'erreicht' : '**nicht erreicht**'}.${unknown ? ` ${unknown} Dateinamen nennen eine Nummer, die nicht im Katalog steht.` : ''}

Als richtig gilt ein Treffer, wenn das erkannte Bild zu einem Druck mit der Nummer aus dem Dateinamen gehört. Drucke mit gleicher Nummer und gleichem Bild (Normal und Foil) unterscheidet dieser Test nicht.

| Foto | Erkannt als | Ergebnis | Dauer |
| --- | --- | --- | --- |
${rows.join('\n')}
`;
  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'm3-fotos.md'), report);
  console.log('Bericht: docs/m3-fotos.md');
  if (!ok) process.exitCode = 1;
}

await main();
