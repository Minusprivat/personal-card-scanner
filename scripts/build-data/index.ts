import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogSource } from '../../src/data/model';
import { MIN_MAIN_COVERAGE_PCT, renderReport, renderUnpricedList } from './report';
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

const [command, ...flags] = process.argv.slice(2);
if (command === 'report') {
  await report(flags.includes('--offline'));
} else {
  console.error('Aufruf: tsx scripts/build-data/index.ts report [--offline]');
  process.exitCode = 1;
}
