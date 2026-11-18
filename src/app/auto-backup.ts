import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { liveQuery } from 'dexie';
import {
  autoBackupName,
  backupDay,
  collectionSignature,
  localDay,
  newestBackupsFirst,
  obsoleteAutoBackups,
  type BackupMark,
} from '../data/auto-backup';
import { createBackup, parseBackup, type CollectionState } from '../data/backup';
import type { CatalogIndex } from '../data/catalog-index';
import { db } from './db';
import { localStore } from './local-store';
import { isNativeApp, NATIVE_FOLDER } from './save';

/**
 * Automatische Sicherung der Android-App.
 *
 * Die Sammlung liegt in der Datenbank der App und geht mit ihr verloren, wenn die App
 * deinstalliert wird oder ihre Daten gelöscht werden. Deshalb schreibt die App nach jeder
 * Änderung eine Sicherungsdatei nach „Dokumente/CardScanner“; dieser Ordner bleibt stehen.
 *
 * Die Web-App kann nicht still in Dateien schreiben. Sie merkt sich nur, wann zuletzt von
 * Hand gesichert wurde, und erinnert daran (`backupMark`).
 */

/** So lange wartet die App nach einer Änderung, damit schnelles Zählen nur eine Datei schreibt. */
const WRITE_DELAY_MS = 3000;
/** So viele Ausweichnamen werden versucht, wenn sich die Datei des Tages nicht überschreiben lässt. */
const MAX_ATTEMPTS = 3;

export interface AutoBackupStatus {
  /** Zeitpunkt der letzten gelungenen Sicherung. */
  at: string | null;
  cards: number;
  file: string | null;
  /** Fingerabdruck des zuletzt gesicherten Bestands. */
  signature: string | null;
  /** Meldung, wenn der letzte Versuch gescheitert ist. */
  error?: string;
}

export const autoBackupStatus = localStore<AutoBackupStatus>('autoBackup');
/** Web-App: letzte Sicherung von Hand. */
export const backupMark = localStore<BackupMark>('backupMark');

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
const inFolder = (name: string) => `${NATIVE_FOLDER}/${name}`;

async function listFolder(): Promise<string[]> {
  const { files } = await Filesystem.readdir({ path: NATIVE_FOLDER, directory: Directory.Documents });
  return files.map((f) => f.name);
}

async function writeDay(day: string, text: string): Promise<string> {
  let failure: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const name = autoBackupName(day, attempt);
    try {
      await Filesystem.writeFile({
        path: inFolder(name),
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return name;
    } catch (err) {
      // Android verweigert das Überschreiben einer Datei aus einer früheren Installation.
      failure = err;
    }
  }
  throw failure;
}

async function prune(): Promise<void> {
  for (const name of obsoleteAutoBackups(await listFolder())) {
    // Dateien aus einer früheren Installation lassen sich nicht löschen; sie bleiben dann stehen.
    await Filesystem.deleteFile({ path: inFolder(name), directory: Directory.Documents }).catch(() => undefined);
  }
}

async function write(state: CollectionState, index: CatalogIndex): Promise<void> {
  const cards = sum(state.stock);
  // Eine leere Sammlung überschreibt nie eine Sicherung: Sie ist oft gerade der Verlustfall.
  if (cards === 0) return;
  const signature = collectionSignature(state);
  const previous = autoBackupStatus.get();
  if (previous?.signature === signature && !previous.error) return;

  const now = new Date();
  try {
    const file = await writeDay(localDay(now), createBackup(state, index, now.toISOString()));
    autoBackupStatus.set({ at: now.toISOString(), cards, file, signature });
    await prune().catch(() => undefined);
  } catch (err) {
    autoBackupStatus.set({
      at: previous?.at ?? null,
      cards: previous?.cards ?? 0,
      file: previous?.file ?? null,
      signature: previous?.signature ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Beobachtet die Sammlung und sichert sie nach jeder Änderung. Gibt die Funktion zum
 * Beenden zurück. In der Web-App geschieht nichts.
 */
export function startAutoBackup(index: CatalogIndex): () => void {
  if (!isNativeApp()) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  const subscription = liveQuery(() => db.readCollection()).subscribe({
    next: (state) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Nacheinander schreiben, damit sich zwei Sicherungen nicht überholen.
        queue = queue.then(() => write(state, index));
      }, WRITE_DELAY_MS);
    },
    error: () => undefined,
  });
  return () => {
    clearTimeout(timer);
    subscription.unsubscribe();
  };
}

/** Eine lesbare Sicherung im Ordner der App, die sich einspielen lässt. */
export interface Restorable {
  file: string;
  /** Tag der Sicherung, JJJJ-MM-TT. */
  day: string;
  cards: number;
  state: CollectionState;
}

/** Ergebnis der Suche beim Start. */
export interface RestoreSearch {
  /** Die Sammlung war leer. Lässt sich die Datenbank nicht lesen, gilt sie nicht als leer. */
  empty: boolean;
  /** Die neueste lesbare Sicherung mit Karten, sonst null. */
  found: Restorable | null;
}

/** Der Nutzer hat den Hinweis auf den Sicherungsordner ausgeblendet. */
export const restoreHintDismissed = localStore<boolean>('restoreHintDismissed');

/**
 * Sucht nach einer Sicherung, wenn die Sammlung leer ist (z. B. nach „Daten löschen“).
 * Nach einer Neuinstallation gibt Android die alten Dateien nicht von selbst frei; dann
 * bleibt nur der Weg über „Sicherung einspielen“ mit Dateiauswahl. Die App weist in diesem
 * Fall darauf hin (`restoreStep` in src/data/auto-backup.ts).
 */
export async function findRestorable(): Promise<RestoreSearch> {
  if (!isNativeApp()) return { empty: false, found: null };
  let empty = false;
  try {
    empty = (await db.stock.count()) === 0;
    if (!empty) return { empty, found: null };
    for (const file of newestBackupsFirst(await listFolder())) {
      try {
        const { data } = await Filesystem.readFile({
          path: inFolder(file),
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        const state = parseBackup(String(data));
        const cards = sum(state.stock);
        if (cards > 0) return { empty, found: { file, day: backupDay(file)!, cards, state } };
      } catch {
        // Nicht lesbar oder keine Sicherung: nächste Datei versuchen.
      }
    }
  } catch {
    // Ordner fehlt oder ist nicht lesbar: Es gibt nichts anzubieten.
  }
  return { empty, found: null };
}
