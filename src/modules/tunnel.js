// The album: the camera flies down a spiral of our travellers' photos as you scroll, one chapter per
// trip in the order they ran, each chapter in the order the photos were taken. Planes bend with scroll
// speed and fade from monochrome to full colour as they approach. Stop scrolling and the nearest photo
// comes forward to be looked at; click one and it flies into full view.
// It's the home of every photo: elsewhere on the site a photo is a door in here ([data-album-key] opens
// the album at that photo, [data-album-trip] at a trip's chapter), and "Grid view" shows the same
// photos as a flat, filterable wall. Large desktop screens only (see albumIs3D); elsewhere the wall is the album.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { photo, photoMeta, isMobile } from '../lib/media.js';
import { catalogue, albumChapters, photoTrips, tripOf } from '../data/photos.js';
import { openLightbox, setCursor, openGrid } from './ui.js';
import { icon } from '../lib/icons.js';

const vert = /* glsl */ `
  uniform float uBend;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159) * uBend;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uHover;
  uniform float uReady;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec2 uv = (vUv - 0.5) * (1.0 - uHover * 0.06) + 0.5;
    vec3 c = texture2D(uTex, uv).rgb;
    float grey = dot(c, vec3(0.299, 0.587, 0.114));
    float near = smoothstep(42.0, 10.0, vDepth);
    c = mix(vec3(grey) * vec3(0.9, 0.95, 0.88), c, max(near, uHover));
    float fog = smoothstep(70.0, 20.0, vDepth);
    c = mix(vec3(0.06, 0.1, 0.08), c, fog * uReady);
    gl_FragColor = vec4(c, 1.0);
  }
`;

const GAP = 4.6;          // between photos
const CHAPTER_GAP = 9;    // either side of a chapter card
const AHEAD = 80, BEHIND = 16; // texture streaming window
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Kampala' });
const $ = (id) => document.getElementById(id);

let api = null;
// doors elsewhere on the page call this; it's a no-op if WebGL isn't available
export function openAlbum(opts) { api?.open(opts); }

// big screens with a mouse get the fly-through; phones, tablets and small laptops keep the wall
export const albumIs3D = () => window.matchMedia('(min-width: 1200px) and (hover: hover) and (pointer: fine)').matches;

// put the fly-through where the wall was, and turn the wall into its "Grid view" panel
export function mountAlbum3D() {
  const wall = document.getElementById('gallery');
  const tpl = document.getElementById('albumTunnel');
  wall.id = 'albumGrid';
  wall.className = 'album-grid is-light';
  wall.hidden = true;
  wall.setAttribute('role', 'dialog');
  wall.setAttribute('aria-modal', 'true');
  wall.setAttribute('aria-label', 'Every photo in the album');
  wall.querySelector('.section-head').outerHTML = `<div class="album-grid__head">
      <div><div class="eyebrow">The album</div><h2>Every photo, <em>full size</em></h2></div>
      <button type="button" class="btn btn--small" id="albumGridClose">Back to the album</button>
    </div>`;
  tpl.replaceWith(tpl.content.cloneNode(true));
  const curtain = document.createElement('div');
  curtain.className = 'album__curtain';
  curtain.id = 'albumCurtain';
  curtain.setAttribute('aria-hidden', 'true');
  document.body.append(curtain, wall);
  document.documentElement.classList.add('album-3d');
}

