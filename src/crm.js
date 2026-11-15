// Customers on WhatsApp: join by QR, 7-day loyalty card, Udhaar (store credit) with a credit score.
// Messages go to REAL WhatsApp numbers through Twilio (sandbox for now). Nothing is faked on screen:
// if Twilio is not set up, messages are not sent and the app says WhatsApp is not connected.
import * as E from './engine.js';
import { rupee } from './i18n.js';
import * as WL from './wa-linked.js';
import * as TG from './telegram.js';

const SID = process.env.TWILIO_ACCOUNT_SID || '';
const TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const FROM = process.env.TWILIO_WHATSAPP_FROM || '';
// Meta's WhatsApp Cloud API (free test number). If these are set, Meta is used instead of Twilio.
const META_TOKEN = process.env.WA_META_TOKEN || '';
const META_PHONE_ID = process.env.WA_META_PHONE_ID || '';
const META_VERSION = process.env.WA_META_VERSION || 'v23.0';
export const META_VERIFY = process.env.WA_META_VERIFY || 'voxa-murugan-verify';
// WA_PROVIDER=linked: a real WhatsApp number linked like WhatsApp Web (free). Otherwise Meta, then Twilio.
// WA_PROVIDER picks the channel: telegram (demo), linked, meta or twilio. Without it: Telegram if its token is set, then Meta, then Twilio.
const WANT = process.env.WA_PROVIDER || '';
export const PROVIDER = WANT === 'telegram' && TG.TG_ON ? 'telegram' : WANT === 'linked' ? 'linked' : WANT === 'meta' && META_TOKEN ? 'meta' : WANT === 'twilio' && SID ? 'twilio'
  : TG.TG_ON ? 'telegram' : META_TOKEN && META_PHONE_ID ? 'meta' : SID && TOKEN && FROM ? 'twilio' : null;
