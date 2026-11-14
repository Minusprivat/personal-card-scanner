import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Kennung gegenüber fremden Schnittstellen. OpenRift bittet um Projektname und Kontaktweg. */
export const USER_AGENT =
  'PersonalCardScannerViaClaude/0.1 (+https://github.com/Minusprivat/personal-card-scanner)';

/** OpenRift bittet, jede Antwort mindestens eine Stunde zu behalten. */
const MAX_AGE_MS = 60 * 60 * 1000;

export interface FetchOptions {
  cacheDir: string;
  /** Nur den Zwischenspeicher lesen, nie ins Netz gehen. */
  offline?: boolean;
}

export interface Fetched<T> {
  data: T;
  fetchedAt: string;
  fromCache: boolean;
}

interface Meta {
  url: string;
  etag: string | null;
  fetchedAt: string;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Lädt JSON höchstens einmal pro Stunde. Danach fragt es mit If-None-Match nach,
 * sodass unveränderte Daten nicht erneut übertragen werden.
 */
export async function fetchJsonCached<T>(name: string, url: string, opts: FetchOptions): Promise<Fetched<T>> {
  const bodyFile = path.join(opts.cacheDir, `${name}.json`);
  const metaFile = path.join(opts.cacheDir, `${name}.meta.json`);
  const meta = await readJson<Meta>(metaFile);
  const cached = meta && meta.url === url ? await readJson<T>(bodyFile) : null;

  if (cached && meta) {
    const age = Date.now() - Date.parse(meta.fetchedAt);
    if (opts.offline || age < MAX_AGE_MS) return { data: cached, fetchedAt: meta.fetchedAt, fromCache: true };
  }
  if (opts.offline) {
    throw new Error(`Kein Zwischenspeicher für "${name}". Einmal ohne --offline ausführen.`);
  }

  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
  if (cached && meta?.etag) headers['If-None-Match'] = meta.etag;

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    if (cached && meta) {
      console.warn(`Netzfehler bei ${name}, nutze Stand vom ${meta.fetchedAt}: ${String(err)}`);
      return { data: cached, fetchedAt: meta.fetchedAt, fromCache: true };
    }
    throw err;
  }

  const now = new Date().toISOString();
  await mkdir(opts.cacheDir, { recursive: true });

  if (res.status === 304 && cached && meta) {
    await writeFile(metaFile, JSON.stringify({ ...meta, fetchedAt: now } satisfies Meta));
    return { data: cached, fetchedAt: now, fromCache: true };
  }
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} von ${url}`);

  const text = await res.text();
  const data = JSON.parse(text) as T;
  await writeFile(bodyFile, text);
  await writeFile(metaFile, JSON.stringify({ url, etag: res.headers.get('etag'), fetchedAt: now } satisfies Meta));
  return { data, fetchedAt: now, fromCache: false };
}
