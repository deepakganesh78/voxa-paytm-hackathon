import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from './src/engine.js';
import * as A from './src/agent.js';
import * as CRM from './src/crm.js';
import * as TG from './src/telegram.js';
import { SKILLS } from './src/skills.js';
import { msg, rupee, SPEECH_CODES } from './src/i18n.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// bill photos need a bigger body; everything else stays small
const smallJson = express.json({ limit: '200kb' });
const bigJson = express.json({ limit: '8mb' });
app.use((req, res, next) => (req.path === '/api/merchant/bill' ? bigJson : smallJson)(req, res, next));
app.use(express.static(path.join(here, 'public'), { extensions: ['html'] }));
// icons served locally so the demo still works if a CDN is blocked at the venue
app.get('/vendor/lucide.js', (req, res) => res.sendFile(path.join(here, 'node_modules/lucide/dist/umd/lucide.min.js')));

// On Vercel several copies ("instances") of this server run at once. The demo data lives in Vercel's shared Runtime
// Cache (src/shared.js): before an API call every instance adopts any newer data, and after a change it publishes it.
app.use('/api', async (req, res, next) => {
  if (!req.path.startsWith('/tts') && !req.path.startsWith('/stt') && !req.path.startsWith('/whatsapp')) await E.syncShared();
  next();
});

const SARVAM_KEY = process.env.SARVAM_API_KEY || '';
const CARTESIA_KEY = process.env.CARTESIA_API_KEY || '';
const CARTESIA_EN_VOICE = process.env.CARTESIA_EN_VOICE_ID || 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4';
const CARTESIA_TA_VOICE = process.env.CARTESIA_TA_VOICE_ID || 'fb7d8d97-9730-4165-bd79-36b5ce61b5f2';
const CARTESIA_HI_VOICE = process.env.CARTESIA_HI_VOICE_ID || '4459a9a5-69d6-4680-b970-e13dc51845b6';
const RESET_PIN = process.env.RESET_PIN || '';

A.startAgent();
// customers on WhatsApp: loyalty after every payment, Udhar questions, alerts to Murugan if he switched them on
E.bus.on('payment_success', (txn) => { try { CRM.onPaymentSuccess(txn); } catch (e) { console.error(e); } });
// Murugan can ask Voxa from his own phone chat; the answer goes back to that chat
CRM.setOwnerChat(async (text) => (await A.chat(text, undefined, { switchApp: false })).reply);
E.bus.on('payment_pending', (txn) => CRM.toMerchant('stuckAlerts', `Voxa: ${rupee(txn.amount)} from ${txn.fromName} is stuck at the bank. It will reach you or go back to them by ${txn.deadline}. I'm watching it.`));

// ---------- live updates (Server-Sent Events) ----------
const clients = new Set();
function payload() {
  return JSON.stringify({ ...E.getState(), planner: E.plannerInsights() });
}
E.bus.on('change', () => {
  const data = `event: state\ndata: ${payload()}\n\n`;
  for (const res of clients) res.write(data);
});
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000);

