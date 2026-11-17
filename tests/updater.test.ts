import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Prüft die Update-Prüfung der Android-App gegen einen Baustein, der sich wie ein echter
 * Capacitor-Baustein verhält: Er antwortet auf JEDEN Namen mit einer Funktion, auch auf `then`.
 * Bis Version 0.1.14 gab eine async-Funktion den Baustein direkt zurück; JavaScript hielt ihn
 * deshalb für ein Promise und die Prüfung blieb für immer hängen.
 */

const calls: Array<{ method: string; options: unknown }> = [];
let bundles: Array<{ id: string; version: string; status: string }> = [];

const answers: Record<string, (options: unknown) => unknown> = {
  current: () => ({ native: '0.1.15', bundle: { id: 'builtin', version: 'builtin' } }),
  list: () => ({ bundles }),
  download: (options) => ({ id: 'paket-1', version: (options as { version: string }).version, status: 'pending' }),
  next: () => ({}),
  set: () => undefined,
  notifyAppReady: () => ({}),
};

vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: new Proxy(
    {},
    {
      get(_, prop) {
        const name = String(prop);
        return (options: unknown) => {
          calls.push({ method: name, options });
          const answer = answers[name];
          // Unbekannte Methoden beantwortet der echte Baustein nie über die übergebenen Funktionen.
          return answer ? Promise.resolve(answer(options)) : new Promise(() => undefined);
        };
      },
    },
  ),
}));
vi.mock('../src/app/save', () => ({ isNativeApp: () => true }));

const SHA = 'b'.repeat(64);
const publish = (body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })));

/** Bricht ab, statt den Testlauf anzuhalten, wenn die Prüfung hängt. */
const settled = <T,>(promise: Promise<T>) =>
  Promise.race([promise, new Promise<'hängt'>((resolve) => setTimeout(() => resolve('hängt'), 1000))]);

async function loadUpdater() {
  vi.resetModules();
  return import('../src/app/updater');
}

beforeEach(() => {
  calls.length = 0;
  bundles = [];
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Update-Prüfung der Android-App', () => {
  it('bleibt nicht hängen und meldet „aktuell“, wenn es nichts Neues gibt', async () => {
    publish({ version: '0.1.15', apk: 15, sha256: SHA });
    const { checkForUpdate } = await loadUpdater();
    expect(await settled(checkForUpdate('0.1.15'))).toEqual({ kind: 'current', version: '0.1.15' });
    // Der Baustein darf nie wie ein Promise behandelt werden.
    expect(calls.map((c) => c.method)).not.toContain('then');
  });

  it('lädt eine neue Version mit Prüfsumme und merkt sie für den nächsten Start vor', async () => {
    publish({ version: '0.1.16', apk: 15, sha256: SHA });
    const { checkForUpdate } = await loadUpdater();
    const update = await settled(checkForUpdate('0.1.15'));
    expect(update).toMatchObject({ kind: 'ready', version: '0.1.16', native: true });
    expect(calls.find((c) => c.method === 'download')?.options).toEqual({
      url: 'https://minusprivat.github.io/personal-card-scanner/bundle/app-0.1.16.zip',
      version: '0.1.16',
      checksum: SHA,
    });
    expect(calls.find((c) => c.method === 'next')?.options).toEqual({ id: 'paket-1' });
  });

  it('lädt ein schon vorhandenes Paket nicht noch einmal, auch nicht bei wiederholter Prüfung', async () => {
    publish({ version: '0.1.16', apk: 15, sha256: SHA });
    bundles = [{ id: 'paket-alt', version: '0.1.16', status: 'pending' }];
    const { checkForUpdate } = await loadUpdater();
    await settled(checkForUpdate('0.1.15'));
    await settled(checkForUpdate('0.1.15'));
    expect(calls.filter((c) => c.method === 'download')).toHaveLength(0);
    // Die zweite Prüfung nutzt das Ergebnis der ersten und zählt keinen weiteren Versuch.
    expect(calls.filter((c) => c.method === 'next')).toEqual([{ method: 'next', options: { id: 'paket-alt' } }]);
    expect(JSON.parse(localStorage.getItem('updateTries')!)).toEqual({ version: '0.1.16', tries: 1 });
  });

  it('verlangt eine neue APK, wenn die installierte zu alt ist, und lädt dann nichts', async () => {
    publish({ version: '0.1.16', apk: 16, sha256: SHA });
    const { checkForUpdate } = await loadUpdater();
    expect(await settled(checkForUpdate('0.1.15'))).toEqual({ kind: 'apk', version: '0.1.16' });
    expect(calls.map((c) => c.method)).not.toContain('download');
  });

  it('nennt die Meldung, wenn das Laden scheitert, statt sie zu verschlucken', async () => {
    publish({ version: '0.1.16', apk: 15, sha256: SHA });
    answers.download = () => {
      throw new Error('Checksum failed');
    };
    const { checkForUpdate } = await loadUpdater();
    expect(await settled(checkForUpdate('0.1.15'))).toEqual({ kind: 'failed', reason: 'Checksum failed' });
    answers.download = (options) => ({ id: 'paket-1', version: (options as { version: string }).version, status: 'pending' });
  });

  it('meldet die installierte APK-Version und dem Baustein den gelungenen Start', async () => {
    const { installedApkVersion, markAppReady } = await loadUpdater();
    expect(await settled(installedApkVersion())).toBe('0.1.15');
    markAppReady();
    await vi.waitFor(() => expect(calls.map((c) => c.method)).toContain('notifyAppReady'));
  });

  it('meldet einen Fehler, wenn die Versionsdatei nicht lesbar ist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const { checkForUpdate } = await loadUpdater();
    expect(await settled(checkForUpdate('0.1.15'))).toMatchObject({ kind: 'failed' });
  });
});
