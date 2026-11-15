import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { Catalog } from '../../src/data/model';
import { fingerprint, FP_VERSION, toHex, type Pixels } from '../../src/scan/fingerprint';
import type { FingerprintFile } from '../../src/scan/matcher';
import type { ImageLoader } from './images';

/** Bilddatei → Pixel für das Fingerabdruck-Modul. */
export async function decodeImage(file: Buffer): Promise<Pixels> {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: 3 };
}

export async function readFingerprintFile(file: string): Promise<FingerprintFile> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as FingerprintFile;
    // Nach einer Änderung am Verfahren sind alte Fingerabdrücke wertlos.
    if (parsed.version === FP_VERSION && parsed.items) return parsed;
  } catch {
    // Datei fehlt oder ist unlesbar: von vorn beginnen.
  }
  return { version: FP_VERSION, items: {} };
}

export interface FingerprintRun {
  file: FingerprintFile;
  added: number;
  removed: number;
}

/**
 * Bringt die Fingerabdrücke auf den Stand des Katalogs: berechnet sie für neue Bilder
 * und entfernt die von Bildern, die es nicht mehr gibt. Vorhandene bleiben unberührt,
 * sodass ein täglicher Lauf nur neue Bilder abruft.
 */
export async function updateFingerprints(
  catalog: Catalog,
  known: FingerprintFile,
  loader: ImageLoader,
  onProgress?: (done: number, total: number) => void,
): Promise<FingerprintRun> {
  const wanted = [...new Set(catalog.skus.map((s) => s.imageId).filter((id): id is string => id !== null))].sort();
  const items: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of wanted) {
    const have = known.items[id];
    if (have) items[id] = have;
    else missing.push(id);
  }

  let done = 0;
  for (const id of missing) {
    items[id] = toHex(fingerprint(await decodeImage(await loader.load(id))));
    onProgress?.(++done, missing.length);
  }

  const removed = Object.keys(known.items).filter((id) => !(id in items)).length;
  // Sortiert schreiben, damit sich die Datei im Repository nur dort ändert, wo sich etwas tut.
  const sorted = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b)));
  return { file: { version: FP_VERSION, items: sorted }, added: missing.length, removed };
}

export async function writeFingerprintFile(file: string, data: FingerprintFile): Promise<void> {
  // Ein Eintrag je Zeile: lesbare Unterschiede im Repository.
  const lines = Object.entries(data.items).map(([id, hex]) => `  ${JSON.stringify(id)}: ${JSON.stringify(hex)}`);
  await writeFile(file, `{\n "version": ${data.version},\n "items": {\n${lines.join(',\n')}\n }\n}\n`);
}