app.get('/api/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`event: state\ndata: ${payload()}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// Phones poll instead of holding an SSE connection open: ?rev= answers "unchanged" with a few bytes
app.get('/api/state', (req, res) => {
  const s = E.getState();
  if (req.query.rev !== undefined && Number(req.query.rev) === s.rev) return res.json({ unchanged: true, rev: s.rev });
  res.json({ ...s, planner: E.plannerInsights() });
});
// Sarvam usage meter, to keep an eye on the hackathon credits.
// Rates used for the estimate (Sarvam pricing page): speech-to-text ₹0.49 a minute; Bulbul v3 ₹3 per 1,000 characters.
const usage = { ttsChars: 0, ttsCalls: 0, cartesiaTtsChars: 0, cartesiaTtsCalls: 0, ttsCached: 0, sttSeconds: 0, sttCalls: 0 };
const credits = () => Math.round(((usage.ttsChars / 1000) * 3 + (usage.sttSeconds / 60) * 0.49) * 100) / 100;
const INSTANCE = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; // which running copy answered (diagnostics)
app.get('/api/config', async (req, res) => { await TG.ready; res.json({ ...A.aiStatus(), serverless: E.sharedEnabled, instance: INSTANCE, whatsapp: { live: CRM.WA_LIVE, provider: CRM.PROVIDER, bot: CRM.botUsername(), ownerCode: CRM.ownerCode(), from: CRM.twilioFrom(), joinText: CRM.joinText(), shopCode: CRM.SHOP_CODE }, sarvam: !!SARVAM_KEY, stt: !!(SARVAM_KEY || GROQ_KEY || CARTESIA_KEY), cartesiaEnglish: !!CARTESIA_KEY, cartesiaTamil: !!CARTESIA_KEY, cartesiaHindi: !!CARTESIA_KEY, resetPin: !!RESET_PIN, sarvamUsage: { ...usage, estCredits: credits() } }); });
app.get('/api/skills', (req, res) => res.json(SKILLS));

// small helper so every route returns {ok} or {error}
const route = (fn) => async (req, res) => {
  try {
    const out = await fn(req.body || {}, req);
    await E.flushShared(); // on Vercel: publish the change before answering, so the next request on any copy sees it
    res.json({ ok: true, ...(out && typeof out === 'object' ? out : {}) });
  } catch (e) {
    await E.flushShared();
    res.status(400).json({ ok: false, error: e.message });
  }
};

// ---------- Voxa Pay (customer) ----------
app.post('/api/pay', route((b) => ({ txn: E.startPayment({ ...b, payer: typeof b.payer === 'string' ? b.payer : null }) })));
// Naveen's own customer screen: the same app, signed in as Naveen
app.get('/naveen', (req, res) => res.sendFile(path.join(here, 'public/pay.html')));
app.post('/api/customer/complaint', route((b) => ({ ticket: A.customerComplaint(b.txnId, b.reason, b.note) })));
app.post('/api/support/brief', route(async (b) => { const t = E.findTicket(b.ticketId); if (!t) throw new Error('Ticket not found'); await A.writeBrief(t, 'asked again'); return { ok: true }; }));

// ---------- Voxa Pay for Business (merchant) ----------
app.post('/api/merchant/lang', route((b) => {
  if (!['en', 'ta', 'hi'].includes(b.lang)) throw new Error('Unknown language');
  E.getState().merchant.lang = b.lang;
  E.touch();
}));
app.post('/api/merchant/verify', route((b) => A.verifyForCounter(b.txnId)));
app.post('/api/merchant/cash', route((b) => { E.markCash(b.txnId); }));
app.post('/api/merchant/refund', route((b) => { E.merchantRefund(b.txnId); }));
app.post('/api/merchant/offer', route((b) => ({ offer: E.createOffer(b) })));
app.post('/api/merchant/offer/stop', route((b) => { E.stopOffer(b.id); }));
app.post('/api/merchant/loan/accept', route((b) => { E.acceptLoan(b); }));
app.post('/api/merchant/expenses/clear', route(() => { E.clearExpenses(); }));
app.post('/api/merchant/expenses/add', route((b) => {
  const amount = Math.round(Number(b.amount));
  if (!(amount > 0) || amount > 10000000) throw new Error('Enter an amount');
  if (b.category === 'cash_sales') return { cash: E.setCashSales(amount, { source: 'you' }) };
  return { added: E.addExpenses([{ category: b.category, amount }], { source: 'you', said: '' }) };
}));
app.post('/api/merchant/chat', route(async (b) => {
  const text = String(b.text || '').slice(0, 500).trim();
  if (!text) throw new Error('Say or type something first.');
  return A.chat(text, b.heard);
}));
app.post('/api/merchant/bill', route(async (b) => {
  const image = typeof b.image === 'string' ? b.image.replace(/^data:[^,]+,/, '') : null;
  const mediaType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.mediaType) ? b.mediaType : 'image/jpeg';
  if (!image && !b.sample) throw new Error('Add a photo first.');
  if (image && image.length > 6_000_000) throw new Error('That photo is too big. Try again.');
  if (image && !b.sample && !(b.check && (b.check.ok || b.check.reason !== 'looks like a person'))) throw new Error('That looks like a photo of a person. Send a bill or a payment screenshot only.');
  return A.readBill({ image, mediaType, sample: b.sample || null, lang: b.lang, thumb: typeof b.thumb === 'string' && b.thumb.length < 40000 ? b.thumb : null, text: typeof b.text === 'string' ? b.text.trim().slice(0, 300) : '' });
}));
// ---------- Telegram webhook (used on Vercel; `npm run telegram` points the bot here) ----------
app.post('/api/telegram/webhook', async (req, res) => {
  if (!TG.TG_ON || req.get('x-telegram-bot-api-secret-token') !== TG.SECRET) return res.sendStatus(403);
  // handle the message fully before answering: on Vercel the function may stop once the reply is sent
  try { await TG.handleUpdate(req.body); } catch (e) { console.error('[telegram] webhook', e.message); }
  await E.flushShared();
  res.sendStatus(200); // always 200, or Telegram keeps re-sending the same message
});
// ---------- WhatsApp (Twilio) ----------
// Twilio calls this for every WhatsApp message sent to the number. Point the sandbox's "When a message comes in" here.
app.post('/api/whatsapp/incoming', express.urlencoded({ extended: false }), async (req, res) => {
  res.type('text/xml').send('<Response></Response>');
  try { await CRM.handleIncoming(req.body.From, req.body.ProfileName, req.body.Body, req.body.MessageSid || null); } catch (e) { console.error('whatsapp in', e); }
});
// Meta WhatsApp Cloud API webhook: GET is Meta's one-time check, POST brings incoming messages
app.get('/api/whatsapp/meta', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === CRM.META_VERIFY) return res.status(200).send(String(req.query['hub.challenge'] || ''));
  res.sendStatus(403);
});
app.post('/api/whatsapp/meta', async (req, res) => {
  res.sendStatus(200);
  try { await CRM.handleMetaWebhook(req.body); } catch (e) { console.error('meta in', e); }
});
app.post('/api/crm/unlink', route(async () => { await CRM.unlink(); }));
app.post('/api/crm/settings', route((b) => {
  const s = E.getState().crm.settings;
  if ('enabled' in b) s.enabled = !!b.enabled;
  if ('merchantPhone' in b) s.merchantPhone = CRM.normPhone(b.merchantPhone);
  for (const k of ['dailySummary', 'udharAlerts', 'stuckAlerts', 'loyaltyAlerts']) if (k in b) s[k] = !!b[k];
  if (/^\d\d:\d\d$/.test(b.summaryTime || '')) s.summaryTime = b.summaryTime;
  if (typeof b.reward === 'string' && b.reward.trim()) E.getState().crm.reward = b.reward.trim().slice(0, 80);
  if ('perPayment' in b) E.getState().crm.perPayment = !!b.perPayment;
  if (b.loyaltyDays !== undefined) { const n = Math.round(Number(b.loyaltyDays)); if (n >= 2 && n <= 30) E.getState().crm.loyaltyDays = n; else throw new Error('Pick between 2 and 30 visits.'); }
  E.touch();
}));
app.post('/api/crm/test', route(async () => {
  const r = await CRM.sendToOwner('Voxa here. Your updates from Murugan and Co are working.');
  if (!r) throw new Error('Link your phone first (scan your QR on this page).');
  if (r.status !== 'sent') throw new Error(r.reason || 'Not sent');
}));
app.post('/api/crm/summary', route(async () => {
  const r = await CRM.sendToOwner(CRM.dailySummaryText());
  if (!r) throw new Error('Link your phone first (scan your QR on this page).');
  if (r.status !== 'sent') throw new Error(r.reason || 'Not sent');
}));
app.post('/api/crm/unlink-owner', route(() => { CRM.unlinkOwner(); }));
const custOr404 = (q) => { const c = CRM.findCustomer(q); if (!c) throw new Error('Customer not found'); return c; };
app.post('/api/crm/udhar/add', route((b) => CRM.addCredit(custOr404(b.customer), b.amount, b.note)));
app.post('/api/crm/udhar/paid', route((b) => { const cu = custOr404(b.customer); const e = CRM.repayClaim(cu, Number(b.amount) || CRM.balanceOf(cu), 'Murugan recorded it'); return CRM.confirmRepay(e.id); }));
app.post('/api/crm/udhar/confirm', route((b) => CRM.confirmRepay(String(b.id || ''))));
app.post('/api/crm/udhar/reject', route((b) => { CRM.rejectRepay(String(b.id || '')); }));
app.post('/api/crm/remove', route((b) => { const cu = custOr404(b.customer); const c = E.getState().crm; c.customers = c.customers.filter((x) => x !== cu); E.touch(); }));
app.get('/api/crm/score', (req, res) => { try { res.json(CRM.creditScore(custOr404(req.query.customer), Number(req.query.amount) || 0)); } catch (e) { res.status(404).json({ error: e.message }); } });

