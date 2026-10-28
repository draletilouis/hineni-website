import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  brand, heroReel, experiences, experienceCats, fieldNotes, itineraries, stories, faqs, ledger, about, places, regions, customTrip, navMenus,
  manifestoPhotos, quote, film,
} from '../data/content.js';
import { catalogue, photoTrips, photoTypes, albumChapters, checkRepeats } from '../data/photos.js';
import { photo, photoMeta, imgTag, srcset, makeVideo, poster, videoSrc, safePlay, reducedMotion } from '../lib/media.js';
import { icon } from '../lib/icons.js';

const $ = (s, r = document) => r.querySelector(s);
// modals stop the page behind them from scrolling
const lockScroll = (on) => document.documentElement.classList.toggle('is-locked', on);
const showSamples = import.meta.env.DEV;
// experiences shown before "Show all": a full 3-column block with the wide lead card
const EXP_SHOWN = 8;
// photos on the "Every photo" wall before "Show all"
const GAL_SHOWN = 32;

// ---------------------------------------------------------------- render
export function renderSections() {
  // hero trust card: real faces above the fold
  $('#heroFaces').innerHTML = heroReel.faces.map((k) => `<img src="${photo(k, 900)}" alt="" />`).join('');
  $('#heroTrustImg').src = photo(heroReel.trustPhoto, 900);

  $('#heroOffer').textContent = brand.offer;

  // the album's intro counts whatever the album holds now (admins add trips and photos)
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const trips = albumChapters.filter((c) => catalogue.some((p) => p.trip === c.trip));
  $('#albumIntro').textContent = `The album: ${words[trips.length] || trips.length} trip${trips.length === 1 ? '' : 's'}, ${catalogue.length} photos`;
  const [first, last] = [trips[0]?.when, trips.at(-1)?.when];
  if (first && last) {
    const [m1, y1] = [first.replace(/\s*\d{4}$/, ''), first.match(/\d{4}$/)?.[0]];
    $('#albumWhen').textContent = `Shot on phones, ${first === last ? first : y1 && last.endsWith(y1) ? `${m1} to ${last}` : `${first} to ${last}`}`;
  }

  // the photos set into the words of "The idea", and the big quote's background (both chosen in the portal)
  document.querySelectorAll('[data-manifesto]').forEach((img) => { img.src = photo(manifestoPhotos[+img.dataset.manifesto], 900); });
  const q = $('#quoteImg');
  q.src = photo(quote.photo, 1600);
  q.srcset = srcset(quote.photo);

  // the form's trips, named as the portal has them
  $('#f-trip').innerHTML = itineraries.map((it) => `<option value="${it.id}">${it.name} ${it.em}</option>`).join('')
    + '<option value="both">Two trips as one week</option><option value="custom">Something custom</option>';

  // trips at a glance
  const priceLine = (it) => it.price
    ? `<strong>${it.price}</strong><span>per person, all-in</span>`
    : '<strong>Quote within 24 hours</strong><span>One price for the whole trip, no obligation</span>';
  $('#tripsGrid').innerHTML = itineraries.map((it, i) => `
    <article class="trip-card" data-reveal>
      <div class="trip-card__media">
        ${imgTag(it.cover, { sizes: '(max-width: 820px) 100vw, (max-width: 1024px) 50vw, 33vw' })}
        <span class="trip-card__days">${it.days}</span>
      </div>
      <div class="trip-card__body">
        <div class="eyebrow">${it.route}</div>
        <h3>${it.name} <em>${it.em}</em></h3>
        <p>${it.blurb}</p>
        <ul class="trip-card__hl">${it.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
        <div class="trip-card__price">${priceLine(it)}<small>${it.season}</small></div>
        <div class="trip-card__actions">
          <a href="#enquire" class="btn btn--solid" data-book="${it.id}" data-cursor="hover">Book this trip</a>
          <a href="#itinerary" class="btn" data-days="${i}" data-cursor="hover">Day by day</a>
        </div>
      </div>
    </article>`).join('') + `
    <article class="trip-card trip-card--custom" data-reveal>
      <div class="trip-card__media">
        ${imgTag(customTrip.photo, { sizes: '(max-width: 820px) 100vw, (max-width: 1024px) 50vw, 33vw', alt: 'Our group at the Top of Murchison Falls' })}
        <span class="trip-card__days">4 to 10 days</span>
      </div>
      <div class="trip-card__body">
        <div class="eyebrow">Your dates, your group, your pace</div>
        <h3>Make it <em>yours</em></h3>
        <p>Combine two trips into a week, add chimp tracking in Kibale, or start from Entebbe airport. Tell us what you want to see and we'll build the route.</p>
        <ul class="trip-card__hl"><li>Chimps in Kibale</li><li>Two parks in 6–7 days</li><li>Airport pick-up</li><li>Families & groups</li></ul>
        <div class="trip-card__actions">
          <a href="#enquire" class="btn btn--solid" data-book="custom" data-cursor="hover">Plan a custom trip</a>
        </div>
      </div>
    </article>`;

  // experiences: filter tabs + grid; "+" adds an experience to the visitor's trip (and the enquiry form)
  $('#expFilters').innerHTML = experienceCats.map((c, i) => `
    <button class="exp-filter${i === 0 ? ' is-active' : ''}" data-cat="${c.id}" role="tab" aria-selected="${i === 0}" data-cursor="hover">
      ${c.label}<span>${c.id === 'all' ? experiences.length : experiences.filter((e) => e.cat === c.id).length}</span>
    </button>`).join('');
  const catLabel = Object.fromEntries(experienceCats.map((c) => [c.id, c.label]));
  $('#expMore').innerHTML = `Show all ${experiences.length} experiences`;
  $('#expGrid').innerHTML = experiences.map((e, i) => `
    <article class="exp-card${i === 0 ? ' exp-card--wide' : ''}${i >= EXP_SHOWN ? ' is-extra' : ''}" data-cat="${e.cat}" data-video="${e.video || ''}">
      <div class="exp-card__media" data-album-key="${e.photo}" data-cursor="hover">
        ${imgTag(e.photo, { sizes: i === 0 ? '(max-width: 1024px) 100vw, 60vw' : '(max-width: 560px) 100vw, (max-width: 1024px) 50vw, 33vw' })}
        <div class="exp-card__top">
          <span class="exp-card__trip">${e.trip}</span>
          ${e.video ? `<button type="button" class="exp-card__play" data-clip="${e.video}" data-clip-cap="${e.title}" aria-label="Play the clip: ${e.title}" data-cursor="hover"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg></button>` : ''}
        </div>
      </div>
      <div class="exp-card__body">
        <div class="exp-card__feel">${e.feel}</div>
        <h3>${e.title}</h3>
        <p>${e.text}</p>
        <div class="exp-card__foot">
          <span class="exp-card__cat">${catLabel[e.cat]}</span>
          <button class="exp-add" data-exp="${e.id}" aria-pressed="false" aria-label="Add ${e.title} to my trip"><i></i><span>Add to my trip</span></button>
        </div>
      </div>
    </article>`).join('');

  // gallery: the whole photo catalogue in a masonry wall, filterable by trip and by what's in it
  const filterBtn = (attr, id, label, on) => `
    <button class="exp-filter${on ? ' is-active' : ''}" data-${attr}="${id}" aria-pressed="${!!on}">${label}<span></span></button>`;
  $('#galFilters').innerHTML = `
    <div class="gal-filters__row" role="group" aria-label="Show photos from">${filterBtn('trip', 'all', 'All trips', true)}${photoTrips.map((t) => filterBtn('trip', t.id, t.label)).join('')}</div>
    <label class="gal-type"><span class="sr-only">Show</span><select id="galType"><option value="">Everything</option>${photoTypes.map((t) => `<option value="${t.id}">${t.label}</option>`).join('')}</select></label>`;
  $('#galGrid').innerHTML = catalogue.map((p, i) => `
    <button class="gal-item${i >= GAL_SHOWN ? ' is-extra' : ''}" data-trip="${p.trip}" data-type="${p.type}" data-key="${p.key}" aria-label="Open photo: ${photoMeta(p.key)?.alt || ''}">
      ${imgTag(p.key, { sizes: '(max-width: 560px) 50vw, (max-width: 1024px) 33vw, 25vw' })}
      <span class="gal-item__cap">${photoMeta(p.key)?.alt || ''}${placeOfPhoto.has(p.key) ? `<span class="gal-item__pin">On the route map: ${placeOfPhoto.get(p.key).name}</span>` : ''}</span>
    </button>`).join('');
  $('#galMore').textContent = `Show all ${catalogue.length} photos`;

  // dev only: flag any photo doing two jobs in the selling sections
  if (import.meta.env.DEV) checkRepeats([
    ...[...new Set([...heroReel.slides.wide, ...heroReel.slides.tall].map((s) => s.photo))].map((k) => [k, 'hero']),
    ...heroReel.faces.map((k) => [k, 'hero faces']), [heroReel.trustPhoto, 'trust card'], [customTrip.photo, 'custom trip card'],
    ...itineraries.flatMap((it) => [[it.cover, `${it.id} cover`], ...it.days_.map((d) => [d.photo, `${it.id} day ${d.n}`])]),
    ...experiences.map((e) => [e.photo, `experience ${e.id}`]),
    [about.photo, 'about'],
  ]);

  // field notes
  $('#notesGrid').innerHTML = fieldNotes.map((n, i) => `
    <article class="note note--text" data-reveal>
      <span class="tag">${n.tag}</span>
      <div class="note__num eyebrow">Field note ${String(i + 1).padStart(2, '0')}</div>
      <h3>${n.title}</h3>
      <p>${n.text}</p>
    </article>`).join('');

  // itineraries (tabs)
  $('#itinTabs').innerHTML = itineraries.map((it, i) => `
    <button class="itin-tab${i === 0 ? ' is-active' : ''}" data-i="${i}" role="tab" aria-selected="${i === 0}" data-cursor="hover">
      <span class="eyebrow">${it.days}. ${it.when}</span>
      <strong>${it.name} <em>${it.em}</em></strong>
    </button>`).join('');
  renderItinerary(0);
  $('#itinTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.itin-tab');
    if (b) selectItinerary(+b.dataset.i);
  });

  // ledger
  $('#ledger').innerHTML = ledger.map((l) => `
    <div class="ledger__cell">
      <div class="stat__num" data-count="${l.num}">0</div><span class="eyebrow">${l.suffix}</span>
      <h4>${l.title}</h4><p>${l.text}</p>
    </div>`).join('');

  // about
  $('#aboutTitle').innerHTML = `${about.title} <em>${about.em}</em>`;
  $('#aboutText').innerHTML = about.text.map((p) => `<p>${p}</p>`).join('');
  $('#aboutPhotos').innerHTML = `<figure class="about__ph about__ph--solo">${imgTag(about.photo, { sizes: '(max-width: 820px) 100vw, 45vw' })}</figure>`;

  // stories
  const shown = stories.filter((s) => showSamples || !s.sample);
  if (!shown.length) $('#stories').remove();
  else {
    $('#storiesGrid').innerHTML = shown.map((s) => `
      <article class="story" data-reveal>
        ${s.sample ? '<span class="story__sample">Sample — replace with a real guest\'s words</span>' : ''}
        ${imgTag(s.photo, { cls: 'story__img', sizes: '(max-width: 560px) 100vw, 33vw', alt: '' })}
        <div class="story__body">
          <div class="eyebrow">Before</div>
          <p class="story__fear">“${s.fear}”</p>
          <div class="eyebrow"><b>The moment</b></div>
          <p class="story__moment">${s.moment}</p>
          <div class="story__who"><strong>${s.name}</strong><span class="eyebrow">${s.trip}</span></div>
        </div>
      </article>`).join('');
  }

  // FAQs
  $('#faqList').innerHTML = faqs.filter((f) => !f.hidden).map((f, i) => `
    <details class="faq"${i === 0 ? ' open' : ''}>
      <summary data-cursor="hover"><span>${f.q}</span><i></i></summary>
      <p>${f.a}</p>
    </details>`).join('');

  // contacts + chips
  const wa = `https://wa.me/${brand.whatsapp}`;
  $('#contacts').innerHTML = `
    <a href="${wa}" target="_blank" rel="noopener" data-cursor="hover"><span class="eyebrow">WhatsApp</span>${brand.phone}</a>
    <a href="mailto:${brand.email}" data-cursor="hover"><span class="eyebrow">Email</span>${brand.email}</a>
    <a href="#journey" data-cursor="hover"><span class="eyebrow">Based in</span>${brand.base}</a>`;
  $('#footContacts').innerHTML = `<li><a href="${wa}" target="_blank" rel="noopener">WhatsApp</a></li><li><a href="mailto:${brand.email}">${brand.email}</a></li><li>${brand.base}</li>`;
  document.querySelectorAll('[data-wa]').forEach((a) => { a.href = wa; });
  // experiences are picked on their cards (the form lists them); these are the extras that have no card
  $('#chips').innerHTML = ['Lion & leopard', 'Elephants', 'Photography']
    .map((c) => `<label class="chip"><input type="checkbox" name="interests" value="${c}" /><span>${c}</span></label>`).join('');
  renderPicks();
  $('#year').textContent = new Date().getFullYear();
}

