import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CollectionDb } from '../src/app/db';
import { buildIndex } from '../src/data/catalog-index';
import type { Catalog } from '../src/data/model';
import { defaultSku, interpretMatches } from '../src/scan/candidates';
import { DEFAULT_TRACKER, ScanTracker, type Observation } from '../src/scan/tracker';
import { sku } from './fixtures';

const seen = (motif: string, distance = 12, margin = 30): Observation => ({ motif, distance, margin });
const nothing: Observation = { motif: null, distance: 128, margin: 0 };

/** Füttert den Tracker mit einer Bildfolge und zählt, wie oft eine Karte neu gezählt wurde. */
function run(tracker: ScanTracker, frames: Observation[]): string[] {
  const counted: string[] = [];
  for (const f of frames) {
    const state = tracker.push(f);
    if (state.status === 'sure' && state.isNew) counted.push(state.motif);
  }
  return counted;
}

const times = <T>(n: number, value: T): T[] => Array.from({ length: n }, () => value);

describe('Stabile Treffer', () => {
  it('zählt eine Karte erst, wenn sie mehrere Bilder in Folge erkannt wurde', () => {
    const tracker = new ScanTracker();
    expect(tracker.push(seen('A')).status).toBe('looking');
    expect(tracker.push(seen('A')).status).toBe('looking');
    expect(tracker.push(seen('A'))).toEqual({ status: 'sure', motif: 'A', isNew: true });
  });

  it('zählt eine Karte, die im Bild liegen bleibt, nur einmal', () => {
    expect(run(new ScanTracker(), times(40, seen('A')))).toEqual(['A']);
  });

  it('lässt sich von einzelnen Aussetzern und Fehlbildern nicht zum Doppelzählen bringen', () => {
    const frames = [...times(5, seen('A')), nothing, seen('A'), seen('B'), ...times(5, seen('A')), nothing, nothing, seen('A')];
    expect(run(new ScanTracker(), frames)).toEqual(['A']);
  });

  it('zählt dieselbe Karte erneut, wenn sie weggenommen und wieder hingehalten wird', () => {
    const frames = [...times(4, seen('A')), ...times(DEFAULT_TRACKER.releaseFrames, nothing), ...times(4, seen('A'))];
    expect(run(new ScanTracker(), frames)).toEqual(['A', 'A']);
  });

  it('zählt die nächste Karte, auch wenn zwischendurch kein leeres Bild kommt', () => {
    expect(run(new ScanTracker(), [...times(4, seen('A')), ...times(4, seen('B'))])).toEqual(['A', 'B']);
  });

  it('Abnahme M4: 20 Karten nacheinander ergeben 20 Zählungen ohne Doppelzählung', () => {
    const frames = Array.from({ length: 20 }, (_, i) => [...times(6, seen(`karte-${i}`)), ...times(3, nothing)]).flat();
    const counted = run(new ScanTracker(), frames);
    expect(counted).toHaveLength(20);
    expect(new Set(counted).size).toBe(20);
  });

  it('zählt unsichere Treffer nicht von selbst, sondern bietet die Auswahl an', () => {
    const tracker = new ScanTracker();
    const far = seen('A', DEFAULT_TRACKER.sureDistance + 5);
    const close = seen('A', 12, DEFAULT_TRACKER.minMargin - 1);
    expect(run(tracker, times(6, far))).toEqual([]);
    expect(tracker.push(far).status).toBe('unsure');
    expect(run(new ScanTracker(), times(6, close))).toEqual([]);
  });

  it('wertet sehr schlechte Treffer als „keine Karte“', () => {
    const tracker = new ScanTracker();
    expect(tracker.push(seen('A', DEFAULT_TRACKER.maxDistance + 1)).status).toBe('idle');
  });

  it('zählt nach einer Auswahl von Hand nicht noch einmal, solange die Karte liegt', () => {
    const tracker = new ScanTracker();
    const unsure = seen('A', DEFAULT_TRACKER.sureDistance + 5);
    run(tracker, times(4, unsure));
    tracker.hold('A');
    expect(run(tracker, [...times(5, unsure), ...times(5, seen('A'))])).toEqual([]);
  });
});

/** Katalog: eine Karte mit normalem Druck, Promo-Druck (gleiches Motiv) und Alt-Art; dazu eine zweite Karte. */
const catalog: Catalog = {
  source: 'Test',
  fetchedAt: '',
  images: { template: '', thumb: '', detail: '', full: '' },
  sets: [{ id: 'set-ogn', code: 'OGN', name: 'Origins', type: 'main', releasedAt: null }],
  cards: [
    { id: 'c1', slug: 'c1', name: 'Darius', types: [], superTypes: [], domains: [], energy: null, might: null, power: null, keywords: [], tags: [] },
    { id: 'c2', slug: 'c2', name: 'Teemo', types: [], superTypes: [], domains: [], energy: null, might: null, power: null, keywords: [], tags: [] },
  ],
  skus: [
    sku({ id: 'd-normal', cardId: 'c1', shortCode: 'OGN-027', publicCode: 'OGN-027/298', imageId: 'img-d' }),
    sku({ id: 'd-foil', cardId: 'c1', shortCode: 'OGN-027', publicCode: 'OGN-027/298', imageId: 'img-d', finish: 'foil' }),
    sku({ id: 'd-promo', cardId: 'c1', shortCode: 'OGN-027', publicCode: 'OGN-027/298', imageId: 'img-d-promo', finish: 'foil', markers: ['promo'] }),
    sku({ id: 'd-alt', cardId: 'c1', shortCode: 'OGN-027a', publicCode: 'OGN-027a/298', imageId: 'img-d-alt', finish: 'foil', artVariant: 'altart' }),
    sku({ id: 't-foil', cardId: 'c2', shortCode: 'OGN-121', publicCode: 'OGN-121/298', imageId: 'img-t', finish: 'foil' }),
  ],
};
const index = buildIndex(catalog);
const firstIds = (prints: Array<{ skus: Array<{ id: string }> }>) => prints.map((p) => p.skus[0]!.id);

