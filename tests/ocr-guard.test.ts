import { describe, expect, it, vi } from 'vitest';
import { OcrGuard } from '../src/scan/ocr-guard';

/** Ein Versprechen, das der Test von außen einlöst – oder nie. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Texterkennung darf den Scanner nicht aufhalten', () => {
  it('liest, sobald die Texterkennung geladen ist', async () => {
    const guard = new OcrGuard<string, string>({
      start: async () => 'worker',
      read: async (w, input) => `${w}:${input}`,
    });
    expect(await guard.read('OGN 031/298')).toBe('worker:OGN 031/298');
    expect(guard.state).toBe('ready');
  });

  it('wartet nur kurz auf das Laden und liefert dann leeren Text', async () => {
    vi.useFakeTimers();
    try {
      const guard = new OcrGuard<string, string>({
        // So verhält sich Tesseract, wenn das Sprachmodell fehlt: Es kommt nie eine Antwort.
        start: () => new Promise<string>(() => undefined),
        read: async () => 'nie',
        waitMs: 2500,
        loadMs: 45_000,
      });
      const first = guard.read('a');
      await vi.advanceTimersByTimeAsync(2500);
      expect(await first).toBe('');
      expect(guard.state).toBe('loading');

      // Spätere Lesewünsche warten gar nicht mehr.
      await vi.advanceTimersByTimeAsync(1000);
      expect(await guard.read('b')).toBe('');

      // Nach der Ladefrist gilt die Texterkennung als ausgefallen.
      await vi.advanceTimersByTimeAsync(45_000);
      expect(guard.state).toBe('failed');
      expect(await guard.read('c')).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('startet nach einem Fehlstart nicht bei jedem Bild neu', async () => {
    let now = 0;
    let starts = 0;
    const guard = new OcrGuard<string, string>({
      start: async () => {
        starts++;
        throw new Error('Datei fehlt');
      },
      read: async () => 'nie',
      retryMs: 60_000,
      now: () => now,
    });
    for (let i = 0; i < 5; i++) expect(await guard.read('a')).toBe('');
    expect(starts).toBe(1);
    expect(guard.state).toBe('failed');

    now = 61_000;
    expect(await guard.read('a')).toBe('');
    expect(starts).toBe(2);
  });

  it('lädt nach einem Fehlstart später doch noch', async () => {
    let now = 0;
    let fail = true;
    const guard = new OcrGuard<string, string>({
      start: async () => {
        if (fail) throw new Error('kein Netz');
        return 'worker';
      },
      read: async (_w, input) => input,
      retryMs: 60_000,
      now: () => now,
    });
    expect(await guard.read('a')).toBe('');
    fail = false;
    now = 60_000;
    expect(await guard.read('RAD 130/167')).toBe('RAD 130/167');
    expect(guard.state).toBe('ready');
  });

  it('gibt auf, wenn das Lesen einer Zeile nicht antwortet, und räumt den Worker ab', async () => {
    vi.useFakeTimers();
    try {
      const stopped: string[] = [];
      const hang = deferred<string>();
      const guard = new OcrGuard<string, string>({
        start: async () => 'worker',
        read: () => hang.promise,
        stop: (w) => stopped.push(w),
        readMs: 5000,
      });
      const reading = guard.read('a');
      await vi.advanceTimersByTimeAsync(5000);
      expect(await reading).toBe('');
      expect(guard.state).toBe('failed');
      expect(stopped).toEqual(['worker']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('behandelt einen Lesefehler wie eine ausbleibende Antwort', async () => {
    const guard = new OcrGuard<string, string>({
      start: async () => 'worker',
      read: async () => {
        throw new Error('kaputt');
      },
    });
    expect(await guard.read('a')).toBe('');
    expect(guard.state).toBe('failed');
  });
});
