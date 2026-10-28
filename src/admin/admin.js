// The admin portal (/admin): the whole website's content without touching code. Upload and caption
// photos and clips, choose what each spot on the page shows, edit the wording (contacts, prices,
// stories, questions…), manage trips, the team of admins, and restore earlier versions.
// Every change is saved to a draft on the server (server/index.mjs); "Preview the website" shows the
// draft, and Publish puts it live.
import './admin.css';
import manifest from '../data/media.json';
import { catalogue, albumChapters, photoTypes } from '../data/photos.js';
import { photoSlots } from '../data/slots.js';
import { textFields } from '../data/fields.js';
import { photo, poster } from '../lib/media.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' });
const PAGE = 48;
const CLIP_MB = 250;

// what ships with the site, before any admin changes (this page never applies them to these)
const builtInTrips = albumChapters.map((c) => ({ id: c.trip, title: c.title, when: c.when, start: c.start }));
const slots = photoSlots().map((s) => ({
  ...s,
  def: s.get(),
  defText: Object.fromEntries((s.fields || []).map((f) => [f.name, s.obj[f.name]])),
}));
const fields = textFields().map((f) => ({ ...f, def: f.get() }));
const typeLabel = Object.fromEntries(photoTypes.map((t) => [t.id, t.label]));

let site = null; // the draft
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
// every clip: uploads first, then the site's own (named after where they play)
const shippedClipName = Object.fromEntries(slots.filter((s) => s.kind === 'video').map((s) => [s.def, s.label.replace(/: clip$/, '')]));
const prettyKey = (k) => k.replace(/^v-(m-)?/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
function clips() {
  const ups = Object.values(site.videos || {}).sort((a, b) => b.added - a.added).map((v) => ({ ...v, uploaded: true }));
  const own = Object.values(manifest.videos).map((v) => ({ ...v, title: shippedClipName[v.key] || prettyKey(v.key) }));
  return [...ups, ...own];
}
const slotValue = (s) => (s.kind === 'video' ? site.slots[s.id]?.video : site.slots[s.id]?.photo) || s.def;
function usage() {
  const used = {};
  for (const s of slots) (used[slotValue(s)] ||= []).push(s);
  return used;
}
const thumb = (s, key) => (s.kind === 'video' ? poster(key) : photo(key, 900));

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

// ---------------------------------------------------------------- publish bar
function renderPublish() {
  const live = site.live || {};
  const when = live.updated ? `${timeFmt.format(live.updated)}${live.by ? ` by ${live.by}` : ''}` : '';
  $('#publishBar').classList.toggle('is-pending', !!site.pending);
  $('#publishState').innerHTML = site.pending
    ? '<b>You have unpublished changes.</b> Preview them, then publish to put them on the website.'
    : `<b>Everything is published.</b>${when ? ` Last published ${esc(when)}.` : ''}`;
  $('#publishBtn').disabled = !site.pending;
  $('#discardBtn').disabled = !site.pending;
}
$('#publishBtn').addEventListener('click', async () => {
  if (!confirm('Publish your changes? Everyone visiting the website will see them. (You can go back to this version later in History.)')) return;
  await attempt(async () => { await api('POST', '/admin/publish'); await refresh(); renderAll(); }, 'Published. The website now shows your changes.');
});
$('#discardBtn').addEventListener('click', async () => {
  if (!confirm('Throw away every change since the last publish? This can\'t be undone.')) return;
  await attempt(async () => { await api('POST', '/admin/discard'); await refresh(); renderAll(); }, 'Changes discarded. The draft matches the website again.');
});

// ---------------------------------------------------------------- tabs
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  ui.tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${ui.tab}`; });
  b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // phones: the tab strip scrolls sideways
  renderAll();
}));

function renderAll() {
  const list = photos();
  $('#countAlbum').textContent = list.filter((p) => !p.removed).length;
  renderPublish();
  if (ui.tab === 'album') renderAlbum(list);
  if (ui.tab === 'spots') renderSpots(list);
  if (ui.tab === 'clips') renderClips();
  if (ui.tab === 'words') renderWords();
  if (ui.tab === 'trips') renderTrips(list);
  if (ui.tab === 'team') renderTeam();
  if (ui.tab === 'history') renderHistory();
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
  await attempt(async () => { await api('PATCH', `/admin/photos/${key}`, { alt }); await refresh(); renderPublish(); }, 'Caption saved');
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
    await attempt(async () => { await api('POST', `/admin/photos/${key}/remove`); await refresh(); renderAll(); }, 'Removed. Find it under "Removed" to put it back.');
  } else if (act === 'restore') {
    await attempt(async () => { await api('POST', `/admin/photos/${key}/restore`); await refresh(); renderAll(); }, 'Put back');
  } else if (act === 'delete') {
    if (!confirm('Delete this photo for good? This can\'t be undone.')) return;
    await attempt(async () => { await api('DELETE', `/admin/photos/${key}`); await refresh(); renderAll(); }, 'Deleted');
  }
});

// ---------------------------------------------------------------- photo uploads
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

// one multipart request with upload progress (photos and clips both use it)
function post(url, form, onProgress) {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.setRequestHeader('x-hineni-admin', '1');
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let j = {};
      try { j = JSON.parse(x.responseText); } catch { /* not JSON */ }
      resolve({ status: x.status, body: j });
    };
    x.onerror = () => resolve({ status: 0, body: { error: 'Connection lost.' } });
    x.send(form);
  });
}

async function send(item) {
  const fd = new FormData();
  fd.append('trip', item.trip);
  fd.append('type', item.type);
  fd.append('lastModified', String(item.file.lastModified || ''));
  fd.append('name', item.file.name);
  fd.append('photo', item.file);
  item.state = 'uploading';
  renderQueue();
  const { status, body } = await post('/api/admin/photos', fd, (pct) => {
    item.pct = pct;
    if (pct === 100) item.state = 'processing';
    renderQueue();
  });
  if (status === 401) { item.state = 'error'; item.error = 'Signed out.'; showLogin('You were signed out. Sign in again, then add the photos again.'); }
  else if (status >= 200 && status < 300 && body.photo) {
    item.state = 'done';
    site.photos[body.photo.key] = body.photo;
    site.pending = true;
    ui.fresh.add(body.photo.key);
    item.onDone?.(body.photo);
  } else { item.state = 'error'; item.error = body.error || `Upload failed (${status}).`; }
  renderQueue();
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
  waiting: 'Waiting…', reading: 'Reading the clip…', uploading: `Uploading ${i.pct}%`, processing: 'Preparing for the website…', done: 'Added', error: i.error,
}[i.state]);
const queueRow = (i) => `<li class="q q--${i.state}">
    ${i.preview ? `<img src="${i.preview}" alt="" />` : '<span class="q__noimg">!</span>'}
    <div class="q__body"><span class="q__name">${esc(i.file.name)}</span><span class="q__state">${esc(stateText(i))}</span>
      <span class="q__bar"><i style="width:${i.state === 'done' || i.state === 'processing' ? 100 : i.pct}%"></i></span></div>
    ${i.state === 'error' ? `<button type="button" class="link" data-dismiss="${i.id}">Dismiss</button>` : ''}
  </li>`;
function renderQueue() { $('#queue').innerHTML = queue.map(queueRow).join(''); }
$('#queue').addEventListener('click', (e) => {
  const id = e.target.closest('[data-dismiss]')?.dataset.dismiss;
  const i = queue.findIndex((q) => q.id === id);
  if (i >= 0) { queue.splice(i, 1); renderQueue(); }
});

function dropZone(el, onFiles) {
  ['dragenter', 'dragover'].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => el.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || !el.contains(e.relatedTarget)) el.classList.remove('is-over'); }));
  el.addEventListener('drop', (e) => onFiles([...e.dataTransfer.files]));
}
$('#chooseFiles').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
dropZone($('#drop'), addFiles);
// dropping a file anywhere else mustn't navigate away from the portal
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
window.addEventListener('beforeunload', (e) => { if (running || clipRunning) { e.preventDefault(); e.returnValue = ''; } });

// ---------------------------------------------------------------- clips
const clipQueue = [];
let clipRunning = 0;

// the poster frame, size and length, read from the clip in this browser (no server-side video tools)
function readClip(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;
    const done = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); URL.revokeObjectURL(url); fn(arg); };
    const fail = () => done(reject, new Error('This clip won\'t play in a browser. Export it as MP4 (H.264) and try again.'));
    const timer = setTimeout(fail, 30000);
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onerror = fail;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 3) / 3); };
    v.onseeked = () => {
      if (!v.videoWidth) return fail();
      const w = Math.min(1280, v.videoWidth);
      const h = Math.round((w * v.videoHeight) / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      c.toBlob((b) => (b ? done(resolve, { poster: b, preview: c.toDataURL('image/jpeg', 0.6), w: v.videoWidth, h: v.videoHeight, dur: v.duration }) : fail()), 'image/jpeg', 0.85);
    };
    v.src = url;
  });
}

function addClips(files, { onDone } = {}) {
  for (const file of files) {
    const item = { file, onDone, id: Math.random().toString(36).slice(2), state: 'waiting', pct: 0, error: '', preview: '' };
    if (!/^video\/(mp4|webm)$/.test(file.type)) item.error = 'Use an MP4 (H.264) or WebM clip. Other formats don\'t play in every browser.';
    else if (file.size > CLIP_MB * 1024 * 1024) item.error = `Over ${CLIP_MB} MB. Export a shorter or smaller version.`;
    if (item.error) item.state = 'error';
    clipQueue.push(item);
  }
  renderClipQueue();
  pumpClips();
}
async function pumpClips() {
  if (clipRunning) return;
  const item = clipQueue.find((i) => i.state === 'waiting');
  if (!item) return;
  clipRunning = 1;
  try {
    item.state = 'reading';
    renderClipQueue();
    const info = await readClip(item.file);
    item.preview = info.preview;
    const fd = new FormData();
    fd.append('title', item.file.name);
    fd.append('w', String(info.w));
    fd.append('h', String(info.h));
    fd.append('dur', String(info.dur));
    fd.append('video', item.file);
    fd.append('poster', info.poster, 'poster.jpg');
    item.state = 'uploading';
    renderClipQueue();
    const { status, body } = await post('/api/admin/videos', fd, (pct) => {
      item.pct = pct;
      if (pct === 100) item.state = 'processing';
      renderClipQueue();
    });
    if (status >= 200 && status < 300 && body.video) {
      item.state = 'done';
      site.videos[body.video.key] = body.video;
      site.pending = true;
      ui.fresh.add(body.video.key);
      item.onDone?.(body.video);
      renderAll();
      toast('Clip added. Choose where it plays in Spots on the page.');
      setTimeout(() => { const i = clipQueue.indexOf(item); if (i >= 0) clipQueue.splice(i, 1); renderClipQueue(); }, 2500);
    } else {
      if (status === 401) showLogin('You were signed out. Sign in again, then add the clip again.');
      item.state = 'error';
      item.error = body.error || `Upload failed (${status}).`;
    }
  } catch (e) {
    item.state = 'error';
    item.error = e.message;
  }
  clipRunning = 0;
  renderClipQueue();
  pumpClips();
}
function renderClipQueue() { $('#clipQueue').innerHTML = clipQueue.map(queueRow).join(''); }
$('#clipQueue').addEventListener('click', (e) => {
  const id = e.target.closest('[data-dismiss]')?.dataset.dismiss;
  const i = clipQueue.findIndex((q) => q.id === id);
  if (i >= 0) { clipQueue.splice(i, 1); renderClipQueue(); }
});
$('#chooseClips').addEventListener('click', () => $('#clipInput').click());
$('#clipInput').addEventListener('change', (e) => { addClips([...e.target.files]); e.target.value = ''; });
dropZone($('#clipDrop'), addClips);

const mins = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');
function renderClips() {
  const used = usage();
  $('#clips').innerHTML = clips().map((c) => {
    const where = used[c.key] || [];
    return `<article class="card${ui.fresh.has(c.key) ? ' is-new' : ''}" data-clip="${esc(c.key)}">
      <div class="card__img"><img src="${poster(c.key)}" alt="" loading="lazy" decoding="async" />
        <div class="card__badges">
          ${c.uploaded ? '<span class="badge">Uploaded</span>' : ''}
          ${where.length ? `<span class="badge badge--used" title="${esc(where.map((s) => s.label).join(', '))}">On the page</span>` : ''}
          ${c.dur ? `<span class="badge">${mins(c.dur)}</span>` : ''}
        </div>
      </div>
      <div class="card__body">
        ${c.uploaded
          ? `<label class="field field--small">Name<input data-clip-title maxlength="80" value="${esc(c.title)}" /></label>`
          : `<p class="card__title">${esc(c.title)}</p>`}
        <div class="card__row card__row--foot">
          <span class="card__date">${where.length ? esc(where.map((s) => s.label).join(', ')) : 'Not used on the page'}</span>
          ${c.uploaded && !where.length ? '<button type="button" class="link link--danger" data-clip-delete>Delete</button>' : ''}
        </div>
      </div>
    </article>`;
  }).join('');
}
$('#clips').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-clip-title]');
  if (!input) return;
  const key = input.closest('[data-clip]').dataset.clip;
  await attempt(async () => { await api('PATCH', `/admin/videos/${key}`, { title: input.value }); await refresh(); renderPublish(); }, 'Saved');
});
$('#clips').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-clip-delete]')) return;
  const key = e.target.closest('[data-clip]').dataset.clip;
  if (!confirm('Delete this clip for good? This can\'t be undone.')) return;
  await attempt(async () => { await api('DELETE', `/admin/videos/${key}`); await refresh(); renderAll(); }, 'Clip deleted');
});

// ---------------------------------------------------------------- spots on the page
const groupHints = {
  'Hero slideshow on computers': 'The first thing visitors see. Landscape photos; the place name and line show over the photo.',
  'Hero slideshow on phones': 'The same slideshow on phones. Portrait photos.',
  'Hero trust card': 'The small card with real faces at the bottom of the hero.',
  Trips: 'The trip cards and the photo for each day of the itineraries.',
  Experiences: 'One photo per experience card.',
  'Experience clips': 'The clip that plays from the ▶ button on these experience cards.',
  Wildlife: 'One photo or clip per sighting. Change the animal names and notes in Words & details.',
  'The idea': 'The two small photos set into the paragraph under the album.',
  'Big quote': 'The full-width photo behind the quote near the end of the page.',
  'Guest stories': 'The photo on each guest story card. Their words are in Words & details.',
  'Who we are': 'The group portrait next to the story.',
  'The film': 'What plays from "Watch the film" in the hero.',
};
function renderSpots(list) {
  const byKey = Object.fromEntries(list.map((p) => [p.key, p]));
  const clipByKey = Object.fromEntries(clips().map((c) => [c.key, c]));
  const groups = [...new Set(slots.map((s) => s.group))];
  $('#spots').innerHTML = groups.map((g) => `<section class="group">
    <h3>${esc(g)}</h3>
    <p class="group__hint">${esc(groupHints[g] || '')}</p>
    <div class="slots">${slots.filter((s) => s.group === g).map((s) => spot(s, s.kind === 'video' ? clipByKey : byKey)).join('')}</div>
  </section>`).join('');
}
function spot(s, byKey) {
  const key = slotValue(s);
  const o = site.slots[s.id] || {};
  const chosen = s.kind === 'video' ? o.video : o.photo;
  const changed = (chosen && chosen !== s.def) || (s.fields || []).some((f) => o[f.name] != null && o[f.name] !== s.defText[f.name]);
  const p = byKey[key];
  const misfit = s.kind !== 'video' && p && s.shape && p.orient !== s.shape && p.orient !== 'square';
  const what = s.kind === 'video' ? 'clip' : 'photo';
  return `<article class="slot slot--${s.shape || 'any'}" data-slot="${esc(s.id)}">
    <button type="button" class="slot__img" data-pick aria-label="Change the ${what} for ${esc(s.label)}">
      <img src="${thumb(s, key)}" alt="" loading="lazy" decoding="async" /><span>Change ${what}</span>
    </button>
    <div class="slot__body">
      <div class="slot__label">${esc(s.label)}${changed ? ' <span class="pill">Changed</span>' : ''}</div>
      <p class="slot__alt">${esc(s.kind === 'video' ? p?.title : p?.alt || '')}</p>
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

// ---- picker: a photo or a clip for one spot
const picker = $('#picker');
const pick = { slot: null, trip: 'all', q: '' };
function openPicker(s) {
  pick.slot = s;
  pick.q = '';
  $('#pickerSearch').value = '';
  const video = s.kind === 'video';
  $('#pickerTitle').textContent = `Choose a ${video ? 'clip' : 'photo'} for ${s.group.replace(/ on (computers|phones)$/, '')}: ${s.label}`;
  $('#pickerHint').textContent = video ? 'Any clip in Clips. Upload a new one here, or in the Clips tab.'
    : s.shape === 'wide' ? 'Landscape photos fit this spot best.' : s.shape === 'tall' ? 'Portrait photos fit this spot best.' : 'Any photo works here.';
  $('#pickerChips').hidden = video;
  $('#pickerFile').accept = video ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp';
  renderPicker();
  picker.showModal();
  $('#pickerSearch').focus();
}
function renderPicker() {
  const s = pick.slot;
  const current = slotValue(s);
  const used = usage();
  const q = pick.q.toLowerCase();
  const tag = (key) => {
    const elsewhere = (used[key] || []).filter((x) => x.id !== s.id);
    return key === current ? '<span class="pick__tag">Now</span>' : elsewhere.length ? `<span class="pick__tag pick__tag--used">Used: ${esc(elsewhere[0].label)}</span>` : '';
  };
  if (s.kind === 'video') {
    $('#pickerUploadLabel').textContent = 'Upload a new clip';
    const shown = clips().filter((c) => !q || c.title.toLowerCase().includes(q));
    $('#pickerGrid').innerHTML = shown.map((c) => `<button type="button" class="pick pick--clip${c.key === current ? ' is-current' : ''}" data-key="${esc(c.key)}" title="${esc(c.title)}">
      <img src="${poster(c.key)}" alt="${esc(c.title)}" loading="lazy" decoding="async" />${tag(c.key)}<span class="pick__name">${esc(c.title)}</span>
    </button>`).join('') || '<p class="empty">No clips match.</p>';
    return;
  }
  const list = photos().filter((p) => !p.removed);
  const chip = (id, label) => `<button type="button" class="chip${pick.trip === id ? ' is-on' : ''}" data-trip="${esc(id)}">${esc(label)}</button>`;
  $('#pickerChips').innerHTML = chip('all', 'All trips') + trips().map((t) => chip(t.id, t.title)).join('');
  const upTrip = pick.trip === 'all' ? trips().at(-1)?.id : pick.trip;
  $('#pickerUploadLabel').textContent = `Upload a new one to ${tripName(upTrip)}`;
  // photos that suit the spot's shape first
  const shown = list.filter((p) => (pick.trip === 'all' || p.trip === pick.trip) && (!q || p.alt.toLowerCase().includes(q)))
    .sort((a, b) => (s.shape ? (b.orient === s.shape) - (a.orient === s.shape) : 0));
  $('#pickerGrid').innerHTML = shown.map((p) => `<button type="button" class="pick${p.key === current ? ' is-current' : ''}${s.shape && p.orient !== s.shape ? ' is-misfit' : ''}" data-key="${esc(p.key)}" title="${esc(p.alt)}">
      <img src="${photo(p.key, 900)}" alt="${esc(p.alt)}" loading="lazy" decoding="async" />${tag(p.key)}
    </button>`).join('') || '<p class="empty">No photos match.</p>';
}
$('#pickerChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-trip]');
  if (b) { pick.trip = b.dataset.trip; renderPicker(); }
});
$('#pickerSearch').addEventListener('input', (e) => { pick.q = e.target.value.trim(); renderPicker(); });
async function choose(key) {
  const s = pick.slot;
  const ok = await attempt(async () => { await api('PUT', `/admin/slots/${s.id}`, { [s.kind === 'video' ? 'video' : 'photo']: key }); await refresh(); }, `${s.label}: changed`);
  if (ok) { picker.close(); renderAll(); }
}
$('#pickerGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (b && b.dataset.key !== slotValue(pick.slot)) choose(b.dataset.key);
  else if (b) picker.close();
});
$('#pickerFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (pick.slot.kind === 'video') {
    toast('Uploading the clip…');
    addClips([file], { onDone: (v) => choose(v.key) });
    return;
  }
  const trip = pick.trip === 'all' ? trips().at(-1)?.id : pick.trip;
  toast('Uploading…');
  addFiles([file], { trip, type: pick.slot.group.startsWith('Experiences') ? 'people' : 'land', onDone: (p) => choose(p.key) });
});
picker.addEventListener('click', (e) => { if (e.target === picker || e.target.closest('[data-close]')) picker.close(); });

