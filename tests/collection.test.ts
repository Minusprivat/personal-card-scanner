import 'fake-indexeddb/auto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOpenRiftCatalog } from '../scripts/build-data/sources/openrift';
import { CollectionDb } from '../src/app/db';
import {
  createBackup,
  emptyCollection,
  exportCollectionCsv,
  importCollectionCsv,
  parseBackup,
} from '../src/data/backup';
import { buildIndex } from '../src/data/catalog-index';
import { parseCsv, toCsv } from '../src/data/csv';
import { filterPrints, NO_FILTERS } from '../src/data/filter';
import type { Catalog } from '../src/data/model';
import {
  derivePiltoverTemplate,
  exportPiltover,
  importPiltover,
  PILTOVER_HEADER,
} from '../src/data/piltover';
import { sku } from './fixtures';

/** Kleiner Katalog mit den Sonderfällen, die Import und Filter unterscheiden müssen. */
const catalog: Catalog = {
  source: 'Test',
  fetchedAt: '2026-11-14T00:00:00.000Z',
  images: { template: 'https://example.test/{id}-{size}.webp', thumb: 's', detail: 'm', full: 'l' },
  sets: [
    { id: 'set-ogn', code: 'OGN', name: 'Origins', type: 'main', releasedAt: '2025-10-31' },
    { id: 'set-sfd', code: 'SFD', name: 'Spiritforged', type: 'main', releasedAt: '2026-02-13' },
  ],
  cards: [
    card('c-scorcher', 'Blazing Scorcher', ['fury']),
    card('c-darius', 'Darius, Trifarian', ['fury']),
    card('c-teemo', 'Teemo, Strategist', ['mind']),
    card('c-camp', 'Trifarian War Camp', []),
    card('c-kaisa', 'Kai’Sa, Survivor', ['fury']),
    card('c-buff', 'Buff', []),
  ],
  skus: [
    sku({ id: 'scorcher-n', cardId: 'c-scorcher', shortCode: 'OGN-001', publicCode: 'OGN-001/298', rarity: 'common' }),
    sku({ id: 'scorcher-f', cardId: 'c-scorcher', shortCode: 'OGN-001', publicCode: 'OGN-001/298', rarity: 'common', finish: 'foil' }),
    sku({
      id: 'scorcher-nexus',
      cardId: 'c-scorcher',
      shortCode: 'OGN-001',
      publicCode: 'OGN-001/298',
      rarity: 'common',
      finish: 'foil',
      markers: ['promo'],
      channels: ['nexus-ogn'],
    }),
    sku({ id: 'darius-f', cardId: 'c-darius', shortCode: 'OGN-027', publicCode: 'OGN-027/298', finish: 'foil' }),
    sku({ id: 'darius-release', cardId: 'c-darius', shortCode: 'OGN-027', publicCode: 'OGN-027/298', finish: 'foil', markers: ['promo'], channels: ['release-ogn'] }),
    sku({ id: 'darius-metal', cardId: 'c-darius', shortCode: 'OGN-027', publicCode: 'OGN-027/298', finish: 'metal', markers: ['promo'] }),
    sku({ id: 'teemo-alt', cardId: 'c-teemo', shortCode: 'OGN-121a', publicCode: 'OGN-121a/298', finish: 'foil', artVariant: 'altart' }),
    sku({ id: 'teemo-on', cardId: 'c-teemo', setId: 'set-sfd', shortCode: 'SFD-230', publicCode: 'SFD-230/221', finish: 'foil', isOvernumbered: true }),
    sku({ id: 'teemo-signed', cardId: 'c-teemo', setId: 'set-sfd', shortCode: 'SFD-230*', publicCode: 'SFD-230*/221', finish: 'foil', isOvernumbered: true, isSigned: true }),
    sku({ id: 'camp', cardId: 'c-camp', shortCode: 'OGN-294', publicCode: 'OGN-294/298' }),
    sku({ id: 'camp-big', cardId: 'c-camp', shortCode: 'OGN-294', publicCode: 'OGN-294/298', size: 'oversized' }),
    sku({ id: 'kaisa', cardId: 'c-kaisa', shortCode: 'OGN-039', publicCode: 'OGN-039/298', finish: 'foil' }),
    sku({ id: 'buff-v2', cardId: 'c-buff', shortCode: 'OGN', publicCode: 'OGN', rarity: 'common', comment: 'Also called "Recruit (ZH)" or "Recruit v2".' }),
  ],
};