app.post('/api/merchant/notes/adddash', route((b) => ({ note: E.addDashboardNote(b) })));
app.post('/api/merchant/notes/dashboard', route((b) => ({ note: E.updateNoteDashboard(String(b.id || ''), b) })));
app.post('/api/merchant/chat/clear', route(() => { E.deleteChat('current'); }));
app.post('/api/merchant/chat/new', route(() => { E.newChat(); }));
app.post('/api/merchant/chat/open', route((b) => { E.openChat(String(b.id || '')); }));
app.post('/api/merchant/chat/delete', route((b) => { E.deleteChat(String(b.id || '')); }));
app.post('/api/merchant/chat/savenote', route((b) => ({ note: E.saveAnswerToNotes(Number(b.index)) })));
app.post('/api/merchant/note/done', route((b) => {
  const n = E.getState().notes.merchant.find((x) => x.id === b.id);
  if (n) n.done = true;
  E.touch();
}));
app.get('/api/loanprofile', (req, res) => res.json(E.loanProfile()));
app.post('/api/merchant/notes/remove', route((b) => { E.removeBoardNote(b.id); }));
app.get('/api/loanplan', (req, res) => res.json(E.loanPlan(req.query)));
app.get('/api/profit', (req, res) => res.json(E.profitSummary(req.query.month)));
app.get('/api/insights', (req, res) => res.json({ week: E.salesSummary('week'), month: E.salesSummary('month'), hourly: E.hourlyInsight(), today: E.salesToday() }));

