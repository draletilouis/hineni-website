// Hineni server: serves the built site, the admin portal (/admin) and its API.
//
//   GET  /api/site                 the live changes the site applies at start-up (public)
//   POST /api/login, /api/logout   admin sign-in (HttpOnly session cookie)
//   /api/admin/*                   photos, placements and trips (signed-in admins only)
//   /uploads/*                     uploaded photos, as 900/1600/2000/2800 px webp
//   /media/*                       the site's own photos and clips (from DATA_DIR/media, else the build)
//   GET  /api/health               for the host's health check
//
// Everything admins change lives in DATA_DIR: site.json, the uploads, the admin accounts and a history
// of earlier site.json versions. On Railway that's the service's volume (RAILWAY_VOLUME_MOUNT_PATH), which
// also holds the site's own media (pushed there with `npm run push-media`, so deploys stay small);
// elsewhere ./storage. Back that folder up; nothing else changes.
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { loadAdmins, verifyPassword, ensureBootstrapAdmin } from './admins.mjs';

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
const SITE_FILE = path.join(DATA, 'site.json');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8787;
const SIZES = [900, 1600, 2000, 2800];
const SESSION_HOURS = 12;
const TYPES = ['wildlife', 'land', 'people'];

// sharp's cache keeps files open, and Windows won't delete an open file
sharp.cache(false);
// clean-up of photo files is best-effort: a leftover file is harmless, a crash isn't
const removeFiles = (key) => Promise.all(SIZES.map((w) => fsp.rm(path.join(UPLOADS, `${key}-${w}.webp`), { force: true })))
  .catch((e) => console.warn(`[files] couldn't remove all of ${key}: ${e.code || e.message}`));

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(HISTORY, { recursive: true });
fs.mkdirSync(MEDIA, { recursive: true });
await ensureBootstrapAdmin(DATA);

// photos that ship with the site (built by tools/build-media.mjs)
const builtIn = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/media.json'), 'utf8')).photos;
const builtInTrips = ['moyo', 'murchison', 'fortportal'];

// ---------------------------------------------------------------- the live site file
const emptySite = () => ({ version: 1, updated: 0, trips: {}, photos: {}, edits: {}, hidden: [], slots: {} });
let site = fs.existsSync(SITE_FILE) ? { ...emptySite(), ...JSON.parse(fs.readFileSync(SITE_FILE, 'utf8')) } : emptySite();

