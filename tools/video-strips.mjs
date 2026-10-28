// Filmstrips (one frame every 2s) of each source clip, to choose trim points.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

export const FFMPEG = path.join(import.meta.dirname, 'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
const root = path.resolve(import.meta.dirname, '..');
const media = path.join(root, 'public/media');
const tmp = path.join(import.meta.dirname, 'strips');
fs.mkdirSync(tmp, { recursive: true });
const sel = JSON.parse(fs.readFileSync(path.join(root, 'data/selection.json'), 'utf8'));

const H = 120, MAXF = 20;
const rows = [];
const only = process.argv[2]; // optional key prefix filter, e.g. "v-m-"
for (const v of sel.videos.filter((x) => !only || x.key.startsWith(only))) {
  const rawSrc = path.join(root, 'data/raw-video', `${v.key}.mp4`);
  const src = fs.existsSync(rawSrc) ? rawSrc : path.join(media, `${v.key}-sm.mp4`);
  const out = path.join(tmp, `${v.key}.jpg`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-vf', `fps=0.5,scale=-2:${H},tile=${MAXF}x1`, '-frames:v', '1', out]);
  const label = Buffer.from(`<svg width="190" height="${H}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="${H / 2 + 6}" font-family="Arial" font-size="15" fill="#fff">${v.key}</text></svg>`);
  rows.push({ label, img: await sharp(out).trim({ background: '#000000', threshold: 5 }).toBuffer() });
}
const widths = await Promise.all(rows.map(async (r) => (await sharp(r.img).metadata()).width));
const W = 190 + Math.max(...widths);
const layers = [];
rows.forEach((r, i) => {
  layers.push({ input: r.label, left: 0, top: i * H });
  layers.push({ input: r.img, left: 190, top: i * H });
});
await sharp({ create: { width: W, height: rows.length * H, channels: 3, background: '#222' } })
  .composite(layers).jpeg({ quality: 70 }).toFile(path.join(import.meta.dirname, 'strips-all.jpg'));
console.log('ok', W, rows.length * H);
