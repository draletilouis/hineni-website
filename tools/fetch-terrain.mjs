// Builds real terrain for the 3D route map.
//   elevation: AWS Terrain Tiles (Terrarium PNG, SRTM-derived)  https://registry.opendata.aws/terrain-tiles
//   imagery:   Sentinel-2 cloudless 2016 by EOX (CC BY 4.0)      https://s2maps.eu
// For each region it writes
//   public/terrain/<id>-height.dat  gzip of row-delta Int16 metres, row-major north→south, size N×N
//   public/terrain/<id>-sat.jpg     satellite colour, same bounds
// and public/terrain/regions.json describing bounds and sizes.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/terrain');
const cache = path.join(root, 'data/tile-cache');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(cache, { recursive: true });

// lat0/lat1 south/north, lon0/lon1 west/east
const REGIONS = [
  // texture sizes are a GPU-memory budget: Fort Portal is the showcase, the rest stay at 2048
  { id: 'overview', lat0: -2.0, lat1: 4.6, lon0: 28.1, lon1: 34.1, demZ: 9, satZ: 10, grid: 1024, tex: 2048 },
  { id: 'fortportal', lat0: 0.3, lat1: 0.82, lon0: 30.0, lon1: 30.52, demZ: 12, satZ: 14, grid: 768, tex: 4096 },
  { id: 'murchison', lat0: 2.05, lat1: 2.45, lon0: 31.3, lon1: 31.85, demZ: 12, satZ: 13, grid: 640, tex: 2048 },
  { id: 'qenp', lat0: -0.32, lat1: 0.12, lon0: 29.78, lon1: 30.22, demZ: 12, satZ: 13, grid: 640, tex: 2048 },
  // Moyo, the Albert Nile crossing and the border mountains (Mt Buce / Oce / Ilo)
  { id: 'moyo', lat0: 3.35, lat1: 3.88, lon0: 31.42, lon1: 31.95, demZ: 12, satZ: 13, grid: 640, tex: 2048 },
];

const UA = { headers: { 'user-agent': 'hineni-site-terrain-build/1.0' } };
const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };

async function tile(kind, z, x, y) {
  const f = path.join(cache, `${kind}-${z}-${x}-${y}.${kind === 'dem' ? 'png' : 'jpg'}`);
  if (fs.existsSync(f)) return fs.readFileSync(f);
  const url = kind === 'dem'
    ? `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
    : `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`;
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url, UA);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const b = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(f, b);
      return b;
    } catch (e) {
      if (a === 4) throw e;
      await new Promise((res) => setTimeout(res, 800 * (a + 1)));
    }
  }
}

async function pool(items, n, fn) {
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const j = k++; await fn(items[j]); } }));
}

// stitch the tile mosaic covering the region; returns raw RGB buffer plus its pixel origin
async function mosaic(kind, R, z) {
  const x0 = Math.floor(lon2x(R.lon0, z)), x1 = Math.floor(lon2x(R.lon1, z));
  const y0 = Math.floor(lat2y(R.lat1, z)), y1 = Math.floor(lat2y(R.lat0, z));
  const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
  const jobs = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
  const layers = [];
  await pool(jobs, 8, async ([x, y]) => {
    const buf = await tile(kind, z, x, y);
    layers.push({ input: await sharp(buf).removeAlpha().toColourspace('srgb').raw().toBuffer(), raw: { width: 256, height: 256, channels: 3 }, left: (x - x0) * 256, top: (y - y0) * 256 });
  });
  // composite() adds an alpha channel; strip it so pixels are tightly packed RGB
  const img = await sharp(await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(layers).png().toBuffer())
    .removeAlpha().raw().toBuffer();
  console.log(`  ${kind} z${z}: ${jobs.length} tiles, ${W}×${H}`);
  return { img, W, H, ox: x0 * 256, oy: y0 * 256 };
}

// pixel position (in mosaic) of a lat/lon
const px = (M, z, lat, lon) => [lon2x(lon, z) * 256 - M.ox, lat2y(lat, z) * 256 - M.oy];

for (const R of REGIONS) {
  console.log(R.id);
  // --- elevation grid, sampled on a regular lat/lon lattice
  const D = await mosaic('dem', R, R.demZ);
  const elev = (x, y) => {
    x = Math.max(0, Math.min(D.W - 1, x)); y = Math.max(0, Math.min(D.H - 1, y));
    const i = (y * D.W + x) * 3;
    return D.img[i] * 256 + D.img[i + 1] + D.img[i + 2] / 256 - 32768;
  };
  const N = R.grid;
  const grid = new Uint16Array(N * N);
  let min = 1e9, max = -1e9;
  for (let r = 0; r < N; r++) {
    const lat = R.lat1 - ((R.lat1 - R.lat0) * r) / (N - 1);
    for (let c = 0; c < N; c++) {
      const lon = R.lon0 + ((R.lon1 - R.lon0) * c) / (N - 1);
      const [fx, fy] = px(D, R.demZ, lat, lon);
      const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
      const e = elev(x, y) * (1 - tx) * (1 - ty) + elev(x + 1, y) * tx * (1 - ty) + elev(x, y + 1) * (1 - tx) * ty + elev(x + 1, y + 1) * tx * ty;
      // nothing in western Uganda sits below Lake Albert's surface (~619 m); lower values are SRTM voids
      const m = Math.max(615, Math.round(e));
      grid[r * N + c] = m;
      min = Math.min(min, m); max = Math.max(max, m);
    }
  }
  // row-wise delta encoding + gzip: terrain changes slowly, so deltas compress far better than raw heights.
  // The browser undoes this with DecompressionStream (see loadRegion in src/modules/terrain.js).
  const delta = new Int16Array(N * N);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      delta[i] = c === 0 ? grid[i] : grid[i] - grid[i - 1];
    }
  }
  fs.writeFileSync(path.join(out, `${R.id}-height.dat`), zlib.gzipSync(Buffer.from(delta.buffer), { level: 9 }));
  const oldBin = path.join(out, `${R.id}-height.bin`);
  if (fs.existsSync(oldBin)) fs.unlinkSync(oldBin);
  R.min = min; R.max = max;
  console.log(`  elevation ${min}–${max} m`);

  // --- satellite texture, cropped to the same bounds (rows resampled linear in latitude)
  const S = await mosaic('sat', R, R.satZ);
  const [lx, ty] = px(S, R.satZ, R.lat1, R.lon0);
  const [rx, by] = px(S, R.satZ, R.lat0, R.lon1);
  const cw = Math.round(rx - lx), ch = Math.round(by - ty);
  await sharp(S.img, { raw: { width: S.W, height: S.H, channels: 3 } })
    .extract({ left: Math.round(lx), top: Math.round(ty), width: cw, height: ch })
    .resize(R.tex, R.tex, { fit: 'fill', kernel: 'lanczos3' })
    .modulate({ saturation: 1.08 })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(out, `${R.id}-sat.jpg`));
}

fs.writeFileSync(path.join(out, 'regions.json'), JSON.stringify(REGIONS.map(({ id, lat0, lat1, lon0, lon1, grid, min, max }) => ({ id, lat0, lat1, lon0, lon1, grid, min, max })), null, 1));
const size = fs.readdirSync(out).reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log(`done — public/terrain ${(size / 1e6).toFixed(1)} MB`);