export const WA_LIVE = !!PROVIDER;
let metaNumber = ''; // the test number's display number, for the QR poster
if (PROVIDER === 'meta') {
  fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_ID}?fields=display_phone_number`, { headers: { Authorization: 'Bearer ' + META_TOKEN } })
    .then((r) => r.json()).then((d) => { metaNumber = String(d.display_phone_number || '').replace(/[^\d+]/g, ''); if (d.error) console.error('Meta WhatsApp:', d.error.message); })
    .catch((e) => console.error('Meta WhatsApp:', e.message));
}
export const SHOP_CODE = process.env.VOXA_SHOP_CODE || 'MS-1042';
const JOIN_TEXT = `Join Murugan and Co rewards (${SHOP_CODE})`;
// how many visit days fill the loyalty card: Murugan sets it on the Customers page
const LD = () => Math.max(2, Math.min(30, Number((E.getState().crm || {}).loyaltyDays) || 7));
const DAY = 86400000;

const C = () => E.getState().crm;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
const id = (p) => p + Math.random().toString(36).slice(2, 8).toUpperCase();

// "+91 98xxxxxxxx" / "whatsapp:+9198..." / "98xxxxxxxx" → "+9198xxxxxxxx"
export function normPhone(p) {
  if (/^(lid|tg|upi):/.test(String(p || ''))) return String(p);
  let d = String(p || '').replace(/^whatsapp:/, '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return d;
  if (d.length === 10) return '+91' + d;
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  return '+' + d;
}
const mask = (p) => (p ? p.slice(0, 3) + ' ' + '•'.repeat(Math.max(0, p.length - 7)) + p.slice(-4) : '');

// ---------------- sending ----------------
const AUTH = () => 'Basic ' + Buffer.from(SID + ':' + TOKEN).toString('base64');
// One plain-text template ("{{1}}") in the Twilio account, created the first time it is needed and remembered.
async function textTemplate() {
  const c = C();
  if (c.contentSid) return c.contentSid;
  const r = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: { Authorization: AUTH(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendly_name: 'voxa_text', language: 'en', variables: { 1: 'Hello from Murugan and Co' }, types: { 'twilio/text': { body: '{{1}}' } } }),
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.sid) throw new Error('Could not create the WhatsApp template: ' + (d.message || r.status));
  c.contentSid = d.sid;
  E.log({ agent: 'whatsapp', source: 'twilio', type: 'tool', name: 'whatsapp_template', input: 'voxa_text', output: 'created ' + d.sid, ms: 0 });
  E.touch();
  return d.sid;
}

// Every message goes through here. Only a short log is kept (who, what, sent or why not); there is no chat screen.
export async function waSend(phone, text, opts = {}) {
  const to = normPhone(phone);
  const c = C();
  const entry = { id: id('W'), at: Date.now(), to: mask(to), text: String(text).slice(0, 500), status: 'not_sent' };
  c.waLog.unshift(entry);
  if (c.waLog.length > 60) c.waLog.length = 60;
  if (!WA_LIVE) { entry.status = 'not_sent'; entry.reason = 'WhatsApp not connected (add Meta or Twilio keys to .env)'; E.touch(); return entry; }
  if (!to) { entry.reason = 'no phone number'; E.touch(); return entry; }
  if (PROVIDER === 'telegram') {
    try {
      const chat = (C().tgChat && C().tgChat[to]) || (to.startsWith('tg:') ? to.slice(3) : null);
      if (!chat) throw new Error('This customer has not started the Telegram bot');
      entry.sid = await TG.send(chat, text, opts);
      entry.status = 'sent';
    } catch (e) { entry.status = 'failed'; entry.reason = e.message; }
    E.log({ agent: 'whatsapp', source: 'telegram', type: 'tool', name: 'message_send', input: mask(to), output: entry.status + (entry.reason ? ': ' + entry.reason : ''), ms: 0 });
    E.touch();
    return entry;
  }
  if (PROVIDER === 'linked') {
    try {
      const jid = (C().jids && C().jids[to]) || (to.startsWith('lid:') ? to.slice(4) + '@lid' : to.replace(/\D/g, '') + '@s.whatsapp.net');
      entry.sid = await WL.send(jid, text);
      entry.status = 'sent';
    } catch (e) { entry.status = 'failed'; entry.reason = e.message; }
    E.log({ agent: 'whatsapp', source: 'linked', type: 'tool', name: 'whatsapp_send', input: mask(to), output: entry.status + (entry.reason ? ': ' + entry.reason : ''), ms: 0 });
    E.touch();
    return entry;
  }
  if (PROVIDER === 'meta') {
    // Meta Cloud API: plain text is allowed within 24 hours of the customer's last message
    try {
      const r = await fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + META_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/\D/g, ''), type: 'text', text: { body: String(text).slice(0, 4000) } }),
        signal: AbortSignal.timeout(15000),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { entry.status = 'sent'; entry.sid = d.messages && d.messages[0] && d.messages[0].id; }
      else { entry.status = 'failed'; entry.reason = (d.error && (d.error.error_user_msg || d.error.message)) || r.statusText; if (d.error && d.error.code) entry.reason += ' (Meta ' + d.error.code + ')'; }
    } catch (e) { entry.status = 'failed'; entry.reason = e.message; }
    E.log({ agent: 'whatsapp', source: 'meta', type: 'tool', name: 'whatsapp_send', input: mask(to), output: entry.status + (entry.reason ? ': ' + entry.reason : ''), ms: 0 });
    E.touch();
    return entry;
  }
  try {
    const msg = String(text).slice(0, 1500);
    const post = (fields) => fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: AUTH(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: FROM, To: 'whatsapp:' + to, ...fields }),
      signal: AbortSignal.timeout(15000),
    });
    // Twilio's newer WhatsApp try-out number only sends through a stored template (error 21654),
    // so Voxa sends every message through one plain "{{1}}" template, created once.
    let r, d;
    if (!c.contentSid) { r = await post({ Body: msg }); d = await r.json().catch(() => ({})); }
    if (c.contentSid || (!r.ok && d.code === 21654)) {
      const sidT = await textTemplate();
      r = await post({ ContentSid: sidT, ContentVariables: JSON.stringify({ 1: msg.replace(/\s*\n+\s*/g, ' · ') }) });
      d = await r.json().catch(() => ({}));
    }
    if (r.ok) { entry.status = 'sent'; entry.sid = d.sid; }
    else { entry.status = 'failed'; entry.reason = (d.message || r.statusText) + (d.code ? ' (Twilio ' + d.code + ')' : ''); }
  } catch (e) {
    entry.status = 'failed'; entry.reason = e.message;
  }
  E.log({ agent: 'whatsapp', source: 'twilio', type: 'tool', name: 'whatsapp_send', input: mask(to), output: entry.status + (entry.reason ? ': ' + entry.reason : ''), ms: 0 });
  E.touch();
  return entry;
}

// To Murugan, only if he switched it on in the app (and that kind of message is on).
export function toMerchant(kind, text, opts) {
  const s = C().settings;
  if (!s.enabled) return null;
  if (kind && s[kind] === false) return null;
  return sendToOwner(text, opts);
}
// straight to Murugan: his linked bot chat, or his number
export function sendToOwner(text, opts) {
  const c = C(), s = c.settings;
  if (PROVIDER === 'telegram' && c.ownerChatId) return waSend('tg:' + c.ownerChatId, text, opts);
  if (!s.merchantPhone) return null;
  return waSend(s.merchantPhone, text, opts);
}
// Murugan asks Voxa from his phone: the server plugs Voxa's chat in here
let ownerChat = null;
export function setOwnerChat(fn) { ownerChat = fn; }
export function ownerCode() {
  const c = C();
  // with a bot, the code comes from its token: every server copy agrees on it and nobody can guess it
  if (TG.TG_ON) return 'OWNER-' + TG.SECRET.slice(0, 8).toUpperCase();
  if (!c.ownerCode) { c.ownerCode = 'OWNER-' + Math.random().toString(36).slice(2, 8).toUpperCase(); E.touch(); }
  return c.ownerCode;
}

// ---------------- customers ----------------
export const findByPhone = (p) => C().customers.find((x) => x.phone === normPhone(p));
export function findCustomer(q) {
  const s = String(q || '').toLowerCase().trim();
  if (!s) return null;
  const list = C().customers;
  return list.find((x) => x.phone === normPhone(q)) || list.find((x) => x.name.toLowerCase() === s) || list.find((x) => x.name.toLowerCase().includes(s) || s.includes(x.name.toLowerCase().split(' ')[0])) || null;
}
export function balanceOf(cu) {
  return cu.udhar.reduce((s, e) => s + (e.status !== 'confirmed' ? 0 : e.type === 'credit' ? e.amount : -e.amount), 0);
}
const loyaltyCount = (cu) => cu.visits.filter((d) => d > (cu.cardResetOn || '')).length;
const dots = (n) => '●'.repeat(n) + '○'.repeat(Math.max(0, LD() - n));

// A customer's payments at this shop (only when they linked their UPI name).
function paymentsOf(cu) {
  if (!cu.upiName) return [];
  return E.getState().txns.filter((t) => t.kind === 'payment' && t.status === 'success' && t.fromName === cu.upiName);
}

// ---------------- incoming WhatsApp ----------------
// Called by the Twilio webhook for every message a customer (or Murugan) sends to the WhatsApp number.
// every message is handled once, whether it arrives by webhook or by checking Twilio
const handled = new Set();
export async function handleIncoming(fromRaw, profileName, bodyRaw, sid = null) {
  if (sid) { if (handled.has(sid)) return; handled.add(sid); }
  const phone = normPhone(fromRaw);
  const text = String(bodyRaw || '').trim();
  const t = text.toLowerCase();
  const c = C();
  const name = String(profileName || '').trim() || 'Customer';
  E.log({ agent: 'whatsapp', source: 'twilio', type: 'event', name: 'whatsapp_in', input: mask(phone), output: text.slice(0, 80), ms: 0 });

  // Murugan himself, from his own WhatsApp: "confirm" / "reject" a waiting repayment
  if (c.settings.merchantPhone && phone === normPhone(c.settings.merchantPhone)) {
    const waiting = c.customers.flatMap((cu) => cu.udhar.filter((e) => e.status === 'pending').map((e) => ({ cu, e })));
    if (/^(confirm|yes|ok|சரி)/i.test(t) && waiting.length) { const w = waiting[0]; confirmRepay(w.e.id); return; }
    if (/^(reject|no)/i.test(t) && waiting.length) { rejectRepay(waiting[0].e.id); return; }
    await waSend(phone, waiting.length ? `Reply CONFIRM if ${waiting[0].cu.name} paid back ${rupee(waiting[0].e.amount)}, or REJECT.` : 'Voxa here. Nothing is waiting for you right now.');
    return;
  }

  let cu = findByPhone(phone);

  // STOP: leave and delete everything about them
  if (/^(stop|unsubscribe|நிறுத்து)\b/i.test(t)) {
    if (cu) {
      const owed = balanceOf(cu);
      c.customers = c.customers.filter((x) => x !== cu);
      E.notify('merchant', { kind: 'voxa', text: `${cu.name} left your WhatsApp list; their details are deleted.${owed > 0 ? ' They still owed ' + rupee(owed) + ' on Udhaar.' : ''}`, speak: false });
      toMerchant('udharAlerts', `${cu.name} left your Murugan and Co list.${owed > 0 ? ' They owed ' + rupee(owed) + ' on Udhaar.' : ''}`);
      E.touch();
    }
    await waSend(phone, 'You have left Murugan and Co rewards. All your details are deleted. Send JOIN any time to come back.');
    return;
  }

  // join (from the QR poster's pre-typed message, or "join"/"hi")
  if (!cu) {
    if (!/join|reward|ms-\d|^\/start|^hi\b|^hello|வணக்கம்/i.test(t)) {
      await waSend(phone, `Welcome to Murugan and Co. Send "JOIN" to get our rewards card.`);
      return;
    }
    cu = { id: id('C'), phone, name, joinedAt: Date.now(), upiName: null, visits: [], cardResetOn: '', rewards: 0, udhar: [], pendingLink: null };
    c.customers.unshift(cu);
    // the latest payment at this shop in the last 10 minutes that nobody has claimed: ask if it was theirs
    const claimed = new Set(c.customers.map((x) => x.upiName).filter(Boolean));
    const recent = E.getState().txns.find((x) => x.kind === 'payment' && x.status === 'success' && Date.now() - x.createdAt < 10 * 60000 && !claimed.has(x.fromName));
    E.notify('merchant', { kind: 'voxa', text: `${name !== 'Customer' ? name : 'A new customer'} joined your customer list on WhatsApp.`, speak: false });
    E.touch();
    const placeholder = c.customers.find((x) => x !== cu && x.addedByOwner && String(x.phone).startsWith('upi:'));
    if (placeholder) {
      cu.pendingMerge = placeholder.id;
      await waSend(phone, `Welcome to Murugan and Co rewards${name !== 'Customer' ? ', ' + name : ''}! Murugan already started a rewards card for ${placeholder.upiName} (${loyaltyCount(placeholder)} of ${LD()} visits). Is that you? Reply YES to get it here, or NO.`);
    } else if (recent) {
      cu.pendingLink = recent.id;
      await waSend(phone, `Welcome to Murugan and Co rewards${name !== 'Customer' ? ', ' + name : ''}! Was your payment just now ${rupee(recent.amount)} at ${E.timeLabel(recent.createdAt)}? Reply YES to link it (your visits then count automatically), NO, or SKIP if you don't pay by UPI.`);
    } else {
      await waSend(phone, `Welcome to Murugan and Co rewards${name !== 'Customer' ? ', ' + name : ''}! Pay by UPI as usual: each visit fills your card. After ${LD()} visits you get ${c.reward}. Reply STOP any time to leave.`);
      if (phone.startsWith('tg:')) await waSend(phone, 'One more step: tap the button below to share your phone number, so Murugan can keep your Udhaar (credit) under your number.');
    }
    return;
  }

  // already on the list and scanned the poster again: welcome them again and offer to link today's payment
  if (/join|ms-\d/i.test(t)) {
    if (name && name !== 'Customer' && (!cu.name || cu.name === 'Customer')) cu.name = name;
    const claimed = new Set(c.customers.filter((x) => x !== cu).map((x) => x.upiName).filter(Boolean));
    const recent = !cu.upiName && E.getState().txns.find((x) => x.kind === 'payment' && x.status === 'success' && Date.now() - x.createdAt < 10 * 60000 && !claimed.has(x.fromName));
    E.touch();
    if (recent) { cu.pendingLink = recent.id; await waSend(phone, `Welcome back to Murugan and Co rewards! Was your payment just now ${rupee(recent.amount)} at ${E.timeLabel(recent.createdAt)}? Reply YES to link it, NO, or SKIP if you don't pay by UPI.`); }
    else await waSend(phone, `You're on Murugan and Co rewards. Your card: ${dots(loyaltyCount(cu))} (${loyaltyCount(cu)} of ${LD()}).`);
    return;
  }

  // claim a card Murugan started from a UPI payment
  if (cu.pendingMerge && /^(yes|y|ஆம்|हाँ)\b/i.test(t)) {
    const old = c.customers.find((x) => x.id === cu.pendingMerge);
    cu.pendingMerge = null;
    if (old) claimCard(cu, old);
    E.touch();
    await waSend(phone, `Done! Your card: ${dots(loyaltyCount(cu))} (${loyaltyCount(cu)} of ${LD()}). After ${LD()} visits you get ${c.reward}.`);
    if (cu.phone.startsWith('tg:')) await waSend(phone, 'One more step: tap the button below to share your phone number, so Murugan can keep your Udhaar (credit) under your number.');
    return;
  }
  if (cu.pendingMerge && /^(no|n|skip)\b/i.test(t)) { cu.pendingMerge = null; E.touch(); await waSend(phone, 'OK, you are on the list.'); return; }

  // link their UPI payment
  if (cu.pendingLink && /^(yes|y|ஆம்|हाँ)\b/i.test(t)) {
    const txn = E.findTxn(cu.pendingLink);
    cu.pendingLink = null;
    if (txn) {
      // Murugan may already have started a card for this payer: take it over instead of making a second one
      const started = c.customers.find((x) => x !== cu && x.addedByOwner && x.upiName === txn.fromName);
      if (started) claimCard(cu, started);
      else {
        cu.upiName = txn.fromName;
        if (!cu.name || cu.name === 'Customer') { const p = E.payerById(txn.payerId); cu.name = (p && p.fullName) || txn.fromName; }
        addVisit(cu, txn, false);
      }
    }
    E.touch();
    await waSend(phone, `Linked. Your card: ${dots(loyaltyCount(cu))} (${loyaltyCount(cu)} of ${LD()}). After ${LD()} visits you get ${c.reward}.`);
    if (cu.phone.startsWith('tg:')) await waSend(phone, 'One more step: tap the button below to share your phone number, so Murugan can keep your Udhaar (credit) under your number.');
    return;
  }
  if (cu.pendingLink && /^(no|n|skip)\b/i.test(t)) {
    cu.pendingLink = null; E.touch();
    await waSend(phone, 'OK, you are on the list.');
    return;
  }

  // card / balance
  if (/card|loyal|visit|அட்டை/i.test(t)) {
    await waSend(phone, `Your Murugan and Co card: ${dots(loyaltyCount(cu))} (${loyaltyCount(cu)} of ${LD()}). Reward at ${LD()}: ${c.reward}.`);
    return;
  }
  if (/balance|Udhaar|udhar|due|kadan|கணக்கு|கடன்|பாக்கி/i.test(t) && !/paid/i.test(t)) {
    const b = balanceOf(cu);
    await waSend(phone, b > 0 ? `Your Udhaar at Murugan and Co: ${rupee(b)} due.` : 'Nothing is due on your Udhaar at Murugan and Co.');
    return;
  }

  // "paid 500" / "paid back" → waiting for Murugan to confirm
  const m = t.match(/paid\s*(?:back)?\s*(?:rs\.?|₹)?\s*([\d,]+)?/i) || t.match(/கட்டி(?:னேன்|ட்டேன்)\s*([\d,]+)?/);
  if (m) {
    const owed = balanceOf(cu);
    if (owed <= 0) { await waSend(phone, 'Nothing is due on your Udhaar at Murugan and Co. Thank you!'); return; }
    const amt = Math.min(owed, Number(String(m[1] || '').replace(/,/g, '')) || owed);
    repayClaim(cu, amt, 'customer said on WhatsApp');
    await waSend(phone, `Thanks! I have asked Murugan to confirm ${rupee(amt)} paid back. You will get your new balance here.`);
    return;
  }

  // anything else goes to Murugan, not a menu of commands
  E.notify('merchant', { kind: 'voxa', text: `Message from ${cu.name}: "${text.slice(0, 120)}"`, speak: false });
  toMerchant('udharAlerts', `Message from ${cu.name}: "${text.slice(0, 200)}"`);
  await waSend(phone, 'Thanks, Murugan and Co has your message.');
}

