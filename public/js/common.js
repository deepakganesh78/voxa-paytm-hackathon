// Shared helpers for every Voxa screen: shell + screen switcher, icons, live state,
// voice, and the signature payment-route component.
window.V = (() => {
  let refreshNow = null; // set when live updates are polled; asks for an update at once


  const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const time = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  const ago = (ms) => {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    return time(ms);
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- icons (Lucide, served locally) ----------
  const i = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
  const icons = () => { if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); };

  // ---------- shell + screen switcher ----------
  const SCREENS = [
    { href: '/', icon: 'layout-grid', who: 'Home', what: '' },
    { href: '/pay', icon: 'smartphone', who: 'Sanjeevi', what: 'Customer · Voxa Pay' },
    { href: '/naveen', icon: 'smartphone', who: 'Naveen', what: 'Customer · Voxa Pay' },
    { href: '/bank', icon: 'landmark', who: 'Deepak', what: 'Bank · Voxa Bank' },
    { href: '/business', icon: 'store', who: 'Deepak', what: 'Merchant · Voxa Business' },
    { href: '/support', icon: 'headphones', who: 'Naveen', what: 'Support · Voxa Support' },
  ];
  // Pages may set V.sections = [{id,label,icon}] and V.onSection = fn before the DOM is ready.
  const api_ = {};
  function buildShell() {
    const shell = $('header.shell');
    if (!shell || shell.dataset.built) return;
    shell.dataset.built = '1';
    const d = shell.dataset;
    const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    const sections = api_.self.sections || [];
    const initial = (d.user || 'V').trim()[0].toUpperCase();

    const side = document.createElement('aside');
    side.className = 'side';
    side.setAttribute('aria-label', 'Navigation');
    side.innerHTML = `
      <div class="side-brand"><div class="mark">${i('wallet')}</div><span>VO<em>X</em>A</span></div>
      <div class="side-user"><div class="avatar">${esc(initial)}</div><div style="min-width:0"><div class="name">${esc(d.user || 'Voxa')}</div><div class="role">${esc(d.userRole || '')}</div></div></div>
      <div class="side-scroll">
        ${sections.length ? `<div class="side-group">${esc(d.sectionsTitle || 'This screen')}</div>
          ${sections.map((s, k) => `<button class="side-link ${k === 0 ? 'on' : ''}" data-section="${s.id}">${i(s.icon)}<span>${esc(s.label)}</span>${s.count != null ? `<span class="count" data-count="${s.id}">${s.count}</span>` : ''}</button>`).join('')}` : ''}
        <div class="side-group">Screens</div>
        ${SCREENS.map((s) => `<a href="${s.href}" class="${(s.href === '/' ? here === '/' : here === s.href) ? 'on' : ''}">${i(s.icon)}<span>${esc(s.who)}${s.what ? `<span style="opacity:.7"> · ${esc(s.what.split(' · ')[0])}</span>` : ''}</span></a>`).join('')}
      </div>
      <div class="side-card"><b>Demo mode</b><span id="sideAi">Fake money, live between all screens.</span><button class="btn" id="sideReset">${i('rotate-ccw')}Reset demo</button></div>`;
    document.body.prepend(side);

    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    document.body.append(scrim);

    shell.className = 'topbar';
    shell.innerHTML = `
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu">${i('menu')}</button>
      <div class="where"><b>${esc(d.title || '')}</b>${d.sub ? ' · ' + esc(d.sub) : ''}</div>
      <div class="right">
        ${d.langToggle ? `<div class="seg lang-top" id="langTop" aria-label="Language" title="Change language" data-noi18n><span class="lang-ico">${i('languages')}</span><button data-lang="en">EN</button><button data-lang="ta">தமிழ்</button><button data-lang="hi">हिन्दी</button></div>` : ''}
        <span class="live off" title="Live connection"></span>
        <button class="icon-btn" id="bellBtn" aria-label="Updates">${i('bell')}<span class="pip hidden" id="bellPip"></span></button>
        <div class="avatar">${esc(initial)}</div>
      </div>`;
    document.body.classList.add('has-side');

    const close = () => document.body.classList.remove('side-open');
    $('#menuBtn').onclick = () => document.body.classList.toggle('side-open');
    scrim.onclick = close;
    side.addEventListener('click', (e) => {
      const b = e.target.closest('[data-section]');
      if (!b) return;
      markSection(b.dataset.section);
      if (api_.self.onSection) api_.self.onSection(b.dataset.section);
      close();
    });
    $('#bellBtn').onclick = () => { if (api_.self.onBell) api_.self.onBell(); };
    const lt = $('#langTop');
    if (lt) lt.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) { setLangUI(b.dataset.lang); api('/api/merchant/lang', { lang: b.dataset.lang }); } });
    $('#sideReset').onclick = async () => {
      if (!confirm('Reset the whole demo? Payments, tickets and balances go back to the start.')) return;
      const pin = config.resetPin ? prompt('Reset PIN') : '';
      api('/api/reset', { pin }).then(() => toast('Demo reset.'));
    };
    ready.then((c) => { const el = $('#sideAi'); if (el) el.textContent = c.ai ? `Voxa agent runs on ${c.brainName} (${c.model}).` : 'Voxa agent runs in offline mode. Add a Sarvam or Claude key for full AI.'; });
    icons();
  }
  function markSection(id) { $$('.side [data-section]').forEach((x) => x.classList.toggle('on', x.dataset.section === id)); }
  function setCount(id, n) { const el = $(`.side [data-count="${id}"]`); if (el) el.textContent = n; }
  function setLangUI(lang) { $$('#langTop [data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang)); }
  function setBell(on) { const p = $('#bellPip'); if (p) p.classList.toggle('hidden', !on); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildShell); else setTimeout(buildShell, 0);

  // ---------- network ----------
  async function api(path, body) {
    const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || 'Something went wrong. Try again.');
      toast(err.message);
      throw err;
    }
    // when updates are polled, look at once instead of waiting for the next poll
    if (body !== undefined && refreshNow) setTimeout(refreshNow, 150);
    return data;
  }

  let toastTimer;
  function toast(text) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast hidden'; el.setAttribute('role', 'status'); document.body.appendChild(el); void el.offsetWidth; }
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  // Live state. Normally over Server-Sent Events, so every change arrives at once. On Vercel (config.serverless) it is
  // polled instead: a long-open connection would hold a server copy busy and make Vercel start extra copies.
  function subscribe(onState) {
    let es = null, timer = null, lastRev = null, polling = false;
    const setLive = (ok) => { const dot = $('.topbar .live'); if (dot) dot.classList.toggle('off', !ok); };
    const connect = () => {
      if (es) es.close();
      es = new EventSource('/api/stream');
      es.addEventListener('state', (e) => {
        setLive(true);
        try { onState(JSON.parse(e.data)); icons(); } catch (err) { console.error(err); }
      });
      es.onerror = () => setLive(false);
    };
    async function poll() {
      clearTimeout(timer);
      try {
        const r = await fetch('/api/state' + (lastRev === null ? '' : `?rev=${lastRev}`));
        const d = await r.json();
        setLive(r.ok);
        if (r.ok && !d.unchanged) { lastRev = d.rev; onState(d); icons(); }
      } catch (err) { setLive(false); }
      timer = setTimeout(poll, document.visibilityState === 'visible' ? 1200 : 8000);
    }
    ready.then((c) => {
      if (c.serverless) { polling = true; refreshNow = poll; poll(); } else connect();
    });
    // a phone freezes background tabs: when the app comes back, catch up straight away
    const resume = () => { if (polling) poll(); else if (!es || es.readyState !== 1) connect(); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); });
    window.addEventListener('online', resume);
  }

  let config = { claude: false, sarvam: false, cartesiaEnglish: false, cartesiaTamil: false, cartesiaHindi: false };
  const ready = fetch('/api/config').then((r) => r.json()).then((c) => (config = c)).catch(() => config);

  // ---------- voice ----------
  const LANG = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };
  let audio;
  let speakingKey = null;
  // Phones only let a page play sound that was started by a tap. One audio element is "unlocked" by the first tap
  // anywhere on the page and then reused for every spoken reply, so answers can play after the network call finishes.
  let player = null;
  const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
  const getPlayer = () => { if (!player) { player = new Audio(); player.preload = 'auto'; player.setAttribute('playsinline', ''); } return player; };
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked || typeof Audio !== 'function') return;
    audioUnlocked = true;
    const p = getPlayer();
    p.src = SILENCE;
    const played = p.play();
    if (played && played.then) played.then(() => p.pause()).catch(() => { audioUnlocked = false; });
  }
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((name) => document.addEventListener(name, unlockAudio, { passive: true }));
  const speakState = (key) => { speakingKey = key; document.dispatchEvent(new CustomEvent('voxa-speak', { detail: key })); };
  function stopSpeaking() {
    if (audio) { audio.pause(); audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    speakState(null);
  }
  async function speak(text, lang = 'en', key = 'voxa') {
    if (!text) return;
    const language = String(lang).toLowerCase().split(/[-_]/)[0];
    stopSpeaking();
    speakState(key);
    await ready;
    const useCartesia = (language === 'en' && config.cartesiaEnglish) || (language === 'ta' && config.cartesiaTamil) || (language === 'hi' && config.cartesiaHindi);
    const languageName = { en: 'English', ta: 'Tamil', hi: 'Hindi' }[language];
    if (config.sarvam || useCartesia) {
      try {
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang: language }) });
        if (r.ok) {
          const blob = await r.blob();
          if (audio) audio.pause();
          if (speakingKey !== key) return; // stopped while loading
          const url = URL.createObjectURL(blob);
          audio = getPlayer();
          audio.src = url;
          audio.onended = () => { URL.revokeObjectURL(url); if (speakingKey === key) speakState(null); };
          await audio.play().catch(() => { toast('Tap the Play button to hear the reply.'); speakState(null); });
          return;
        }
        if (useCartesia) {
          toast(`Cartesia ${languageName} voice failed (${r.status}). Try again.`);
          speakState(null);
          return;
        }
      } catch (e) {
        if (useCartesia) {
          toast(`Cartesia ${languageName} voice could not be reached. Check your connection and try again.`);
          speakState(null);
          return;
        }
      }
    }
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG[language] || 'en-IN';
    const voices = speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === u.lang) || voices.find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.onend = () => { if (speakingKey === key) speakState(null); };
    speechSynthesis.speak(u);
  }

  // With a Sarvam key: record a short clip and let Sarvam (Saaras) turn it into text.
  // Otherwise, or if Sarvam fails once, use the browser's own speech recognition.
  let sarvamSttBroken = false;
  // Sarvam accepts WAV, so the recording is turned into a small 16 kHz mono WAV on the phone first.
  async function toWav16k(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close && ctx.close();
    const rate = 16000, len = Math.max(1, Math.ceil(decoded.duration * rate));
    const off = new OfflineAudioContext(1, len, rate);
    const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(buf);
    const str = (o, s) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let k = 0; k < pcm.length; k++) v.setInt16(44 + k * 2, Math.max(-1, Math.min(1, pcm[k])) * 0x7fff, true);
    return new Blob([buf], { type: 'audio/wav' });
  }

  function listenSarvam(lang, onText, onEnd, onRecording) {
    let cancelled = false;
    const ctl = { rec: null, stop() {
      if (!this.rec) { cancelled = true; onEnd && onEnd(); }
      else if (this.rec.state !== 'inactive') this.rec.stop();
    } };
    const t0 = Date.now();
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      const chunks = [];
      let rec;
      try { rec = new MediaRecorder(stream); }
      catch (e) { stream.getTracks().forEach((t) => t.stop()); throw e; }
      ctl.rec = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        onRecording && onRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const raw = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const secs = Math.ceil((Date.now() - t0) / 1000);
        try {
          toast('Got it, reading what you said…');
          const blob = await toWav16k(raw);
          const r = await fetch(`/api/stt?lang=${encodeURIComponent(lang)}&secs=${secs}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: blob });
          const d = await r.json();
          if (r.ok && d.transcript) onText(d.transcript, d.language);
          else if (r.ok) toast('I did not catch that. Tap the mic and speak a little closer.');
          // only "not configured" switches to the browser voice; a temporary error just asks to try again
          else if (r.status === 404) { sarvamSttBroken = true; toast('Speech service is not set up. Using the browser voice.'); }
          else toast('Could not read that just now (' + (d.error || r.status) + '). Tap the mic and try again.');
        } catch (e) { toast('Speech error: ' + e.message); }
        onEnd && onEnd();
      };
      try { rec.start(); }
      catch (e) { stream.getTracks().forEach((t) => t.stop()); throw e; }
      onRecording && onRecording(true);
      toast('Listening… tap the mic again when you finish');
      setTimeout(() => ctl.stop(), 15000);
    }).catch((e) => { if (!cancelled) { toast(e && e.name === 'NotAllowedError' ? MIC_BLOCKED : 'Microphone error: ' + (e && e.message)); onEnd && onEnd(); } });
    return ctl;
  }

  // Browser speech recognition (no Sarvam key). stop() must work even if the browser never answers the permission prompt.
  function listenBrowser(lang, SR, onText, onEnd, onRecording) {
    const r = new SR();
    r.lang = LANG[lang] || 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onstart = () => onRecording && onRecording(true);
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onerror = (e) => {
      if (e.error === 'aborted') return;
      if (e.error === 'no-speech') toast('I did not hear anything. Tap the mic and speak a little closer.');
      else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast(MIC_BLOCKED);
      else toast('Microphone: ' + e.error);
    };
    r.onend = () => { onRecording && onRecording(false); onEnd && onEnd(); };
    try { r.start(); } catch (e) { toast('Microphone: ' + e.message); onEnd && onEnd(); return { stop() {} }; }
    return { stop() { try { r.abort(); } catch (e) { /* already stopped */ } onEnd && onEnd(); } };
  }

  const MIC_BLOCKED = 'The microphone is blocked for this page. Click the lock icon in the address bar, allow Microphone, then try again.';

  // Returns { stop() }. onEnd runs exactly once, whatever happens (done, blocked, stopped early).
  function listen(lang, onText, onEnd, onRecording) {
    let over = false;
    const end = () => { if (over) return; over = true; onEnd && onEnd(); };
    const useSarvam = (config.stt || config.sarvam) && !sarvamSttBroken && navigator.mediaDevices && window.MediaRecorder;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!useSarvam && !SR) { toast('Voice input needs Chrome. You can type instead.'); end(); return null; }
    const inner = useSarvam ? listenSarvam(lang, onText, end, onRecording) : listenBrowser(lang, SR, onText, end, onRecording);
    // a blocked microphone never answers the request, so check the permission and say so instead of waiting
    try {
      navigator.permissions && navigator.permissions.query({ name: 'microphone' }).then((p) => {
        if (p.state === 'denied' && !over) { toast(MIC_BLOCKED); inner.stop(); end(); }
      }).catch(() => {});
    } catch (e) { /* Permissions API not available */ }
    return { stop() { inner.stop(); } };
  }

  // ---------- tags ----------
  const statusLabel = { awaiting_bank: 'On its way', success: 'Success', pending: 'Pending', failed: 'Failed', reversed: 'Refunded', processing: 'Processing', resolved: 'Resolved', needs_human: 'Needs a person', voxa: 'Waiting on bank', held: 'On hold', paid: 'Paid' };
  const statusIcon = { awaiting_bank: 'hourglass', success: 'check', pending: 'hourglass', failed: 'x', reversed: 'undo-2', processing: 'loader', resolved: 'check', needs_human: 'user-round', voxa: 'bot', held: 'pause', paid: 'check' };
  const badge = (status, label) => `<span class="tag ${esc(status)}">${statusIcon[status] ? i(statusIcon[status]) : ''}${esc(label || statusLabel[status] || status)}</span>`;

  // ---------- signature: the payment route ----------
  const STATIONS = ['Voxa Pay', 'Bank debit', 'NPCI', 'Murugan', 'Done'];
  const nodeIcon = { done: 'check', timeout: 'clock', failed: 'x' };
  function route(txn) {
    if (!txn.steps || !txn.steps.length) return '';
    return `<div class="route" role="list" aria-label="Payment route">${txn.steps.map((s, k) => `
      <div class="stn ${s.state}" role="listitem" title="${esc(s.label)}${s.detail ? ': ' + esc(s.detail) : ''}">
        <div class="node">${nodeIcon[s.state] ? i(nodeIcon[s.state]) : ''}</div>
        <div class="lbl">${STATIONS[k]}</div>
        ${s.state === 'timeout' ? '<div class="sub">no reply</div>' : s.state === 'failed' ? '<div class="sub">failed</div>' : ''}
      </div>`).join('')}</div>`;
  }
  function vroute(txn) {
    if (!txn.steps || !txn.steps.length) return '';
    return `<div class="vroute">${txn.steps.map((s) => `
      <div class="stn ${s.state}"><div class="node">${nodeIcon[s.state] ? i(nodeIcon[s.state]) : ''}</div>
      <div><div class="lbl">${esc(s.label)}</div>${s.detail ? `<div class="sub">${esc(s.detail)}</div>` : ''}</div></div>`).join('')}</div>`;
  }

  // CSV download for the "Download report" buttons
  function download(filename, rows) {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const self = { inr, esc, time, ago, $, $$, i, icons, api, toast, subscribe, speak, stopSpeaking, speakingKey: () => speakingKey, listen, badge, route, vroute, download, markSection, setCount, setBell, setLangUI, ready: () => ready, config: () => config };
  api_.self = self;
  return self;
})();