export function initTunnel() {
  const section = $('gallery');
  const host = $('tunnelGL');
  const title = section.querySelector('.tunnel__title');
  const hud = { chips: $('albumChips'), chapter: $('albumChapter'), count: $('albumCount'), caption: $('tunnelCaption'), back: $('albumBack'), curtain: $('albumCurtain') };
  const mobile = isMobile();
  const R = mobile ? 2.6 : 4.4;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f1a14');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  const loader = new THREE.TextureLoader();

  // ---- the photos, chapter by chapter
  const byTime = (a, b) => (photoMeta(a.key)?.t || 0) - (photoMeta(b.key)?.t || 0);
  const chapters = albumChapters.map((c, ci) => ({ ...c, n: ci + 1, photos: catalogue.filter((p) => p.trip === c.trip).sort(byTime) }));

  function photoItem(p, chapter) {
    const meta = photoMeta(p.key) || { w: 3, h: 2 };
    const aspect = meta.w / meta.h;
    const h = aspect > 1 ? 2.4 : 3.2, w = h * aspect;
    const uniforms = { uTex: { value: null }, uBend: { value: 0 }, uHover: { value: 0 }, uReady: { value: 0 } };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 16, 1), new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag }));
    const it = { kind: 'photo', key: p.key, chapter, mesh, uniforms, w, h, rot: [0, 0], state: 0 };
    mesh.userData.item = it;
    // textures stream in ahead of the camera and are freed once far behind
    it.load = () => {
      if (it.state) return;
      it.state = 1;
      loader.load(photo(p.key, 900), (t) => {
        if (it.state !== 1) return t.dispose();
        it.state = 2;
        t.colorSpace = THREE.SRGBColorSpace;
        uniforms.uTex.value = t;
        gsap.to(uniforms.uReady, { value: 1, duration: 0.25, ease: 'power1.out' });
      });
    };
    it.unload = () => {
      if (!it.state) return;
      it.state = 0;
      gsap.killTweensOf(uniforms.uReady);
      uniforms.uReady.value = 0;
      uniforms.uTex.value?.dispose();
      uniforms.uTex.value = null;
    };
    scene.add(mesh);
    return it;
  }

  // a chapter's title card floats in the tunnel like a page between sections of an album
  function chapterCard(c) {
    const cv = document.createElement('canvas');
    cv.width = 1600; cv.height = 800;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const draw = () => {
      const g = cv.getContext('2d');
      const display = getComputedStyle(title.querySelector('h2')).fontFamily;
      const mono = getComputedStyle(title.querySelector('.eyebrow')).fontFamily;
      g.clearRect(0, 0, 1600, 800);
      g.textAlign = 'center';
      g.letterSpacing = '6px';
      g.fillStyle = '#a9c47f';
      g.font = `500 40px ${mono}`;
      g.fillText(`CHAPTER ${String(c.n).padStart(2, '0')}: ${c.when.toUpperCase()}`, 800, 270);
      g.letterSpacing = '0px';
      g.fillStyle = '#f2eee6';
      let size = 150;
      do { g.font = `300 ${size}px ${display}`; size -= 6; } while (g.measureText(c.title).width > 1480 && size > 60);
      g.fillText(c.title, 800, 450);
      g.letterSpacing = '6px';
      g.fillStyle = 'rgba(242, 238, 230, 0.6)';
      g.font = `400 34px ${mono}`;
      g.fillText(`${c.photos.length} PHOTOS`, 800, 560);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts.ready.then(draw);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(mesh);
    return { kind: 'card', chapter: c, mesh };
  }

  chapters.forEach((c) => {
    c.card = chapterCard(c);
    c.items = c.photos.map((p) => photoItem(p, c));
  });
  const allPhotos = chapters.flatMap((c) => c.items);

  // ---- layout for the current trip filter: chapter card, then its photos round the spiral
  let trip = 'all', list = [], shown = [], depth = 0;
  function layout() {
    list = [];
    let zz = -16, k = 0;
    for (const c of chapters) {
      const on = trip === 'all' || c.trip === trip;
      c.card.mesh.visible = on;
      c.items.forEach((it) => { it.mesh.visible = on; if (!on) it.unload(); });
      if (!on) continue;
      if (list.length) zz -= CHAPTER_GAP;
      c.card.mesh.position.set(0, 0, zz);
      list.push(c.card);
      zz -= CHAPTER_GAP;
      for (const it of c.items) {
        const a = k++ * 2.35;
        it.mesh.position.set(Math.cos(a) * R, Math.sin(a) * R * 0.7, zz);
        it.rot = [it.mesh.position.y * 0.04, -it.mesh.position.x * 0.06];
        it.mesh.rotation.set(it.rot[0], it.rot[1], 0);
        list.push(it);
        zz -= GAP;
      }
    }
    depth = -zz;
    shown = list.filter((i) => i.kind === 'photo');
  }
  layout();
  const travel = () => Math.max(1, depth - 14); // camera stops with the last photo just ahead

  // pollen / dust motes along the whole flight
  const M = mobile ? 400 : 1200;
  const mp = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) mp.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, -Math.random() * (depth + 20)], i * 3);
  const motes = new THREE.BufferGeometry();
  motes.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  scene.add(new THREE.Points(motes, new THREE.PointsMaterial({ color: '#a9c47f', size: 0.04, transparent: true, opacity: 0.7 })));

  // ---- scroll drives the flight; the pin is longer for the whole album than for one trip
  let target = 0, z = 0, vel = 0, lastMove = 0, settleUntil = 0;
  let focus = 0, focusItem = null, forced = null; // the photo brought forward, and a door's or click's request for one
  let hovered = null, flyIn = false;
  // declared before the trigger: a page reloaded below the album fires onLeave while it's being created
  let returnTo = null;
  const screens = () => Math.min(mobile ? 5.5 : 6.5, Math.max(2.5, shown.length / 18));
  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${window.innerHeight * screens()}`,
    pin: '#tunnelStage',
    scrub: true,
    onUpdate: (s) => {
      target = s.progress * travel();
      lastMove = performance.now();
      // your own scrolling takes back over from a door's focus (but not the echo of our own jump)
      if (performance.now() > settleUntil && !flyIn) forced = null;
      title.style.opacity = String(Math.max(0, 1 - s.progress * 14));
    },
    onLeave: () => hideBack(),
    onLeaveBack: () => hideBack(),
  });
  const scrollFor = (zT) => st.start + (Math.min(Math.max(zT, 0), travel()) / travel()) * (st.end - st.start);

  // ---- trip chips and grid view
  const countOf = (t) => (t === 'all' ? catalogue.length : catalogue.filter((p) => p.trip === t).length);
  const chipTrips = ['all', ...albumChapters.map((c) => c.trip)];
  const chipLabel = (t) => (t === 'all' ? 'Whole album' : photoTrips.find((p) => p.id === t)?.label || t);
  hud.chips.innerHTML = chipTrips.map((t) => `<button type="button" class="album__chip${t === trip ? ' is-on' : ''}" data-trip="${t}" aria-pressed="${t === trip}">${chipLabel(t)}<span>${countOf(t)}</span></button>`).join('')
    + `<button type="button" class="album__chip album__chip--grid" data-grid>Grid view ${icon('grid')}</button>`;
  hud.chips.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('grid' in b.dataset) { openGrid(trip); return; }
    if (b.dataset.trip !== trip) curtain(() => { setTrip(b.dataset.trip); jumpTo(0, 0); });
  });
  function setTrip(t) {
    trip = t;
    hud.chips.querySelectorAll('[data-trip]').forEach((b) => { const on = b.dataset.trip === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    layout();
    focusItem = null; focus = 0; forced = null;
    ScrollTrigger.refresh();
  }
  function jumpTo(zT, glide = 12) {
    settleUntil = performance.now() + 400;
    window.scrollTo({ top: scrollFor(zT), behavior: 'instant' });
    ScrollTrigger.update();
    target = Math.min(Math.max(zT, 0), travel());
    z = Math.max(0, target - glide); // fly the last few metres in
  }
  function curtain(fn) {
    gsap.timeline()
      .to(hud.curtain, { opacity: 1, duration: 0.25, ease: 'power1.out', onStart: () => { hud.curtain.style.pointerEvents = 'auto'; } })
      .add(fn)
      .to(hud.curtain, { opacity: 0, duration: 0.25, ease: 'power1.out', onComplete: () => { hud.curtain.style.pointerEvents = ''; } });
  }

  // ---- doors: open the album at a photo (in its trip's chapter) or at a trip, with a way back
  // Back returns to the door you came through, wherever it now sits (the album's length changes with the trip shown)
  function hideBack() { returnTo = null; hud.back.hidden = true; }
  hud.back.addEventListener('click', () => {
    const el = returnTo;
    hideBack();
    if (el) curtain(() => { window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.25, behavior: 'instant' }); });
  });
  const BACK_LABEL = { trips: 'trips', experiences: 'experiences', itinerary: 'the itinerary', journey: 'the map' };
  api = {
    open({ key, trip: t, from }) {
      const item = key && allPhotos.find((i) => i.key === key);
      const want = t || (item ? tripOf(key) : 'all');
      const label = BACK_LABEL[from?.closest('section')?.id];
      curtain(() => {
        if (want !== trip) setTrip(want);
        if (item) {
          item.load();
          jumpTo(-item.mesh.position.z - 9);
          forced = { item, until: Infinity }; // held until you scroll on
        } else {
          const card = chapters.find((c) => c.trip === want)?.card;
          jumpTo(card ? -card.mesh.position.z - 14 : 0);
        }
        returnTo = from || null;
        hud.back.hidden = !from;
        hud.back.lastElementChild.textContent = label ? `Back to ${label}` : 'Back';
      });
    },
  };
  // dev only: lets automated checks see where the flight is and what's in focus
  if (import.meta.env.DEV) window.__album = { st, scrollFor, get z() { return z; }, get trip() { return trip; }, get focusKey() { return focusItem?.key; }, get forcedKey() { return forced?.item.key; }, get focus() { return focus; },
    zOf: (key) => { const i = allPhotos.find((p) => p.key === key); return i && -i.mesh.position.z; } };
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-album-key], [data-album-trip]');
    if (!d || d.closest('#gallery')) return;
    if (d.dataset.albumKey && !allPhotos.some((i) => i.key === d.dataset.albumKey)) return; // not one of ours
    e.preventDefault();
    api.open({ key: d.dataset.albumKey, trip: d.dataset.albumTrip, from: d });
  });

  // ---- pointer: hover lifts a photo to full colour, click flies it into full view
  const mouse = new THREE.Vector2(), ndc = new THREE.Vector2(-9, -9);
  const ray = new THREE.Raycaster();
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouse.set(ndc.x, ndc.y);
  });
  host.addEventListener('pointerleave', () => { ndc.set(-9, -9); setCursor(null); });
  host.addEventListener('click', () => {
    const it = hovered || (focus > 0.6 ? focusItem : null);
    if (!it) return;
    forced = { item: it, until: performance.now() + 1400 };
    flyIn = true;
    setTimeout(() => { openLightbox(shown.map((i) => i.key), shown.indexOf(it)); flyIn = false; }, 560);
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);

  // nothing downloads until the album is ~2 screens away
  let armed = false, visible = false;
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); armed = true; } }, { rootMargin: '200% 0px' }).observe(host);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(host);

  // ---- focus: when you stop, the nearest photo ahead comes forward and straightens up
  const vFov = () => (camera.fov * Math.PI) / 180;
  const fitDist = (it, fill) => Math.max(it.h / (fill * 2 * Math.tan(vFov() / 2)), it.w / (fill * 2 * Math.tan(vFov() / 2) * camera.aspect));
  const ahead = (it) => -z - it.mesh.position.z; // > 0: in front of the camera
  function nearestAhead() {
    let best = null, bd = 26;
    for (const it of shown) { const d = ahead(it); if (d > 3 && d < bd) { bd = d; best = it; } }
    return best;
  }
  const base = new THREE.Vector3(), baseLook = new THREE.Vector3(), fPos = new THREE.Vector3(), fLook = new THREE.Vector3(), look = new THREE.Vector3();
  const ease = (t) => t * t * (3 - 2 * t);

  // ---- HUD: chapter, count, and the focused photo's caption
  let hudKey = '';
  function updateHUD() {
    const near = nearestAhead();
    const idx = near ? shown.indexOf(near) + 1 : shown.length;
    const showing = focus > 0.6 && focusItem ? focusItem : null;
    // the chapter of what you're looking at: the photo in focus, else the next thing ahead
    const ch = (showing || list.find((i) => ahead(i) > 3) || list[list.length - 1])?.chapter;
    const key = `${ch?.trip}|${idx}|${showing?.key || ''}`;
    if (key === hudKey) return;
    hudKey = key;
    if (ch) hud.chapter.innerHTML = `<span class="eyebrow">Chapter ${String(ch.n).padStart(2, '0')}: ${ch.when}</span><b>${ch.title}</b>`;
    hud.count.textContent = `${String(idx).padStart(2, '0')} / ${String(shown.length).padStart(2, '0')}`;
    const m = showing && photoMeta(showing.key);
    hud.caption.innerHTML = m ? `${m.alt}${m.t ? `<small>${dateFmt.format(m.t)}</small>` : ''}` : '';
    hud.caption.classList.toggle('is-on', !!m);
  }

  let frame = 0;
  gsap.ticker.add(() => {
    if (armed && frame++ % 10 === 0) {
      for (const it of shown) { const d = ahead(it); if (d < AHEAD && d > -BEHIND) it.load(); else if (d > AHEAD + 40 || d < -BEHIND - 24) it.unload(); }
    }
    // (dev: window.__forceVisible lets automated checks render while the preview pane is hidden)
    if (!visible && !(import.meta.env.DEV && window.__forceVisible)) return;
    const now = performance.now();
    const prev = z;
    z += (target - z) * 0.08;
    vel += ((z - prev) - vel) * 0.2;

    const titleOn = title.style.opacity === '' ? 1 : Number(title.style.opacity);
    const idle = st.isActive && titleOn < 0.05 && now - lastMove > 650 && Math.abs(target - z) < 0.4 && !hovered;
    if (forced && now > forced.until) forced = null;
    const want = forced ? forced.item : idle ? nearestAhead() : null;
    if (want !== focusItem && focus < 0.04) focusItem = want;
    focus += ((want && want === focusItem ? 1 : 0) - focus) * (forced ? 0.09 : 0.05);
    if (focus < 0.001 && !want) focusItem = null;

    base.set(mouse.x * 0.8, mouse.y * 0.5, -z);
    baseLook.set(mouse.x * 0.3, mouse.y * 0.2, -z - 10);
    const f = focusItem ? ease(focus) : 0;
    if (f > 0) {
      const p = focusItem.mesh.position;
      fPos.set(p.x, p.y, p.z + fitDist(focusItem, flyIn ? 0.96 : 0.78));
      fLook.copy(p);
      camera.position.lerpVectors(base, fPos, f);
      look.lerpVectors(baseLook, fLook, f);
    } else {
      camera.position.copy(base);
      look.copy(baseLook);
    }
    camera.lookAt(look);
    camera.rotation.z += Math.sin(z * 0.03) * 0.08 * (1 - f);

    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(shown.map((i) => i.mesh))[0];
    const h = hit ? hit.object.userData.item : null;
    if (h !== hovered) {
      hovered = h;
      host.style.cursor = h ? 'zoom-in' : '';
      setCursor(h ? 'View' : null);
    }
    const bend = Math.min(1.2, Math.max(-1.2, vel * 2.5)) * (1 - f);
    for (const it of shown) {
      const u = it.uniforms, on = it === hovered || (it === focusItem && f > 0.3);
      u.uBend.value += (bend - u.uBend.value) * 0.15;
      u.uHover.value += ((on ? 1 : 0) - u.uHover.value) * 0.1;
      const s = it === focusItem ? 1 - f : 1; // the focused photo turns square to the camera
      it.mesh.rotation.set(it.rot[0] * s, it.rot[1] * s, 0);
    }
    for (const c of chapters) {
      if (!c.card.mesh.visible) continue;
      const d = ahead(c.card);
      const fade = THREE.MathUtils.smoothstep(d, 0.5, 6) * (1 - THREE.MathUtils.smoothstep(d, 26, 60));
      c.card.mesh.material.opacity = fade * (1 - titleOn) * (1 - f);
    }
    updateHUD();
    renderer.render(scene, camera);
  });
}
