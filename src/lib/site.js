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
import { places } from '../data/content.js';

const wantsPreview = () => new URLSearchParams(location.search).has('preview');

export async function loadSite(ms = 2500) {
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
    const chosen = s.kind === 'video' ? o.video : o.photo;
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
