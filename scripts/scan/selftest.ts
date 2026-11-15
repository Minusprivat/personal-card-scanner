/**
 * Selbsttest der Erkennung ohne echte Fotos: verzerrt Katalogbilder so, wie es eine
 * Handykamera tut, und prüft, ob der Fingerabdruck sie trotzdem wiederfindet.
 *
 * Das ersetzt den Test mit echten Fotos nicht. Es zeigt nur, ob das Verfahren die
 * Karten grundsätzlich auseinanderhält und wo es empfindlich ist.
 *
 * Aufruf: npm run scan:selftest   (braucht die Bilder aus `npm run data:images`)
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type Sharp } from 'sharp';
import { decodeImage } from '../build-data/fingerprints';
import { parseOpenRiftCatalog } from '../build-data/sources/openrift';
import { fingerprint, FP_VERSION, toHex } from '../../src/scan/fingerprint';
import { loadFingerprints, matchCard } from '../../src/scan/matcher';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMAGE_DIR = path.join(ROOT, '.cache', 'images');
const SAMPLE = 300;
const GRAY = { r: 120, g: 120, b: 120 };

type Distortion = (img: Sharp, meta: { width: number; height: number }) => Sharp | Promise<Sharp>;

/** Heller, weicher Fleck wie eine Lichtspiegelung auf Folie oder Hülle. */
function glare(width: number, height: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="${width * 0.62}" cy="${height * 0.3}" rx="${width * 0.38}" ry="${height * 0.2}" fill="url(#g)"/>
    </svg>`,
  );
}

/** Zwischenschritt abschließen, damit die nächste Veränderung auf dem Ergebnis aufsetzt. */
const settle = async (img: Sharp) => sharp(await img.png().toBuffer());

const DISTORTIONS: Array<[name: string, fn: Distortion]> = [
  ['unverändert', (img) => img],
  ['stark verkleinert (120 px breit)', (img) => img.resize({ width: 120 })],
  ['dunkel', (img) => img.modulate({ brightness: 0.55 })],
  ['hell und flau', (img) => img.linear(0.65, 70)],
  ['unscharf', (img) => img.blur(2.5)],
  ['Farbstich (warmes Licht)', (img) => img.recomb([[1.15, 0, 0], [0, 1, 0], [0, 0, 0.75]])],
  [
    'Rand zu groß (Karte kleiner im Ausschnitt)',
    (img, m) =>
      img.extend({
        top: Math.round(m.height * 0.04),
        bottom: Math.round(m.height * 0.04),
        left: Math.round(m.width * 0.04),
        right: Math.round(m.width * 0.04),
        background: GRAY,
      }),
  ],
  [
    'Rand abgeschnitten',
    (img, m) =>
      img.extract({
        left: Math.round(m.width * 0.03),
        top: Math.round(m.height * 0.03),
        width: Math.round(m.width * 0.94),
        height: Math.round(m.height * 0.94),
      }),
  ],
  ['um 3° verdreht', (img) => img.rotate(3, { background: GRAY })],
  ['kopfüber', (img) => img.rotate(180)],
  ['Lichtspiegelung', (img, m) => img.composite([{ input: glare(m.width, m.height) }])],
  ['stark komprimiert', async (img) => sharp(await img.jpeg({ quality: 15 }).toBuffer())],
  [
    'alles zusammen (wie ein Handyfoto)',
    async (img, m) => {
      let s = await settle(img.composite([{ input: glare(m.width, m.height) }]).modulate({ brightness: 0.8 }));
      s = await settle(s.rotate(2, { background: GRAY }).blur(1.2));
      s = await settle(s.resize({ width: 180 }));
      return sharp(await s.jpeg({ quality: 45 }).toBuffer());
    },
  ],
];

const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(1).replace('.', ',')} %`;

async function main() {
  const catalog = parseOpenRiftCatalog(
    JSON.parse(await readFile(path.join(ROOT, '.cache', 'openrift-catalog.json'), 'utf8')),
    '',
  );
  // Motiv = Karte + Art-Variante; mehrere Drucke können dasselbe Motiv zeigen.
  const motifOf = new Map<string, string>();
  for (const s of catalog.skus) if (s.imageId) motifOf.set(s.imageId, `${s.cardId}|${s.artVariant}`);

  const files = (await readdir(IMAGE_DIR)).filter((f) => f.endsWith('.webp')).sort();
  if (files.length === 0) throw new Error('Keine Bilder unter .cache/images. Zuerst `npm run data:images` ausführen.');

  const buffers = new Map<string, Buffer>();
  const items: Record<string, string> = {};
  for (const f of files) {
    const id = f.replace(/\.webp$/, '');
    const buf = await readFile(path.join(IMAGE_DIR, f));
    buffers.set(id, buf);
    items[id] = toHex(fingerprint(await decodeImage(buf)));
  }
  const set = loadFingerprints({ version: FP_VERSION, items });

  const ids = [...buffers.keys()];
  const step = Math.max(1, Math.floor(ids.length / SAMPLE));
  const sample = ids.filter((_, i) => i % step === 0).slice(0, SAMPLE);

  const rows: string[] = [];
  for (const [name, distort] of DISTORTIONS) {
    let exact = 0;
    let motif = 0;
    let top3 = 0;
    let sumDistance = 0;
    for (const id of sample) {
      const buf = buffers.get(id)!;
      const meta = await sharp(buf).metadata();
      const out = await distort(sharp(buf), { width: meta.width, height: meta.height });
      const { matches } = matchCard(set, await decodeImage(await out.png().toBuffer()), 3);
      const best = matches[0]!;
      if (best.imageId === id) exact++;
      if (motifOf.get(best.imageId) === motifOf.get(id)) motif++;
      if (matches.some((m) => m.imageId === id)) top3++;
      sumDistance += matches.find((m) => m.imageId === id)?.distance ?? best.distance;
    }
    const n = sample.length;
    rows.push(`| ${name} | ${pct(exact, n)} | ${pct(motif, n)} | ${pct(top3, n)} | ${(sumDistance / n).toFixed(1).replace('.', ',')} |`);
    console.log(`${name}: genau ${pct(exact, n)}, Motiv ${pct(motif, n)}, unter den ersten drei ${pct(top3, n)}`);
  }

  const report = `# M3: Selbsttest der Erkennung mit verzerrten Katalogbildern

Erzeugt von \`npm run scan:selftest\`. ${sample.length} von ${ids.length} Katalogbildern, Fingerabdruck-Version ${FP_VERSION}.

Dieser Test nutzt keine echten Fotos. Er verzerrt Katalogbilder künstlich und prüft, ob der Fingerabdruck sie unter allen ${ids.length} Bildern wiederfindet. Das Finden und Entzerren der Karte im Kamerabild ist hier nicht enthalten.

| Verzerrung | richtiges Bild an erster Stelle | richtiges Motiv an erster Stelle | richtiges Bild unter den ersten drei | mittlerer Abstand (0–128) |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

„Richtiges Motiv“ zählt auch Treffer auf einen anderen Druck derselben Karte mit gleichem Bild (zum Beispiel mit Promo-Stempel). Solche Drucke trennt später die Kartennummer.
`;
  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'm3-selbsttest.md'), report);
  console.log('Bericht: docs/m3-selbsttest.md');
}

await main();
