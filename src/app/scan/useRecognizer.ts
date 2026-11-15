import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameResult, FromWorker, ToWorker } from '../../scan/protocol';
import { loadFingerprintFile } from '../catalog-loader';

export type RecognizerStatus = 'loading' | 'ready' | 'error';

export interface Recognizer {
  status: RecognizerStatus;
  error: string | null;
  /** Schickt ein Bild an die Erkennung. Solange ein Bild in Arbeit ist, wird das nächste abgelehnt (null). */
  recognize(frame: ImageData): Promise<FrameResult | null>;
}

/**
 * Startet den Erkennungs-Worker, sobald die Scan-Seite offen ist, und beendet ihn
 * beim Verlassen. Das Laden (Fingerabdrücke und OpenCV) dauert einige Sekunden.
 */
export function useRecognizer(): Recognizer {
  const [status, setStatus] = useState<RecognizerStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const pending = useRef<{ id: number; resolve: (r: FrameResult | null) => void } | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    let cancelled = false;
    const w = new Worker(new URL('../../scan/worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;

    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      setStatus('error');
      pending.current?.resolve(null);
      pending.current = null;
    };

    w.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data;
      if (message.type === 'ready') setStatus('ready');
      else if (message.type === 'error') fail(message.message);
      else if (pending.current?.id === message.id) {
        pending.current.resolve(message);
        pending.current = null;
      }
    };
    w.onerror = (event) => fail(event.message || 'Die Erkennung ließ sich nicht starten.');

    loadFingerprintFile()
      .then((fingerprints) => {
        if (!cancelled) w.postMessage({ type: 'init', fingerprints } satisfies ToWorker);
      })
      .catch(() => fail('Die Fingerabdrücke ließen sich nicht laden. Beim ersten Mal braucht der Scanner Internet.'));

    return () => {
      cancelled = true;
      pending.current?.resolve(null);
      pending.current = null;
      w.terminate();
      worker.current = null;
    };
  }, []);

  const recognize = useCallback((frame: ImageData): Promise<FrameResult | null> => {
    const w = worker.current;
    if (!w || pending.current) return Promise.resolve(null);
    return new Promise((resolve) => {
      const id = nextId.current++;
      pending.current = { id, resolve };
      const data = frame.data.buffer as ArrayBuffer;
      w.postMessage({ type: 'frame', id, width: frame.width, height: frame.height, data } satisfies ToWorker, [data]);
    });
  }, []);

  return { status, error, recognize };
}
