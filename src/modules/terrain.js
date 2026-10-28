// The Route: a 3D model of Uganda built from real data — SRTM elevation (AWS Terrain Tiles) draped
// with Sentinel-2 cloudless imagery (EOX, CC BY 4.0). A regional map covers Lake Victoria to the
// Rwenzori and the West Nile; high-detail patches sharpen Fort Portal's crater field, Murchison Falls,
// Queen Elizabeth NP and Moyo. It opens on all three trips drawn in their own colours; picking one
// flies its route stop by stop — the day, how long the drive is, and a way to book from every stop.
// Data is built by tools/fetch-terrain.mjs into public/terrain/; trips and stops are `routeTrips`.
// Beyond the trips, "Explore" tours every place in a region and "Build your own" drives only to the places
// someone picks — both on real roads from public/terrain/network.json (tools/fetch-network.mjs).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { gsap } from 'gsap';
import { routeTrips, itineraries, places as PLACES, regions as REGIONS, experiencePlaces } from '../data/content.js';
import { photo, webCredit, isMobile, reducedMotion } from '../lib/media.js';
import { icon } from '../lib/icons.js';

const BASE = import.meta.env.BASE_URL + 'terrain/';

// world frame: 40 units per degree, centred on the journey area
const S = 40;
const CLON = 31.1, CLAT = 1.0;
const toX = (lon) => (lon - CLON) * S;
const toZ = (lat) => -(lat - CLAT) * S;
const VS = 2.6;                     // vertical exaggeration
const M_PER_UNIT = 111320 / S;      // metres per world unit horizontally
const yOf = (m) => ((m - 600) / M_PER_UNIT) * VS;

// `near` = only on that stop's close-up; the rest only show from altitude
const GEO_LABELS = [
  { name: 'Rwenzori, 5,109 m', lat: 0.386, lon: 29.872, up: 1.2 },
  { name: 'Lake Albert', lat: 1.6, lon: 30.85, up: 0.3 },
  { name: 'Lake Victoria', lat: -0.25, lon: 32.6, up: 0.3 },
  { name: 'Lake Edward', lat: -0.35, lon: 29.62, up: 0.3 },
  { name: 'Lake George', lat: 0.0, lon: 30.2, up: 0.3 },
  { name: 'Kibale Forest', lat: 0.45, lon: 30.42, up: 0.6 },
  { name: 'Equator 0°', lat: 0.0, lon: 30.6, up: 0.6 },
  { name: 'Lake Saaka', lat: 0.682, lon: 30.235, up: 0.15, near: 'amabere' },
  { name: 'Nyakasura Falls', lat: 0.688, lon: 30.222, up: 0.15, near: 'amabere' },
  { name: 'Lake Katwe', lat: -0.128, lon: 29.868, up: 0.15, near: 'kazinga' },
  { name: 'Mweya', lat: -0.19, lon: 29.895, up: 0.15, near: 'kazinga' },
  { name: 'Lake Albert delta', lat: 2.2, lon: 31.39, up: 0.15, near: 'buligi' },
  { name: 'Paraa', lat: 2.284, lon: 31.566, up: 0.15, near: 'falls' },
  { name: 'Kasese', lat: 0.183, lon: 30.083, up: 0.2, near: 'kasenyi' },
  { name: 'Albert Nile', lat: 3.5, lon: 31.7, up: 0.1, near: 'laropi' },
  { name: 'Adjumani', lat: 3.378, lon: 31.79, up: 0.15, near: 'laropi' },
  { name: 'Albert Nile', lat: 3.52, lon: 31.86, up: 0.1, near: 'buce' },
  { name: 'Gulu', lat: 2.78, lon: 32.3, up: 0.3 },
];

// ---------------------------------------------------------------- data
async function loadRegion(R, maxTex) {
  const [buf, blob] = await Promise.all([
    // heights ship gzipped + row-delta encoded (tools/fetch-terrain.mjs); undo both here
    fetch(`${BASE}${R.id}-height.dat`).then((r) => new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()),
    fetch(`${BASE}${R.id}-sat.jpg`).then((r) => r.blob()),
  ]);
  // decode off the main thread, and at most maxTex px so phones stay inside their GPU budget
  const probe = await createImageBitmap(blob);
  const size = Math.min(probe.width, maxTex);
  probe.close();
  const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY', resizeWidth: size, resizeHeight: size, resizeQuality: 'high' });
  const tex = new THREE.Texture(bmp);
  tex.flipY = false; // already flipped by createImageBitmap
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16; // clamped to the GPU's maximum; keeps fields and roads sharp at grazing angles
  const d = new Int16Array(buf), N = R.grid, h = new Uint16Array(N * N);
  for (let r = 0; r < N; r++) {
    let v = 0;
    for (let c = 0; c < N; c++) { const i = r * N + c; v = c === 0 ? d[i] : v + d[i]; h[i] = v; }
  }
  R.h = h;
  R.tex = tex;
  return R;
}
const inside = (R, lat, lon, m = 0) => lat > R.lat0 + m && lat < R.lat1 - m && lon > R.lon0 + m && lon < R.lon1 - m;
function sample(R, lat, lon) {
  const N = R.grid;
  const fx = ((lon - R.lon0) / (R.lon1 - R.lon0)) * (N - 1);
  const fy = ((R.lat1 - lat) / (R.lat1 - R.lat0)) * (N - 1);
  const x = Math.max(0, Math.min(N - 2, Math.floor(fx))), y = Math.max(0, Math.min(N - 2, Math.floor(fy)));
  const tx = Math.min(1, Math.max(0, fx - x)), ty = Math.min(1, Math.max(0, fy - y));
  const h = R.h, i = y * N + x;
  return h[i] * (1 - tx) * (1 - ty) + h[i + 1] * tx * (1 - ty) + h[i + N] * (1 - tx) * ty + h[i + N + 1] * tx * ty;
}