// ---------------- loyalty ----------------
// a customer takes over the card Murugan started from a UPI payment (visits, rewards and Udhaar move across)
function claimCard(cu, old) {
  cu.upiName = old.upiName;
  cu.visits = [...new Set([...old.visits, ...cu.visits])].sort();
  cu.cardResetOn = old.cardResetOn || cu.cardResetOn;
  cu.rewards += old.rewards;
  cu.udhar = [...old.udhar, ...cu.udhar];
  if (old.name && (!cu.name || cu.name === 'Customer')) cu.name = old.name;
  const c = C();
  c.customers = c.customers.filter((x) => x !== old);
}
function addVisit(cu, txn, announce = true) {
  // one visit per payment (demo setting) or one per day; ISO times sort after plain dates, so both mix safely
  const d = C().perPayment !== false ? new Date(txn.createdAt).toISOString() : new Date(txn.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (cu.visits.includes(d)) return false;
  cu.visits.push(d);
  const n = loyaltyCount(cu);
  if (n >= LD()) {
    cu.rewards++;
    cu.cardResetOn = d;
    if (announce) waSend(cu.phone, `🎉 Thanks for visiting Murugan and Co! Your card is full: ${LD()} of ${LD()}. You get ${C().reward}. Show this message at the counter.`);
    E.notify('merchant', { kind: 'voxa', text: `${cu.name} completed the ${LD()}-day card. Reward: ${C().reward}.`, speak: true });
  } else if (announce) {
    waSend(cu.phone, `Thanks for visiting Murugan and Co! Your card: ${dots(n)} (${n} of ${LD()}). ${LD() - n === 1 ? 'One more visit' : LD() - n + ' more visits'} to get ${C().reward}.`);
  }
  E.touch();
  return true;
}

// every successful payment: loyalty for a linked customer (and a question to Murugan if they owe Udhaar);
// from anyone else, an offer to add them to the loyalty programme
export function onPaymentSuccess(txn) {
  const cu = C().customers.find((x) => x.upiName && x.upiName === txn.fromName);
  if (!cu) { offerLoyalty(txn); return; }
  addVisit(cu, txn, true);
  const owed = balanceOf(cu);
  if (owed > 0) repayClaim(cu, Math.min(owed, txn.amount), `UPI payment ${rupee(txn.amount)} at ${E.timeLabel(txn.createdAt)}: is this a Udhaar repayment?`, txn.id);
}

// A payment from someone who is not on the loyalty programme:
// 1. customers who already joined (scanned the QR) but never linked a payment are asked "Was that you?" (YES / NO buttons)
// 2. Murugan gets a message with an "Add to loyalty programme" button
function offerLoyalty(txn) {
  const c = C();
  if (txn.kind && txn.kind !== 'payment') return;
  if (txn.loyaltyOffered) return;
  txn.loyaltyOffered = true;
  const when = E.timeLabel(txn.createdAt);
  const unlinked = c.customers.filter((x) => !x.upiName && !x.pendingLink && !String(x.phone).startsWith('upi:')).slice(0, 5);
  for (const x of unlinked) {
    x.pendingLink = txn.id;
    waSend(x.phone, `Thanks for paying Murugan and Co ${rupee(txn.amount)} at ${when}! Was that you? Reply YES to add this visit to your rewards card, or NO.`);
  }
  toMerchant('loyaltyAlerts', `${rupee(txn.amount)} from ${txn.fromName} at ${when}. ${txn.fromName} is not on your loyalty programme yet.`,
    { inline: [[{ text: `➕ Add ${txn.fromName} to loyalty programme`, callback_data: 'addloy:' + txn.id }]] });
}

// Murugan tapped "Add to loyalty programme": a card is started from their UPI name, and the visit is counted.
// When that customer later scans the QR poster in Telegram, they are asked to claim this card (see the join step).
export function addToLoyalty(txnId) {
  const c = C();
  const txn = E.findTxn(txnId);
  if (!txn) return { ok: false, text: 'I could not find that payment any more.' };
  const existing = c.customers.find((x) => x.upiName && x.upiName === txn.fromName);
  if (existing) return { ok: true, text: `${existing.name} is already on the loyalty programme. Card: ${dots(loyaltyCount(existing))} (${loyaltyCount(existing)} of ${LD()}).` };
  const p = E.payerById(txn.payerId);
  const cu = { id: id('C'), phone: 'upi:' + txn.fromName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: (p && p.fullName) || txn.fromName, joinedAt: Date.now(), upiName: txn.fromName, visits: [], cardResetOn: '', rewards: 0, udhar: [], pendingLink: null, addedByOwner: true };
  c.customers.unshift(cu);
  addVisit(cu, txn, false);
  E.touch();
  return { ok: true, text: `Added ${cu.name} to the loyalty programme. Card: ${dots(loyaltyCount(cu))} (${loyaltyCount(cu)} of ${LD()}). Every UPI payment from them now fills the card. They can scan your poster QR to get the card in Telegram.` };
}

// ---------------- Udhaar ----------------
export function addCredit(cu, amount, note = '') {
  const a = Math.round(Number(amount));
  if (!(a > 0)) throw new Error('Enter an amount');
  cu.udhar.push({ id: id('U'), type: 'credit', amount: a, note: String(note).slice(0, 120), at: Date.now(), status: 'confirmed' });
  E.touch();
  const b = balanceOf(cu);
  waSend(cu.phone, `Murugan and Co: ${rupee(a)} added to your Udhaar${note ? ' (' + note + ')' : ''}. Total due: ${rupee(b)}.`);
  return { balance: b };
}
export function repayClaim(cu, amount, why = '', txnId = null) {
  const e = { id: id('U'), type: 'repay', amount: Math.round(amount), note: why, at: Date.now(), status: 'pending', txnId };
  cu.udhar.push(e);
  E.notify('merchant', { kind: 'voxa', text: `${cu.name} says they paid back ${rupee(e.amount)} on their Udhaar. Confirm it on the Customers page.`, speak: true });
  toMerchant('udharAlerts', `Voxa: ${cu.name} paid back ${rupee(e.amount)} on their Udhaar? ${why ? '(' + why + ') ' : ''}Reply CONFIRM or REJECT, or confirm in the app.`);
  E.touch();
  return e;
}
function findEntry(entryId) {
  for (const cu of C().customers) { const e = cu.udhar.find((x) => x.id === entryId); if (e) return { cu, e }; }
  return null;
}
export function confirmRepay(entryId) {
  const f = findEntry(entryId);
  if (!f || f.e.status !== 'pending') throw new Error('Nothing to confirm');
  f.e.status = 'confirmed'; f.e.confirmedAt = Date.now();
  E.touch();
  const b = balanceOf(f.cu);
  waSend(f.cu.phone, `Murugan and Co confirmed ${rupee(f.e.amount)} paid back. ${b > 0 ? 'Udhaar still due: ' + rupee(b) + '.' : 'Your Udhaar is fully cleared. Thank you!'}`);
  return { balance: b };
}
export function rejectRepay(entryId) {
  const f = findEntry(entryId);
  if (!f || f.e.status !== 'pending') throw new Error('Nothing to reject');
  f.e.status = 'rejected';
  E.touch();
  waSend(f.cu.phone, `Murugan and Co could not match a ${rupee(f.e.amount)} repayment. Please talk to Murugan at the shop.`);
}

// Credit score from what the shop really knows: visits, how they paid back before, what they owe now.
export function creditScore(cu, ask = 0) {
  const now = Date.now();
  const visits30 = cu.visits.filter((d) => now - new Date(d).getTime() < 30 * DAY).length;
  const pays = paymentsOf(cu);
  const avgBill = pays.length ? Math.round(pays.reduce((s, t) => s + t.amount, 0) / pays.length) : null;
  const credits = cu.udhar.filter((e) => e.type === 'credit');
  const repays = cu.udhar.filter((e) => e.type === 'repay' && e.status === 'confirmed');
  const owed = balanceOf(cu);
  // days from each credit until the balance it created was cleared (simple: next confirmed repayments)
  let onTime = 0, late = 0;
  credits.forEach((cr) => { const r = repays.find((x) => x.at >= cr.at); if (!r) return; ((r.confirmedAt || r.at) - cr.at <= 15 * DAY ? onTime++ : late++); });
  let score = 40;
  score += Math.min(25, visits30 * 4);
  score += Math.min(25, onTime * 10) - late * 10;
  if (owed > 0) score -= Math.min(25, owed / 200);
  if (now - cu.joinedAt < 3 * DAY && !credits.length) score = Math.min(score, 50);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 70 ? 'Low risk' : score >= 45 ? 'Medium risk' : 'High risk';
  const limit = score >= 70 ? 3000 : score >= 45 ? 1000 : 300;
  const reasons = [
    visits30 ? `Visits ${visits30} days in the last month${avgBill ? ', average bill ' + rupee(avgBill) : ''}` : 'No visits recorded yet',
    credits.length ? `Used Udhaar ${credits.length} time(s); paid back on time ${onTime}, late ${late}` : 'Never used Udhaar here before',
    owed > 0 ? `Owes ${rupee(owed)} now` : 'Owes nothing now',
  ];
  const verdict = ask ? (ask <= limit - Math.max(0, owed) ? 'yes' : ask <= limit ? 'careful' : 'no') : null;
  return { score, label, suggested_limit: limit, owes_now: owed, reasons, ...(ask ? { asked: ask, verdict } : {}) };
}

// ---------------- daily update to Murugan ----------------
export function dailySummaryText() {
  const S = E.getState();
  const t = E.salesToday();
  const days = S.history.days;
  const usual = Math.round(days.slice(-30).reduce((a, d) => a + d.total, 0) / Math.max(1, Math.min(30, days.length)));
  const stuck = S.txns.filter((x) => x.kind === 'payment' && x.status === 'pending');
  const owedAll = C().customers.reduce((s, cu) => s + Math.max(0, balanceOf(cu)), 0);
  const top = C().customers.map((cu) => ({ cu, n: loyaltyCount(cu) })).sort((a, b) => b.n - a.n).filter((x) => x.n > 0).slice(0, 3);
  return [
    `Voxa daily update, Murugan and Co: ${t.bills} payments today, ${rupee(t.total)} (a usual day: ${rupee(usual)}).`,
    stuck.length ? `Stuck: ${stuck.map((x) => x.fromName + ' ' + rupee(x.amount)).join(', ')}.` : 'No stuck payments.',
    owedAll ? `Udhaar due from customers: ${rupee(owedAll)}.` : '',
    top.length ? `Most regular this week: ${top.map((x) => x.cu.name + ' (' + x.n + '/' + LD() + ')').join(', ')}.` : '',
  ].filter(Boolean).join('\n');
}
// checks once a minute; sends at the time Murugan picked, once a day
let lastSummaryDay = '';
setInterval(() => {
  const s = C() && C().settings;
  if (!s || !s.enabled || !s.dailySummary || !s.merchantPhone) return;
  const hm = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  if (hm === s.summaryTime && lastSummaryDay !== today()) { lastSummaryDay = today(); toMerchant('dailySummary', dailySummaryText()); }
}, 30000).unref?.();

// ---------------- checking Twilio for new messages ----------------
// Twilio's newer "Try out WhatsApp" sandbox has no webhook setting, so Voxa asks Twilio every few seconds
// for messages sent to the sandbox number. Old messages are skipped on start.
let pollReady = false, pollBusy = false;
async function pollInbound() {
  if (!WA_LIVE || pollBusy) return;
  pollBusy = true;
  try {
    const q = new URLSearchParams({ To: FROM, PageSize: '20' });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json?${q}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(SID + ':' + TOKEN).toString('base64') },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return;
    const d = await r.json();
    const msgs = (d.messages || []).filter((m) => String(m.direction).startsWith('inbound')).reverse(); // oldest first
    if (!pollReady) { msgs.forEach((m) => handled.add(m.sid)); pollReady = true; return; }
    for (const m of msgs) if (!handled.has(m.sid)) await handleIncoming(m.from, '', m.body, m.sid);
  } catch { /* try again next time */ } finally { pollBusy = false; }
}
if (PROVIDER === 'twilio' && process.env.VOXA_WA_POLL !== 'off') { pollInbound(); setInterval(pollInbound, Number(process.env.VOXA_WA_POLL_MS || 4000)).unref?.(); }

