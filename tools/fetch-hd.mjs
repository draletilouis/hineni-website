// Fetches 1080p originals for the landscape hero clips (desktop hero plays these full-screen).
// Saved as data/raw-video/<key>-1080.mp4; tools/trim-videos.mjs prefers them when present.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const sel = JSON.parse(fs.readFileSync(path.join(root, 'data/selection.json'), 'utf8'));
const HD = ['v-hero-water', 'v-m-falls-wide', 'v-hero-elephant', 'v-m-croc', 'v-hero-storm', 'v-m-falls-chasm'];

for (const key of HD) {
  const v = sel.videos.find((x) => x.key === key);
  const album = JSON.parse(fs.readFileSync(path.join(root, `data/${v.album || 'album'}.json`), 'utf8'));
  const m = album[v.i];
  const out = path.join(root, 'data/raw-video', `${key}-1080.mp4`);
  if (fs.existsSync(out)) continue;
  const part = out + '.part';
  for (let a = 0; ; a++) {
    try { execFileSync('curl.exe', ['-s', '-L', '-f', '--retry', '6', '--retry-all-errors', '-C', '-', '-o', part, `${m.url}=m37`]); break; }
    catch (e) { if (a >= 8) throw e; }
  }
  fs.renameSync(part, out);
  console.log(key, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
}
