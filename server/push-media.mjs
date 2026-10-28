// Copy the site's own photos and clips (public/media) to the live server's volume, through the admin API.
// Deploys then carry only code, and the media lives on Railway with everything else.
//
//   npm run push-media -- https://hineni.up.railway.app
//
// Signs in as an admin (asks for name and password, or reads PUSH_USER / PUSH_PASSWORD), then sends only
// the files the server doesn't have yet or that changed size. Safe to stop and run again.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public/media');
const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.log('Usage: npm run push-media -- https://your-site.up.railway.app');
  process.exit(1);
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a); });
  });
}

let cookie = '';
async function api(method, url, body, type) {
  const headers = { 'x-hineni-admin': '1', cookie };
  if (type) headers['content-type'] = type;
  const r = await fetch(base + url, { method, headers, body });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${method} ${url}: HTTP ${r.status}`);
  return j;
}

const user = process.env.PUSH_USER || await ask('Admin name: ');
const password = process.env.PUSH_PASSWORD || await ask('Password: ', true);
await api('POST', '/api/login', JSON.stringify({ user, password }), 'application/json');

const { files: there } = await api('GET', '/api/admin/media');
const local = fs.readdirSync(SRC).filter((n) => /\.(webp|mp4|jpg|png|svg)$/i.test(n));
const todo = local.filter((n) => there[n] !== fs.statSync(path.join(SRC, n)).size);
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const total = todo.reduce((a, n) => a + fs.statSync(path.join(SRC, n)).size, 0);
console.log(`${local.length} media files here, ${local.length - todo.length} already on the server. Sending ${todo.length} (${mb(total)}).`);

let sent = 0, bytes = 0, failed = [];
async function worker() {
  for (let name = todo.shift(); name; name = todo.shift()) {
    const buf = fs.readFileSync(path.join(SRC, name));
    for (let attempt = 1; ; attempt++) {
      try {
        await api('PUT', `/api/admin/media/${encodeURIComponent(name)}`, buf, 'application/octet-stream');
        break;
      } catch (e) {
        if (attempt === 3) { failed.push(`${name}: ${e.message}`); break; }
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
    sent++;
    bytes += buf.length;
    process.stdout.write(`\r  ${sent} files · ${mb(bytes)} of ${mb(total)}   `);
  }
}
await Promise.all([worker(), worker(), worker()]);
process.stdout.write('\n');
if (failed.length) {
  console.log(`${failed.length} failed (run the command again to retry them):\n  ${failed.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('Done: the server has every media file.');
}
await api('POST', '/api/logout').catch(() => {});
