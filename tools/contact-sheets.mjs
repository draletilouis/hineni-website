// Builds numbered contact sheets from data/album.json so shots can be picked visually.
// Output: tools/sheets/sheet-XX.jpg (8 x 6 tiles, number = album index, red tag = video)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const albumName = process.argv[2] || 'album';
const media = JSON.parse(fs.readFileSync(path.join(root, `data/${albumName}.json`), 'utf8'));
const thumbDir = path.join(import.meta.dirname, albumName === 'album' ? 'thumbs' : `thumbs-${albumName}`);
const sheetDir = path.join(import.meta.dirname, albumName === 'album' ? 'sheets' : `sheets-${albumName}`);
fs.mkdirSync(thumbDir, { recursive: true });
fs.mkdirSync(sheetDir, { recursive: true });

const T = 200, COLS = 8, ROWS = 6, PER = COLS * ROWS;

async function thumb(m) {
  const f = path.join(thumbDir, `${m.i}.jpg`);
  if (fs.existsSync(f)) return f;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(`${m.url}=w${T}-h${T}-c`);
      if (!r.ok) throw new Error(r.status);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      return f;
    } catch (e) { await new Promise((r) => setTimeout(r, 800)); }
  }
  return null;
}

async function pool(list, n, fn) {
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < list.length) await fn(list[k++]); }));
}

await pool(media, 16, thumb);

for (let s = 0; s * PER < media.length; s++) {
  const chunk = media.slice(s * PER, (s + 1) * PER);
  const layers = [];
  for (const [j, m] of chunk.entries()) {
    const f = path.join(thumbDir, `${m.i}.jpg`);
    const left = (j % COLS) * T, top = Math.floor(j / COLS) * T;
    if (fs.existsSync(f)) layers.push({ input: await sharp(f).resize(T, T, { fit: 'cover' }).toBuffer(), left, top });
    const label = m.video ? `${m.i} V${Math.round(m.durMs / 1000)}s` : `${m.i}`;
    const bg = m.video ? '#d00' : '#000';
    const wpx = label.length * 13 + 10;
    layers.push({
      input: Buffer.from(`<svg width="${wpx}" height="28"><rect width="100%" height="100%" fill="${bg}" opacity="0.85"/><text x="5" y="21" font-family="Arial" font-size="20" font-weight="bold" fill="#fff">${label}</text></svg>`),
      left, top,
    });
  }
  await sharp({ create: { width: COLS * T, height: ROWS * T, channels: 3, background: '#222' } })
    .composite(layers).jpeg({ quality: 70 })
    .toFile(path.join(sheetDir, `sheet-${String(s).padStart(2, '0')}.jpg`));
}
console.log('sheets:', fs.readdirSync(sheetDir).length);

