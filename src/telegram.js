// Telegram bot as the customer messaging channel for the demo (free, official Bot API).
// Locally Voxa asks Telegram for new messages itself (long polling), so no public link is needed.
// On Vercel there is no long-running process, so Telegram delivers each message to /api/telegram/webhook instead
// (run `npm run telegram` once to point the bot there). A local server skips polling while that webhook is set.
import crypto from 'node:crypto';
import { keepAlive } from './shared.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TG_ON = !!TOKEN;
export const WEBHOOK_MODE = TG_ON && (!!process.env.VERCEL || process.env.TELEGRAM_MODE === 'webhook');
// Telegram sends this back in a header, so the webhook only accepts calls that really come from Telegram
export const SECRET = TG_ON ? crypto.createHash('sha256').update('voxa-webhook:' + TOKEN).digest('hex').slice(0, 48) : '';
export const bot = { username: process.env.TELEGRAM_BOT_USERNAME || '', status: TG_ON ? 'connecting' : 'off', error: null, mode: WEBHOOK_MODE ? 'webhook' : 'polling' };
const API = (m) => `https://api.telegram.org/bot${TOKEN}/${m}`;

async function call(method, body) {
  const r = await fetch(API(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(method === 'getUpdates' ? 40000 : 15000),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.description || 'Telegram ' + r.status);
  return d.result;
}

// Buttons under the chat box, so customers tap instead of typing.
function keyboardFor(text) {
  // buttons only when Voxa asks something; otherwise none, so customers are not bombarded
  if (/Reply YES/i.test(text)) return { keyboard: [['YES', 'NO', 'SKIP']], resize_keyboard: true, one_time_keyboard: true };
  if (/share your (phone|number)/i.test(text)) return { keyboard: [[{ text: '📱 Share my phone number', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
  return { remove_keyboard: true };
}

export async function send(chatId, text, opts = {}) {
  // opts.inline: [[{ text, callback_data }]] gives buttons under the message itself (a tap comes back as a callback)
  const markup = opts.inline ? { inline_keyboard: opts.inline } : keyboardFor(String(text));
  const sending = call('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000), reply_markup: markup });
  keepAlive(sending); // on Vercel, finish sending even if the request that caused it has already been answered
  const r = await sending;
  return r && r.message_id;
}

let handler = null;
// One Telegram update (from polling or the webhook) → the CRM's handler
export async function handleUpdate(u) {
  if (!handler || !u) return;
  const q = u.callback_query;
  if (q && q.message && q.message.chat && q.message.chat.type === 'private') {
    const name = [q.from && q.from.first_name, q.from && q.from.last_name].filter(Boolean).join(' ');
    call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {}); // stops the button's spinner
    return handler({ chatId: q.message.chat.id, name, text: '', callback: String(q.data || ''), contactPhone: null, id: 'tg' + u.update_id });
  }
  const m = u.message;
  if (!m || !m.chat || m.chat.type !== 'private') return;
  const name = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ');
  await handler({ chatId: m.chat.id, name, text: m.text || '', contactPhone: m.contact && m.from && m.contact.user_id === m.from.id ? m.contact.phone_number : null, id: 'tg' + u.update_id });
}

// the bot's @username (asked once; set TELEGRAM_BOT_USERNAME to skip the call)
export const ready = (async () => {
  if (!TG_ON) return false;
  try {
    if (!bot.username) bot.username = (await call('getMe')).username;
    bot.status = 'connected';
    return true;
  } catch (e) { bot.status = 'error'; bot.error = e.message; console.error('[telegram]', e.message); return false; }
})();

// onMessage({ chatId, name, text, contactPhone, id })
export async function start(onMessage) {
  handler = onMessage;
  if (!TG_ON || !(await ready)) return;
  if (WEBHOOK_MODE) { console.log('[telegram] @' + bot.username + ' via webhook'); return; }
  // a webhook (the Vercel deployment) is receiving the messages: polling now would fail and steal them
  try {
    const info = await call('getWebhookInfo');
    if (info.url) { bot.mode = 'webhook (elsewhere)'; console.log(`[telegram] @${bot.username}: messages go to ${info.url}; run "npm run telegram -- --local" to use this server instead`); return; }
  } catch { /* ignore */ }
  console.log('[telegram] connected as @' + bot.username + ' (polling)');
  // skip anything sent before Voxa started
  let offset = 0;
  try { const old = await call('getUpdates', { offset: -1, timeout: 0 }); if (old.length) offset = old[old.length - 1].update_id + 1; } catch { /* ignore */ }
  for (;;) {
    try {
      const ups = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
      for (const u of ups) {
        offset = u.update_id + 1;
        try { await handleUpdate(u); } catch (e) { console.error('[telegram] handling', e.message); }
      }
    } catch (e) {
      bot.error = e.message;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
