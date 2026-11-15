import cvModule from '@techstark/opencv-js';
import sharp from 'sharp';
import type { OpenCv } from '../../src/scan/detect';

/** Lädt OpenCV unter Node; das dauert ein paar Sekunden und geschieht nur einmal. */
export async function getCv(): Promise<OpenCv> {
  const mod = cvModule as OpenCv;
  if (mod instanceof Promise) return mod;
  if (mod.Mat) return mod;
  await new Promise<void>((resolve) => {
    mod.onRuntimeInitialized = () => resolve();
  });
  return mod;
}

/** Bilddatei → RGBA-Bild für OpenCV. Beachtet die Drehung, die Handys in der Datei vermerken. */
export async function matFromImage(cv: OpenCv, file: Buffer | string): Promise<OpenCv> {
  const { data, info } = await sharp(file).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mat = new cv.Mat(info.height, info.width, cv.CV_8UC4);
  mat.data.set(data);
  return mat;
}