// ---------- Voxa Bank ----------
app.post('/api/bank/mode', route((b) => {
  if (!['normal', 'timeout', 'decline'].includes(b.mode)) throw new Error('Unknown mode');
  E.getState().bankMode = b.mode;
  E.touch();
}));
app.post('/api/bank/decide', route((b) => { E.bankDecide(b.txnId, b.decision); }));
app.post('/api/bank/resolve', route((b) => { E.bankResolve(b.txnId, b.action); }));
app.post('/api/bank/scenario', route((b) => {
  const s = E.getState().scenario;
  if ('holdNextSettlement' in b) s.holdNextSettlement = !!b.holdNextSettlement;
  if ('doubleDeductionNext' in b) s.doubleDeductionNext = !!b.doubleDeductionNext;
  E.touch();
}));
app.post('/api/bank/settle', route(() => ({ settlement: E.runSettlement() })));
app.post('/api/bank/topup', route(() => { E.getState().customer.balance += 10000; E.touch(); }));
app.post('/api/bank/request/done', route((b) => {
  const r = E.getState().bankRequests.find((x) => x.id === b.id);
  if (r) r.done = true;
  E.touch();
}));

// ---------- Voxa Support ----------
app.post('/api/sim/nextday', route(() => E.passOneDay()));
app.post('/api/support/action', route((b) => {
  const S = E.getState();
  const t = E.findTicket(b.ticketId);
  if (!t) throw new Error('Ticket not found');
  const agent = 'Naveen';
  const lang = S.merchant.lang;
  switch (b.action) {
    case 'take': {
      t.assignee = agent;
      if (t.status === 'voxa') t.status = 'needs_human';
      E.addTimeline(t.id, agent, 'Picked up the ticket.');
      break;
    }
    case 'chase_bank': {
      const txn = E.findTxn(t.refId);
      if (!txn) throw new Error('No payment on this ticket');
      S.bankRequests.unshift({ id: 'BR' + Date.now(), at: Date.now(), ticketId: t.id, txnId: txn.id, utr: txn.utr, amount: txn.amount, from: agent, text: `Please resolve UTR ${txn.utr} (${rupee(txn.amount)}) today: credit the merchant or reverse to the customer.`, done: false });
      E.addTimeline(t.id, agent, `Asked Voxa Bank (partner bank desk) to resolve UTR ${txn.utr} today.`);
      break;
    }
    case 'release_settlement': {
      const st = E.releaseSettlement(t.refId);
      const m = msg('settlementReleased', lang, { amount: st.net, ticket: t.id });
      E.notify('merchant', { kind: 'voxa', ...m, speak: true, refId: st.id });
      E.resolveTicket(t.id, agent, `Checked KYC: same PAN, name change only. Released ${rupee(st.net)} to the merchant's bank.`);
      break;
    }
    case 'refund_deduction': {
      const stId = t.refId.replace(/-D$/, '');
      const extra = E.refundDeduction(stId);
      const m = msg('deductionRefunded', lang, { amount: extra, ticket: t.id });
      E.notify('merchant', { kind: 'voxa', ...m, speak: true, refId: stId });
      E.resolveTicket(t.id, agent, `Refunded the extra ${rupee(extra)} loan deduction to the merchant's bank.`);
      break;
    }
    case 'reply': {
      const text = String(b.text || '').trim();
      if (!text) throw new Error('Write a reply first');
      const m = msg('supportReply', lang, { agent, text });
      E.notify('merchant', { kind: 'support', ...m, refId: t.refId });
      E.addTimeline(t.id, agent, 'Replied to Murugan: ' + text);
      break;
    }
    case 'close': {
      E.resolveTicket(t.id, agent, String(b.text || 'Closed by support.'));
      break;
    }
    default:
      throw new Error('Unknown action');
  }
  E.touch();
}));

