/// <reference lib="webworker" />
import cvModule from '@techstark/opencv-js';
import { extractStrip, type OpenCv, type Point } from './detect';
import { loadFingerprints, type FingerprintSet } from './matcher';
import { prepareStrip, STRIP_H } from './number';
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

    if (message.type === 'strip') {
      const crop = new cv.Mat(message.height, message.width, cv.CV_8UC4);
      try {
        crop.data.set(new Uint8Array(message.data));
        const q = message.quad;
        const quad = [0, 1, 2, 3].map((i) => ({ x: q[i * 2]!, y: q[i * 2 + 1]! })) as [Point, Point, Point, Point];
        const strip = extractStrip(cv, crop, quad, message.outWidth, STRIP_H, prepareStrip);
        const data = strip.data.buffer as ArrayBuffer;
        send({ type: 'strip', id: message.id, width: strip.width, height: strip.height, data }, [data]);
      } finally {
        crop.delete();
      }
      return;
    }

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
