// Trims each clip to its best moment and re-encodes for the web.
// Raw downloads are kept in data/raw-video so this can be re-run with new trim points.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const FFMPEG = path.join(import.meta.dirname, 'node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe');
const root = path.resolve(import.meta.dirname, '..');
const media = path.join(root, 'public/media');
const raw = path.join(root, 'data/raw-video');
fs.mkdirSync(raw, { recursive: true });

// key: [start seconds, length seconds]
const TRIM = {
  'v-hero-water': [2, 9],
  'v-hero-elephant': [0, 9],
  'v-hero-storm': [0, 10],
  'v-hero-falls': [8, 8],
  'v-hero-sunrise': [0, 8],
  'v-elephants-drink': [4, 10],
  'v-lake-pan': [0, 8],
  'v-leopard': [18, 6],
  'v-hippo': [2, 9],
  'v-buffalo': [0, 6],
  'v-kob': [0, 7],
  'v-crater': [6, 9],
  'v-falls': [0, 8],
  'v-hippo-pod': [0, 9],
  'v-drive': [2, 8],
  'v-forest': [0, 10],
  'v-salt': [0, 5],
  // Murchison, July 2026
  'v-m-tusker': [26, 9],
  'v-m-elephant-nile': [6, 9],
  'v-m-croc': [0, 8],
  'v-m-hyena-road': [0, 8],
  'v-m-hyena-close': [0, 3],
  'v-m-giraffes': [4, 9],
  'v-m-buffalo-birds': [0, 9],
  'v-m-falls-wide': [0, 10],
  'v-m-falls-chasm': [0, 10],
  'v-m-falls-mist': [0, 3],
  'v-m-hippo': [0, 8],
  'v-m-buffalo-nile': [2, 9],
};

// Quality-first encoding with a bitrate ceiling: CRF keeps calm shots small, maxrate stops
// churning water and grass from ballooning. Bump ENC when the settings change to force a re-encode.
const ENC = 'v2-clear';
const enc = (src, out, [ss, t], maxSide, crf, maxrate) => {
  // scale so the long side is maxSide, keep even dimensions
  const vf = `scale='if(gt(iw,ih),${maxSide},-2)':'if(gt(iw,ih),-2,${maxSide})':flags=lanczos,fps=30`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(ss), '-t', String(t), '-i', src,
    '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-maxrate', maxrate, '-bufsize', maxrate.replace('M', '') * 2 + 'M',
    '-x264-params', 'aq-mode=3', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart', out]);
};

// only re-encode clips whose trim (or encoder settings) changed since the last run
const stampFile = path.join(raw, 'trims.json');
const stamps = fs.existsSync(stampFile) ? JSON.parse(fs.readFileSync(stampFile, 'utf8')) : {};

let total = 0;
for (const [key, trim] of Object.entries(TRIM)) {
  const big = path.join(raw, `${key}.mp4`);
  const hd = path.join(raw, `${key}-1080.mp4`);
  if (!fs.existsSync(big)) fs.renameSync(path.join(media, `${key}.mp4`), big);
  const out = path.join(media, `${key}.mp4`);
  const stamp = `${ENC}:${trim.join(',')}:${fs.existsSync(hd) ? 'hd' : 'sd'}`;
  if (stamps[key] === stamp && fs.existsSync(out)) continue;
  if (fs.existsSync(hd)) enc(hd, out, trim, 1920, 24, '4.5M');   // full-screen desktop hero
  else enc(big, out, trim, 1280, 23, '2.8M');
  // phones: cut from the 720p source (never upscale the old 360p copies)
  enc(big, path.join(media, `${key}-sm.mp4`), trim, 960, 25, '1.6M');
  stamps[key] = stamp;
  fs.writeFileSync(stampFile, JSON.stringify(stamps, null, 1));
  // poster = first frame of the trimmed clip
  const png = path.join(raw, `${key}-poster.png`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(media, `${key}.mp4`), '-frames:v', '1', png]);
  await sharp(png).resize(1280, 1280, { fit: 'inside' }).webp({ quality: 78 }).toFile(path.join(media, `${key}-poster.webp`));
  const s = fs.statSync(path.join(media, `${key}.mp4`)).size + fs.statSync(path.join(media, `${key}-sm.mp4`)).size;
  total += s;
  console.log(key.padEnd(20), (s / 1e6).toFixed(2), 'MB');
}
// unused clips
for (const key of ['v-lion', 'v-elephant-road', 'v-tea']) {
  for (const suf of ['.mp4', '-sm.mp4', '-poster.webp']) {
    const f = path.join(media, key + suf);
    if (fs.existsSync(f)) fs.renameSync(f, path.join(raw, key + suf));
  }
}
console.log('total video', (total / 1e6).toFixed(1), 'MB');