let currentItin = 0;
function selectItinerary(i, { animate = true } = {}) {
  if (i === currentItin) return;
  currentItin = i;
  document.querySelectorAll('.itin-tab').forEach((t) => { const on = +t.dataset.i === i; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); });
  const swap = () => { renderItinerary(i); ScrollTrigger.sort(); ScrollTrigger.refresh(); };
  if (!animate) { swap(); return; }
  gsap.to('#itinGrid, #itinFacts', { opacity: 0, duration: 0.25, ease: 'power1.out', onComplete: () => {
    swap();
    gsap.to('#itinGrid, #itinFacts', { opacity: 1, duration: 0.25, ease: 'power1.out' });
  } });
}

function renderItinerary(idx) {
  const it = itineraries[idx];
  $('#itinBlurb').textContent = it.blurb;
  $('#itinFacts').innerHTML = `
    <div class="itin-facts__price">${it.price ? `<strong>${it.price}</strong> per person` : '<strong>Quote within 24 hours</strong> One price for the whole trip'}<span class="eyebrow">${it.days}. ${it.season}</span></div>
    <div><h4 class="eyebrow">Included</h4><ul>${it.includes.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    <div><h4 class="eyebrow">Not included</h4><ul class="is-muted">${it.excludes.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    <a href="#enquire" class="btn btn--solid" data-book="${it.id}" data-cursor="hover">Book this trip</a>`;
  $('#itinMedia').innerHTML = it.days_.map((d, i) => `
    <figure class="${i === 0 ? 'is-active' : ''}" data-album-key="${d.photo}" data-cursor="hover">
      ${imgTag(d.photo, { sizes: '(max-width: 820px) 100vw, 50vw' })}
      <figcaption class="eyebrow">${d.place}</figcaption>
    </figure>`).join('') + '<div class="itin__daynum" id="itinNum">01</div>';
  $('#itinDays').innerHTML = it.days_.map((d) => `
    <article class="day" data-day="${d.n}">
      <div class="day__head"><span class="eyebrow">Day ${d.n}</span><span class="eyebrow">${d.place}</span></div>
      <h3>${d.title} <em>${d.em}</em></h3>
      <div class="day__mobile-img" data-album-key="${d.photo}">${imgTag(d.photo, { sizes: '100vw', alt: '' })}</div>
      <p>${d.text}</p>
      <ul>${d.plan.map(([t, a]) => `<li><span>${t}</span>${a}</li>`).join('')}</ul>
    </article>`).join('');
  bindItinerary();
}

