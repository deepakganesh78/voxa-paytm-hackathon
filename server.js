import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from './src/engine.js';
import * as A from './src/agent.js';
import * as CRM from './src/crm.js';
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

const SARVAM_KEY = process.env.SARVAM_API_KEY || '';
const RESET_PIN = process.env.RESET_PIN || '';

A.startAgent();
// customers on WhatsApp: loyalty after every payment, Udhar questions, alerts to Murugan if he switched them on
E.bus.on('payment_success', (txn) => { try { CRM.onPaymentSuccess(txn); } catch (e) { console.error(e); } });
// Murugan can ask Voxa from his own phone chat; the answer goes back to that chat
CRM.setOwnerChat(async (text) => (await A.chat(text, undefined)).reply);
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

app.get('/api/state', (req, res) => res.json({ ...E.getState(), planner: E.plannerInsights() }));
// Sarvam usage meter, to keep an eye on the hackathon credits.
// Rates used for the estimate (Sarvam pricing page): speech-to-text ₹0.49 a minute; Bulbul v3 ₹3 per 1,000 characters.
const usage = { ttsChars: 0, ttsCalls: 0, ttsCached: 0, sttSeconds: 0, sttCalls: 0 };
const credits = () => Math.round(((usage.ttsChars / 1000) * 3 + (usage.sttSeconds / 60) * 0.49) * 100) / 100;
app.get('/api/config', (req, res) => res.json({ ...A.aiStatus(), whatsapp: { live: CRM.WA_LIVE, provider: CRM.PROVIDER, bot: CRM.botUsername(), ownerCode: CRM.ownerCode(), from: CRM.twilioFrom(), joinText: CRM.joinText(), shopCode: CRM.SHOP_CODE }, sarvam: !!SARVAM_KEY, resetPin: !!RESET_PIN, sarvamUsage: { ...usage, estCredits: credits() } }));
app.get('/api/skills', (req, res) => res.json(SKILLS));

// small helper so every route returns {ok} or {error}
const route = (fn) => async (req, res) => {
  try {
    const out = await fn(req.body || {}, req);
    res.json({ ok: true, ...(out && typeof out === 'object' ? out : {}) });
  } catch (e) {
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
  return A.chat(text, b.lang);
}));
app.post('/api/merchant/bill', route(async (b) => {
  const image = typeof b.image === 'string' ? b.image.replace(/^data:[^,]+,/, '') : null;
  const mediaType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.mediaType) ? b.mediaType : 'image/jpeg';
  if (!image && !b.sample) throw new Error('Add a photo first.');
  if (image && image.length > 6_000_000) throw new Error('That photo is too big. Try again.');
  if (image && !b.sample && !(b.check && b.check.ok)) throw new Error('That does not look like a bill. Send a photo of a printed bill only.');
  return A.readBill({ image, mediaType, sample: b.sample || null, lang: b.lang, thumb: typeof b.thumb === 'string' && b.thumb.length < 40000 ? b.thumb : null });
}));
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
  for (const k of ['dailySummary', 'udharAlerts', 'stuckAlerts']) if (k in b) s[k] = !!b[k];
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

// ---------- Text to speech (Sarvam Bulbul), optional ----------
// The same sentence is never paid for twice: rehearsals replay from this cache.
const ttsCache = new Map();
app.post('/api/tts', async (req, res) => {
  if (!SARVAM_KEY) return res.status(404).json({ error: 'Sarvam not configured' });
  const text = String(req.body?.text || '').slice(0, 1400);
  const lang = SPEECH_CODES[req.body?.lang] || 'en-IN';
  const key = lang + '|' + text;
  if (ttsCache.has(key)) { usage.ttsCached++; return res.set('Content-Type', 'audio/wav').send(ttsCache.get(key)); }
  try {
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

// ---------- Speech to text (Sarvam), optional ----------
// The browser records a short clip (max ~15 s) and sends it here; we forward it to Sarvam.
// Saaras v3 in transcribe mode first; if that is refused, Saarika v2.5.
app.post('/api/stt', express.raw({ type: () => true, limit: '6mb' }), async (req, res) => {
  if (!SARVAM_KEY) return res.status(404).json({ error: 'Sarvam not configured' });
  // auto-detect: Murugan may speak Tamil even with the screen in English, and Tamil should come back in Tamil script
  const lang = process.env.SARVAM_STT_LANG || 'unknown';
  const secs = Math.min(60, Math.max(1, Number(req.query.secs) || 5));
  const type = (req.get('content-type') || 'audio/wav').split(';')[0].trim();
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
app.listen(PORT, () => {
  const ai = A.aiStatus();
  console.log(`Voxa sandbox on http://localhost:${PORT}  ·  AI: ${ai.ai ? ai.brainName + ' ' + ai.model : 'rules only (no API key)'}  ·  Voice: ${SARVAM_KEY ? 'Sarvam' : 'browser'}`);
});