function card(id: string, name: string, domains: string[]) {
  return { id, slug: id, name, types: ['unit'], superTypes: [], domains, energy: 1, might: 1, power: null, keywords: [], tags: [] };
}

const index = buildIndex(catalog);

const paFile = (lines: string[]) => [PILTOVER_HEADER.join(','), ...lines].join('\r\n') + '\r\n';
const SAMPLE = paFile([
  'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,1,English,Near Mint,,,,',
  'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,2,English,Near Mint,,,,',
  'OGN-001-Foil,Blazing Scorcher,Origins,OGN,Common,Standard,Foil,true,1,English,Near Mint,,,,',
  'OGN-001-Nexus,Blazing Scorcher,Origins | Nexus Night,OGN-NN,Common,Promo,Nexus Night Promo,true,2,English,Near Mint,,,,',
  'OGN-027,"Darius, Trifarian",Origins,OGN,Rare,Standard,Standard,true,3,English,Near Mint,,,,',
  'OGN-121a,"Teemo, Strategist",Origins,OGN,Rare,Alt Art,Alt Art,true,1,English,Near Mint,,,,',
  'SFD-230*,"Teemo, Strategist",Spiritforged,SFD,Showcase,Overnumbered,Overnumbered Signed,true,1,English,Near Mint,,,,',
  'OGN-294,Trifarian War Camp,Origins,OGN,Uncommon,Standard,Standard,false,1,English,Damaged,,,,',
  'OGN-271,Recruit v2,Origins,OGN,Common,Standard,Standard,false,2,English,Near Mint,,,,',
  'OGN-274,Sprite,Origins,OGN,Common,Standard,Standard,false,4,English,Near Mint,,,,',
  'OGN-027-Worlds,"Darius, Trifarian",Worlds Bundle 2025,WRLD25,Showcase,Promo,Worlds 2025 Bundle,true,1,English,Near Mint,,,,',
  'OGN-039,"Kai\'Sa, Survivor",Origins,OGN,Rare,Standard,Standard,true,1,French,Near Mint,,,,',
]);

