import { describe, expect, it } from 'vitest';
import { parsePriceGuide } from '../scripts/build-data/sources/cardmarket';
import { parseOpenRiftCatalog, parseOpenRiftLinks } from '../scripts/build-data/sources/openrift';
import { computeStats, pct } from '../scripts/build-data/stats';
import { renderReport, renderUnpricedList } from '../scripts/build-data/report';
import { cardmarketEnglishUrl, lookupPrice, priceFromRow } from '../src/data/prices';
import { groupPrints, variantLabel } from '../src/data/prints';
import { rawCatalog, rawLinks, rawPriceGuide, sku } from './fixtures';

describe('groupPrints', () => {
  it('fasst Normal und Foil desselben Drucks zusammen, Normal zuerst', () => {
    const prints = groupPrints([sku({ finish: 'foil' }), sku({ finish: 'normal' })]);
    expect(prints).toHaveLength(1);
    expect(prints[0]!.skus.map((s) => s.finish)).toEqual(['normal', 'foil']);
  });

  it('trennt Alt-Art, Stempel, Signatur und Übergröße in eigene Drucke', () => {
    const prints = groupPrints([
      sku(),
      sku({ artVariant: 'altart', publicCode: 'OGN-142a/298' }),
      sku({ markers: ['promo'] }),
      sku({ isSigned: true }),
      sku({ size: 'oversized' }),
    ]);
    expect(prints).toHaveLength(5);
  });

  it('gruppiert unabhängig vom Vertriebsweg, solange kein Finish doppelt vorkommt', () => {
    const prints = groupPrints([sku({ channels: ['booster'] }), sku({ finish: 'foil', channels: ['bundle'] })]);
    expect(prints).toHaveLength(1);
  });

  it('teilt sonst gleiche Drucke nach Kommentar, wenn ein Finish doppelt vorkäme', () => {
    const prints = groupPrints([
      sku({ comment: 'Recruit v1' }),
      sku({ comment: 'Recruit v2' }),
      sku({ comment: 'Recruit v2', finish: 'foil' }),
    ]);
    expect(prints.map((p) => p.skus.length).sort()).toEqual([1, 2]);
    expect(new Set(prints.map((p) => p.key)).size).toBe(2);
  });

  it('macht nicht unterscheidbare Exemplare zu eigenen Drucken, statt eines zu verlieren', () => {
    const prints = groupPrints([sku(), sku()]);
    expect(prints).toHaveLength(2);
    expect(prints.flatMap((p) => p.skus)).toHaveLength(2);
  });
});

describe('variantLabel', () => {
  it('beschreibt die Fassung auf Deutsch', () => {
    expect(variantLabel(sku())).toBe('Standard');
    expect(variantLabel(sku({ artVariant: 'altart', isOvernumbered: true, markers: ['promo'] }))).toBe(
      'Alt-Art, Overnumbered, Stempel: promo',
    );
  });
});

describe('Preise', () => {
  const guide = parsePriceGuide(rawPriceGuide);
  const row = guide.rows.get(100)!;

  it('liest die Preisdatei samt Foil-Feldern', () => {
    expect(guide.createdAt).toBe('2026-11-13T02:44:34+0100');
    expect(row).toMatchObject({ low: 0.2, trend: 0.6, lowFoil: 1.5, trendFoil: 2.1 });
  });

  it('nimmt low für Normal und low-foil für Foil', () => {
    expect(priceFromRow('normal', row)).toEqual({ low: 0.2, trend: 0.6, hasSales: true });
    expect(priceFromRow('foil', row)).toEqual({ low: 1.5, trend: 2.1, hasSales: true });
  });

  it('gibt für Metal keinen Preis, auch wenn das Produkt einen hat', () => {
    expect(priceFromRow('metal', row)).toBeNull();
    expect(priceFromRow('metal-deluxe', row)).toBeNull();
  });

  it('meldet „kein Preis“ statt 0 €', () => {
    expect(priceFromRow('normal', { ...row, low: 0 })).toBeNull();
    expect(priceFromRow('normal', { ...row, low: null })).toBeNull();
  });

  it('kennzeichnet Preise ohne belegten Verkauf', () => {
    expect(priceFromRow('normal', { ...row, trend: null, avg: null })).toMatchObject({ low: 0.2, hasSales: false });
  });

  it('nennt den Grund, wenn kein Preis vorliegt', () => {
    expect(lookupPrice('normal', undefined, guide)).toEqual({ price: null, reason: 'kein Cardmarket-Produkt' });
    expect(lookupPrice('normal', { productId: 999, url: '' }, guide)).toEqual({
      price: null,
      reason: 'Produkt fehlt in der Preisdatei',
    });
    expect(lookupPrice('foil', { productId: 101, url: '' }, guide)).toEqual({ price: null, reason: 'kein Low-Preis' });
  });

  it('baut den Cardmarket-Link mit Englisch-Filter', () => {
    expect(cardmarketEnglishUrl(847523)).toBe(
      'https://www.cardmarket.com/en/Riftbound/Products?idProduct=847523&language=1',
    );
  });
});

