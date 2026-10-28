// Larger review sheet for a shortlist: node tools/review-sheet.mjs out.jpg 1259 1277 ...
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const album = JSON.parse(fs.readFileSync(path.join(root, `data/${process.env.ALBUM || 'album'}.json`), 'utf8'));
const [outName, ...ids] = process.argv.slice(2);
const T = 360, COLS = 6;
const layers = [];
for (const [j, id] of ids.map(Number).entries()) {
  const m = album[id];
  const buf = Buffer.from(await (await fetch(`${m.url}=w${T}-h${T}`)).arrayBuffer());
  const left = (j % COLS) * T, top = Math.floor(j / COLS) * T;
  layers.push({ input: await sharp(buf).resize(T, T, { fit: 'contain', background: '#222' }).toBuffer(), left, top });
  const label = `${id}${m.video ? ' V' : ''}`;
  layers.push({ input: Buffer.from(`<svg width="${label.length * 14 + 10}" height="28"><rect width="100%" height="100%" fill="${m.video ? '#d00' : '#000'}"/><text x="5" y="21" font-family="Arial" font-size="20" font-weight="bold" fill="#fff">${label}</text></svg>`), left, top });
}
await sharp({ create: { width: COLS * T, height: Math.ceil(ids.length / COLS) * T, channels: 3, background: '#222' } })
  .composite(layers).jpeg({ quality: 72 }).toFile(path.join(import.meta.dirname, outName));

