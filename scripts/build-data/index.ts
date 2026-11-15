import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogSource } from '../../src/data/model';
import { buildPriceData, formatDay } from '../../src/data/prices';
import { existsSync } from 'node:fs';
import { readFingerprintFile, updateFingerprints, writeFingerprintFile } from './fingerprints';
import { createImageLoader } from './images';
import { MIN_MAIN_COVERAGE_PCT, renderPriceSamples, renderReport, renderUnpricedList } from './report';
import { loadPriceGuide } from './sources/cardmarket';
import { OpenRiftSource } from './sources/openrift';
import { computeStats, pct } from './stats';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE_DIR = path.join(ROOT, '.cache');
/** Kartenbilder für die Entwicklung; liegt unter .cache/ und kommt nie ins Repository. */
export const IMAGE_DIR = path.join(CACHE_DIR, 'images');
/** Fingerabdrücke aller Katalogbilder; liegt im Repository, damit nur neue Bilder abgerufen werden. */
export const FINGERPRINT_FILE = path.join(ROOT, 'data', 'fingerprints.json');
const REMEMBERED_FINGERPRINTS = path.join(CACHE_DIR, 'fingerprints.json');

async function report(offline: boolean) {
  const opts = { cacheDir: CACHE_DIR, offline };
  // Einzige Stelle, an der die Katalogquelle festgelegt wird.
  const source: CatalogSource = new OpenRiftSource(opts);

  const catalog = await source.loadCatalog();
  const links = await source.loadCardmarketLinks();
  const guide = await loadPriceGuide(opts);
  const stats = computeStats(catalog, links, guide);

  const docs = path.join(ROOT, 'docs');
  await mkdir(docs, { recursive: true });
  await writeFile(path.join(docs, 'm0-bericht.md'), renderReport(stats));
  await writeFile(path.join(docs, 'm0-ohne-preis.md'), renderUnpricedList(stats));

  const share = pct(stats.coverageMain);
  console.log(`${stats.prints} Drucke, ${stats.skus} Druck-Finish-Kombinationen aus ${source.name}.`);
  console.log(
    `Preisabdeckung reguläre Sets (Normal + Foil): ${share.toFixed(1)} % (${stats.coverageMain.priced}/${stats.coverageMain.eligible}).`,
  );
  console.log('Bericht: docs/m0-bericht.md, Liste ohne Preis: docs/m0-ohne-preis.md');
  if (share < MIN_MAIN_COVERAGE_PCT) {
    console.error(`Abnahme verfehlt: weniger als ${MIN_MAIN_COVERAGE_PCT} %.`);
    process.exitCode = 1;
  }
}

/** Schreibt die Tagesdaten, die die App beim Start lädt. */
async function build(offline: boolean) {
  const source: CatalogSource = new OpenRiftSource({ cacheDir: CACHE_DIR, offline });
  const catalog = await source.loadCatalog();
  // Sets ohne englische Karten braucht die App nicht.
  const used = new Set(catalog.skus.map((s) => s.setId));
  const data = { ...catalog, sets: catalog.sets.filter((s) => used.has(s.id)) };

  const dir = path.join(ROOT, 'public', 'data');
  await mkdir(dir, { recursive: true });
  const json = JSON.stringify(data);
  await writeFile(path.join(dir, 'catalog.json'), json);
  console.log(`public/data/catalog.json: ${data.skus.length} Einträge, ${(json.length / 1024).toFixed(0)} KB.`);

  const links = await source.loadCardmarketLinks();
  const guide = await loadPriceGuide({ cacheDir: CACHE_DIR, offline });
  const prices = buildPriceData(catalog.skus, links, guide);
  const pricesJson = JSON.stringify(prices);
  await writeFile(path.join(dir, 'prices.json'), pricesJson);
  const withLow = Object.values(prices.entries).filter((e) => e.low !== null).length;
  console.log(
    `public/data/prices.json: ${withLow} Preise, Stand ${formatDay(prices.createdAt)}, ${(pricesJson.length / 1024).toFixed(0)} KB.`,
  );
}

