/**
 * Abnahmetest M3 mit echten Fotos unter `testdata/photos/`.
 *
 * Welche Karte ein Foto zeigt, steht in `testdata/photos/labels.json`
 * (Dateiname → aufgedruckte Nummer, z. B. "OGN-142/298"). Fehlt ein Eintrag, gilt der
 * Anfang des Dateinamens bis zum ersten Unterstrich, z. B. `OGN-142_foil_huelle.jpg`.
 * Geprüft wird dieselbe Kette wie in der App: Karte finden, Bildabgleich, Nummer lesen.
 *
 * Aufruf: npm run scan:photos   (braucht `npm run data:fingerprints`)
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildIndex } from '../../src/data/catalog-index';
import { decideByNumber, interpretMatches, isLandscape } from '../../src/scan/candidates';
import { extractStrip } from '../../src/scan/detect';
import { FP_VERSION } from '../../src/scan/fingerprint';
import { numberStrips, prepareStrip, STRIP_H } from '../../src/scan/number';
import { MATCHES_PER_FRAME } from '../../src/scan/protocol';
import { recognize } from '../../src/scan/recognize';
import { DEFAULT_TRACKER } from '../../src/scan/tracker';
import { loadTestData, pct, ROOT } from './common';
import { getCv, matFromImage } from './cv';
import { createOcr } from './ocr';

const PHOTO_DIR = path.join(ROOT, 'testdata', 'photos');
/** Zielwerte aus der SPEC. */
const TARGET_TOP1 = 95;
const TARGET_TOP3 = 99;

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9*]/g, '');

