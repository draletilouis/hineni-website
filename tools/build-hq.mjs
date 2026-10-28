// Re-builds every photo from near-original resolution, without touching its colours.
//   source: Google Photos at up to 3200 px (the phones shoot ~4000 px), cached in data/raw-photos/
//   output: <key>-2800.webp (big screens / lightbox), -2000 (legacy), -1600 (laptops, phones), -900 (cards)
// ICC profiles are kept so wide-gamut phone photos show their true colours.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sel = JSON.parse(fs.readFileSync(path.join(root, 'data/selection.json'), 'utf8'));
const rawDir = path.join(root, 'data/raw-photos');
const out = path.join(root, 'public/media');
fs.mkdirSync(rawDir, { recursive: true });
const albums = {};
const albumOf = (n = 'album') => (albums[n] ||= JSON.parse(fs.readFileSync(path.join(root, `data/${n}.json`), 'utf8')));

const SIZES = [[2800, 86], [2000, 85], [1600, 84], [900, 82]];

function download(url, file) {
  if (fs.existsSync(file)) return;
  const part = file + '.part';
  for (let a = 0; ; a++) {
    try { execFileSync('curl.exe', ['-s', '-L', '-f', '--retry', '6', '--retry-all-errors', '-C', '-', '-o', part, url]); break; }
    catch (e) { if (a >= 6) throw e; }
  }
  fs.renameSync(part, file);
}

async function pool(items, n, fn) {
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const j = k++; await fn(items[j]); } }));
}

let done = 0;
await pool(sel.photos, 4, async (p) => {
  if (!process.env.FORCE && fs.existsSync(path.join(out, `${p.key}-2800.webp`))) { done++; return; }
  const m = albumOf(p.album)[p.i];
  const raw = path.join(rawDir, `${p.key}.jpg`);
  download(`${m.url}=w3200-h3200`, raw);
  const meta = await sharp(raw).metadata();
  for (const [size, q] of SIZES) {
    await sharp(raw).rotate()
      .resize(size, size, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .keepIccProfile()
      .webp({ quality: q, effort: 5, smartSubsample: true })
      .toFile(path.join(out, `${p.key}-${size}.webp`));
  }
  done++;
  if (done % 10 === 0) console.log(`${done}/${sel.photos.length} (${p.key} source ${meta.width}×${meta.height})`);
});
console.log('done', done);
