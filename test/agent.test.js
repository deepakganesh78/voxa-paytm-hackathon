import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseRange, rangeFromKey } from '../src/ranges.js';

// ---------- time ranges ----------
test('time ranges: English, Tamil, Hindi and Tanglish/Hinglish map to exact dates', () => {
  const sun = new Date(2026, 10, 15, 14, 0); // Sunday 15 Nov 2026
  const r = (t, now = sun) => { const x = parseRange(t, now); return x && [x.key, x.from, x.to]; };
  assert.deepEqual(r('How much profit did I make this week?'), ['this_week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(r('இந்த வாரம் லாபம் எவ்வளவு?'), ['this_week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(r('इस हफ़्ते कितना मुनाफ़ा हुआ?'), ['this_week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(r('is hafte kitna munafa'), ['this_week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(r('indha vaaram vikkanai'), ['this_week', '2026-11-09', '2026-11-15']);
  assert.deepEqual(r('profit last week'), ['last_week', '2026-11-02', '2026-11-08']);
  assert.deepEqual(r('sales in the last 7 days'), ['last_7_days', '2026-11-09', '2026-11-15']);
  assert.deepEqual(r('today'), ['today', '2026-11-15', '2026-11-15']);
  assert.deepEqual(r('yesterday sales'), ['yesterday', '2026-11-14', '2026-11-14']);
  assert.deepEqual(r('this month profit'), ['this_month', '2026-11-01', '2026-11-15']);
  assert.deepEqual(r('கடந்த மாதம் செலவு'), ['last_month', '2026-10-01', '2026-10-31']);
  assert.equal(r('how is my shop'), null);
  // a week starts on Monday; on a Monday "this week" is just today
  assert.deepEqual(r('this week', new Date(2026, 10, 16, 9)), ['this_week', '2026-11-16', '2026-11-16']);
  // last month across a year end
  assert.deepEqual(r('last month', new Date(2027, 0, 5)), ['last_month', '2026-12-01', '2026-12-31']);
  assert.equal(rangeFromKey('this_week', sun).label.en, 'This week (9 Nov – 15 Nov)');
});

// ---------- the agent through the server ----------
const mock = `
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const u = String(url);
  if (u.includes('generativelanguage.googleapis.com')) {
    // a model that wrongly asks for month numbers, then answers
    const body = JSON.parse(options.body);
    const answered = body.contents.some((c) => c.parts.some((p) => p.functionResponse));
    if (!answered) return Response.json({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'query_profit', args: { range: 'this_month' } } }] } }] });
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: 'You did well.' }] } }] });
  }
  if (u.startsWith('https://api.telegram.org/bot')) {
    const method = u.split('/').pop();
    if (method === 'getMe') return Response.json({ ok: true, result: { username: 'TestShopBot' } });
    if (method === 'sendMessage') return Response.json({ ok: true, result: { message_id: 1 } });
    return Response.json({ ok: true, result: { url: '' } });
  }
  return originalFetch(url, options);
};`;

async function startServer(extraEnv = {}) {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const env = { ...process.env, PORT: String(port), VOXA_PERSIST: 'off', VOXA_BRAIN: 'rules', CARTESIA_API_KEY: '', SARVAM_API_KEY: '', GEMINI_API_KEY: '', GROQ_API_KEY: '', ANTHROPIC_API_KEY: '', TELEGRAM_BOT_TOKEN: '', ...extraEnv };
  const child = spawn(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(mock)}`, 'server.js'], { env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
    try { if ((await fetch(`${base}/api/config`)).ok) break; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const post = (url, body) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const state = () => fetch(`${base}/api/state`).then((r) => r.json());
  return { child, base, post, state };
}
const stop = async (child) => { child.kill(); await once(child, 'exit'); };
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('"profit this week" answers with this week, not the month, and says so (offline)', async () => {
  const { child, post, state } = await startServer();
  try {
    await post('/api/merchant/expenses/add', { category: 'rent', amount: 30000 });
    const r = await post('/api/merchant/chat', { text: 'How much profit did I make this week?' });
    const card = r.cards.find((c) => c.type === 'profit');
    assert.ok(card, 'a profit card');
    assert.equal(card.range.key, 'this_week');
    assert.equal(card.open.screen, 'costs');
    assert.match(r.reply, /This week \(/);
    // sales = the days from Monday to yesterday + today so far
    const s = await state();
    const range = rangeFromKey('this_week');
    const today = isoLocal(new Date());
    const past = s.history.days.filter((d) => d.date >= range.from && d.date <= range.to && d.date !== today).reduce((a, d) => a + d.total, 0);
    assert.equal(card.data.sales, past + s.history.todaySoFar);
    // monthly rent counts only for the days of this week
    const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const inMonth = Math.min(range.days, new Date().getDate());
    assert.equal(card.data.costs, Math.round((30000 / dim) * inMonth));
    assert.equal(card.data.profit, card.data.sales - card.data.costs);
    // the month answer is different
    const m = await post('/api/merchant/chat', { text: 'profit this month' });
    assert.equal(m.cards.find((c) => c.type === 'profit').range.key, 'this_month');
    assert.equal(m.cards.find((c) => c.type === 'profit').data.costs, 30000);
  } finally { await stop(child); }
});

test('the AI\u2019s wrong range is corrected to the one he asked for', async () => {
  const { child, post, state } = await startServer({ VOXA_BRAIN: 'gemini', GEMINI_API_KEY: 'test' });
  try {
    const r = await post('/api/merchant/chat', { text: 'How did the shop do this week?' });
    assert.equal(r.source, 'gemini');
    const card = r.cards.find((c) => c.type === 'profit');
    assert.equal(card.range.key, 'this_week');
    assert.match(r.reply, /^This week \(.*\): You did well\./);
    assert.ok((await state()).agentLog.some((l) => l.name === 'range_corrected'));
  } finally { await stop(child); }
});

test('a loan question gets an interactive loan card in the language asked', async () => {
  const { child, post } = await startServer();
  try {
    const en = await post('/api/merchant/chat', { text: 'Can I get a loan of 1 lakh?' });
    const card = en.cards.find((c) => c.type === 'loan_offer');
    assert.equal(card.data.asked, 100000);
    assert.ok(card.data.plan.emi > 0 && card.data.max >= card.data.min);
    assert.equal(card.open.screen, 'loan');
    const ta = await post('/api/merchant/chat', { text: 'எனக்கு 1 லட்சம் கடன் கிடைக்குமா?' });
    assert.equal(ta.lang, 'ta');
    assert.match(ta.reply, /[\u0B80-\u0BFF]/);
    assert.equal(ta.cards.find((c) => c.type === 'loan_offer').data.asked, 100000);
    const hi = await post('/api/merchant/chat', { text: 'क्या मुझे 1 लाख का लोन मिल सकता है?' });
    assert.equal(hi.lang, 'hi');
    assert.equal(hi.cards.find((c) => c.type === 'loan_offer').data.asked, 100000);
  } finally { await stop(child); }
});

test('changes wait for Confirm: costs are only saved, and reminders only sent, after he taps it', async () => {
  const token = '123:TEST';
  const { createHash } = await import('node:crypto');
  const secret = createHash('sha256').update('voxa-webhook:' + token).digest('hex').slice(0, 48);
  const dir = mkdtempSync(path.join(tmpdir(), 'voxa-act-'));
  const { child, base, post, state } = await startServer({ TELEGRAM_BOT_TOKEN: token, WA_PROVIDER: 'telegram', TELEGRAM_MODE: 'webhook', VOXA_SHARED_DIR: dir });
  try {
    const r = await post('/api/merchant/chat', { text: 'This month rent 6000, electricity 4000' });
    const c = r.cards.find((x) => x.type === 'confirm');
    assert.ok(c, 'a confirmation card');
    assert.equal((await state()).expenses.length, 0, 'nothing saved yet');
    await post('/api/merchant/action/confirm', { id: c.actionId });
    const s = await state();
    assert.equal(s.expenses.reduce((a, e) => a + e.amount, 0), 10000);
    assert.equal(s.actions.find((a) => a.id === c.actionId).status, 'done');

    // nobody owes yet: no card, a plain answer
    const none = await post('/api/merchant/chat', { text: 'Remind everyone who owes me' });
    assert.ok(!none.cards.some((x) => x.type === 'confirm'));

    // a customer joins and owes Udhaar
    const hook = (u) => fetch(`${base}/api/telegram/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(u) });
    await hook({ update_id: 1, message: { message_id: 1, chat: { id: 555, type: 'private' }, from: { id: 555, first_name: 'Priya' }, text: '/start MS-1042' } });
    const cu = (await state()).crm.customers[0];
    await post('/api/crm/udhar/add', { customer: cu.phone, amount: 500 });
    const sentBefore = (await state()).crm.waLog.length;

    const rem = await post('/api/merchant/chat', { text: 'Remind everyone who owes me' });
    const card = rem.cards.find((x) => x.type === 'confirm');
    const act = (await state()).actions.find((a) => a.id === card.actionId);
    assert.equal(act.type, 'send_udhaar_reminders');
    assert.equal(act.items.length, 1);
    assert.match(act.items[0].detail, /₹500 is due/);
    assert.equal((await state()).crm.waLog.length, sentBefore, 'no message before Confirm');
    await post('/api/merchant/action/confirm', { id: card.actionId });
    const after = await state();
    assert.ok(after.crm.waLog.some((w) => /gentle reminder, ₹500/.test(w.text) && w.status === 'sent'));
    assert.equal(after.actions.find((a) => a.id === card.actionId).status, 'done');

    // cancelling changes nothing
    const again = await post('/api/merchant/chat', { text: 'Remind everyone who owes me' });
    const id2 = again.cards.find((x) => x.type === 'confirm').actionId;
    const n = (await state()).crm.waLog.length;
    await post('/api/merchant/action/cancel', { id: id2 });
    assert.equal((await state()).crm.waLog.length, n);
  } finally {
    await stop(child);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('"show weak sales days" opens Sales insights with the weak days filter', async () => {
  const { child, post } = await startServer();
  try {
    const r = await post('/api/merchant/chat', { text: 'Show weak sales days' });
    assert.deepEqual(r.nav, { screen: 'insights', params: { view: 'weak_days', range: 'last_30_days' } });
    const s = r.cards.find((c) => c.type === 'sales');
    assert.equal(s.data.groupBy, 'weekday');
  } finally { await stop(child); }
});