let itinTriggers = [];
function bindItinerary() {
  itinTriggers.forEach((t) => t.kill());
  itinTriggers = [];
  const figs = [...document.querySelectorAll('#itinMedia figure')];
  const num = $('#itinNum');
  document.querySelectorAll('#itinDays .day').forEach((day, i) => {
    itinTriggers.push(ScrollTrigger.create({
      trigger: day, start: 'top 60%', end: 'bottom 60%',
      onToggle: (st) => {
        if (!st.isActive) return;
        num.textContent = day.dataset.day;
        figs.forEach((f, j) => {
          if (j === i) {
            f.classList.add('is-active');
            gsap.fromTo(f, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
            f.style.zIndex = 2;
          } else {
            f.style.zIndex = 1;
            f.classList.remove('is-active');
          }
        });
      },
    }));
  });
}

// photos of a place on the route map (from `places`), so the gallery can open the map there.
// Places in a region the map doesn't tour on its own (the road from Kampala) are left out.
const placeOfPhoto = new Map();
places.forEach((p) => { if (!regions.find((r) => r.id === p.region)?.hidden) p.photos?.forEach((k) => placeOfPhoto.set(k, p)); });

// ---------------------------------------------------------------- lightbox
let lbKeys = [], lbIdx = 0;
export function openLightbox(keys, i) {
  lbKeys = keys; lbIdx = i;
  showLb();
  $('#lightbox').classList.add('is-open');
  lockScroll(true);
}
function showLb() {
  const k = lbKeys[lbIdx];
  const img = $('#lbImg');
  gsap.fromTo(img, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
  img.sizes = '92vw';
  img.srcset = srcset(k);
  img.src = photo(k, 2800);
  img.alt = photoMeta(k)?.alt || '';
  $('#lbCap').textContent = `${String(lbIdx + 1).padStart(2, '0')} / ${lbKeys.length} — ${photoMeta(k)?.alt || ''}`;
  const place = placeOfPhoto.get(k), map = $('#lbMap');
  map.hidden = !place;
  if (place) { map.dataset.mapPlace = place.id; $('#lbMapName').textContent = place.name; }
}
function closeLb() {
  $('#lightbox').classList.remove('is-open');
  if (!$('#albumGrid')?.classList.contains('is-open')) lockScroll(false);
}
function initLightbox() {
  $('#lbClose').onclick = closeLb;
  // "See it on the map": close first so the page can scroll; the map itself listens for [data-map-place]
  $('#lbMap').addEventListener('click', closeLb);
  $('#lbPrev').onclick = () => { lbIdx = (lbIdx - 1 + lbKeys.length) % lbKeys.length; showLb(); };
  $('#lbNext').onclick = () => { lbIdx = (lbIdx + 1) % lbKeys.length; showLb(); };
  $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLb(); });
  window.addEventListener('keydown', (e) => {
    if (!$('#lightbox').classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowRight') $('#lbNext').click();
    if (e.key === 'ArrowLeft') $('#lbPrev').click();
  });
}

// ---------------------------------------------------------------- film modal
// The Hineni film, and any clip a ▶ button asks for (`data-clip`, e.g. on the experience cards)
function initFilm() {
  const modal = $('#film');
  const v = $('#filmVideo');
  const cap = modal.querySelector('.film__cap');
  const filmCap = cap.textContent;
  let current = '';
  const open = (e, key = film.key, caption = filmCap) => {
    e && e.preventDefault();
    // the film always at full quality; short clips follow the screen and connection
    if (current !== key) { current = key; v.poster = poster(key); v.src = key === film.key ? videoSrc(key, false) : videoSrc(key); }
    cap.textContent = caption;
    modal.classList.add('is-open');
    lockScroll(true);
    v.muted = false;
    v.currentTime = 0;
    v.play().catch(() => { v.muted = true; v.play(); });
    document.dispatchEvent(new CustomEvent('film:open'));
  };
  const close = () => { modal.classList.remove('is-open'); v.pause(); lockScroll(false); };
  document.querySelectorAll('[data-film]').forEach((b) => b.addEventListener('click', (e) => open(e)));
  // caught on the way down, so the photo under the button doesn't also open the photo viewer
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-clip]');
    if (!b) return;
    e.stopPropagation();
    open(e, b.dataset.clip, b.dataset.clipCap || '');
  }, true);
  $('#filmClose').onclick = close;
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
}

