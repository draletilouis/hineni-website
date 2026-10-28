// Builds the road network behind the map's "Explore" and "Build your own" modes: real road links
// (OSRM on OpenStreetMap) between neighbouring places in `places` (src/data/content.js), plus the
// districts and towns around them. The browser finds the shortest chain of links between any two places,
// so any set of places can be driven on real roads without a routing server.
// Writes public/terrain/network.json; responses are cached in data/route-cache (shared with fetch-routes).
// Map data © OpenStreetMap contributors (ODbL).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { places } from '../src/data/content.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/terrain/network.json');
const cache = path.join(root, 'data/route-cache');
fs.mkdirSync(cache, { recursive: true });
const UA = { 'user-agent': 'hineni-site-route-build/1.0' };

async function cached(key, fn) {
  const f = path.join(cache, crypto.createHash('sha1').update(key).digest('hex').slice(0, 16) + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let a = 0; ; a++) {
    try {
      const v = await fn();
      fs.writeFileSync(f, JSON.stringify(v));
      await new Promise((r) => setTimeout(r, 1100));
      return v;
    } catch (e) {
      if (a === 3) throw e;
      console.log(`  retry (${e.message})`);
      await new Promise((r) => setTimeout(r, 4000 * (a + 1)));
    }
  }
}
const osrm = (pts) => cached('osrm:' + JSON.stringify(pts), async () => {
  const q = pts.map(([la, lo]) => `${lo},${la}`).join(';');
  const j = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`, { headers: UA })).json();
  if (j.code !== 'Ok') throw new Error(`OSRM ${j.code}`);
  return j;
});
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const overpass = (query) => cached('op:' + query, async () => {
  let last;
  for (const m of MIRRORS) {
    try {
      const r = await fetch(m, { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
      if (r.ok) return await r.json();
      last = new Error(`Overpass ${r.status}`);
    } catch (e) { last = e; }
  }
  throw last;
});

const rad = (d) => (d * Math.PI) / 180;
const hav = ([la0, lo0], [la1, lo1]) => {
  const a = Math.sin(rad(la1 - la0) / 2) ** 2 + Math.cos(rad(la0)) * Math.cos(rad(la1)) * Math.sin(rad(lo1 - lo0) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
};
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ya, xa] = pts[a], [yb, xb] = pts[b];
    const dx = xb - xa, dy = yb - ya, L = dx * dx + dy * dy || 1e-12;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const [y, x] = pts[i];
      const t = Math.max(0, Math.min(1, ((x - xa) * dx + (y - ya) * dy) / L));
      const d = Math.hypot(x - xa - t * dx, y - ya - t * dy);
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const round = (pts) => pts.map(([y, x]) => [+y.toFixed(5), +x.toFixed(5)]);
function rings(members) {
  const ways = members.filter((m) => m.type === 'way' && m.role === 'outer' && m.geometry).map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const res = [];
  while (ways.length) {
    let ring = ways.shift();
    for (let grew = true; grew && !same(ring[0], ring[ring.length - 1]);) {
      grew = false;
      for (let k = 0; k < ways.length; k++) {
        const w = ways[k], end = ring[ring.length - 1];
        if (same(w[0], end)) ring = ring.concat(w.slice(1));
        else if (same(w[w.length - 1], end)) ring = ring.concat(w.slice(0, -1).reverse());
        else continue;
        ways.splice(k, 1); grew = true; break;
      }
    }
    if (ring.length > 3) res.push(ring);
  }
  return res;
}

// ---------------------------------------------------------------- which places are linked
// each place to its nearest neighbours in the same region, plus the long roads between regions
const byId = Object.fromEntries(places.map((p) => [p.id, p]));
const P = (p) => [p.lat, p.lon];
const pairs = new Set();
const link = (a, b) => { if (a !== b) pairs.add([a, b].sort().join('|')); };
for (const p of places) {
  const near = places.filter((q) => q.id !== p.id && (q.region === p.region || p.region === 'road'))
    .sort((a, b) => hav(P(p), P(a)) - hav(P(p), P(b))).slice(0, p.region === 'road' ? 2 : 3);
  near.forEach((q) => link(p.id, q.id));
}
// the trunk roads: Kampala west to Fort Portal, north to Murchison and the West Nile, and between regions.
// Direct links matter: chaining through a place that sits off the highway (Lake Wamala) would add a detour.
[['kampala', 'fortportal'], ['kampala', 'gate'], ['kampala', 'paraa'], ['kampala', 'laropi'], ['fortportal', 'kibale'],
  ['kampala', 'wamala'], ['wamala', 'nakayima'], ['nakayima', 'fortportal'], ['kampala', 'ziwa'], ['ziwa', 'gate'], ['gate', 'paraa'], ['gate', 'topfalls'],
  ['ziwa', 'laropi'], ['laropi', 'paraa'], ['fortportal', 'kasenyi'], ['fortportal', 'nyakalengija'], ['kasenda', 'kasenyi'], ['kibale', 'mpanga']]
  .forEach(([a, b]) => link(a, b));

// ---------------------------------------------------------------- the links, on real roads
const edges = [];
for (const key of pairs) {
  const [a, b] = key.split('|').map((id) => byId[id]);
  const j = await osrm([P(a), P(b)]);
  const R = j.routes[0];
  const s0 = [j.waypoints[0].location[1], j.waypoints[0].location[0]], s1 = [j.waypoints[1].location[1], j.waypoints[1].location[0]];
  let pts = simplify(R.geometry.coordinates.map(([x, y]) => [y, x]), 0.0004);
  // a place off the road (a summit, a viewpoint) is reached on foot: straight to it, marked
  const head = hav(P(a), s0) > 0.3, tail = hav(P(b), s1) > 0.3;
  pts = [...(head ? [P(a)] : []), ...pts, ...(tail ? [P(b)] : [])];
  if (!head) pts[0] = P(a);
  if (!tail) pts[pts.length - 1] = P(b);
  const km = +(R.distance / 1000 + (head ? hav(P(a), s0) : 0) + (tail ? hav(P(b), s1) : 0)).toFixed(1);
  edges.push({ a: a.id, b: b.id, km, pts: round(pts), walk: [head ? 1 : 0, tail ? 1 : 0] });
  console.log(`  ${a.id} — ${b.id}: ${km} km`);
}

// ---------------------------------------------------------------- districts and towns along the links
let districts = {}, towns = [];
try {
  const along = (r) => `(${edges.map((e) => `(around:${r},${simplify(e.pts, 0.01).map(([y, x]) => `${y.toFixed(3)},${x.toFixed(3)}`).join(',')})`).join(';')})`;
  // one "around" filter per link, unioned
  const around = (r, sel) => `(${edges.map((e) => `${sel}(around:${r},${simplify(e.pts, 0.01).map(([y, x]) => `${y.toFixed(3)},${x.toFixed(3)}`).join(',')});`).join('')})`;
  void along;
  console.log('districts');
  const dj = await overpass(`[out:json][timeout:240];${around(30, 'rel["boundary"="administrative"]["admin_level"="4"]')};out geom;`);
  districts = Object.fromEntries(dj.elements.map((rel) => [rel.tags.name, rings(rel.members).map((r) => round(simplify(r, 0.002)))]).filter(([, r]) => r.length));
  console.log('towns');
  const tj = await overpass(`[out:json][timeout:240];${around(2500, 'node["place"~"^(city|town)$"]')};out;`);
  towns = tj.elements.map((n) => ({ name: n.tags.name, lat: +n.lat.toFixed(4), lon: +n.lon.toFixed(4) }));
} catch (e) {
  console.log(`  (districts/towns skipped: ${e.message} — the map falls back to the trips' district outlines)`);
}

fs.writeFileSync(out, JSON.stringify({ credit: 'Roads and places © OpenStreetMap contributors (ODbL), routing by OSRM', edges, districts, towns }));
console.log(`done — ${edges.length} links, ${Object.keys(districts).length} districts, ${towns.length} towns · ${path.relative(root, out)} ${(fs.statSync(out).size / 1e3).toFixed(0)} kB`);
