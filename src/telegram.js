// Telegram bot as the customer messaging channel for the demo (free, official Bot API).
// Voxa asks Telegram for new messages itself (long polling), so no public link is needed.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TG_ON = !!TOKEN;
export const bot = { username: '', status: TG_ON ? 'connecting' : 'off', error: null };
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

export async function send(chatId, text) {
  const r = await call('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000), reply_markup: keyboardFor(String(text)) });
  return r && r.message_id;
}

// onMessage({ chatId, name, text, contactPhone, id })
export async function start(onMessage) {
  if (!TG_ON) return;
  try {
    const me = await call('getMe');
    bot.username = me.username;
    bot.status = 'connected';
    console.log('[telegram] connected as @' + me.username);
  } catch (e) {
    bot.status = 'error'; bot.error = e.message;
    console.error('[telegram]', e.message);
    return;
  }
  // skip anything sent before Voxa started
  let offset = 0;
  try { const old = await call('getUpdates', { offset: -1, timeout: 0 }); if (old.length) offset = old[old.length - 1].update_id + 1; } catch { /* ignore */ }
  for (;;) {
    try {
      const ups = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      for (const u of ups) {
        offset = u.update_id + 1;
        const m = u.message;
        if (!m || !m.chat || m.chat.type !== 'private') continue;
        const name = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ');
        try {
          await onMessage({ chatId: m.chat.id, name, text: m.text || '', contactPhone: m.contact && m.contact.user_id === m.from.id ? m.contact.phone_number : null, id: 'tg' + u.update_id });
        } catch (e) { console.error('[telegram] handling', e.message); }
      }
    } catch (e) {
      bot.error = e.message;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
