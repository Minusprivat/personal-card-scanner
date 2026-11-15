import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildIndex, type CatalogIndex } from '../data/catalog-index';
import type { PriceData } from '../data/prices';
import { loadCatalog, loadPrices } from './catalog-loader';
import { checkForUpdate, markAppReady, type AppUpdate } from './updater';
import { db, type SessionRow } from './db';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; index: CatalogIndex };

/** Lädt die Tagesdaten; Einzelheiten zu Web-App und Android-App stehen in catalog-loader.ts. */
export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then((catalog) => {
        if (!cancelled) setState({ status: 'ready', index: buildIndex(catalog) });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** Preise sind Beiwerk: Fehlen sie, zeigt die App „kein Preis“ und läuft weiter. */
export function usePrices(): PriceData | null {
  const [prices, setPrices] = useState<PriceData | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPrices()
      .then((p) => {
        if (!cancelled) setPrices(p);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return prices;
}

/** Version dieser App, beim Bau gesetzt; lokal "dev". */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

const NO_UPDATE: AppUpdate = { kind: 'none' };

/**
 * Selbst-Update der Android-App (siehe updater.ts): prüft beim Start einmal auf eine neue
 * Version und lädt sie im Hintergrund. In der Web-App und lokal bleibt es bei „nichts zu tun“.
 */
export function useAppUpdate(): AppUpdate {
  const [update, setUpdate] = useState<AppUpdate>(NO_UPDATE);
  useEffect(() => {
    // Die Oberfläche steht: Ein gerade eingespieltes Update gilt damit als gelungen.
    markAppReady();
    let cancelled = false;
    void checkForUpdate(APP_VERSION).then((result) => {
      if (!cancelled) setUpdate(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return update;
}

const EMPTY = new Map<string, number>();

const NO_ROWS: SessionRow[] = [];

/** Zeilen der Scan-Sitzung, zuletzt gescannte zuerst. */
export function useSession(): SessionRow[] {
  const rows = useLiveQuery(() => db.session.toArray(), []);
  return useMemo(() => (rows ? [...rows].sort((a, b) => b.at.localeCompare(a.at)) : NO_ROWS), [rows]);
}

/** Bestand als Sku-Id → Menge; aktualisiert sich bei jeder Änderung in der Datenbank. */
export function useStock(): Map<string, number> {
  const rows = useLiveQuery(() => db.stock.toArray(), []);
  return useMemo(() => (rows ? new Map(rows.map((r) => [r.skuId, r.qty])) : EMPTY), [rows]);
}

export type Route =
  | { page: 'collection' }
  | { page: 'files' }
  | { page: 'scan' }
  | { page: 'card'; cardId: string };

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'datei') return { page: 'files' };
  if (parts[0] === 'scan') return { page: 'scan' };
  if (parts[0] === 'karte' && parts[1]) return { page: 'card', cardId: decodeURIComponent(parts[1]) };
  return { page: 'collection' };
}

const subscribe = (fn: () => void) => {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
};

/** Navigation über den Adress-Anker, damit die Zurück-Taste des Handys funktioniert. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseHash(hash), [hash]);
}

export const cardHref = (cardId: string) => `#/karte/${encodeURIComponent(cardId)}`;
