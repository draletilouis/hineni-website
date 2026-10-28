// The admin portal (/admin): upload photos into the album, caption, re-tag and remove them, choose
// the photo for each spot on the page, and add trips. Every change goes straight to the server
// (server/index.mjs), which keeps them in storage/site.json; the website applies them at start-up.
import './admin.css';
import manifest from '../data/media.json';
import { catalogue, albumChapters, photoTypes } from '../data/photos.js';
import { photoSlots } from '../data/slots.js';
import { photo } from '../lib/media.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' });
const PAGE = 48;

// what ships with the site, before any admin changes (this page never applies them to these)
const builtInTrips = albumChapters.map((c) => ({ id: c.trip, title: c.title, when: c.when, start: c.start }));
const slots = photoSlots().map((s) => ({
  ...s,
  def: s.get(),
  defText: Object.fromEntries((s.fields || []).map((f) => [f.name, s.obj[f.name]])),
}));
const typeLabel = Object.fromEntries(photoTypes.map((t) => [t.id, t.label]));

let site = null;
let me = null;
const ui = { tab: 'album', trip: 'all', type: 'all', q: '', shown: PAGE, fresh: new Set() };

// ---------------------------------------------------------------- data
async function api(method, url, body) {
  const opts = { method, headers: { 'x-hineni-admin': '1' } };
  if (body) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let r;
  try { r = await fetch(`/api${url}`, opts); } catch { throw new Error('Can\'t reach the server. Check your connection.'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/login' && url !== '/me') { showLogin('You were signed out. Sign in again to carry on.'); throw new Error('Signed out.'); }
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status}).`);
  return j;
}
const refresh = async () => { site = await api('GET', '/admin/site'); };

function trips() {
  const list = builtInTrips.map((t) => ({ ...t, ...site.trips[t.id], edited: !!site.trips[t.id] }));
  for (const [id, t] of Object.entries(site.trips)) if (t.custom) list.push({ id, ...t });
  return list.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
}
const tripName = (id) => trips().find((t) => t.id === id)?.title || id;

// every photo with the admin's changes: uploads first (newest first), then the site's own in album order
function photos() {
  const ups = Object.values(site.photos).sort((a, b) => b.added - a.added)
    .map((p) => ({ ...p, uploaded: true }));
  const own = catalogue.map((c) => {
    const m = manifest.photos[c.key] || {};
    const e = site.edits[c.key] || {};
    return { key: c.key, alt: e.alt ?? m.alt ?? '', trip: e.trip || c.trip, type: e.type || c.type, w: m.w, h: m.h, t: m.t, altEdited: 'alt' in e };
  });
  const hidden = new Set(site.hidden);
  return [...ups, ...own].map((p) => ({ ...p, removed: hidden.has(p.key), orient: p.w > p.h ? 'wide' : p.w < p.h ? 'tall' : 'square' }));
}
const slotPhoto = (s) => site.slots[s.id]?.photo || s.def;
function usage() {
  const used = {};
  for (const s of slots) (used[slotPhoto(s)] ||= []).push(s);
  return used;
}

// ---------------------------------------------------------------- toast
let toastTimer;
function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast is-on toast--${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), kind === 'error' ? 6000 : 2400);
}
async function attempt(fn, ok) {
  try { await fn(); if (ok) toast(ok); return true; } catch (e) { if (e.message !== 'Signed out.') toast(e.message, 'error'); return false; }
}

// ---------------------------------------------------------------- sign in
function showLogin(msg = '') {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginError').textContent = msg;
  $('#picker').open && $('#picker').close();
  setTimeout(() => $('#loginForm [name=user]').focus(), 0);
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const btn = f.querySelector('button');
  btn.disabled = true;
  $('#loginError').textContent = '';
  try {
    me = await api('POST', '/login', { user: f.user.value.trim(), password: f.password.value });
    f.password.value = '';
    await start();
  } catch (err) {
    $('#loginError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});
$('#logout').addEventListener('click', async () => {
  await api('POST', '/logout').catch(() => {});
  me = null;
  showLogin();
});

async function start() {
  await refresh();
  $('#login').hidden = true;
  $('#app').hidden = false;
  $('#meName').textContent = me.user;
  // e.g. no Railway volume: uploads wouldn't survive the next deploy
  $('#serverWarning').textContent = me.warning || '';
  $('#serverWarning').hidden = !me.warning;
  renderAll();
}

// ---------------------------------------------------------------- tabs
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  ui.tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${ui.tab}`; });
  renderAll();
}));

