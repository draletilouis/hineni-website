// Admin accounts: DATA_DIR/admins.json, passwords stored as scrypt hashes (never in plain text).
// Manage them with `npm run admin -- add|remove|list` (server/admin-cli.mjs).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const file = (dir) => path.join(dir, 'admins.json');
const scrypt = (password, salt) => new Promise((resolve, reject) =>
  crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))));

export function loadAdmins(dir) {
  try { return JSON.parse(fs.readFileSync(file(dir), 'utf8')); } catch { return []; }
}
function saveAdmins(dir, admins) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(dir), JSON.stringify(admins, null, 2), { mode: 0o600 });
}

export const validName = (user) => /^[a-z0-9._-]{2,32}$/.test(user);

export async function setAdmin(dir, user, password) {
  if (!validName(user)) throw new Error('Names are 2–32 characters: a–z, 0–9, dot, dash or underscore.');
  if (password.length < 10) throw new Error('Use a password of at least 10 characters.');
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = (await scrypt(password, salt)).toString('base64');
  const admins = loadAdmins(dir).filter((a) => a.user !== user);
  admins.push({ user, salt, hash, created: new Date().toISOString() });
  saveAdmins(dir, admins);
}

export function removeAdmin(dir, user) {
  const admins = loadAdmins(dir);
  const left = admins.filter((a) => a.user !== user);
  saveAdmins(dir, left);
  return left.length < admins.length;
}

// same work whether or not the name exists, so timing doesn't reveal which names are real
const decoy = { salt: 'decoy', hash: Buffer.alloc(64).toString('base64') };
export async function verifyPassword(password, admin) {
  const a = admin || decoy;
  const got = await scrypt(password, a.salt);
  return crypto.timingSafeEqual(got, Buffer.from(a.hash, 'base64')) && !!admin;
}

// First run on a new host: ADMIN_USER / ADMIN_PASSWORD in the environment create the first account
// (only while there are none). Remove them from the environment afterwards.
export async function ensureBootstrapAdmin(dir) {
  const user = (process.env.ADMIN_USER || 'admin').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || loadAdmins(dir).length) return;
  await setAdmin(dir, user, password)
    .then(() => console.log(`Created admin "${user}" from ADMIN_PASSWORD.`))
    .catch((e) => console.error(`Couldn't create admin "${user}": ${e.message}`));
}
