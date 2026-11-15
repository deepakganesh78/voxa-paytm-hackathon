import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mock = `
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url) === 'https://api.cartesia.ai/tts/bytes') {
    return new Response(options.body, { headers: { 'Content-Type': 'audio/wav' } });
  }
  if (String(url) === 'https://api.groq.com/openai/v1/audio/transcriptions') {
    // the scenario is carried in the audio bytes
    const scenario = await options.body.get('file').text();
    const language = options.body.get('language');
    if (scenario === 'groq-down') return Response.json({ error: { message: 'down' } }, { status: 500 });
    if (scenario === 'tamil') return Response.json({ language: 'Tamil', text: ' தமிழ் ' });
    // Whisper names a language the app does not speak, unless it is told which one
    if (scenario === 'urdu') return Response.json({ language: language ? 'Hindi' : 'Urdu', text: language ? 'asked in ' + language : 'wrong script' });
    return Response.json({ language: 'English', text: ' hello ' });
  }
  if (String(url) === 'https://api.cartesia.ai/stt') {
    // the first request answers 503 once, to prove the server retries
    globalThis.sttCalls = (globalThis.sttCalls || 0) + 1;
    if (globalThis.sttCalls === 1) return Response.json({ message: 'unavailable' }, { status: 503 });
    const language = options.body.get('language');
    return Response.json({ type: 'transcript', text: 'heard in ' + language + ' with ' + options.body.get('model'), language });
  }
  if (String(url).startsWith('https://api.telegram.org/bot')) {
    const method = String(url).split('/').pop();
    if (method === 'getMe') return Response.json({ ok: true, result: { username: 'TestShopBot' } });
    if (method === 'sendMessage') { (globalThis.tgSent ||= []).push(JSON.parse(options.body)); return Response.json({ ok: true, result: { message_id: 1 } }); }
    return Response.json({ ok: true, result: { url: '' } });
  }
  return originalFetch(url, options);
};`;

async function startServer(voiceId, extraEnv = {}) {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const env = {
    ...process.env, PORT: String(port), VOXA_PERSIST: 'off', VOXA_BRAIN: 'rules',
    CARTESIA_API_KEY: 'test-key', SARVAM_API_KEY: '', GEMINI_API_KEY: '', GROQ_API_KEY: '',
    ANTHROPIC_API_KEY: '', CARTESIA_EN_VOICE_ID: voiceId || '',
    CARTESIA_TA_VOICE_ID: '', CARTESIA_HI_VOICE_ID: '', ...extraEnv,
  };
  const child = spawn(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(mock)}`, 'server.js'], { env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
      try {
        const response = await fetch(`${base}/api/config`);
        if (response.ok) return { child, base };
      } catch (error) {
        if (error.cause?.code !== 'ECONNREFUSED') throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Server did not start');
  } catch (error) {
    child.kill();
    throw error;
  }
}

test('Cartesia uses the selected language voice and English override', async () => {
  for (const override of ['', 'custom-english-voice']) {
    const { child, base } = await startServer(override);
    try {
      const config = await (await fetch(`${base}/api/config`)).json();
      assert.equal(config.cartesiaEnglish, true);
      for (const [lang, voice, code] of [
        ['en', override || 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', 'en-IN'],
        ['ta', 'fb7d8d97-9730-4165-bd79-36b5ce61b5f2', 'ta-IN'],
        ['hi', '4459a9a5-69d6-4680-b970-e13dc51845b6', 'hi-IN'],
      ]) {
        const response = await fetch(`${base}/api/tts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'test', lang }),
        });
        assert.equal(response.status, 200);
        const request = await response.json();
        assert.equal(request.voice, voice);
        assert.equal(request.language, code);
      }
    } finally {
      child.kill();
      await once(child, 'exit');
    }
  }
});

test('speech recognition prefers Groq, detects the language, and falls back to Cartesia', async () => {
  const { child, base } = await startServer('', { GROQ_API_KEY: 'test-groq' });
  try {
    const send = async (scenario, lang = 'en') => {
      const response = await fetch(`${base}/api/stt?lang=${lang}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: scenario });
      return { status: response.status, body: await response.json() };
    };
    // the spoken language wins over the one on screen
    assert.deepEqual((await send('tamil', 'en')).body, { transcript: 'தமிழ்', language: 'ta-IN' });
    assert.deepEqual((await send('english', 'ta')).body, { transcript: 'hello', language: 'en-IN' });
    // an unsupported detected language is asked again in the language on screen
    assert.deepEqual((await send('urdu', 'hi')).body, { transcript: 'asked in hi', language: 'hi-IN' });
    // Groq down: Cartesia answers (its first request is the mock's one-off 503, then it is retried)
    assert.deepEqual((await send('groq-down', 'ta')).body, { transcript: 'heard in ta with ink-whisper', language: 'ta-IN' });
  } finally {
    child.kill();
    await once(child, 'exit');
  }
});

test('speech recognition uses Cartesia in the app language and retries a brief outage', async () => {
  const { child, base } = await startServer('');
  try {
    assert.equal((await (await fetch(`${base}/api/config`)).json()).stt, true);
    const send = (lang) => fetch(`${base}/api/stt?lang=${lang}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: Buffer.from('RIFFtest') });
    const tamil = await send('ta');
    assert.equal(tamil.status, 200);
    assert.deepEqual(await tamil.json(), { transcript: 'heard in ta with ink-whisper', language: 'ta-IN' });
    assert.equal((await (await send('hi')).json()).transcript, 'heard in hi with ink-whisper');
    assert.equal((await (await send('xx')).json()).transcript, 'heard in en with ink-whisper');
  } finally {
    child.kill();
    await once(child, 'exit');
  }
});