// satellite colour grade + water gloss, shared by every terrain mesh
function gradeMaterial(mat, { fadeEdges = false, hazeEdges = false } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      // the regional map dissolves into the haze at its borders instead of ending in a hard edge
      .replace('#include <fog_fragment>', `#include <fog_fragment>
        ${hazeEdges ? 'float he = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y)); gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0.0, 0.07, he));' : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          // water: dark and bluer than it is green
          vWater = smoothstep(-0.004, 0.012, c.b - c.g) * smoothstep(0.06, 0.025, l);
          c = mix(vec3(l), c, 1.28);                 // saturation
          c = pow(c * 1.55, vec3(0.92));             // lift the 2016 mosaic's dull exposure
          c *= vec3(1.03, 1.0, 0.94);                // a touch of warm afternoon light
          ${fadeEdges ? `
          // micro-contrast: two octaves of fine noise (~40 m and ~15 m) so close-ups don't read as a blurry photo;
          // faded out by screen-space frequency so it never shimmers at a distance
          vec2 duv = vMapUv * 1400.0;
          float fw = length(fwidth(duv));
          float dn = vnoise(duv) * 0.6 + vnoise(duv * 2.7 + 13.1) * 0.4;
          c *= mix(1.0, 0.9 + dn * 0.2, (1.0 - smoothstep(0.25, 0.9, fw)) * (1.0 - vWater));` : ''}
          diffuseColor.rgb = mix(c, vec3(0.015, 0.06, 0.09), vWater * 0.9);
          ${fadeEdges ? 'float e = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y)); diffuseColor.a = smoothstep(0.0, 0.035, e);' : ''}
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.34, vWater);')
      .replace('void main() {', `float vWater = 0.0;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
        void main() {`);
  };
  return mat;
}

// ---------------------------------------------------------------- route data
// public/terrain/routes.json (tools/fetch-routes.mjs): real road geometry from OpenStreetMap, segment
// modes, and everything passed on the way, each at its distance from the start of the trip.
const hav = ([la0, lo0], [la1, lo1]) => {
  const r = Math.PI / 180;
  const a = Math.sin(((la1 - la0) * r) / 2) ** 2 + Math.cos(la0 * r) * Math.cos(la1 * r) * Math.sin(((lo1 - lo0) * r) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
};
function prepare(t, j) {
  if (!j) { // no routes.json: straight lines between the stops, so the map still works
    const pts = [], segs = [], stops = [];
    t.stops.forEach((s, i) => {
      const from = s.leg?.from || (i > 0 ? t.stops[i - 1] : null);
      if (from && !pts.length) pts.push([from.lat, from.lon]);
      pts.push([s.lat, s.lon]);
      stops.push(pts.length - 1);
      if (pts.length > 1) segs.push([pts.length - 2, pts.length - 1, s.leg?.extra ? 'extra-road' : 'road']);
    });
    j = { pts, segs, stops, events: [] };
  }
  const K = j.pts.reduce((a, p, i) => (a.push(i ? a[i - 1] + hav(j.pts[i - 1], p) : 0), a), []);
  const stopKm = j.stops.map((i) => K[i]);
  const extraKm = j.segs.filter((s) => s[2].startsWith('extra')).reduce((a, s) => a + K[s[1]] - K[s[0]], 0);
  const events = j.events || [];
  for (const e of events) if (!e.photos && e.lat != null && (e.type === 'sight' || e.type === 'stopover')) Object.assign(e, picsNear(e.lat, e.lon));
  const districtAt = (k) => { let d = null; for (const e of events) { if (e.km > k + 0.05) break; if (e.type === 'district') d = e.name; } return d; };
  // the districts each leg passes through, in order
  const legDistricts = stopKm.map((k, i) => {
    const k0 = i ? stopKm[i - 1] : 0;
    if (k - k0 < 0.3) return [];
    const list = [districtAt(k0), ...events.filter((e) => e.type === 'district' && e.km > k0 && e.km <= k).map((e) => e.name)].filter(Boolean);
    return list.filter((d, n) => list.indexOf(d) === n);
  });
  // [lat, lon] at a distance along the route
  const latLonAt = (k) => {
    let a = 0, b = K.length - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (K[m] <= k) a = m; else b = m; }
    const f = Math.max(0, Math.min(1, (k - K[a]) / (K[b] - K[a] || 1)));
    return [j.pts[a][0] + (j.pts[b][0] - j.pts[a][0]) * f, j.pts[a][1] + (j.pts[b][1] - j.pts[a][1]) * f];
  };
  // planned stopovers and nearby sights, per leg and for the whole trip
  const onLeg = (type) => stopKm.map((k, i) => { const k0 = i ? stopKm[i - 1] : 0; return events.filter((e) => e.type === type && e.km > k0 && e.km <= k); });
  return { pts: j.pts, K, segs: j.segs, stopKm, total: K[K.length - 1], extraKm, events, districtAt, legDistricts,
    districts: [...new Set(events.filter((e) => e.type === 'district').map((e) => e.name))],
    stopovers: events.filter((e) => e.type === 'stopover'), sights: events.filter((e) => e.type === 'sight'),
    legStopovers: onLeg('stopover'), legSights: onLeg('sight'), latLonAt };
}
// ---------------------------------------------------------------- places and the road network
const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));
const regionById = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
// the photos of the place nearest a point (a stopover or sight on a trip), if it's within reach:
// our own, or for a place we haven't been to, the credited web ones
function picsNear(lat, lon, km = 1.5) {
  let best = null, bd = km;
  for (const p of PLACES) { if (!p.photos && !p.web) continue; const d = hav([lat, lon], [p.lat, p.lon]); if (d < bd) { bd = d; best = p; } }
  return { photos: best?.photos, web: best?.web };
}
// the picture to show for a place, a stop or an event: ours first, else a web photo (with its credit)
const firstPic = (x) => (x.photos?.length ? { key: x.photos[0], credit: '' } : x.web?.length ? { key: x.web[0], credit: webCredit(x.web[0]) } : null);
function makeGraph(net) {
  const adj = new Map();
  net.edges.forEach((e, i) => {
    for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x).push({ to: y, km: e.km, i, fwd: x === e.a }); }
  });
  // the shortest chain of road links between two places (Dijkstra over a few dozen places)
  const memo = new Map();
  const route = (from, to) => {
    const key = from + '>' + to;
    if (memo.has(key)) return memo.get(key);
    const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
    let found = from === to;
    while (!found) {
      let u = null, best = Infinity;
      for (const [k, d] of dist) if (!done.has(k) && d < best) { best = d; u = k; }
      if (u === null) break;
      if (u === to) { found = true; break; }
      done.add(u);
      for (const l of adj.get(u) || []) {
        const d = best + l.km;
        if (d < (dist.get(l.to) ?? Infinity)) { dist.set(l.to, d); prev.set(l.to, { from: u, l }); }
      }
    }
    let res = null;
    if (found) { const links = []; for (let v = to; v !== from; v = prev.get(v).from) links.unshift(prev.get(v).l); res = { km: dist.get(to) || 0, links }; }
    memo.set(key, res);
    return res;
  };
  return { route };
}
// visiting order: always the nearest place by road next, then untangle any crossings (2-opt)
function order(g, start, ids) {
  const d = (a, b) => g.route(a, b)?.km ?? 1e6;
  const left = new Set(ids); left.delete(start);
  const seq = [start];
  while (left.size) {
    const last = seq[seq.length - 1];
    let best = null;
    for (const id of left) if (best === null || d(last, id) < d(last, best)) best = id;
    seq.push(best); left.delete(best);
  }
  for (let improved = true, n = 0; improved && n < 40; n++) {
    improved = false;
    for (let i = 1; i < seq.length - 1; i++) for (let k = i + 1; k < seq.length; k++) {
      const after = k + 1 < seq.length ? seq[k + 1] : null;
      const delta = d(seq[i - 1], seq[k]) + (after ? d(seq[i], after) : 0) - d(seq[i - 1], seq[i]) - (after ? d(seq[k], after) : 0);
      if (delta < -0.5) { seq.splice(i, k - i + 1, ...seq.slice(i, k + 1).reverse()); improved = true; }
    }
  }
  return seq;
}
// a drive through places in order, shaped like a trip in routes.json, so the rest of the map treats it the same:
// the road, its segments, where each place is, and what's passed on the way (districts, towns, other places)
function driveThrough(g, net, seq, outlines, extraTowns) {
  const pts = [], segs = [], stops = [];
  const push = (p, mode) => {
    if (pts.length && hav(pts[pts.length - 1], p) < 0.005) return;
    pts.push(p);
    const sg = segs[segs.length - 1];
    if (sg && sg[2] === mode) sg[1] = pts.length - 1; else segs.push([Math.max(0, pts.length - 2), pts.length - 1, mode]);
  };
  const first = placeById[seq[0]];
  push([first.lat, first.lon], 'road'); stops.push(0);
  for (let i = 1; i < seq.length; i++) {
    const r = g.route(seq[i - 1], seq[i]);
    if (!r) { const p = placeById[seq[i]]; push([p.lat, p.lon], 'road'); }
    else for (const l of r.links) {
      const e = net.edges[l.i];
      const P = l.fwd ? e.pts : [...e.pts].reverse();
      const walk = l.fwd ? e.walk : [e.walk[1], e.walk[0]];
      P.forEach((p, k) => push(p, (k === 1 && walk[0]) || (k === P.length - 1 && k > 0 && walk[1]) ? 'walk' : 'road'));
    }
    stops.push(pts.length - 1);
  }
  const K = pts.reduce((a, p, i) => (a.push(i ? a[i - 1] + hav(pts[i - 1], p) : 0), a), []);
  const total = K[K.length - 1] || 0;
  const near = (lat, lon) => { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = hav(pts[i], [lat, lon]); if (d < bd) { bd = d; bi = i; } } return { km: K[bi], d: bd }; };
  const ev = [];
  // districts: walk the road; a change only counts after 2 km (borders along a road would flicker)
  const polys = Object.entries(outlines || {}).map(([name, rings]) => {
    const bb = rings.flat().reduce((b, [y, x]) => [Math.min(b[0], y), Math.min(b[1], x), Math.max(b[2], y), Math.max(b[3], x)], [90, 180, -90, -180]);
    return { name, rings, bb };
  });
  const inRing = (ring, [y, x]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [yi, xi] = ring[i], [yj, xj] = ring[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const districtOf = (p) => polys.find((d) => p[0] >= d.bb[0] && p[0] <= d.bb[2] && p[1] >= d.bb[1] && p[1] <= d.bb[3] && d.rings.some((r) => inRing(r, p)))?.name || null;
  const at = (k) => { let a = 0; while (a < K.length - 2 && K[a + 1] < k) a++; const f = (k - K[a]) / (K[a + 1] - K[a] || 1); return [pts[a][0] + (pts[a + 1][0] - pts[a][0]) * f, pts[a][1] + (pts[a + 1][1] - pts[a][1]) * f]; };
  if (pts.length > 1 && polys.length) {
    let cur = null, cand = null, since = 0;
    for (let k = 0; k <= total; k += 0.5) {
      const here = districtOf(at(k));
      if (here !== cand) { cand = here; since = k; }
      if (cand && cand !== cur && (k - since >= 2 || k === 0)) { ev.push({ km: +since.toFixed(1), type: 'district', name: cand }); cur = cand; }
    }
  }
  const seen = new Set();
  for (const t of [...(net.towns || []), ...(extraTowns || [])]) {
    if (seen.has(t.name)) continue;
    const q = near(t.lat, t.lon);
    if (q.d < 2.5) { seen.add(t.name); ev.push({ km: +q.km.toFixed(1), type: 'town', name: t.name, lat: t.lat, lon: t.lon }); }
  }
  // other places on the way, with their photos: the map names them as you pass
  const picked = new Set(seq);
  for (const p of PLACES) {
    if (picked.has(p.id) || p.id === 'kampala') continue;
    const q = near(p.lat, p.lon);
    if (q.d < 5) ev.push({ km: +q.km.toFixed(1), type: 'sight', name: p.name, note: p.note, addon: !!p.addon, off: +q.d.toFixed(1), lat: p.lat, lon: p.lon, photos: p.photos, web: p.web });
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (Math.sign(pts[i][0]) !== Math.sign(pts[i + 1][0]) && pts[i + 1][0] !== 0) ev.push({ km: +(K[i] + (K[i + 1] - K[i]) * (pts[i][0] / (pts[i][0] - pts[i + 1][0]))).toFixed(1), type: 'equator', name: 'The Equator' });
  }
  ev.sort((a, b) => a.km - b.km);
  return { pts, segs, stops, events: ev };
}
// a place as a stop the map can fly to and describe
const placeStop = (p, i, regionName) => ({
  id: p.id, name: p.name, lat: p.lat, lon: p.lon, place: true, photos: p.photos, web: p.web, photo: p.photos?.[0],
  text: p.note, addon: p.addon, region: p.region, when: regionName || regionById[p.region]?.name || '',
  shot: p.id === 'kampala' ? [16, 10, 0] : [2.4, 1.3, 0.6], heading: p.id === 'kampala' ? 330 : undefined,
});

const ODO_UNITS = [1000, 100, 10, 1, 0.1];
const odoHTML = () => `<div class="odo" data-odo role="img" aria-label="0 km">${ODO_UNITS.map((u) => `<span class="odo__d${u < 1 ? ' is-tenth' : ''}"><span class="odo__strip">${'01234567890'.split('').map((n) => `<i>${n}</i>`).join('')}</span></span>`).join('')}</div>`;
function setOdo(el, v) {
  const strips = el._s || (el._s = [...el.querySelectorAll('.odo__strip')]);
  let lower = 0;
  for (let i = ODO_UNITS.length - 1; i >= 0; i--) {
    const raw = v / ODO_UNITS[i];
    let p = Math.floor(raw) % 10;
    if (i === ODO_UNITS.length - 1) p += raw % 1;  // the tenths drum turns all the time
    else if (lower > 9) p += lower - 9;            // the rest roll over with the drum below, like the real thing
    strips[i].style.transform = `translateY(${(-p * 100) / 11}%)`;
    lower = p;
  }
  const label = `${Math.round(v)} km from Kampala`;
  if (el._l !== label) { el._l = label; el.setAttribute('aria-label', label); }
}
const districtName = (d) => (/ City$/.test(d) ? d : `${d} District`);
function eventText(e) {
  switch (e.type) {
    case 'district': return `Entering ${districtName(e.name)}`;
    case 'town': return `Passing ${e.name}`;
    case 'river': return /river|nile/i.test(e.name) ? `Crossing the ${e.name}` : `Crossing the ${e.name} River`;
    case 'park': return `Entering ${e.name}`;
    case 'park-exit': return `Leaving ${e.name}`;
    case 'equator': return 'Crossing the Equator';
    case 'stopover': return `Stopover${e.when ? `, ${e.when}` : ''}: ${e.name}`;
    case 'sight': return `${icon('sight')} ${e.name}${e.off >= 1 ? `, ${Math.round(e.off)} km off the road` : ''}${e.addon ? ' (add-on)' : ''}`;
    default: return e.name; // boat, ferry
  }
}

// ---------------------------------------------------------------- module
export function initTerrain() {
  const host = document.getElementById('journeyGL');
  const stage = document.getElementById('journeyStage');
  const labelsEl = document.getElementById('journeyLabels');
  const cardEl = document.getElementById('journeyCard');
  const tripsEl = document.getElementById('journeyTrips');
  const stepsEl = document.getElementById('journeySteps');
  const coordEl = document.getElementById('journeyCoord');
  const mobile = isMobile();
  const calm = reducedMotion();

  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    const t0 = performance.now();
    build()
      .then(() => { if (import.meta.env.DEV) console.info(`[terrain] built in ${Math.round(performance.now() - t0)} ms`); })
      .catch((err) => { console.error(err); fallback(); });
  };
  // start once the visitor reaches the Game section — never in competition with the hero on first load
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '0px 0px 50% 0px' })
    .observe(document.getElementById('game'));
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: '300% 0px' }).observe(host);

  function fallback() {
    host.innerHTML = `<img src="${photo('crater-dusk')}" alt="" style="width:100%;height:100%;object-fit:cover" />`;
  }

  // ---- state: which trip (-1 = all three) and where along it (-1 = the trip's intro, stops.length = the end)
  let trip = -1, pos = -1;
  let view = null;        // the 3D scene, once built; the cards and buttons work without it
  let RD = null;          // route data per trip, once loaded
  let playing = null, afterArrive = null; // "Play the journey"
  let inView = false;
  // the drive: `sim.odo` is km from the start of the trip; it moves while driving and sits on the stop otherwise
  const sim = { odo: 0 };
  let driveMore = false;
  let driving = false, driveTw = null, speed = 1, evIdx = 0, live = null, driveWin = 1;
  // the three trips, plus one slot filled at runtime by "Explore a region" or "Build your own"
  const DYN = { id: 'custom', color: '#a9c47f', label: 'Your route', stops: [], dyn: true, kind: null, region: null, picks: new Set(), built: false };
  const TRIPS = [...routeTrips, DYN];
  const DT = TRIPS.length - 1;
  let myPlaces = new Set();   // from "Add to my trip" on the experiences
  let NET = null, G = null, ROUTES = null;
  const T = () => TRIPS[trip];
  const R = () => RD?.[trip];
  const itinIdx = (t) => itineraries.findIndex((it) => it.id === t.id);
  const pad = (n) => String(n).padStart(2, '0');
  const dm = (v) => `${Math.floor(v)}°${pad(Math.round((v % 1) * 60))}′`;
  const coord = (s) => `${dm(Math.abs(s.lat))}${s.lat >= 0 ? 'N' : 'S'} ${dm(s.lon)}E`;
  const fmtKm = (k) => (k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString('en'));
  const legKm = (ti, i) => {
    const r = RD?.[ti];
    return r ? r.stopKm[i] - (i ? r.stopKm[i - 1] : 0) : TRIPS[ti].stops[i].leg?.km;
  };
  // the drive people worry about: the longest leg that's part of the trip
  const longest = (ti) => routeTrips[ti].stops.map((s, i) => [s, i]).filter(([s]) => s.leg && !s.leg.extra)
    .sort((a, b) => legKm(ti, b[1]) - legKm(ti, a[1]))[0]?.[0];

  tripsEl.innerHTML = '<button type="button" class="journey__chip" data-trip="-1">All trips</button>' + routeTrips.map((t, i) => `
    <button type="button" class="journey__chip" data-trip="${i}" style="--c:${t.color}"><i></i>${t.label}</button>`).join('')
    + '<button type="button" class="journey__chip journey__chip--more" data-more aria-expanded="false" aria-controls="journeyMore">More</button>'
    + '<span class="journey__more" id="journeyMore" hidden>'
    + '<button type="button" class="journey__chip journey__chip--mode" data-mode="explore">Explore a region</button>'
    + '<button type="button" class="journey__chip journey__chip--mode" data-mode="build">Build your own</button></span>';

  // ---- Explore / Build your own: load the road network once, then turn a list of places into a drive
  async function network() {
    if (!NET) { NET = await fetch(`${BASE}network.json`).then((r) => r.json()); G = makeGraph(NET); }
    return NET;
  }
  async function setRoute(seq, label, color) {
    await network();
    const outlines = Object.keys(NET.districts || {}).length ? NET.districts : ROUTES?.districts;
    const towns = (ROUTES?.trips || []).flatMap((t) => t.events.filter((e) => e.type === 'town' && e.lat));
    DYN.stops = seq.map((id, i) => placeStop(placeById[id], i));
    DYN.label = label; DYN.color = color; DYN.built = true;
    DYN.stops.forEach((st) => { if (st.photo) { const im = new Image(); im.src = photo(st.photo, 900); } });
    RD = RD || [];
    RD[DT] = prepare(DYN, driveThrough(G, NET, seq, outlines, towns));
    view?.rebuildDyn(outlines);
  }
  async function explore(regionId, focus) {
    stop();
    const reg = regionById[regionId];
    DYN.kind = 'explore'; DYN.region = regionId;
    const ids = PLACES.filter((p) => p.region === regionId).map((p) => p.id);
    await network();
    const seq = order(G, reg.hub, ids);
    await setRoute(seq, reg.name, reg.color);
    // from the gallery: straight to that place, its region's tour around it
    show(DT, focus ? seq.indexOf(focus) : -1);
  }
  async function buildRoute() {
    stop();
    const picks = [...DYN.picks].filter((id) => id !== 'kampala');
    if (!picks.length) return;
    await network();
    await setRoute(order(G, 'kampala', ['kampala', ...picks]), 'Your route', '#a9c47f');
    show(DT, -1);
  }
  function mode(kind) {
    stop();
    DYN.kind = kind; DYN.built = false; DYN.stops = []; DYN.region = null;
    if (kind === 'build') myPlaces.forEach((id) => DYN.picks.add(id));
    if (RD) RD[DT] = null;
    view?.rebuildDyn();
    show(DT, -1);
    network().catch(() => {}); // warm up while they choose
  }
  const routeText = () => DYN.stops.map((st) => st.name).join(' → ') + (R() ? ` (about ${fmtKm(R().total)} km)` : '');

  // ---- the card: what you're looking at, how you get there, and what to do next
  function cardHTML() {
    if (trip < 0) {
      return `<div class="journey__card-body">
        <div class="eyebrow">Three trips on one map</div>
        <h3>Where do you <em>want to go?</em></h3>
        <p>Pick a trip and drive it: the real road, every district and town on the way, and the kilometres as they tick by.</p>
        <div class="journey__pick">${routeTrips.map((t, i) => {
          const it = itineraries[itinIdx(t)];
          return `<button type="button" data-trip="${i}" style="--c:${t.color}" data-cursor="hover"><i></i>
            <span><b>${t.label}</b><small>${it.days}. ${it.highlights.slice(0, 2).join(', ')}</small></span><em aria-hidden="true">${icon('arrowRight')}</em></button>`;
        }).join('')}</div>
      </div>`;
    }
    const t = T(), r = R(), ii = itinIdx(t), it = itineraries[ii] || {}, n = t.stops.length;
    if (trip === DT && !driving) return dynCardHTML();
    const book = (solid) => `<a href="#enquire" class="btn btn--small${solid ? ' btn--solid' : ''}" data-book="${it.id}" data-cursor="hover">Book this trip</a>`;
    const days = `<a href="#itinerary" class="btn btn--small" data-days="${ii}" data-cursor="hover">Day by day</a>`;

    if (driving) {
      const s = t.stops[pos];
      const fromName = s.leg?.from ? 'Kampala' : t.stops[pos - 1].name;
      return `<div class="journey__card-body journey__drive" style="--c:${t.color}">
        <div class="eyebrow">${s.leg?.extra ? 'Getting there (not included)' : `On the road, ${s.when}`}</div>
        <h3>${fromName} ${icon('arrowRight')} ${s.name}</h3>
        <div class="journey__odo">${odoHTML()}<span>km from<br />${t.stops[0]?.name || 'Kampala'}</span><span class="journey__fix" data-fix></span></div>
        <div class="journey__ruler" data-bar><i></i></div>
        <div class="journey__ruler-ends eyebrow"><span>${fromName}</span><span>${s.name}</span></div>
        <div class="journey__where"><span class="eyebrow">Now in</span><b data-district>—</b><small data-left></small></div>
        <div class="journey__stopover" data-stopover hidden></div>
        <ol class="journey__feed" data-feed aria-live="off"></ol>
        <div class="journey__drivebar">
          <button type="button" data-pause>${driveTw?.paused() ? 'Resume' : 'Pause'}</button>
          <button type="button" data-drive-more aria-expanded="${driveMore}">More</button>
          <span class="journey__drive-extra" data-drive-extra${driveMore ? '' : ' hidden'}>
            <button type="button" data-speed>${speed}×</button>
            <button type="button" data-skip>Skip to ${s.name}</button>
          </span>
        </div>
      </div>`;
    }

    const where = pos < 0 ? 'The route' : pos >= n ? 'The end' : `${pad(pos + 1)} / ${pad(n)}`;
    const nav = `<div class="journey__nav">
      <button type="button" data-go="-1" aria-label="Previous stop"${pos < 0 ? ' disabled' : ''}>${icon('arrowLeft')}</button>
      <span class="eyebrow">${where}</span>
      <button type="button" data-go="1" aria-label="${pos < 0 ? 'Start the drive' : 'Drive to the next stop'}"${pos >= n ? ' disabled' : ''}>${icon('arrowRight')}</button></div>`;
    const price = `<div class="journey__price">${it.price ? `<b>${it.price}</b> per person` : '<b>Quote within 24 hours</b><span class="journey__more">, one price for the whole trip</span>'}</div>`;
    if (pos < 0 || pos >= n) {
      const L = longest(trip);
      const km = r ? r.total - r.extraKm : null;
      const facts = `<p class="journey__facts">${it.days}.${km ? ` ${fmtKm(km)} km${L ? `, longest drive ${L.leg.time}` : ''}.` : ''}</p>`;
      return `<div class="journey__card-media"><img src="${photo(itineraries[ii].cover, 900)}" alt="" /></div>
        <div class="journey__card-body" style="--c:${t.color}">
          <div class="eyebrow journey__more">${pos < 0 ? it.route : 'That\'s the whole route'}</div>
          <h3>${it.name} <em>${it.em}</em></h3>
          <p class="journey__more">${pos < 0 ? it.blurb : `${it.highlights.join(', ')}. ${it.season}.`}</p>
          ${facts}${price}
          <div class="journey__actions">${pos < 0
            ? `<button type="button" class="btn btn--small btn--solid" data-play data-cursor="hover">Play the journey ${icon('play')}</button>${book(false)}`
            : `${book(true)}${days}`}</div>
          ${nav}
        </div>`;
    }
    const s = t.stops[pos];
    const k = legKm(trip, pos);
    const leg = s.leg ? `<div class="journey__leg${s.leg.extra ? ' is-extra' : ''}">
        <span class="eyebrow">${s.leg.extra ? 'Getting there' : 'Getting here'}${r ? `: ${fmtKm(r.stopKm[pos])} km from Kampala` : ''}</span>
        <b>${s.leg.time}, ${fmtKm(k)} km</b><small>${s.leg.how}</small></div>` : '';
    return `<div class="journey__card-media"><img src="${photo(s.photo, 900)}" alt="${s.name}" /></div>
      <div class="journey__card-body" style="--c:${t.color}">
        <div class="eyebrow">${t.label}, ${s.when}</div>
        <h3>${s.name}</h3>
        <p>${s.text}</p>
        ${leg}
        <div class="journey__actions">${book(true)}${days}</div>
        ${nav}
      </div>`;
  }

  // ---- cards for Explore and Build your own
  const photoCount = (ids) => ids.reduce((a, id) => a + (placeById[id]?.photos?.length || 0), 0);
  function placeMedia(st) {
    // ours if we have any; otherwise credited web photos
    const own = !!st.photos?.length, pics = own ? st.photos : st.web || [];
    if (!pics.length) {
      return `<div class="journey__card-media journey__nophoto"><span class="eyebrow">No photos of our own here yet</span><small>We haven't taken a group here — ask us and we'll fit it in.</small></div>`;
    }
    return `<div class="journey__card-media${own ? '' : ' is-web'}"><img src="${photo(pics[0], 900)}" alt="${st.name}" data-main${own ? ` data-album-key="${pics[0]}" data-cursor="hover"` : ''} />
      ${own ? '' : `<small class="journey__credit" data-credit>${webCredit(pics[0])}</small>`}
      ${pics.length > 1 ? `<div class="journey__thumbs">${pics.slice(0, 6).map((k, i) => `<button type="button" data-photo="${k}" class="${i ? '' : 'is-on'}" aria-label="Photo ${i + 1} of ${st.name}"><img src="${photo(k, 900)}" alt="" loading="lazy" /></button>`).join('')}</div>` : ''}</div>`;
  }
  function dynCardHTML() {
    const t = DYN, r = R(), n = t.stops.length, color = t.color;
    // choose a region
    if (t.kind === 'explore' && !t.built) {
      return `<div class="journey__card-body">
        <div class="eyebrow">Explore a region</div>
        <h3>See every place <em>in one area</em></h3>
        <p>Pick a region and drive around all of it — the places we've been, with our photos, and the ones we haven't yet.</p>
        <div class="journey__pick">${REGIONS.filter((g) => !g.hidden).map((g) => {
          const ids = PLACES.filter((p) => p.region === g.id).map((p) => p.id);
          return `<button type="button" data-region="${g.id}" style="--c:${g.color}" data-cursor="hover"><i></i>
            <span><b>${g.name}</b><small>${ids.length} places, ${photoCount(ids)} photos</small></span><em aria-hidden="true">${icon('arrowRight')}</em></button>`;
        }).join('')}</div>
      </div>`;
    }
    // pick places
    if (t.kind === 'build' && !t.built) {
      const fromExp = [...t.picks].filter((id) => myPlaces.has(id)).length;
      return `<div class="journey__card-body">
        <div class="eyebrow">Build your own</div>
        <h3>Pick the places, <em>we'll drive it</em></h3>
        <p>Tick what you want to see. The map starts in Kampala and drives to them in the best order${fromExp ? ` — ${fromExp} already ticked from the experiences you added` : ''}.</p>
        <div class="journey__picker">${REGIONS.filter((g) => !g.hidden).concat(REGIONS.filter((g) => g.hidden)).map((g) => {
          const list = PLACES.filter((p) => p.region === g.id && p.id !== 'kampala');
          return list.length ? `<fieldset style="--c:${g.color}"><legend class="eyebrow">${g.name}</legend>${list.map((p) => `
            <label class="journey__place"><input type="checkbox" data-place="${p.id}"${t.picks.has(p.id) ? ' checked' : ''} />
              <span>${p.name}${p.addon ? ' <i>add-on</i>' : ''}</span>${p.photos ? `<small>${p.photos.length} photo${p.photos.length === 1 ? '' : 's'}</small>` : ''}</label>`).join('')}</fieldset>` : '';
        }).join('')}</div>
        <div class="journey__actions"><button type="button" class="btn btn--small btn--solid" data-build${t.picks.size ? '' : ' disabled'} data-cursor="hover">Drive my route ${icon('play')}</button></div>
      </div>`;
    }
    const where = pos < 0 ? 'The route' : pos >= n ? 'The end' : `${pad(pos + 1)} / ${pad(n)}`;
    const nav = `<div class="journey__nav">
      <button type="button" data-go="-1" aria-label="Previous place"${pos < 0 ? ' disabled' : ''}>${icon('arrowLeft')}</button>
      <span class="eyebrow">${where}</span>
      <button type="button" data-go="1" aria-label="${pos < 0 ? 'Start the drive' : 'Drive to the next place'}"${pos >= n ? ' disabled' : ''}>${icon('arrowRight')}</button></div>`;
    const send = `<a href="#enquire" class="btn btn--small btn--solid" data-send data-cursor="hover">${t.kind === 'explore' ? 'Plan a trip here' : 'Send us this route'}</a>`;
    if (pos < 0 || pos >= n) {
      const reg = regionById[t.region];
      const withPhotos = t.stops.filter((st) => st.photos).length;
      const cover = t.stops.find((st) => st.photos)?.photos[0];
      return `${cover ? `<div class="journey__card-media"><img src="${photo(cover, 900)}" alt="" /></div>` : ''}
        <div class="journey__card-body" style="--c:${color}">
          <div class="eyebrow">${t.kind === 'explore' ? 'Explore a region' : 'Built by you'}${pos >= n ? ': the whole route' : ''}</div>
          <h3>${t.kind === 'explore' ? reg.name : 'Your route'}</h3>
          <p>${t.kind === 'explore' ? reg.blurb : 'Every place you picked, in the order that drives best. We can turn it into a trip.'}</p>
          <p class="journey__facts">${n} places${r ? `, ${fmtKm(r.total)} km` : ''}. Our photos from ${withPhotos} of them.</p>
          <div class="journey__through journey__plan"><span class="eyebrow">In order</span>${t.stops.map((st) => `${st.photos ? '' : `${icon('noPhoto')} `}${st.name}`).join(', ')}</div>
          <div class="journey__actions">${pos < 0
            ? `<button type="button" class="btn btn--small btn--solid" data-play data-cursor="hover">Drive it ${icon('play')}</button><button type="button" class="btn btn--small" data-mode="${t.kind}" data-cursor="hover">${t.kind === 'explore' ? 'Another region' : 'Change places'}</button>`
            : `${send}<button type="button" class="btn btn--small" data-play data-cursor="hover">Drive it again</button>`}</div>
          ${nav}
        </div>`;
    }
    const st = t.stops[pos];
    const k = legKm(DT, pos);
    const leg = pos > 0 ? `<div class="journey__leg"><span class="eyebrow">Getting here${r ? `: at km ${fmtKm(r.stopKm[pos])} of the route` : ''}</span>
      <b>${fmtKm(k)} km from ${t.stops[pos - 1].name}</b></div>` : '';
    return `${placeMedia(st)}
      <div class="journey__card-body" style="--c:${color}">
        <div class="eyebrow">${regionById[st.region]?.name || ''}${st.addon ? ' (add-on)' : ''}</div>
        <h3>${st.name}</h3>
        <p>${st.text || ''}</p>
        ${leg}
        <div class="journey__actions">${send}</div>
        ${nav}
      </div>`;
  }

  let cardTl = null;
  function renderCard() {
    const html = cardHTML();
    live = null; // nothing is written to the old card while the new one fades in
    // keep keyboard focus on the arrow that was pressed when the card re-renders
    const focused = cardEl.contains(document.activeElement) ? document.activeElement.dataset.go : null;
    const swap = () => {
      cardEl.innerHTML = html;
      cardEl.classList.toggle('is-pick', trip < 0);
      cardEl.classList.toggle('is-driving', driving);
      const q = (s) => cardEl.querySelector(s);
      live = driving ? { odo: q('[data-odo]'), bar: q('[data-bar]'), district: q('[data-district]'), left: q('[data-left]'), feed: q('[data-feed]'), stopover: q('[data-stopover]'), fix: q('[data-fix]'), shown: '', fixed: '', banner: null } : null;
      if (driving) R().events.slice(0, evIdx).filter((e) => e.km > sim.odo - 25).forEach((e) => feed(e, true));
      cardEl.querySelectorAll('.journey__card-body > *').forEach((el, i) => el.style.setProperty('--i', i));
      cardEl.classList.remove('is-in');
      void cardEl.offsetWidth;
      cardEl.classList.add('is-in');
      if (focused) (cardEl.querySelector(`[data-go="${focused}"]:not([disabled])`) || cardEl.querySelector('[data-go]:not([disabled])'))?.focus();
    };
    cardTl?.kill();
    if (calm || !cardEl.innerHTML) { swap(); gsap.set(cardEl, { opacity: 1 }); return; }
    cardTl = gsap.timeline({ defaults: { duration: 0.25, ease: 'power1.out' } })
      .to(cardEl, { opacity: 0 })
      .call(swap)
      .to(cardEl, { opacity: 1 });
  }

  // things passed on the way scroll into the card, newest first
  function feed(e, quiet) {
    if (!live?.feed) return;
    const li = document.createElement('li');
    li.dataset.type = e.type;
    li.innerHTML = `<span>km ${fmtKm(e.km)}</span><div>${eventText(e)}${e.note ? `<small>${e.note}</small>` : ''}</div>`;
    live.feed.prepend(li);
    while (live.feed.children.length > 4) live.feed.lastElementChild.remove();
    if (!quiet) li.classList.add('is-new');
  }
  // called every frame while driving: odometer, district, and anything we just passed
  let hudKey = '';
  function tick() {
    const r = R();
    if (trip >= 0 && r) {
      const d = r.districtAt(sim.odo);
      const key = `${Math.round(sim.odo * 10)}|${d}`;
      if (key !== hudKey) { hudKey = key; coordEl.innerHTML = `<b>${fmtKm(sim.odo)} km</b> from ${T().stops[0]?.name || 'Kampala'}${d ? `<br />${districtName(d)}` : ''}`; }
    }
    if (!driving || !live) return;
    const r2 = R(), to = r2.stopKm[pos], from = pos ? r2.stopKm[pos - 1] : 0;
    setOdo(live.odo, sim.odo);
    live.bar.style.setProperty('--p', Math.max(0, Math.min(1, (sim.odo - from) / (to - from || 1))).toFixed(4));
    const fix = coord({ lat: r2.latLonAt(sim.odo)[0], lon: r2.latLonAt(sim.odo)[1] });
    if (live.fixed !== fix) { live.fixed = fix; live.fix.textContent = fix; }
    const d = r2.districtAt(sim.odo);
    if (live.shown !== d) { live.shown = d; live.district.textContent = d ? districtName(d) : '—'; }
    live.left.textContent = `${fmtKm(Math.max(0, to - sim.odo))} km to ${T().stops[pos].name}`;
    while (evIdx < r2.events.length && r2.events[evIdx].km <= sim.odo) feed(r2.events[evIdx++]);
    // the banner: a stopover we've pulled in at, or the sights we're passing — when several are close
    // together (Katwe, Munyanyange, Mweya…) it takes turns through them, a couple of seconds each
    const sights = r2.events.filter((e) => e.type === 'sight' && Math.abs(e.km - sim.odo) < driveWin);
    const near = r2.events.find((e) => e.type === 'stopover' && Math.abs(e.km - sim.odo) < driveWin * 0.5)
      || sights[Math.floor(performance.now() / 2400) % (sights.length || 1)];
    if (live.banner !== near) {
      live.banner = near;
      live.stopover.hidden = !near;
      if (near) {
        const others = near.type === 'sight' ? sights.filter((e) => e !== near) : [];
        live.stopover.className = 'journey__stopover';
        void live.stopover.offsetWidth; // restart the entrance animation
        live.stopover.className = `journey__stopover ${near.type === 'sight' ? 'is-sight' : 'is-stamp'}`;
        const fp = firstPic(near);
        const pic = fp ? `<img class="journey__stopover-img" src="${photo(fp.key, 900)}" alt="" />` : '';
        live.stopover.innerHTML = pic + (near.type === 'stopover'
          ? `<span class="eyebrow">Stopover${near.when ? `, ${near.when}` : ''}</span><b>${near.name}</b><small>${near.note || ''}</small>`
          : `<span class="eyebrow">${near.addon ? 'Nearby (add-on)' : 'Nearby'}${near.off >= 1 ? `, ${Math.round(near.off)} km off the road` : ''}</span><b>${icon('sight')} ${near.name}</b><small>${near.note || ''}</small>`
            + (others.length ? `<small class="journey__also">Also nearby: ${others.map((e) => e.name).join(', ')}</small>` : ''))
          + (fp?.credit ? `<small class="journey__credit">${fp.credit}</small>` : '');
        live.stopover.classList.toggle('has-img', !!pic);
      }
    }
  }

  function renderHUD() {
    [...tripsEl.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode ? trip === DT && DYN.kind === b.dataset.mode : +b.dataset.trip === trip)));
    stage.dataset.active = trip < 0 ? 'all' : T().id;
    stage.classList.toggle('is-driving', driving);
    // a whole trip on screen (its intro and end): the card says it all, the stop list steps aside
    stage.classList.toggle('is-framed', trip >= 0 && (pos < 0 || pos >= T().stops.length) && !driving);
    if (trip < 0) {
      stepsEl.innerHTML = '';
      coordEl.innerHTML = 'Uganda<br /><b>1°22′N 32°17′E</b>';
      hudKey = '';
    } else {
      const t = T(), r = R();
      stepsEl.style.setProperty('--c', t.color);
      stepsEl.innerHTML = t.stops.map((s, i) => `<li><button type="button" data-pos="${i}"${i === pos ? ' class="is-active" aria-current="step"' : ''}>
        <i></i>${pad(i + 1)} ${s.name}<small>${s.when}${r ? `, km ${fmtKm(r.stopKm[i])}` : ''}</small></button></li>`).join('');
      if (!r && t.stops.length) coordEl.textContent = coord(t.stops[Math.max(0, Math.min(t.stops.length - 1, pos))]);
      if (!t.stops.length) coordEl.innerHTML = 'Uganda<br /><b>1°22′N 32°17′E</b>';
      hudKey = '';
      tick();
    }
    renderCard();
  }

  // move to a trip / stop. One stop forward on the same trip is driven; anything else flies there.
  function show(ti, p, opts = {}) {
    if (driving) endDrive();
    const prevTrip = trip, prevPos = pos;
    trip = ti;
    pos = ti < 0 ? -1 : Math.max(-1, Math.min(T().stops.length, p));
    const r = R(), n = ti < 0 ? 0 : T().stops.length;
    if (view && r && !calm && !opts.instant && ti === prevTrip && ti >= 0 && pos === prevPos + 1 && pos < n) {
      const from = prevPos < 0 ? 0 : r.stopKm[prevPos], to = r.stopKm[pos];
      if (to - from > 0.3) { startDrive(from, to); return; }
    }
    sim.odo = ti < 0 || pos < 0 ? 0 : pos >= n ? r?.total || 0 : r?.stopKm[pos] || 0;
    renderHUD();
    view?.apply(opts);
    if (afterArrive) { const cb = afterArrive; afterArrive = null; cb(); }
  }
  function startDrive(from, to) {
    driving = true;
    sim.odo = from;
    const r = R();
    evIdx = r.events.findIndex((e) => e.km > from + 0.05);
    if (evIdx < 0) evIdx = r.events.length;
    renderHUD();
    view.chase(to - from);
    // time to read: the vehicle eases off around every district, town, river or crossing, so each
    // one gets a moment on screen, and cruises the empty stretches between them
    const span = to - from;
    const evs = r.events.filter((e) => e.km > from && e.km <= to);
    const sigma = Math.max(0.5, span * 0.012);
    driveWin = Math.max(1, sigma * 2);
    const N = Math.max(60, Math.ceil(span / 0.25));
    const w = [0];
    for (let i = 1; i <= N; i++) {
      const k = from + (span * (i - 0.5)) / N;
      w.push(1 + evs.reduce((a, e) => a + (e.type === 'sight' ? 4 : 2.5) * Math.exp(-(((k - e.km) / sigma) ** 2)), 0));
    }
    // about 1.4 s for every place passed on top of the distance, and a 3.5 s stop at each stopover
    const stops = evs.filter((e) => e.type === 'stopover');
    const base = Math.min(60, 4 + Math.sqrt(span) * 1.3 + evs.length * 1.4);
    const W0 = w.reduce((a, b) => a + b, 0);
    for (const e of stops) w[Math.min(N, Math.max(1, Math.ceil(((e.km - from) / span) * N)))] += (W0 * 3.5) / base;
    const cum = [0];
    for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + w[i]);
    const kmAt = (f) => {
      const c = f * cum[N];
      let a = 0, b = N;
      while (b - a > 1) { const m = (a + b) >> 1; if (cum[m] <= c) a = m; else b = m; }
      return from + (span * (a + (c - cum[a]) / (cum[b] - cum[a] || 1))) / N;
    };
    // 2× and 4× are a click away
    const dur = base + stops.length * 3.5;
    const prog = { f: 0 };
    driveTw = gsap.to(prog, { f: 1, duration: dur, ease: 'sine.inOut', onUpdate: () => { sim.odo = kmAt(prog.f); }, onComplete: arrive }).timeScale(speed);
  }
  function endDrive() { // jump to the end of the leg without the arrival flight
    driveTw?.kill(); driveTw = null;
    sim.odo = R().stopKm[pos];
    driving = false;
    view?.chase(0);
  }
  function arrive() {
    driveTw = null;
    driving = false;
    view.chase(0);
    renderHUD();
    view.apply();
    if (afterArrive) { const cb = afterArrive; afterArrive = null; cb(); }
  }
  const step = (d) => { if (trip >= 0) show(trip, pos + d); };
  function stop() { playing?.kill(); playing = null; afterArrive = null; stage.classList.remove('is-playing'); }
  function play() {
    stop();
    if (pos >= T().stops.length) show(trip, -1, { instant: true });
    stage.classList.add('is-playing');
    const next = () => {
      if (pos >= T().stops.length - 1) { stop(); show(trip, T().stops.length); return; }
      afterArrive = () => { playing = gsap.delayedCall((view?.lastFlight || 0) + 4, next); };
      show(trip, pos + 1);
    };
    next();
  }

  tripsEl.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) {
      const open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', open);
      document.getElementById('journeyMore').hidden = !open;
      return;
    }
    const m = e.target.closest('[data-mode]');
    if (m) { mode(m.dataset.mode); return; }
    const b = e.target.closest('[data-trip]');
    if (b) { stop(); show(+b.dataset.trip, -1); }
  });
  // "Add to my trip" on the experiences pre-ticks those places in Build your own
  document.addEventListener('mytrip', (e) => {
    const before = new Set(myPlaces);
    myPlaces = new Set((e.detail || []).flatMap((x) => experiencePlaces[x] || []));
    before.forEach((id) => { if (!myPlaces.has(id)) DYN.picks.delete(id); });
    myPlaces.forEach((id) => DYN.picks.add(id));
    if (trip === DT && DYN.kind === 'build' && !DYN.built) renderCard();
  });
  stepsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-pos]'); if (b) { stop(); show(trip, +b.dataset.pos); } });
  cardEl.addEventListener('change', (e) => {
    const c = e.target.closest('[data-place]');
    if (!c) return;
    c.checked ? DYN.picks.add(c.dataset.place) : DYN.picks.delete(c.dataset.place);
    const go = cardEl.querySelector('[data-build]');
    if (go) go.disabled = !DYN.picks.size;
  });
  cardEl.addEventListener('click', (e) => {
    const rg = e.target.closest('[data-region]');
    if (rg) { explore(rg.dataset.region); return; }
    const md = e.target.closest('[data-mode]');
    if (md) { mode(md.dataset.mode); return; }
    if (e.target.closest('[data-build]')) { buildRoute(); return; }
    const th = e.target.closest('[data-photo]');
    if (th) {
      const main = cardEl.querySelector('[data-main]');
      if (main) main.src = photo(th.dataset.photo, 900);
      if (main?.dataset.albumKey) main.dataset.albumKey = th.dataset.photo; // our photos open in the album
      const credit = cardEl.querySelector('[data-credit]');
      if (credit) credit.innerHTML = webCredit(th.dataset.photo);
      cardEl.querySelectorAll('[data-photo]').forEach((b) => b.classList.toggle('is-on', b === th));
      return;
    }
    if (e.target.closest('[data-send]')) {
      // hand the route to the enquiry form
      stop();
      const tripSel = document.getElementById('f-trip'), msg = document.getElementById('f-msg');
      if (tripSel) tripSel.value = 'custom';
      if (msg) msg.value = `${DYN.kind === 'explore' ? `I'd like to see ${DYN.label}` : 'My route on the map'}: ${routeText()}.${msg.value ? `\n\n${msg.value}` : ''}`;
      return;
    }
    const pick = e.target.closest('[data-trip]');
    if (pick) { stop(); show(+pick.dataset.trip, -1); return; }
    const g = e.target.closest('[data-go]');
    if (g) { stop(); step(+g.dataset.go); return; }
    if (e.target.closest('[data-play]')) { play(); return; }
    if (e.target.closest('[data-skip]')) { driveTw?.progress(1); return; }
    const dm = e.target.closest('[data-drive-more]');
    if (dm) {
      driveMore = !driveMore;
      dm.setAttribute('aria-expanded', driveMore);
      cardEl.querySelector('[data-drive-extra]').hidden = !driveMore;
      return;
    }
    const pause = e.target.closest('[data-pause]');
    if (pause && driveTw) { driveTw.paused(!driveTw.paused()); pause.textContent = driveTw.paused() ? 'Resume' : 'Pause'; if (driveTw.paused()) { playing?.kill(); } return; }
    const sp = e.target.closest('[data-speed]');
    if (sp) { speed = speed === 4 ? 1 : speed * 2; driveTw?.timeScale(speed); sp.textContent = `${speed}×`; return; }
    if (e.target.closest('[data-book], [data-days]')) stop();
  });
  // "See it on the map" on a gallery photo opens the map on that place
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-map-place]');
    const p = el && placeById[el.dataset.mapPlace];
    if (p && !regionById[p.region]?.hidden) explore(p.region, p.id);
  });
  // "See the route" links elsewhere on the page open the map on that trip
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-route]');
    if (!r) return;
    const i = routeTrips.findIndex((t) => t.id === r.dataset.route);
    if (i >= 0) { stop(); show(i, -1); }
  });
  document.addEventListener('keydown', (e) => {
    if (!inView || trip < 0 || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stop(); step(e.key === 'ArrowRight' ? 1 : -1); }
  });
  // scrolling away pauses the drive; coming back picks it up again
  let autoPaused = false;
  new IntersectionObserver(([e]) => {
    inView = e.intersectionRatio > 0.5;
    if (!e.isIntersecting) { stop(); if (driveTw && !driveTw.paused()) { driveTw.pause(); autoPaused = true; } }
    else if (autoPaused) { autoPaused = false; driveTw?.resume(); }
  }, { threshold: [0, 0.5, 1] }).observe(stage);

  renderHUD();
  // (dev: lets automated checks start and drive the map while the preview pane is hidden)
  if (import.meta.env.DEV) window.__terrain = { go, show, play, sim, gsap, explore, mode, buildRoute, DYN, state: () => ({ trip, pos, driving, odo: sim.odo }) };

  const loading = document.createElement('div');
  loading.className = 'journey__loading eyebrow';
  loading.textContent = 'Loading satellite terrain…';
  host.appendChild(loading);

  async function build() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { fallback(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    routeTrips.forEach((t) => t.stops.forEach((s) => { const im = new Image(); im.src = photo(s.photo, 900); }));
    const [regions, routesJson] = await Promise.all([
      fetch(`${BASE}regions.json`).then((r) => r.json()),
      fetch(`${BASE}routes.json`).then((r) => r.json()).catch(() => null),
    ]);
    ROUTES = routesJson;
    RD = [...routeTrips.map((t) => prepare(t, routesJson?.trips.find((x) => x.id === t.id))), RD?.[DT] || null];
    renderHUD(); // real distances replace the estimates on the card
    await Promise.all(regions.map((R) => loadRegion(R, mobile ? 2048 : 4096)));
    const overview = regions.find((r) => r.id === 'overview');
    const patches = regions.filter((r) => r.id !== 'overview');

    const ground = (lat, lon) => {
      for (const P of patches) if (inside(P, lat, lon)) return yOf(sample(P, lat, lon));
      return yOf(sample(overview, lat, lon));
    };

    host.appendChild(renderer.domElement);
    loading.remove();
    // if the GPU drops the context (memory pressure, driver reset), let it come back instead of going blank
    renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());

    const scene = new THREE.Scene();
    const fogColor = new THREE.Color('#b4bfbd');
    scene.fog = new THREE.FogExp2(fogColor, 0.0036);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.08, 1200);
    // the haze as it actually reaches the screen: fog is mixed in after the terrain's sRGB conversion,
    // so raw shaders (sky, ground beyond the map) need the encoded colour to meet it without a seam
    const hazeOut = fogColor.clone().convertLinearToSRGB();

    // sky dome, also baked into an environment map so lakes reflect it
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#3f6984') }, mid: { value: new THREE.Color('#c3cecd') }, bot: { value: hazeOut }, sunDir: { value: new THREE.Vector3(-0.8, 0.35, 0.3).normalize() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(bot, mid, smoothstep(-0.02, 0.1, h)); c = mix(c, top, smoothstep(0.1, 0.6, h));
          float s = max(dot(normalize(vP), sunDir), 0.0); c += vec3(1.0, 0.85, 0.6) * (pow(s, 64.0) * 0.8 + pow(s, 6.0) * 0.18);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMat);
    scene.add(sky);
    // haze-coloured ground beyond the map, so its edges (seen when a whole trip is framed) dissolve
    // into the same colour as the horizon instead of ending against the sky
    const beyond = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { c: { value: hazeOut } }, fog: false, depthWrite: false,
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
    }));
    beyond.position.y = -0.8;
    beyond.renderOrder = 1; // after the sky dome, which would otherwise paint over it
    scene.add(beyond);
    {
      const envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(envScene, 0.02).texture;
      scene.environmentIntensity = 0.35;
    }
    scene.add(new THREE.HemisphereLight('#fff4e0', '#3a4630', 0.55));
    const sun = new THREE.DirectionalLight('#ffe2b8', 3.0);
    sun.position.set(-120, 52, 36);
    scene.add(sun);

    // ---- terrain meshes
    const cores = patches.map((P) => {
      const mLat = (P.lat1 - P.lat0) * 0.05, mLon = (P.lon1 - P.lon0) * 0.05;
      return [P.lat0 + mLat, P.lat1 - mLat, P.lon0 + mLon, P.lon1 - mLon];
    });
    function terrainMesh(R, segs, { patch }) {
      const w = (R.lon1 - R.lon0) * S, d = (R.lat1 - R.lat0) * S;
      const segX = segs, segY = Math.round(segs * (d / w));
      const geo = new THREE.PlaneGeometry(w, d, segX, segY);
      geo.rotateX(-Math.PI / 2);
      geo.translate(toX((R.lon0 + R.lon1) / 2), 0, toZ((R.lat0 + R.lat1) / 2));
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const lon = pos.getX(i) / S + CLON, lat = -pos.getZ(i) / S + CLAT;
        let y = yOf(sample(R, lat, lon));
        // sink the regional mesh under the core of each patch so the detailed mesh shows
        if (!patch && cores.some((c) => lat > c[0] && lat < c[1] && lon > c[2] && lon < c[3])) y -= 0.25;
        pos.setY(i, y);
      }
      geo.computeVertexNormals();
      const mat = gradeMaterial(new THREE.MeshStandardMaterial({
        map: R.tex, roughness: 0.92, metalness: 0,
        transparent: patch, polygonOffset: patch, polygonOffsetFactor: patch ? -2 : 0, polygonOffsetUnits: patch ? -2 : 0,
      }), { fadeEdges: patch, hazeEdges: !patch });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = patch ? 1 : 0;
      scene.add(mesh);
      return mesh;
    }
    // yield between the heavy steps so the page keeps scrolling smoothly while this builds
    const breathe = () => new Promise((r) => setTimeout(r, 0));
    terrainMesh(overview, mobile ? 300 : 520, { patch: false });
    for (const P of patches) { await breathe(); terrainMesh(P, mobile ? 220 : 400, { patch: true }); }
    await breathe();

    // lakes need no geometry of their own: SRTM keeps their surfaces flat, and the terrain shader
    // detects water in the imagery and makes it glossy so it reflects the sky

    // ---- clouds drifting over the Mountains of the Moon
    const cloudTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const clouds = [];
    for (let i = 0; i < (mobile ? 16 : 34); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, color: '#ffffff' }));
      const t = Math.random();
      const lat = 0.08 + t * 0.75 + (Math.random() - 0.5) * 0.12, lon = 29.99 - t * 0.17 + (Math.random() - 0.5) * 0.18;
      s.position.set(toX(lon), yOf(4300) + Math.random() * 1.6, toZ(lat));
      const sc = 3 + Math.random() * 5;
      s.scale.set(sc, sc * 0.45, 1);
      s.userData.phase = Math.random() * 10;
      scene.add(s);
      clouds.push(s);
    }

    // ---- the Equator, a dashed white line laid on the ground (the routes own the warm colours)
    {
      const pts = [];
      for (let lon = 29.2; lon <= 33.2; lon += 0.004) pts.push(new THREE.Vector3(toX(lon), ground(0, lon) + 0.05, toZ(0)));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.55 }));
      line.computeLineDistances();
      scene.add(line);
    }

    // ---- districts the routes pass through: faint outlines, the one you're in lit up
    const districtLines = new Map();
    function districtLine(name, rings) {
      if (districtLines.has(name)) return;
      const mat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, fog: false, depthWrite: false });
      const group = new THREE.Group();
      for (const ring of rings) {
        const pts = [];
        for (let i = 0; i < ring.length; i++) {
          const [la0, lo0] = ring[i], [la1, lo1] = ring[(i + 1) % ring.length];
          const n = Math.max(1, Math.ceil(Math.hypot(la1 - la0, lo1 - lo0) / 0.004));
          for (let k = 0; k < n; k++) { const f = k / n, la = la0 + (la1 - la0) * f, lo = lo0 + (lo1 - lo0) * f; pts.push(new THREE.Vector3(toX(lo), ground(la, lo) + 0.04, toZ(la))); }
        }
        pts.push(pts[0].clone());
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      }
      group.renderOrder = 2;
      group.visible = false;
      scene.add(group);
      districtLines.set(name, { group, mat, op: 0 });
    }
    for (const [name, rings] of Object.entries(routesJson?.districts || {})) districtLine(name, rings);

    // ---- routes: screen-space lines so they read at every altitude. Each trip has a "ghost" (its whole
    // route, the overview's map) and a "trail" that follows the vehicle as you drive it.
    const lineMats = [];
    const lineMat = (color, width, dashed) => {
      const m = new LineMaterial({ color, linewidth: width, transparent: true, fog: false, dashed, dashSize: 0.3, gapSize: 0.22 });
      lineMats.push(m);
      return m;
    };
    function line(pts, mat) {
      const geo = new LineGeometry();
      geo.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const l = new Line2(geo, mat);
      if (mat.dashed) l.computeLineDistances();
      l.renderOrder = 3;
      scene.add(l);
      return l;
    }
    function makeRoute(ti) {
      const t = TRIPS[ti], r = RD[ti];
      const mats = {
        ghost: lineMat(t.color, 2.4, false), ghostX: lineMat(t.color, 2, true),
        trail: lineMat(t.color, 3.8, false), trailX: lineMat(t.color, 3, true),
      };
      // the road, re-sampled every ~250 m so it lies on the terrain, with km along it for every point
      const W = [], K = [];
      for (let i = 0; i < r.pts.length; i++) {
        const [la, lo] = r.pts[i];
        if (i) {
          const [la0, lo0] = r.pts[i - 1];
          const n = Math.ceil((r.K[i] - r.K[i - 1]) / 0.25);
          for (let k = 1; k < n; k++) {
            const f = k / n, a = la0 + (la - la0) * f, b = lo0 + (lo - lo0) * f;
            W.push(new THREE.Vector3(toX(b), ground(a, b) + 0.06, toZ(a))); K.push(r.K[i - 1] + (r.K[i] - r.K[i - 1]) * f);
          }
        }
        W.push(new THREE.Vector3(toX(lo), ground(la, lo) + 0.06, toZ(la))); K.push(r.K[i]);
      }
      const idxAt = (k) => { let a = 0, b = K.length - 1; while (b - a > 1) { const m = (a + b) >> 1; if (K[m] <= k) a = m; else b = m; } return a; };
      // one line per segment, so water, ferries, footpaths and travel that isn't included can be dashed
      const segs = r.segs.filter(([a, b]) => b > a).map(([a, b, mode]) => {
        const i0 = idxAt(r.K[a]), i1 = Math.max(i0 + 1, idxAt(r.K[b] + 1e-6));
        const pts = W.slice(i0, i1 + 1);
        const dashed = mode !== 'road';
        return { kA: K[i0], K: K.slice(i0, i1 + 1), segs: pts.length - 1,
          ghost: line(pts, dashed ? mats.ghostX : mats.ghost), trail: line(pts, dashed ? mats.trailX : mats.trail) };
      });
      const solid = r.segs.filter((s) => !s[2].startsWith('extra')).flatMap(([a, b]) => W.slice(idxAt(r.K[a]), idxAt(r.K[b] + 1e-6) + 1));
      const posAt = (k, out) => {
        const i = idxAt(k), j = Math.min(K.length - 1, i + 1);
        return out.lerpVectors(W[i], W[j], Math.max(0, Math.min(1, (k - K[i]) / (K[j] - K[i] || 1))));
      };
      return { t, mats, segs, posAt, pts: solid.length ? solid : W, ghost: 0, trail: 0 };
    }
    const routes = routeTrips.map((_, ti) => makeRoute(ti));
    const allPts = routes.flatMap((r) => r.pts);
    let reveal = calm ? 1 : 0; // the overview's routes draw themselves in the first time the map is seen

    // ---- the vehicle: a bright dot with a halo in the trip's colour
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const car = new THREE.Group();
    const carHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
    const carDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, fog: false, color: '#ffffff' }));
    car.add(carHalo, carDot);
    car.renderOrder = 5;
    car.visible = false;
    scene.add(car);

    // ---- places: one pin and one label per place, shared by trips that pass through it
    const pinGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
    pinGeo.translate(0, 0.5, 0);
    const pinMat = new THREE.MeshBasicMaterial({ color: '#fff1d6', fog: false });
    const places = new Map();
    function ensurePlace(t, ti, s, si) {
      let P = places.get(s.id);
      if (!P) {
        const v = new THREE.Vector3(toX(s.lon), ground(s.lat, s.lon), toZ(s.lat));
        const g = new THREE.Group();
        g.position.copy(v);
        const stem = new THREE.Mesh(pinGeo, pinMat);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, color: t.color }));
        g.add(stem, glow);
        scene.add(g);
        const el = document.createElement('button');
        el.type = 'button';
        el.tabIndex = -1; // the stop list and arrows are the keyboard route; labels are a mouse shortcut
        el.className = 'pin-label pin-label--stop is-hidden';
        el.textContent = s.name;
        labelsEl.appendChild(el);
        P = { id: s.id, v, g, stem, glow, el, at: [] };
        places.set(s.id, P);
        el.addEventListener('click', () => {
          stop();
          const here = P.at.find((a) => a[0] === trip) || P.at[0];
          if (here) show(here[0], here[1]);
        });
      }
      P.at.push([ti, si]);
      return P;
    }
    routeTrips.forEach((t, ti) => t.stops.forEach((s, si) => ensurePlace(t, ti, s, si)));
    // in the overview each trip is named on the map, and the name is a button
    const tripLabels = routeTrips.map((t, ti) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.tabIndex = -1;
      el.className = 'pin-label pin-label--trip is-hidden';
      el.style.setProperty('--c', t.color);
      el.innerHTML = `<i></i>${t.label}<small>${itineraries[itinIdx(t)].days.split(', ')[0]}</small>`;
      labelsEl.appendChild(el);
      el.addEventListener('click', () => { stop(); show(ti, -1); });
      return { el, P: places.get(t.anchor) };
    });
    const geoLabels = GEO_LABELS.map((e) => {
      const el = document.createElement('div');
      el.className = 'pin-label pin-label--geo is-hidden';
      el.textContent = e.name;
      labelsEl.appendChild(el);
      return { ...e, el, v: new THREE.Vector3(toX(e.lon), ground(e.lat, e.lon) + e.up, toZ(e.lat)) };
    });
    // towns on each route, named on the map as the vehicle comes near
    const townLabels = RD.flatMap((r, ti) => (r?.events || []).filter((e) => e.type === 'town' && e.lat).map((e) => {
      const el = document.createElement('div');
      el.className = 'pin-label pin-label--town is-hidden';
      el.textContent = e.name;
      labelsEl.appendChild(el);
      return { ti, km: e.km, el, v: new THREE.Vector3(toX(e.lon), ground(e.lat, e.lon) + 0.05, toZ(e.lat)) };
    }));
    // stopovers (diamonds) and sights (stars) on each route, tinted with the trip's colour, with names
    const markTex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); };
    const diamondTex = markTex((g) => {
      g.translate(32, 32); g.rotate(Math.PI / 4);
      g.fillStyle = '#fff'; g.fillRect(-17, -17, 34, 34);
      g.fillStyle = 'rgba(10,14,11,0.7)'; g.fillRect(-8, -8, 16, 16);
    });
    const starTex = markTex((g) => {
      g.fillStyle = '#fff'; g.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 29, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a)); }
      g.closePath(); g.fill();
    });
    const makeMarks = (ti) => (RD[ti]?.events || []).filter((e) => (e.type === 'stopover' || e.type === 'sight') && e.lat != null).map((e) => {
      const v = new THREE.Vector3(toX(e.lon), ground(e.lat, e.lon) + 0.05, toZ(e.lat));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: e.type === 'sight' ? starTex : diamondTex, color: TRIPS[ti].color, transparent: true, depthWrite: false, depthTest: false, fog: false }));
      sp.position.copy(v);
      sp.visible = false;
      sp.renderOrder = 4;
      scene.add(sp);
      const el = document.createElement('div');
      el.className = `pin-label pin-label--${e.type} is-hidden`;
      el.style.setProperty('--c', TRIPS[ti].color);
      if (e.type === 'sight') el.innerHTML = `${icon('sight')} ${e.name}`; else el.textContent = e.name;
      labelsEl.appendChild(el);
      return { ti, km: e.km, type: e.type, sp, el, v };
    });
    let marks = routeTrips.flatMap((_, ti) => makeMarks(ti));
    [...places.values()].map((P) => P.el).concat(tripLabels.map((L) => L.el), geoLabels.map((g) => g.el), townLabels.map((g) => g.el), marks.map((M) => M.el))
      .forEach((el) => { el._w = el.offsetWidth; el._h = el.offsetHeight; });

    // ---- camera shots
    function stopShot(t, i) {
      const s = t.stops[i];
      const p = places.get(s.id).v;
      // camera faces the stop's compass heading (0 = north, 90 = east), else the direction of travel
      let dir;
      if (s.heading !== undefined) {
        const a = (s.heading * Math.PI) / 180;
        dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
      } else {
        const prev = places.get(t.stops[Math.max(0, i - 1)].id).v, next = places.get(t.stops[Math.min(t.stops.length - 1, i + 1)].id).v;
        dir = new THREE.Vector3().subVectors(next, prev).setY(0);
        if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
        dir.normalize();
      }
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const [back, up, sideOff] = s.shot || [4, 2, 1.5];
      const cam = p.clone().addScaledVector(dir, -back).addScaledVector(side, sideOff);
      cam.y = Math.max(p.y, ground(-cam.z / S + CLAT, cam.x / S + CLON)) + up;
      return { cam, look: p.clone().add(new THREE.Vector3(0, up * 0.08, 0)) };
    }
    const stopShots = routeTrips.map((t) => t.stops.map((_, i) => stopShot(t, i)));
    // Explore / Build your own: throw away the last route's lines, pins and marks, and draw the new one
    function rebuildDyn(outlines) {
      const old = routes[DT];
      old?.segs.forEach((L) => { for (const l of [L.ghost, L.trail]) { scene.remove(l); l.geometry.dispose(); } });
      if (old) Object.values(old.mats).forEach((m) => { m.dispose(); lineMats.splice(lineMats.indexOf(m), 1); });
      routes[DT] = undefined; stopShots[DT] = [];
      places.forEach((P) => { P.at = P.at.filter((a) => a[0] !== DT); });
      marks.filter((M) => M.ti === DT).forEach((M) => { scene.remove(M.sp); M.sp.material.dispose(); M.el.remove(); });
      marks = marks.filter((M) => M.ti !== DT);
      if (!RD[DT] || !DYN.stops.length) return;
      for (const name of RD[DT].districts) if (outlines?.[name]) districtLine(name, outlines[name]);
      DYN.stops.forEach((st, si) => {
        const P = ensurePlace(DYN, DT, st, si);
        if (!P.el._w) { P.el._w = P.el.offsetWidth; P.el._h = P.el.offsetHeight; }
      });
      routes[DT] = makeRoute(DT);
      routes[DT].mats && Object.values(routes[DT].mats).forEach((m) => m.resolution.set(host.clientWidth, host.clientHeight));
      stopShots[DT] = DYN.stops.map((_, i) => stopShot(DYN, i));
      const fresh = makeMarks(DT);
      fresh.forEach((M) => { M.el._w = M.el.offsetWidth; M.el._h = M.el.offsetHeight; });
      marks = marks.concat(fresh);
    }

    // the part of the screen the card doesn't cover; the projection is shifted so shots centre in it
    const free = { x: 0, y: 0 }, freeTarget = { x: 0, y: 0 };
    let hud = [];
    function measureHUD() {
      const hr = host.getBoundingClientRect();
      // the title block is wider than what's in it: use the text and each chip, not the box
      const text = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
      hud = [...stage.querySelectorAll('.journey__head > .eyebrow, .journey__head h2')].map(text)
        .concat([...stage.querySelectorAll('.journey__chip, .journey__card, .journey__steps, .journey__compass')].map((el) => el.getBoundingClientRect()))
        .filter((r) => r && r.width)
        .map((r) => ({ x: r.left - hr.left - 6, y: r.top - hr.top - 6, w: r.width + 12, h: r.height + 12 }));
      const c = cardEl.getBoundingClientRect(), hd = stage.querySelector('.journey__head').getBoundingClientRect();
      const wide = hr.width >= 820;
      freeTarget.x = wide && c.width ? Math.min(c.width * 0.5, hr.width * 0.2) : 0;
      freeTarget.y = !wide && c.height ? Math.min(c.height * 0.42, hr.height * 0.24) : 0;
      // where a framed route has to fit: clear of the card, and of the title as far as the screen allows
      const st = stage.querySelector('.journey__steps').getBoundingClientRect(); // the stop list, bottom left
      freeRect = wide
        ? { x0: (st.width && !stage.classList.contains('is-framed') ? st.right - hr.left : 0) + 24, x1: (c.width ? c.left - hr.left : hr.width) - 24, y0: Math.min(hd.bottom - hr.top + 8, hr.height * 0.32), y1: hr.height - 34 }
        : { x0: 14, x1: hr.width - 14, y0: hd.bottom - hr.top + 8, y1: (c.height ? c.top - hr.top : hr.height) - 10 };
    }
    let freeRect = null;
    // frame a set of points from the south, looking down steeply enough to read the routes: place the
    // camera, see where the points land on screen, then move and zoom until they fill the free area
    const VIEW = new THREE.Vector3(0.1, 1.0, 0.5).normalize();
    const fitCam = camera.clone(), fp = new THREE.Vector3(), right = new THREE.Vector3(), upv = new THREE.Vector3();
    function frame(pts) {
      const step = Math.max(1, Math.floor(pts.length / 300));
      const sample = pts.filter((_, i) => i % step === 0);
      const box = new THREE.Box3().setFromPoints(sample);
      const c = box.getCenter(new THREE.Vector3());
      let d = box.getSize(new THREE.Vector3()).length() + 3;
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      const F = freeRect || { x0: 0, x1: w, y0: 0, y1: h };
      fitCam.copy(camera);
      fitCam.setViewOffset(w, h, freeTarget.x, freeTarget.y, w, h);
      for (let it = 0; it < 6; it++) {
        fitCam.position.copy(c).addScaledVector(VIEW, d);
        fitCam.lookAt(c);
        fitCam.updateMatrixWorld();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of sample) {
          fp.copy(p).project(fitCam);
          const x = (fp.x * 0.5 + 0.5) * w, y = (-fp.y * 0.5 + 0.5) * h;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        // recentre: shift the look point by the on-screen miss, converted to world units at this distance
        const perPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(fitCam.fov) / 2)) / h;
        right.setFromMatrixColumn(fitCam.matrixWorld, 0).setY(0).normalize();
        upv.set(right.z, 0, -right.x); // screen-up projected on the ground (towards the far side)
        c.addScaledVector(right, (((x0 + x1) / 2) - (F.x0 + F.x1) / 2) * perPx)
          .addScaledVector(upv, -(((y0 + y1) / 2) - (F.y0 + F.y1) / 2) * perPx * 1.6);
        d *= Math.max((x1 - x0) / (F.x1 - F.x0), (y1 - y0) / (F.y1 - F.y0)) * 1.06;
      }
      return { cam: c.clone().addScaledVector(VIEW, d), look: c };
    }

    // ---- flights between shots, and the chase camera while driving
    const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    let flight = null;
    function flyTo(shot, dur) {
      flight?.kill();
      const fromPos = cam.pos.clone(), fromLook = cam.look.clone();
      const hop = fromLook.distanceTo(shot.look);
      // long transfers climb like a light aircraft, short hops stay low over the hills
      const arc = Math.max(0, Math.min(45, hop * 0.4) - Math.min(fromPos.y, shot.cam.y) * 0.5);
      const o = { k: 0 };
      flight = gsap.to(o, { k: 1, duration: dur, ease: 'power1.out', onUpdate: () => {
        cam.pos.lerpVectors(fromPos, shot.cam, o.k);
        cam.look.lerpVectors(fromLook, shot.look, o.k);
        cam.pos.y += Math.sin(Math.PI * o.k) * arc;
      } });
      if (!dur) flight.progress(1);
    }
    // the chase sits higher and further back on long legs, so 300 km reads as a journey, not a blur
    const chase = { on: false, alt: 2, ahead: 1, dir: new THREE.Vector3(0, 0, -1) };
    const carPos = new THREE.Vector3(), aheadPos = new THREE.Vector3(), chasePos = new THREE.Vector3(), chaseLook = new THREE.Vector3();

    view = {
      lastFlight: 0,
      rebuildDyn,
      chase(km) {
        chase.on = km > 0;
        if (!chase.on) return;
        flight?.kill();
        chase.alt = THREE.MathUtils.clamp(0.7 + km * 0.03, 0.9, 9);
        chase.ahead = THREE.MathUtils.clamp(km * 0.06, 0.5, 14);
        const r = routes[trip];
        r.posAt(sim.odo, carPos); r.posAt(sim.odo + chase.ahead, aheadPos);
        const dir = aheadPos.sub(carPos).setY(0);
        if (dir.lengthSq() > 1e-6) chase.dir.copy(dir.normalize());
        this.lastFlight = 0;
      },
      apply({ instant = false } = {}) {
        measureHUD(); // the stop list and card have just changed
        const t = trip < 0 ? null : T(), n = t ? t.stops.length : 0;
        const shot = !t || !routes[trip] ? frame(allPts) : pos < 0 || pos >= n ? frame(routes[trip].pts.concat(marks.filter((M) => M.ti === trip).map((M) => M.v))) : stopShots[trip][pos];
        const dur = instant || calm ? 0 : 0.25;
        this.lastFlight = dur;
        flyTo(shot, dur);
        routes.forEach((r, i) => {
          if (!r) return;
          const on = i === trip;
          gsap.to(r, {
            ghost: !t ? 0.95 : on ? (pos < 0 ? 0.85 : 0.4) : 0.12,
            trail: on ? 1 : 0,
            duration: dur, ease: 'power1.out', overwrite: true,
          });
        });
      },
    };

    // a route picked while the map was still loading gets drawn now
    if (RD[DT] && DYN.stops.length) rebuildDyn(NET && Object.keys(NET.districts || {}).length ? NET.districts : ROUTES?.districts);

    // ---- render loop
    const mouse = new THREE.Vector2();
    window.addEventListener('pointermove', (e) => mouse.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5));
    function resize() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w < h ? 56 : 40;
      camera.updateProjectionMatrix();
      lineMats.forEach((m) => m.resolution.set(w, h));
      measureHUD();
      free.x = freeTarget.x; free.y = freeTarget.y;
      if (!chase.on && (!flight || !flight.isActive())) view.apply({ instant: true });
    }
    resize();
    new ResizeObserver(resize).observe(host);

    let visible = true, revealing = false;
    const startReveal = () => {
      if (revealing || reveal > 0) return;
      revealing = true;
      gsap.to({ k: 0 }, { k: 1, duration: 0.25, ease: 'power1.out', onUpdate() { reveal = this.targets()[0].k; } });
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) startReveal();
    }, { rootMargin: '200px' }).observe(host);
    // already on screen when the build finishes (or a "See the route" link brought us here)
    const hr = host.getBoundingClientRect();
    if (hr.top < innerHeight && hr.bottom > 0) startReveal();

    const proj = new THREE.Vector3(), camPos = new THREE.Vector3(), tmp = new THREE.Vector3();
    const clock = new THREE.Clock();
    let frameNo = 0;

    gsap.ticker.add(() => {
      // (dev: window.__forceVisible lets automated checks render while the preview pane is hidden)
      if (!visible && !(import.meta.env.DEV && window.__forceVisible)) return;
      const t = clock.getElapsedTime();
      if (frameNo++ % 20 === 0) measureHUD();
      free.x += (freeTarget.x - free.x) * 0.08;
      free.y += (freeTarget.y - free.y) * 0.08;
      const w = host.clientWidth, h = host.clientHeight;
      camera.setViewOffset(w, h, free.x, free.y, w, h);
      tick();

      // the vehicle, and the camera chasing it
      const active = trip >= 0 ? routes[trip] || null : null;
      car.visible = !!active && reveal > 0.95;
      if (active) {
        active.posAt(sim.odo, carPos);
        car.position.copy(carPos);
        const d = camera.position.distanceTo(carPos);
        carHalo.material.color.set(active.t.color);
        carHalo.scale.setScalar(d * 0.05 * (1 + Math.sin(t * 4) * 0.12));
        carDot.scale.setScalar(d * 0.012);
        if (chase.on) {
          active.posAt(sim.odo + chase.ahead, aheadPos);
          const dir = aheadPos.sub(carPos).setY(0);
          if (dir.lengthSq() > 1e-6) chase.dir.lerp(dir.normalize(), 0.04).normalize();
          chasePos.copy(carPos).addScaledVector(chase.dir, -chase.alt * 1.6);
          chasePos.y = Math.max(chasePos.y, carPos.y) + chase.alt;
          chaseLook.copy(carPos).addScaledVector(chase.dir, chase.alt * 0.5);
          cam.pos.lerp(chasePos, 0.05);
          cam.look.lerp(chaseLook, 0.08);
        }
      }

      // gentle parallax with the pointer, scaled to how far away we are
      const dist = cam.pos.distanceTo(cam.look);
      // thin the haze when a whole trip or the country is framed from high up, so it stays crisp
      scene.fog.density = 0.0036 * Math.min(1, 40 / Math.max(1, dist));
      camPos.copy(cam.pos);
      if (!chase.on) {
        camPos.x += mouse.x * Math.min(dist, 24) * 0.1;
        camPos.y += -mouse.y * Math.min(dist, 24) * 0.05;
      }
      // keep the camera above the ground it is flying over
      const gy = ground(-camPos.z / S + CLAT, camPos.x / S + CLON);
      if (camPos.y < gy + 0.25) camPos.y = gy + 0.25;
      camera.position.copy(camPos);
      camera.lookAt(cam.look);

      routes.forEach((r, ri) => {
        if (!r) return;
        r.mats.ghost.opacity = r.mats.ghostX.opacity = r.ghost;
        r.mats.trail.opacity = r.mats.trailX.opacity = r.trail;
        const n = r.segs.length;
        r.segs.forEach((L, i) => {
          const g = Math.max(0, Math.min(1, reveal * n - i + 0.5));
          L.ghost.geometry.instanceCount = Math.floor(L.segs * g);
          L.ghost.visible = r.ghost > 0.01;
          L.trail.visible = r.trail > 0.01;
          if (!L.trail.visible) return;
          // the trail ends exactly at the vehicle
          const k = ri === trip ? sim.odo : 0;
          let c = 0; while (c < L.segs && L.K[c + 1] <= k) c++;
          L.trail.geometry.instanceCount = c;
        });
      });

      // districts: outlines for the active trip's districts, the one we're in brightest
      const here = active ? RD[trip].districtAt(sim.odo) : null;
      const mine = active ? RD[trip].districts : [];
      districtLines.forEach((D, name) => {
        const target = !active ? 0 : name === here ? 0.85 : mine.includes(name) ? (chase.on ? 0.18 : 0.12) : 0;
        D.op += (target - D.op) * 0.08;
        D.mat.opacity = D.op;
        D.group.visible = D.op > 0.01;
      });

      // pins: only the active trip's places (all of them in the overview), sized to read at every altitude
      const cur = trip >= 0 && pos >= 0 && pos < T().stops.length && !driving ? T().stops[pos].id : null;
      places.forEach((P, id) => {
        const mine = trip < 0 ? P.at.some((a) => a[0] < DT) : P.at.some((a) => a[0] === trip);
        P.g.visible = mine && reveal > 0.95;
        if (!P.g.visible) return;
        const d = camera.position.distanceTo(P.v);
        const on = id === cur;
        const hgt = d * (trip < 0 ? 0.025 : 0.06);
        P.stem.scale.y = hgt;
        P.glow.position.y = hgt;
        P.glow.scale.setScalar(d * (on ? 0.045 : trip < 0 ? 0.012 : 0.016) * (1 + Math.sin(t * 3) * (on ? 0.15 : 0.05)));
        P.glow.material.color.set(trip >= 0 ? T().color : TRIPS[P.at[0][0]].color);
      });
      marks.forEach((M) => {
        M.sp.visible = M.ti === trip && reveal > 0.95;
        if (M.sp.visible) M.sp.scale.setScalar(camera.position.distanceTo(M.v) * (M.type === 'sight' ? 0.028 : 0.022));
      });
      clouds.forEach((c) => { c.position.x += Math.sin(t * 0.07 + c.userData.phase) * 0.002; c.material.opacity = 0.42 + Math.sin(t * 0.3 + c.userData.phase) * 0.08; });

      // labels, most important first; anything that would overlap a label already placed or the
      // card, title or stop list is hidden for this frame
      const taken = hud.slice();
      // nudge: slide a label sideways to stay on screen rather than hide it (trip names in the overview)
      const place = (el, v, yOff, ok, nudge) => {
        if (!ok) { el.classList.add('is-hidden'); return; }
        proj.copy(v); proj.y += yOff;
        proj.project(camera);
        let x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;
        if (nudge) x = Math.max(4 + el._w / 2, Math.min(w - 4 - el._w / 2, x));
        const r = { x: x - el._w / 2, y: y - el._h, w: el._w, h: el._h };
        const hidden = proj.z > 1 || r.x < 4 || r.y < 4 || r.x + r.w > w - 4 || r.y + r.h > h - 4
          || taken.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
        el.classList.toggle('is-hidden', hidden);
        if (!hidden) { taken.push(r); el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
      };
      const pinTop = (P) => tmp.copy(P.v).setY(P.v.y + P.glow.position.y);
      const dCam = camera.position.distanceTo(cam.look);
      const settled = chase.on || !flight || !flight.isActive() || flight.progress() > 0.85;
      if (cur) { const P = places.get(cur); P.el.classList.add('is-active'); place(P.el, pinTop(P), 0.02 * camera.position.distanceTo(P.v), true); }
      tripLabels.forEach((L) => place(L.el, pinTop(L.P), 0.012 * camera.position.distanceTo(L.P.v), trip < 0 && reveal > 0.95 && settled, true));
      places.forEach((P, id) => {
        if (id === cur) return;
        P.el.classList.remove('is-active');
        place(P.el, pinTop(P), 0.02 * camera.position.distanceTo(P.v), trip >= 0 && P.g.visible && settled);
      });
      // stopovers and sights: all of the trip's when looking at it, the ones near the vehicle while driving
      const markWin = chase.on ? Math.max(20, chase.ahead * 8) : Infinity;
      marks.forEach((M) => place(M.el, M.v, 0.022 * camera.position.distanceTo(M.v), M.ti === trip && settled
        && (!chase.on || (M.km > sim.odo - markWin * 0.3 && M.km < sim.odo + markWin))));
      // towns near the vehicle (behind it fade out quickly, ahead of it come up as you approach)
      const win = chase.on ? Math.max(15, chase.ahead * 6) : 12;
      townLabels.forEach((L) => place(L.el, L.v, 0, L.ti === trip && settled && L.km > sim.odo - win * 0.3 && L.km < sim.odo + win));
      geoLabels.forEach((g) => {
        // local names only on the matching close-up; regional names only from altitude
        place(g.el, g.v, 0, settled && !chase.on && (g.near ? g.near === cur && dCam < 6 : dCam > 5));
      });

      renderer.render(scene, camera);
    });
  }
}
