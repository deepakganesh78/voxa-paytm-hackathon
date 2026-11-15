// Points the Telegram bot at the deployed app (webhook), so Murugan and customers can chat with it.
//   npm run telegram              webhook -> https://voxa-pay.vercel.app/api/telegram/webhook (or VOXA_PUBLIC_URL)
//   npm run telegram -- --local   remove the webhook, so a local `npm start` receives the messages (polling)
// Reads TELEGRAM_BOT_TOKEN from .env. Run `npm run deploy` first so the deployment has the token too.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const token = env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('TELEGRAM_BOT_TOKEN is missing in .env'); process.exit(1); }
const call = async (method, body = {}) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!d.ok) throw new Error(`${method}: ${d.description}`);
  return d.result;
};

const me = await call('getMe');
console.log(`bot: @${me.username} (${me.first_name})`);

if (process.argv.includes('--local')) {
  await call('deleteWebhook', { drop_pending_updates: false });
  console.log('webhook removed: a local `npm start` now receives the messages');
  process.exit(0);
}

const base = (process.env.VOXA_PUBLIC_URL || env.VOXA_PUBLIC_URL || 'https://voxa-pay.vercel.app').replace(/\/$/, '');
const secret = crypto.createHash('sha256').update('voxa-webhook:' + token).digest('hex').slice(0, 48); // same as src/telegram.js
await call('setWebhook', { url: `${base}/api/telegram/webhook`, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true, max_connections: 10 });
await call('setMyCommands', { commands: [{ command: 'start', description: 'Join Murugan and Co rewards' }] });
await call('setMyDescription', { description: 'Murugan and Co, Mylapore. Join the 7-visit rewards card, see your Udhaar balance, and get payment updates. Powered by Voxa.' });
await call('setMyShortDescription', { short_description: 'Murugan and Co rewards card and Udhaar, powered by Voxa.' });
const info = await call('getWebhookInfo');
console.log(`webhook: ${info.url}  pending: ${info.pending_update_count}${info.last_error_message ? '  last error: ' + info.last_error_message : ''}`);
