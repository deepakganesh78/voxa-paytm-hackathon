import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The fake-money payment engine. State lives in memory and is saved to .data/state.json, so it survives restarts.
import { EventEmitter } from 'node:events';
import * as shared from './shared.js';
import { buildSeed } from './seed.js';
import { msg, rupee } from './i18n.js';

export const bus = new EventEmitter();
let S;

const STEP_DEFS = [
  { key: 'app', label: 'Voxa Pay sends the request' },
  { key: 'debit', label: 'Voxa Bank debits the customer' },
  { key: 'switch', label: 'NPCI switch routes it' },
  { key: 'credit', label: "Merchant's account is credited" },
  { key: 'confirm', label: 'Confirmation back to both apps' },
];

export const BIG_AMOUNT = 10000;
const LOAN_PCT = 4;

const now = () => Date.now();
const pad = (n, w) => String(n).padStart(w, '0');
const randDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

export function deadlineLabel(fromMs, days = 5) {
  const d = new Date(fromMs);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
export function timeLabel(ms) {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

function initial() {
  const seed = buildSeed();
  return {
    rev: 0,
    startedAt: now(),
    customer: { id: 'sanjeevi', name: 'Sanjeevi', fullName: 'Patnam Sanjeevi', vpa: 'sanjeevi@voxabank', bankName: 'Voxa Bank', acct: 'XXXX 4521', balance: 25000 },
    // more customers with their own payment screen (/naveen)
    payers: { naveen: { id: 'naveen', name: 'Naveen', fullName: 'Naveen Roshan', vpa: 'naveen@voxabank', bankName: 'Voxa Bank', acct: 'XXXX 3307', balance: 25000 } },
    merchant: {
      id: 'murugan', name: 'Murugan and Co', owner: 'Murugan', area: 'Mylapore, Chennai', vpa: 'murugan@voxapay',
      bankName: 'Voxa Bank', acct: 'XXXX 7788', bankBalance: 48200, unsettled: seed.todaySoFar, lang: 'en',
    },
    bankMode: 'normal', // behaviour of the NEXT payment: normal | timeout | decline
    scenario: { holdNextSettlement: false, doubleDeductionNext: false },
    txns: [],
    tickets: [],
    agentLog: [],
    notes: { merchant: [], customer: [] },
    offers: [],
    settlements: [],
    bankRequests: [],
    loan: { status: 'offered', type: 'fixed', amount: 150000, months: 12, rate: 24, emi: 0, daily: 0, totalRepay: 0, outstanding: 0, repaid: 0, startedAt: null },
    expenses: [],
    cashSales: [],
    board: [],
    history: seed,
    chat: [],
    chatSessions: [],
    // changes Voxa proposed in the chat; nothing happens until the merchant confirms
    actions: [],
    // customers who joined on WhatsApp (loyalty card, Udhar) and Murugan's WhatsApp settings
    crm: {
      customers: [],
      waLog: [],
      reward: '₹150 off your next bill',
      loyaltyDays: 7,
      perPayment: true, // demo: every payment counts as a visit (off = one per day)
      settings: { enabled: false, merchantPhone: process.env.VOXA_MERCHANT_PHONE || '', dailySummary: true, summaryTime: '21:00', udharAlerts: true, stuckAlerts: true, loyaltyAlerts: true },
    },
    nextTicket: 48217,
    nextTxn: 1,
    nextSettlement: 1,
  };
}

export function getState() { return S; }

// ---------- sharing the demo data between server copies (Vercel) ----------
// S.rev is a timestamp-like revision, so "newest wins" works across copies. A copy that has just started is behind
// (rev 0), so it first adopts what is shared and never overwrites it with its own starting data.
export const sharedEnabled = shared.enabled;
const STATE_KEY = 'voxa-state-v1', REV_KEY = 'voxa-rev-v1';
let dirty = false, syncing = null, publishing = null, lastSync = 0;

// Writes this copy's data to the shared store if it has changed since the last write.
export function flushShared() {
  if (!shared.enabled || !dirty) return Promise.resolve();
  if (publishing) return publishing;
  publishing = (async () => {
    try {
      const rev = S.rev;
      dirty = false;
      await shared.set(STATE_KEY, { rev, state: S });
      await shared.set(REV_KEY, rev);
      lastSync = Date.now();
    } catch (e) { dirty = true; console.error('shared publish failed:', e.message); } finally { publishing = null; }
  })();
  return publishing;
}

// Adopts newer shared data (or publishes ours, if ours is newer). Called before every API request.
export function syncShared() {
  if (!shared.enabled) return Promise.resolve();
  if (syncing) return syncing;
  if (Date.now() - lastSync < 300) return Promise.resolve();
  syncing = (async () => {
    try {
      const remoteRev = Number(await shared.get(REV_KEY)) || 0;
      if (remoteRev > S.rev) {
        const doc = await shared.get(STATE_KEY);
        if (doc && doc.state && doc.rev > S.rev) {
          shared.mergeInto(S, doc.state);
          S.rev = doc.rev;
          dirty = false;
          bus.emit('change');
        }
      } else if (dirty) await flushShared();
    } catch (e) { console.error('shared sync failed:', e.message); } finally { lastSync = Date.now(); syncing = null; }
  })();
  return syncing;
}

let touchTimer = null;
export function touch() {
  S.rev = Math.max(S.rev + 1, Date.now());
  dirty = true;
  if (touchTimer) return;
  touchTimer = setTimeout(() => { touchTimer = null; bus.emit('change'); save(); shared.keepAlive(flushShared()); }, 60);
}

// The demo data is saved to .data/state.json, so restarting the server (for a new key or new code)
// keeps everyone's payments, tickets and notes. Only "Reset demo" clears them.
// Vercel's disk is read-only except /tmp, and the data is kept in the shared cache there instead.
const FILE_PERSIST = process.env.VOXA_PERSIST !== 'off' && !process.env.VERCEL;
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
let saveTimer = null;
function save() {
  if (!FILE_PERSIST || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(S)); fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); } catch (e) { console.error('save failed', e.message); }
  }, 300);
}
function load() {
  if (!FILE_PERSIST) return null;
  try {
    const x = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    delete x.planner;
    // keep a copy of every day's data before anything can overwrite it
    try { fs.copyFileSync(DATA_FILE, path.join(DATA_DIR, `backup-${new Date().toISOString().slice(0, 10)}.json`)); } catch { /* best effort */ }
    // the shop was renamed: older saved data takes the new name
    if (x.merchant && x.merchant.name === 'Murugan Stores') x.merchant.name = 'Murugan and Co';
    if (x.crm && x.crm.reward === '₹50 off your next bill') x.crm.reward = '₹150 off your next bill';
    (x.txns || []).forEach((t) => { if (t.toName === 'Murugan Stores') t.toName = 'Murugan and Co'; if (t.fromName === 'Murugan Stores') t.fromName = 'Murugan and Co'; });
    const fresh = initial();
    // On a new day only the example sales history is rebuilt for the new date.
    // Everything people did (payments, tickets, notes, chats, costs, customers, loan) is kept.
    if (!x.history || !x.history.days || x.history.days.at(-1).date !== fresh.history.days.at(-1).date) {
      return { ...fresh, ...x, history: fresh.history };
    }
    return { ...fresh, ...x };
  } catch { return null; }
}

export function resetState() {
  S = initial();
  touch();
  bus.emit('reset');
}
const restored = load();
if (restored) { S = restored; console.log(`Restored demo data: ${S.txns.length} payments, ${S.tickets.length} tickets, ${S.board.length} notes`); touch(); }
else resetState();
// a copy that starts on Vercel is behind the shared data until its first request adopts it
if (shared.enabled) { S.rev = 0; dirty = false; }

// ---------- helpers ----------
export const findTxn = (id) => S.txns.find((t) => t.id === id);
export const findTicket = (id) => S.tickets.find((t) => t.id === id);
export const ticketForRef = (ref) => S.tickets.find((t) => t.refId === ref);
export const findSettlement = (id) => S.settlements.find((s) => s.id === id);

