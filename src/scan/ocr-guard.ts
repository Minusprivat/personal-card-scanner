/**
 * Schutz vor einer hängenden Texterkennung.
 *
 * Die Texterkennung ist eine Zugabe: Sie wählt zwischen gleich aussehenden Drucken und
 * bestätigt unsichere Treffer. Lädt sie nicht (Datei fehlt, kein Netz beim ersten Mal)
 * oder antwortet sie nicht, darf der Scanner deshalb weder stehen bleiben noch bei jedem
 * Bild neu darauf warten. Tesseract meldet einen Fehlstart nicht verlässlich als Fehler;
 * manchmal kommt schlicht nie eine Antwort. Deshalb gelten hier feste Zeitgrenzen.
 */

export type OcrState = 'idle' | 'loading' | 'ready' | 'failed';

export interface OcrGuardOptions<W, I> {
  start(): Promise<W>;
  read(worker: W, input: I): Promise<string>;
  /** Räumt einen Worker ab, der nicht mehr antwortet. */
  stop?(worker: W): void;
  /** So lange wartet ein Lesewunsch höchstens darauf, dass das Laden fertig wird. */
  waitMs?: number;
  /** Nach dieser Zeit gilt das Laden als gescheitert. */
  loadMs?: number;
  /** So lange darf das Lesen einer Zeile dauern. */
  readMs?: number;
  /** Nach einem Ausfall wird frühestens nach dieser Zeit neu geladen. */
  retryMs?: number;
  now?(): number;
}

const TIMEOUT = Symbol('timeout');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMEOUT), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export class OcrGuard<W, I> {
  state: OcrState = 'idle';
  private worker: W | null = null;
  private loading: Promise<void> | null = null;
  private loadStarted = 0;
  private failedAt = 0;
  /** Zählt die Ladeversuche, damit ein verspätetes Ergebnis einen neueren Versuch nicht überschreibt. */
  private attempt = 0;

  private readonly waitMs: number;
  private readonly loadMs: number;
  private readonly readMs: number;
  private readonly retryMs: number;
  private readonly now: () => number;

  constructor(private readonly opts: OcrGuardOptions<W, I>) {
    this.waitMs = opts.waitMs ?? 2500;
    this.loadMs = opts.loadMs ?? 45_000;
    this.readMs = opts.readMs ?? 5000;
    this.retryMs = opts.retryMs ?? 60_000;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Stößt das Laden an, falls nötig. Wartet nicht. */
  warmUp(): void {
    if (this.state === 'ready' || this.state === 'loading') return;
    if (this.state === 'failed' && this.now() - this.failedAt < this.retryMs) return;

    const attempt = ++this.attempt;
    this.state = 'loading';
    this.loadStarted = this.now();
    const fail = () => {
      if (attempt !== this.attempt || this.state !== 'loading') return;
      this.state = 'failed';
      this.failedAt = this.now();
    };
    let started: Promise<W>;
    try {
      started = this.opts.start();
    } catch {
      fail();
      return;
    }
    this.loading = withTimeout(started, this.loadMs).then((result) => {
      if (result === TIMEOUT) {
        fail();
        // Kommt der Worker doch noch, wird er nicht mehr gebraucht.
        started.then((w) => this.opts.stop?.(w)).catch(() => undefined);
      } else if (attempt === this.attempt && this.state === 'loading') {
        this.worker = result;
        this.state = 'ready';
      } else this.opts.stop?.(result);
    }, fail);
  }

  /** Liest eine Zeile. Leerer Text heißt: nichts gelesen oder Texterkennung nicht verfügbar. */
  async read(input: I): Promise<string> {
    this.warmUp();
    if (this.state === 'loading' && this.loading) {
      // Nur kurz nach dem Start lohnt das Warten; danach läuft der Scanner ohne Nummer weiter.
      const left = this.waitMs - (this.now() - this.loadStarted);
      if (left > 0) await withTimeout(this.loading, left);
    }
    const worker = this.worker;
    if (this.state !== 'ready' || worker === null) return '';

    try {
      const text = await withTimeout(this.opts.read(worker, input), this.readMs);
      if (text !== TIMEOUT) return text;
    } catch {
      // Wird wie eine ausbleibende Antwort behandelt.
    }
    if (this.worker === worker) {
      this.worker = null;
      this.state = 'failed';
      this.failedAt = this.now();
      this.opts.stop?.(worker);
    }
    return '';
  }
}
