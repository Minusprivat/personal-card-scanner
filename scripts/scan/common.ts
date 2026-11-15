import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFingerprintFile } from '../build-data/fingerprints';
import { parseOpenRiftCatalog } from '../build-data/sources/openrift';
import type { Catalog, Sku } from '../../src/data/model';
import { loadFingerprints, type FingerprintSet } from '../../src/scan/matcher';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const IMAGE_DIR = path.join(ROOT, '.cache', 'images');
export const FINGERPRINT_FILE = path.join(ROOT, 'data', 'fingerprints.json');

export const pct = (n: number, of: number) => (of === 0 ? '–' : `${((100 * n) / of).toFixed(1).replace('.', ',')} %`);

/** Zufallszahlen mit festem Startwert, damit jeder Lauf dieselben Szenen prüft. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TestData {
  catalog: Catalog;
  fingerprints: FingerprintSet;
  /** Bild-Id → alle Einträge, die dieses Bild zeigen. */
  skusByImage: Map<string, Sku[]>;
  /** Bild-Id → Motiv (Karte + Art-Variante). */
  motifOf: Map<string, string>;
}

/** Katalog aus dem Zwischenspeicher und die Fingerabdrücke aus dem Repository. */
export async function loadTestData(): Promise<TestData> {
  const catalog = parseOpenRiftCatalog(
    JSON.parse(await readFile(path.join(ROOT, '.cache', 'openrift-catalog.json'), 'utf8')),
    '',
  );
  const file = await readFingerprintFile(FINGERPRINT_FILE);
  if (Object.keys(file.items).length === 0) {
    throw new Error('Keine Fingerabdrücke unter data/fingerprints.json. Zuerst `npm run data:fingerprints` ausführen.');
  }
  const skusByImage = new Map<string, Sku[]>();
  const motifOf = new Map<string, string>();
  for (const s of catalog.skus) {
    if (!s.imageId) continue;
    const list = skusByImage.get(s.imageId);
    if (list) list.push(s);
    else skusByImage.set(s.imageId, [s]);
    motifOf.set(s.imageId, `${s.cardId}|${s.artVariant}`);
  }
  return { catalog, fingerprints: loadFingerprints(file), skusByImage, motifOf };
}

/** Lokal vorhandene Katalogbilder (Bild-Id → Datei). Leer, wenn sie nicht geladen wurden. */
export async function localImages(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    for (const f of (await readdir(IMAGE_DIR)).sort()) {
      if (f.endsWith('.webp')) out.set(f.replace(/\.webp$/, ''), path.join(IMAGE_DIR, f));
    }
  } catch {
    // Ordner fehlt
  }
  return out;
}
