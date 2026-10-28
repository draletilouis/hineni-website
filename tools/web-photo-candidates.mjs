// Finds openly licensed photos of the places we have no pictures of yet, on Wikimedia Commons.
// Only CC BY, CC BY-SA, CC0 and public-domain files, at least 1200 px wide, are kept.
// Writes data/web-candidates.json and a numbered contact sheet per place in data/web-sheets/
// to choose from by eye; then list the picks in tools/web-photos.mjs and run that.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const sheets = path.join(root, 'data/web-sheets');
fs.mkdirSync(sheets, { recursive: true });
const UA = { 'user-agent': 'hineni-site-photo-credits/1.0 (small tour website; attribution kept)' };

// place id → Commons searches, most specific first
const QUERIES = {
  wamala: ['Lake Wamala', 'Wamala Mityana', 'Lake Wamala Uganda fishing'],
  nakayima: ['Nakayima tree', 'Nakayima Mubende'],
  ziwa: ['Ziwa Rhino Sanctuary', 'Ziwa rhino Uganda'],
  palace: ['Tooro palace Fort Portal', 'Karuzika palace'],
  botanical: ['Tooro Botanical Gardens Uganda', 'botanical garden Fort Portal Uganda'],
  saaka: ['Lake Saaka', 'Saaka crater lake Fort Portal'],
  sempaya: ['Sempaya hot springs', 'Semuliki hot springs'],
  topworld: ['Top of the World Fort Portal crater lakes', 'Ndali Kasenda crater lakes viewpoint', 'Top of the World Kasenda', 'crater lakes Kabarole viewpoint'],
  nkuruba: ['Lake Nkuruba'],
  nyabikere: ['Lake Nyabikere'],
  nyinambuga: ['Lake Nyinambuga', 'Nyinambuga crater', 'Ndali lodge Uganda'],
  kasenda: ['Lake Kasenda', 'Kasenda crater lake', 'Kasenda Uganda'],
  bigodi: ['Bigodi wetland', 'Bigodi swamp'],
  katwecraters: ['Katwe craters Queen Elizabeth', 'Explosion crater Queen Elizabeth National Park'],
  katwe: ['Lake Katwe salt', 'Katwe salt mining', 'Lake Katwe', 'Katwe salt pans Uganda'],
  munyanyange: ['Lake Munyanyange', 'flamingos Queen Elizabeth National Park'],
  mweya: ['Mweya peninsula', 'Mweya Lake Edward'],
  kyambura: ['Kyambura gorge', 'Kyambura'],
  maramagambo: ['Maramagambo forest', 'Maramagambo bat cave', 'Maramagambo', 'bat cave Queen Elizabeth National Park'],
  mpanga: ['Mpanga falls Uganda', 'Mpanga falls Kamwenge', 'Mpanga river Uganda waterfall'],
  kilembe: ['Kilembe mines', 'Kilembe Kasese'],
};
const OPEN = /^(cc[- ]by(-sa)?[- ][\d.]+|cc0|public domain|pd\b)/i;
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const cacheDir = path.join(root, 'data/web-cache');
fs.mkdirSync(cacheDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Commons asks for a slow, steady pace: one request at a time, a pause between, and back off when told to
async function getJSON(u) {
  for (let a = 0; ; a++) {
    const r = await fetch(u, { headers: UA });
    const t = await r.text();
    await sleep(2000);
    try { return JSON.parse(t); } catch { if (a === 4) throw new Error(t.slice(0, 80)); await sleep(30000 * (a + 1)); }
  }
}
async function search(q) {
  const cf = path.join(cacheDir, q.replace(/[^a-z0-9]+/gi, '_') + '.json');
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const list = await searchLive(q);
  fs.writeFileSync(cf, JSON.stringify(list));
  return list;
}
async function searchLive(q) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${q} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 12,
    prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: 480 }).forEach(([k, v]) => u.searchParams.set(k, v));
  const j = await getJSON(u);
  return Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index).map((p) => {
    const ii = p.imageinfo?.[0] || {}, m = ii.extmetadata || {};
    return { title: p.title, page: ii.descriptionurl, url: ii.url, thumb: ii.thumburl, w: ii.width, h: ii.height, mime: ii.mime,
      license: strip(m.LicenseShortName?.value), licenseUrl: m.LicenseUrl?.value || '', artist: strip(m.Artist?.value), desc: strip(m.ImageDescription?.value).slice(0, 160) };
  }).filter((c) => /jpeg|png/.test(c.mime) && c.w >= 1200 && OPEN.test(c.license) && !/\b(NC|ND)\b/.test(c.license));
}

const out = {};
for (const [id, qs] of Object.entries(QUERIES)) {
  const seen = new Set(), list = [];
  for (const q of qs) for (const c of await search(q)) if (!seen.has(c.title) && list.length < 8) { seen.add(c.title); list.push(c); }
  out[id] = list;
  console.log(`${id}: ${list.length}`);
  if (!list.length || fs.existsSync(path.join(sheets, `${id}.jpg`))) continue;
  // contact sheet: 4 across, numbered, with the file name under each
  const W = 360, H = 240, cols = 4, rows = Math.ceil(list.length / cols);
  const tiles = [];
  for (const [i, c] of list.entries()) tiles.push(await (async () => {
    // thumbnails come from the main upload host (the thumb host times out); a refused one is retried, then left blank
    let img;
    for (let a = 0; a < 3 && !img; a++) {
      const buf = Buffer.from(await (await fetch(c.thumb.replace('://thumb.wikimedia.org/', '://upload.wikimedia.org/'), { headers: UA })).arrayBuffer());
      await sleep(800 + a * 8000);
      img = await sharp(buf).resize(W, H, { fit: 'cover' }).toBuffer().catch(() => null);
    }
    img ||= await sharp({ create: { width: W, height: H, channels: 3, background: '#555' } }).png().toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="${H + 30}"><rect y="${H}" width="${W}" height="30" fill="#111"/><text x="8" y="${H + 20}" font-size="14" fill="#fff" font-family="sans-serif">${i + 1}. ${c.w}×${c.h} ${c.title.slice(5, 40).replace(/[<&>]/g, '')}</text></svg>`);
    return sharp({ create: { width: W, height: H + 30, channels: 3, background: '#111' } }).composite([{ input: img, top: 0, left: 0 }, { input: label, top: 0, left: 0 }]).png().toBuffer();
  })());
  await sharp({ create: { width: cols * (W + 6), height: rows * (H + 36), channels: 3, background: '#333' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * (W + 6), top: Math.floor(i / cols) * (H + 36) })))
    .jpeg({ quality: 80 }).toFile(path.join(sheets, `${id}.jpg`));
}
fs.writeFileSync(path.join(root, 'data/web-candidates.json'), JSON.stringify(out, null, 1));
console.log('done');