export function log(entry) {
  S.agentLog.unshift({ id: S.agentLog.length + 1 + '-' + randDigits(4), at: now(), ...entry });
  if (S.agentLog.length > 300) S.agentLog.length = 300;
  touch();
}

// Messages to Murugan are written by the AI from the facts (see agent.js setPhraser).
// The fixed text is only the backup when the AI is off, out of budget or fails.
let phraser = null;
export function setPhraser(fn) { phraser = fn; }
export function tellMerchant(situation, facts, m, opts = {}) {
  const send = (text, english) => notify('merchant', { kind: 'voxa', speak: true, ...opts, text, english });
  if (!phraser) return send(m.text, m.english);
  phraser(situation, facts, m)
    .then((t) => (t ? send(t.text, t.english) : send(m.text, m.english)))
    .catch(() => send(m.text, m.english));
}

export function notify(target, { text, english, kind = 'info', speak = false, refId = null, action = null }) {
  const list = S.notes[target];
  const t = target === 'customer' && refId ? findTxn(refId) : null;
  list.unshift({ id: 'N' + randDigits(6), at: now(), text, english: english || text, kind, speak, refId, action, done: false, payer: t ? t.payerId || 'sanjeevi' : null });
  if (list.length > 60) list.length = 60;
  touch();
}

// ---------- payments ----------
export function activeOffer() {
  return S.offers.find((o) => o.active) || null;
}

// which customer is paying: Sanjeevi by default, or another customer's own screen
export const payerById = (id) => (id && S.payers && S.payers[id]) || S.customer;
const payerOf = (txn) => payerById(txn.payerId);

export function startPayment({ amount, note = '', useOffer = false, payer = null }) {
  const P = payerById(payer);
  let amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 1 || amt > 100000) throw new Error('Enter an amount between ₹1 and ₹1,00,000.');
  let discount = 0;
  const offer = activeOffer();
  if (useOffer && offer) {
    discount = Math.round((amt * offer.percent) / 100);
    amt -= discount;
  }
  const mode = null; // the bank (Deepak) decides each payment on the bank screen
  const txn = {
    id: 'TX' + pad(S.nextTxn++, 4),
    utr: '4317' + randDigits(8),
    kind: 'payment',
    amount: amt,
    discount,
    note,
    fromName: P.name,
    payerId: P.id,
    toName: S.merchant.name,
    mode,
    status: 'processing',
    createdAt: now(),
    updatedAt: now(),
    debitedAt: null,
    steps: STEP_DEFS.map((s) => ({ ...s, state: 'waiting', at: null, detail: '' })),
    cashTaken: false,
    refunded: false,
    voxa: null,
    resolvedHow: null,
    verified: false,
  };
  if (P.balance < amt) {
    txn.status = 'failed';
    txn.failReason = 'Not enough balance in your account.';
    txn.steps[0].state = 'done';
    txn.steps[1].state = 'failed';
    txn.steps[1].detail = 'Insufficient balance';
    S.txns.unshift(txn);
    touch();
    return txn;
  }
  S.txns.unshift(txn);
  touch();
  runSteps(txn);
  return txn;
}

// Deepak's decision on the bank screen: go through, time out after the debit, or fail.
export function bankDecide(txnId, decision) {
  const txn = findTxn(txnId);
  if (!txn || txn.status !== 'awaiting_bank') throw new Error('That payment is not waiting for the bank.');
  if (!['success', 'timeout', 'decline'].includes(decision)) throw new Error('Unknown decision');
  txn.mode = decision;
  txn.status = 'processing';
  touch();
  continueSteps(txn);
  return txn;
}

function setStep(txn, i, state, detail = '') {
  txn.steps[i].state = state;
  txn.steps[i].at = now();
  txn.steps[i].detail = detail;
  txn.updatedAt = now();
  touch();
}

// Step 1: the app sends the request, then the payment waits on the bank screen.
function runSteps(txn) {
  setTimeout(() => {
    setStep(txn, 0, 'done');
    setStep(txn, 1, 'active', 'Waiting for Voxa Bank');
    txn.status = 'awaiting_bank';
    touch();
    // Demo: Naveen (and any extra customer) shows loyalty, so his payments always go through.
    // Sanjeevi's payments wait for the bank screen, for the stuck-payment demo.
    if (txn.payerId && txn.payerId !== 'sanjeevi') { setTimeout(() => { if (txn.status === 'awaiting_bank') bankDecide(txn.id, 'success'); }, 400); return; }
    bus.emit('payment_awaiting', txn);
  }, 500);
}

// Steps 2–5 run once the bank has decided.
function continueSteps(txn) {
  const at = (ms, fn) => setTimeout(fn, ms);
  at(300, () => {
    if (txn.mode === 'decline') {
      setStep(txn, 1, 'failed', 'Bank server not responding. No money was taken.');
      txn.status = 'failed';
      txn.failReason = 'Voxa Bank did not respond. No money was taken. Please try again.';
      touch();
      bus.emit('payment_failed', txn);
      return;
    }
    payerOf(txn).balance -= txn.amount;
    txn.debitedAt = now();
    setStep(txn, 1, 'done', `${rupee(txn.amount)} debited`);
    at(800, () => {
      setStep(txn, 2, 'done', 'Routed to Voxa Pay (merchant side)');
      if (txn.mode === 'timeout') {
        setStep(txn, 3, 'active', 'Waiting for the merchant side to reply…');
        at(2600, () => {
          setStep(txn, 3, 'timeout', 'No reply within the time limit');
          setStep(txn, 4, 'waiting', '');
          txn.status = 'pending';
          txn.deadline = deadlineLabel(txn.debitedAt);
          touch();
          appNotice(txn);
      bus.emit('payment_pending', txn);
        });
        return;
      }
      at(700, () => {
        S.merchant.unsettled += txn.amount;
        setStep(txn, 3, 'done', `${rupee(txn.amount)} credited`);
        at(500, () => {
          setStep(txn, 4, 'done', 'Success');
          txn.status = 'success';
          touch();
          bus.emit('payment_success', txn);
        });
      });
    });
  });
}

// Bank side reconciliation of a stuck payment: credit late or reverse.
export function bankResolve(txnId, action) {
  const txn = findTxn(txnId);
  if (!txn || txn.status !== 'pending') throw new Error('That payment is not pending.');
  if (action === 'credit') {
    S.merchant.unsettled += txn.amount;
    setStep(txn, 3, 'done', 'Credited late after reconciliation');
    setStep(txn, 4, 'done', 'Success (late)');
    txn.status = 'success';
    txn.resolvedHow = 'late_credit';
  } else if (action === 'reverse') {
    payerOf(txn).balance += txn.amount;
    setStep(txn, 3, 'failed', 'Not credited');
    setStep(txn, 4, 'done', 'Reversed to customer');
    txn.status = 'reversed';
    txn.resolvedHow = 'reversed';
  } else throw new Error('Unknown action');
  txn.resolvedAt = now();
  S.bankRequests.forEach((r) => { if (r.txnId === txn.id) r.done = true; });
  touch();
  appNotice(txn);
  bus.emit('payment_resolved', txn);
  return txn;
}

// The customer's own payment app shows the status. Plain words, like a real payment app.
export function appNotice(txn) {
  const text = txn.status === 'pending' ? `Payment pending: ${rupee(txn.amount)} to ${txn.toName}. UPI ref ${txn.utr}. Status will be updated by ${txn.deadline}.`
    : txn.status === 'success' ? `Payment successful: ${rupee(txn.amount)} to ${txn.toName}. UPI ref ${txn.utr}.`
    : txn.status === 'reversed' ? `Refund: ${rupee(txn.amount)} credited back to your account. UPI ref ${txn.utr}.`
    : null;
  if (text) notify('customer', { kind: txn.status === 'reversed' ? 'refund' : 'app', refId: txn.id, text });
}

