import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initHero } from './modules/hero.js';
import { initGame } from './modules/game.js';
import { initTerrain } from './modules/terrain.js';
import { initTunnel, albumIs3D, mountAlbum3D } from './modules/tunnel.js';
import { renderSections, initUI } from './modules/ui.js';
import { loadSite, applySite } from './lib/site.js';

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger });
document.documentElement.classList.remove('no-js');

// one section failing (e.g. no WebGL on an old phone) mustn't take the rest of the page down with it
const safely = (name, fn) => { try { return fn(); } catch (err) { console.error(`[${name}]`, err); } };

// the album is chosen once, at load: the 3D fly-through on large desktop screens, the wall elsewhere
const album3D = albumIs3D();
if (album3D) mountAlbum3D();

// ---- build the page: the admin portal's photo changes first, then every section. No loading screen:
// the static page shows straight away and the sections fill in as soon as the site file arrives.
loadSite().then((site) => {
  safely('admin changes', () => applySite(site));
  renderSections();
  const hero = safely('hero', initHero);
  safely('wildlife', initGame);
  safely('map', initTerrain);
  if (album3D) safely('album', initTunnel);
  safely('ui', initUI);
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  hero && hero.start();
});

window.addEventListener('load', () => ScrollTrigger.refresh());
// lazy photos keep growing the page after load (the album wall, the swipe rows); re-measure whenever its
// height changes, or every scroll-triggered effect further down fires at the old positions
let pageH = 0, remeasure;
new ResizeObserver(() => {
  const h = document.documentElement.scrollHeight;
  if (Math.abs(h - pageH) < 2) return;
  pageH = h;
  clearTimeout(remeasure);
  remeasure = setTimeout(() => ScrollTrigger.refresh(), 250);
}).observe(document.body);
