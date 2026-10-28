// Photos of places we haven't taken a group to yet, from Wikimedia Commons, chosen by eye from the
// contact sheets that tools/web-photo-candidates.mjs makes. All are CC BY / CC BY-SA, so the site
// shows each photographer's name, the licence and a link to the original wherever the photo appears.
//   writes public/media/w-*.webp (same sizes as our own photos) and src/data/web-photos.json (credits)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/media');
const rawDir = path.join(root, 'data/web-raw');
fs.mkdirSync(rawDir, { recursive: true });
const cand = JSON.parse(fs.readFileSync(path.join(root, 'data/web-candidates.json'), 'utf8'));
const SIZES = [[2800, 86], [2000, 85], [1600, 84], [900, 82]];

// place id → candidate numbers on its contact sheet (1-based), best first
const PICKS = {
  nakayima: [2, 1], ziwa: [3, 6], palace: [3], saaka: [3, 1], sempaya: [5, 6], nkuruba: [1], nyabikere: [1],
  bigodi: [8, 1], katwecraters: [1, 2], katwe: [1], munyanyange: [1, 2], mweya: [1], kyambura: [1, 3], kilembe: [1, 5],
};
// short captions in the site's voice (the Commons descriptions are kept in the credit link)
const ALT = {
  'w-nakayima': 'The roots of the Nakayima tree on Mubende hill', 'w-nakayima-2': 'The Nakayima tree, Mubende',
  'w-ziwa': 'White rhino in the grass at Ziwa Rhino Sanctuary', 'w-ziwa-2': 'Two white rhinos at Ziwa',
  'w-palace': 'Tooro Palace on Karuzika hill above Fort Portal',
  'w-saaka': 'Sunset over Lakes Kigere, Saaka and Wabikere', 'w-saaka-2': 'Three crater lakes of Fort Portal',
  'w-sempaya': 'The female spring at Sempaya, spouting', 'w-sempaya-2': 'Boardwalk through the steam at Sempaya',
  'w-nkuruba': 'Lake Nkuruba in its ring of forest, from above', 'w-nyabikere': 'Lake Nyabikere, the "lake of frogs"',
  'w-bigodi': 'Great blue turaco at Bigodi Wetland Sanctuary', 'w-bigodi-2': 'Papyrus swamp at Bigodi',
  'w-katwecraters': 'An explosion crater lake in Queen Elizabeth', 'w-katwecraters-2': 'Lake Nyamununka crater',
  'w-katwe': 'The salt pans of Lake Katwe', 'w-munyanyange': 'Lesser flamingos on Lake Munyanyange, from above',
  'w-munyanyange-2': 'Lake Munyanyange', 'w-mweya': 'Sunset over Lake Edward from Mweya',
  'w-kyambura': 'Kyambura Gorge, the valley of apes', 'w-kyambura-2': 'The Kyambura river in the gorge',
  'w-kilembe': 'Kilembe in the Rwenzori foothills', 'w-kilembe-2': 'The old Kilembe copper mine',
};

const credits = {};
for (const [place, nums] of Object.entries(PICKS)) {
  for (const [j, n] of nums.entries()) {
    const c = cand[place][n - 1];
    const key = `w-${place}${j ? `-${j + 1}` : ''}`;
    const raw = path.join(rawDir, `${key}.jpg`);
    if (!fs.existsSync(raw)) {
      // the original file (Commons refuses thumbnails at widths it hasn't pre-rendered)
      const url = c.url.replace(/\?.*$/, '');
      execFileSync('curl.exe', ['-s', '-L', '-f', '--retry', '5', '--retry-all-errors', '--max-time', '120', '-A', 'hineni-site-photo-credits/1.0', '-o', raw, url]);
      await new Promise((r) => setTimeout(r, 1500));
    }
    const meta = await sharp(raw).metadata();
    for (const [size, q] of SIZES) {
      const f = path.join(out, `${key}-${size}.webp`);
      if (fs.existsSync(f) && !process.env.FORCE) continue;
      await sharp(raw).rotate().resize(size, size, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
        .keepIccProfile().webp({ quality: q, effort: 5, smartSubsample: true }).toFile(f);
    }
    const r = await sharp(path.join(out, `${key}-2800.webp`)).metadata();
    credits[key] = { key, place, alt: ALT[key] || c.desc, w: r.width, h: r.height, web: true,
      credit: c.artist.replace(/\s*\(talk\)$/i, ''), license: c.license, licenseUrl: c.licenseUrl, source: c.page };
    console.log(key, `${meta.width}×${meta.height}`, c.license, c.artist.slice(0, 30));
  }
}
fs.writeFileSync(path.join(root, 'src/data/web-photos.json'), JSON.stringify(credits, null, 1));
console.log(Object.keys(credits).length, 'photos');
