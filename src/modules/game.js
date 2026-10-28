// The wildlife: one card per sighting. Clips show their poster and play only when the visitor presses
// play, with the browser's own controls (sound included); photos are shown as they are.
import { game } from '../data/content.js';
import { photo, poster, videoSrc, photoMeta, videoMeta } from '../lib/media.js';

export function initGame() {
  const grid = document.getElementById('gameGrid');
  const esc = (t) => t.replace(/"/g, '&quot;');
  grid.innerHTML = game.map((g) => `
    <article class="wild" data-reveal>
      <div class="wild__media">${g.key
        ? `<video controls playsinline preload="none" poster="${poster(g.key)}" aria-label="${esc(`${g.word}: ${g.note}`)}"><source src="${videoSrc(g.key)}" type="video/${videoMeta(g.key)?.ext === 'webm' ? 'webm' : 'mp4'}" /></video>`
        : `<img src="${photo(g.photo, 900)}" alt="${esc(photoMeta(g.photo)?.alt || g.word)}" loading="lazy" decoding="async" />`}</div>
      <div class="wild__body">
        <div class="eyebrow">${g.kicker}</div>
        <h3>${g.word}</h3>
        <p>${g.note}</p>
        <small>${g.place}</small>
      </div>
    </article>`).join('');
  // one clip at a time: starting a clip pauses the one before it
  grid.addEventListener('play', (e) => {
    grid.querySelectorAll('video').forEach((v) => { if (v !== e.target) v.pause(); });
  }, true);
}