export function markCash(txnId) {
  const txn = findTxn(txnId);
  if (!txn) throw new Error('Payment not found');
  txn.cashTaken = true;
  touch();
  const t = ticketForRef(txn.id);
  if (t) addTimeline(t.id, 'Murugan', `Customer paid ${rupee(txn.amount)} in cash instead. Voxa keeps watching the UPI payment.`);
  // the shop's own matter: Voxa notes it for Murugan and tells nobody else
  return txn;
}

export function merchantRefund(txnId) {
  const txn = findTxn(txnId);
  if (!txn || txn.refunded) throw new Error('Nothing to refund.');
  const fromUnsettled = Math.min(S.merchant.unsettled, txn.amount);
  S.merchant.unsettled -= fromUnsettled;
  S.merchant.bankBalance -= txn.amount - fromUnsettled;
  payerOf(txn).balance += txn.amount;
  txn.refunded = true;
  S.txns.unshift({
    id: 'TX' + pad(S.nextTxn++, 4), utr: '4317' + randDigits(8), kind: 'refund', amount: txn.amount,
    fromName: S.merchant.name, toName: payerOf(txn).name, payerId: payerOf(txn).id, note: `Refund for double payment (${txn.id})`,
    status: 'success', createdAt: now(), updatedAt: now(), steps: [],
  });
  S.notes.merchant.forEach((n) => { if (n.refId === txn.id && n.kind === 'double_payment') n.done = true; });
  notify('customer', { kind: 'refund', refId: txn.id, text: `Received ${rupee(txn.amount)} from ${S.merchant.name}.` });
  const t = ticketForRef(txn.id);
  if (t) addTimeline(t.id, 'Murugan', `Returned ${rupee(txn.amount)} to the customer. No double payment left.`);
  touch();
  return txn;
}

// ---------- tickets ----------
export function createTicket({ type, refId, title, summary, needsHuman, priority = 'normal', source = 'rules' }) {
  const existing = refId && ticketForRef(refId);
  if (existing) return existing;
  const t = {
    id: 'VX-' + S.nextTicket++,
    type, refId, title, summary,
    status: needsHuman ? 'needs_human' : 'voxa',
    priority: needsHuman ? 'high' : priority,
    assignee: needsHuman ? 'Voxa Support' : 'Voxa (AI)',
    createdAt: now(),
    updatedAt: now(),
    source,
    deadline: type === 'stuck_payment' ? deadlineLabel(now()) : null,
    udir: null,
    escalated: !!needsHuman,
    timeline: [{ at: now(), who: 'Voxa', text: 'Ticket created' + (source === 'claude' ? ' by the Voxa agent (Claude)' : ' by Voxa monitoring') }],
  };
  if (type === 'stuck_payment') t.timeline.push({ at: now(), who: 'Voxa', text: 'Checked the payment status with Voxa Bank: money left the customer, not yet with Murugan.' });
  if (t.udir) t.timeline.push({ at: now(), who: 'Voxa', text: `Complaint filed with NPCI dispute system (UDIR), ref ${t.udir}. Bank must credit or reverse by ${t.deadline} (RBI T+5 rule).` });
  if (needsHuman) t.timeline.push({ at: now(), who: 'Voxa', text: 'Sent to the support team: needs a human decision.' });
  else if (type === 'stuck_payment') t.timeline.push({ at: now(), who: 'Voxa', text: 'Waiting for the bank to fix it on its own. If it is not fixed within 1 day, Voxa sends it to a person.' });
  S.tickets.unshift(t);
  const txn = findTxn(refId);
  if (txn) txn.ticketId = t.id;
  const st = findSettlement(refId);
  if (st) st.ticketId = t.id;
  touch();
  bus.emit('ticket_created', t);
  return t;
}

export function addTimeline(ticketId, who, text) {
  const t = findTicket(ticketId);
  if (!t) return;
  t.timeline.push({ at: now(), who, text });
  t.updatedAt = now();
  touch();
}

export function resolveTicket(ticketId, who, text) {
  const t = findTicket(ticketId);
  if (!t || t.status === 'resolved') return;
  t.status = 'resolved';
  t.resolvedAt = now();
  t.resolvedBy = who;
  addTimeline(ticketId, who, text);
}

export function escalateTicket(ticketId, reason) {
  const t = findTicket(ticketId);
  if (!t || t.status === 'resolved') return;
  t.status = 'needs_human';
  t.escalated = true;
  t.priority = 'high';
  t.assignee = 'Voxa Support';
  addTimeline(ticketId, 'Voxa', 'Escalated to support: ' + reason);
  bus.emit('ticket_needs_person', t);
}

// ---------- demo clock: one day passes ----------
// Voxa gives the bank one day to fix a stuck payment by itself. After that, a person at support takes over,
// well before the bank's T+5 deadline.
export function passOneDay() {
  S.simDay = (S.simDay || 0) + 1;
  const lang = S.merchant.lang;
  let moved = 0;
  for (const t of S.tickets) {
    if (t.status !== 'voxa' || t.type !== 'stuck_payment') continue;
    const txn = findTxn(t.refId);
    if (!txn || txn.status !== 'pending') continue;
    addTimeline(t.id, 'Voxa', `Day ${S.simDay}: checked the payment status with Voxa Bank again. Murugan is still not credited and the customer is not refunded.`);
    escalateTicket(t.id, 'the bank did not fix it within 1 day');
    const text = {
      situation: 'A stuck payment was not fixed by the bank within one day, so Voxa handed it to the payment company support team. Murugan does not need to do anything.',
      en: `${rupee(txn.amount)} from ${txn.fromName} is still stuck after 1 day. Voxa has handed ticket ${t.id} to the support team. You don't need to do anything.`,
      ta: `${txn.fromName} அனுப்பிய ${rupee(txn.amount)} ஒரு நாளாகியும் சிக்கியுள்ளது. டிக்கெட் ${t.id}-ஐ Voxa உதவிக் குழுவிடம் ஒப்படைத்துவிட்டது. நீங்கள் எதுவும் செய்ய வேண்டாம்.`,
      hi: `${txn.fromName} के ${rupee(txn.amount)} एक दिन बाद भी अटके हैं। Voxa ने टिकट ${t.id} सपोर्ट टीम को सौंप दिया है। आपको कुछ नहीं करना है।`,
    };
    tellMerchant(text.situation, { customer: txn.fromName, amount: txn.amount, ticket: t.id, bank_deadline: txn.deadline, days_waited: 1 }, { text: text[lang] || text.en, english: text.en }, { refId: txn.id });
    moved++;
  }
  for (const x of S.txns) {
    if (x.kind !== 'payment') continue;
    const covered = x.cashTaken || x.paidAgainBy;
    const key = x.resolvedHow === 'late_credit' && covered && !x.refunded ? 'stillOwe' : x.resolvedHow === 'reversed' && !covered && !x.paidBackBy ? 'stillUnpaid' : null;
    if (!key) continue;
    const m = msg(key, lang, { amount: x.amount, name: x.fromName });
    tellMerchant(key === 'stillOwe' ? 'Reminder: the customer paid twice for one sale and Murugan still has to give the extra amount back.' : 'Reminder: the stuck payment went back to the customer and the customer has not paid again yet.', { customer: x.fromName, amount: x.amount, paid_on: timeLabel(x.createdAt) }, m, { refId: x.id });
  }
  log({ agent: 'event', source: 'monitor', type: 'event', name: 'day_passed', input: 'day ' + S.simDay, output: moved ? `${moved} stuck payment(s) not fixed by the bank: sent to a person` : 'nothing overdue', ms: 0 });
  touch();
  return { day: S.simDay, moved };
}

