// Crops a region's satellite texture and overlays a labelled lat/lon grid, to place map pins.
// node tools/grid-crop.mjs <region> <lat0> <lat1> <lon0> <lon1> <step> <out.jpg>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const [id, la0, la1, lo0, lo1, st, outName] = process.argv.slice(2);
const [lat0, lat1, lon0, lon1, step] = [la0, la1, lo0, lo1, st].map(Number);
const R = JSON.parse(fs.readFileSync(path.join(root, 'public/terrain/regions.json'), 'utf8')).find((r) => r.id === id);
const src = sharp(path.join(root, `public/terrain/${id}-sat.jpg`));
const { width: T } = await src.metadata();
const X = (lon) => ((lon - R.lon0) / (R.lon1 - R.lon0)) * T;
const Y = (lat) => ((R.lat1 - lat) / (R.lat1 - R.lat0)) * T;
const left = Math.round(X(lon0)), top = Math.round(Y(lat1));
const w = Math.round(X(lon1) - left), h = Math.round(Y(lat0) - top);
const OUT = 1400, s = OUT / w;
let svg = `<svg width="${OUT}" height="${Math.round(h * s)}" xmlns="http://www.w3.org/2000/svg">`;
for (let lon = Math.ceil(lon0 / step) * step; lon <= lon1; lon += step) {
  const x = (X(lon) - left) * s;
  svg += `<line x1="${x}" y1="0" x2="${x}" y2="${h * s}" stroke="#ff0" stroke-opacity="0.5"/><text x="${x + 3}" y="14" font-size="13" fill="#ff0" font-family="Arial">${lon.toFixed(2)}E</text>`;
}
for (let lat = Math.ceil(lat0 / step) * step; lat <= lat1; lat += step) {
  const y = (Y(lat) - top) * s;
  svg += `<line x1="0" y1="${y}" x2="${OUT}" y2="${y}" stroke="#ff0" stroke-opacity="0.5"/><text x="3" y="${y - 3}" font-size="13" fill="#ff0" font-family="Arial">${lat.toFixed(2)}N</text>`;
}
svg += '</svg>';
await src.extract({ left, top, width: w, height: h }).resize(OUT).modulate({ brightness: 1.5, saturation: 1.3 })
  .composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 80 }).toFile(path.join(import.meta.dirname, outName));
