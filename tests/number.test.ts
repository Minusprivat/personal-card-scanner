import { describe, expect, it } from 'vitest';
import { buildIndex } from '../src/data/catalog-index';
import type { Catalog } from '../src/data/model';
import {
  applyNumber,
  decideByNumber,
  interpretMatches,
  isLandscape,
  numberCanHelp,
  suggestByNumber,
} from '../src/scan/candidates';
import type { Corners } from '../src/scan/detect';
import {
  normalizeCode,
  numberStrip,
  numberStrips,
  pickByNumber,
  prepareStrip,
  projector,
  STRIP_SHIFTS,
  substringDistance,
} from '../src/scan/number';
import { sku } from './fixtures';

const near = (a: { x: number; y: number }, x: number, y: number) => {
  expect(a.x).toBeCloseTo(x, 0);
  expect(a.y).toBeCloseTo(y, 0);
};

describe('Lage der Nummernzeile', () => {
  // Karte 630 × 880 px, gerade im Bild bei (100, 50).
  const upright: Corners = [
    { x: 100, y: 50 },
    { x: 730, y: 50 },
    { x: 730, y: 930 },
    { x: 100, y: 930 },
  ];

  it('bildet Punkte der Karte ins Bild ab, auch bei schräger Sicht', () => {
    const p = projector(upright);
    near(p(0, 0), 100, 50);
    near(p(1, 1), 730, 930);
    near(p(0.5, 0.5), 415, 490);

    const skewed: Corners = [
      { x: 120, y: 60 },
      { x: 700, y: 40 },
      { x: 760, y: 900 },
      { x: 80, y: 940 },
    ];
    const q = projector(skewed);
    near(q(0, 0), 120, 60);
    near(q(1, 0), 700, 40);
    near(q(1, 1), 760, 900);
    near(q(0, 1), 80, 940);
  });

  it('liegt bei einer aufrechten Karte unten links und läuft von links nach rechts', () => {
    const { quad, width } = numberStrip(upright, false, false);
    const [tl, tr, br, bl] = quad;
    expect(tl.x).toBeLessThan(tr.x);
    expect(tl.y).toBeCloseTo(tr.y);
    expect(tl.y).toBeLessThan(bl.y);
    // unterste 6 % der Karte, linke Hälfte
    expect(tl.y).toBeGreaterThan(50 + 880 * 0.93);
    expect(br.y).toBeLessThan(930);
    expect(tr.x).toBeLessThan(100 + 630 * 0.5);
    expect(width).toBeGreaterThan(300);
  });

  it('liegt bei einer kopfstehenden Karte oben rechts und läuft von rechts nach links', () => {
    const [tl, tr, , bl] = numberStrip(upright, true, false).quad;
    expect(tl.x).toBeGreaterThan(tr.x);
    expect(tl.y).toBeLessThan(50 + 880 * 0.07);
    expect(bl.y).toBeLessThan(tl.y);
  });

  it('liegt bei einem Battlefield an der langen Kante, unten links im Querformat', () => {
    // Querformat 880 × 630; Ecken wie von der Umrisssuche: im Uhrzeigersinn ab der linken kurzen Kante.
    const landscape: Corners = [
      { x: 0, y: 630 },
      { x: 0, y: 0 },
      { x: 880, y: 0 },
      { x: 880, y: 630 },
    ];
    const [tl, tr, br, bl] = numberStrip(landscape, false, true).quad;
    near(tl, 880 * 0.03, 630 * 0.91);
    near(tr, 880 * 0.42, 630 * 0.91);
    near(br, 880 * 0.42, 630 * 0.975);
    near(bl, 880 * 0.03, 630 * 0.975);
  });
});

