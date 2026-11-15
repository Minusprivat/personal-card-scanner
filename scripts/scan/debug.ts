/**
 * Zeichnet für Fotos aus `testdata/photos/` alle gefundenen Umrisse ein und schreibt dazu,
 * wie gut der Inhalt jedes Umrisses zu einem Katalogbild passt. Hilft zu sehen, warum eine
 * Karte nicht oder falsch erkannt wird.
 *
 * Aufruf: npx tsx scripts/scan/debug.ts 3,7,19     (Nummern der Fotos in sortierter Reihenfolge)
 * Ergebnis: .cache/debug/umrisse.jpg
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { findCandidates, warp } from '../../src/scan/detect';
import { matchCard } from '../../src/scan/matcher';
import { loadTestData, ROOT } from './common';
import { getCv, matFromImage } from './cv';

const PHOTO_DIR = path.join(ROOT, 'testdata', 'photos');
const OUT_DIR = path.join(ROOT, '.cache', 'debug');
const COLORS = ['#00ff88', '#ffd24a', '#ff5ad1', '#4ab3ff', '#ff7a3d', '#ffffff'];
const CELL = 620;

async function main() {
  const picks = (process.argv[2] ?? '').split(',').map(Number).filter(Boolean);
  const files = (await readdir(PHOTO_DIR)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const cv = await getCv();
  const data = await loadTestData();
  const nameOf = (imageId: string) => data.skusByImage.get(imageId)?.[0]?.publicCode ?? '?';

  const cells: Buffer[] = [];
  for (const i of picks.length ? picks : files.map((_, k) => k + 1)) {
    const file = files[i - 1];
    if (!file) continue;
    const frame = await matFromImage(cv, path.join(PHOTO_DIR, file));
    const scale = (CELL - 20) / Math.max(frame.cols, frame.rows);
    const w = Math.round(frame.cols * scale);
    const h = Math.round(frame.rows * scale);
    const lines: string[] = [];
    const polygons = findCandidates(cv, frame).map((c, k) => {
      const best = matchCard(data.fingerprints, warp(cv, frame, c.corners), 1).matches[0];
      lines.push(`${c.method[0]}${(c.areaShare * 100).toFixed(0)}% ${best ? `${nameOf(best.imageId)} d=${best.distance}` : '-'}`);
      const points = c.corners.map((p) => `${p.x * scale},${p.y * scale}`).join(' ');
      return `<polygon points="${points}" fill="none" stroke="${COLORS[k % COLORS.length]}" stroke-width="3"/>`;
    });
    frame.delete();
    const text = [`${i}: ${lines.length ? '' : 'kein Kandidat'}`, ...lines]
      .map((t, k) => `<text x="4" y="${18 + k * 18}" font-family="Arial" font-size="15" fill="${k ? COLORS[(k - 1) % COLORS.length] : '#fff'}">${t}</text>`)
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${polygons.join('')}<rect width="250" height="${22 + lines.length * 18}" fill="#000" fill-opacity="0.75"/>${text}</svg>`;
    cells.push(await sharp(path.join(PHOTO_DIR, file)).rotate().resize({ width: w, height: h }).composite([{ input: Buffer.from(svg) }]).jpeg().toBuffer());
  }

  const cols = Math.min(4, cells.length);
  await mkdir(OUT_DIR, { recursive: true });
  await sharp({ create: { width: cols * CELL, height: Math.ceil(cells.length / cols) * CELL, channels: 3, background: '#222' } })
    .composite(cells.map((c, k) => ({ input: c, left: (k % cols) * CELL, top: Math.floor(k / cols) * CELL })))
    .jpeg({ quality: 82 })
    .toFile(path.join(OUT_DIR, 'umrisse.jpg'));
  console.log(`${cells.length} Fotos → .cache/debug/umrisse.jpg`);
}

await main();
