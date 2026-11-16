// Hineni server: serves the built site, the admin portal (/admin) and its API.
//
//   GET  /api/site                 the live changes the site applies at start-up (public);
//                                  ?preview=1 from a signed-in admin returns the unpublished draft instead
//   POST /api/login, /api/logout   admin sign-in (HttpOnly session cookie)
//   /api/admin/*                   photos, clips, words, spots, trips, team and history (signed-in admins only)
//   /uploads/*                     uploaded photos (900/1600/2000/2800 px webp) and clips (+ a poster)
//   /media/*                       the site's own photos and clips (from DATA_DIR/media, else the build)
//   GET  /api/health               for the host's health check
//
// Admins work on a draft (draft.json). Visitors only ever see the published version (site.json); Publish
// copies the draft over it, keeping the version it replaces in history/. Everything lives in DATA_DIR:
// site.json, draft.json, the uploads, the admin accounts and the history. On Railway that's the service's
// volume (RAILWAY_VOLUME_MOUNT_PATH), which also holds the site's own media (pushed there with
// `npm run push-media`, so deploys stay small); elsewhere ./storage. Back that folder up; nothing else changes.
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { loadAdmins, verifyPassword, ensureBootstrapAdmin, setAdmin, removeAdmin, validName } from './admins.mjs';
import { canConvert, toWeb, frame, oneAtATime } from './video.mjs';
import { SITE_URL, seoHead, seoBody, robots, sitemap } from './seo.mjs';
import { roadsFor } from './roads.mjs';
import { places as mapPlaces, regions as mapRegions } from '../src/data/content.js';

const ROOT = path.resolve(import.meta.dirname, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env: use the real environment */ }

const ON_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT_NAME;
const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const DATA = path.resolve(ROOT, process.env.DATA_DIR || VOLUME || 'storage');
// on Railway, anything outside the volume is wiped by the next deploy
const EPHEMERAL = ON_RAILWAY && !(VOLUME && (DATA + path.sep).startsWith(path.resolve(VOLUME) + path.sep));
if (EPHEMERAL) console.error('WARNING: no Railway volume behind DATA_DIR. Uploads and admin accounts will be lost on the next deploy.');
const UPLOADS = path.join(DATA, 'uploads');
const MEDIA = path.join(DATA, 'media');
const HISTORY = path.join(DATA, 'history');
const TMP = path.join(DATA, 'tmp');
const SITE_FILE = path.join(DATA, 'site.json');
const DRAFT_FILE = path.join(DATA, 'draft.json');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8787;
const SIZES = [900, 1600, 2000, 2800];
const SESSION_HOURS = 12;
const TYPES = ['wildlife', 'land', 'people'];
const CLIP_MB = 250;

// sharp's cache keeps files open, and Windows won't delete an open file
sharp.cache(false);
// clean-up of upload files is best-effort: a leftover file is harmless, a crash isn't
const filesOf = (key) => [...SIZES.map((w) => `${key}-${w}.webp`), `${key}.mp4`, `${key}-sm.mp4`, `${key}.webm`, `${key}-poster.webp`];
const removeFiles = (key) => Promise.all(filesOf(key).map((f) => fsp.rm(path.join(UPLOADS, f), { force: true })))
  .catch((e) => console.warn(`[files] couldn't remove all of ${key}: ${e.code || e.message}`));

for (const dir of [UPLOADS, HISTORY, MEDIA, TMP]) fs.mkdirSync(dir, { recursive: true });
await ensureBootstrapAdmin(DATA);

// photos and clips that ship with the site (built by tools/build-media.mjs)
const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/media.json'), 'utf8'));
const builtIn = shipped.photos;
const builtInVideos = shipped.videos || {};
const builtInTrips = ['moyo', 'murchison', 'reptiles', 'fortportal'];

// ---------------------------------------------------------------- the published site and the draft
// replaced: old photo or clip key -> the one that now shows wherever it did (src/lib/site.js applies it)
// map: { regions: { <region id>: { name, blurb, color, hub, hidden, and custom for the portal's own } },
//        places: { <place id>: { photos, name, note, addon, hidden, and for the portal's own: custom, region, lat, lon, roads } },
//        stopovers: { <trip or region>~<name>: { photos, and for the portal's own:
// custom, trip (a trip's drive) or region (that region's drive from Kampala), name, lat, lon, when, note } } },
// where photos lists photo and clip keys in order
const emptySite = () => ({ version: 1, updated: 0, trips: {}, photos: {}, edits: {}, hidden: [], slots: {}, videos: {}, text: {}, replaced: {}, map: { places: {}, stopovers: {} } });
const readSite = (file) => (fs.existsSync(file) ? { ...emptySite(), ...JSON.parse(fs.readFileSync(file, 'utf8')) } : null);
const copy = (o) => structuredClone(o);
let site = readSite(SITE_FILE) || emptySite(); // what visitors see
let draft = readSite(DRAFT_FILE) || copy(site); // what admins are editing
// the draft differs from the live site in anything but its time stamps
const content = ({ updated, by, ...rest }) => JSON.stringify(rest);
const pending = () => content(draft) !== content(site);

