// Deploys Voxa to Vercel from this folder:  npm run deploy
// 1. links (or creates) the Vercel project, 2. copies the keys from your private .env to the project's
// environment variables (values are never printed), 3. publishes to production.
// Needs the Vercel CLI to be signed in once:  npx vercel login
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = process.env.VERCEL_PROJECT || 'voxa-pay';
// only these are sent; secrets are stored as "sensitive" so they cannot be read back from the dashboard
const SECRET = ['CARTESIA_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'SARVAM_API_KEY', 'ANTHROPIC_API_KEY', 'RESET_PIN', 'TELEGRAM_BOT_TOKEN'];
const PLAIN = ['VOXA_BRAIN', 'GEMINI_MODEL', 'GROQ_STT_MODEL', 'CARTESIA_EN_VOICE_ID', 'CARTESIA_TA_VOICE_ID', 'CARTESIA_HI_VOICE_ID', 'CARTESIA_MODEL', 'CARTESIA_STT_MODEL', 'WA_PROVIDER', 'TELEGRAM_BOT_USERNAME', 'VOXA_MERCHANT_PHONE', 'VOXA_SHOP_CODE'];

const vercel = (args, input) => spawnSync(`npx -y vercel@latest ${args.join(' ')}`, { cwd: root, shell: true, input, encoding: 'utf8', stdio: [input === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'] });
const tail = (r) => `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-6).join('\n');

const envFile = path.join(root, '.env');
const env = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

console.log(`Linking Vercel project "${project}"…`);
let r = vercel(['link', '--yes', '--project', project]);
if (r.status !== 0) { console.error(tail(r)); process.exit(1); }

for (const key of [...SECRET, ...PLAIN]) {
  if (!env[key]) continue;
  const flags = SECRET.includes(key) ? ['--sensitive'] : [];
  r = vercel(['env', 'add', key, 'production', '--force', ...flags], env[key]);
  console.log(`${r.status === 0 ? '✔' : '✖'} ${key}${r.status === 0 ? '' : '\n' + tail(r)}`);
  if (r.status !== 0) process.exit(1);
}

console.log('Deploying to production…');
r = vercel(['deploy', '--prod', '--yes', '--logs']);
console.log(`${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-25).join('\n'));
process.exit(r.status ?? 1);
