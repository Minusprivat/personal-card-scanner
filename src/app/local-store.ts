import { useSyncExternalStore } from 'react';

/** Kleiner Merker im Speicher des Geräts (localStorage), auf den die Oberfläche hören kann. */
export interface LocalStore<T> {
  get(): T | null;
  set(value: T | null): void;
  subscribe(listener: () => void): () => void;
}

export function localStore<T>(key: string): LocalStore<T> {
  let cached: T | null | undefined;
  const listeners = new Set<() => void>();
  const read = (): T | null => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
    } catch {
      return null;
    }
  };
  return {
    get: () => (cached === undefined ? (cached = read()) : cached),
    set(value) {
      cached = value;
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Speicher voll oder gesperrt: Der Merker gilt dann nur bis zum Schließen der App.
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const useLocalStore = <T,>(store: LocalStore<T>): T | null => useSyncExternalStore(store.subscribe, store.get);