async function main() {
  const files = (await readdir(PHOTO_DIR).catch(() => [] as string[]))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (files.length === 0) {
    console.log('Keine Fotos unter testdata/photos/.');
    return;
  }
  const labels = JSON.parse(await readFile(path.join(PHOTO_DIR, 'labels.json'), 'utf8').catch(() => '{}')) as Record<string, string>;

  const cv = await getCv();
  const ocr = await createOcr();
  const data = await loadTestData();
  const index = buildIndex(data.catalog);

  /** Karte zu einer aufgedruckten Nummer; auch für Fassungen, die der Katalog (noch) nicht führt. */
  const cardOf = (code: string): string | null => {
    const exact = data.catalog.skus.find((s) => norm(s.publicCode) === norm(code) || norm(s.shortCode) === norm(code));
    if (exact) return exact.cardId;
    const base = code.split('/')[0]!.replace(/[a-z*]$/, '');
    return data.catalog.skus.find((s) => norm(s.shortCode) === norm(base))?.cardId ?? null;
  };

  const count = { card1: 0, card3: 0, print: 0, sureRight: 0, sureWrong: 0, unsure: 0, none: 0, numbers: 0, notInCatalog: 0 };
  let totalMs = 0;
  const rows: string[] = [];

  // Im Bericht stehen laufende Nummern statt der Dateinamen: Die Namen tragen die Aufnahmezeit,
  // und der Bericht liegt im öffentlichen Repository.
  for (const file of files) {
    const expected = labels[file] ?? file.split(/[_.]/)[0]!;
    const expectedCard = cardOf(expected);
    const printKnown = data.catalog.skus.some((s) => norm(s.publicCode) === norm(expected));
    if (!printKnown) count.notInCatalog++;

    const frame = await matFromImage(cv, path.join(PHOTO_DIR, file));
    const start = performance.now();
    const result = recognize(cv, frame, data.fingerprints, MATCHES_PER_FRAME);
    let hit = result && interpretMatches(result.matches, index);
    if (hit && hit.distance > DEFAULT_TRACKER.maxDistance) hit = null;
    let number = '';
    let confirmed = false;
    let sure = false;
    if (result && hit) {
      sure = hit.distance <= DEFAULT_TRACKER.sureDistance && hit.margin >= DEFAULT_TRACKER.minMargin;
      const strips = numberStrips(result.detection.corners, result.flipped, isLandscape(hit.prints[0]!, index));
      const outcome = await decideByNumber(hit, sure, index, strips, (strip) =>
        ocr.readLine(extractStrip(cv, frame, strip.quad, strip.width, STRIP_H, prepareStrip)),
      );
      if (outcome) {
        number = outcome.text;
        // Bestätigt die Nummer den Treffer, zählt die App; ein bloßer Vorschlag steht nur vorn in der Auswahl.
        if (outcome.confirmed || !sure) hit = outcome.hit;
        confirmed = outcome.confirmed;
        count.numbers++;
      }
    }
    const ms = performance.now() - start;
    totalMs += ms;
    frame.delete();

    // Was die App täte: sicher → zählt von selbst; unsicher → bietet Kandidaten an; sonst nichts.
    const counted = hit !== null && (sure || confirmed);
    const cardRight = hit !== null && hit.cardId === expectedCard;
    const top3Cards = hit ? [...new Set([hit.cardId, ...hit.others.map((p) => p.cardId)])].slice(0, 3) : [];
    const printRight = hit !== null && norm(hit.prints[0]!.skus[0]!.publicCode) === norm(expected);

    if (cardRight) count.card1++;
    if (expectedCard && top3Cards.includes(expectedCard)) count.card3++;
    if (printRight) count.print++;
    let verdict: string;
    if (!hit) {
      count.none++;
      verdict = 'nicht erkannt';
    } else if (counted) {
      if (cardRight) count.sureRight++;
      else count.sureWrong++;
      verdict = cardRight ? (printRight ? 'gezählt, richtig' : 'gezählt, richtige Karte, andere Fassung') : '**gezählt, falsche Karte**';
    } else {
      count.unsure++;
      verdict = cardRight ? 'Auswahl angeboten, richtige Karte vorn' : 'Auswahl angeboten, falsche Karte vorn';
    }
    const guess = hit
      ? `${hit.prints[0]!.skus[0]!.publicCode} (Abstand ${hit.distance}, Vorsprung ${hit.margin}${number ? `, gelesen „${number}“` : ''})`
      : '–';
    rows.push(`| ${rows.length + 1} | ${expected}${printKnown ? '' : ' (nicht im Katalog)'} | ${guess} | ${verdict} | ${ms.toFixed(0)} ms |`);
    console.log(`${file.replace(/^IMG_|_HDR|\.jpg$/gi, '')}: ${expected} → ${guess} → ${verdict}`);
  }
  await ocr.close();

  const n = files.length;
  const ok = (100 * count.card1) / n >= TARGET_TOP1 && (100 * count.card3) / n >= TARGET_TOP3 && count.sureWrong === 0;
  console.log(
    `\n${n} Fotos: richtige Karte vorn ${pct(count.card1, n)}, unter den ersten drei ${pct(count.card3, n)}, richtige Fassung ${pct(count.print, n)}; ` +
      `von selbst gezählt ${count.sureRight + count.sureWrong} (davon falsch ${count.sureWrong}), Auswahl ${count.unsure}, nicht erkannt ${count.none}; Nummer zugeordnet ${count.numbers}.`,
  );

  const report = `# M3: Erkennung auf echten Fotos

Erzeugt von \`npm run scan:photos\`. ${n} Fotos aus \`testdata/photos/\`, Fingerabdruck-Version ${FP_VERSION}.

| Kennzahl | Ergebnis | Ziel |
| --- | --- | --- |
| Richtige Karte an erster Stelle | ${pct(count.card1, n)} (${count.card1} von ${n}) | mindestens ${TARGET_TOP1} % |
| Richtige Karte unter den ersten drei | ${pct(count.card3, n)} (${count.card3} von ${n}) | mindestens ${TARGET_TOP3} % |
| Richtige Fassung an erster Stelle | ${pct(count.print, n)} (${count.print} von ${n}) | – |
| Von selbst gezählt, richtige Karte | ${count.sureRight} | – |
| Von selbst gezählt, falsche Karte | ${count.sureWrong} | 0 |
| Auswahl angeboten (unsicher) | ${count.unsure} | – |
| Nicht erkannt | ${count.none} | – |
| Kartennummer gelesen und zugeordnet | ${count.numbers} | – |
| Mittlere Dauer je Foto (Entwicklungs-PC) | ${(totalMs / n).toFixed(0)} ms | unter 1 s auf dem Handy |

Ziele ${ok ? 'erreicht' : '**nicht erreicht**'}.${count.notInCatalog ? ` ${count.notInCatalog} Foto(s) zeigen eine Fassung, die der Katalog nicht führt; dort zählt nur die richtige Karte.` : ''}

„Gezählt“ heißt: Die App hätte die Karte ohne Rückfrage in die Sitzung übernommen. „Auswahl angeboten“ heißt: Sie hätte Kandidaten zum Antippen gezeigt.

| Foto | Soll | Erkannt als | Ergebnis | Dauer |
| --- | --- | --- | --- | --- |
${rows.join('\n')}
`;
  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'm3-fotos.md'), report);
  console.log('Bericht: docs/m3-fotos.md');
  if (!ok) process.exitCode = 1;
}

await main();