// ---------- settlement & loan ----------
export function runSettlement() {
  const gross = S.merchant.unsettled;
  if (gross <= 0) throw new Error('Nothing to settle yet.');
  const expected = expectedDeduction(gross);
  const deduction = S.scenario.doubleDeductionNext && expected ? expected * 2 : expected;
  const net = gross - deduction;
  const held = S.scenario.holdNextSettlement;
  const st = {
    id: 'ST-' + pad(S.nextSettlement++, 3), at: now(), gross, deduction, expectedDeduction: expected, net,
    status: held ? 'held' : 'paid',
    holdReason: held ? "Bank account name 'MURUGAN STORES' does not match the new KYC name 'S. MURUGAN'" : null,
  };
  S.settlements.unshift(st);
  S.merchant.unsettled = 0;
  if (!held) S.merchant.bankBalance += net;
  if (deduction) {
    S.loan.repaid += deduction;
    S.loan.outstanding = Math.max(0, S.loan.outstanding - deduction);
  }
  S.scenario.holdNextSettlement = false;
  S.scenario.doubleDeductionNext = false;
  touch();
  if (held) bus.emit('settlement_held', st);
  if (deduction !== expected) bus.emit('deduction_mismatch', st);
  if (!held && deduction === expected) {
    tellMerchant('Today\'s money was sent to Murugan\'s bank account (end-of-day settlement).', { collected: gross, taken_for_loan: deduction, sent_to_bank: net }, msg('settled', S.merchant.lang, { gross, deduction, net }), { kind: 'settlement' });
  }
  return st;
}

export function releaseSettlement(stId) {
  const st = findSettlement(stId);
  if (!st || st.status !== 'held') throw new Error('Settlement is not on hold.');
  st.status = 'paid';
  st.releasedAt = now();
  S.merchant.bankBalance += st.net;
  touch();
  return st;
}

export function refundDeduction(stId) {
  const st = findSettlement(stId);
  if (!st || st.corrected) throw new Error('Nothing to correct.');
  const extra = st.deduction - st.expectedDeduction;
  if (extra <= 0) throw new Error('Deduction was correct.');
  st.corrected = true;
  S.merchant.bankBalance += extra;
  S.loan.repaid -= extra;
  S.loan.outstanding += extra;
  touch();
  return extra;
}