describe('Nummernzeile aufbereiten', () => {
  it('macht aus weißer Schrift auf buntem Grund dunkle Schrift auf hellem Grund', () => {
    // 4 Pixel: rosa Hintergrund, weiße Schrift, türkiser Hintergrund, dunkler Rahmen
    const rgba = new Uint8Array([230, 120, 170, 255, 255, 255, 255, 255, 90, 200, 190, 255, 20, 20, 20, 255]);
    const out = prepareStrip(rgba, 4, 1);
    const gray = [out[0]!, out[4]!, out[8]!, out[12]!];
    expect(gray[1]).toBeLessThan(40); // Schrift dunkel
    expect(gray[0]).toBeGreaterThan(170); // bunter Grund hell
    expect(gray[2]).toBeGreaterThan(170);
    expect(gray[3]).toBeGreaterThan(240);
    expect(out[3]).toBe(255);
  });
});

describe('Gelesenen Text zuordnen', () => {
  it('vereinheitlicht Schreibweisen und typische Verwechslungen', () => {
    expect(normalizeCode('OGN • 121/298')).toBe('0GN121/298');
    expect(normalizeCode('ogn-121/298')).toBe('0GN121/298');
    expect(normalizeCode('UNL 086/219 * P')).toBe('UN1086/219P');
    expect(normalizeCode('SFD-230*/221')).toBe('SF0230/221');
  });

  it('zählt Fehler nur an der Fundstelle, nicht im Drumherum', () => {
    expect(substringDistance('121/298', 'XX121/298YY')).toBe(0);
    expect(substringDistance('121/298', '121/208')).toBe(1);
    expect(substringDistance('121/298', '12129')).toBe(2);
    expect(substringDistance('ABC', '')).toBe(3);
  });

  const pick = (text: string, codes: string[]) => pickByNumber(text, codes.map((code) => ({ item: code, code })));

  it('findet die Nummer trotz einzelner Lesefehler und mitgelesenem Rand', () => {
    expect(pick('OGN 121/298 3', ['OGN-121/298', 'OGN-027/298'])).toBe('OGN-121/298');
    expect(pick('OGM 001/258', ['OGN-001/298', 'SFD-013/221'])).toBe('OGN-001/298');
    expect(pick('0GS 017/024 T', ['OGS-017/024', 'OGS-025/024'])).toBe('OGS-017/024');
  });

  it('unterscheidet Alt-Art-Nummern mit Buchstaben', () => {
    const codes = ['OGN-121/298', 'OGN-121a/298'];
    expect(pick('OGN 121a/298', codes)).toBe('OGN-121a/298');
    expect(pick('OGN 121/298', codes)).toBe('OGN-121/298');
  });

  it('erkennt den Promo-Zusatz: bei Gleichstand gewinnt die längere Nummer', () => {
    const codes = ['UNL-086/219', 'UNL-086/219-P'];
    expect(pick('UNL 086/219  P', codes)).toBe('UNL-086/219-P');
    expect(pick('UNL 086/219', codes)).toBe('UNL-086/219');
    expect(pick('RAD 132/167 * P * EN', ['RAD-132/167-EN', 'RAD-132/167-P-EN'])).toBe('RAD-132/167-P-EN');
  });

  it('ordnet nichts zu, wenn der Text zu kurz, zu fehlerhaft oder mehrdeutig ist', () => {
    expect(pick('Oa', ['OGN-259/298'])).toBeNull();
    expect(pick('AON T/29 3', ['OGN-261/298'])).toBeNull();
    // zwei verschiedene Nummern passen gleich gut
    expect(pick('OGN 12', ['OGN-121/298', 'OGN-122/298'])).toBeNull();
    expect(pick('', ['OGN-121/298'])).toBeNull();
  });

  it('behandelt signierte und unsignierte Fassung als dieselbe Nummer und nimmt den ersten Kandidaten', () => {
    expect(pick('SFD 230/221', ['SFD-230/221', 'SFD-230*/221'])).toBe('SFD-230/221');
  });
});