// ---------------------------------------------------------------- reveals
function initReveals() {
  const rm = reducedMotion();
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.to(el, { opacity: 1, duration: rm ? 0 : 0.25, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  document.querySelectorAll('[data-count]').forEach((el) => { el.textContent = (+el.dataset.count).toLocaleString('en-US'); });
}

// ---------------------------------------------------------------- experiences (filter grid + "my trip")
const myTrip = new Set();
function syncMyTrip() {
  document.querySelectorAll('.exp-add').forEach((b) => {
    const on = myTrip.has(b.dataset.exp);
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on);
    b.querySelector('span').textContent = on ? 'Added to trip' : 'Add to my trip';
  });
  renderPicks();
  const n = myTrip.size;
  $('#expCount').textContent = n;
  $('#expNoun').textContent = n === 1 ? 'experience' : 'experiences';
  $('#expCta').classList.toggle('is-on', n > 0);
  const badge = $('#tripBadge');
  badge.textContent = n;
  badge.classList.toggle('is-on', n > 0);
  // the route map's Build your own ticks the places these experiences happen at
  document.dispatchEvent(new CustomEvent('mytrip', { detail: [...myTrip] }));
}

// the enquiry form's list of experiences picked on the cards
function renderPicks() {
  const el = $('#tripPicks');
  const picked = experiences.filter((e) => myTrip.has(e.id));
  el.innerHTML = picked.length
    ? `<ul>${picked.map((e) => `<li>${e.title}<button type="button" class="picks__remove" data-unpick="${e.id}" aria-label="Remove ${e.title}">${icon('close')}</button></li>`).join('')}</ul>`
    : '<p>None yet. <a href="#experiences">Choose experiences</a></p>';
}

function initExperiences() {
  const grid = $('#expGrid');

  $('#expFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.exp-filter');
    if (!b) return;
    document.querySelectorAll('.exp-filter').forEach((f) => { f.classList.toggle('is-active', f === b); f.setAttribute('aria-selected', f === b); });
    const cat = b.dataset.cat;
    grid.classList.toggle('is-filtered', cat !== 'all');
    const cards = [...grid.children];
    // fade out, re-flow, fade the matches back in
    gsap.to(cards, { opacity: 0, duration: 0.25, ease: 'power1.out', onComplete: () => {
      cards.forEach((c) => { c.hidden = cat !== 'all' && c.dataset.cat !== cat; });
      gsap.fromTo(cards.filter((c) => !c.hidden), { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
      ScrollTrigger.refresh();
    } });
  });

  $('#expMore').addEventListener('click', (e) => {
    grid.classList.add('is-open');
    e.currentTarget.hidden = true;
    gsap.fromTo(grid.querySelectorAll('.is-extra'), { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
    ScrollTrigger.refresh();
  });

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.exp-add');
    if (!b) return;
    const id = b.dataset.exp;
    myTrip.has(id) ? myTrip.delete(id) : myTrip.add(id);
    syncMyTrip();
  });
  // removing one from the form's list takes it off the card too
  $('#tripPicks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-unpick]');
    if (!b) return;
    myTrip.delete(b.dataset.unpick);
    syncMyTrip();
  });

  grid.querySelectorAll('.exp-card').forEach((card) => {
    let video;
    const media = $('.exp-card__media', card);
    card.addEventListener('pointerenter', () => {
      if (card.dataset.video && !video) {
        video = makeVideo(card.dataset.video, { preload: 'auto' });
        video.addEventListener('playing', () => video.classList.add('is-ready'));
        media.appendChild(video);
      }
      video && safePlay(video);
    });
    card.addEventListener('pointerleave', () => {
      video && video.pause();
    });
  });
}

