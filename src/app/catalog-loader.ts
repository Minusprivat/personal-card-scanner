import type { Catalog } from '../data/model';
import type { PriceData } from '../data/prices';
import type { FingerprintFile } from '../scan/matcher';
import { db } from './db';
import { isNativeApp } from './save';

/** Tagesdaten der Web-App; die Android-App holt sie von dort, damit sie ohne neue APK aktuell bleibt. */
export const REMOTE_DATA = 'https://minusprivat.github.io/personal-card-scanner/data/';
const BUNDLED_DATA = `${import.meta.env.BASE_URL}data/`;
const FIRST_START_TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string, check: (v: T) => boolean, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const value = (await res.json()) as T;
  if (!check(value)) throw new Error('Tagesdaten haben ein unerwartetes Format');
  return value;
}

/**
 * Web-App: Der Service Worker liefert den letzten Stand und frischt ihn im Hintergrund auf.
 *
 * Android-App: derselbe Ablauf von Hand. Der zuletzt geladene Stand startet sofort,
 * ein neuer wird für den nächsten Start gespeichert. Beim allerersten Start ohne Netz
 * gilt die Datei, die in der APK steckt.
 */
async function loadDaily<T>(file: string, check: (v: T) => boolean): Promise<T> {
  if (!isNativeApp()) return fetchJson(BUNDLED_DATA + file, check);

  const key = `daily:${file}`;
  const saved = (await db.kv.get(key))?.value as T | undefined;
  if (saved && check(saved)) {
    void fetchJson(REMOTE_DATA + file, check)
      .then((fresh) => db.kv.put({ key, value: fresh }))
      .catch(() => undefined);
    return saved;
  }

  try {
    const fresh = await fetchJson(REMOTE_DATA + file, check, AbortSignal.timeout(FIRST_START_TIMEOUT_MS));
    await db.kv.put({ key, value: fresh });
    return fresh;
  } catch {
    return fetchJson(BUNDLED_DATA + file, check);
  }
}

export const loadCatalog = (): Promise<Catalog> =>
  loadDaily<Catalog>(
    'catalog.json',
    (c) => Array.isArray(c?.skus) && Array.isArray(c.cards) && Boolean(c.images?.template),
  );

export const loadPrices = (): Promise<PriceData> =>
  loadDaily<PriceData>(
    'prices.json',
    (p) => typeof p?.createdAt === 'string' && typeof p.entries === 'object' && p.entries !== null,
  );

export const loadFingerprintFile = (): Promise<FingerprintFile> =>
  loadDaily<FingerprintFile>(
    'fingerprints.json',
    (f) => typeof f?.version === 'number' && typeof f.items === 'object' && f.items !== null,
  );

/** Versionsnummer der zuletzt veröffentlichten App, z. B. "0.1.7". Nur für den Update-Hinweis der Android-App. */
export async function loadPublishedVersion(): Promise<string | null> {
  try {
    const v = await fetchJson<{ version?: string }>(`${REMOTE_DATA}version.json`, (x) => typeof x?.version === 'string');
    return v.version ?? null;
  } catch {
    return null;
  }
}
