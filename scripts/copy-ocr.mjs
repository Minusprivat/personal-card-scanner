// Legt die Dateien der Texterkennung (Tesseract) unter public/ocr/ ab, damit die App sie
// selbst ausliefert und nichts von fremden Servern nachlädt. Läuft vor `dev` und `build`.
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  // Startet die Texterkennung in einem eigenen Hintergrund-Thread.
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Rechenkern. Die SIMD-Fassung läuft in jedem Chrome ab Version 91, also auch im Android-WebView.
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  // Sprachmodell Englisch, kleine Fassung (2,9 MB); sie liest die Nummernzeile so gut wie die große (10,9 MB).
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
for (const [from, to] of files) copyFileSync(path.join(root, from), path.join(out, to));
console.log(`Texterkennung: ${files.length} Dateien nach public/ocr/ kopiert.`);
