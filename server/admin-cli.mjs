// Manage admin accounts:
//   npm run admin -- add <name>      create one, or set a new password (asks for it, hidden)
//   npm run admin -- remove <name>
//   npm run admin -- list
import path from 'node:path';
import readline from 'node:readline';
import { loadAdmins, setAdmin, removeAdmin } from './admins.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* no .env */ }
const DATA = path.resolve(ROOT, process.env.DATA_DIR || 'storage');
const [cmd, rawName] = process.argv.slice(2);
const name = (rawName || '').toLowerCase();

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

try {
  if (cmd === 'add' && name) {
    const p1 = await askHidden(`Password for ${name}: `);
    const p2 = await askHidden('Same again: ');
    if (p1 !== p2) throw new Error('The two passwords are different.');
    const existed = loadAdmins(DATA).some((a) => a.user === name);
    await setAdmin(DATA, name, p1);
    console.log(existed ? `New password set for ${name}.` : `Admin ${name} created. Sign in at /admin.`);
  } else if (cmd === 'remove' && name) {
    console.log(removeAdmin(DATA, name) ? `Removed ${name}. They're signed out at their next click.` : `No admin called ${name}.`);
  } else if (cmd === 'list') {
    const admins = loadAdmins(DATA);
    console.log(admins.length ? admins.map((a) => `${a.user}  (since ${a.created.slice(0, 10)})`).join('\n') : 'No admins yet.');
  } else {
    console.log('Usage: npm run admin -- add <name> | remove <name> | list');
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
