import type { Catalog } from '../data/model';
import { db } from './db';
import { isNativeApp } from './save';

/** Tagesdaten der Web-App; die Android-App holt sie von dort, damit sie ohne neue APK aktuell bleibt. */
const REMOTE_CATALOG = 'https://minusprivat.github.io/personal-card-scanner/data/catalog.json';
const BUNDLED_CATALOG = `${import.meta.env.BASE_URL}data/catalog.json`;
const SAVED_KEY = 'catalog';
const FIRST_START_TIMEOUT_MS = 8000;

async function fetchCatalog(url: string, signal?: AbortSignal): Promise<Catalog> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const catalog = (await res.json()) as Catalog;
  if (!Array.isArray(catalog?.skus) || !Array.isArray(catalog.cards) || !catalog.images?.template) {
    throw new Error('Katalog hat ein unerwartetes Format');
  }
  return catalog;
}

/**
 * Web-App: Der Service Worker liefert den letzten Stand und frischt ihn im Hintergrund auf.
 *
 * Android-App: derselbe Ablauf von Hand. Der zuletzt geladene Katalog startet sofort,
 * ein neuer wird für den nächsten Start gespeichert. Beim allerersten Start ohne Netz
 * gilt der Katalog, der in der APK steckt.
 */
export async function loadCatalog(): Promise<Catalog> {
  if (!isNativeApp()) return fetchCatalog(BUNDLED_CATALOG);

  const saved = (await db.kv.get(SAVED_KEY))?.value as Catalog | undefined;
  if (saved) {
    void fetchCatalog(REMOTE_CATALOG)
      .then((fresh) => db.kv.put({ key: SAVED_KEY, value: fresh }))
      .catch(() => undefined);
    return saved;
  }

  try {
    const fresh = await fetchCatalog(REMOTE_CATALOG, AbortSignal.timeout(FIRST_START_TIMEOUT_MS));
    await db.kv.put({ key: SAVED_KEY, value: fresh });
    return fresh;
  } catch {
    return fetchCatalog(BUNDLED_CATALOG);
  }
}