// ---------------------------------------------------------------- words & details
const openGroups = new Set(['Contact details']);
function renderWords() {
  const groups = [...new Set(fields.map((f) => f.group))];
  $('#words').innerHTML = groups.map((g) => {
    const list = fields.filter((f) => f.group === g);
    const changed = list.filter((f) => f.id in site.text).length;
    return `<details class="words" data-group="${esc(g)}"${openGroups.has(g) ? ' open' : ''}>
      <summary><h3>${esc(g)}</h3>${changed ? `<span class="pill">${changed} changed</span>` : ''}</summary>
      <div class="words__list">${list.map(field).join('')}</div>
    </details>`;
  }).join('');
}
function field(f) {
  const value = f.id in site.text ? site.text[f.id] : f.def;
  const changed = f.id in site.text && site.text[f.id] !== f.def;
  const label = `${esc(f.label)}${changed ? ' <span class="pill">Changed</span>' : ''}`;
  const reset = changed ? '<button type="button" class="link" data-word-reset>Back to the original</button>' : '';
  const hint = f.hint ? `<small class="field__hint">${esc(f.hint)}</small>` : '';
  if (f.kind === 'switch') {
    return `<div class="word word--switch" data-word="${esc(f.id)}">
      <label class="switch"><input type="checkbox" data-word-input${value === '1' ? ' checked' : ''} /><span>${label}</span></label>${hint}${reset}
    </div>`;
  }
  const input = f.kind === 'long'
    ? `<textarea data-word-input rows="3" maxlength="${f.max}">${esc(value)}</textarea>`
    : `<input data-word-input type="${f.kind === 'email' ? 'email' : f.kind === 'phone' ? 'tel' : 'text'}" maxlength="${f.max}" value="${esc(value)}" />`;
  return `<div class="word" data-word="${esc(f.id)}"><label class="field">${label}${input}</label>${hint}${reset}</div>`;
}
$('#words').addEventListener('toggle', (e) => {
  const d = e.target.closest('[data-group]');
  if (d) d.open ? openGroups.add(d.dataset.group) : openGroups.delete(d.dataset.group);
}, true);
$('#words').addEventListener('change', async (e) => {
  const input = e.target.closest('[data-word-input]');
  if (!input) return;
  const f = fields.find((x) => x.id === input.closest('[data-word]').dataset.word);
  const value = f.kind === 'switch' ? (input.checked ? '1' : '0') : input.value.replace(/\s+/g, ' ').trim();
  await attempt(async () => {
    if (value === f.def) await api('DELETE', `/admin/text/${f.id}`);
    else await api('PUT', `/admin/text/${f.id}`, { value });
    await refresh();
    renderAll();
  }, 'Saved');
});
$('#words').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-word-reset]')) return;
  const id = e.target.closest('[data-word]').dataset.word;
  await attempt(async () => { await api('DELETE', `/admin/text/${id}`); await refresh(); renderAll(); }, 'Back to the original');
});

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