// ---------- business loan ----------
// How merchant loans on Paytm work, from the sources below (summaries, not a lender's own terms):
// the lending partner (a bank or NBFC) sets the rate from the merchant's profile, about 1.2% to 2.5%
// a month; processing fee 2% to 5% plus 18% GST, taken before the money is paid out; tenure from
// 3 to 36 months; repaid as a daily instalment (EDI) from the settlement; most merchant plans have
// no charge for closing early. The merchant chooses the amount and the months, not the rate.
export const LOAN_SOURCE = {
  url: 'https://www.businessesblaze.com/paytm-business-loan/',
  name: 'BusinessesBlaze, "Paytm Business Loan" (March 2026)',
  others: [
    "Paytm's Business Loan page: up to ₹10 lakh, collateral-free, 12 to 36 months",
    'Team research notes (search summary citing Paytm): 1.2–2.5% a month, fee 2–5% + 18% GST, daily EDI from settlements, no foreclosure charge on most merchant plans',
  ],
  ranges: { amount: [50000, 1000000], months: [3, 36] },
};
const clamp = (v, [lo, hi], d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

// Voxa's own check of the merchant's Voxa Pay data, the way a lender would look at it.
// It estimates eligibility, a limit and a likely rate. The lender's offer and Key Fact Statement are final.
export function loanProfile() {
  const days = S.history.days;
  const mo = S.history.monthly;
  const year = mo.reduce((s, r) => s + r.thisYear, 0), prevYear = mo.reduce((s, r) => s + r.lastYear, 0);
  const avgMonth = Math.round(year / 12);
  const growth = Math.round(((year - prevYear) / prevYear) * 1000) / 10;
  const recent = days.slice(-90);
  const salesDays = recent.filter((d) => d.total > 0).length;
  const dayShare = Math.round((salesDays / recent.length) * 100);
  const billsPerDay = Math.round(recent.reduce((s, d) => s + d.count, 0) / recent.length);
  const slowest = Math.min(...recent.map((d) => d.total));
  const problems = S.txns.filter((t) => t.status === 'failed').length;
  const checks = [
    { key: 'account', ok: true, label: 'Active Voxa Pay for Business account', detail: '24 months of payments on record (Dec 2024 – Nov 2026)' },
    { key: 'volume', ok: avgMonth >= 5000, label: 'Regular money coming in', detail: `About ${rupee(avgMonth)} a month, around ${billsPerDay} bills a day from different customers` },
    { key: 'steady', ok: dayShare >= 90, label: 'Sales almost every day', detail: `Sales on ${dayShare}% of days in the last 90 days. Slowest day ${rupee(slowest)}` },
    { key: 'growth', ok: growth >= 0, label: 'Business is growing', detail: `${growth >= 0 ? '+' : ''}${growth}% on the year before` },
    { key: 'kyc', ok: true, label: 'KYC and bank account linked', detail: 'PAN, Aadhaar and bank account verified (demo profile)' },
    { key: 'cibil', ok: null, label: 'Credit score (CIBIL)', detail: 'The lender checks this. Voxa cannot see it, so the final limit and rate can differ.' },
  ];
  let score = 0;
  score += Math.min(30, (avgMonth / 300000) * 30);
  score += Math.min(25, (dayShare / 100) * 25);
  score += Math.max(0, Math.min(20, growth + 5));
  score += 15; // 24 months of history
  score += problems ? 5 : 10;
  score = Math.round(score) - 8; // the credit score is unknown to Voxa, so it stays careful
  const band = score >= 80 ? { monthly: 1.8, feePct: 2, label: 'Strong' } : score >= 60 ? { monthly: 2.0, feePct: 3, label: 'Good' } : { monthly: 2.4, feePct: 4, label: 'Fair' };
  const limit = Math.max(50000, Math.min(1000000, Math.floor((avgMonth * 0.85) / 10000) * 10000));
  return {
    eligible: checks.every((c) => c.ok !== false), score, band: band.label, limit,
    monthlyRate: band.monthly, rate: Math.round(band.monthly * 12 * 10) / 10, feePct: band.feePct,
    avgMonth, growth, dayShare, billsPerDay, checks,
    steps: ['Open the Paytm for Business app', 'Go to Business Loan and check pre-approved offers', 'Finish paperless KYC', 'The lending partner pays the money into your bank account'],
    source: LOAN_SOURCE,
  };
}

export function loanPlan(p = {}) {
  const R = LOAN_SOURCE.ranges;
  const prof = loanProfile();
  const active = S.loan.status === 'active';
  const maxAmt = active ? S.loan.amount : prof.limit;
  const amount = Math.round(clamp(p.amount ?? (active ? S.loan.amount : Math.min(150000, maxAmt)), [R.amount[0], maxAmt], 150000) / 5000) * 5000;
  const months = Math.round(clamp(p.months ?? S.loan.months, R.months, 12));
  // Estimate only: the merchant may try any rate from 15% to 32% a year to see the effect.
  // The real rate is set by the lending partner. Without a choice, Voxa's estimate from the profile is used.
  const tried = p.rate !== undefined && p.rate !== null && p.rate !== '' ? clamp(p.rate, [15, 32], prof.rate) : null;
  const rate = active ? S.loan.rate : Math.round((tried ?? prof.rate) * 10) / 10;
  const feePct = active ? S.loan.feePct || prof.feePct : prof.feePct;
  const extra = Math.max(0, Math.round(Number(p.extra) || 0));
  const r = rate / 12 / 100;
  const emi = Math.round((amount * r * (1 + r) ** months) / ((1 + r) ** months - 1));
  const base = S.history.monthly; // Dec 2025 .. Nov 2026, with the same months a year earlier
  const start = new Date(2026, 11, 1); // the loan starts in December 2026

  const run = (extraPay) => {
    let bal = amount;
    const rows = [];
    for (let k = 0; bal > 0 && k < 60; k++) {
      const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const interest = Math.round(bal * r);
      // the last month clears whatever rounding left behind
      const principal = k === months - 1 && !extraPay ? bal : Math.min(bal, emi + extraPay - interest);
      bal -= principal;
      const mon = d.toLocaleDateString('en-IN', { month: 'short' });
      const ref = base[k % 12];
      // expected sales: the same month this year plus 5% (the shop grew 15% this year; we stay careful)
      const sales = Math.round(ref.thisYear * 1.05);
      rows.push({
        label: `${mon} ${d.getFullYear()}`, short: `${mon} ’${String(d.getFullYear()).slice(2)}`, month: mon,
        sales, lastYearSales: ref.lastYear, thisYearSales: ref.thisYear,
        interest, principal, pay: interest + principal, perDay: Math.round((interest + principal) / days), balance: bal,
        share: Math.round(((interest + principal) / sales) * 1000) / 10,
      });
    }
    return rows;
  };
  const schedule = run(extra);
  const plain = extra ? run(0) : schedule;
  const sum = (rows, k) => rows.reduce((s, x) => s + x[k], 0);
  const totalInterest = sum(schedule, 'interest');
  const fee = Math.round((amount * feePct) / 100);
  const feeGst = Math.round(fee * 0.18);
  const hardest = schedule.reduce((a, b) => (b.share > a.share ? b : a));
  // slow-sales check: what if every month sells 20% less than expected?
  const slowShare = Math.round((hardest.pay / (hardest.sales * 0.8)) * 1000) / 10;
  const slow = { drop: 20, share: slowShare, safe: slowShare <= 15 };
  return {
    amount, months, rate, estimateRate: prof.rate, rateRange: [15, 32], monthlyRate: Math.round((rate / 12) * 100) / 100, limit: prof.limit, extra, emi, daily: Math.round(emi / 30),
    feePct, fee, feeGst, received: amount - fee - feeGst,
    totalInterest, totalPaid: amount + totalInterest, start: schedule[0].label, finish: schedule[schedule.length - 1].label,
    monthsTaken: schedule.length, hardest, slow,
    saving: extra ? { months: plain.length - schedule.length, interest: sum(plain, 'interest') - totalInterest } : null,
    schedule, source: LOAN_SOURCE, profileBand: prof.band,
  };
}
export const forecast = loanPlan; // older name kept for callers

export function acceptLoan(p = {}) {
  if (S.loan.status === 'active') throw new Error('Loan already active.');
  const plan = loanPlan(p);
  Object.assign(S.loan, {
    status: 'active', name: 'Business loan', type: 'fixed', amount: plan.amount, months: plan.months, rate: plan.rate, feePct: plan.feePct,
    emi: plan.emi, daily: plan.daily, totalRepay: plan.totalPaid, interestTotal: plan.totalInterest, received: plan.received,
    outstanding: plan.totalPaid, repaid: 0, startedAt: now(), start: plan.start, finish: plan.finish,
  });
  S.merchant.bankBalance += plan.received;
  tellMerchant('Murugan just took a business loan.', { amount: plan.amount, reached_bank: plan.received, taken_daily_from_settlement: plan.daily, monthly: plan.emi, months: plan.months, ends: plan.finish }, msg('loanActiveFixed', S.merchant.lang, { amount: plan.amount, daily: plan.daily, months: plan.months }), { kind: 'loan' });
  addBoardNote({
    key: 'loan', tag: 'loan', title: `Loan ${rupee(plan.amount)} running until ${plan.finish}`,
    text: `${rupee(plan.daily)} is taken from your settlement every day (${rupee(plan.emi)} a month) at ${plan.rate}% a year. You received ${rupee(plan.received)} after the fee and GST. Closing early: most merchant plans have no charge, but check your Key Fact Statement.`,
  });
  touch();
}

// ---------- chat sessions: each conversation is kept, can be reopened or deleted ----------
const sessionTitle = (msgs) => { const u = msgs.find((m) => m.role === 'user'); return u ? String(u.text).replace(/^📷 /, 'Bill photo: ').slice(0, 60) : 'Chat'; };
function archiveCurrent() {
  if (!S.chat.length) return;
  S.chatSessions = S.chatSessions || [];
  S.chatSessions.unshift({ id: 'CS' + randDigits(6), title: sessionTitle(S.chat), at: S.chat[S.chat.length - 1].at || now(), messages: S.chat });
  if (S.chatSessions.length > 30) S.chatSessions.length = 30;
  S.chat = [];
}
export function newChat() { archiveCurrent(); touch(); }
export function openChat(id) {
  const k = (S.chatSessions || []).findIndex((x) => x.id === id);
  if (k < 0) throw new Error('That chat is gone.');
  const [sess] = S.chatSessions.splice(k, 1);
  archiveCurrent();
  S.chat = sess.messages;
  touch();
}
export function deleteChat(id) {
  if (id === 'current') S.chat = [];
  else S.chatSessions = (S.chatSessions || []).filter((x) => x.id !== id);
  touch();
}
// Save one of Voxa's answers to the notes page, with the dashboard that came with it.
export function saveAnswerToNotes(index) {
  const m = S.chat[index];
  if (!m || m.role !== 'assistant') throw new Error('Pick one of Voxa\'s answers.');
  const q = S.chat.slice(0, index).reverse().find((x) => x.role === 'user');
  const raw = (m.cards || []).find((c) => ['sales', 'costs', 'loan', 'payments', 'profit', 'loan_offer'].includes(c.type)) || null;
  // the chat's answer cards become the notes page's live dashboards
  const PERIOD = { today: '7', yesterday: '7', this_week: '7', last_week: '7', last_7_days: '7', this_month: '30', last_month: '30', last_30_days: '30', last_90_days: '90', last_6_months: 'm6', last_12_months: 'm12' };
  const card = !raw ? null : raw.type === 'profit' ? { type: 'costs' } : raw.type === 'loan_offer' ? { type: 'loan', amount: raw.data.plan.amount, months: raw.data.plan.months }
    : raw.type === 'sales' && raw.range ? { type: 'sales', period: PERIOD[raw.range.key] || '7' } : raw.type === 'payments' ? { type: 'payments' } : raw;
  m.savedNote = true;
  return addBoardNote({ title: q ? String(q.text).replace(/^📷 /, '').slice(0, 70) : 'From Voxa', text: String(m.text).slice(0, 600), tag: card ? 'dashboard' : 'note', source: 'you', card });
}

// ---------- Voxa notes: things Voxa writes down for the merchant to see again ----------
export function addBoardNote({ key = null, title, text, tag = 'info', source = 'voxa', card = null }) {
  if (key) S.board = S.board.filter((n) => n.key !== key);
  const n = { id: 'BN' + randDigits(6), key, title, text, tag, source, card, at: now() };
  S.board.unshift(n);
  if (S.board.length > 50) S.board.length = 50;
  touch();
  return n;
}
// Change the dashboard on a note: its look (style), what it shows (type), period or title.
export function updateNoteDashboard(id, patch = {}) {
  const n = S.board.find((x) => x.id === id);
  if (!n) throw new Error('Note not found');
  const types = ['sales', 'costs', 'loan', 'payments'], styles = ['bar', 'donut', 'columns', 'line', 'table'], periods = ['7', '30', '90', 'm6', 'm12'];
  const card = { ...(n.card || { type: 'costs' }) };
  if (types.includes(patch.type)) card.type = patch.type;
  if (styles.includes(patch.style)) card.style = patch.style;
  if (periods.includes(patch.period)) card.period = patch.period;
  if (patch.title) card.title = String(patch.title).slice(0, 50);
  n.card = card;
  n.tag = 'dashboard';
  n.at = now();
  touch();
  return n;
}

export function addDashboardNote({ type = 'costs', style, period }) {
  const types = ['sales', 'costs', 'loan'];
  const t = types.includes(type) ? type : 'costs';
  const card = { type: t, ...(style ? { style } : {}), ...(period ? { period } : {}) };
  return addBoardNote({ title: ({ sales: 'Sales', costs: 'Costs and profit', loan: 'Loan plan' })[t] + ' dashboard', text: 'Built with Voxa. Tap a look below to change it.', tag: 'dashboard', source: 'you', card });
}

export function removeBoardNote(id) {
  S.board = S.board.filter((n) => n.id !== id);
  touch();
}

// ---------- business costs: only Voxa writes these, from what the merchant tells it ----------
export const COST_CATEGORIES = {
  stock: 'Stock purchase', rent: 'Rent', electricity: 'Electricity', salary: 'Staff salary',
  transport: 'Transport', phone: 'Phone & internet', other: 'Other costs',
};
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function addExpenses(items, { month = monthKey(), source = 'rules', said = '', replace = true } = {}) {
  const added = [];
  for (const it of items) {
    const amount = Math.round(Number(it.amount));
    if (!amount || amount < 0) continue;
    const category = COST_CATEGORIES[it.category] ? it.category : 'other';
    // saying a cost again for the same month corrects it instead of adding it twice
    if (replace) S.expenses = S.expenses.filter((x) => !(x.month === month && x.category === category));
    const e = { id: 'EX' + randDigits(6), month, category, label: COST_CATEGORIES[category], amount, note: it.note || '', said, source, at: now() };
    S.expenses.push(e);
    added.push(e);
  }
  touch();
  return added;
}

// Cash sales are never guessed: only what the merchant adds or tells Voxa. One total per month; saying it again replaces it.
export function setCashSales(amount, { month = monthKey(), source = 'you', said = '' } = {}) {
  const a = Math.round(Number(amount));
  if (!(a >= 0)) throw new Error('Enter an amount');
  S.cashSales = (S.cashSales || []).filter((x) => x.month !== month);
  if (a > 0) S.cashSales.push({ id: 'CS' + randDigits(6), month, amount: a, source, said, at: now() });
  touch();
  return a;
}
export function clearExpenses(month = monthKey()) {
  S.expenses = S.expenses.filter((e) => e.month !== month);
  S.cashSales = (S.cashSales || []).filter((x) => x.month !== month);
  touch();
}

export function profitSummary(month = monthKey()) {
  const days = S.history.days.filter((d) => d.date.startsWith(month));
  const isNow = month === monthKey();
  const paytmSales = days.reduce((s, d) => s + d.total, 0) + (isNow ? salesToday().total : 0);
  const cashSales = (S.cashSales || []).filter((x) => x.month === month).reduce((s, x) => s + x.amount, 0);
  const revenue = paytmSales + cashSales;
  const list = S.expenses.filter((e) => e.month === month);
  const byCat = {};
  list.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const costs = Object.entries(byCat).map(([category, amount]) => ({ category, label: COST_CATEGORIES[category], amount })).sort((a, b) => b.amount - a.amount);
  const costTotal = costs.reduce((s, c) => s + c.amount, 0);
  const loanPaid = S.settlements.filter((st) => monthKey(new Date(st.at)) === month).reduce((s, st) => s + st.deduction, 0);
  const left = revenue - costTotal - loanPaid;
  const monthName = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return {
    month, monthName, revenue, paytmSales, cashSales, daysCounted: days.length + (isNow ? 1 : 0), costs, costTotal, loanPaid, left,
    margin: revenue ? Math.round((left / revenue) * 1000) / 10 : 0, hasStock: !!byCat.stock, entries: list.length,
  };
}

// ---------- any date range (from ranges.js): sales, costs and profit for exactly that range ----------
const isoOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const daysInMonth = (mk) => new Date(Number(mk.slice(0, 4)), Number(mk.slice(5)), 0).getDate();
// Monthly bills are spread evenly over the month's days; stock and one-off costs count on the day they were entered.
export const FIXED_COSTS = ['rent', 'electricity', 'salary', 'phone'];
function eachDay(from, to) {
  const out = [];
  for (let d = new Date(from + 'T00:00:00'); isoOf(d) <= to; d.setDate(d.getDate() + 1)) out.push(isoOf(d));
  return out;
}

export function salesInRange(r) {
  const today = isoOf(now());
  const byDate = new Map(S.history.days.map((d) => [d.date, d]));
  const days = eachDay(r.from, r.to).map((date) => {
    if (date === today) { const t = salesToday(); return { date, total: t.total, count: t.bills, today: true }; }
    const d = byDate.get(date);
    return d ? { date, total: d.total, count: d.count } : null;
  }).filter(Boolean);
  const paytm = days.reduce((s, d) => s + d.total, 0);
  // cash sales are told as one number per month: spread over the month (in full for a whole-month range)
  let cash = 0;
  for (const c of S.cashSales || []) cash += r.wholeMonth ? (c.month === r.from.slice(0, 7) ? c.amount : 0) : (c.amount / daysInMonth(c.month)) * eachDay(r.from, r.to).filter((d) => d.startsWith(c.month)).length;
  cash = Math.round(cash);
  const bills = days.reduce((s, d) => s + (d.count || 0), 0);
  const full = days.filter((d) => !d.today);
  const best = full.length ? full.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const worst = full.length ? full.reduce((a, b) => (b.total < a.total ? b : a)) : null;
  // the same number of days just before, for "vs before"
  const len = eachDay(r.from, r.to).length;
  const prevTo = isoOf(new Date(r.from + 'T00:00:00').getTime() - 86400000);
  const prevFrom = isoOf(new Date(r.from + 'T00:00:00').getTime() - len * 86400000);
  const prev = eachDay(prevFrom, prevTo).map((d) => byDate.get(d)).filter(Boolean);
  const prevTotal = prev.length === len ? prev.reduce((s, d) => s + d.total, 0) : null;
  return {
    range: r.key, from: r.from, to: r.to, total: paytm + cash, paytm, cash, bills,
    averagePerDay: days.length ? Math.round(paytm / days.length) : 0,
    changeVsBefore: prevTotal ? Math.round(((paytm - prevTotal) / prevTotal) * 1000) / 10 : null,
    best, worst, days,
  };
}

export function costsInRange(r) {
  const dates = eachDay(r.from, r.to);
  const byCat = {};
  let spread = false;
  for (const e of S.expenses) {
    let amt = 0;
    if (r.wholeMonth) amt = e.month === r.from.slice(0, 7) ? e.amount : 0;
    else if (FIXED_COSTS.includes(e.category)) {
      const n = dates.filter((d) => d.startsWith(e.month)).length;
      if (n) { amt = (e.amount / daysInMonth(e.month)) * n; spread = true; }
    } else {
      // a one-off cost counts on the day it was entered (or the 1st, if it was entered for another month)
      const on = isoOf(e.at).startsWith(e.month) ? isoOf(e.at) : e.month + '-01';
      amt = on >= r.from && on <= r.to ? e.amount : 0;
    }
    if (amt) byCat[e.category] = (byCat[e.category] || 0) + amt;
  }
  const items = Object.entries(byCat).map(([category, amount]) => ({ category, label: COST_CATEGORIES[category], amount: Math.round(amount), spread: !r.wholeMonth && FIXED_COSTS.includes(category) })).sort((a, b) => b.amount - a.amount);
  const loanPaid = S.settlements.filter((st) => { const d = isoOf(st.at); return d >= r.from && d <= r.to; }).reduce((s, st) => s + st.deduction, 0);
  const total = items.reduce((s, c) => s + c.amount, 0);
  return { range: r.key, from: r.from, to: r.to, total, items, loanPaid, spread, hasStock: !!byCat.stock, entries: items.length };
}

export function profitInRange(r) {
  const s = salesInRange(r), c = costsInRange(r);
  const profit = s.total - c.total - c.loanPaid;
  return {
    range: r.key, from: r.from, to: r.to,
    sales: s.total, paytm: s.paytm, cash: s.cash, costs: c.total, costItems: c.items, loanPaid: c.loanPaid, profit,
    margin: s.total ? Math.round((profit / s.total) * 1000) / 10 : 0,
    costsSpread: c.spread, hasStock: c.hasStock, costsTold: c.entries > 0,
    days: s.days.map((d) => ({ date: d.date, total: d.total })),
  };
}

export function expectedDeduction(gross) {
  if (S.loan.status !== 'active') return 0;
  const want = S.loan.type === 'fixed' ? S.loan.daily : Math.round((gross * S.loan.pct) / 100);
  return Math.min(want, S.loan.outstanding, gross);
}

// ---------- sales numbers used by the agent and dashboard ----------
export function salesToday() {
  const live = S.txns.filter((t) => t.kind === 'payment' && t.status === 'success').reduce((s, t) => s + t.amount, 0);
  const bills = S.txns.filter((t) => t.kind === 'payment' && t.status === 'success').length;
  return { total: S.history.todaySoFar + live, bills: S.history.todayBills + bills };
}

export function salesSummary(period = 'week') {
  const days = S.history.days;
  const n = days.length;
  const sum = (a) => a.reduce((s, d) => s + d.total, 0);
  const today = salesToday();
  if (period === 'today') return { period, total: today.total, bills: today.bills, note: 'Today so far' };
  const len = period === 'month' ? 30 : period === '90days' ? 90 : 7;
  const cur = days.slice(n - len);
  const prev = days.slice(Math.max(0, n - 2 * len), n - len);
  const total = sum(cur);
  const prevTotal = prev.length === len ? sum(prev) : null;
  const best = cur.reduce((a, b) => (b.total > a.total ? b : a));
  const worst = cur.reduce((a, b) => (b.total < a.total ? b : a));
  return {
    period, days: len, total, averagePerDay: Math.round(total / len),
    changeVsPrevious: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null,
    bestDay: best, slowestDay: worst,
  };
}

export function hourlyInsight() {
  const h = S.history.hourly;
  const avg = h.reduce((s, x) => s + x.avg, 0) / h.length;
  const slow = h.filter((x) => x.hour >= 14 && x.hour < 17);
  const slowAvg = slow.reduce((s, x) => s + x.avg, 0) / slow.length;
  return {
    hourly: h,
    averagePerHour: Math.round(avg),
    slowWindow: '2 PM to 5 PM',
    slowWindowAvgPerHour: Math.round(slowAvg),
    dropPercent: Math.round((1 - slowAvg / avg) * 100),
    suggestion: '10% off between 2 PM and 5 PM to bring customers in the quiet hours',
  };
}

export function createOffer({ percent = 10, start = 14, end = 17 }) {
  S.offers.forEach((o) => (o.active = false));
  const fmt = (h) => (h > 12 ? h - 12 + ' PM' : h === 12 ? '12 PM' : h + ' AM');
  const o = { id: 'OF' + randDigits(4), percent: Number(percent), start, end, label: `${percent}% off, ${fmt(start)}–${fmt(end)}`, active: true, at: now() };
  S.offers.unshift(o);
  touch();
  return o;
}

export function stopOffer(id) {
  const o = S.offers.find((x) => x.id === id);
  if (o) o.active = false;
  touch();
}

export function paymentFacts(txn) {
  return {
    txn_id: txn.id, utr: txn.utr, amount: txn.amount, status: txn.status,
    customer: txn.fromName, merchant: txn.toName,
    created: timeLabel(txn.createdAt),
    date: new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }),
    is_today: new Date(txn.createdAt).toDateString() === new Date().toDateString(),
    debited_from_customer: !!txn.debitedAt,
    debited_at: txn.debitedAt ? timeLabel(txn.debitedAt) : null,
    credited_to_merchant: txn.status === 'success',
    steps: txn.steps.map((s) => `${s.label}: ${s.state}${s.detail ? ' (' + s.detail + ')' : ''}`),
    // the deadline only matters while the money is stuck; a finished payment says how it ended
    ...(txn.status === 'pending' ? { stuck_until_at_most: txn.deadline || null } : {}),
    outcome: txn.status === 'pending' ? 'STUCK at the bank: left the customer, not yet with Murugan'
      : txn.resolvedHow === 'late_credit' ? 'DONE: the bank was late, but the money has now reached Murugan. Nothing pending, no deadline.'
      : txn.resolvedHow === 'reversed' ? 'DONE: the bank sent the money back to the customer. Nothing pending, no deadline.'
      : txn.status === 'success' ? 'DONE: paid normally.' : txn.status === 'failed' ? 'FAILED: no money moved.' : txn.status,
    cash_taken_instead: txn.cashTaken,
    ticket: txn.ticketId || null,
    big_amount: txn.amount >= BIG_AMOUNT,
  };
}

