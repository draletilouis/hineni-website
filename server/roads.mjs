// Road links for a place added in the admin portal, so the map's "Explore" and "Build your own" can drive
// to it. Like tools/fetch-network.mjs does for the places in the code: real roads from OSRM (OpenStreetMap)
// to the place's nearest neighbours, in the same shape as public/terrain/network.json's edges
// ({ a, b, km, pts: [[lat, lon]…], walk: [0|1, 0|1] }). Asked once, when the place is added or moved, and
// stored with it. If the routing service can't be reached, a straight link stands in (marked `straight`),
// so the drive still works; moving the place again retries.
// Only coordinates are sent. Map data © OpenStreetMap contributors (ODbL).

const OSRM = process.env.OSRM_URL || 'https://router.project-osrm.org';
const UA = { 'user-agent': 'tour-site-map/1.0' };

const rad = (d) => (d * Math.PI) / 180;
export const hav = ([la0, lo0], [la1, lo1]) => {
  const a = Math.sin(rad(la1 - la0) / 2) ** 2 + Math.cos(rad(la0)) * Math.cos(rad(la1)) * Math.sin(rad(lo1 - lo0) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
};
// fewer points on straight stretches (Douglas–Peucker), as the built network does
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

async function osrm(a, b) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`${OSRM}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, { headers: UA, signal: ctl.signal });
    const j = await r.json();
    return j.code === 'Ok' && j.routes?.[0] ? j : null;
  } finally {
    clearTimeout(timer);
  }
}

// one link from place A to place B: on the road, with the bit past its end (a summit, a viewpoint) on foot
async function link(A, B) {
  const P = (p) => [p.lat, p.lon];
  let j = null;
  try { j = await osrm(P(A), P(B)); } catch { /* offline or slow: a straight link below */ }
  if (!j) {
    return { a: A.id, b: B.id, km: +(hav(P(A), P(B)) * 1.3).toFixed(1), pts: round([P(A), P(B)]), walk: [0, 0], straight: 1 };
  }
  const R = j.routes[0];
  const s0 = [j.waypoints[0].location[1], j.waypoints[0].location[0]], s1 = [j.waypoints[1].location[1], j.waypoints[1].location[0]];
  let pts = simplify(R.geometry.coordinates.map(([x, y]) => [y, x]), 0.0004);
  const head = hav(P(A), s0) > 0.3, tail = hav(P(B), s1) > 0.3;
  pts = [...(head ? [P(A)] : []), ...pts, ...(tail ? [P(B)] : [])];
  if (!head) pts[0] = P(A);
  if (!tail) pts[pts.length - 1] = P(B);
  const km = +(R.distance / 1000 + (head ? hav(P(A), s0) : 0) + (tail ? hav(P(B), s1) : 0)).toFixed(1);
  return { a: A.id, b: B.id, km, pts: round(pts), walk: [head ? 1 : 0, tail ? 1 : 0] };
}

// the links for `place`: its three nearest neighbours in the same region, plus the nearest place of all
// (so a place in a new corner of the country still joins the network), plus Kampala if it's the region
// "on the road from Kampala"
export async function roadsFor(place, others) {
  const P = [place.lat, place.lon];
  const by = (list) => list.filter((q) => q.id !== place.id && Number.isFinite(q.lat))
    .sort((a, b) => hav(P, [a.lat, a.lon]) - hav(P, [b.lat, b.lon]));
  const pick = new Map();
  by(others.filter((q) => q.region === place.region)).slice(0, 3).forEach((q) => pick.set(q.id, q));
  by(others).slice(0, 1).forEach((q) => pick.set(q.id, q));
  if (place.region === 'road') { const k = others.find((q) => q.id === 'kampala'); if (k) pick.set(k.id, k); }
  const links = [];
  for (const q of pick.values()) links.push(await link(place, q)); // one at a time: the public server asks for that
  return links;
}