// ---------------------------------------------------------------- team
async function renderTeam() {
  let admins = [];
  await attempt(async () => { ({ admins } = await api('GET', '/admin/team')); });
  $('#team').innerHTML = admins.map((a) => `<li class="team__row" data-user="${esc(a.user)}">
    <span class="team__user">${esc(a.user)}${a.me ? ' <span class="pill">You</span>' : ''}</span>
    ${a.created ? `<span class="team__since">Since ${dateFmt.format(new Date(a.created))}</span>` : ''}
    ${a.me ? '' : '<button type="button" class="link link--danger" data-remove-admin>Remove</button>'}
  </li>`).join('');
}
$('#team').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-remove-admin]')) return;
  const user = e.target.closest('[data-user]').dataset.user;
  if (!confirm(`Remove ${user}? They're signed out straight away and can't sign in again.`)) return;
  await attempt(async () => { await api('DELETE', `/admin/team/${encodeURIComponent(user)}`); await renderTeam(); }, `${user} removed`);
});
$('#teamAdd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  await attempt(async () => {
    await api('POST', '/admin/team', { user: f.user.value.trim(), password: f.password.value });
    const who = f.user.value.trim();
    f.reset();
    await renderTeam();
    toast(`${who} can now sign in.`);
  });
});
$('#passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (f.password.value !== f.again.value) { toast('The two new passwords are different.', 'error'); return; }
  await attempt(async () => {
    await api('POST', '/admin/team/password', { current: f.current.value, password: f.password.value });
    f.reset();
  }, 'Password changed');
});