describe('OpenRift-Quelle', () => {
  const catalog = parseOpenRiftCatalog(rawCatalog, '2026-11-14T08:00:00.000Z');

  it('liest Sets, Karten und Einträge', () => {
    expect(catalog.sets.map((s) => [s.code, s.type, s.releasedAt])).toEqual([
      ['OGN', 'main', '2025-10-31'],
      ['SGN', 'supplemental', null],
    ]);
    expect(catalog.cards).toHaveLength(2);
    expect(catalog.skus).toHaveLength(5);
  });

  it('übernimmt die Variantenfelder', () => {
    const alt = catalog.skus.find((s) => s.id === 'p-alt')!;
    expect(alt).toMatchObject({ artVariant: 'altart', finish: 'foil', imageId: 'img-alt', publicCode: 'OGN-142a/298' });
    const metal = catalog.skus.find((s) => s.id === 'p-metal')!;
    expect(metal).toMatchObject({ finish: 'metal', markers: ['promo'] });
  });

  it('kommt mit fehlendem Bild und fehlendem aufgedruckten Namen zurecht', () => {
    const token = catalog.skus.find((s) => s.id === 'p-token')!;
    expect(token).toMatchObject({ imageId: null, printedName: 'Buff', channels: ['bundle'] });
  });

  it('bricht bei unbekanntem Finish oder fremdem Aufbau mit klarer Meldung ab', () => {
    const broken = structuredClone(rawCatalog) as { printings: Record<string, { finish: string }> };
    broken.printings['p-normal']!.finish = 'hologramm';
    expect(() => parseOpenRiftCatalog(broken, '')).toThrow(/unbekanntes Finish "hologramm"/);
    expect(() => parseOpenRiftCatalog({ sets: [] }, '')).toThrow(/"cards"/);
  });

  it('lässt Verknüpfungen ohne Cardmarket-Produkt weg', () => {
    const links = parseOpenRiftLinks(rawLinks);
    expect([...links.keys()].sort()).toEqual(['p-alt', 'p-foil', 'p-normal']);
    expect(links.get('p-normal')).toEqual({
      productId: 100,
      url: 'https://www.cardmarket.com/en/Riftbound/Products?idProduct=100&language=1',
    });
  });
});

describe('Auswertung und Bericht', () => {
  const catalog = parseOpenRiftCatalog(rawCatalog, '2026-11-14T08:00:00.000Z');
  const stats = computeStats(catalog, parseOpenRiftLinks(rawLinks), parsePriceGuide(rawPriceGuide));

  it('zählt Drucke je Set und Finish', () => {
    expect(stats.prints).toBe(4);
    const ogn = stats.bySet.find((s) => s.code === 'OGN')!;
    expect(ogn).toMatchObject({ prints: 3, altArt: 1, withMarker: 1 });
    expect(ogn.skusByFinish).toEqual({ normal: 1, foil: 2, metal: 1, 'metal-deluxe': 0 });
    expect(stats.foilOnlyPrints).toBe(1);
  });

  it('misst die Preisabdeckung nur an Normal und Foil regulärer Sets', () => {
    // OGN: normal + foil haben einen Preis, Alt-Art-Foil nicht, Metal zählt nicht mit.
    expect(stats.coverageMain).toEqual({ eligible: 3, priced: 2 });
    expect(pct(stats.coverageMain)).toBeCloseTo(66.67, 1);
    // Der Token aus dem Zusatz-Set zählt nur in der Gesamtsicht.
    expect(stats.coverageAll).toEqual({ eligible: 4, priced: 2 });
    expect(stats.metalSkus).toBe(1);
  });

  it('listet jeden Eintrag ohne Preis namentlich mit Grund', () => {
    expect(stats.unpriced.map((u) => [u.code, u.name, u.finish, u.reason])).toEqual([
      ['OGN-142a/298', 'Annie, Fiery', 'foil', 'kein Low-Preis'],
      ['SGN-T04', 'Buff', 'normal', 'kein Cardmarket-Produkt'],
    ]);
    expect(stats.metalList).toHaveLength(1);
  });

  it('schreibt die Abnahmepunkte in den Bericht', () => {
    const report = renderReport(stats);
    expect(report).toContain('## Drucke je Set und Variante');
    expect(report).toContain('## Variantenfelder des Katalogs');
    expect(report).toContain('66,7 % (2 von 3)');
    expect(report).toContain('**nein**');
    const list = renderUnpricedList(stats);
    expect(list).toContain('| OGN | OGN-142a/298 | Annie, Fiery | Alt-Art | Foil | kein Low-Preis |');
    expect(list).toContain('## Metal und Metal Deluxe (1)');
  });
});