export const joinText = () => JOIN_TEXT;
// the WhatsApp number customers message (for the QR poster)
export const twilioFrom = () => (PROVIDER === 'linked' ? WL.link.me || '' : PROVIDER === 'meta' ? metaNumber : FROM.replace(/^whatsapp:/, ''));
export const unlink = () => WL.logout();
export const botUsername = () => TG.bot.username;
export function unlinkOwner() { const c = C(); c.ownerChatId = null; c.ownerName = null; E.touch(); }

// Telegram: customers start the bot from the poster, then can share their phone with one tap
if (PROVIDER === 'telegram') {
  TG.start(async ({ chatId, name, text, contactPhone, id, callback }) => {
    const c = C();
    c.tgChat = c.tgChat || {};
    // a tap on a button under one of Voxa's messages
    if (callback) {
      if (!(c.ownerChatId && String(chatId) === String(c.ownerChatId))) return;
      if (callback.startsWith('addloy:')) { const r = addToLoyalty(callback.slice(7)); await waSend('tg:' + chatId, r.text); }
      return;
    }
    const raw = String(text || '');
    // Murugan links his own chat by scanning the owner QR on the WhatsApp page
    if (raw.startsWith('/start ') && raw.slice(7).trim() === ownerCode()) {
      c.ownerChatId = chatId; c.ownerName = name || 'Murugan'; c.settings.enabled = true; E.touch();
      E.notify('merchant', { kind: 'voxa', text: 'Your phone is linked. You can now ask Voxa anything from the chat.', speak: false });
      await waSend('tg:' + chatId, `Hello ${name || 'Murugan'}! This chat is now linked to Murugan and Co. Ask me anything: "How were sales this week?", "Any stuck payments?", "Who owes me money?". I will also send your updates here.`);
      return;
    }
    if (c.ownerChatId && String(chatId) === String(c.ownerChatId)) {
      const t = raw.trim();
      const waiting = c.customers.flatMap((cu) => cu.udhar.filter((e) => e.status === 'pending').map((e) => ({ cu, e })));
      if (/^(confirm|yes|ok|சரி)\b/i.test(t) && waiting.length) { confirmRepay(waiting[0].e.id); await waSend('tg:' + chatId, `Confirmed: ${waiting[0].cu.name} paid back ${rupee(waiting[0].e.amount)}.`); return; }
      if (/^(reject|not paid)\b/i.test(t) && waiting.length) { rejectRepay(waiting[0].e.id); await waSend('tg:' + chatId, 'Marked as not paid.'); return; }
      if (/^\/start/.test(t)) { await waSend('tg:' + chatId, 'You are linked as the owner. Ask me anything about your shop.'); return; }
      if (!ownerChat) { await waSend('tg:' + chatId, 'Voxa is starting up, try again in a moment.'); return; }
      let reply = '';
      try { reply = await ownerChat(t); } catch { reply = ''; }
      reply = reply || 'Sorry, I could not answer that.';
      // keep his questions and Voxa's answers, so the For Murugan tab shows them
      c.ownerLog = [{ q: t.slice(0, 300), a: reply.slice(0, 600), at: Date.now() }, ...(c.ownerLog || [])].slice(0, 12);
      E.touch();
      await waSend('tg:' + chatId, reply);
      return;
    }
    // Murugan can also link by sharing his number, if it matches the number he saved on the For Murugan tab
    if (contactPhone && c.settings.merchantPhone && normPhone(contactPhone) === normPhone(c.settings.merchantPhone)) {
      c.ownerChatId = chatId; c.ownerName = name || 'Murugan'; c.settings.enabled = true; E.touch();
      await waSend('tg:' + chatId, `Hello ${name || 'Murugan'}! Your number matches Murugan and Co, so this chat is now linked as the owner. Ask me anything about your shop.`);
      return;
    }
    const tgKey = 'tg:' + chatId;
    const known = Object.keys(c.tgChat).find((p) => String(c.tgChat[p]) === String(chatId) && !p.startsWith('tg:'));
    let phone = known || tgKey;
    c.tgChat[tgKey] = chatId;
    if (contactPhone) {
      const real = normPhone(contactPhone);
      c.tgChat[real] = chatId;
      const cu = c.customers.find((x) => x.phone === phone || x.phone === tgKey);
      if (cu && cu.phone !== real && !c.customers.some((x) => x !== cu && x.phone === real)) cu.phone = real;
      E.touch();
      if (cu) await waSend(real, `Thanks ${cu.name !== 'Customer' ? cu.name : ''}! Your number is saved with Murugan and Co.`.replace(' !', '!'));
      else await handleIncoming(real, name, 'Join', id);
      return;
    }
    const t = String(text || '');
    await handleIncoming(phone, name, t.startsWith('/start') ? 'Join ' + t.slice(6).trim() : t, id);
  }).catch((e) => console.error('[telegram]', e.message));
}

