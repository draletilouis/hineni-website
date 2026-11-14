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
import { places as mapPlaces, regions as mapRegions, routeTrips, stopoverId, parseRates, ratesText } from '../data/content.js';

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
// what a spot shows: its chosen photo or clip, or the original, and whatever has replaced that since
const current = (key) => { for (let i = 0; i < 20 && site.replaced?.[key]; i++) key = site.replaced[key]; return key; };
const slotValue = (s) => current((s.kind === 'video' ? site.slots[s.id]?.video : site.slots[s.id]?.photo) || s.def);
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
  if (ui.tab === 'map') renderMap();
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
    ${p.removed ? `<div class="card__img card__img--${p.orient}">` : `<button type="button" class="card__img card__img--${p.orient}" data-replace aria-label="Replace this photo with another from your device">`}
      <img src="${photo(p.key, 900)}" alt="" loading="lazy" decoding="async" />
      <div class="card__badges">
        ${p.uploaded ? '<span class="badge">Uploaded</span>' : ''}
        ${used.length ? `<span class="badge badge--used" title="${esc(spots)}">On the page${used.length > 1 ? ` ×${used.length}` : ''}</span>` : ''}
      </div>
      ${p.removed ? '</div>' : '<span class="card__replace">Replace photo</span></button>'}
    <div class="card__body">
      <label class="sr" for="alt-${esc(p.key)}">Caption</label>
      <textarea id="alt-${esc(p.key)}" class="card__alt${p.alt ? '' : ' is-empty'}" rows="2" maxlength="160" data-alt placeholder="Add a caption: what's happening, and where" ${p.removed ? 'disabled' : ''}>${esc(p.alt)}</textarea>
      ${p.removed ? '' : `<div class="card__row">
        <select data-field="trip" aria-label="Trip">${tripOptions(p.trip)}</select>
        <select data-field="type" aria-label="What it shows">${typeOptions(p.type)}</select>
      </div>`}
      <div class="card__row card__row--foot">
        <span class="card__date">${p.removed && site.replaced?.[p.key] ? 'Replaced by a new photo' : p.t ? dateFmt.format(p.t) : ''}</span>
        ${p.removed
          ? `<span class="card__acts"><button type="button" class="link" data-act="restore">Put back</button>${p.uploaded ? '<button type="button" class="link link--danger" data-act="delete">Delete for good</button>' : ''}</span>`
          : '<span class="card__acts"><button type="button" class="link" data-act="where">Put on the page</button><button type="button" class="link link--danger" data-act="remove">Remove from website</button></span>'}
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
  if (e.target.closest('[data-replace]')) { replacePhoto(e.target.closest('[data-key]').dataset.key); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const key = b.closest('[data-key]').dataset.key;
  const act = b.dataset.act;
  if (act === 'where') { openWhere(key); return; }
  if (act === 'remove') {
    const used = usage()[key];
    if (used) {
      toast(`This photo is on the page (${used.map((s) => `${s.group}: ${s.label}`).join(', ')}). Tap it to replace it instead, or pick another photo there in Spots on the page.`, 'error');
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

function addFiles(files, { trip, type, onDone, onError } = {}) {
  trip ||= $('#upTrip').value;
  type ||= $('#upType').value;
  for (const file of files) {
    const item = { file, trip, type, onDone, onError, id: Math.random().toString(36).slice(2), state: 'waiting', pct: 0, error: '' };
    if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type)) item.error = 'HEIC isn\'t supported: on an iPhone, upload from the browser (it converts them) or export as JPEG.';
    else if (!/^image\/(jpeg|png|webp)$/.test(file.type)) item.error = 'Not a JPEG, PNG or WebP photo.';
    else if (file.size > MAX_MB * 1024 * 1024) item.error = `Over ${MAX_MB} MB.`;
    if (item.error) { item.state = 'error'; onError?.(item.error); }
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
  } else { item.state = 'error'; item.error = body.error || `Upload failed (${status}).`; item.onError?.(item.error); }
  renderQueue();
}

// ---- replace: tap a photo or clip, choose the new one, and it takes the old one's place everywhere
const replaceInput = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
document.body.append(replaceInput);
let onReplaceFile = null;
replaceInput.addEventListener('change', () => {
  const file = replaceInput.files[0];
  const then = onReplaceFile;
  replaceInput.value = '';
  onReplaceFile = null;
  if (file && then) then(file);
});
function chooseFile(accept, then) {
  onReplaceFile = then;
  replaceInput.accept = accept;
  replaceInput.click();
}
const failed = (msg) => toast(`Couldn't replace it: ${msg}`, 'error');

// the new photo keeps the old one's caption, trip, type and place in the album; the old one is removed
function replacePhoto(key) {
  const old = photos().find((p) => p.key === key);
  if (!old) return;
  chooseFile('image/jpeg,image/png,image/webp', (file) => {
    toast('Uploading the new photo…');
    addFiles([file], {
      trip: old.trip,
      type: old.type,
      onError: failed,
      onDone: (p) => attempt(async () => {
        if (old.alt) await api('PATCH', `/admin/photos/${p.key}`, { alt: old.alt });
        await api('POST', `/admin/photos/${key}/replace`, { with: p.key });
        await refresh();
        renderAll();
      }, 'Replaced. The new photo shows everywhere the old one did (the old one is under "Removed").'),
    });
  });
}
function replaceClip(key) {
  const old = clips().find((c) => c.key === key);
  if (!old) return;
  chooseFile('video/*', (file) => {
    toast('Uploading the new clip…');
    addClips([file], {
      onError: failed,
      onDone: (v) => attempt(async () => {
        await api('PATCH', `/admin/videos/${v.key}`, { title: old.title });
        await api('POST', `/admin/videos/${key}/replace`, { with: v.key });
        await refresh();
        renderAll();
      }, 'Replaced. The new clip plays everywhere the old one did.'),
    });
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

// the poster frame, size and length, read from the clip in this browser when it can play it. It often can't
// (an iPhone HEVC clip in Chrome): then null, and the server takes all three from the clip as it converts it
function readClip(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    let settled = false;
    const done = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); URL.revokeObjectURL(url); fn(arg); };
    const fail = () => done(resolve, null);
    const timer = setTimeout(fail, 15000);
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

const CLIP_FILE = /\.(mp4|m4v|mov|webm|3gp|mkv|avi)$/i;
function addClips(files, { onDone, onError } = {}) {
  for (const file of files) {
    const item = { file, onDone, onError, id: Math.random().toString(36).slice(2), state: 'waiting', pct: 0, error: '', preview: '' };
    if (!/^video\//.test(file.type) && !CLIP_FILE.test(file.name)) item.error = 'That doesn\'t look like a video clip.';
    else if (file.size > CLIP_MB * 1024 * 1024) item.error = `Over ${CLIP_MB} MB. Export a shorter or smaller version.`;
    if (item.error) { item.state = 'error'; onError?.(item.error); }
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
    const fd = new FormData();
    fd.append('title', item.file.name);
    if (info) {
      item.preview = info.preview;
      fd.append('w', String(info.w));
      fd.append('h', String(info.h));
      fd.append('dur', String(info.dur));
    }
    fd.append('video', item.file);
    if (info) fd.append('poster', info.poster, 'poster.jpg');
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
  if (item.state === 'error') item.onError?.(item.error);
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
    const by = site.replaced?.[c.key] && clips().find((x) => x.key === site.replaced[c.key]);
    return `<article class="card${by ? ' is-removed' : ''}${ui.fresh.has(c.key) ? ' is-new' : ''}" data-clip="${esc(c.key)}">
      <button type="button" class="card__img" data-clip-replace aria-label="Replace this clip with another from your device"><img src="${poster(c.key)}" alt="" loading="lazy" decoding="async" />
        <div class="card__badges">
          ${c.uploaded ? '<span class="badge">Uploaded</span>' : ''}
          ${where.length ? `<span class="badge badge--used" title="${esc(where.map((s) => s.label).join(', '))}">On the page</span>` : ''}
          ${c.dur ? `<span class="badge">${mins(c.dur)}</span>` : ''}
        </div>
        <span class="card__replace">Replace clip</span>
      </button>
      <div class="card__body">
        ${c.uploaded
          ? `<label class="field field--small">Name<input data-clip-title maxlength="80" value="${esc(c.title)}" /></label>`
          : `<p class="card__title">${esc(c.title)}</p>`}
        <div class="card__row card__row--foot">
          <span class="card__date">${by ? `Replaced by ${esc(by.title)}` : where.length ? esc(where.map((s) => s.label).join(', ')) : 'Not used on the page'}</span>
          <span class="card__acts">
            ${by ? '' : '<button type="button" class="link" data-clip-where>Put on the page</button>'}
            ${by ? '<button type="button" class="link" data-clip-restore>Put back</button>' : ''}
            ${c.uploaded && !where.length && !Object.values(site.replaced || {}).includes(c.key) ? '<button type="button" class="link link--danger" data-clip-delete>Delete</button>' : ''}
          </span>
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
  const card = e.target.closest('[data-clip]');
  if (!card) return;
  const key = card.dataset.clip;
  if (e.target.closest('[data-clip-replace]')) { replaceClip(key); return; }
  if (e.target.closest('[data-clip-where]')) { openWhere(key); return; }
  if (e.target.closest('[data-clip-restore]')) {
    await attempt(async () => { await api('POST', `/admin/videos/${key}/restore`); await refresh(); renderAll(); }, 'Put back. It plays in its own places again.');
    return;
  }
  if (!e.target.closest('[data-clip-delete]')) return;
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
  'Experience clips': 'The clip that plays over each experience card while the pointer is on it (on phones, while the card is on screen), and from its ▶ button. A card without a clip shows its photo.',
  Wildlife: 'One photo or clip per sighting. Change the animal names and notes in Words & details.',
  'The Ugly 5': 'One photo for each of the Ugly 5 under the wildlife. Their names and notes are in Words & details.',
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
      ${key ? `<img src="${thumb(s, key)}" alt="" loading="lazy" decoding="async" />` : `<em class="slot__empty">No ${what} yet</em>`}<span>${key ? `Change ${what}` : `Add a ${what}`}</span>
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
const pick = { slot: null, map: null, media: 'photos', trip: 'all', q: '' };
// for a map place or stopover: tap photos and clips to add them, tap again to take them out
function openMapPicker(it) {
  pick.map = it;
  pick.slot = null;
  pick.q = '';
  $('#pickerSearch').value = '';
  $('#pickerTitle').textContent = `Photos and clips for ${it.name}`;
  $('#pickerHint').textContent = 'Tap to add, tap again to take it off. They show in the order you add them; the first is the cover.';
  $('#pickerChips').hidden = false;
  $('#pickerFile').accept = 'image/jpeg,image/png,image/webp,video/*';
  renderPicker();
  picker.showModal();
  $('#pickerSearch').focus();
}
function renderMapPicker() {
  const it = mapItem(pick.map.kind, pick.map.id);
  const has = new Set(it?.list || []);
  const q = pick.q.toLowerCase();
  const chip = (attr, id, label, on) => `<button type="button" class="chip${on ? ' is-on' : ''}" ${attr}="${esc(id)}">${esc(label)}</button>`;
  $('#pickerChips').innerHTML = chip('data-media', 'photos', 'Photos', pick.media === 'photos') + chip('data-media', 'clips', 'Clips', pick.media === 'clips')
    + (pick.media === 'photos' ? chip('data-trip', 'all', 'All trips', pick.trip === 'all') + trips().map((t) => chip('data-trip', t.id, t.title, pick.trip === t.id)).join('') : '');
  $('#pickerUploadLabel').textContent = 'Upload a new photo or clip';
  const added = (k) => (has.has(k) ? '<span class="pick__tag">Added</span>' : '');
  $('#pickerGrid').innerHTML = (pick.media === 'clips'
    ? clips().filter((c) => !q || c.title.toLowerCase().includes(q)).map((c) => `<button type="button" class="pick pick--clip${has.has(c.key) ? ' is-current' : ''}" data-key="${esc(c.key)}" title="${esc(c.title)}">
        <img src="${poster(c.key)}" alt="${esc(c.title)}" loading="lazy" decoding="async" />${added(c.key)}<span class="pick__name">${esc(c.title)}</span></button>`)
    : photos().filter((p) => !p.removed && (pick.trip === 'all' || p.trip === pick.trip) && (!q || p.alt.toLowerCase().includes(q))).map((p) => `<button type="button" class="pick${has.has(p.key) ? ' is-current' : ''}" data-key="${esc(p.key)}" title="${esc(p.alt)}">
        <img src="${photo(p.key, 900)}" alt="${esc(p.alt)}" loading="lazy" decoding="async" />${added(p.key)}</button>`)
  ).join('') || '<p class="empty">Nothing matches.</p>';
}
async function toggleMap(key, add) {
  const it = mapItem(pick.map.kind, pick.map.id);
  const list = it.list.includes(key) && !add ? it.list.filter((k) => k !== key) : [...new Set([...it.list, key])];
  const ok = await attempt(async () => { await saveMapList(it, list); await refresh(); }, list.includes(key) ? `Added to ${it.name}` : `Taken off ${it.name}`);
  if (ok) { if (picker.open) renderPicker(); renderAll(); }
}
picker.addEventListener('close', () => { pick.map = null; });
function openPicker(s) {
  pick.map = null;
  pick.slot = s;
  pick.q = '';
  $('#pickerSearch').value = '';
  const video = s.kind === 'video';
  $('#pickerTitle').textContent = `Choose a ${video ? 'clip' : 'photo'} for ${s.group.replace(/ on (computers|phones)$/, '')}: ${s.label}`;
  $('#pickerHint').textContent = video ? 'Any clip in Clips. Upload a new one here, or in the Clips tab.'
    : s.shape === 'wide' ? 'Landscape photos fit this spot best.' : s.shape === 'tall' ? 'Portrait photos fit this spot best.' : 'Any photo works here.';
  $('#pickerChips').hidden = video;
  $('#pickerFile').accept = video ? 'video/*' : 'image/jpeg,image/png,image/webp';
  renderPicker();
  picker.showModal();
  $('#pickerSearch').focus();
}
function renderPicker() {
  if (pick.map) return renderMapPicker();
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
  const m = e.target.closest('[data-media]');
  if (m) { pick.media = m.dataset.media; renderPicker(); return; }
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
  if (pick.map) { if (b) toggleMap(b.dataset.key); return; }
  if (b && b.dataset.key !== slotValue(pick.slot)) choose(b.dataset.key);
  else if (b) picker.close();
});
$('#pickerFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (pick.map) {
    const target = pick.map; // the picker may close before the upload finishes
    const add = (key) => { pick.map ||= target; toggleMap(key, true); };
    toast('Uploading…');
    if (/^video\//.test(file.type) || CLIP_FILE.test(file.name)) addClips([file], { onDone: (v) => add(v.key) });
    else addFiles([file], { trip: pick.trip === 'all' ? trips().at(-1)?.id : pick.trip, type: 'land', onDone: (p) => add(p.key) });
    return;
  }
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

// ---------------------------------------------------------------- map
// Every place on the route map, and every stopover on the trips' drives, shows a list of photos and clips
// (in order: the first is the cover). The portal can add stopovers of its own: a name, a time, a note and a
// point on the road, from a Google Maps link or coordinates. Saved in the draft as site.map.
const clipKey = (k) => !!(manifest.videos[k] || site.videos?.[k]);
const stillOf = (k) => (clipKey(k) ? poster(k) : photo(k, 900));
const km = ([a, b], [c, d]) => { const r = Math.PI / 180; const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
// a planned stopover with no photos of its own borrows the nearest place's, as the map does (within 1.5 km)
const borrows = (o) => mapPlaces.filter((p) => p.photos).map((p) => [p, km([o.lat, o.lon], [p.lat, p.lon])]).filter(([, d]) => d < 1.5).sort((a, b) => a[1] - b[1])[0]?.[0];
const tripLabel = (id) => routeTrips.find((t) => t.id === id)?.label || id;

// the map's regions (destinations): the code's, with the draft's changes, then the portal's own
function allRegions() {
  const own = site.map?.regions || {};
  const pick = (o) => Object.fromEntries(['name', 'blurb', 'color', 'hub', 'hidden'].filter((k) => k in o).map((k) => [k, o[k]]));
  return [
    ...mapRegions.map((r) => ({ ...r, ...pick(own[r.id] || {}), hidden: own[r.id] && 'hidden' in own[r.id] ? !!own[r.id].hidden : !!r.hidden, changed: !!own[r.id] })),
    ...Object.entries(own).filter(([, r]) => r.custom).map(([id, r]) => ({ id, ...r, hidden: !!r.hidden, custom: true })),
  ];
}
function mapItems() {
  const m = site.map || { places: {}, stopovers: {} };
  const stops = routeTrips.map((t) => ({
    t,
    list: [
      ...t.stops.flatMap((s) => (s.leg?.stopovers || []).map((o) => {
        const id = stopoverId(t.id, o.name);
        const own = m.stopovers?.[id]?.photos;
        return { kind: 'stop', id, name: o.name, sub: [o.when, o.note].filter(Boolean).join('. '), list: own || [], changed: !!own, from: !own && borrows(o) };
      })),
      ...Object.entries(m.stopovers || {}).filter(([, s]) => s.custom && s.trip === t.id)
        .map(([id, s]) => ({ kind: 'stop', id, custom: true, name: s.name, s, list: s.photos || [] })),
    ],
  }));
  const regions = allRegions().map((r) => ({
    r,
    list: mapPlaces.filter((p) => p.region === r.id).map((p) => {
      const own = m.places?.[p.id]?.photos;
      return { kind: 'place', id: p.id, name: p.name, sub: p.note, list: own || p.photos || [], changed: !!own, web: !own && !p.photos && !!p.web };
    }).concat(Object.entries(m.places || {}).filter(([, p]) => p.custom && p.region === r.id)
      .map(([id, p]) => ({ kind: 'place', id, custom: true, name: p.name, s: p, list: p.photos || [] }))),
  }));
  return { stops, regions, all: [...stops.flatMap((g) => g.list), ...regions.flatMap((g) => g.list)] };
}
const mapItem = (kind, id) => mapItems().all.find((it) => it.kind === kind && it.id === id);

function mapMedia(it) {
  const media = it.list.map((k, i) => `<figure class="mapmedia" data-k="${esc(k)}">
      <img src="${stillOf(k)}" alt="" loading="lazy" decoding="async" />${clipKey(k) ? '<span class="mapmedia__tag">Clip</span>' : i ? '' : '<span class="mapmedia__tag">Cover</span>'}
      <span class="mapmedia__acts">${i ? '<button type="button" data-mm="left" aria-label="Move earlier">←</button>' : ''}<button type="button" data-mm="remove" aria-label="Take it off">✕</button></span>
    </figure>`).join('');
  const empty = !it.list.length
    ? `<p class="maprow__empty">${it.from ? `Shows the photos of ${esc(it.from.name)}, nearby, until you add some.` : it.web ? 'Shows credited web photos until you add your own.' : 'No photos or clips yet.'}</p>` : '';
  return `<div class="maprow__media">${media}${empty}<button type="button" class="mapmedia mapmedia--add" data-map-add>+ Add photos or clips</button></div>`;
}
const posText = (s) => (s && Number.isFinite(s.lat) ? `${s.lat}, ${s.lon}` : '');
const regionOptions = (sel) => allRegions().map((r) => `<option value="${esc(r.id)}"${r.id === sel ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
// a region's own details: what Explore shows for it, its colour on the map, and the place its tour starts from
function regionPanel(r, list) {
  const starts = list.some((it) => it.id === r.hub) ? r.hub : list[0]?.id;
  return `<div class="region${r.custom ? ' region--custom' : ''}" data-region-id="${esc(r.id)}">
    <div class="region__fields">
      <label class="field field--small">Region name<input data-rf="name" maxlength="60" value="${esc(r.name)}" /></label>
      <label class="field field--small region__color">Colour on the map<input data-rf="color" type="color" value="${esc(r.color || '#a9c47f')}" /></label>
      <label class="field field--small">Its tour starts at<select data-rf="hub"${list.length ? '' : ' disabled'}>${list.map((it) => `<option value="${esc(it.id)}"${it.id === starts ? ' selected' : ''}>${esc(it.name)}</option>`).join('')}</select></label>
      <label class="field field--small region__about">About the region (shown in Explore)<input data-rf="blurb" maxlength="240" value="${esc(r.blurb || '')}" /></label>
      <label class="switch"><input type="checkbox" data-rf="show"${r.hidden ? '' : ' checked'} /><span>Show in Explore</span></label>
    </div>
    <div class="region__acts">
      ${r.changed ? '<button type="button" class="link" data-region-reset>Back to the original</button>' : ''}
      ${r.custom ? '<button type="button" class="link link--danger" data-region-delete>Delete this region</button>' : ''}
    </div>
  </div>`;
}
function mapRow(it) {
  // a place the portal added to a region: all of it can change
  if (it.custom && it.kind === 'place') {
    const straight = it.s.roads?.some((r) => r.straight);
    return `<article class="maprow maprow--custom" data-map="place" data-id="${esc(it.id)}">
      <div class="maprow__fields">
        <label class="field field--small">Name<input data-sf="name" maxlength="60" value="${esc(it.s.name)}" /></label>
        <label class="field field--small">Where (Google Maps link or coordinates)<input data-sf="pos" value="${esc(posText(it.s))}" /></label>
        <label class="field field--small">Region<select data-sf="region">${regionOptions(it.s.region)}</select></label>
        <label class="field field--small">About it<input data-sf="note" maxlength="200" value="${esc(it.s.note || '')}" /></label>
        <label class="switch"><input type="checkbox" data-sf="addon"${it.s.addon ? ' checked' : ''} /><span>A paid extra, not in a trip price</span></label>
        <button type="button" class="link link--danger" data-place-delete>Delete this place</button>
      </div>
      ${straight ? '<p class="maprow__warn">The road to it couldn\'t be looked up, so the map draws a straight line there for now. Change its position (or paste it again) to try again.</p>' : ''}
      ${mapMedia(it)}</article>`;
  }
  const head = it.custom
    ? `<div class="maprow__fields">
        <label class="field field--small">Name<input data-sf="name" maxlength="60" value="${esc(it.s.name)}" /></label>
        <label class="field field--small">Time<input data-sf="when" maxlength="60" value="${esc(it.s.when || '')}" placeholder="e.g. 10:30" /></label>
        <label class="field field--small">Where (Google Maps link or coordinates)<input data-sf="pos" value="${esc(posText(it.s))}" /></label>
        <label class="field field--small">Note<input data-sf="note" maxlength="160" value="${esc(it.s.note || '')}" /></label>
        <button type="button" class="link link--danger" data-stop-delete>Delete this stopover</button>
      </div>`
    : `<div class="maprow__head"><b>${esc(it.name)}</b>${it.changed ? ' <span class="pill">Changed</span>' : ''}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}
        ${it.changed ? '<button type="button" class="link" data-map-reset>Back to the original</button>' : ''}</div>`;
  return `<article class="maprow${it.custom ? ' maprow--custom' : ''}" data-map="${it.kind}" data-id="${esc(it.id)}">${head}${mapMedia(it)}</article>`;
}
function renderMap() {
  const { stops, regions } = mapItems();
  $('#mapList').innerHTML = stops.map(({ t, list }) => `<section class="group">
      <h3>${esc(t.label)}: stopovers on the drive</h3>
      <p class="group__hint">They pop up, with their photos, as the trip's drive passes them on the map.</p>
      <div class="maprows">${list.map(mapRow).join('') || '<p class="empty">No stopovers on this trip yet.</p>'}</div>
      <form class="panel stop-add" data-trip="${esc(t.id)}">
        <h3>Add a stopover to ${esc(t.label)}</h3>
        <div class="stop-add__fields">
          <label class="field">Name<input name="name" maxlength="60" required placeholder="e.g. HornBill Bush Lodge" /></label>
          <label class="field">Time<input name="when" maxlength="60" placeholder="e.g. Day 01, 12:30" /></label>
          <label class="field">Where<input name="pos" required placeholder="Paste a Google Maps link, or 0.1047, 32.4744" /></label>
          <label class="field">Note<input name="note" maxlength="160" placeholder="What happens here" /></label>
        </div>
        <p class="panel__hint">In Google Maps, press and hold on the spot: the coordinates appear at the top. Copy them, or share the place and paste its link.</p>
        <button class="btn btn--primary" type="submit">Add stopover</button>
      </form>
    </section>`).join('')
    + regions.map(({ r, list }) => `<section class="group">
      <h3><i class="region__dot" style="background:${esc(r.color || '#a9c47f')}"></i>${esc(r.name)}${r.custom ? ' <span class="pill">Added here</span>' : r.changed ? ' <span class="pill">Changed</span>' : ''}</h3>
      <p class="group__hint">A region on the map. "Explore" tours all its places; each place's photos and clips show on the map's cards, and "Build your own" drives to them on the roads.</p>
      ${regionPanel(r, list)}
      <div class="maprows">${list.map(mapRow).join('') || '<p class="empty">No places in this region yet.</p>'}</div>
      <form class="panel place-add" data-region="${esc(r.id)}">
        <h3>Add a place to ${esc(r.name)}</h3>
        <div class="stop-add__fields">
          <label class="field">Name<input name="name" maxlength="60" required placeholder="e.g. Sipi Falls" /></label>
          <label class="field">Where<input name="pos" required placeholder="Paste a Google Maps link, or 0.6468, 30.2685" /></label>
          <label class="field">About it<input name="note" maxlength="200" placeholder="One line: what you see or do there" /></label>
        </div>
        <label class="switch"><input type="checkbox" name="addon" /><span>A paid extra, not in a trip price</span></label>
        <p class="panel__hint">The map finds the roads to it from the places around it. Next you can add its photos and clips.</p>
        <button class="btn btn--primary" type="submit">Add place</button>
      </form>
    </section>`).join('')
    + `<section class="group">
      <h3>Add a region</h3>
      <p class="group__hint">A new destination on the map, such as Bwindi or Mount Elgon. It's made with its first place; add more places to it afterwards.</p>
      <form class="panel region-add">
        <div class="stop-add__fields">
          <label class="field">Region name<input name="rname" maxlength="60" required placeholder="e.g. Bwindi & Lake Bunyonyi" /></label>
          <label class="field">About the region<input name="blurb" maxlength="240" placeholder="One or two lines for Explore" /></label>
          <label class="field region__color">Colour on the map<input name="color" type="color" value="#7fb8c4" /></label>
        </div>
        <h3>Its first place</h3>
        <div class="stop-add__fields">
          <label class="field">Name<input name="name" maxlength="60" required placeholder="e.g. Buhoma gate" /></label>
          <label class="field">Where<input name="pos" required placeholder="Paste a Google Maps link, or -0.9939, 29.6158" /></label>
          <label class="field">About it<input name="note" maxlength="200" placeholder="One line: what you see or do there" /></label>
        </div>
        <label class="switch"><input type="checkbox" name="addon" /><span>A paid extra, not in a trip price</span></label>
        <p class="panel__hint">In Google Maps, press and hold on the spot: the coordinates appear at the top. Copy them, or share the place and paste its link. The region's tour starts from this place.</p>
        <button class="btn btn--primary" type="submit">Add region</button>
      </form>
    </section>`;
}
// a point from a Google Maps link (…/@lat,lon,… or …!3dlat!4dlon…) or typed coordinates ("0.1047, 32.4744")
function parsePos(text) {
  const t = String(text).trim();
  const m = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
    || t.match(/q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || t.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  return m ? { lat: +m[1], lon: +m[2] } : null;
}
const saveMapList = (it, list) => api('PUT', `/admin/map/${it.kind === 'place' ? 'places' : 'stopovers'}/${encodeURIComponent(it.id)}`, { photos: list });

$('#mapList').addEventListener('click', async (e) => {
  const reg = e.target.closest('[data-region-id]');
  if (reg && e.target.closest('[data-region-reset]')) {
    await attempt(async () => { await api('DELETE', `/admin/map/regions/${encodeURIComponent(reg.dataset.regionId)}`); await refresh(); renderAll(); }, 'Back to the original');
    return;
  }
  if (reg && e.target.closest('[data-region-delete]')) {
    const r = allRegions().find((x) => x.id === reg.dataset.regionId);
    const n = Object.values(site.map?.places || {}).filter((p) => p.custom && p.region === r.id).length;
    if (!confirm(`Delete the region "${r.name}"${n ? ` and its ${n} place${n === 1 ? '' : 's'}` : ''} from the map? Their photos stay in the album.`)) return;
    await attempt(async () => { await api('DELETE', `/admin/map/regions/${encodeURIComponent(r.id)}`); await refresh(); renderAll(); }, 'Region deleted');
    return;
  }
  const row = e.target.closest('[data-map]');
  if (!row) return;
  const it = mapItem(row.dataset.map, row.dataset.id);
  if (!it) return;
  const mm = e.target.closest('[data-mm]');
  if (mm) {
    const k = mm.closest('[data-k]').dataset.k, list = [...it.list], i = list.indexOf(k);
    if (mm.dataset.mm === 'remove') list.splice(i, 1); else if (i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    await attempt(async () => { await saveMapList(it, list); await refresh(); renderAll(); }, mm.dataset.mm === 'remove' ? 'Taken off' : 'Moved');
  } else if (e.target.closest('[data-map-add]')) {
    openMapPicker(it);
  } else if (e.target.closest('[data-map-reset]')) {
    await attempt(async () => { await api('DELETE', `/admin/map/${it.kind === 'place' ? 'places' : 'stopovers'}/${encodeURIComponent(it.id)}`); await refresh(); renderAll(); }, 'Back to the original');
  } else if (e.target.closest('[data-stop-delete]')) {
    if (!confirm(`Delete the stopover "${it.name}"?`)) return;
    await attempt(async () => { await api('DELETE', `/admin/map/stopovers/${encodeURIComponent(it.id)}`); await refresh(); renderAll(); }, 'Stopover deleted');
  } else if (e.target.closest('[data-place-delete]')) {
    if (!confirm(`Delete the place "${it.name}" from the map? Its photos stay in the album.`)) return;
    await attempt(async () => { await api('DELETE', `/admin/map/places/${encodeURIComponent(it.id)}`); await refresh(); renderAll(); }, 'Place deleted');
  }
});
const BAD_POS = 'That isn\'t a Google Maps link or coordinates. Try "0.1047, 32.4744".';
const ROAD_NOTE = ' The road to it couldn\'t be looked up just now, so the map draws a straight line there; change its position later to try again.';
$('#mapList').addEventListener('change', async (e) => {
  const rf = e.target.closest('[data-rf]');
  if (rf) {
    const id = rf.closest('[data-region-id]').dataset.regionId;
    const body = rf.dataset.rf === 'show' ? { hidden: !rf.checked } : { [rf.dataset.rf]: rf.value };
    await attempt(async () => { await api('PUT', `/admin/map/regions/${encodeURIComponent(id)}`, body); await refresh(); renderAll(); }, 'Saved');
    return;
  }
  const input = e.target.closest('[data-sf]');
  if (!input) return;
  const row = input.closest('[data-map]');
  const kind = row.dataset.map === 'place' ? 'places' : 'stopovers';
  let body = { [input.dataset.sf]: input.type === 'checkbox' ? input.checked : input.value };
  if (input.dataset.sf === 'pos') {
    const p = parsePos(input.value);
    if (!p) { toast(BAD_POS, 'error'); return; }
    body = p;
  }
  let res;
  const moved = kind === 'places' && (input.dataset.sf === 'pos' || input.dataset.sf === 'region');
  if (moved) toast('Finding the roads to it…');
  const ok = await attempt(async () => { res = await api('PUT', `/admin/map/${kind}/${encodeURIComponent(row.dataset.id)}`, body); await refresh(); renderAll(); }, 'Saved');
  if (ok && res?.straight && moved) toast(`Saved.${ROAD_NOTE}`, 'error');
});
$('#mapList').addEventListener('submit', async (e) => {
  const rf = e.target.closest('.region-add');
  if (rf) {
    e.preventDefault();
    const p = parsePos(rf.pos.value);
    if (!p) { toast(BAD_POS, 'error'); return; }
    const btn = rf.querySelector('[type="submit"]');
    btn.disabled = true;
    toast('Finding the roads to it…');
    let res;
    const ok = await attempt(async () => {
      res = await api('POST', '/admin/map/regions', {
        name: rf.rname.value, blurb: rf.blurb.value, color: rf.color.value,
        place: { name: rf.name.value, note: rf.note.value, addon: rf.addon.checked, ...p },
      });
      await refresh();
      renderAll();
    }, `${rf.rname.value} is on the map. Now add photos of ${rf.name.value}, then more places to the region.`);
    btn.disabled = false;
    if (!ok || !res?.place) return;
    if (res.straight) toast(`${rf.rname.value} is on the map.${ROAD_NOTE}`, 'error');
    const it = mapItem('place', res.place);
    if (it) openMapPicker(it);
    return;
  }
  const f = e.target.closest('.stop-add, .place-add');
  if (!f) return;
  e.preventDefault();
  const p = parsePos(f.pos.value);
  if (!p) { toast(BAD_POS, 'error'); return; }
  const btn = f.querySelector('[type="submit"]');
  btn.disabled = true;
  let res;
  const isPlace = f.classList.contains('place-add');
  if (isPlace) toast('Finding the roads to it…');
  const ok = await attempt(async () => {
    res = isPlace
      ? await api('POST', '/admin/map/places', { region: f.dataset.region, name: f.name.value, note: f.note.value, addon: f.addon.checked, ...p })
      : await api('POST', '/admin/map/stopovers', { trip: f.dataset.trip, name: f.name.value, when: f.when.value, note: f.note.value, ...p });
    await refresh();
    renderAll();
  }, isPlace ? `${f.name.value} is on the map. Now add its photos and clips.` : `Stopover added to ${tripLabel(f.dataset.trip)}. Now add its photos and clips.`);
  btn.disabled = false;
  if (!ok || !res?.id) return;
  if (res.straight) toast(`${f.name.value} is on the map.${ROAD_NOTE}`, 'error');
  // straight on to its photos: pick from the album, or upload new ones from the picker
  const it = mapItem(isPlace ? 'place' : 'stop', res.id);
  if (it) openMapPicker(it);
});

// ---------------------------------------------------------------- put on the page
// From any photo or clip: choose a spot (it replaces what's there) or a map place / stopover (added to it)
const where = $('#where');
let whereKey = null;
function openWhere(key) {
  whereKey = key;
  $('#whereSearch').value = '';
  renderWhere();
  where.showModal();
  $('#whereSearch').focus();
}
function renderWhere() {
  const clip = clipKey(whereKey);
  const q = $('#whereSearch').value.trim().toLowerCase();
  const match = (label) => !q || label.toLowerCase().includes(q);
  const spotRows = slots.filter((s) => (s.kind === 'video') === clip && match(`${s.group} ${s.label}`)).map((s) => {
    const now = slotValue(s), here = now === whereKey;
    return `<button type="button" class="where__row${here ? ' is-here' : ''}" data-where="spot" data-id="${esc(s.id)}"${here ? ' disabled' : ''}>
      <img src="${thumb(s, now)}" alt="" loading="lazy" /><span><b>${esc(s.label)}</b><small>${esc(s.group)}</small></span><em>${here ? 'There now' : 'Put here'}</em></button>`;
  });
  const { all } = mapItems();
  const mapRows = all.filter((it) => match(`${it.name} map`)).map((it) => {
    const has = it.list.includes(whereKey);
    return `<button type="button" class="where__row${has ? ' is-here' : ''}" data-where="${it.kind}" data-id="${esc(it.id)}"${has ? ' disabled' : ''}>
      ${it.list[0] ? `<img src="${stillOf(it.list[0])}" alt="" loading="lazy" />` : '<span class="where__none"></span>'}<span><b>${esc(it.name)}</b><small>Map${it.kind === 'stop' ? ': stopover' : ''}</small></span><em>${has ? 'Added' : 'Add'}</em></button>`;
  });
  $('#whereList').innerHTML = (spotRows.length ? `<h4>Spots on the page</h4>${spotRows.join('')}` : '')
    + (mapRows.length ? `<h4>On the map</h4>${mapRows.join('')}` : '') || '<p class="empty">Nothing matches.</p>';
}
$('#whereSearch').addEventListener('input', renderWhere);
$('#whereList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-where]');
  if (!b) return;
  const { where: kind, id } = b.dataset;
  await attempt(async () => {
    if (kind === 'spot') {
      const s = slots.find((x) => x.id === id);
      await api('PUT', `/admin/slots/${s.id}`, { [s.kind === 'video' ? 'video' : 'photo']: whereKey });
    } else {
      const it = mapItem(kind, id);
      await saveMapList(it, [...it.list, whereKey]);
    }
    await refresh();
    renderWhere();
    renderAll();
  }, 'Done. Preview the website to see it there.');
});
where.addEventListener('click', (e) => { if (e.target === where || e.target.closest('[data-close]')) where.close(); });

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
  if (f.kind === 'rates') {
    const rows = parseRates(value);
    const row = (r = { people: '', price: '' }) => `<div class="rate" data-rate-row>
        <label class="field field--small">Travellers<input data-rate="people" maxlength="20" value="${esc(r.people)}" placeholder="e.g. 2, 3–4 or 5+" /></label>
        <label class="field field--small">Price per person<input data-rate="price" maxlength="40" value="${esc(r.price)}" placeholder="e.g. USD 650" /></label>
        <button type="button" class="link link--danger" data-rate-remove aria-label="Remove this price">Remove</button>
      </div>`;
    return `<div class="word word--rates" data-word="${esc(f.id)}" data-rates>
      <span class="field">${label}</span>
      <div class="rates">${rows.map(row).join('')}${rows.length ? '' : row()}</div>
      <button type="button" class="btn" data-rate-add>+ Add a price</button>${hint}${reset}
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
// a price list: its rows as one line ("2|USD 650;3–4|USD 520"); the separators can't be typed into a row
const ratesOf = (box) => ratesText([...box.querySelectorAll('[data-rate-row]')].map((r) => {
  const v = (k) => r.querySelector(`[data-rate="${k}"]`).value.replace(/[|;]/g, ' ').replace(/\s+/g, ' ').trim();
  return { people: v('people'), price: v('price') };
}).filter((r) => r.people && r.price));
async function saveWord(f, value) {
  await attempt(async () => {
    if (value === f.def) await api('DELETE', `/admin/text/${f.id}`);
    else await api('PUT', `/admin/text/${f.id}`, { value });
    await refresh();
    renderAll();
  }, 'Saved');
}
$('#words').addEventListener('change', async (e) => {
  const box = e.target.closest('[data-rates]');
  if (box && e.target.closest('[data-rate]')) {
    const row = e.target.closest('[data-rate-row]');
    const filled = [...row.querySelectorAll('[data-rate]')].every((i) => i.value.trim());
    // a half-filled row waits for its other half; an emptied one is taken off
    if (!filled && [...row.querySelectorAll('[data-rate]')].some((i) => i.value.trim())) return;
    return saveWord(fields.find((x) => x.id === box.dataset.word), ratesOf(box));
  }
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
  const box = e.target.closest('[data-rates]');
  if (box && e.target.closest('[data-rate-add]')) {
    const rows = box.querySelector('.rates');
    const blank = rows.querySelector('[data-rate-row]:last-child');
    const row = blank.cloneNode(true);
    row.querySelectorAll('input').forEach((i) => { i.value = ''; });
    rows.appendChild(row);
    row.querySelector('input').focus();
    return;
  }
  if (box && e.target.closest('[data-rate-remove]')) {
    const row = e.target.closest('[data-rate-row]');
    const had = [...row.querySelectorAll('[data-rate]')].every((i) => i.value.trim());
    if (box.querySelectorAll('[data-rate-row]').length > 1) row.remove(); else row.querySelectorAll('input').forEach((i) => { i.value = ''; });
    if (had) saveWord(fields.find((x) => x.id === box.dataset.word), ratesOf(box));
    return;
  }
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
