import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { imageUrl } from '../../src/data/catalog-index';
import type { Catalog } from '../../src/data/model';
import { USER_AGENT } from './http';

/** Pause zwischen zwei Bildabrufen. OpenRift bittet um wenig Last; das ergibt höchstens vier Abrufe pro Sekunde. */
const DELAY_MS = 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ImageLoader {
  /** Liefert die Bilddatei in Rastergröße. */
  load(imageId: string): Promise<Buffer>;
  /** Zahl der tatsächlichen Netzabrufe in diesem Lauf. */
  readonly fetched: number;
}

/**
 * Lädt Kartenbilder gedrosselt und nacheinander.
 *
 * `keepDir` ist nur für die Entwicklung gedacht: Dort bleiben die Dateien liegen, damit
 * Änderungen am Fingerabdruck-Verfahren nicht alle Bilder neu abrufen. Der Ordner liegt
 * unter `.cache/` und kommt nie ins Repository. Ohne `keepDir` (GitHub Actions) wird
 * nichts gespeichert.
 */
export function createImageLoader(catalog: Catalog, keepDir?: string): ImageLoader {
  let fetched = 0;
  let last = 0;

  return {
    get fetched() {
      return fetched;
    },
    async load(imageId: string): Promise<Buffer> {
      const file = keepDir ? path.join(keepDir, `${imageId}.webp`) : null;
      if (file) {
        try {
          return await readFile(file);
        } catch {
          // noch nicht geladen
        }
      }

      const wait = last + DELAY_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();

      const url = imageUrl(catalog, imageId, 'thumb');
      let res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.status >= 500) {
        await sleep(3000);
        res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      }
      // Bei Ablehnung sofort aufhören, statt weiter anzufragen.
      if (!res.ok) throw new Error(`Bildabruf abgebrochen: HTTP ${res.status} für ${imageId}.`);
      fetched++;

      const data = Buffer.from(await res.arrayBuffer());
      if (file) {
        await mkdir(keepDir!, { recursive: true });
        await writeFile(file, data);
      }
      return data;
    },
  };
}