// ---------------------------------------------------------------- history
async function renderHistory() {
  let data = { live: {}, versions: [] };
  await attempt(async () => { data = await api('GET', '/admin/history'); });
  const row = (label, v, id) => `<li class="history__row"${id ? ` data-version="${esc(id)}"` : ''}>
    <span class="history__when">${v.updated ? esc(timeFmt.format(v.updated)) : 'The website as built'}</span>
    <span class="history__by">${v.updated ? `${esc(label)}${v.by ? ` by ${esc(v.by)}` : ''}` : 'Before any changes from this portal'}</span>
    ${id ? '<button type="button" class="btn btn--quiet" data-restore>Restore into the draft</button>' : '<span class="pill">Live now</span>'}
  </li>`;
  $('#history').innerHTML = row('Published', data.live)
    + (data.versions.length ? data.versions.map((v) => row('Published', v, v.id)).join('') : '<li class="empty">Nothing published before this yet.</li>');
}
$('#history').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-restore]')) return;
  const id = e.target.closest('[data-version]').dataset.version;
  if (!confirm('Replace the draft with this version? Unpublished changes in the draft are lost. The website doesn\'t change until you publish.')) return;
  await attempt(async () => { await api('POST', `/admin/history/${id}/restore`); await refresh(); renderAll(); }, 'Restored into the draft. Preview it, then publish.');
});

// ---------------------------------------------------------------- go
api('GET', '/me').then((u) => { me = u; return start(); }).catch(() => showLogin());
