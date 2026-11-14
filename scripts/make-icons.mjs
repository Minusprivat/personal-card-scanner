// Erzeugt die App-Symbole als PNG, ohne zusätzliche Abhängigkeiten.
// Aufruf: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel((x + 0.5) / size, (y + 0.5) / size);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [16, 22, 34, 255];
const CARD = [233, 238, 247, 255];
const ART = [47, 111, 235, 255];
const SCAN = [56, 211, 159, 255];
const CLEAR = [0, 0, 0, 0];

// Abgerundetes Rechteck um (cx, cy) mit halber Breite/Höhe und Eckenradius.
const inRound = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.max(Math.abs(x - cx) - (hw - r), 0);
  const dy = Math.max(Math.abs(y - cy) - (hh - r), 0);
  return dx * dx + dy * dy <= r * r;
};

/** scale < 1 verkleinert das Motiv für „maskable“, damit nichts abgeschnitten wird. */
const icon = (scale, roundedBackground) => (x, y) => {
  if (roundedBackground && !inRound(x, y, 0.5, 0.5, 0.5, 0.5, 0.2)) return CLEAR;
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;
  if (Math.abs(v - 0.5) < 0.022 && Math.abs(u - 0.5) < 0.4) return SCAN;
  if (inRound(u, v, 0.5, 0.5, 0.23, 0.32, 0.04)) {
    if (inRound(u, v, 0.5, 0.42, 0.18, 0.19, 0.025)) return ART;
    return CARD;
  }
  return BG;
};

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'icon-192.png'), png(192, icon(1, true)));
writeFileSync(path.join(out, 'icon-512.png'), png(512, icon(1, true)));
writeFileSync(path.join(out, 'maskable-512.png'), png(512, icon(0.72, false)));
writeFileSync(path.join(out, 'apple-touch-icon.png'), png(180, icon(0.9, false)));
console.log('Symbole geschrieben nach', out);
