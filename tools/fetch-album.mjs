// Pulls the full media list of the shared Google Photos album into data/album.json.
// Usage: node tools/fetch-album.mjs "<share url>"
import fs from 'node:fs';
import path from 'node:path';

const shareUrl = process.argv[2];
const outName = process.argv[3] || 'album';
if (!shareUrl) throw new Error('Pass the shared album URL');
const u = new URL(shareUrl);
const albumId = u.pathname.split('/share/')[1];
const key = u.searchParams.get('key');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const html = await (await fetch(shareUrl, { headers: { 'user-agent': UA } })).text();
const wiz = (k) => (html.match(new RegExp(`"${k}":"([^"]+)"`)) || [])[1];
const fsid = wiz('FdrFJe'), bl = wiz('cfb2h');
const m = html.match(/AF_initDataCallback\(\{key: 'ds:1'[\s\S]*?data:(\[[\s\S]*?\]), sideChannel/);
const first = JSON.parse(m[1]);
let items = [...first[1]];
let token = first[2];

while (token) {
  const freq = JSON.stringify([[['snAcKc', JSON.stringify([albumId, token, null, key]), null, 'generic']]]);
  const res = await fetch(
    `https://photos.google.com/_/PhotosUi/data/batchexecute?rpcids=snAcKc&source-path=${encodeURIComponent(u.pathname)}&f.sid=${fsid}&bl=${bl}&hl=en-US&soc-app=165&soc-platform=1&soc-device=1&rt=c`,
    { method: 'POST', body: new URLSearchParams({ 'f.req': freq }), headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } }
  );
  const line = (await res.text()).split('\n').find((l) => l.includes('wrb.fr'));
  const inner = JSON.parse(JSON.parse(line)[0][2]);
  items = items.concat(inner[1] || []);
  token = inner[2];
}

const media = items.map((x, i) => {
  const meta = x[x.length - 1] || {};
  const v = meta['76647426'];
  return {
    i,
    id: x[0],
    url: x[1][0],
    w: x[1][1],
    h: x[1][2],
    t: x[2],
    video: !!v,
    durMs: v ? v[0] : 0,
  };
});
media.sort((a, b) => a.t - b.t);
media.forEach((m, i) => (m.i = i));
fs.mkdirSync(path.resolve('data'), { recursive: true });
fs.writeFileSync(path.resolve(`data/${outName}.json`), JSON.stringify(media, null, 1));
console.log(`items=${media.length} photos=${media.filter((m) => !m.video).length} videos=${media.filter((m) => m.video).length}`);