describe('CSV', () => {
  it('liest und schreibt Felder mit Komma, Anführungszeichen und Zeilenumbruch verlustfrei', () => {
    const rows = [
      ['a', 'b'],
      ['Darius, Trifarian', 'sagt "Noxus"'],
      ['zwei\nZeilen', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('ignoriert BOM und Leerzeilen am Ende', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('Suche und Filter', () => {
  const owned = new Map([['scorcher-f', 2]]);
  const ownedQty = (p: { skus: Array<{ id: string }> }) => p.skus.reduce((n, s) => n + (owned.get(s.id) ?? 0), 0);
  const find = (f: Partial<typeof NO_FILTERS>) =>
    filterPrints(index, { ...NO_FILTERS, ...f }, ownedQty).map((p) => p.skus[0]!.id);

  it('findet nach Name, auch mit Teilwörtern und ohne Satzzeichen', () => {
    // Die Metal-Fassung gehört zum selben Druck wie die Promo-Foil-Fassung.
    expect(find({ query: 'darius trif' })).toEqual(['darius-f', 'darius-release']);
    expect(find({ query: 'kaisa' })).toEqual(['kaisa']);
  });

  it('findet nach Kartennummer in mehreren Schreibweisen', () => {
    expect(find({ query: 'OGN-121a' })).toEqual(['teemo-alt']);
    expect(find({ query: 'ogn 294' })).toEqual(['camp', 'camp-big']);
    expect(find({ query: '230*' })).toEqual(['teemo-signed']);
  });

  it('filtert nach Set, Variante und Farbe', () => {
    expect(find({ setId: 'set-sfd' })).toEqual(['teemo-on', 'teemo-signed']);
    expect(find({ variant: 'altart' })).toEqual(['teemo-alt']);
    expect(find({ variant: 'signed' })).toEqual(['teemo-signed']);
    expect(find({ variant: 'stamp' })).toEqual(['scorcher-nexus', 'darius-release']);
    expect(find({ variant: 'metal' })).toEqual(['darius-release']);
    expect(find({ domain: 'mind' })).toEqual(['teemo-alt', 'teemo-on', 'teemo-signed']);
  });

  it('filtert nach „besitze ich“ und „fehlt“ auf Ebene des Drucks', () => {
    expect(find({ owned: 'owned' })).toEqual(['scorcher-n']);
    expect(find({ owned: 'missing' })).not.toContain('scorcher-n');
    expect(find({ owned: 'missing' })).toHaveLength(index.prints.length - 1);
  });
});

describe('Piltover Archive', () => {
  const result = importPiltover(SAMPLE, index);

  it('summiert mehrere Zeilen derselben Fassung und trennt Normal von Foil', () => {
    expect(result.stock.get('scorcher-n')).toBe(3);
    expect(result.stock.get('scorcher-f')).toBe(1);
  });

  it('ordnet Promos über Stempel und Vertriebsweg zu', () => {
    expect(result.stock.get('scorcher-nexus')).toBe(2);
    expect(result.stock.get('darius-f')).toBe(3);
  });

  it('erkennt Alt-Art und signierte Overnumbered an der Nummer', () => {
    expect(result.stock.get('teemo-alt')).toBe(1);
    expect(result.stock.get('teemo-signed')).toBe(1);
    expect(result.stock.has('teemo-on')).toBe(false);
  });

  it('zieht bei gleicher Nummer die normale Kartengröße der Übergröße vor', () => {
    expect(result.stock.get('camp')).toBe(1);
    expect(result.stock.has('camp-big')).toBe(false);
  });

  it('findet Tokens ohne Katalognummer über den Namen und kennzeichnet das als unsicher', () => {
    expect(result.stock.get('buff-v2')).toBe(2);
    expect(result.uncertain.map((u) => [u.row.variantNumber, u.sku.id])).toContainEqual(['OGN-271', 'buff-v2']);
  });

  it('kennzeichnet Promos, deren Vertriebsweg der Katalog nicht kennt, als unsicher', () => {
    expect(result.stock.get('darius-release')).toBe(1);
    expect(result.uncertain.map((u) => u.row.variantNumber)).toContain('OGN-027-Worlds');
  });

  it('lässt nichts stillschweigend fallen: unbekannte Karten und fremde Sprachen stehen in der Liste', () => {
    expect(result.unmatched.map((u) => [u.row.variantNumber, u.row.quantity])).toEqual([
      ['OGN-274', 4],
      ['OGN-039', 1],
    ]);
    expect(result.unmatched[1]!.reason).toMatch(/Sprache/);
    expect(result.matchedQty + 5).toBe(result.totalQty);
    expect(result.totalQty).toBe(20);
  });

  it('schreibt beim Export die Originalfelder zurück und nimmt nicht zugeordnete Zeilen wieder mit', () => {
    const out = exportPiltover(
      result.stock,
      index,
      result.templates,
      result.unmatched.map((u) => u.row),
    );
    expect(out.totalQty).toBe(20);
    expect(out.derived).toEqual([]);
    expect(out.csv).toContain('OGN-001-Foil,Blazing Scorcher,Origins,OGN,Common,Standard,Foil,true,1,English,Near Mint');
    expect(out.csv).toContain('OGN-274,Sprite,Origins,OGN,Common,Standard,Standard,false,4,English,Near Mint');
    expect(out.csv).toContain('"Kai\'Sa, Survivor",Origins,OGN,Rare,Standard,Standard,true,1,French');

    const again = importPiltover(out.csv, index);
    expect(again.stock).toEqual(result.stock);
    expect(again.unmatched).toHaveLength(2);
  });

  it('schätzt die Felder für Fassungen, die nie importiert wurden', () => {
    const t = (id: string) => derivePiltoverTemplate(index.skuById.get(id)!, index);
    expect(t('scorcher-f')).toMatchObject({ variantNumber: 'OGN-001', foil: true, variantType: 'Standard', rarity: 'Common' });
    expect(t('scorcher-nexus')).toMatchObject({
      variantNumber: 'OGN-001-Nexus',
      set: 'Origins | Nexus Night',
      setPrefix: 'OGN-NN',
      variantType: 'Promo',
    });
    expect(t('teemo-signed')).toMatchObject({ variantNumber: 'SFD-230*', variantLabel: 'Overnumbered Signed' });
    expect(t('kaisa')!.cardName).toBe("Kai'Sa, Survivor");
    expect(t('darius-metal')).toBeNull();
  });

  it('meldet beim Export geschätzte Zeilen und lässt Metal aus', () => {
    const out = exportPiltover(new Map([['scorcher-f', 2], ['darius-metal', 1], ['fremd', 3]]), index, new Map());
    expect(out.rows).toBe(1);
    expect(out.derived.map((s) => s.id)).toEqual(['scorcher-f']);
    expect(out.skipped.map((s) => [s.skuId, s.qty])).toEqual([
      ['darius-metal', 1],
      ['fremd', 3],
    ]);
    // Geschätzte Zeilen müssen sich wieder derselben Fassung zuordnen lassen.
    expect(importPiltover(out.csv, index).stock).toEqual(new Map([['scorcher-f', 2]]));
  });

  it('weist Dateien mit falschem Aufbau verständlich zurück', () => {
    expect(() => importPiltover('Name,Anzahl\r\nDarius,1\r\n', index)).toThrow(/Spalten fehlen: Variant Number/);
  });
});

describe('Sicherung und Tabelle', () => {
  const state = emptyCollection();
  state.stock.set('scorcher-n', 3).set('darius-metal', 1).set('nicht-im-katalog', 2);
  state.templates.set('scorcher-n', importPiltover(SAMPLE, index).templates.get('scorcher-n')!);
  state.extraRows = importPiltover(SAMPLE, index).unmatched.map((u) => u.row);

  it('stellt aus der JSON-Sicherung alles wieder her, auch Fassungen außerhalb des Katalogs', () => {
    const restored = parseBackup(createBackup(state, index, '2026-11-14T10:00:00.000Z'));
    expect(restored).toEqual(state);
  });

  it('weist fremde Dateien zurück', () => {
    expect(() => parseBackup('kein json')).toThrow(/keine gültige JSON-Datei/);
    expect(() => parseBackup('{"stock":[]}')).toThrow(/keine Sicherung dieser App/);
  });

  it('liest die eigene Tabelle wieder ein, mit und ohne ID-Spalte', () => {
    const stock = new Map([['scorcher-f', 2], ['darius-metal', 1], ['camp-big', 1]]);
    const csv = exportCollectionCsv(stock, index);
    expect(csv).toContain('OGN-027/298,"Darius, Trifarian",OGN,Stempel: promo,Metal,1,darius-metal');
    expect(importCollectionCsv(csv, index).stock).toEqual(stock);

    const withoutIds = toCsv(parseCsv(csv).map((r) => r.slice(0, 6)));
    const result = importCollectionCsv(withoutIds, index);
    expect(result.stock).toEqual(stock);
    expect(result.unknownLines).toEqual([]);
  });
});

describe('Bestand auf dem Gerät', () => {
  let n = 0;
  const fresh = () => new CollectionDb(`test-${++n}`);

  it('zählt alle vier Finishes je Druck getrennt und fällt nie unter null', async () => {
    const db = fresh();
    await db.changeQty('darius-f', 1);
    await db.changeQty('darius-f', 1);
    await db.changeQty('darius-metal', 1);
    await db.changeQty('darius-release', -1);
    const { stock } = await db.readCollection();
    expect(stock).toEqual(new Map([['darius-f', 2], ['darius-metal', 1]]));
    await db.changeQty('darius-metal', -5);
    expect((await db.readCollection()).stock.has('darius-metal')).toBe(false);
  });

  it('Abnahme M1: Export und anschließender Import stellen den Bestand vollständig wieder her', async () => {
    const db = fresh();
    const imported = importPiltover(SAMPLE, index);
    await db.replaceCollection({
      stock: imported.stock,
      templates: imported.templates,
      extraRows: imported.unmatched.map((u) => u.row),
    });
    await db.changeQty('darius-metal', 2);
    const before = await db.readCollection();
    const file = createBackup(before, index, new Date().toISOString());

    await db.replaceCollection(emptyCollection());
    expect((await db.readCollection()).stock.size).toBe(0);

    await db.replaceCollection(parseBackup(file));
    expect(await db.readCollection()).toEqual(before);
  });

  it('zählt beim Hinzufügen zum vorhandenen Bestand dazu', async () => {
    const db = fresh();
    await db.setQty('scorcher-n', 1);
    await db.addToCollection({ ...emptyCollection(), stock: new Map([['scorcher-n', 2], ['kaisa', 1]]) });
    expect((await db.readCollection()).stock).toEqual(new Map([['scorcher-n', 3], ['kaisa', 1]]));
  });
});

/**
 * Abnahme M1 mit der echten Exportdatei des Nutzers. Die Datei bleibt lokal
 * (testdata/piltoverarchive/ ist von Git ausgenommen); ohne sie wird der Test übersprungen.
 */
const paDir = path.resolve(__dirname, '../testdata/piltoverarchive');
const paFiles = existsSync(paDir) ? readdirSync(paDir).filter((f) => f.endsWith('.csv')) : [];
const catalogFile = path.resolve(__dirname, '../.cache/openrift-catalog.json');

describe.skipIf(paFiles.length === 0 || !existsSync(catalogFile))('Piltover-Archive-Datei des Nutzers', () => {
  const real = () => buildIndex(parseOpenRiftCatalog(JSON.parse(readFileSync(catalogFile, 'utf8')), ''));

  it.each(paFiles)('%s: jede Karte ist zugeordnet oder steht in der Liste', (name) => {
    const idx = real();
    const result = importPiltover(readFileSync(path.join(paDir, name), 'utf8'), idx);
    const unmatchedQty = result.unmatched.reduce((sum, u) => sum + u.row.quantity, 0);
    expect(result.matchedQty + unmatchedQty).toBe(result.totalQty);
    expect(result.matchedQty / result.totalQty).toBeGreaterThanOrEqual(0.99);
    expect([...result.stock.values()].reduce((a, b) => a + b, 0)).toBe(result.matchedQty);
  });

  it.each(paFiles)('%s: Export und erneuter Import ergeben denselben Bestand', (name) => {
    const idx = real();
    const first = importPiltover(readFileSync(path.join(paDir, name), 'utf8'), idx);
    const out = exportPiltover(first.stock, idx, first.templates, first.unmatched.map((u) => u.row));
    expect(out.totalQty).toBe(first.totalQty);
    const second = importPiltover(out.csv, idx);
    expect(second.stock).toEqual(first.stock);
    expect(second.unmatched.map((u) => u.row.variantNumber)).toEqual(first.unmatched.map((u) => u.row.variantNumber));
  });
});