// one write at a time; the previous version goes to history/ first (the last 100 are kept)
let writing = Promise.resolve();
function saveSite(user) {
  site.updated = Date.now();
  site.by = user;
  const snapshot = JSON.stringify(site, null, 2);
  writing = writing.then(async () => {
    if (fs.existsSync(SITE_FILE)) {
      await fsp.copyFile(SITE_FILE, path.join(HISTORY, `site-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
      const old = (await fsp.readdir(HISTORY)).sort();
      await Promise.all(old.slice(0, Math.max(0, old.length - 100)).map((f) => fsp.rm(path.join(HISTORY, f))));
    }
    await fsp.writeFile(`${SITE_FILE}.tmp`, snapshot);
    await fsp.rename(`${SITE_FILE}.tmp`, SITE_FILE);
  });
  return writing;
}

const tripIds = () => [...builtInTrips, ...Object.keys(site.trips).filter((id) => !builtInTrips.includes(id))];
const isPhoto = (key) => typeof key === 'string' && (key in builtIn || key in site.photos);
// captions end up in the page's HTML: plain text only, one line, sensible length
const clean = (v, max = 160) => String(v ?? '').replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

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
  // expired, or the account was removed (npm run admin -- remove) since signing in
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

app.get('/api/health', (req, res) => res.json({ ok: true, persistent: !EPHEMERAL }));
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { req.body ??= {}; next(); });

app.get('/api/site', (req, res) => {
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
    return res.status(401).json({ error: 'That name and password don\'t match.' });
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

admin.get('/site', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(site);
});

// ---- upload: one photo per request (the portal sends them one by one, with progress)
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
      site.photos[key] = photo;
      await saveSite(req.admin);
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
  if (site.photos[key]) Object.assign(site.photos[key], change);
  else site.edits[key] = { ...site.edits[key], ...change };
  await saveSite(req.admin);
  res.json({ ok: true });
});

// remove from the website (album, grid and map) / put back
admin.post('/photos/:key/remove', async (req, res) => {
  const { key } = req.params;
  if (!isPhoto(key)) return res.status(404).json({ error: 'No such photo.' });
  // (the portal also checks the spots' original photos, which only the site's code knows)
  if (Object.values(site.slots).some((s) => s.photo === key)) return res.status(409).json({ error: 'It\'s chosen for a spot on the page. Pick another photo there first.' });
  if (!site.hidden.includes(key)) site.hidden.push(key);
  await saveSite(req.admin);
  res.json({ ok: true });
});
admin.post('/photos/:key/restore', async (req, res) => {
  site.hidden = site.hidden.filter((k) => k !== req.params.key);
  await saveSite(req.admin);
  res.json({ ok: true });
});
// an uploaded photo, removed first, can be deleted for good (photos that ship with the site can't)
admin.delete('/photos/:key', async (req, res) => {
  const { key } = req.params;
  if (!site.photos[key]) return res.status(404).json({ error: 'Only uploaded photos can be deleted.' });
  if (!site.hidden.includes(key)) return res.status(409).json({ error: 'Remove it from the website first.' });
  if (Object.values(site.slots).some((s) => s.photo === key)) return res.status(409).json({ error: 'It\'s still chosen for a spot on the page.' });
  delete site.photos[key];
  site.hidden = site.hidden.filter((k) => k !== key);
  await saveSite(req.admin);
  await removeFiles(key);
  res.json({ ok: true });
});

// ---- placements: which photo (and hero caption) each spot on the page shows
admin.put('/slots/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-z0-9._-]{1,64}$/i.test(id)) return res.status(400).json({ error: 'Bad spot.' });
  const next = { ...site.slots[id] };
  if ('photo' in req.body) {
    if (!isPhoto(req.body.photo)) return res.status(400).json({ error: 'No such photo.' });
    if (site.hidden.includes(req.body.photo)) return res.status(400).json({ error: 'That photo is removed from the website. Restore it first.' });
    next.photo = req.body.photo;
  }
  for (const f of ['title', 'place']) if (f in req.body) next[f] = clean(req.body[f], 80);
  site.slots[id] = next;
  await saveSite(req.admin);
  res.json({ ok: true });
});
admin.delete('/slots/:id', async (req, res) => {
  delete site.slots[req.params.id];
  await saveSite(req.admin);
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
  site.trips[id] = { ...t, custom: 1 };
  await saveSite(req.admin);
  res.json({ id, trip: site.trips[id] });
});
admin.patch('/trips/:id', async (req, res) => {
  const { id } = req.params;
  if (!tripIds().includes(id)) return res.status(404).json({ error: 'No such trip.' });
  try { site.trips[id] = { ...site.trips[id], ...tripFields(req.body) }; } catch (e) { return res.status(400).json({ error: e.message }); }
  await saveSite(req.admin);
  res.json({ ok: true });
});
admin.delete('/trips/:id', async (req, res) => {
  const { id } = req.params;
  if (!site.trips[id]?.custom) return res.status(400).json({ error: 'Only trips added here can be deleted.' });
  const count = Object.values(site.photos).filter((p) => p.trip === id).length
    + Object.values(site.edits).filter((e) => e.trip === id).length;
  if (count) return res.status(409).json({ error: 'Move or delete its photos first.' });
  delete site.trips[id];
  await saveSite(req.admin);
  res.json({ ok: true });
});
// built-in trips: drop the admin's rename and go back to the original
admin.post('/trips/:id/reset', async (req, res) => {
  if (site.trips[req.params.id]?.custom) return res.status(400).json({ error: 'Nothing to reset.' });
  delete site.trips[req.params.id];
  await saveSite(req.admin);
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
  app.use(express.static(DIST, {
    maxAge: '7d',
    setHeaders: (res, file) => { if (file.endsWith('.html')) res.set('Cache-Control', 'no-cache'); },
  }));
} else {
  app.get('/', (req, res) => res.type('text').send('API only: run `npm run build` to serve the site from here too.'));
}

app.listen(PORT, () => {
  console.log(`Hineni server on http://localhost:${PORT}  (data: ${DATA})`);
  if (!loadAdmins(DATA).length) console.warn('No admin accounts yet: run `npm run admin -- add <name>`.');
});