// one write at a time, through a temporary file so a crash never leaves half a file
let writing = Promise.resolve();
const writeJSON = (file, data) => {
  const text = JSON.stringify(data, null, 2);
  writing = writing.then(async () => {
    await fsp.writeFile(`${file}.tmp`, text);
    await fsp.rename(`${file}.tmp`, file);
  });
  return writing;
};
function saveDraft(user) {
  draft.updated = Date.now();
  draft.by = user;
  return writeJSON(DRAFT_FILE, draft);
}
// publishing: the version it replaces goes to history/ first (the last 100 are kept). The first
// publish keeps the website as built, so there is always a way back to it.
async function publish(user) {
  await writing;
  await fsp.writeFile(path.join(HISTORY, `site-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(site, null, 2));
  const old = (await fsp.readdir(HISTORY)).filter((f) => f.endsWith('.json')).sort();
  await Promise.all(old.slice(0, Math.max(0, old.length - 100)).map((f) => fsp.rm(path.join(HISTORY, f))));
  const before = site;
  site = copy(draft);
  site.updated = Date.now();
  site.by = user;
  await writeJSON(SITE_FILE, site);
  draft.updated = site.updated;
  await saveDraft(user);
  // files of uploads deleted in the draft go once the live site no longer shows them
  for (const kind of ['photos', 'videos']) {
    for (const key of Object.keys(before[kind] || {})) if (!site[kind][key] && !draft[kind][key]) await removeFiles(key);
  }
}

const tripIds = () => [...builtInTrips, ...Object.keys(draft.trips).filter((id) => !builtInTrips.includes(id))];
const isPhoto = (key) => typeof key === 'string' && (key in builtIn || key in draft.photos);
const isVideo = (key) => typeof key === 'string' && (key in builtInVideos || key in draft.videos);
// captions and words end up in the page's HTML: plain text only, one line, sensible length.
// Straight double quotes become curly ones, so words can never close an HTML attribute.
const clean = (v, max = 160) => String(v ?? '').replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/"/g, '”').slice(0, max);
const usedInSpots = (key) => Object.values(draft.slots).some((s) => s.photo === key || s.video === key);
// a photo or clip replaced by another: what shows in its place now (following a chain of replacements)
const current = (key) => { for (let i = 0; i < 20 && draft.replaced[key]; i++) key = draft.replaced[key]; return key; };

// ---------------------------------------------------------------- sessions and sign-in
// sessions survive restarts and redeploys; only a hash of each token is stored
const SESSIONS_FILE = path.join(DATA, 'sessions.json');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('base64url');
const sessions = new Map(Object.entries((() => { try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')); } catch { return {}; } })()));
const saveSessions = () => {
  for (const [k, s] of sessions) if (s.expires < Date.now()) sessions.delete(k);
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 });
};
const failures = new Map(); // ip -> { count, until }

function readCookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function sessionOf(req) {
  const token = readCookie(req, 'hn_admin');
  const s = token && sessions.get(hashToken(token));
  if (!s) return null;
  // expired, or the account was removed since signing in
  if (s.expires < Date.now() || !loadAdmins(DATA).some((a) => a.user === s.user)) { sessions.delete(hashToken(token)); saveSessions(); return null; }
  return s;
}
function setCookie(req, res, value, maxAge) {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `hn_admin=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

// Signed-in admins only. Changes also need the custom header, which another site's page can't send
// (no CORS here), on top of the SameSite=Strict cookie: belt and braces against cross-site requests.
function requireAdmin(req, res, next) {
  const s = sessionOf(req);
  if (!s) return res.status(401).json({ error: 'Please sign in again.' });
  if (req.method !== 'GET' && req.get('x-hineni-admin') !== '1') return res.status(403).json({ error: 'Blocked request.' });
  req.admin = s.user;
  next();
}

// ---------------------------------------------------------------- app
const app = express();
app.disable('x-powered-by');
// behind Railway's edge (or another HTTPS proxy): trust it for the visitor's IP and https, so sign-in
// cookies are marked Secure and the sign-in rate limit counts real visitors
const proxy = process.env.TRUST_PROXY || (ON_RAILWAY ? '1' : '');
if (proxy) app.set('trust proxy', Number(proxy) || proxy);

// one address for search engines: www. goes to the bare domain (once its DNS points here)
app.use((req, res, next) => (req.hostname?.startsWith('www.') ? res.redirect(301, SITE_URL + req.originalUrl) : next()));
// the API's JSON is for the page and the portal, not for search results
app.use('/api', (req, res, next) => { res.set('X-Robots-Tag', 'noindex'); next(); });
app.get('/robots.txt', (req, res) => res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(robots()));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemap(site, builtIn)));
app.get('/api/health', (req, res) => res.json({ ok: true, persistent: !EPHEMERAL }));
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { req.body ??= {}; next(); });

app.get('/api/site', (req, res) => {
  // a signed-in admin previewing sees the draft; everyone else, the published site
  if (req.query.preview && sessionOf(req)) {
    res.set('Cache-Control', 'no-store');
    const { by, ...d } = draft;
    return res.json({ ...d, preview: true });
  }
  res.set('Cache-Control', 'no-cache');
  const { by, ...pub } = site;
  res.json(pub);
});