// ---------------------------------------------------------------- pointer
// the 3D album's photos aren't DOM elements, so it asks for the pointer cursor itself
export function setCursor(label) {
  document.body.style.cursor = label ? 'pointer' : '';
}

// ---------------------------------------------------------------- gallery
// the album as one filterable wall: in the page on phones, tablets and small laptops (photos elsewhere
// open in the viewer), or the 3D album's "Grid view" panel on large desktop screens
let gridApi = null;
export function openGrid(trip = 'all') { gridApi?.open(trip); }
function initGallery() {
  const grid = $('#galGrid');
  const panel = grid.closest('.album-grid');
  const more = $('#galMore');
  const filters = $('#galFilters');
  const items = [...grid.children];
  const state = { trip: 'all', type: null };
  const matches = (it, s = state) => (s.trip === 'all' || it.dataset.trip === s.trip) && (!s.type || it.dataset.type === s.type);
  const apply = () => items.forEach((it) => { it.hidden = !matches(it); });

  const typeSel = $('#galType');
  function sync() {
    // each count shows what that button would give you with the kind of photo chosen
    filters.querySelectorAll('.exp-filter').forEach((b) => {
      const on = b.dataset.trip === state.trip;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on);
      const n = items.filter((it) => matches(it, { ...state, trip: b.dataset.trip })).length;
      $('span', b).textContent = n;
      b.disabled = !n && !on;
    });
    typeSel.value = state.type || '';
    const filtered = state.trip !== 'all' || !!state.type;
    grid.classList.toggle('is-filtered', filtered);
    more.parentElement.hidden = filtered || grid.classList.contains('is-open');
  }
  sync();

  const refilter = () => {
    sync();
    gsap.to(items, { opacity: 0, duration: 0.25, ease: 'power1.out', onComplete: () => {
      apply();
      gsap.to(items.filter((it) => !it.hidden), { opacity: 1, duration: 0.25, ease: 'power1.out' });
    } });
  };
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('.exp-filter');
    if (!b) return;
    state.trip = b.dataset.trip;
    refilter();
  });
  typeSel.addEventListener('change', () => { state.type = typeSel.value || null; refilter(); });
  more.addEventListener('click', () => {
    grid.classList.add('is-open');
    more.parentElement.hidden = true;
    gsap.fromTo(grid.querySelectorAll('.is-extra'), { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
  });
  grid.addEventListener('click', (e) => {
    const it = e.target.closest('.gal-item');
    if (!it) return;
    // the lightbox steps through the photos currently shown
    const shown = items.filter((x) => getComputedStyle(x).display !== 'none');
    openLightbox(shown.map((x) => x.dataset.key), shown.indexOf(it));
  });

  if (panel) {
    const close = () => {
      panel.classList.remove('is-open');
      setTimeout(() => { panel.hidden = true; }, 250);
      lockScroll(false);
    };
    $('#albumGridClose').addEventListener('click', close);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open') && !$('#lightbox').classList.contains('is-open')) close();
    });
    gridApi = {
      open(trip) {
        // opens on the trip the 3D album is showing
        state.trip = trip; state.type = null;
        sync(); apply();
        panel.hidden = false;
        panel.scrollTop = 0;
        requestAnimationFrame(() => panel.classList.add('is-open'));
        lockScroll(true);
      },
    };
    return; // the 3D album handles photos elsewhere on the page
  }

  // a photo elsewhere on the page opens in the viewer, stepping through the rest of its trip
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-album-key]');
    if (!d || d.closest('#gallery')) return;
    const p = catalogue.find((x) => x.key === d.dataset.albumKey);
    if (!p) return; // not one of ours
    e.preventDefault();
    const keys = catalogue.filter((x) => x.trip === p.trip).map((x) => x.key);
    openLightbox(keys, keys.indexOf(p.key));
  });
}

