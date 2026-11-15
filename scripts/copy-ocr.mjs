// Legt die Dateien der Texterkennung (Tesseract) unter public/ocr/ ab, damit die App sie
// selbst ausliefert und nichts von fremden Servern nachlädt. Läuft vor `dev` und `build`.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  // Startet die Texterkennung in einem eigenen Hintergrund-Thread.
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Rechenkern. Die SIMD-Fassung läuft in jedem Chrome ab Version 91, also auch im Android-WebView.
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
];
for (const [from, to] of files) copyFileSync(path.join(root, from), path.join(out, to));

// Sprachmodell Englisch, kleine Fassung; sie liest die Nummernzeile so gut wie die große.
// Es wird ausgepackt abgelegt (5,2 statt 2,9 MB): Der Android-Bau packt .gz-Dateien von
// selbst aus und benennt sie um; die App fände eine .gz-Datei in der APK deshalb nicht.
const model = readFileSync(path.join(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'));
writeFileSync(path.join(out, 'eng.traineddata'), gunzipSync(model));
rmSync(path.join(out, 'eng.traineddata.gz'), { force: true });

console.log(`Texterkennung: ${files.length + 1} Dateien nach public/ocr/ kopiert.`);
