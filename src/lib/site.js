// The admin portal's changes live on the server (GET /api/site), not in the build: new photos, clips and
// trips, captions, removed photos, swapped placements and edited words. The page fetches them once at
// start-up and applies them before anything renders. No server (a plain static host, or the API is down)
// means the site exactly as built.
//
// /?preview opens the site with the portal's unpublished draft instead (signed-in admins only), with a
// bar saying so.
import { addPhotos, addVideos, photoMeta, videoMeta } from './media.js';
import { applyAlbum } from '../data/photos.js';
import { photoSlots } from '../data/slots.js';
import { textFields } from '../data/fields.js';
import { places, regions, mapExtras } from '../data/content.js';

const wantsPreview = () => new URLSearchParams(location.search).has('preview');

export async function loadSite(ms = 2500) {
  // the server writes the published changes into the page (server/index.mjs): no request needed
  const inline = window.__HINENI_SITE__;
  if (!wantsPreview() && inline?.version === 1) return inline;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}api/site${wantsPreview() ? '?preview=1' : ''}`, { signal: ctl.signal, cache: 'no-cache' });
    if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) return null;
    const site = await r.json();
    return site?.version === 1 ? site : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function applySite(site) {
  if (wantsPreview()) previewBar(!!site?.preview);
  if (!site) return;
  addPhotos(site.photos, site.edits);
  addVideos(site.videos);
  applyAlbum(site);

  // a photo or clip replaced in the portal: the new one shows wherever the old one did
  const swap = (key) => { for (let i = 0; i < 20 && site.replaced?.[key]; i++) key = site.replaced[key]; return key; };

  // the map: the photos and clips the portal chose for each place, and for each stopover (stopovers it
  // added come with their name and position too; src/modules/terrain.js puts them on the road)
  const known = (k) => typeof k === 'string' && (photoMeta(k) || videoMeta(k));
  // regions: the code's, as the portal renamed, described or recoloured them; and the portal's own
  const regionKeys = ['name', 'blurb', 'color', 'hub'];
  for (const [id, m] of Object.entries(site.map?.regions || {})) {
    let r = regions.find((x) => x.id === id);
    if (!r) {
      if (!m.custom || !m.name) continue;
      r = { id, custom: true, name: m.name, blurb: '', color: '#a9c47f' };
      regions.push(r);
    }
    for (const k of regionKeys) if (typeof m[k] === 'string' && m[k]) r[k] = m[k];
    // best time, what you'll see, good to know: emptied in the portal means not shown
    for (const k of ['when', 'see', 'know']) if (typeof m[k] === 'string') r[k] = m[k];
    if ('hidden' in m) r.hidden = !!m.hidden;
  }
  // places the portal added to a region: on the map with the rest, with road links to their neighbours
  for (const [id, m] of Object.entries(site.map?.places || {})) {
    if (m.custom && !regions.some((r) => r.id === m.region)) continue;
    if (!m.custom || places.some((x) => x.id === id) || !Number.isFinite(m.lat) || !Number.isFinite(m.lon) || !m.name) continue;
    places.push({ id, custom: true, name: m.name, region: m.region, lat: m.lat, lon: m.lon, note: m.note || '', addon: !!m.addon, hidden: !!m.hidden, photos: [] });
    if (Array.isArray(m.roads)) mapExtras.roads.push(...m.roads);
  }
  for (const [id, m] of Object.entries(site.map?.places || {})) {
    const p = places.find((x) => x.id === id);
    if (!p) continue;
    // the code's places: their wording as the portal changed it, and whether they're on the map at all
    if (!p.custom) {
      if (typeof m.name === 'string' && m.name) p.name = m.name;
      if (typeof m.note === 'string') p.note = m.note;
      if ('addon' in m) p.addon = !!m.addon;
      if ('hidden' in m) p.hidden = !!m.hidden;
    }
    if (!Array.isArray(m.photos)) continue;
    p.photos = m.photos.filter(known);
    if (!p.photos.length) delete p.photos;
  }
  for (const [id, s] of Object.entries(site.map?.stopovers || {})) {
    mapExtras.stopovers[id] = { ...s, photos: (s.photos || []).filter(known) };
  }

  // removed photos leave the map too
  const hidden = new Set(site.hidden || []);
  for (const p of places) {
    if (!p.photos) continue;
    p.photos = [...new Set(p.photos.map(swap))].filter((k) => !hidden.has(k));
    if (!p.photos.length) delete p.photos;
  }
  for (const s of Object.values(mapExtras.stopovers)) s.photos = [...new Set(s.photos.map(swap))].filter((k) => !hidden.has(k));

  for (const s of photoSlots()) {
    const o = site.slots?.[s.id] || {};
    const chosen = swap((s.kind === 'video' ? o.video : o.photo) || s.get());
    const known = s.kind === 'video' ? videoMeta(chosen) : photoMeta(chosen);
    if (chosen && known && chosen !== s.get()) {
      s.set(chosen);
      delete s.obj.focus; // the crop nudge was for the old photo
    }
    for (const f of s.fields || []) if (typeof o[f.name] === 'string') s.obj[f.name] = o[f.name];
  }

  for (const f of textFields()) {
    const v = site.text?.[f.id];
    if (typeof v === 'string') f.set(v);
  }
}

// the bar across the top of a preview: what you're looking at, and the way back to publish it
function previewBar(isDraft) {
  const bar = document.createElement('div');
  bar.className = 'preview-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = isDraft
    ? '<span><b>Preview.</b> Unpublished changes, visible only to you.</span><a href="/admin">Back to the portal to publish</a>'
    : '<span><b>Not a preview.</b> Sign in to the portal first to see unpublished changes.</span><a href="/admin">Sign in</a>';
  document.body.prepend(bar);
  document.documentElement.classList.add('has-preview-bar');
}
