// The wildlife: one card per sighting. A clip previews itself, silently, while the pointer is over its card
// (on a phone, while the card is on screen); the browser's own controls are there to watch it with sound.
// Photos are shown as they are.
import { game, uglyFive } from '../data/content.js';
import { photo, poster, videoSrc, photoMeta, videoMeta, autoPreview } from '../lib/media.js';

export function initGame() {
  const grid = document.getElementById('gameGrid');
  const esc = (t) => t.replace(/"/g, '&quot;');
  grid.innerHTML = game.map((g) => `
    <article class="wild" data-reveal>
      <div class="wild__media">${g.key
        ? `<video controls playsinline muted loop preload="none" poster="${poster(g.key)}" aria-label="${esc(`${g.word}: ${g.note}`)}"><source src="${videoSrc(g.key)}" type="video/${videoMeta(g.key)?.ext === 'webm' ? 'webm' : 'mp4'}" /></video>`
        : `<img src="${photo(g.photo, 900)}" alt="${esc(photoMeta(g.photo)?.alt || g.word)}" loading="lazy" decoding="async" />`}</div>
      <div class="wild__body">
        <div class="eyebrow">${g.kicker}</div>
        <h3>${g.word}</h3>
        <p>${g.note}</p>
        <small>${g.place}</small>
      </div>
    </article>`).join('');
  grid.querySelectorAll('.wild').forEach((card) => {
    const v = card.querySelector('video');
    if (v) autoPreview(card, () => v);
  });
  // one clip at a time: starting a clip pauses the one before it
  grid.addEventListener('play', (e) => {
    grid.querySelectorAll('video').forEach((v) => { if (v !== e.target) v.pause(); });
  }, true);

  // the Ugly 5, on the same cards; one without a photo says why
  const ugly = document.getElementById('uglyGrid');
  if (ugly) {
    ugly.innerHTML = uglyFive.map((u, i) => `
    <article class="wild" data-reveal>
      <div class="wild__media${u.photo ? '' : ' wild__media--none'}">${u.photo
        ? `<img src="${photo(u.photo, 900)}" alt="${esc(photoMeta(u.photo)?.alt || u.word)}" loading="lazy" decoding="async" />`
        : `<span class="eyebrow">${u.absent ? 'Not found in Uganda' : "We haven't photographed one yet"}</span>`}</div>
      <div class="wild__body">
        <div class="eyebrow">${String(i + 1).padStart(2, '0')}</div>
        <h3>${u.word}</h3>
        <p>${u.note}</p>
      </div>
    </article>`).join('');
  }
}