// ---------- Shop planner: suggestions built only from payment data and what the merchant told Voxa ----------
// Voxa does not see stock or bills it was not shown, so it never suggests anything about shelves.
const FESTIVALS = [
  { name: 'Pongal', month: 'Jan', date: new Date(2027, 0, 14) },
  { name: 'Tamil New Year', month: 'Apr', date: new Date(2027, 3, 14) },
  { name: 'Vinayagar Chathurthi', month: 'Aug', date: new Date(2027, 8, 4) },
  { name: 'Deepavali', month: 'Nov', date: new Date(2027, 9, 29) },
];
const dayMs = 86400000;
const TA_MON = { Jan: 'ஜனவரி', Feb: 'பிப்ரவரி', Mar: 'மார்ச்', Apr: 'ஏப்ரல்', May: 'மே', Jun: 'ஜூன்', Jul: 'ஜூலை', Aug: 'ஆகஸ்ட்', Sep: 'செப்டம்பர்', Oct: 'அக்டோபர்', Nov: 'நவம்பர்', Dec: 'டிசம்பர்' };
const TA_FEST = { Pongal: 'பொங்கல்', 'Tamil New Year': 'தமிழ்ப் புத்தாண்டு', 'Vinayagar Chathurthi': 'விநாயகர் சதுர்த்தி', Deepavali: 'தீபாவளி' };
const HI_MON = { Jan: 'जनवरी', Feb: 'फ़रवरी', Mar: 'मार्च', Apr: 'अप्रैल', May: 'मई', Jun: 'जून', Jul: 'जुलाई', Aug: 'अगस्त', Sep: 'सितंबर', Oct: 'अक्टूबर', Nov: 'नवंबर', Dec: 'दिसंबर' };
const HI_FEST = { Pongal: 'पोंगल', 'Tamil New Year': 'तमिल नववर्ष', 'Vinayagar Chathurthi': 'विनायक चतुर्थी', Deepavali: 'दीपावली' };
const taMon = (s) => String(s).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/g, (m, k) => TA_MON[k]);

