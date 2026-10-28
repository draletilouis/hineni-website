// The admin portal's changes live on the server (GET /api/site), not in the build: new photos and
// trips, captions, removed photos and swapped placements. The page fetches them once at start-up
// and applies them before anything renders. No server (a plain static host, or the API is down)
// means the site exactly as built.
import { addPhotos, photoMeta } from './media.js';
import { applyAlbum } from '../data/photos.js';
import { photoSlots } from '../data/slots.js';
import { places } from '../data/content.js';

export async function loadSite(ms = 2500) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}api/site`, { signal: ctl.signal, cache: 'no-cache' });
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
  if (!site) return;
  addPhotos(site.photos, site.edits);
  applyAlbum(site);

  // removed photos leave the map too
  const hidden = new Set(site.hidden || []);
  for (const p of places) {
    if (!p.photos) continue;
    p.photos = p.photos.filter((k) => !hidden.has(k));
    if (!p.photos.length) delete p.photos;
  }

  for (const s of photoSlots()) {
    const o = site.slots?.[s.id];
    if (!o) continue;
    if (o.photo && photoMeta(o.photo) && o.photo !== s.get()) {
      s.set(o.photo);
      delete s.obj.focus; // the crop nudge was for the old photo
    }
    for (const f of s.fields || []) if (typeof o[f.name] === 'string') s.obj[f.name] = o[f.name];
  }
}