describe('Treffer in Drucke übersetzen', () => {
  it('nennt Motiv, Abstand und den Vorsprung vor dem nächsten anderen Motiv', () => {
    const hit = interpretMatches(
      [
        { imageId: 'img-d', distance: 10 },
        { imageId: 'img-d-promo', distance: 12 },
        { imageId: 'img-t', distance: 50 },
      ],
      index,
    )!;
    expect(hit).toMatchObject({ motif: 'c1|normal', cardId: 'c1', distance: 10, margin: 40 });
  });

  it('schlägt bei gleich aussehenden Drucken den gewöhnlichen zuerst vor, auch wenn der Promo-Druck knapp vorn liegt', () => {
    const hit = interpretMatches(
      [
        { imageId: 'img-d-promo', distance: 9 },
        { imageId: 'img-d', distance: 11 },
      ],
      index,
    )!;
    expect(firstIds(hit.prints)).toEqual(['d-normal', 'd-promo', 'd-alt']);
    expect(hit.margin).toBe(128 - 9);
  });

  it('bietet die übrigen Drucke derselben Karte als Ausweichwahl an', () => {
    const hit = interpretMatches([{ imageId: 'img-d-alt', distance: 8 }], index)!;
    expect(hit.motif).toBe('c1|altart');
    expect(firstIds(hit.prints)).toEqual(['d-alt', 'd-normal', 'd-promo']);
  });

  it('liefert nichts, wenn kein Treffer zu einem Druck im Katalog gehört', () => {
    expect(interpretMatches([{ imageId: 'unbekannt', distance: 3 }], index)).toBeNull();
    expect(interpretMatches([], index)).toBeNull();
  });

  it('belegt das Finish vor: Normal, wenn vorhanden, sonst das einzige', () => {
    expect(defaultSku(index.printBySkuId.get('d-foil')!).id).toBe('d-normal');
    expect(defaultSku(index.printBySkuId.get('t-foil')!).id).toBe('t-foil');
  });
});

describe('Scan-Sitzung', () => {
  let n = 0;
  const name = () => `sitzung-${++n}`;

  it('legt je Fassung eine Zeile an und erhöht die Menge beim erneuten Scan', async () => {
    const db = new CollectionDb(name());
    await db.addToSession('d-normal', 10);
    await db.addToSession('t-foil', 12);
    await db.addToSession('d-normal', 9);
    const rows = await db.session.toArray();
    expect(rows.map((r) => [r.skuId, r.qty, r.checked])).toEqual([
      ['d-normal', 2, true],
      ['t-foil', 1, true],
    ]);
  });

  it('schreibt nichts in die Sammlung, bevor die Auswahl übernommen wird', async () => {
    const db = new CollectionDb(name());
    await db.addToSession('d-normal', 10);
    expect((await db.readCollection()).stock.size).toBe(0);
  });

  it('Abnahme M4: Nur angehakte Zeilen landen in der Sammlung, der Rest wird verworfen', async () => {
    const db = new CollectionDb(name());
    await db.setQty('d-normal', 1);
    const a = await db.addToSession('d-normal', 10);
    await db.addToSession('d-normal', 10);
    const b = await db.addToSession('t-foil', 12);
    const c = await db.addToSession('d-alt', 14);
    await db.updateSession(b, { checked: false });
    await db.updateSession(c, { qty: 3 });

    expect(await db.commitSession()).toBe(5);
    expect((await db.readCollection()).stock).toEqual(new Map([['d-normal', 3], ['d-alt', 3]]));
    expect(await db.session.count()).toBe(0);
    expect(a).toBeGreaterThan(0);
  });

  it('Abnahme M4: Eine offene Sitzung ist nach einem Neustart noch da', async () => {
    const dbName = name();
    const before = new CollectionDb(dbName);
    await before.addToSession('d-foil', 11);
    await before.addToSession('d-foil', 11);
    before.close();

    const after = new CollectionDb(dbName);
    expect((await after.session.toArray()).map((r) => [r.skuId, r.qty])).toEqual([['d-foil', 2]]);
  });

  it('stellt eine Zeile auf ein anderes Finish um und legt gleiche Fassungen zusammen', async () => {
    const db = new CollectionDb(name());
    const normal = await db.addToSession('d-normal', 10);
    await db.addToSession('d-foil', 10);
    await db.moveSessionRow(normal, 'd-foil');
    expect((await db.session.toArray()).map((r) => [r.skuId, r.qty])).toEqual([['d-foil', 2]]);

    const row = (await db.session.toArray())[0]!;
    await db.moveSessionRow(row.id, 'd-promo');
    expect((await db.session.toArray()).map((r) => [r.skuId, r.qty])).toEqual([['d-promo', 2]]);
  });

  it('nimmt den letzten Scan zurück und entfernt Zeilen mit Menge 0', async () => {
    const db = new CollectionDb(name());
    const id = await db.addToSession('d-normal', 10);
    await db.addToSession('d-normal', 10);
    await db.undoSessionScan(id);
    expect((await db.session.get(id))?.qty).toBe(1);
    await db.undoSessionScan(id);
    expect(await db.session.count()).toBe(0);

    const other = await db.addToSession('t-foil', 12);
    await db.updateSession(other, { qty: 0 });
    expect(await db.session.count()).toBe(0);
  });
});