function renderAll() {
  const list = photos();
  $('#countAlbum').textContent = list.filter((p) => !p.removed).length;
  if (ui.tab === 'album') renderAlbum(list);
  if (ui.tab === 'spots') renderSpots(list);
  if (ui.tab === 'trips') renderTrips(list);
}

const tripOptions = (sel) => trips().map((t) => `<option value="${esc(t.id)}"${t.id === sel ? ' selected' : ''}>${esc(t.title)}</option>`).join('');
const typeOptions = (sel) => photoTypes.map((t) => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${t.label}</option>`).join('');

// ---------------------------------------------------------------- album
function renderAlbum(list) {
  // upload options keep the admin's choice; new trips go to the top as the likely one
  const upTrip = $('#upTrip').value || trips().at(-1)?.id;
  $('#upTrip').innerHTML = tripOptions(upTrip);
  if (!$('#upType').options.length) $('#upType').innerHTML = typeOptions('people');
  if (!$('#albumType').options.length) $('#albumType').innerHTML = `<option value="all">Everything</option>${typeOptions()}<option value="nocaption">Without a caption</option>`;

  const live = list.filter((p) => !p.removed);
  const chip = (id, label, n) => `<button type="button" class="chip${ui.trip === id ? ' is-on' : ''}" data-trip="${esc(id)}" aria-pressed="${ui.trip === id}">${esc(label)} <span>${n}</span></button>`;
  const removed = list.length - live.length;
  $('#albumChips').innerHTML = chip('all', 'All trips', live.length)
    + trips().map((t) => chip(t.id, t.title, live.filter((p) => p.trip === t.id).length)).join('')
    + (removed ? chip('removed', 'Removed', removed) : '');

  const q = ui.q.toLowerCase();
  const shown = list.filter((p) => (ui.trip === 'removed' ? p.removed : !p.removed && (ui.trip === 'all' || p.trip === ui.trip))
    && (ui.type === 'all' || (ui.type === 'nocaption' ? !p.alt : p.type === ui.type))
    && (!q || p.alt.toLowerCase().includes(q) || p.key.includes(q)));
  $('#albumCount').textContent = shown.length === 1 ? '1 photo' : `${shown.length} photos`;
  const used = usage();
  $('#albumGrid').innerHTML = shown.slice(0, ui.shown).map((p) => card(p, used[p.key])).join('')
    || `<p class="empty">${ui.trip === 'removed' ? 'Nothing removed.' : 'No photos here yet. Drop some in above.'}</p>`;
  $('#albumMore').hidden = shown.length <= ui.shown;
  $('#albumMore').textContent = `Show more (${shown.length - ui.shown} left)`;
}

function card(p, used = []) {
  const spots = used.map((s) => s.label).join(', ');
  return `<article class="card${p.removed ? ' is-removed' : ''}${ui.fresh.has(p.key) ? ' is-new' : ''}" data-key="${esc(p.key)}">
    <div class="card__img card__img--${p.orient}">
      <img src="${photo(p.key, 900)}" alt="" loading="lazy" decoding="async" />
      <div class="card__badges">
        ${p.uploaded ? '<span class="badge">Uploaded</span>' : ''}
        ${used.length ? `<span class="badge badge--used" title="${esc(spots)}">On the page${used.length > 1 ? ` ×${used.length}` : ''}</span>` : ''}
      </div>
    </div>
    <div class="card__body">
      <label class="sr" for="alt-${esc(p.key)}">Caption</label>
      <textarea id="alt-${esc(p.key)}" class="card__alt${p.alt ? '' : ' is-empty'}" rows="2" maxlength="160" data-alt placeholder="Add a caption: what's happening, and where" ${p.removed ? 'disabled' : ''}>${esc(p.alt)}</textarea>
      ${p.removed ? '' : `<div class="card__row">
        <select data-field="trip" aria-label="Trip">${tripOptions(p.trip)}</select>
        <select data-field="type" aria-label="What it shows">${typeOptions(p.type)}</select>
      </div>`}
      <div class="card__row card__row--foot">
        <span class="card__date">${p.t ? dateFmt.format(p.t) : ''}</span>
        ${p.removed
          ? `<span class="card__acts"><button type="button" class="link" data-act="restore">Put back</button>${p.uploaded ? '<button type="button" class="link link--danger" data-act="delete">Delete for good</button>' : ''}</span>`
          : '<button type="button" class="link link--danger" data-act="remove">Remove from website</button>'}
      </div>
    </div>
  </article>`;
}

$('#albumChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-trip]');
  if (!b) return;
  ui.trip = b.dataset.trip;
  ui.shown = PAGE;
  renderAll();
});
$('#albumType').addEventListener('change', (e) => { ui.type = e.target.value; ui.shown = PAGE; renderAll(); });
let searchTimer;
$('#albumSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { ui.q = e.target.value.trim(); ui.shown = PAGE; renderAll(); }, 200);
});
$('#albumMore').addEventListener('click', () => { ui.shown += PAGE; renderAll(); });

// caption: saved when you leave the box (or press Enter)
const grid = $('#albumGrid');
grid.addEventListener('keydown', (e) => {
  if (e.target.matches('[data-alt]') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
});
grid.addEventListener('focusout', async (e) => {
  const ta = e.target.closest('[data-alt]');
  if (!ta) return;
  const key = ta.closest('[data-key]').dataset.key;
  const p = photos().find((x) => x.key === key);
  const alt = ta.value.replace(/\s+/g, ' ').trim();
  if (!p || alt === p.alt) return;
  ta.classList.toggle('is-empty', !alt);
  await attempt(async () => {
    await api('PATCH', `/admin/photos/${key}`, { alt });
    if (site.photos[key]) site.photos[key].alt = alt; else site.edits[key] = { ...site.edits[key], alt };
  }, 'Caption saved');
});
grid.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-field]');
  if (!sel) return;
  const key = sel.closest('[data-key]').dataset.key;
  const field = sel.dataset.field;
  await attempt(async () => {
    await api('PATCH', `/admin/photos/${key}`, { [field]: sel.value });
    await refresh();
    renderAll();
  }, field === 'trip' ? `Moved to ${tripName(sel.value)}` : 'Saved');
});
grid.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const key = b.closest('[data-key]').dataset.key;
  const act = b.dataset.act;
  if (act === 'remove') {
    const used = usage()[key];
    if (used) {
      toast(`This photo is chosen for ${used.map((s) => `${s.group}: ${s.label}`).join(', ')}. Pick another photo there first (Spots on the page).`, 'error');
      return;
    }
    await attempt(async () => { await api('POST', `/admin/photos/${key}/remove`); await refresh(); renderAll(); }, 'Removed from the website. Find it under "Removed" to put it back.');
  } else if (act === 'restore') {
    await attempt(async () => { await api('POST', `/admin/photos/${key}/restore`); await refresh(); renderAll(); }, 'Back on the website');
  } else if (act === 'delete') {
    if (!confirm('Delete this photo for good? This can\'t be undone.')) return;
    await attempt(async () => { await api('DELETE', `/admin/photos/${key}`); await refresh(); renderAll(); }, 'Deleted');
  }
});

// ---------------------------------------------------------------- uploads
const queue = [];
let running = 0;
const MAX_MB = 40;

function addFiles(files, { trip, type, onDone } = {}) {
  trip ||= $('#upTrip').value;
  type ||= $('#upType').value;
  for (const file of files) {
    const item = { file, trip, type, onDone, id: Math.random().toString(36).slice(2), state: 'waiting', pct: 0, error: '' };
    if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type)) item.error = 'HEIC isn\'t supported: on an iPhone, upload from the browser (it converts them) or export as JPEG.';
    else if (!/^image\/(jpeg|png|webp)$/.test(file.type)) item.error = 'Not a JPEG, PNG or WebP photo.';
    else if (file.size > MAX_MB * 1024 * 1024) item.error = `Over ${MAX_MB} MB.`;
    if (item.error) item.state = 'error';
    item.preview = item.error ? '' : URL.createObjectURL(file);
    queue.push(item);
  }
  renderQueue();
  pump();
}

function pump() {
  while (running < 2) {
    const item = queue.find((i) => i.state === 'waiting');
    if (!item) break;
    running++;
    send(item).finally(() => { running--; pump(); });
  }
  if (!running && queue.length && queue.every((i) => i.state !== 'waiting' && i.state !== 'uploading' && i.state !== 'processing')) finishBatch();
}

function send(item) {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append('trip', item.trip);
    fd.append('type', item.type);
    fd.append('lastModified', String(item.file.lastModified || ''));
    fd.append('name', item.file.name);
    fd.append('photo', item.file);
    const x = new XMLHttpRequest();
    x.open('POST', '/api/admin/photos');
    x.setRequestHeader('x-hineni-admin', '1');
    item.state = 'uploading';
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      item.pct = Math.round((e.loaded / e.total) * 100);
      if (item.pct === 100) item.state = 'processing';
      renderQueue();
    };
    x.onload = () => {
      let j = {};
      try { j = JSON.parse(x.responseText); } catch { /* not JSON */ }
      if (x.status === 401) { item.state = 'error'; item.error = 'Signed out.'; showLogin('You were signed out. Sign in again, then add the photos again.'); }
      else if (x.status >= 200 && x.status < 300 && j.photo) {
        item.state = 'done';
        site.photos[j.photo.key] = j.photo;
        ui.fresh.add(j.photo.key);
        item.onDone?.(j.photo);
      } else { item.state = 'error'; item.error = j.error || `Upload failed (${x.status}).`; }
      renderQueue();
      resolve();
    };
    x.onerror = () => { item.state = 'error'; item.error = 'Connection lost.'; renderQueue(); resolve(); };
    x.send(fd);
    renderQueue();
  });
}

function finishBatch() {
  const done = queue.filter((i) => i.state === 'done').length;
  const failed = queue.filter((i) => i.state === 'error').length;
  if (done) {
    // show the new photos where they landed, ready for captions
    const trip = queue.find((i) => i.state === 'done').trip;
    if (ui.tab === 'album' && ui.trip !== 'all' && ui.trip !== trip) ui.trip = trip;
    renderAll();
    toast(`${done} photo${done === 1 ? '' : 's'} added${failed ? `, ${failed} couldn't be` : ''}. Add a caption to each.`, failed ? 'error' : 'ok');
  }
  // done items leave the list after a moment; errors stay until dismissed
  setTimeout(() => {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].state === 'done') { URL.revokeObjectURL(queue[i].preview); queue.splice(i, 1); }
    renderQueue();
  }, 2500);
}

const stateText = (i) => ({
  waiting: 'Waiting…', uploading: `Uploading ${i.pct}%`, processing: 'Preparing for the website…', done: 'Added', error: i.error,
}[i.state]);
function renderQueue() {
  $('#queue').innerHTML = queue.map((i) => `<li class="q q--${i.state}">
    ${i.preview ? `<img src="${i.preview}" alt="" />` : '<span class="q__noimg">!</span>'}
    <div class="q__body"><span class="q__name">${esc(i.file.name)}</span><span class="q__state">${esc(stateText(i))}</span>
      <span class="q__bar"><i style="width:${i.state === 'done' || i.state === 'processing' ? 100 : i.pct}%"></i></span></div>
    ${i.state === 'error' ? `<button type="button" class="link" data-dismiss="${i.id}">Dismiss</button>` : ''}
  </li>`).join('');
}
$('#queue').addEventListener('click', (e) => {
  const id = e.target.closest('[data-dismiss]')?.dataset.dismiss;
  const i = queue.findIndex((q) => q.id === id);
  if (i >= 0) { queue.splice(i, 1); renderQueue(); }
});

const drop = $('#drop');
$('#chooseFiles').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || !drop.contains(e.relatedTarget)) drop.classList.remove('is-over'); }));
drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
// dropping a file anywhere else mustn't navigate away from the portal
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
window.addEventListener('beforeunload', (e) => { if (running) { e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------- spots on the page
const groupHints = {
  'Hero slideshow on computers': 'The first thing visitors see. Landscape photos; the place name and line show over the photo.',
  'Hero slideshow on phones': 'The same slideshow on phones. Portrait photos.',
  'Hero trust card': 'The small card with real faces at the bottom of the hero.',
  Trips: 'The trip cards and the photo for each day of the itineraries.',
  Experiences: 'One photo per experience card.',
  'Who we are': 'The group portrait next to the story.',
};
function renderSpots(list) {
  const byKey = Object.fromEntries(list.map((p) => [p.key, p]));
  const groups = [...new Set(slots.map((s) => s.group))];
  $('#spots').innerHTML = groups.map((g) => `<section class="group">
    <h3>${esc(g)}</h3>
    <p class="group__hint">${esc(groupHints[g] || '')}</p>
    <div class="slots">${slots.filter((s) => s.group === g).map((s) => spot(s, byKey)).join('')}</div>
  </section>`).join('');
}
function spot(s, byKey) {
  const key = slotPhoto(s);
  const o = site.slots[s.id] || {};
  const changed = (o.photo && o.photo !== s.def) || (s.fields || []).some((f) => o[f.name] != null && o[f.name] !== s.defText[f.name]);
  const p = byKey[key];
  const misfit = p && s.shape && p.orient !== s.shape && p.orient !== 'square';
  return `<article class="slot slot--${s.shape || 'any'}" data-slot="${esc(s.id)}">
    <button type="button" class="slot__img" data-pick aria-label="Change the photo for ${esc(s.label)}">
      <img src="${photo(key, 900)}" alt="" loading="lazy" decoding="async" /><span>Change photo</span>
    </button>
    <div class="slot__body">
      <div class="slot__label">${esc(s.label)}${changed ? ' <span class="pill">Changed</span>' : ''}</div>
      <p class="slot__alt">${esc(p?.alt || '')}</p>
      ${misfit ? `<p class="slot__warn">This is a ${p.orient === 'tall' ? 'portrait' : 'landscape'} photo; it will be cropped here.</p>` : ''}
      ${(s.fields || []).map((f) => `<label class="field field--small">${esc(f.label)}<input data-text="${f.name}" maxlength="80" value="${esc(o[f.name] ?? s.defText[f.name] ?? '')}" /></label>`).join('')}
      ${changed ? '<button type="button" class="link" data-reset>Back to the original</button>' : ''}
    </div>
  </article>`;
}
$('#spots').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-slot]');
  if (!el) return;
  const s = slots.find((x) => x.id === el.dataset.slot);
  if (e.target.closest('[data-pick]')) openPicker(s);
  if (e.target.closest('[data-reset]')) {
    await attempt(async () => { await api('DELETE', `/admin/slots/${s.id}`); await refresh(); renderAll(); }, 'Back to the original');
  }
});
$('#spots').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-text]');
  if (!input) return;
  const s = slots.find((x) => x.id === input.closest('[data-slot]').dataset.slot);
  await attempt(async () => { await api('PUT', `/admin/slots/${s.id}`, { [input.dataset.text]: input.value }); await refresh(); renderAll(); }, 'Saved');
});

// ---- picker
const picker = $('#picker');
const pick = { slot: null, trip: 'all', q: '' };
function openPicker(s) {
  pick.slot = s;
  pick.q = '';
  $('#pickerSearch').value = '';
  $('#pickerTitle').textContent = `Choose a photo for ${s.group.replace(/ on (computers|phones)$/, '')}: ${s.label}`;
  $('#pickerHint').textContent = s.shape === 'wide' ? 'Landscape photos fit this spot best.' : s.shape === 'tall' ? 'Portrait photos fit this spot best.' : 'Any photo works here.';
  renderPicker();
  picker.showModal();
  $('#pickerSearch').focus();
}
function renderPicker() {
  const s = pick.slot;
  const list = photos().filter((p) => !p.removed);
  const current = slotPhoto(s);
  const used = usage();
  const chip = (id, label) => `<button type="button" class="chip${pick.trip === id ? ' is-on' : ''}" data-trip="${esc(id)}">${esc(label)}</button>`;
  $('#pickerChips').innerHTML = chip('all', 'All trips') + trips().map((t) => chip(t.id, t.title)).join('');
  const upTrip = pick.trip === 'all' ? trips().at(-1)?.id : pick.trip;
  $('#pickerFile').parentElement.firstChild.textContent = `Upload a new one to ${tripName(upTrip)}`;
  const q = pick.q.toLowerCase();
  // photos that suit the spot's shape first
  const shown = list.filter((p) => (pick.trip === 'all' || p.trip === pick.trip) && (!q || p.alt.toLowerCase().includes(q)))
    .sort((a, b) => (s.shape ? (b.orient === s.shape) - (a.orient === s.shape) : 0));
  $('#pickerGrid').innerHTML = shown.map((p) => {
    const elsewhere = (used[p.key] || []).filter((x) => x.id !== s.id);
    return `<button type="button" class="pick${p.key === current ? ' is-current' : ''}${s.shape && p.orient !== s.shape ? ' is-misfit' : ''}" data-key="${esc(p.key)}" title="${esc(p.alt)}">
      <img src="${photo(p.key, 900)}" alt="${esc(p.alt)}" loading="lazy" decoding="async" />
      ${p.key === current ? '<span class="pick__tag">Now</span>' : elsewhere.length ? `<span class="pick__tag pick__tag--used">Used: ${esc(elsewhere[0].label)}</span>` : ''}
    </button>`;
  }).join('') || '<p class="empty">No photos match.</p>';
}
$('#pickerChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-trip]');
  if (b) { pick.trip = b.dataset.trip; renderPicker(); }
});
$('#pickerSearch').addEventListener('input', (e) => { pick.q = e.target.value.trim(); renderPicker(); });
async function choose(key) {
  const s = pick.slot;
  const ok = await attempt(async () => { await api('PUT', `/admin/slots/${s.id}`, { photo: key }); await refresh(); }, `${s.label}: photo changed`);
  if (ok) { picker.close(); renderAll(); }
}
$('#pickerGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (b && b.dataset.key !== slotPhoto(pick.slot)) choose(b.dataset.key);
  else if (b) picker.close();
});
$('#pickerFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const trip = pick.trip === 'all' ? trips().at(-1)?.id : pick.trip;
  toast('Uploading…');
  addFiles([file], { trip, type: pick.slot.group.startsWith('Experiences') ? 'people' : 'land', onDone: (p) => choose(p.key) });
});
picker.addEventListener('click', (e) => { if (e.target === picker || e.target.closest('[data-close]')) picker.close(); });

// ---------------------------------------------------------------- trips
function renderTrips(list) {
  $('#trips').innerHTML = trips().map((t, i) => {
    const n = list.filter((p) => p.trip === t.id && !p.removed).length;
    return `<article class="trip" data-trip="${esc(t.id)}">
      <span class="trip__n">${String(i + 1).padStart(2, '0')}</span>
      <label class="field field--small">Name<input data-tf="title" maxlength="60" value="${esc(t.title)}" /></label>
      <label class="field field--small">When it ran<input data-tf="start" type="month" value="${esc(t.start || '')}" /></label>
      <span class="trip__count">${n} photo${n === 1 ? '' : 's'}</span>
      <span class="trip__acts">
        ${t.edited && !t.custom ? '<button type="button" class="link" data-tact="reset">Back to the original</button>' : ''}
        ${t.custom ? `<button type="button" class="link link--danger" data-tact="delete"${n ? ' disabled title="Move or delete its photos first"' : ''}>Delete</button>` : ''}
      </span>
    </article>`;
  }).join('');
}
$('#trips').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-tf]');
  if (!input) return;
  const id = input.closest('[data-trip]').dataset.trip;
  await attempt(async () => { await api('PATCH', `/admin/trips/${id}`, { [input.dataset.tf]: input.value }); await refresh(); renderAll(); }, 'Trip saved');
});
$('#trips').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-tact]');
  if (!b) return;
  const id = b.closest('[data-trip]').dataset.trip;
  if (b.dataset.tact === 'delete' && !confirm(`Delete the trip "${tripName(id)}"?`)) return;
  await attempt(async () => {
    await api(b.dataset.tact === 'delete' ? 'DELETE' : 'POST', `/admin/trips/${id}${b.dataset.tact === 'reset' ? '/reset' : ''}`);
    await refresh();
    renderAll();
  }, b.dataset.tact === 'delete' ? 'Trip deleted' : 'Back to the original');
});
$('#tripAdd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  await attempt(async () => {
    const { id } = await api('POST', '/admin/trips', { title: f.title.value, start: f.start.value });
    await refresh();
    f.reset();
    $('#upTrip').value = '';
    renderAll();
    $('#upTrip').value = id;
  }, 'Trip added. Upload its photos in Album photos.');
});

// ---------------------------------------------------------------- go
api('GET', '/me').then((u) => { me = u; return start(); }).catch(() => showLogin());