export function regularsStatus() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (S.history.regulars || []).map((r) => {
    const last = r.visits[r.visits.length - 1];
    const daysSince = Math.round((today - new Date(last.date)) / dayMs);
    const avg = Math.round(r.visits.reduce((s, v) => s + v.amount, 0) / r.visits.length);
    const first = new Date(r.visits[0].date).toLocaleDateString('en-IN', { month: 'long' });
    return { name: r.name, vpa: r.vpa, usualGap: r.usualGap, visits: r.visits.length, avgAmount: avg, lastPaid: last.date, daysSince, since: first, stopped: daysSince > Math.max(14, r.usualGap * 2.5) };
  }).sort((a, b) => Number(b.stopped) - Number(a.stopped) || b.daysSince - a.daysSince);
}

export function plannerInsights() {
  const out = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const h = hourlyInsight();
  out.push({
    id: 'quiet', icon: 'clock', title: '2 PM to 5 PM is your quiet time',
    text: `Sales in these hours are about ${h.dropPercent}% below a normal hour. A good time to restock, do home deliveries or take a break. Your helper may not be needed then.`,
    data: 'Average sales per hour, last 30 days',
    ta: {
      title: 'மதியம் 2 முதல் 5 மணி வரை உங்கள் அமைதியான நேரம்',
      text: `இந்த நேரத்தில் விற்பனை சாதாரண நேரத்தை விட சுமார் ${h.dropPercent}% குறைவு. சரக்கு அடுக்க, வீட்டு டெலிவரி செய்ய அல்லது ஓய்வெடுக்க நல்ல நேரம். அப்போது உதவியாளர் தேவைப்படாமல் இருக்கலாம்.`,
      data: 'ஒரு மணி நேர சராசரி விற்பனை, கடந்த 30 நாட்கள்',
    },
    hi: {
      title: 'दोपहर 2 से 5 बजे तक बिक्री का शांत समय है',
      text: `इन घंटों में बिक्री सामान्य घंटे से लगभग ${h.dropPercent}% कम रहती है। यह सामान भरने, घर पर डिलीवरी करने या थोड़ा आराम करने का अच्छा समय है। इस समय सहायक की ज़रूरत नहीं पड़ सकती।`,
      data: 'पिछले 30 दिनों की प्रति घंटे औसत बिक्री',
    },
  });

  const fest = FESTIVALS.find((f) => f.date > today);
  if (fest) {
    const mo = S.history.monthly;
    const avgMonth = mo.reduce((s, r) => s + r.thisYear, 0) / mo.length;
    const last = mo.find((r) => r.month === fest.month);
    const pct = Math.round(((last.thisYear - avgMonth) / avgMonth) * 100);
    const weeks = Math.round((fest.date - today) / (7 * dayMs));
    out.push({
      id: 'festival', icon: 'calendar-days', title: `${fest.name} is in about ${weeks} weeks`,
      text: `Last ${fest.month} you sold ${rupee(last.thisYear)}, ${pct}% above your average month. Keep extra money ready to buy stock a couple of weeks before. What to buy is your call.`,
      data: 'Monthly sales, last 24 months',
      ta: {
        title: `${TA_FEST[fest.name] || fest.name} இன்னும் சுமார் ${weeks} வாரங்களில்`,
        text: `கடந்த ${taMon(fest.month)} மாதம் ${rupee(last.thisYear)} விற்றீர்கள், சராசரி மாதத்தை விட ${pct}% அதிகம். இரண்டு வாரம் முன்பே சரக்கு வாங்க கூடுதல் பணம் தயாராக வைத்திருங்கள். என்ன வாங்குவது என்பது உங்கள் முடிவு.`,
        data: 'மாத விற்பனை, கடந்த 24 மாதங்கள்',
      },
      hi: {
        title: `${HI_FEST[fest.name] || fest.name} लगभग ${weeks} हफ़्ते बाद है`,
        text: `पिछले ${HI_MON[fest.month] || fest.month} में आपकी बिक्री ${rupee(last.thisYear)} रही, जो औसत महीने से ${pct}% ज़्यादा है। कुछ हफ़्ते पहले सामान खरीदने के लिए अतिरिक्त पैसे तैयार रखें। क्या खरीदना है, यह आपका फ़ैसला है।`,
        data: 'पिछले 24 महीनों की मासिक बिक्री',
      },
    });
  }

  const regs = regularsStatus().filter((r) => r.stopped);
  if (regs.length) {
    const r = regs[0];
    out.push({
      id: 'regulars', icon: 'user-round', title: `${r.name} has not paid you in ${r.daysSince} days`,
      text: `${r.name} paid about every ${r.usualGap} days since ${r.since}, around ${rupee(r.avgAmount)} each time.${regs.length > 1 ? ` ${regs.slice(1).map((x) => x.name).join(', ')} also stopped.` : ''} Maybe check if everything is fine.`,
      data: 'Payments by the same UPI ID',
      ta: {
        title: `${r.name} ${r.daysSince} நாட்களாக பணம் செலுத்தவில்லை`,
        text: `${r.name} ${taMon(r.since)} முதல் சுமார் ${r.usualGap} நாட்களுக்கு ஒரு முறை, ஒவ்வொரு முறையும் சுமார் ${rupee(r.avgAmount)} செலுத்தினார்.${regs.length > 1 ? ` ${regs.slice(1).map((x) => x.name).join(', ')} அவர்களும் நிறுத்திவிட்டார்கள்.` : ''} எல்லாம் சரியாக இருக்கிறதா என்று விசாரிக்கலாம்.`,
        data: 'ஒரே UPI ID-யில் இருந்து வந்த பணம்',
      },
      hi: {
        title: `${r.name} ने ${r.daysSince} दिनों से भुगतान नहीं किया`,
        text: `${r.name} ${HI_MON[r.since] || r.since} से लगभग हर ${r.usualGap} दिन में करीब ${rupee(r.avgAmount)} देते थे.${regs.length > 1 ? ` ${regs.slice(1).map((x) => x.name).join(', ')} ने भी भुगतान बंद कर दिया है।` : ''} पूछकर देखिए कि सब ठीक है।`,
        data: 'एक ही UPI ID से आए भुगतान',
      },
    });
  }

  const d = S.history.days, n = d.length;
  const bill = (from, to) => { const s = d.slice(from, to); return Math.round(s.reduce((a, x) => a + x.total, 0) / s.reduce((a, x) => a + x.count, 0)); };
  const now30 = bill(n - 30, n), before30 = bill(n - 60, n - 30);
  if (now30 !== before30) {
    const down = now30 < before30;
    out.push({
      id: 'avgbill', icon: down ? 'trending-down' : 'trending-up',
      title: `Customers spend ${rupee(now30)} a visit, ${down ? 'down' : 'up'} from ${rupee(before30)}`,
      text: down ? 'The number of customers is steady, but each one buys a little less. Worth watching over the next weeks.' : 'Each customer is buying a little more per visit.',
      data: 'Average bill, last 30 days vs the 30 before',
      ta: {
        title: `ஒரு வாடிக்கையாளர் ஒரு முறைக்கு ${rupee(now30)} செலவிடுகிறார், முன்பு ${rupee(before30)}`,
        text: down ? 'வாடிக்கையாளர் எண்ணிக்கை அப்படியே இருக்கிறது, ஆனால் ஒவ்வொருவரும் கொஞ்சம் குறைவாக வாங்குகிறார்கள். அடுத்த சில வாரங்கள் கவனிக்கலாம்.' : 'ஒவ்வொரு வாடிக்கையாளரும் ஒரு முறைக்கு கொஞ்சம் அதிகமாக வாங்குகிறார்கள்.',
        data: 'சராசரி பில், கடந்த 30 நாட்கள், அதற்கு முந்தைய 30 நாட்களுடன்',
      },
      hi: {
        title: `हर ग्राहक अब प्रति विज़िट ${rupee(now30)} खर्च करता है; पहले ${rupee(before30)} था`,
        text: down ? 'ग्राहकों की संख्या स्थिर है, लेकिन हर ग्राहक थोड़ा कम खरीद रहा है। अगले कुछ हफ़्तों तक इस पर नज़र रखें।' : 'हर ग्राहक अब एक बार में थोड़ा ज़्यादा खरीद रहा है।',
        data: 'पिछले 30 दिनों और उससे पहले के 30 दिनों का औसत बिल',
      },
    });
  }

  const p = profitSummary();
  const stock = p.costs.find((c) => c.category === 'stock');
  if (stock) out.push({
    id: 'stock', icon: 'package', title: `Stock bought this month: ${rupee(stock.amount)}`,
    text: `Against ${rupee(p.revenue)} sold so far this month. Based only on the bills you showed Voxa.`,
    data: 'Bills you showed or told Voxa',
    ta: {
      title: `இந்த மாதம் வாங்கிய சரக்கு: ${rupee(stock.amount)}`,
      text: `இந்த மாதம் இதுவரை ${rupee(p.revenue)} விற்பனையுடன் ஒப்பிட. நீங்கள் Voxa-விடம் சொன்ன பில்கள் மட்டும்.`,
      data: 'நீங்கள் காட்டிய அல்லது சொன்ன பில்கள்',
    },
    hi: {
      title: `इस महीने खरीदा सामान: ${rupee(stock.amount)}`,
      text: `इस महीने अब तक हुई ${rupee(p.revenue)} की बिक्री के मुकाबले। यह सिर्फ़ उन बिलों पर आधारित है जो आपने Voxa को दिखाए।`,
      data: 'आपके दिखाए या बताए बिल',
    },
  });
  return out;
}
