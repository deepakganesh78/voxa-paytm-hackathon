import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/js/common.js', import.meta.url), 'utf8');

async function setup({ sarvam, mediaDevices, MediaRecorder, SpeechRecognition, AudioContext, OfflineAudioContext, permissions, stt }) {
  const toast = { classList: { add() {}, remove() {} }, setAttribute() {} };
  const document = {
    readyState: 'loading', addEventListener() {},
    querySelector: () => toast,
  };
  const window = { MediaRecorder, SpeechRecognition, AudioContext };
  runInNewContext(source, {
    window, document, navigator: { mediaDevices, permissions }, MediaRecorder, OfflineAudioContext, Blob,
    fetch: async (url) => (String(url).startsWith('/api/stt')
      ? { ok: stt.status === 200, status: stt.status, json: async () => stt.body }
      : { json: async () => ({ sarvam }) }),
    setTimeout() {}, clearTimeout() {},
  });
  await window.V.ready();
  return window.V;
}

test('browser recording indicator follows recognition start and end', async () => {
  let recognition;
  class SpeechRecognition {
    constructor() { recognition = this; }
    start() {}
    abort() { this.onend(); }
  }
  const v = await setup({ sarvam: false, SpeechRecognition });
  const events = [];
  const rec = v.listen('en', () => {}, () => events.push('end'), (active) => events.push(active));
  assert.deepEqual(events, []);
  recognition.onstart();
  rec.stop();
  assert.deepEqual(events, [true, false, 'end']);
});

test('stopping while the browser has not answered the microphone prompt still ends', async () => {
  class SpeechRecognition { start() {} abort() {} }
  const v = await setup({ sarvam: false, SpeechRecognition });
  const events = [];
  const rec = v.listen('en', () => {}, () => events.push('end'), (active) => events.push(active));
  rec.stop();
  rec.stop();
  assert.deepEqual(events, ['end']);
});

test('a blocked microphone is reported and ends instead of waiting forever', async () => {
  class SpeechRecognition { start() {} abort() {} }
  const permissions = { query: async () => ({ state: 'denied' }) };
  const v = await setup({ sarvam: false, SpeechRecognition, permissions });
  const events = [];
  v.listen('en', () => {}, () => events.push('end'), (active) => events.push(active));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['end']);
});

test('cancelled microphone permission releases any subsequently granted stream', async () => {
  let grant;
  let stopped = 0;
  const mediaDevices = { getUserMedia: () => new Promise((resolve) => { grant = resolve; }) };
  const v = await setup({ sarvam: true, mediaDevices, MediaRecorder: class {} });
  const events = [];
  const rec = v.listen('en', () => {}, () => events.push('end'), (active) => events.push(active));
  rec.stop();
  grant({ getTracks: () => [{ stop: () => stopped++ }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stopped, 1);
  assert.deepEqual(events, ['end']);
});

test('Sarvam recording indicator stops before transcription finishes', async () => {
  let finishTranscription;
  let stopped = 0;
  const mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) };
  class MediaRecorder {
    constructor() { this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.onstop(); }
  }
  class AudioContext {
    decodeAudioData() { return new Promise((resolve, reject) => { finishTranscription = reject; }); }
  }
  const v = await setup({ sarvam: true, mediaDevices, MediaRecorder, AudioContext });
  const events = [];
  const rec = v.listen('en', () => {}, () => events.push('end'), (active) => events.push(active));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [true]);
  rec.stop();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stopped, 1);
  assert.deepEqual(events, [true, false]);
  finishTranscription(new Error('transcription failed'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [true, false, 'end']);
});

test('a temporary speech-service error does not switch later attempts to the browser voice', async () => {
  let microphoneRequests = 0;
  let browserRecognisers = 0;
  const mediaDevices = { getUserMedia: async () => { microphoneRequests++; return { getTracks: () => [{ stop() {} }] }; } };
  class MediaRecorder {
    constructor() { this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.onstop(); }
  }
  class AudioContext { async decodeAudioData() { return { duration: 0.1 }; } close() {} }
  class OfflineAudioContext {
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() { return { getChannelData: () => new Float32Array(8) }; }
  }
  class SpeechRecognition { constructor() { browserRecognisers++; } start() {} abort() {} }
  const v = await setup({
    stt: { status: 502, body: { error: 'Cartesia speech failed' } }, mediaDevices, MediaRecorder, AudioContext, OfflineAudioContext, SpeechRecognition,
  });
  v.config().stt = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ended = new Promise((resolve) => {
      const rec = v.listen('ta', () => {}, resolve, () => {});
      setImmediate(() => rec.stop());
    });
    await ended;
  }
  assert.equal(microphoneRequests, 2);
  assert.equal(browserRecognisers, 0);
});