/** Darius: normal, Promo mit gleicher Nummer, Promo-Nachdruck mit anderer Nummer; Garen sieht ähnlich aus. */
const catalog: Catalog = {
  source: 'Test',
  fetchedAt: '',
  images: { template: '', thumb: '', detail: '', full: '' },
  sets: [{ id: 'set-ogn', code: 'OGN', name: 'Origins', type: 'main', releasedAt: null }],
  cards: [
    { id: 'c1', slug: 'c1', name: 'Darius', types: ['unit'], superTypes: [], domains: [], energy: null, might: null, power: null, keywords: [], tags: [] },
    { id: 'c2', slug: 'c2', name: 'Garen', types: ['unit'], superTypes: [], domains: [], energy: null, might: null, power: null, keywords: [], tags: [] },
    { id: 'c3', slug: 'c3', name: 'Void Gate', types: ['battlefield'], superTypes: [], domains: [], energy: null, might: null, power: null, keywords: [], tags: [] },
  ],
  skus: [
    sku({ id: 'd', cardId: 'c1', shortCode: 'OGN-027', publicCode: 'OGN-027/298', imageId: 'img-d' }),
    sku({ id: 'd-stamp', cardId: 'c1', shortCode: 'OGN-027', publicCode: 'OGN-027/298', imageId: 'img-d-stamp', markers: ['promo'] }),
    sku({ id: 'd-reprint', cardId: 'c1', shortCode: 'SFD-225', publicCode: 'SFD-225/221-P', imageId: 'img-d-reprint', markers: ['promo'] }),
    sku({ id: 'g', cardId: 'c2', shortCode: 'OGN-031', publicCode: 'OGN-031/298', imageId: 'img-g' }),
    sku({ id: 'bf', cardId: 'c3', shortCode: 'OGN-296', publicCode: 'OGN-296/298', imageId: 'img-bf' }),
  ],
};
const index = buildIndex(catalog);
const firstIds = (hit: { prints: Array<{ skus: Array<{ id: string }> }> } | null) => hit?.prints.map((p) => p.skus[0]!.id);

describe('Nummer im Scanner', () => {
  const hit = interpretMatches(
    [
      { imageId: 'img-d', distance: 10 },
      { imageId: 'img-d-reprint', distance: 12 },
      { imageId: 'img-g', distance: 30 },
    ],
    index,
  )!;

  it('merkt sich ähnliche andere Karten als mögliche Auswahl', () => {
    expect(hit.others.map((p) => p.skus[0]!.id)).toEqual(['g']);
  });

  it('wird nur bemüht, wenn Drucke mit verschiedener Nummer zur Wahl stehen', () => {
    expect(numberCanHelp(hit, false)).toBe(true);
    const single = interpretMatches([{ imageId: 'img-bf', distance: 8 }], index)!;
    expect(numberCanHelp(single, false)).toBe(false);
  });

  it('stellt den Druck mit der gelesenen Nummer nach vorn', () => {
    expect(firstIds(applyNumber(hit, 'SFD 225/221  P', index, false))?.[0]).toBe('d-reprint');
  });

  it('nimmt bei gleicher Nummer den gewöhnlichen Druck vor dem mit Stempel', () => {
    expect(firstIds(applyNumber(hit, 'OGN 027/298', index, false))?.slice(0, 2)).toEqual(['d', 'd-stamp']);
  });

  it('biegt einen sicheren Bildtreffer nicht auf eine andere Karte um', () => {
    // Gelesen wird die Nummer der ähnlichen Karte; der Treffer bleibt trotzdem bei Darius.
    const result = applyNumber(hit, 'OGN 031/298', index, false);
    expect(result?.cardId ?? 'c1').toBe('c1');
    expect(result?.prints[0]!.cardId ?? 'c1').toBe('c1');
  });

  it('bestätigt einen unsicheren Bildtreffer nur bei fehlerfrei gelesener Nummer', () => {
    // „OGN 028/298“ liegt nur eine Ziffer neben Darius (027) und gehört zu einer anderen Karte.
    expect(applyNumber(hit, 'OGN 028/298', index, true)).toBeNull();
    expect(firstIds(applyNumber(hit, 'OGN 027/298 3', index, true))?.[0]).toBe('d');
  });

  it('wechselt bei unsicherem Bildtreffer auf die Karte, deren Nummer gelesen wurde', () => {
    const switched = applyNumber(hit, 'OGN 031/298', index, true)!;
    expect(switched.cardId).toBe('c2');
    expect(switched.motif).toBe('c2|normal');
    expect(firstIds(switched)).toEqual(['g']);
  });

  it('lässt den Treffer unverändert, wenn die Nummer nicht lesbar war', () => {
    expect(applyNumber(hit, 'Oa', index, true)).toBeNull();
  });

  it('erkennt Battlefields als Querformat', () => {
    expect(isLandscape(index.printBySkuId.get('bf')!, index)).toBe(true);
    expect(isLandscape(index.printBySkuId.get('d')!, index)).toBe(false);
  });
});

