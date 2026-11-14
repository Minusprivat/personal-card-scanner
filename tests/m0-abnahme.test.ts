import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_MAIN_COVERAGE_PCT } from '../scripts/build-data/report';
import { parsePriceGuide } from '../scripts/build-data/sources/cardmarket';
import { parseOpenRiftCatalog, parseOpenRiftLinks } from '../scripts/build-data/sources/openrift';
import { computeStats, pct } from '../scripts/build-data/stats';
import { FINISHES } from '../src/data/model';
import { groupPrints } from '../src/data/prints';

/**
 * Abnahme M0 gegen die echten, zuletzt geladenen Daten in `.cache/`.
 * Ohne Zwischenspeicher (frischer Checkout) werden die Tests übersprungen;
 * `npm run data:report` lädt die Daten.
 */
const cache = path.resolve(__dirname, '../.cache');
const file = (name: string) => path.join(cache, `${name}.json`);
const names = ['openrift-catalog', 'openrift-links', 'cardmarket-price-guide'];
const available = names.every((n) => existsSync(file(n)));
const read = (name: string) => JSON.parse(readFileSync(file(name), 'utf8')) as unknown;

describe.skipIf(!available)('M0-Abnahme mit echten Daten', () => {
  const catalog = available ? parseOpenRiftCatalog(read('openrift-catalog'), new Date().toISOString()) : null!;
  const links = available ? parseOpenRiftLinks(read('openrift-links')) : null!;
  const guide = available ? parsePriceGuide(read('cardmarket-price-guide')) : null!;
  const prints = available ? groupPrints(catalog.skus) : [];
  const stats = available ? computeStats(catalog, links, guide, prints) : null!;

  it('lädt einen plausiblen Katalog: nur Englisch, bekannte Finishes, reguläre Sets vorhanden', () => {
    expect(catalog.skus.length).toBeGreaterThan(2000);
    expect(new Set(catalog.skus.map((s) => s.language))).toEqual(new Set(['EN']));
    expect(catalog.skus.every((s) => (FINISHES as readonly string[]).includes(s.finish))).toBe(true);
    expect(stats.bySet.filter((s) => s.type === 'main').length).toBeGreaterThanOrEqual(5);
  });

  it('ordnet jeden Eintrag genau einem Druck zu, ohne doppeltes Finish', () => {
    expect(prints.flatMap((p) => p.skus)).toHaveLength(catalog.skus.length);
    expect(new Set(prints.map((p) => p.key)).size).toBe(prints.length);
    for (const p of prints) {
      expect(new Set(p.skus.map((s) => s.finish)).size, p.key).toBe(p.skus.length);
    }
  });

  it(`mindestens ${MIN_MAIN_COVERAGE_PCT} % der Normal- und Foil-Drucke regulärer Sets haben einen Preis`, () => {
    expect(pct(stats.coverageMain)).toBeGreaterThanOrEqual(MIN_MAIN_COVERAGE_PCT);
  });

  it('alle übrigen stehen namentlich in der Liste', () => {
    const eligible = stats.coverageAll.eligible;
    expect(stats.unpriced).toHaveLength(eligible - stats.coverageAll.priced);
    expect(stats.unpriced.every((u) => u.name.length > 0 && u.code.length > 0)).toBe(true);
    expect(stats.metalList).toHaveLength(stats.metalSkus);
  });

  it('bei reinen Foil-Drucken ist low-foil belegt und gleich low', () => {
    expect(stats.checks.foilOnlyProductsWithBothLows).toBeGreaterThan(0);
    expect(stats.checks.foilOnlyProductsLowEqualsLowFoil).toBe(stats.checks.foilOnlyProductsWithBothLows);
  });
});
