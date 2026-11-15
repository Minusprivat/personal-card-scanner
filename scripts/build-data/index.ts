import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogSource } from '../../src/data/model';
import { buildPriceData, formatDay } from '../../src/data/prices';
import { MIN_MAIN_COVERAGE_PCT, renderPriceSamples, renderReport, renderUnpricedList } from './report';
import { loadPriceGuide } from './sources/cardmarket';
import { OpenRiftSource } from './sources/openrift';
import { computeStats, pct } from './stats';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE_DIR = path.join(ROOT, '.cache');

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

const [command, ...flags] = process.argv.slice(2);
const offline = flags.includes('--offline');
if (command === 'report') {
  await report(offline);
} else if (command === 'build') {
  await build(offline);
} else if (command === 'samples') {
  await samples(offline);
} else {
  console.error('Aufruf: tsx scripts/build-data/index.ts report|build|samples [--offline]');
  process.exitCode = 1;
}