describe('Nummernzeile bei ungenauem Umriss', () => {
  const upright = [
    { x: 100, y: 50 },
    { x: 730, y: 50 },
    { x: 730, y: 930 },
    { x: 100, y: 930 },
  ] as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];

  it('sucht die Zeile an mehreren Stellen, die vermutete zuerst', () => {
    const strips = numberStrips(upright, false, false);
    expect(strips).toHaveLength(STRIP_SHIFTS.length);
    expect(strips[0]).toEqual(numberStrip(upright, false, false));
    // Positive Verschiebung: weiter zum unteren Kartenrand.
    expect(strips[1]!.quad[0].y).toBeGreaterThan(strips[0]!.quad[0].y);
    expect(strips[2]!.quad[0].y).toBeLessThan(strips[0]!.quad[0].y);
  });

  it('verschiebt bei kopfstehender Karte in die Gegenrichtung', () => {
    const strips = numberStrips(upright, true, false);
    expect(strips[1]!.quad[0].y).toBeLessThan(strips[0]!.quad[0].y);
  });
});

describe('Nummer im ganzen Katalog', () => {
  const hit = interpretMatches([{ imageId: 'img-g', distance: 36 }], index)!;

  it('schlägt die Karte zur gelesenen Nummer vor, auch wenn der Bildabgleich sie nicht kennt', () => {
    const suggested = suggestByNumber(hit, '3 SFD 225/221 P', index)!;
    expect(suggested.cardId).toBe('c1');
    expect(firstIds(suggested)?.[0]).toBe('d-reprint');
    // Was der Bildabgleich meinte, bleibt als Ausweichwahl.
    expect(suggested.others.map((p) => p.skus[0]!.id)).toEqual(['g']);
  });

  it('schlägt nichts vor, wenn die Nummer nicht vollständig im Text steht', () => {
    expect(suggestByNumber(hit, 'SFD 225/22', index)).toBeNull();
    expect(suggestByNumber(hit, 'Oa', index)).toBeNull();
  });

  it('zählt einen Vorschlag aus dem ganzen Katalog nie von selbst', async () => {
    const outcome = await decideByNumber(hit, false, index, numberStrips([{ x: 0, y: 0 }, { x: 63, y: 0 }, { x: 63, y: 88 }, { x: 0, y: 88 }], false, false), async () => 'SFD 225/221 P');
    expect(outcome?.confirmed).toBe(false);
    expect(outcome?.hit.cardId).toBe('c1');
  });

  it('bestätigt, sobald eine der Stellen die Nummer eines Kandidaten fehlerfrei liefert', async () => {
    const reads = ['', 'Sa Sa', 'OGN 031/298'];
    const outcome = await decideByNumber(hit, false, index, numberStrips([{ x: 0, y: 0 }, { x: 63, y: 0 }, { x: 63, y: 88 }, { x: 0, y: 88 }], false, false), async () => reads.shift() ?? '');
    expect(outcome).toMatchObject({ confirmed: true, text: 'OGN 031/298' });
    expect(outcome!.hit.cardId).toBe('c2');
  });

  it('liest gar nicht erst, wenn der Bildabgleich sicher ist und nur ein Druck in Frage kommt', async () => {
    let calls = 0;
    const single = interpretMatches([{ imageId: 'img-bf', distance: 8 }], index)!;
    const outcome = await decideByNumber(single, true, index, numberStrips([{ x: 0, y: 0 }, { x: 63, y: 0 }, { x: 63, y: 88 }, { x: 0, y: 88 }], false, true), async () => {
      calls++;
      return 'OGN 296/298';
    });
    expect(outcome).toBeNull();
    expect(calls).toBe(0);
  });
});
