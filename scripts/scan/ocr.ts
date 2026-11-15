import path from 'node:path';
import sharp from 'sharp';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { StripImage } from '../../src/scan/detect';
import { NUMBER_CHARS } from '../../src/scan/number';
import { ROOT } from './common';

/** Texterkennung unter Node, mit denselben Einstellungen wie in der App. */
export async function createOcr(): Promise<{ readLine(strip: StripImage): Promise<string>; close(): Promise<void> }> {
  const worker: Worker = await createWorker('eng', 1, {
    langPath: path.join(ROOT, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int'),
    gzip: true,
    cachePath: path.join(ROOT, '.cache', 'tesseract'),
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: NUMBER_CHARS });
  return {
    async readLine(strip) {
      const png = await sharp(Buffer.from(strip.data.buffer, strip.data.byteOffset, strip.data.byteLength), {
        raw: { width: strip.width, height: strip.height, channels: 4 },
      })
        .png()
        .toBuffer();
      const { data } = await worker.recognize(png);
      return data.text.trim();
    },
    close: async () => {
      await worker.terminate();
    },
  };
}