app.post('/api/login', async (req, res) => {
  const ip = req.ip;
  const f = failures.get(ip);
  if (f && f.until > Date.now()) {
    return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} min.` });
  }
  const user = clean(req.body?.user, 64).toLowerCase();
  const password = String(req.body?.password ?? '');
  const admin = loadAdmins(DATA).find((a) => a.user === user);
  const ok = await verifyPassword(password, admin);
  if (!ok) {
    const count = (f && f.until > Date.now() - 15 * 60000 ? f.count : 0) + 1;
    failures.set(ip, { count, until: count >= 5 ? Date.now() + 15 * 60000 : 0 });
    await new Promise((r) => setTimeout(r, 400));
    return res.status(401).json({ error: 'That email and password don\'t match.' });
  }
  failures.delete(ip);
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(hashToken(token), { user: admin.user, expires: Date.now() + SESSION_HOURS * 3600e3 });
  saveSessions();
  setCookie(req, res, token, SESSION_HOURS * 3600);
  res.json({ user: admin.user, ...(EPHEMERAL && { warning: 'This server has no Railway volume attached: photos you upload now will disappear at the next deploy. Attach a volume at /data before uploading.' }) });
});

app.post('/api/logout', (req, res) => {
  const token = readCookie(req, 'hn_admin');
  if (token) { sessions.delete(hashToken(token)); saveSessions(); }
  setCookie(req, res, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const s = sessionOf(req);
  res.set('Cache-Control', 'no-store');
  if (!s) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user: s.user, ...(EPHEMERAL && { warning: 'This server has no Railway volume attached: photos you upload now will disappear at the next deploy. Attach a volume at /data before uploading.' }) });
});

const admin = express.Router();
admin.use(requireAdmin);
app.use('/api/admin', admin);

// the draft, plus whether it differs from what's live
admin.get('/site', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ...draft, pending: pending(), live: { updated: site.updated, by: site.by } });
});

// ---- publish / discard the draft
admin.post('/publish', async (req, res) => {
  if (!pending()) return res.json({ ok: true, nothing: true });
  await publish(req.admin);
  res.json({ ok: true });
});
admin.post('/discard', async (req, res) => {
  const before = draft;
  draft = copy(site);
  await saveDraft(req.admin);
  // uploads that only the discarded draft had
  for (const kind of ['photos', 'videos']) {
    for (const key of Object.keys(before[kind] || {})) if (!site[kind][key]) await removeFiles(key);
  }
  res.json({ ok: true });
});

// ---- photo upload: one photo per request (the portal sends them one by one, with progress)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024, files: 1, fields: 10 } });

// When the photo was taken: the camera's own clock (EXIF), read as Uganda time unless the photo
// says otherwise; else the file's date from the admin's device; else now.
function takenAt(meta, fallback) {
  try {
    const exif = meta.exif && exifReader(meta.exif);
    const d = exif?.Photo?.DateTimeOriginal || exif?.Image?.DateTime;
    if (d instanceof Date && !Number.isNaN(+d)) {
      const off = String(exif?.Photo?.OffsetTimeOriginal || '+03:00').match(/([+-])(\d\d):?(\d\d)/);
      const mins = off ? (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) : 180;
      return +d - mins * 60000;
    }
  } catch { /* unreadable EXIF: fall through */ }
  const f = Number(fallback);
  return f > 0 && f <= Date.now() + 864e5 ? f : Date.now();
}
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'photo';

admin.post('/photos', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is over 40 MB.' : 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No photo received.' });
    const trip = req.body.trip;
    const type = TYPES.includes(req.body.type) ? req.body.type : 'people';
    if (!tripIds().includes(trip)) return res.status(400).json({ error: 'Choose which trip these photos are from.' });

    let meta;
    try {
      meta = await sharp(req.file.buffer).metadata();
    } catch {
      return res.status(400).json({ error: 'That file isn\'t a photo we can read.' });
    }
    if (meta.format === 'heif') {
      return res.status(400).json({ error: 'HEIC photos aren\'t supported yet. On an iPhone, upload from the browser (it converts them), or export as JPEG.' });
    }
    if (!['jpeg', 'png', 'webp', 'tiff', 'avif'].includes(meta.format)) return res.status(400).json({ error: `.${meta.format} files aren't supported. Use JPEG, PNG or WebP.` });
    const turned = (meta.orientation || 1) >= 5;
    const [w0, h0] = turned ? [meta.height, meta.width] : [meta.width, meta.height];
    if (Math.max(w0, h0) < 1000) return res.status(400).json({ error: `That photo is only ${w0}×${h0} px. Use the original (at least 1000 px), not a thumbnail.` });

    const name = clean(req.body.name || req.file.originalname, 80).replace(/\.[a-z0-9]+$/i, '');
    const key = `u-${slug(/^(img|dsc|pxl|photo|image)[-_ ]?\d/i.test(name) ? trip : name)}-${crypto.randomBytes(3).toString('hex')}`;
    try {
      // rotate() applies the camera's orientation; re-encoding drops all metadata (GPS included)
      let dims = null;
      for (const width of SIZES) {
        const info = await sharp(req.file.buffer).rotate().resize({ width, withoutEnlargement: true })
          .webp({ quality: width <= 900 ? 78 : 82 }).toFile(path.join(UPLOADS, `${key}-${width}.webp`));
        if (width === 2000 || !dims) dims = { w: info.width, h: info.height };
      }
      const photo = { key, alt: '', trip, type, w: dims.w, h: dims.h, t: takenAt(meta, req.body.lastModified), up: 1, added: Date.now(), by: req.admin };
      draft.photos[key] = photo;
      await saveDraft(req.admin);
      res.json({ photo });
    } catch (e) {
      console.error('[upload]', e);
      await removeFiles(key);
      res.status(500).json({ error: 'Couldn\'t process that photo.' });
    }
  });
});

