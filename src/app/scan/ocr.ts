import { createWorker, PSM, type Worker } from 'tesseract.js';
import { NUMBER_CHARS } from '../../scan/number';

/**
 * Texterkennung für die Nummernzeile. Tesseract läuft in einem eigenen Hintergrund-Thread;
 * seine Dateien liefert die App selbst aus (`public/ocr/`, siehe scripts/copy-ocr.mjs).
 */

let worker: Promise<Worker> | null = null;

function start(): Promise<Worker> {
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
  return createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
    langPath: base,
    gzip: true,
    // Der Worker liegt auf demselben Server; der Umweg über eine Blob-Adresse ist unnötig.
    workerBlobURL: false,
  }).then(async (w) => {
    await w.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: NUMBER_CHARS,
    });
    return w;
  });
}

/** Lädt die Texterkennung vorab, damit der erste Scan nicht darauf warten muss. */
export function warmUpOcr(): void {
  worker ??= start();
  // Scheitert das Laden (kein Netz beim ersten Mal), versucht es der nächste Aufruf erneut.
  worker.catch(() => {
    worker = null;
  });
}

/** Liest eine einzelne Textzeile. Gibt bei Fehlern leeren Text zurück; der Scanner läuft dann ohne Nummer weiter. */
export async function readLine(strip: ImageData): Promise<string> {
  try {
    worker ??= start();
    const w = await worker;
    const canvas = document.createElement('canvas');
    canvas.width = strip.width;
    canvas.height = strip.height;
    canvas.getContext('2d')!.putImageData(strip, 0, 0);
    const { data } = await w.recognize(canvas);
    return data.text.trim();
  } catch {
    worker = null;
    return '';
  }
}
