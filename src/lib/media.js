import manifest from '../data/media.json';
// credited Wikimedia Commons photos of places we haven't photographed ourselves (tools/web-photos.mjs)
import web from '../data/web-photos.json';

const BASE = import.meta.env.BASE_URL + 'media/';
// photos added from the admin portal (keys start "u-") are served from the server's upload store
const UPLOADS = import.meta.env.BASE_URL + 'uploads/';
const base = (key) => (key.startsWith('u-') ? UPLOADS : BASE);

export const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function photo(key, size = 2000) {
  return `${base(key)}${key}-${size}.webp`;
}
// responsive sources: the browser picks the sharpest file the screen can actually use
export function srcset(key) {
  return [900, 1600, 2800].map((w) => `${base(key)}${key}-${w}.webp ${w}w`).join(', ');
}
// <img> markup with srcset; `sizes` describes how wide the image renders (CSS px)
export function imgTag(key, { sizes = '100vw', alt, cls = '', lazy = true, attrs = '' } = {}) {
  const a = alt ?? photoMeta(key)?.alt ?? '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${base(key)}${key}-1600.webp" srcset="${srcset(key)}" sizes="${sizes}" alt="${a.replace(/"/g, '&quot;')}"${lazy ? ' loading="lazy" decoding="async"' : ''} ${attrs}/>`;
}

export function photoMeta(key) {
  return manifest.photos[key] || web[key];
}
// "Photo: name, licence, Wikimedia Commons" for a web photo, as the licence requires; '' for our own
export function webCredit(key) {
  const w = web[key];
  if (!w) return '';
  const esc = (t) => t.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return `Photo: <a href="${w.source}" target="_blank" rel="noopener">${esc(w.credit)}</a>, `
    + `<a href="${w.licenseUrl}" target="_blank" rel="noopener">${esc(w.license)}</a>, Wikimedia Commons`;
}
// uploaded photos and caption changes from the admin portal (src/lib/site.js)
export function addPhotos(photos = {}, edits = {}) {
  Object.assign(manifest.photos, photos);
  for (const [key, e] of Object.entries(edits)) {
    if (manifest.photos[key] && typeof e.alt === 'string') manifest.photos[key] = { ...manifest.photos[key], alt: e.alt };
  }
}
export function allPhotos() {
  return Object.values(manifest.photos);
}

// data-saver or a slow connection gets the light clips even on a big screen
export const slowNet = () => {
  const c = navigator.connection;
  return !!c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || ''));
};

export function videoSrc(key, small = isMobile() || slowNet()) {
  return `${BASE}${key}${small ? '-sm' : ''}.mp4`;
}
export function poster(key) {
  return `${BASE}${key}-poster.webp`;
}
export function videoMeta(key) {
  return manifest.videos[key];
}

export function makeVideo(key, { small, preload = 'metadata', loop = true, withPoster = true } = {}) {
  const v = document.createElement('video');
  v.muted = true;
  v.loop = loop;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('muted', '');
  v.preload = preload;
  v.crossOrigin = 'anonymous';
  if (withPoster) v.poster = poster(key);
  v.src = videoSrc(key, small);
  return v;
}

// Global sound state: modules listen for `sound:change` and unmute their active clip.
export const sound = {
  on: false,
  set(on) {
    this.on = on;
    window.dispatchEvent(new CustomEvent('sound:change', { detail: on }));
  },
};

export function safePlay(v) {
  if (!v) return;
  v.muted = !sound.on;
  const p = v.play();
  if (p && p.catch) {
    p.catch(() => {
      // Autoplay with sound refused: fall back to muted playback.
      v.muted = true;
      v.play().catch(() => {});
    });
  }
}