// start the linked number (shows a QR on the Customers page until it is scanned)
if (PROVIDER === 'linked') {
  setTimeout(() => WL.start({
    onMessage: async ({ phone, jid, name, text, id }) => {
      const c = C();
      c.jids = c.jids || {};
      c.jids[normPhone(phone)] = jid; // reply to the exact chat the message came from
      await handleIncoming(phone, name, text, id);
    },
    onStatus: (l) => { const c = C(); if (!c) return; c.link = { status: l.status, qr: l.qr, me: l.me, error: l.error }; E.touch(); },
  }).catch((e) => console.error('whatsapp link', e.message)), 300);
}

// Meta sends incoming messages to our webhook in this shape
export async function handleMetaWebhook(body) {
  for (const entry of (body && body.entry) || []) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {};
      const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile && c.profile.name]));
      // delivery reports: show why a message did not reach the phone
      for (const st of v.statuses || []) {
        const e = (C().waLog || []).find((w) => w.sid === st.id);
        if (e) { e.status = st.status === 'failed' ? 'failed' : st.status; if (st.errors && st.errors[0]) e.reason = (st.errors[0].title || st.errors[0].message || '') + ' (Meta ' + st.errors[0].code + ')' + (st.errors[0].error_data && st.errors[0].error_data.details ? ': ' + st.errors[0].error_data.details : ''); }
        E.log({ agent: 'whatsapp', source: 'meta', type: 'event', name: 'whatsapp_status', input: String(st.recipient_id || '').slice(-4), output: st.status + (st.errors && st.errors[0] ? ': ' + (st.errors[0].title || st.errors[0].message) + ' (' + st.errors[0].code + ')' : ''), ms: 0 });
        E.touch();
      }
      for (const m of v.messages || []) {
        const text = m.type === 'text' ? m.text.body : m.type === 'button' ? m.button.text : m.type === 'interactive' ? (m.interactive.button_reply || m.interactive.list_reply || {}).title : '';
        if (text) await handleIncoming('+' + m.from, names[m.from] || '', text, m.id);
      }
    }
  }
}
