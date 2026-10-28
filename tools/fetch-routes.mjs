// Builds the real routes for the 3D map and everything you pass on the way.
//   roads:      OSRM routing on OpenStreetMap (router.project-osrm.org), ferries included
//   rivers:     OpenStreetMap waterways (for boat legs, and the rivers each road crosses)
//   districts:  OpenStreetMap admin_level=4 boundaries (Uganda's 146 districts)
//   parks:      OpenStreetMap national parks / protected areas
//   towns:      OpenStreetMap place=city|town near the road
// Stops and leg modes come from `routeTrips` in src/data/content.js. Writes public/terrain/routes.json;
// server responses are cached in data/route-cache so reruns are offline and polite.
// Map data © OpenStreetMap contributors (ODbL) — keep the credit line on the map.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { routeTrips } from '../src/data/content.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'public/terrain/routes.json');
const cache = path.join(root, 'data/route-cache');
fs.mkdirSync(cache, { recursive: true });
const UA = { 'user-agent': 'hineni-site-route-build/1.0' };

// ---------------------------------------------------------------- fetch with a disk cache
async function cached(key, fn) {
  const f = path.join(cache, crypto.createHash('sha1').update(key).digest('hex').slice(0, 16) + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  for (let a = 0; ; a++) {
    try {
      const v = await fn();
      fs.writeFileSync(f, JSON.stringify(v));
      await new Promise((r) => setTimeout(r, 1100)); // public servers: one request a second
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
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson&steps=true`, { headers: UA });
  const j = await r.json();
  if (j.code !== 'Ok') throw new Error(`OSRM ${j.code} ${j.message || ''}`);
  return j;
});
const overpass = (query) => cached('op:' + query, async () => {
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { ...UA, 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  return r.json();
});

// ---------------------------------------------------------------- geometry
const R_KM = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;
function hav([la0, lo0], [la1, lo1]) {
  const a = Math.sin(rad(la1 - la0) / 2) ** 2 + Math.cos(rad(la0)) * Math.cos(rad(la1)) * Math.sin(rad(lo1 - lo0) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}
const cumulative = (pts) => pts.reduce((a, p, i) => (a.push(i ? a[i - 1] + hav(pts[i - 1], p) : 0), a), []);
// Douglas–Peucker in degrees (fine this close to the Equator)
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
// nearest point on a polyline: { i (segment), t, d (km), km (along) }
function nearest(pts, km, p) {
  let best = { d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ya, xa] = pts[i], [yb, xb] = pts[i + 1];
    const dx = xb - xa, dy = yb - ya, L = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[1] - xa) * dx + (p[0] - ya) * dy) / L));
    const q = [ya + t * dy, xa + t * dx];
    const d = hav(q, p);
    if (d < best.d) best = { i, t, d, km: km[i] + (km[i + 1] - km[i]) * t };
  }
  return best;
}
// join a relation's member ways into closed rings
function rings(members, role) {
  const ways = members.filter((m) => m.type === 'way' && m.role === role && m.geometry).map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const out = [];
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
    if (ring.length > 3) out.push(ring);
  }
  return out;
}
function inRing(ring, [y, x]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const area = (rel) => {
  const outer = rings(rel.members, 'outer'), inner = rings(rel.members, 'inner');
  const bb = outer.flat().reduce((b, [y, x]) => [Math.min(b[0], y), Math.min(b[1], x), Math.max(b[2], y), Math.max(b[3], x)], [90, 180, -90, -180]);
  return { name: rel.tags.name, outer, inner, bb,
    has: (p) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3] && outer.some((r) => inRing(r, p)) && !inner.some((r) => inRing(r, p)) };
};
const round = (pts) => pts.map(([y, x]) => [+y.toFixed(5), +x.toFixed(5)]);

// ---------------------------------------------------------------- 1. the routes
// leg modes: road (OSRM, may include a ferry), boat (along a named river), and walk (off the road's end)
async function riverPath(name, a, b) {
  const bb = [Math.min(a[0], b[0]) - 0.05, Math.min(a[1], b[1]) - 0.05, Math.max(a[0], b[0]) + 0.05, Math.max(a[1], b[1]) + 0.05];
  const j = await overpass(`[out:json][timeout:60];way["waterway"="river"]["name"="${name}"](${bb.join(',')});out geom;`);
  // stitch the river's ways end to end, then cut out the stretch between the two landings
  const line = rings(j.elements.map((w) => ({ type: 'way', role: 'x', geometry: w.geometry })), 'x')[0]
    || j.elements.map((w) => w.geometry.map((g) => [g.lat, g.lon])).sort((p, q) => q.length - p.length)[0];
  const km = cumulative(line);
  const na = nearest(line, km, a), nb = nearest(line, km, b);
  const [i0, i1] = na.i <= nb.i ? [na.i + 1, nb.i] : [nb.i + 1, na.i];
  let mid = line.slice(i0, i1 + 1);
  if (na.i > nb.i) mid = mid.reverse();
  return [a, ...mid, b];
}

const trips = [];
for (const t of routeTrips) {
  console.log(t.id);
  const pts = [], segs = [], stopIdx = [], tr_ev = [], ferries = [];
  const push = (p, mode) => {
    if (pts.length && hav(pts[pts.length - 1], p) < 0.005) return;
    pts.push(p);
    const s = segs[segs.length - 1];
    if (s && s.mode === mode) s.to = pts.length - 1; else segs.push({ mode, from: Math.max(0, pts.length - 2), to: pts.length - 1 });
  };
  for (let i = 0; i < t.stops.length; i++) {
    const s = t.stops[i], from = s.leg?.from || (i > 0 ? t.stops[i - 1] : null);
    const to = [s.lat, s.lon];
    if (!from) { push(to, 'road'); stopIdx.push(0); continue; }
    if (!pts.length) push([from.lat, from.lon], 'road');
    const tag = (m) => (s.leg?.extra ? 'extra-' : '') + m;
    let start = [from.lat, from.lon];
    if (s.leg?.first) { // e.g. the boat back down the Nile before the road
      const f = s.leg.first;
      tr_ev.push({ at: pts.length - 1, type: 'boat', name: f.name || `By boat on the ${f.river}` });
      for (const p of await riverPath(f.river, start, f.to)) push(p, tag('boat'));
      start = f.to;
    }
    // a crossing OSM routes as an ordinary road (Paraa): name it so it still shows on the way —
    // placed where the leg actually crosses once the leg is built
    const legStart = pts.length - 1;
    if (s.leg?.ferry) ferries.push({ ...(typeof s.leg.ferry === 'string' ? { name: s.leg.ferry } : s.leg.ferry), legStart });
    if (s.leg?.mode === 'boat') {
      tr_ev.push({ at: pts.length - 1, type: 'boat', name: s.leg.boat || `By boat on the ${s.leg.river}` });
      for (const p of await riverPath(s.leg.river, start, to)) push(p, tag('boat'));
    } else {
      // planned stopovers are waypoints: the road goes through them, and each becomes an event
      const via = s.leg?.stopovers || [];
      const j = await osrm([start, ...via.map((v) => [v.lat, v.lon]), to]);
      const startSnap = j.waypoints[0].location, endSnap = j.waypoints[j.waypoints.length - 1].location;
      if (hav(start, [startSnap[1], startSnap[0]]) > 0.3) push([startSnap[1], startSnap[0]], tag('walk'));
      j.routes[0].legs.forEach((L, li) => {
        for (const st of L.steps) {
          const m = st.mode === 'ferry' ? 'ferry' : 'road';
          if (m === 'ferry') tr_ev.push({ at: pts.length - 1, type: 'ferry', name: st.name || 'Ferry crossing' });
          for (const [lo, la] of simplify(st.geometry.coordinates.map(([x, y]) => [y, x]), 0.0002).map(([y, x]) => [x, y])) push([la, lo], tag(m));
        }
        const v = via[li];
        if (v) tr_ev.push({ at: pts.length - 1, type: 'stopover', name: v.name, when: v.when, note: v.note, lat: v.lat, lon: v.lon });
      });
      const end = [endSnap[1], endSnap[0]];
      // the stop is off the road (a summit, a landing): finish on foot
      if (hav(end, to) > 0.3) push(to, tag(s.leg?.walk || 'track'));
      console.log(`  → ${s.id}: ${(j.routes[0].distance / 1000).toFixed(1)} km by road${hav(end, to) > 0.3 ? `, then ${hav(end, to).toFixed(1)} km` : ''}`);
    }
    push(to, tag('road'));
    stopIdx.push(pts.length - 1);
    for (const fe of ferries.filter((x) => x.legStart === legStart && x.lat != null)) fe.legEnd = pts.length - 1;
  }
  const km = cumulative(pts);
  for (const fe of ferries) {
    if (fe.lat == null) { tr_ev.push({ at: fe.legStart, type: 'ferry', name: fe.name }); continue; }
    const seg = pts.slice(fe.legStart, fe.legEnd + 1);
    const q = nearest(seg, cumulative(seg), [fe.lat, fe.lon]);
    tr_ev.push({ at: fe.legStart + q.i, type: 'ferry', name: fe.name });
  }
  trips.push({ t, pts, segs, stopIdx, km, marks: tr_ev });
}

// ---------------------------------------------------------------- 2. what you pass
// one Overpass "around the route" filter per trip (points ~1 km apart is plenty for a 30–3000 m buffer)
const around = (r, trip) => `(around:${r},${simplify(trip.pts, 0.004).map(([y, x]) => `${y.toFixed(4)},${x.toFixed(4)}`).join(',')})`;
const union = (r, sel) => `(${trips.map((tr) => `${sel}${around(r, tr)};`).join('')})`;

console.log('districts');
const dj = await overpass(`[out:json][timeout:180];${union(30, 'rel["boundary"="administrative"]["admin_level"="4"]')};out geom;`);
const districts = dj.elements.map(area).filter((d) => d.outer.length);
console.log('parks');
const pj = await overpass(`[out:json][timeout:180];${union(30, 'rel["boundary"~"^(national_park|protected_area)$"]')};out geom;`);
const parks = pj.elements.filter((e) => /national park|wildlife reserve|game reserve/i.test(e.tags.name || '')).map(area).filter((d) => d.outer.length);
console.log('towns');
const tj = await overpass(`[out:json][timeout:180];${union(2500, 'node["place"~"^(city|town)$"]')};out;`);
console.log('rivers');
const rj = await overpass(`[out:json][timeout:180];${union(40, 'way["waterway"="river"]["name"]')};out geom;`);

const STEP = 0.25; // km between samples when walking the route for districts and parks
for (const tr of trips) {
  const { pts, km } = tr, ev = [];
  const at = (k) => { // position at a distance along the route
    let i = 0; while (i < km.length - 2 && km[i + 1] < k) i++;
    const f = (k - km[i]) / (km[i + 1] - km[i] || 1);
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
  };
  const total = km[km.length - 1];
  // districts and parks: walk the route; a change only counts if it lasts more than a kilometre
  // (roads that run along a border would otherwise flicker between two names)
  const wet = tr.segs.filter((s) => /boat|ferry/.test(s.mode)).map((s) => [km[s.from], km[s.to]]);
  const walk = (list, type, enter, minKm) => {
    let cur = null, cand = null, since = 0;
    for (let k = 0; k <= total; k += STEP) {
      if (wet.some(([a, b]) => k >= a && k <= b)) continue;
      const p = at(k), here = list.find((d) => d.has(p))?.name || null;
      if (here !== cand) { cand = here; since = k; }
      if (cand !== cur && k - since >= minKm || k === 0 && cand) {
        if (cand) ev.push({ km: +since.toFixed(1), type, name: cand });
        else if (enter) ev.push({ km: +since.toFixed(1), type: type + '-exit', name: cur });
        cur = cand;
      }
    }
  };
  walk(districts, 'district', false, 2);
  walk(parks, 'park', true, 5);
  for (const { at, ...m } of tr.marks) ev.push({ km: +km[at].toFixed(1), ...m });
  for (const sg of tr.t.sights || []) {
    const q = nearest(pts, km, [sg.lat, sg.lon]);
    if (q.d < 40) ev.push({ km: +q.km.toFixed(1), type: 'sight', name: sg.name, note: sg.note, addon: !!sg.addon, off: +q.d.toFixed(1), lat: sg.lat, lon: sg.lon });
    else console.log(`  (sight ${sg.name} is ${q.d.toFixed(0)} km from the route — left out)`);
  }
  for (const n of tj.elements) {
    const q = nearest(pts, km, [n.lat, n.lon]);
    if (q.d < 2.5) ev.push({ km: +q.km.toFixed(1), type: 'town', name: n.tags.name, lat: n.lat, lon: n.lon });
  }
  // rivers: where the road comes within 60 m of the river line
  for (const w of rj.elements) {
    const line = w.geometry.map((g) => [g.lat, g.lon]);
    let best = null;
    for (let k = 0; k <= total; k += 0.1) {
      const p = at(k);
      const close = line.some((q) => Math.abs(q[0] - p[0]) < 0.001 && Math.abs(q[1] - p[1]) < 0.001 && hav(q, p) < 0.06);
      if (close && (!best || k - best > 3)) { best = k; ev.push({ km: +k.toFixed(1), type: 'river', name: w.tags.name }); }
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (Math.sign(pts[i][0]) !== Math.sign(pts[i + 1][0]) && pts[i + 1][0] !== 0) {
      ev.push({ km: +(km[i] + (km[i + 1] - km[i]) * (pts[i][0] / (pts[i][0] - pts[i + 1][0]))).toFixed(1), type: 'equator', name: 'The Equator' });
    }
  }
  // tidy: by distance, and one mention per river / town within a few km
  ev.sort((a, b) => a.km - b.km);
  tr.events = ev.filter((e, i) => !ev.slice(0, i).some((p) => p.type === e.type && p.name === e.name && e.km - p.km < 5));
  const names = (type) => [...new Set(tr.events.filter((e) => e.type === type).map((e) => e.name))];
  console.log(`${tr.t.id}: ${total.toFixed(0)} km · ${names('district').length} districts · ${names('town').length} towns · ${names('river').length} rivers · ${names('park').length} parks`);
  console.log('   ' + names('district').join(', '));
}

// district outlines for the ones the routes pass through, simplified (~200 m)
const used = new Set(trips.flatMap((tr) => tr.events.filter((e) => e.type === 'district').map((e) => e.name)));
const outlines = Object.fromEntries(districts.filter((d) => used.has(d.name)).map((d) => [d.name, d.outer.map((r) => round(simplify(r, 0.002)))]));

fs.writeFileSync(out, JSON.stringify({
  credit: 'Routes and places © OpenStreetMap contributors (ODbL), routing by OSRM',
  trips: trips.map((tr) => ({
    id: tr.t.id,
    pts: round(tr.pts),
    segs: tr.segs.map((s) => [s.from, s.to, s.mode]),
    stops: tr.stopIdx,
    events: tr.events,
  })),
  districts: outlines,
}));
console.log(`done — ${path.relative(root, out)} ${(fs.statSync(out).size / 1e3).toFixed(0)} kB`);
