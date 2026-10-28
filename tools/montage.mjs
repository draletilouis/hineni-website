// Side-by-side montage of downloaded photos: node tools/montage.mjs out.jpg key1 key2 ...
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(import.meta.dirname, '..');
const [out, ...keys] = process.argv.slice(2);
const [W, H] = (process.env.TALL ? [300, 400] : [400, 300]), COLS = process.env.TALL ? 7 : 5;
const layers = [];
for (const [j, k] of keys.entries()) {
  const left = (j % COLS) * W, top = Math.floor(j / COLS) * H;
  layers.push({ input: await sharp(path.join(root, `public/media/${k}-900.webp`)).resize(W, H, { fit: 'cover' }).toBuffer(), left, top });
  layers.push({ input: Buffer.from(`<svg width="${k.length * 11 + 12}" height="24"><rect width="100%" height="100%" fill="#000"/><text x="6" y="17" font-family="Arial" font-size="15" fill="#fff">${k}</text></svg>`), left, top });
}
await sharp({ create: { width: COLS * W, height: Math.ceil(keys.length / COLS) * H, channels: 3, background: '#222' } })
  .composite(layers).jpeg({ quality: 75 }).toFile(path.join(import.meta.dirname, out));