// ---------------------------------------------------------------- mega menu

// Trips / Experiences open inside the floating nav on hover (or focus); the photo follows the hovered link
function initMega(nav) {
  const wrap = $('#navMega');
  const triggers = [...nav.querySelectorAll('[data-mega]')];
  const desktop = window.matchMedia('(min-width: 1025px)');
  $('#navMegaInner').innerHTML = Object.entries(navMenus()).map(([id, cols]) => `
    <div class="mega" id="mega-${id}" data-menu="${id}" style="--cols: ${cols.length}" hidden>
      ${cols.map((c) => `
        <div class="mega__col">
          <h4>${c.title}</h4>
          ${c.items.map((it) => `
            <a class="mega__item" href="${it.href}" data-photo="${it.photo}"${Object.entries(it.data || {}).map(([k, v]) => ` data-${k}="${v}"`).join('')}>
              <span class="mega__icon">${icon(it.icon)}</span>
              <span><b>${it.label}</b><small>${it.sub}</small></span>
            </a>`).join('')}
        </div>`).join('')}
      <div class="mega__card"><img alt="" /></div>
    </div>`).join('');

  const preview = (item) => {
    const menu = item.closest('.mega');
    menu.querySelectorAll('.mega__item').forEach((x) => x.classList.toggle('is-active', x === item));
    const img = menu.querySelector('.mega__card img');
    const src = photo(item.dataset.photo, 900);
    img.alt = photoMeta(item.dataset.photo)?.alt || '';
    if (img.getAttribute('src') === src) return;
    img.classList.add('is-loading');
    img.onload = () => img.classList.remove('is-loading');
    img.src = src;
  };
  const warmed = new Set();
  let current = null;
  let closeTimer;
  let muted = false; // Escape hands focus back to the trigger without reopening
  const open = (id) => {
    clearTimeout(closeTimer);
    if (!desktop.matches || current === id) return;
    current = id;
    nav.querySelectorAll('.mega').forEach((m) => { m.hidden = m.dataset.menu !== id; });
    triggers.forEach((t) => t.setAttribute('aria-expanded', t.dataset.mega === id));
    const menu = $(`#mega-${id}`);
    if (!warmed.has(id)) {
      warmed.add(id);
      menu.querySelectorAll('[data-photo]').forEach((a) => { new Image().src = photo(a.dataset.photo, 900); });
      preview(menu.querySelector('.mega__item'));
    }
    wrap.inert = false;
    nav.classList.add('is-mega');
  };
  const close = () => {
    clearTimeout(closeTimer);
    if (!current) return;
    current = null;
    nav.classList.remove('is-mega');
    triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    wrap.inert = true;
  };
  const closeSoon = () => { clearTimeout(closeTimer); closeTimer = setTimeout(close, 160); };

  triggers.forEach((t) => {
    t.addEventListener('mouseenter', () => open(t.dataset.mega));
    t.addEventListener('focus', () => muted || open(t.dataset.mega));
    // the trigger is still a link: clicking it goes to its section
    t.addEventListener('click', close);
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown') return;
      e.preventDefault();
      open(t.dataset.mega);
      $(`#mega-${t.dataset.mega} .mega__item`).focus();
    });
  });
  // the other links in the bar close it; the panel itself keeps it open
  nav.querySelectorAll('.nav__links a:not([data-mega]), .nav__logo, .nav__right').forEach((el) => el.addEventListener('mouseenter', closeSoon));
  nav.addEventListener('mouseleave', closeSoon);
  nav.addEventListener('mouseenter', () => current && clearTimeout(closeTimer));
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) closeSoon(); });
  wrap.addEventListener('mouseover', (e) => { const it = e.target.closest('.mega__item'); if (it) preview(it); });
  wrap.addEventListener('focusin', (e) => { const it = e.target.closest('.mega__item'); if (it) preview(it); });
  wrap.addEventListener('click', (e) => {
    const it = e.target.closest('.mega__item');
    if (!it) return;
    close();
    it.blur();
    // an experience link lands on the experiences already filtered to its kind
    if (it.dataset.expCat) document.querySelector(`.exp-filter[data-cat="${it.dataset.expCat}"]`)?.click();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !current) return;
    const t = triggers.find((x) => x.dataset.mega === current);
    close();
    if (nav.contains(document.activeElement)) { muted = true; t.focus({ preventScroll: true }); muted = false; }
  });
  desktop.addEventListener('change', close);
}