test('several server copies share one set of demo data (a payment goes customer, bank, merchant across copies)', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'voxa-shared-'));
  const env = { VOXA_SHARED_DIR: dir };
  const first = await startServer('', env);
  let second;
  try {
    const call = (base, url, body) => fetch(`${base}${url}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    const waitFor = async (check, what) => {
      for (let i = 0; i < 60; i++) { const value = await check(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 150)); }
      assert.fail(`timed out waiting for ${what}`);
    };
    assert.equal((await call(first.base, '/api/config')).serverless, true);

    // a customer pays on the first copy
    const paid = await call(first.base, '/api/pay', { amount: 275, note: 'across copies' });
    const id = paid.txn.id;
    await waitFor(async () => (await call(first.base, '/api/state')).txns.find((t) => t.id === id)?.status === 'awaiting_bank', 'the payment to reach the bank');

    // a copy that starts later adopts that data instead of overwriting it with its own starting data
    second = await startServer('', env);
    const seenBySecond = (await call(second.base, '/api/state')).txns.find((t) => t.id === id);
    assert.equal(seenBySecond?.status, 'awaiting_bank');

    // the bank approves on the second copy; its timers finish the payment there
    assert.equal((await call(second.base, '/api/bank/decide', { txnId: id, decision: 'success' })).ok, true);
    await waitFor(async () => (await call(second.base, '/api/state')).txns.find((t) => t.id === id)?.status === 'success', 'the payment to succeed');

    // the merchant on the first copy sees the finished payment, and the customer's balance went down once
    const seenByFirst = await waitFor(async () => { const s = await call(first.base, '/api/state'); return s.txns.find((t) => t.id === id)?.status === 'success' ? s : null; }, 'the first copy to see the result');
    assert.equal(seenByFirst.customer.balance, 25000 - 275);
    assert.equal(seenByFirst.txns.length, 1);

    // polling answers "unchanged" with a few bytes
    const { rev } = seenByFirst;
    assert.deepEqual(await call(first.base, `/api/state?rev=${rev}`), { unchanged: true, rev });
  } finally {
    first.child.kill();
    await once(first.child, 'exit');
    if (second) { second.child.kill(); await once(second.child, 'exit'); }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Telegram webhook: checks the secret, lets a customer join from the poster, and links Murugan', async () => {
  const token = '123:TEST';
  const { createHash } = await import('node:crypto');
  const secret = createHash('sha256').update('voxa-webhook:' + token).digest('hex').slice(0, 48);
  // TELEGRAM_MODE=webhook is what Vercel does; a shared folder stands in for Vercel's Runtime Cache
  const dir = mkdtempSync(path.join(tmpdir(), 'voxa-tg-'));
  const { child, base } = await startServer('', { TELEGRAM_BOT_TOKEN: token, WA_PROVIDER: 'telegram', VOXA_MERCHANT_PHONE: '+919566012922', TELEGRAM_MODE: 'webhook', VOXA_SHARED_DIR: dir });
  try {
    const hook = (update, key = secret) => fetch(`${base}/api/telegram/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': key }, body: JSON.stringify(update) });
    const msg = (id, chat, extra) => ({ update_id: id, message: { message_id: id, chat: { id: chat, type: 'private' }, from: { id: chat, first_name: chat === 900 ? 'Murugan' : 'Priya' }, ...extra } });
    const config = await (await fetch(`${base}/api/config`)).json();
    assert.equal(config.whatsapp.provider, 'telegram');
    assert.equal(config.whatsapp.bot, 'TestShopBot');
    assert.match(config.whatsapp.ownerCode, /^OWNER-[0-9A-F]{8}$/);

    assert.equal((await hook(msg(1, 555, { text: '/start x' }), 'wrong')).status, 403);

    // a customer scans the poster QR: Telegram opens the bot with /start <shop code>
    assert.equal((await hook(msg(2, 555, { text: `/start ${config.whatsapp.shopCode}` }))).status, 200);
    let state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.crm.customers.length, 1);
    assert.equal(state.crm.customers[0].name, 'Priya');

    // Murugan shares his contact: the number matches the saved one, so his chat becomes the owner chat
    assert.equal(state.crm.settings.merchantPhone, '+919566012922');
    await hook(msg(3, 900, { contact: { phone_number: '919566012922', user_id: 900 } }));
    state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(String(state.crm.ownerChatId), '900');
    assert.equal(state.crm.customers.length, 1); // he is not added as a customer
  } finally {
    child.kill();
    await once(child, 'exit');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Telegram: a payment from someone not on the loyalty programme offers it to the customer and to Murugan', async () => {
  const token = '123:TEST';
  const { createHash } = await import('node:crypto');
  const secret = createHash('sha256').update('voxa-webhook:' + token).digest('hex').slice(0, 48);
  const dir = mkdtempSync(path.join(tmpdir(), 'voxa-tg2-'));
  const { child, base } = await startServer('', { TELEGRAM_BOT_TOKEN: token, WA_PROVIDER: 'telegram', VOXA_MERCHANT_PHONE: '+919566012922', TELEGRAM_MODE: 'webhook', VOXA_SHARED_DIR: dir });
  try {
    const hook = (update) => fetch(`${base}/api/telegram/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': secret }, body: JSON.stringify(update) });
    const msg = (id, chat, extra) => ({ update_id: id, message: { message_id: id, chat: { id: chat, type: 'private' }, from: { id: chat, first_name: chat === 900 ? 'Murugan' : 'Priya' }, ...extra } });
    const post = (url, body) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    const state = () => fetch(`${base}/api/state`).then((r) => r.json());
    const waitFor = async (check, what) => { for (let i = 0; i < 60; i++) { const v = await check(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); } assert.fail('timed out: ' + what); };

    await hook(msg(1, 900, { contact: { phone_number: '919566012922', user_id: 900 } })); // Murugan links his chat
    await hook(msg(2, 555, { text: '/start MS-1042' })); // Priya scans the poster and joins
    assert.equal((await state()).crm.customers.length, 1);

    const paid = await post('/api/pay', { amount: 340, note: 'tea' });
    await waitFor(async () => (await state()).txns.find((t) => t.id === paid.txn.id)?.status === 'awaiting_bank', 'the bank');
    await post('/api/bank/decide', { txnId: paid.txn.id, decision: 'success' });
    const s1 = await waitFor(async () => { const s = await state(); return s.txns.find((t) => t.id === paid.txn.id)?.status === 'success' ? s : null; }, 'success');

    const log = s1.crm.waLog.map((w) => w.text);
    assert.ok(log.some((t) => /Was that you\?/.test(t) && /₹340/.test(t)), 'the joined customer is asked: ' + JSON.stringify(log));
    assert.ok(log.some((t) => /Sanjeevi is not on your loyalty programme/.test(t)), 'Murugan is told');
    assert.equal(s1.crm.waLog.filter((w) => /loyalty programme yet|not on your loyalty/.test(w.text) && w.status === 'sent').length, 1);

    // Murugan taps the button under the message
    await hook({ update_id: 10, callback_query: { id: 'cb1', from: { id: 900, first_name: 'Murugan' }, message: { message_id: 5, chat: { id: 900, type: 'private' } }, data: 'addloy:' + paid.txn.id } });
    let s2 = await state();
    const added = s2.crm.customers.find((c) => c.upiName === 'Sanjeevi');
    assert.ok(added && added.addedByOwner, 'a card was started');
    assert.equal(added.visits.length, 1);
    assert.ok(s2.crm.waLog.some((w) => /Added .* to the loyalty programme/.test(w.text)));
    // tapping the same button again does not add a second card
    await hook({ update_id: 11, callback_query: { id: 'cb2', from: { id: 900, first_name: 'Murugan' }, message: { message_id: 5, chat: { id: 900, type: 'private' } }, data: 'addloy:' + paid.txn.id } });
    assert.equal((await state()).crm.customers.filter((c) => c.upiName === 'Sanjeevi').length, 1);
    // a stranger cannot use the button
    const before = (await state()).crm.customers.length;
    await hook({ update_id: 12, callback_query: { id: 'cb3', from: { id: 777, first_name: 'X' }, message: { message_id: 6, chat: { id: 777, type: 'private' } }, data: 'addloy:' + paid.txn.id } });
    assert.equal((await state()).crm.customers.length, before);

    // Priya answers YES: she takes over the card Murugan started, no second card
    await hook(msg(13, 555, { text: 'YES' }));
    const s3 = await state();
    assert.equal(s3.crm.customers.length, 1);
    assert.equal(s3.crm.customers[0].upiName, 'Sanjeevi');
    assert.equal(s3.crm.customers[0].visits.length, 1);
    assert.ok(!s3.crm.customers[0].addedByOwner);
  } finally {
    child.kill();
    await once(child, 'exit');
    rmSync(dir, { recursive: true, force: true });
  }
});