app.post('/api/reset', route((b) => {
  if (RESET_PIN && b.pin !== RESET_PIN) throw new Error('Wrong reset PIN');
  E.resetState();
}));

// ---------- Text to speech (Cartesia Skylar, Janani and Siya; Sarvam otherwise) ----------
// The same sentence is never paid for twice: rehearsals replay from this cache.
const ttsCache = new Map();
app.post('/api/tts', async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 1400);
  const lang = SPEECH_CODES[req.body?.lang] || 'en-IN';
  const cartesiaVoice = lang === 'en-IN' ? CARTESIA_EN_VOICE : lang === 'ta-IN' ? CARTESIA_TA_VOICE : lang === 'hi-IN' ? CARTESIA_HI_VOICE : null;
  const provider = cartesiaVoice && CARTESIA_KEY ? 'cartesia' : SARVAM_KEY ? 'sarvam' : null;
  if (!provider) return res.status(404).json({ error: 'Text-to-speech not configured' });
  const key = provider + '|' + lang + '|' + text;
  if (ttsCache.has(key)) { usage.ttsCached++; return res.set('Content-Type', 'audio/wav').send(ttsCache.get(key)); }
  try {
    if (provider === 'cartesia') {
      const r = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${CARTESIA_KEY}`, 'Cartesia-Version': '2026-08-14', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: process.env.CARTESIA_MODEL || 'sonic-3.6',
          transcript: text,
          voice: cartesiaVoice,
          language: lang,
          output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) {
        const detail = (await r.text()).slice(0, 400);
        console.error('Cartesia TTS', r.status, detail);
        return res.status(502).json({ error: 'Cartesia error ' + r.status, detail });
      }
      const buf = Buffer.from(await r.arrayBuffer());
      usage.cartesiaTtsChars += text.length;
      usage.cartesiaTtsCalls++;
      if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(key, buf);
      return res.set('Content-Type', 'audio/wav').send(buf);
    }
    const r = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' },
      // A female voice in every language: bulbul:v3 'kavitha' (₹3 per 1,000 characters). v4-flash is cheaper (₹1) but its Tamil voices are all male.
      body: JSON.stringify({ text, language_code: lang, model: process.env.SARVAM_TTS_MODEL || 'bulbul:v3', speaker: process.env.SARVAM_SPEAKER || 'kavitha' }),
    });
    if (!r.ok) { const d = (await r.text()).slice(0, 400); console.error('Sarvam TTS', r.status, d); return res.status(502).json({ error: 'Sarvam error ' + r.status, detail: d }); }
    const data = await r.json();
    const b64 = data.audios && data.audios[0];
    if (!b64) return res.status(502).json({ error: 'No audio' });
    const buf = Buffer.from(b64, 'base64');
    usage.ttsChars += text.length; usage.ttsCalls++;
    if (ttsCache.size > 300) ttsCache.delete(ttsCache.keys().next().value);
    ttsCache.set(key, buf);
    res.set('Content-Type', 'audio/wav').send(buf);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---------- Speech to text (Sarvam, Groq or Cartesia, in that order of preference) ----------
// The browser records a short clip (max ~15 s) and sends it here.
// Sarvam (Saaras v3 in transcribe mode, then Saarika v2.5) auto-detects the language.
// Groq (Whisper) auto-detects it too. If Whisper names a language the app does not speak, we ask again in the app's current language.
// Cartesia (ink-whisper) needs the language up front: with a wrong one it translates or garbles, so we use the app's current language.
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const SPEECH_LANGS = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };
const sttExt = (type) => (type.includes('wav') ? 'wav' : type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm');
async function groqTranscribe(audio, type, hint) {
  const ask = async (language) => {
    let last;
    // a brief 5xx is retried once
    for (let attempt = 0; attempt < 2; attempt++) {
      const fd = new FormData();
      fd.append('file', new Blob([audio], { type }), 'speech.' + sttExt(type));
      fd.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3');
      fd.append('response_format', 'verbose_json');
      fd.append('temperature', '0');
      if (language) fd.append('language', language);
      const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: fd, signal: AbortSignal.timeout(20000),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) return data;
      last = new Error(`Groq ${r.status}: ${data.error?.message || r.statusText}`);
      if (r.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    throw last;
  };
  let data = await ask();
  const code = { english: 'en', tamil: 'ta', hindi: 'hi' }[String(data.language || '').toLowerCase()];
  if (!code) data = await ask(SPEECH_LANGS[hint] ? hint : 'en');
  const language = code || (SPEECH_LANGS[hint] ? hint : 'en');
  return { transcript: String(data.text || '').trim(), language: SPEECH_LANGS[language] };
}
async function cartesiaTranscribe(audio, type, lang) {
  const code = SPEECH_LANGS[lang] ? lang : 'en';
  let last;
  // Cartesia sometimes answers 5xx for a moment: one quick retry
  for (let attempt = 0; attempt < 2; attempt++) {
    const fd = new FormData();
    fd.append('file', new Blob([audio], { type }), 'speech.' + sttExt(type));
    fd.append('model', process.env.CARTESIA_STT_MODEL || 'ink-whisper');
    fd.append('language', code);
    const r = await fetch('https://api.cartesia.ai/stt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CARTESIA_KEY}`, 'Cartesia-Version': '2026-08-14' },
      body: fd,
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return { transcript: String(data.text || '').trim(), language: SPEECH_LANGS[code] };
    last = new Error(`Cartesia ${r.status}: ${data.message || data.error || r.statusText}`);
    if (r.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw last;
}
app.post('/api/stt', express.raw({ type: () => true, limit: '6mb' }), async (req, res) => {
  if (!SARVAM_KEY && !GROQ_KEY && !CARTESIA_KEY) return res.status(404).json({ error: 'Speech recognition not configured' });
  const type = (req.get('content-type') || 'audio/wav').split(';')[0].trim();
  if (!SARVAM_KEY) {
    const hint = String(req.query.lang || 'en');
    const engines = [GROQ_KEY && ['Groq', groqTranscribe], CARTESIA_KEY && ['Cartesia', cartesiaTranscribe]].filter(Boolean);
    const errors = [];
    for (const [name, transcribe] of engines) {
      try {
        const out = await transcribe(req.body, type, hint);
        usage.sttSeconds += Math.min(60, Math.max(1, Number(req.query.secs) || 5)); usage.sttCalls++;
        return res.json(out);
      } catch (e) {
        console.error(name + ' STT', e.message);
        errors.push(e.message);
      }
    }
    return res.status(502).json({ error: 'Speech recognition failed', detail: errors.join(' | ').slice(0, 400) });
  }
  // auto-detect: Murugan may speak Tamil even with the screen in English, and Tamil should come back in Tamil script
  const lang = process.env.SARVAM_STT_LANG || 'unknown';
  const secs = Math.min(60, Math.max(1, Number(req.query.secs) || 5));
  const ext = type.includes('wav') ? 'wav' : type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
  const attempt = async (fields) => {
    const fd = new FormData();
    fd.append('file', new Blob([req.body], { type }), 'speech.' + ext);
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    const r = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': SARVAM_KEY }, body: fd });
    return { ok: r.ok, status: r.status, body: await r.json().catch(async () => ({ error: await r.text() })) };
  };
  try {
    let out = await attempt({ model: process.env.SARVAM_STT_MODEL || 'saaras:v3', mode: 'transcribe', language_code: lang });
    if (!out.ok) out = await attempt({ model: 'saarika:v2.5', language_code: lang });
    if (!out.ok) { console.error('Sarvam STT', out.status, JSON.stringify(out.body).slice(0, 600)); return res.status(502).json({ error: 'Sarvam STT ' + out.status, detail: JSON.stringify(out.body).slice(0, 600) }); }
    usage.sttSeconds += secs; usage.sttCalls++;
    res.json({ transcript: out.body.transcript || '', language: out.body.language_code || lang });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

const PORT = Number(process.env.PORT || 3000);
// On Vercel the platform calls the exported app itself; locally (and on Render etc.) we listen on a port
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const ai = A.aiStatus();
    console.log(`Voxa sandbox on http://localhost:${PORT}  ·  AI: ${ai.ai ? ai.brainName + ' ' + ai.model : 'rules only (no API key)'}  ·  Voice: ${CARTESIA_KEY ? 'Cartesia English/Tamil/Hindi' : SARVAM_KEY ? 'Sarvam' : 'browser'}`);
  });
}
export default app;