/** Schreibt die Stichproben-Liste für die Abnahme von M2. */
async function samples(offline: boolean) {
  const opts = { cacheDir: CACHE_DIR, offline };
  const source: CatalogSource = new OpenRiftSource(opts);
  const catalog = await source.loadCatalog();
  const prices = buildPriceData(catalog.skus, await source.loadCardmarketLinks(), await loadPriceGuide(opts));
  const docs = path.join(ROOT, 'docs');
  await mkdir(docs, { recursive: true });
  await writeFile(path.join(docs, 'm2-stichproben.md'), renderPriceSamples(catalog, prices));
  console.log(`docs/m2-stichproben.md geschrieben, Preisstand ${formatDay(prices.createdAt)}.`);
}

/**
 * Berechnet Fingerabdrücke für neue Katalogbilder und schreibt sie nach `data/fingerprints.json`
 * (im Repository) und `public/data/fingerprints.json` (für die App). Bilder, deren
 * Fingerabdruck schon vorliegt, werden nicht erneut abgerufen.
 */
async function fingerprints(offline: boolean) {
  const source: CatalogSource = new OpenRiftSource({ cacheDir: CACHE_DIR, offline });
  const catalog = await source.loadCatalog();
  const known = await readFingerprintFile(FINGERPRINT_FILE);
  // GitHub Actions merkt sich Fingerabdrücke neuer Bilder hier, bis sie ins Repository kommen.
  // So ruft der tägliche Lauf jedes Bild nur ein einziges Mal ab.
  const remembered = await readFingerprintFile(REMEMBERED_FINGERPRINTS);
  known.items = { ...remembered.items, ...known.items };
  // Liegen die Bilder aus der Entwicklung lokal vor, werden sie genutzt statt neu geladen.
  const loader = createImageLoader(catalog, existsSync(IMAGE_DIR) ? IMAGE_DIR : undefined);
  const run = await updateFingerprints(catalog, known, loader, (done, total) => {
    if (done % 200 === 0 || done === total) console.log(`Fingerabdrücke: ${done} von ${total}`);
  });
  if (run.added || run.removed) await writeFingerprintFile(FINGERPRINT_FILE, run.file);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFingerprintFile(REMEMBERED_FINGERPRINTS, run.file);

  const dir = path.join(ROOT, 'public', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'fingerprints.json'), JSON.stringify(run.file));
  console.log(
    `data/fingerprints.json: ${Object.keys(run.file.items).length} Bilder, ${run.added} neu, ${run.removed} entfernt, ${loader.fetched} Bilder abgerufen.`,
  );
}

/** Entwicklung: lädt alle Kartenbilder einmal in den lokalen Zwischenspeicher. */
async function images(offline: boolean) {
  const source: CatalogSource = new OpenRiftSource({ cacheDir: CACHE_DIR, offline });
  const catalog = await source.loadCatalog();
  const ids = [...new Set(catalog.skus.map((s) => s.imageId).filter((id): id is string => id !== null))];
  const loader = createImageLoader(catalog, IMAGE_DIR);
  let done = 0;
  for (const id of ids) {
    await loader.load(id);
    if (++done % 200 === 0) console.log(`${done} von ${ids.length} Bildern (${loader.fetched} neu geladen)`);
  }
  console.log(`Fertig: ${ids.length} Bilder, davon ${loader.fetched} neu geladen.`);
}

const [command, ...flags] = process.argv.slice(2);
const offline = flags.includes('--offline');
if (command === 'report') {
  await report(offline);
} else if (command === 'build') {
  await build(offline);
} else if (command === 'samples') {
  await samples(offline);
} else if (command === 'images') {
  await images(offline);
} else if (command === 'fingerprints') {
  await fingerprints(offline);
} else {
  console.error('Aufruf: tsx scripts/build-data/index.ts report|build|samples [--offline]');
  process.exitCode = 1;
}
