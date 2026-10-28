// Downloads the curated album picks (data/selection.json) into public/media
// and writes src/data/media.json for the site.
//   photos -> <key>-2000.webp (full), <key>-900.webp (cards / WebGL textures)
//   videos -> <key>.mp4 (720p) + <key>-sm.mp4 (360p, mobile) + <key>-poster.webp
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const albums = {};
const albumOf = (name = 'album') => (albums[name] ||= new Map(JSON.parse(fs.readFileSync(path.join(root, `data/${name}.json`), 'utf8')).map((m) => [m.i, m])));
const sel = JSON.parse(fs.readFileSync(path.join(root, 'data/selection.json'), 'utf8'));
const out = path.join(root, 'public/media');
fs.mkdirSync(out, { recursive: true });


async function get(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (a === 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (a + 1)));
    }
  }
}

async function photo(p) {
  const m = albumOf(p.album).get(p.i);
  const full = path.join(out, `${p.key}-2000.webp`);
  const small = path.join(out, `${p.key}-900.webp`);
  if (!fs.existsSync(full) || !fs.existsSync(small)) {
    const buf = await get(`${m.url}=w2000-h2000`);
    await sharp(buf).rotate().resize(2000, 2000, { fit: 'inside' }).webp({ quality: 78 }).toFile(full);
    await sharp(buf).rotate().resize(900, 900, { fit: 'inside' }).webp({ quality: 74 }).toFile(small);
  }
  const meta = await sharp(full).metadata();
  return { ...p, w: meta.width, h: meta.height, t: m.t };
}

async function video(v) {
  const m = albumOf(v.album).get(v.i);
  const mp4 = path.join(out, `${v.key}.mp4`);
  const sm = path.join(out, `${v.key}-sm.mp4`);
  const poster = path.join(out, `${v.key}-poster.webp`);
  // big files: curl survives the dropped connections Node's fetch gives up on
  const dl = (url, file) => {
    const part = file + '.part';
    for (let a = 0; ; a++) {
      try {
        execFileSync('curl.exe', ['-s', '-L', '-f', '--retry', '6', '--retry-all-errors', '-C', '-', '-o', part, url]);
        break;
      } catch (e) {
        if (a >= 8) throw e;
      }
    }
    fs.renameSync(part, file);
  };
  // only the 720p original is fetched; tools/trim-videos.mjs cuts both web sizes from it
  const raw = path.join(root, 'data/raw-video', `${v.key}.mp4`);
  fs.mkdirSync(path.dirname(raw), { recursive: true });
  if (!fs.existsSync(mp4) && !fs.existsSync(raw)) dl(`${m.url}=m22`, raw);
  if (!fs.existsSync(poster)) {
    await sharp(await get(`${m.url}=w1280-h1280`)).resize(1280, 1280, { fit: 'inside' }).webp({ quality: 70 }).toFile(poster);
  }
  const meta = await sharp(poster).metadata();
  void sm;
  return { ...v, w: meta.width, h: meta.height, dur: Math.round(m.durMs / 100) / 10, t: m.t };
}

async function pool(list, n, fn) {
  const res = new Array(list.length);
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (k < list.length) { const j = k++; res[j] = await fn(list[j]); }
  }));
  return res;
}

const photos = await pool(sel.photos, 8, photo);
const videos = await pool(sel.videos, 2, video);
const manifest = {
  photos: Object.fromEntries(photos.map((p) => [p.key, p])),
  videos: Object.fromEntries(videos.map((v) => [v.key, v])),
};
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/media.json'), JSON.stringify(manifest, null, 1));

const size = fs.readdirSync(out).reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log(`photos=${photos.length} videos=${videos.length} total=${(size / 1e6).toFixed(1)}MB`);


