import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { buildIndex, type CatalogIndex } from '../data/catalog-index';
import type { PriceData } from '../data/prices';
import { shouldRecheck } from '../data/update';
import { findRestorable, startAutoBackup, type Restorable } from './auto-backup';
import { loadCatalog, loadPrices } from './catalog-loader';
import { checkForUpdate, installedApkVersion, markAppReady, type AppUpdate } from './updater';
import { db, type SessionRow } from './db';
import { isNativeApp } from './save';

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

export interface UpdateCheck {
  update: AppUpdate;
  /** true, solange eine Prüfung läuft. */
  checking: boolean;
  /** Prüft sofort, z. B. über den Knopf „Nach Updates suchen“. */
  check: () => void;
}

/**
 * Update-Prüfung (siehe updater.ts): beim Start der Android-App, beim Zurückkehren in die
 * App nach längerer Pause und auf Knopfdruck. Die Web-App prüft beim Start nicht selbst;
 * das erledigt dort der Service Worker.
 */
export function useAppUpdate(): UpdateCheck {
  const [update, setUpdate] = useState<AppUpdate>(NO_UPDATE);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const lastCheck = useRef(Date.now());

  const check = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    lastCheck.current = Date.now();
    setChecking(true);
    void checkForUpdate(APP_VERSION)
      .then((result) =>
        // Ein schon geladenes Update bleibt stehen, auch wenn eine spätere Prüfung ohne Netz scheitert.
        setUpdate((previous) =>
          result.kind === 'failed' && (previous.kind === 'ready' || previous.kind === 'apk') ? previous : result,
        ),
      )
      .finally(() => {
        busy.current = false;
        setChecking(false);
      });
  }, []);

  useEffect(() => {
    // Die Oberfläche steht: Ein gerade eingespieltes Update gilt damit als gelungen.
    markAppReady();
    if (isNativeApp()) check();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && shouldRecheck(lastCheck.current, Date.now())) check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  return { update, checking, check };
}

/** Sichert die Sammlung der Android-App nach jeder Änderung (siehe auto-backup.ts). */
export function useAutoBackup(index: CatalogIndex | null): void {
  useEffect(() => (index ? startAutoBackup(index) : undefined), [index]);
}

/**
 * Android-App: Ist die Sammlung beim Start leer und liegt eine lesbare Sicherung im Ordner
 * der App, bietet die App sie zum Wiederherstellen an. `dismiss` blendet das Angebot aus.
 */
export function useRestoreOffer(): { offer: Restorable | null; dismiss: () => void } {
  const [offer, setOffer] = useState<Restorable | null>(null);
  useEffect(() => {
    let cancelled = false;
    void findRestorable().then((found) => {
      if (!cancelled) setOffer(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const dismiss = useCallback(() => setOffer(null), []);
  return { offer, dismiss };
}

/**
 * Version der installierten APK. Weicht sie von APP_VERSION ab, hat sich die App
 * seit der Installation selbst aktualisiert. In der Web-App immer null.
 */
export function useApkVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void installedApkVersion().then((v) => {
      if (!cancelled) setVersion(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return version;
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
