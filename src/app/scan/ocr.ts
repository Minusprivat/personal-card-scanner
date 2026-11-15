import { createWorker, PSM, type Worker } from 'tesseract.js';
import { NUMBER_CHARS } from '../../scan/number';
import { OcrGuard } from '../../scan/ocr-guard';

/**
 * Texterkennung für die Nummernzeile. Tesseract läuft in einem eigenen Hintergrund-Thread;
 * seine Dateien liefert die App selbst aus (`public/ocr/`, siehe scripts/copy-ocr.mjs).
 *
 * Der Scanner darf nie auf die Texterkennung warten müssen: Lädt sie nicht oder antwortet
 * sie nicht, läuft er ohne Nummer weiter (`OcrGuard`).
 */

function start(): Promise<Worker> {
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
  return createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
    langPath: base,
    // Das Sprachmodell liegt ausgepackt vor; siehe scripts/copy-ocr.mjs.
    gzip: false,
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

const guard = new OcrGuard<Worker, ImageData>({
  start,
  read: async (w, strip) => {
    const canvas = document.createElement('canvas');
    canvas.width = strip.width;
    canvas.height = strip.height;
    canvas.getContext('2d')!.putImageData(strip, 0, 0);
    const { data } = await w.recognize(canvas);
    return data.text.trim();
  },
  stop: (w) => void w.terminate().catch(() => undefined),
});

/** Lädt die Texterkennung vorab, damit der erste Scan nicht darauf warten muss. */
export function warmUpOcr(): void {
  guard.warmUp();
}

/** Liest eine einzelne Textzeile. Gibt leeren Text zurück, wenn die Texterkennung (noch) nicht bereit ist. */
export function readLine(strip: ImageData): Promise<string> {
  return guard.read(strip);
}

/** true, wenn die Texterkennung nicht geladen werden konnte oder nicht mehr antwortet. */
export function ocrFailed(): boolean {
  return guard.state === 'failed';
}
