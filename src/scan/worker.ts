/// <reference lib="webworker" />
import cvModule from '@techstark/opencv-js';
import type { OpenCv } from './detect';
import { loadFingerprints, type FingerprintSet } from './matcher';
import { MATCHES_PER_FRAME, type FromWorker, type ToWorker } from './protocol';
import { recognize } from './recognize';

/**
 * Erkennung im Hintergrund, damit die Oberfläche flüssig bleibt. OpenCV ist groß
 * (rund 13 MB) und wird nur geladen, wenn die Scan-Seite geöffnet wird.
 */

declare const self: DedicatedWorkerGlobalScope;

const send = (message: FromWorker, transfer: Transferable[] = []) => self.postMessage(message, transfer);

async function loadCv(): Promise<OpenCv> {
  const mod = cvModule as OpenCv;
  if (mod instanceof Promise) return mod;
  if (mod.Mat) return mod;
  await new Promise<void>((resolve) => {
    mod.onRuntimeInitialized = () => resolve();
  });
  return mod;
}

let cv: OpenCv = null;
let fingerprints: FingerprintSet | null = null;

self.onmessage = async (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      fingerprints = loadFingerprints(message.fingerprints);
      cv = await loadCv();
      send({ type: 'ready' });
      return;
    }

    if (!cv || !fingerprints) throw new Error('Erkennung ist noch nicht bereit.');
    const start = performance.now();
    const frame = new cv.Mat(message.height, message.width, cv.CV_8UC4);
    try {
      frame.data.set(new Uint8Array(message.data));
      const result = recognize(cv, frame, fingerprints, MATCHES_PER_FRAME);
      send({
        type: 'result',
        id: message.id,
        ms: performance.now() - start,
        corners: result?.detection.corners ?? null,
        matches: result?.matches ?? [],
        flipped: result?.flipped ?? false,
      });
    } finally {
      frame.delete();
    }
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
