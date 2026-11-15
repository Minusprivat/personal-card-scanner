import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildIndex, type CatalogIndex } from '../data/catalog-index';
import { loadCatalog } from './catalog-loader';
import { db } from './db';

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

const EMPTY = new Map<string, number>();

/** Bestand als Sku-Id → Menge; aktualisiert sich bei jeder Änderung in der Datenbank. */
export function useStock(): Map<string, number> {
  const rows = useLiveQuery(() => db.stock.toArray(), []);
  return useMemo(() => (rows ? new Map(rows.map((r) => [r.skuId, r.qty])) : EMPTY), [rows]);
}

export type Route = { page: 'collection' } | { page: 'files' } | { page: 'card'; cardId: string };

function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'datei') return { page: 'files' };
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
