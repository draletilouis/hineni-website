// Hero: a full-screen slideshow of the best photos, shown as real images — the browser
// renders them natively at full sharpness (responsive srcset), with a 250ms crossfade.
// It moves only when asked: arrows, thumbnails, swipe and the keyboard.
import { gsap } from 'gsap';
import { heroReel } from '../data/content.js';
import { isMobile, photo, srcset, reducedMotion } from '../lib/media.js';

export function initHero() {
  const host = document.getElementById('heroGL');
  const hero = document.getElementById('hero');
  const slides = isMobile() ? heroReel.slides.tall : heroReel.slides.wide;
  const N = slides.length;
  const FADE = 0.25;   // crossfade, ease-out
  const rm = reducedMotion();

  const ui = {
    num: document.getElementById('slideNum'), total: document.getElementById('slideTotal'),
    title: document.getElementById('slideTitle'), place: document.getElementById('slidePlace'),
    progress: document.getElementById('heroProgress'), thumbs: document.getElementById('slideThumbs'),
    prev: document.getElementById('slidePrev'), next: document.getElementById('slideNext'),
  };
  ui.total.textContent = `/ ${String(N).padStart(2, '0')}`;
  ui.progress.innerHTML = slides.map(() => '<i><b></b></i>').join('');
  const bars = [...ui.progress.querySelectorAll('b')];
  ui.thumbs.innerHTML = slides.map((s, i) => `
    <button class="slides-ui__thumb" data-i="${i}" aria-label="Show ${s.title}" data-cursor="hover">
      <img src="${photo(s.photo, 900)}" alt="" loading="lazy" /></button>`).join('');
  const thumbEls = [...ui.thumbs.children];

  // one <img> per slide, stacked; only the active one (and the one fading out) is visible
  const pos = (s) => { const [x, y] = s.focus || [0.5, 0.5]; return `${x * 100}% ${y * 100}%`; };
  host.innerHTML = slides.map((s, i) => `
    <img class="hero-slide${i === 0 ? ' is-active' : ''}" alt="${s.title} — ${s.place}"
      ${i === 0 ? `src="${photo(s.photo, 1600)}" srcset="${srcset(s.photo)}"` : `data-srcset="${srcset(s.photo)}" data-src="${photo(s.photo, 1600)}"`}
      sizes="100vw" decoding="async" ${i === 0 ? 'fetchpriority="high"' : ''}
      style="object-position:${pos(s)};transform-origin:${pos(s)}" />`).join('');
  const imgs = [...host.querySelectorAll('.hero-slide')];

  // load a slide's image (srcset) and wait until it is decoded, so a crossfade never shows a gap
  const ready = imgs.map(() => null);
  function load(i) {
    if (ready[i]) return ready[i];
    const img = imgs[i];
    if (img.dataset.srcset) { img.srcset = img.dataset.srcset; img.src = img.dataset.src; delete img.dataset.srcset; }
    ready[i] = img.decode().then(() => true).catch(() => img.complete && img.naturalWidth > 0);
    return ready[i];
  }
  load(0);

  // ---- captions + controls
  function caption(i, dir) {
    const s = slides[i];
    ui.num.textContent = String(i + 1).padStart(2, '0');
    ui.title.textContent = s.title;
    ui.place.textContent = s.place;
    gsap.fromTo([ui.num, ui.title, ui.place], { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
    thumbEls.forEach((t, j) => t.classList.toggle('is-active', j === i));
    const t = thumbEls[i];
    ui.thumbs.scrollTo({ left: t.offsetLeft - ui.thumbs.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
  }
  // the bars show where you are in the set, not a countdown
  function runBar(i) {
    bars.forEach((b, j) => gsap.set(b, { scaleX: j <= i ? 1 : 0 }));
  }

  // ---- sequencing
  let cur = 0, busy = false;
  const inView = () => hero.getBoundingClientRect().bottom > 0;
  async function go(target, dir) {
    if (busy) return;
    const n = ((target % N) + N) % N;
    if (n === cur) return;
    busy = true;
    const ok = await load(n);
    if (!ok) { busy = false; cur = n; go(n + dir, dir); return; }
    const from = imgs[cur], to = imgs[n];
    caption(n, dir);
    runBar(n);
    to.classList.add('is-active');
    gsap.fromTo(to, { opacity: 0 }, { opacity: 1, duration: rm ? 0.01 : FADE, ease: 'power1.out', onComplete: () => {
      from.classList.remove('is-active');
      gsap.set(from, { opacity: 0 });
      cur = n;
      busy = false;
      load((n + 1) % N); // prefetch the next photo
    } });
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    gsap.set(imgs[0], { opacity: 1 });
    caption(0, 1);
    runBar(0);
    load(1);
  }

  // ---- input
  ui.next.addEventListener('click', () => go(cur + 1, 1));
  ui.prev.addEventListener('click', () => go(cur - 1, -1));
  ui.thumbs.addEventListener('click', (e) => {
    const b = e.target.closest('.slides-ui__thumb');
    if (b) go(+b.dataset.i, +b.dataset.i > cur ? 1 : -1);
  });
  let sx = null, sy = 0;
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button')) return;
    sx = e.clientX; sy = e.clientY;
  });
  hero.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  window.addEventListener('keydown', (e) => {
    if (!inView() || document.querySelector('.lightbox.is-open, .film.is-open')) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') go(cur + 1, 1);
    if (e.key === 'ArrowLeft') go(cur - 1, -1);
  });

  return { start };
}