// caption, trip or type
admin.patch('/photos/:key', async (req, res) => {
  const { key } = req.params;
  if (!isPhoto(key)) return res.status(404).json({ error: 'No such photo.' });
  const change = {};
  if ('alt' in req.body) change.alt = clean(req.body.alt);
  if ('trip' in req.body) {
    if (!tripIds().includes(req.body.trip)) return res.status(400).json({ error: 'Unknown trip.' });
    change.trip = req.body.trip;
  }
  if ('type' in req.body) {
    if (!TYPES.includes(req.body.type)) return res.status(400).json({ error: 'Unknown type.' });
    change.type = req.body.type;
  }
  if (draft.photos[key]) Object.assign(draft.photos[key], change);
  else draft.edits[key] = { ...draft.edits[key], ...change };
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// remove from the website (album, grid and map) / put back
admin.post('/photos/:key/remove', async (req, res) => {
  const { key } = req.params;
  if (!isPhoto(key)) return res.status(404).json({ error: 'No such photo.' });
  // (the portal also checks the spots' original photos, which only the site's code knows)
  if (usedInSpots(key)) return res.status(409).json({ error: 'It\'s chosen for a spot on the page. Pick another photo there first.' });
  if (!draft.hidden.includes(key)) draft.hidden.push(key);
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// a newly uploaded photo takes an old one's place everywhere: its spots, the album and the map. The old
// one is removed (so "Put back" undoes it), and the new one sits where it did in the album.
admin.post('/photos/:key/replace', async (req, res) => {
  const { key } = req.params;
  const to = req.body.with;
  if (!isPhoto(key) || !draft.photos[to]) return res.status(404).json({ error: 'No such photo.' });
  if (key === to || current(to) === key) return res.status(400).json({ error: 'Choose a different photo.' });
  const old = draft.photos[key] || { ...builtIn[key], ...draft.edits[key] };
  if (old.t) draft.photos[to].t = old.t;
  draft.replaced[key] = to;
  if (!draft.hidden.includes(key)) draft.hidden.push(key);
  await saveDraft(req.admin);
  res.json({ ok: true });
});
admin.post('/photos/:key/restore', async (req, res) => {
  draft.hidden = draft.hidden.filter((k) => k !== req.params.key);
  delete draft.replaced[req.params.key]; // back in its own spots, too
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// an uploaded photo, removed first, can be deleted for good (photos that ship with the site can't).
// Its files go now if the live site never had it, else when the deletion is published.
admin.delete('/photos/:key', async (req, res) => {
  const { key } = req.params;
  if (!draft.photos[key]) return res.status(404).json({ error: 'Only uploaded photos can be deleted.' });
  if (!draft.hidden.includes(key)) return res.status(409).json({ error: 'Remove it from the website first.' });
  if (usedInSpots(key)) return res.status(409).json({ error: 'It\'s still chosen for a spot on the page.' });
  delete draft.photos[key];
  draft.hidden = draft.hidden.filter((k) => k !== key);
  await saveDraft(req.admin);
  if (!site.photos[key]) await removeFiles(key);
  res.json({ ok: true });
});

// ---- clips: one video per request. With ffmpeg (always on Railway), any phone or camera format is
// converted to H.264 MP4 plus a phone copy (server/video.mjs), and the poster is taken from it when the
// portal couldn't grab one in the browser. Without ffmpeg, only MP4/WebM are accepted, kept as they are.
const clipUpload = multer({ dest: TMP, limits: { fileSize: CLIP_MB * 1024 * 1024, files: 2, fields: 10 } });
const CLIP_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
const ANY_CLIP = /^video\/|\.(mp4|m4v|mov|webm|3gp|mkv|avi)$/i;
admin.post('/videos', (req, res) => {
  clipUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'poster', maxCount: 1 }])(req, res, async (err) => {
    const tmp = [...(req.files?.video || []), ...(req.files?.poster || [])].map((f) => f.path);
    const cleanup = () => Promise.all(tmp.map((p) => fsp.rm(p, { force: true })));
    if (err) { await cleanup(); return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `That clip is over ${CLIP_MB} MB. Export a shorter or smaller version.` : 'Upload failed.' }); }
    const video = req.files?.video?.[0];
    const poster = req.files?.poster?.[0];
    if (!video) { await cleanup(); return res.status(400).json({ error: 'No clip received.' }); }
    const convert = await canConvert();
    const ext = convert ? 'mp4' : CLIP_TYPES[video.mimetype];
    if (!ext || !(ANY_CLIP.test(video.mimetype) || ANY_CLIP.test(video.originalname))) { await cleanup(); return res.status(400).json({ error: 'That doesn\'t look like a video clip.' }); }
    if (!convert && !poster) { await cleanup(); return res.status(400).json({ error: 'No poster frame received.' }); }
    const title = clean(req.body.title || video.originalname, 80).replace(/\.[a-z0-9]+$/i, '');
    const key = `u-${slug(title || 'clip')}-${crypto.randomBytes(3).toString('hex')}`;
    try {
      const num = (v, max) => { const n = Number(v); return n > 0 && n < max ? Math.round(n * 10) / 10 : 0; };
      let size = { w: num(req.body.w, 10000), h: num(req.body.h, 10000), dur: num(req.body.dur, 36000) };
      if (convert) {
        try {
          size = await oneAtATime(() => toWeb(video.path, path.join(UPLOADS, key)));
        } catch (e) {
          console.error('[clip] conversion failed', e.log || e.message);
          await removeFiles(key);
          return res.status(400).json({ error: 'That clip couldn\'t be read. Try exporting it again from your phone or editing app.' });
        }
      } else {
        await fsp.rename(video.path, path.join(UPLOADS, `${key}.${ext}`));
      }
      const posterPng = path.join(TMP, `${key}-poster.png`);
      if (!poster) { await frame(path.join(UPLOADS, `${key}.mp4`), posterPng, size.dur); tmp.push(posterPng); }
      await sharp(poster ? poster.path : posterPng).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(UPLOADS, `${key}-poster.webp`));
      const clip = { key, title, ext, ...size, ...(convert && { web: 1, sm: 1 }), up: 1, added: Date.now(), by: req.admin };
      draft.videos[key] = clip;
      await saveDraft(req.admin);
      res.json({ video: clip });
    } catch (e) {
      console.error('[clip]', e);
      await removeFiles(key);
      res.status(500).json({ error: 'Couldn\'t save that clip.' });
    } finally {
      await cleanup();
    }
  });
});
admin.patch('/videos/:key', async (req, res) => {
  const clip = draft.videos[req.params.key];
  if (!clip) return res.status(404).json({ error: 'Only uploaded clips can be renamed.' });
  if ('title' in req.body) clip.title = clean(req.body.title, 80);
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// a newly uploaded clip plays wherever an old one did
admin.post('/videos/:key/replace', async (req, res) => {
  const { key } = req.params;
  const to = req.body.with;
  if (!isVideo(key) || !draft.videos[to]) return res.status(404).json({ error: 'No such clip.' });
  if (key === to || current(to) === key) return res.status(400).json({ error: 'Choose a different clip.' });
  draft.replaced[key] = to;
  await saveDraft(req.admin);
  res.json({ ok: true });
});
admin.post('/videos/:key/restore', async (req, res) => {
  delete draft.replaced[req.params.key];
  await saveDraft(req.admin);
  res.json({ ok: true });
});
admin.delete('/videos/:key', async (req, res) => {
  const { key } = req.params;
  if (!draft.videos[key]) return res.status(404).json({ error: 'Only uploaded clips can be deleted.' });
  if (usedInSpots(key)) return res.status(409).json({ error: 'It\'s still chosen for a spot on the page. Pick another clip there first.' });
  delete draft.videos[key];
  await saveDraft(req.admin);
  if (!site.videos[key]) await removeFiles(key);
  res.json({ ok: true });
});

// ---- the map: photos and clips for each place and stopover, and the portal's own stopovers
const MAP_TRIPS = ['murchison', 'fortportal', 'moyo'];
const mapOf = () => (draft.map ||= { places: {}, stopovers: {} });
const mediaList = (list) => {
  if (!Array.isArray(list) || list.length > 40) return null;
  const keys = [...new Set(list)];
  return keys.every((k) => isPhoto(k) || isVideo(k)) ? keys : null;
};
const mapId = /^[a-z0-9~-]{1,80}$/;
// places: the ones in the code (src/data/content.js) take a list of photos and clips; the portal can also add
// places of its own to a region (custom: name, note, region, position, paid extra), each with its road links
// to the places around it (server/roads.mjs), so the map can drive there
const regionsOf = () => (mapOf().regions ||= {});
const REGION_IDS = () => [...mapRegions.map((r) => r.id), ...Object.keys(regionsOf()).filter((id) => regionsOf()[id].custom)];
const allPlaces = (except) => [
  ...mapPlaces,
  ...Object.entries(mapOf().places).filter(([id, p]) => p.custom && id !== except).map(([id, p]) => ({ id, ...p })),
];
// The code's places can also be renamed, re-described, marked as a paid extra or not, and left off the map
// (their position stays: their road links are built with the site, tools/fetch-network.mjs).
const flag = (v) => (v === true || v === '1' || v === 1 ? 1 : 0);
function placeFrom(body, prev) {
  const next = { ...prev };
  if ('photos' in body) { const p = mediaList(body.photos); if (!p) throw new Error('Unknown photo or clip.'); next.photos = p; }
  if ('name' in body) next.name = clean(body.name, 60);
  if ('note' in body) next.note = clean(body.note, 200);
  if ('addon' in body) next.addon = flag(body.addon);
  if ('hidden' in body) next.hidden = flag(body.hidden);
  if (!next.custom) {
    if ('name' in next && !next.name) delete next.name; // an emptied name: back to the original one
    return next;
  }
  if ('region' in body) { if (!REGION_IDS().includes(body.region)) throw new Error('Choose a region.'); next.region = body.region; }
  if ('lat' in body || 'lon' in body) Object.assign(next, pointFrom(body));
  if (!next.name) throw new Error('Give the place a name.');
  return next;
}
admin.post('/map/places', async (req, res) => {
  let place;
  try { place = placeFrom(req.body, { custom: 1, photos: [] }); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (place.lat == null || !place.region) return res.status(400).json({ error: 'Give the place a region and a position on the map.' });
  const id = `c-${crypto.randomBytes(3).toString('hex')}`;
  place.roads = await roadsFor({ id, ...place }, allPlaces(id));
  mapOf().places[id] = place;
  await saveDraft(req.admin);
  res.json({ id, place, straight: place.roads.some((r) => r.straight) });
});
admin.put('/map/places/:id', async (req, res) => {
  const { id } = req.params;
  if (!mapId.test(id)) return res.status(400).json({ error: 'Unknown place.' });
  const prev = mapOf().places[id] || {};
  if (!prev.custom && !mapPlaces.some((p) => p.id === id)) return res.status(404).json({ error: 'Unknown place.' });
  let next;
  try { next = placeFrom(req.body, prev); } catch (e) { return res.status(400).json({ error: e.message }); }
  // moved, or into another region: new road links (and a retry if the last ones were straight stand-ins)
  if (next.custom && (next.lat !== prev.lat || next.lon !== prev.lon || next.region !== prev.region || next.roads?.some((r) => r.straight))) {
    next.roads = await roadsFor({ id, ...next }, allPlaces(id));
  }
  mapOf().places[id] = next;
  await saveDraft(req.admin);
  res.json({ ok: true, straight: !!next.roads?.some((r) => r.straight) });
});
// one of the portal's own: deleted; one in the code: back to how it ships (photos, wording, shown)
admin.delete('/map/places/:id', async (req, res) => {
  delete mapOf().places[req.params.id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// regions (the map's destinations, toured by "Explore"): the ones in the code can be renamed, described,
// recoloured, started from another of their places, or left out of Explore; the portal can add regions of its
// own, each made with its first place (a name and a point, like any place). Saved as map.regions:
// { <id>: { name, blurb, color, hub, hidden, and custom: 1 for the portal's own } }
function regionFrom(body, prev, id) {
  const next = { ...prev };
  if ('name' in body) next.name = clean(body.name, 60);
  if ('blurb' in body) next.blurb = clean(body.blurb, 240);
  if ('color' in body) {
    if (!/^#[0-9a-f]{6}$/i.test(String(body.color))) throw new Error('Choose a colour.');
    next.color = String(body.color).toLowerCase();
  }
  if ('hidden' in body) next.hidden = body.hidden === true || body.hidden === '1' ? 1 : 0;
  if ('hub' in body) {
    if (!allPlaces().some((p) => p.id === body.hub && p.region === id)) throw new Error('Choose one of the region\'s own places to start from.');
    next.hub = body.hub;
  }
  if ('name' in next && !next.name) throw new Error('Give the region a name.');
  return next;
}
admin.post('/map/regions', async (req, res) => {
  const id = `r-${crypto.randomBytes(3).toString('hex')}`;
  const pid = `c-${crypto.randomBytes(3).toString('hex')}`;
  let region, place;
  try {
    region = regionFrom(req.body, { custom: 1, color: '#a9c47f', blurb: '', hidden: 0 }, id);
    if (!region.name) throw new Error('Give the region a name.');
    const { region: _, photos: __, ...given } = req.body.place || {};
    place = placeFrom(given, { custom: 1, photos: [] });
    if (place.lat == null) throw new Error('Give its first place a position on the map.');
  } catch (e) { return res.status(400).json({ error: e.message }); }
  place.region = id;
  region.hub = pid;
  place.roads = await roadsFor({ id: pid, ...place }, allPlaces(pid));
  regionsOf()[id] = region;
  mapOf().places[pid] = place;
  await saveDraft(req.admin);
  res.json({ id, place: pid, straight: place.roads.some((r) => r.straight) });
});
admin.put('/map/regions/:id', async (req, res) => {
  const { id } = req.params;
  if (!mapId.test(id) || !REGION_IDS().includes(id)) return res.status(404).json({ error: 'Unknown region.' });
  try { regionsOf()[id] = regionFrom(req.body, regionsOf()[id] || {}, id); } catch (e) { return res.status(400).json({ error: e.message }); }
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// one of the portal's own: deleted with the places added to it (their photos stay in the album);
// one in the code: back to how it ships
admin.delete('/map/regions/:id', async (req, res) => {
  const { id } = req.params;
  if (regionsOf()[id]?.custom) {
    for (const [pid, p] of Object.entries(mapOf().places)) if (p.custom && p.region === id) delete mapOf().places[pid];
    for (const [sid, s] of Object.entries(mapOf().stopovers)) if (s.custom && s.region === id) delete mapOf().stopovers[sid];
  }
  delete regionsOf()[id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// a stopover's photos (any stopover); for the portal's own, its name, place on the map, time and note too
const coord = (v, max) => { const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 1e5) / 1e5 : null; };
function pointFrom(body) {
  const lat = coord(body.lat, 90), lon = coord(body.lon, 180);
  if (lat == null || lon == null) throw new Error('That position is not a valid latitude and longitude.');
  // the trips are all in Uganda; a point far outside it is a typo
  if (lat < -2 || lat > 5 || lon < 29 || lon > 36) throw new Error('That position is outside Uganda.');
  return { lat, lon };
}
function stopoverFrom(body, prev = {}) {
  const next = { ...prev };
  if ('photos' in body) { const p = mediaList(body.photos); if (!p) throw new Error('Unknown photo or clip.'); next.photos = p; }
  if (next.custom) {
    // on one of the trips' drives, or on a region's drive from Kampala (the map's "Drive from Kampala")
    if ('trip' in body) { if (!MAP_TRIPS.includes(body.trip)) throw new Error('Choose a trip.'); next.trip = body.trip; delete next.region; }
    else if ('region' in body) { if (!REGION_IDS().includes(body.region)) throw new Error('Choose a region.'); next.region = body.region; delete next.trip; }
    for (const k of ['name', 'when', 'note']) if (k in body) next[k] = clean(body[k], k === 'note' ? 160 : 60);
    if ('lat' in body || 'lon' in body) Object.assign(next, pointFrom(body));
    if (!next.name) throw new Error('Give the stopover a name.');
  }
  return next;
}
admin.post('/map/stopovers', async (req, res) => {
  let stop;
  try { stop = stopoverFrom(req.body, { custom: 1, photos: [] }); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (stop.lat == null || !(stop.trip || stop.region)) return res.status(400).json({ error: 'Give the stopover a trip or region and a place on the map.' });
  const id = `${stop.trip || stop.region}~c-${crypto.randomBytes(3).toString('hex')}`;
  mapOf().stopovers[id] = stop;
  await saveDraft(req.admin);
  res.json({ id, stopover: stop });
});
admin.put('/map/stopovers/:id', async (req, res) => {
  const { id } = req.params;
  if (!mapId.test(id)) return res.status(400).json({ error: 'Unknown stopover.' });
  const prev = mapOf().stopovers[id] || {};
  try { mapOf().stopovers[id] = stopoverFrom(req.body, prev); } catch (e) { return res.status(400).json({ error: e.message }); }
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// the portal's own: deleted; one of the planned ones: back to the photos it ships with
admin.delete('/map/stopovers/:id', async (req, res) => {
  delete mapOf().stopovers[req.params.id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// ---- placements: which photo or clip (and hero caption) each spot on the page shows
admin.put('/slots/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-z0-9._-]{1,64}$/i.test(id)) return res.status(400).json({ error: 'Bad spot.' });
  const next = { ...draft.slots[id] };
  if ('photo' in req.body) {
    if (!isPhoto(req.body.photo)) return res.status(400).json({ error: 'No such photo.' });
    if (draft.hidden.includes(req.body.photo)) return res.status(400).json({ error: 'That photo is removed from the website. Restore it first.' });
    next.photo = req.body.photo;
  }
  if ('video' in req.body) {
    if (!isVideo(req.body.video)) return res.status(400).json({ error: 'No such clip.' });
    next.video = req.body.video;
  }
  for (const f of ['title', 'place']) if (f in req.body) next[f] = clean(req.body[f], 80);
  draft.slots[id] = next;
  await saveDraft(req.admin);
  res.json({ ok: true });
});
admin.delete('/slots/:id', async (req, res) => {
  delete draft.slots[req.params.id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// ---- words: contact details, prices, stories, questions… (which fields exist is the site's code: src/data/fields.js)
admin.put('/text/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-z0-9._-]{1,80}$/i.test(id)) return res.status(400).json({ error: 'Bad field.' });
  if (typeof req.body.value !== 'string') return res.status(400).json({ error: 'No text received.' });
  draft.text[id] = clean(req.body.value, 2000);
  await saveDraft(req.admin);
  res.json({ ok: true, value: draft.text[id] });
});
admin.delete('/text/:id', async (req, res) => {
  delete draft.text[req.params.id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// ---- trips (album chapters)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function tripFields(body) {
  const out = {};
  if ('title' in body) {
    out.title = clean(body.title, 60);
    if (!out.title) throw new Error('Give the trip a name.');
  }
  if ('start' in body) {
    const m = String(body.start).match(/^(\d{4})-(\d\d)$/);
    if (!m || +m[2] < 1 || +m[2] > 12) throw new Error('Choose the month the trip ran.');
    out.start = m[0];
    out.when = `${MONTHS[+m[2] - 1]} ${m[1]}`;
  }
  return out;
}
admin.post('/trips', async (req, res) => {
  let t;
  try { t = tripFields(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (!t.title || !t.start) return res.status(400).json({ error: 'A trip needs a name and a month.' });
  let id = slug(t.title);
  while (tripIds().includes(id)) id = `${slug(t.title)}-${crypto.randomBytes(2).toString('hex')}`;
  draft.trips[id] = { ...t, custom: 1 };
  await saveDraft(req.admin);
  res.json({ id, trip: draft.trips[id] });
});
admin.patch('/trips/:id', async (req, res) => {
  const { id } = req.params;
  if (!tripIds().includes(id)) return res.status(404).json({ error: 'No such trip.' });
  try { draft.trips[id] = { ...draft.trips[id], ...tripFields(req.body) }; } catch (e) { return res.status(400).json({ error: e.message }); }
  await saveDraft(req.admin);
  res.json({ ok: true });
});
admin.delete('/trips/:id', async (req, res) => {
  const { id } = req.params;
  if (!draft.trips[id]?.custom) return res.status(400).json({ error: 'Only trips added here can be deleted.' });
  const count = Object.values(draft.photos).filter((p) => p.trip === id).length
    + Object.values(draft.edits).filter((e) => e.trip === id).length;
  if (count) return res.status(409).json({ error: 'Move or delete its photos first.' });
  delete draft.trips[id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});
// built-in trips: drop the admin's rename and go back to the original
admin.post('/trips/:id/reset', async (req, res) => {
  if (draft.trips[req.params.id]?.custom) return res.status(400).json({ error: 'Nothing to reset.' });
  delete draft.trips[req.params.id];
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// ---- the team: who can sign in (changes here apply at once; they aren't part of the draft)
admin.get('/team', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ admins: loadAdmins(DATA).map((a) => ({ user: a.user, created: a.created, me: a.user === req.admin })) });
});
admin.post('/team', async (req, res) => {
  const user = clean(req.body.user, 64).toLowerCase();
  const password = String(req.body.password ?? '');
  if (!validName(user)) return res.status(400).json({ error: 'Use their email address.' });
  if (loadAdmins(DATA).some((a) => a.user === user)) return res.status(409).json({ error: `${user} can already sign in.` });
  try { await setAdmin(DATA, user, password); } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json({ ok: true });
});
admin.delete('/team/:user', (req, res) => {
  const user = String(req.params.user).toLowerCase();
  if (user === req.admin) return res.status(400).json({ error: 'You can\'t remove yourself. Ask another admin to.' });
  if (!removeAdmin(DATA, user)) return res.status(404).json({ error: 'No such admin.' });
  res.json({ ok: true });
});
admin.post('/team/password', async (req, res) => {
  const me = loadAdmins(DATA).find((a) => a.user === req.admin);
  if (!await verifyPassword(String(req.body.current ?? ''), me)) return res.status(400).json({ error: 'Your current password isn\'t right.' });
  try { await setAdmin(DATA, req.admin, String(req.body.password ?? '')); } catch (e) { return res.status(400).json({ error: e.message }); }
  res.json({ ok: true });
});

// ---- history: the published versions, each one restorable into the draft
const historyName = (n) => /^site-[0-9TZ-]+\.json$/.test(n);
admin.get('/history', async (req, res) => {
  const names = (await fsp.readdir(HISTORY)).filter(historyName).sort().reverse().slice(0, 50);
  const versions = [];
  for (const name of names) {
    try {
      const v = JSON.parse(await fsp.readFile(path.join(HISTORY, name), 'utf8'));
      versions.push({ id: name, updated: v.updated || 0, by: v.by || '' });
    } catch { /* unreadable file: skip */ }
  }
  res.set('Cache-Control', 'no-store');
  res.json({ live: { updated: site.updated, by: site.by || '' }, versions });
});
admin.post('/history/:id/restore', async (req, res) => {
  const { id } = req.params;
  if (!historyName(id) || !fs.existsSync(path.join(HISTORY, id))) return res.status(404).json({ error: 'No such version.' });
  const v = readSite(path.join(HISTORY, id));
  // uploads deleted since then have no files any more: leave them out rather than show broken images
  for (const kind of ['photos', 'videos']) {
    for (const key of Object.keys(v[kind])) if (!draft[kind][key] && !site[kind][key]) delete v[kind][key];
  }
  // uploads added since stay in the library, so restoring never loses them: their photos come back
  // removed ("Put back" or "Delete for good" in the album), their clips unused
  for (const src of [site, draft]) {
    for (const [key, p] of Object.entries(src.photos)) if (!v.photos[key]) { v.photos[key] = p; if (!v.hidden.includes(key)) v.hidden.push(key); }
    for (const [key, c] of Object.entries(src.videos)) if (!v.videos[key]) v.videos[key] = c;
    // and the trips those photos belong to
    for (const [id, t] of Object.entries(src.trips)) if (t.custom && !v.trips[id]) v.trips[id] = t;
  }
  draft = { ...v, updated: Date.now() };
  await saveDraft(req.admin);
  res.json({ ok: true });
});

// ---- the site's own media on the volume (npm run push-media): what's there, and one file at a time
const mediaName = (n) => /^[a-z0-9][a-z0-9._-]{0,120}\.(webp|mp4|jpg|png|svg)$/i.test(n) && !n.includes('..');
admin.get('/media', async (req, res) => {
  const files = {};
  for (const name of await fsp.readdir(MEDIA)) {
    if (mediaName(name)) files[name] = (await fsp.stat(path.join(MEDIA, name))).size;
  }
  res.json({ files });
});
admin.put('/media/:name', express.raw({ type: 'application/octet-stream', limit: '100mb' }), async (req, res) => {
  const { name } = req.params;
  if (!mediaName(name)) return res.status(400).json({ error: 'Bad file name.' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Empty file.' });
  const tmp = path.join(MEDIA, `.${name}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  await fsp.writeFile(tmp, req.body);
  await fsp.rename(tmp, path.join(MEDIA, name));
  res.json({ ok: true, size: req.body.length });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
// anything that throws (Express 5 passes async errors here too) answers instead of taking the server down
app.use('/api', (err, req, res, next) => {
  console.error('[api]', req.method, req.originalUrl, err);
  res.status(err.status || 500).json({ error: err.status === 400 ? 'Bad request.' : 'Something went wrong on the server.' });
});

// ---------------------------------------------------------------- files
app.use('/uploads', express.static(UPLOADS, { immutable: true, maxAge: '365d', fallthrough: false }));
// the site's own photos and clips: from the volume when they've been pushed there, else from the build
app.use('/media', express.static(MEDIA, { maxAge: '7d' }));

if (fs.existsSync(DIST)) {
  const noindex = (req, res, next) => { res.set({ 'X-Robots-Tag': 'noindex', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-cache' }); next(); };
  app.get(['/admin', '/admin/'], noindex, (req, res) => res.sendFile(path.join(DIST, 'admin.html')));
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '365d' }));
  // the page arrives with the published changes written into it, so it doesn't wait for a second
  // request (GET /api/site) before showing anything. A preview still fetches the draft itself.
  const page = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  app.get(['/', '/index.html'], (req, res, next) => {
    if ('preview' in req.query) return next();
    const { by, ...pub } = site;
    const data = JSON.stringify(pub).replace(/</g, '\\u003c'); // can't close the <script> early
    // what search engines and link previews read (server/seo.mjs), built from the published wording
    const html = seoBody(page, site).replace('</head>', `${seoHead(site)}<script>window.__HINENI_SITE__=${data}</script></head>`);
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });
  app.use(express.static(DIST, {
    maxAge: '7d',
    setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); },
  }));
} else {
  app.get('/', (req, res) => res.type('text').send('API only: run `npm run build` to serve the site from here too.'));
}

// clips uploaded before conversion existed (or while ffmpeg was missing) are converted once, in the
// background: the original waits in tmp/ until its conversion has worked, then goes
async function upgradeClips() {
  if (!(await canConvert())) return console.warn('[clips] no ffmpeg: uploaded clips are kept as they are.');
  const keys = [...new Set([...Object.keys(site.videos), ...Object.keys(draft.videos)])].filter((k) => !(site.videos[k] || draft.videos[k]).web);
  for (const key of keys) {
    const ext = (site.videos[key] || draft.videos[key]).ext || 'mp4';
    const src = path.join(UPLOADS, `${key}.${ext}`);
    const orig = path.join(TMP, `${key}-original.${ext}`);
    if (!fs.existsSync(src)) continue;
    try {
      await fsp.rename(src, orig);
      const size = await oneAtATime(() => toWeb(orig, path.join(UPLOADS, key)));
      for (const [s, file] of [[site, SITE_FILE], [draft, DRAFT_FILE]]) {
        if (!s.videos[key]) continue;
        Object.assign(s.videos[key], { ext: 'mp4', ...size, web: 1, sm: 1 });
        await writeJSON(file, s);
      }
      await fsp.rm(orig, { force: true });
      console.log(`[clips] ${key} converted for every browser`);
    } catch (e) {
      console.error(`[clips] couldn't convert ${key}:`, e.log || e.message);
      if (!fs.existsSync(src)) await fsp.rename(orig, src).catch(() => {});
    }
  }
}

app.listen(PORT, () => {
  console.log(`Hineni server on http://localhost:${PORT}  (data: ${DATA})`);
  if (!loadAdmins(DATA).length) console.warn('No admin accounts yet: run `npm run admin -- add <name>`.');
  upgradeClips();
});