// ---------------------------------------------------------------- nav, menu, form
function initChrome() {
  const nav = $('#nav');
  initMega(nav);
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const y = st.scroll();
      // the nav (and its Book button) stays put; it just gains a readable backdrop once you scroll
      nav.classList.toggle('is-solid', y > 60);
      lastY = y;
    },
  });
  $('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
  document.querySelectorAll('#mobileMenu a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('menu-open')));
  // "Book this trip" / "Day by day" buttons anywhere on the page
  document.addEventListener('click', (e) => {
    const book = e.target.closest('[data-book]');
    if (book) {
      $('#f-trip').value = book.dataset.book;
      setTimeout(() => $('#f-name').focus({ preventScroll: true }), 0);
    }
    const days = e.target.closest('[data-days]');
    if (days) selectItinerary(+days.dataset.days, { animate: false });
  });

  // phones: sticky WhatsApp / book bar once the hero is behind you, hidden again at the form
  const bar = $('#actionBar');
  ScrollTrigger.create({ start: () => window.innerHeight * 0.7, end: 'max', onToggle: (st) => bar.classList.toggle('is-on', st.isActive) });
  ScrollTrigger.create({ trigger: '#enquire', start: 'top 80%', end: 'bottom top', onToggle: (st) => bar.classList.toggle('is-away', st.isActive) });
  // …and out of the way on the map (its trip card has its own Book button), and under the trip tray in
  // Experiences (phone.css): one bar at the bottom at a time
  ScrollTrigger.create({ trigger: '#journey', start: 'top 60%', end: 'bottom 40%', onToggle: (st) => bar.classList.toggle('is-immersed', st.isActive) });
  ScrollTrigger.create({ trigger: '#experiences', start: 'top 80%', end: 'bottom 20%', onToggle: (st) => document.body.classList.toggle('in-experiences', st.isActive) });

  // enquiry: pick WhatsApp or email first; the email field and the send button follow that choice
  const form = $('#enquireForm');
  const tripName = (v) => $(`#f-trip option[value="${v}"]`)?.textContent || v;
  const syncVia = () => {
    const email = form.elements.via.value === 'email';
    $('#emailField').hidden = !email;
    $('#sendLabel').textContent = email ? 'Send by email' : 'Send on WhatsApp';
    $('[data-wa-icon]').style.display = email ? 'none' : '';
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'via') syncVia(); });
  syncVia();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const via = form.elements.via.value;
    const d = new FormData(form);
    const need = via === 'email' ? ['f-name', 'f-email'] : ['f-name'];
    const missing = need.map((id) => $(`#${id}`)).filter((i) => !i.value.trim());
    if (missing.length) {
      missing[0].focus();
      return;
    }
    const month = d.get('date')
      ? new Date(`${d.get('date')}-01T12:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : 'flexible';
    const lines = [
      `Trip: ${tripName(d.get('trip'))}`, `Travel month: ${month}`, `Guests: ${d.get('guests')}`,
      `I want to see: ${[...experiences.filter((x) => myTrip.has(x.id)).map((x) => x.title), ...d.getAll('interests')].join(', ') || 'everything'}`,
      d.get('message') ? `\n${d.get('message')}` : '',
      `\n— ${d.get('name')}${via === 'email' && d.get('email') ? ` (${d.get('email')})` : ''}`,
    ].filter(Boolean).join('\n');
    const wa = `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`Hi ${brand.name}! I'd like to plan a safari.\n\n${lines}`)}`;
    const mail = `mailto:${brand.email}?subject=${encodeURIComponent(`Safari enquiry — ${tripName(d.get('trip'))}`)}&body=${encodeURIComponent(lines)}`;
    $('#doneWa').href = wa;
    $('#doneMail').href = mail;
    form.classList.add('is-done');
    if (via === 'email') window.location.href = mail;
    else window.open(wa, '_blank', 'noopener');
  });
}

export function initUI() {
  initLightbox();
  initFilm();
  initChrome();
  initExperiences();
  initGallery();
  initReveals();
}
