// Shared helpers for every Voxa screen: shell + screen switcher, icons, live state,
// voice, and the signature payment-route component.
window.V = (() => {
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
        ${d.langToggle ? `<div class="seg lang-top" id="langTop" aria-label="Language" title="Change language" data-noi18n><span class="lang-ico">${i('languages')}</span><button data-lang="en">EN</button><button data-lang="ta">தமிழ்</button></div>` : ''}
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

  // Live state over Server-Sent Events. onState(state) runs on every change.
  function subscribe(onState) {
    const es = new EventSource('/api/stream');
    es.addEventListener('state', (e) => {
      const dot = $('.topbar .live');
      if (dot) dot.classList.remove('off');
      try { onState(JSON.parse(e.data)); icons(); } catch (err) { console.error(err); }
    });
    es.onerror = () => { const dot = $('.topbar .live'); if (dot) dot.classList.add('off'); };
  }

  let config = { claude: false, sarvam: false };
  const ready = fetch('/api/config').then((r) => r.json()).then((c) => (config = c)).catch(() => config);

  // ---------- voice ----------
  const LANG = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };
  let audio;
  let speakingKey = null;
  const speakState = (key) => { speakingKey = key; document.dispatchEvent(new CustomEvent('voxa-speak', { detail: key })); };
  function stopSpeaking() {
    if (audio) { audio.pause(); audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    speakState(null);
  }
  async function speak(text, lang = 'en', key = 'voxa') {
    if (!text) return;
    stopSpeaking();
    speakState(key);
    await ready;
    if (config.sarvam) {
      try {
        const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) });
        if (r.ok) {
          const blob = await r.blob();
          if (audio) audio.pause();
          if (speakingKey !== key) return; // stopped while loading
          audio = new Audio(URL.createObjectURL(blob));
          audio.onended = () => { if (speakingKey === key) speakState(null); };
          await audio.play().catch(() => speakState(null));
          return;
        }
      } catch (e) { /* fall back to the browser voice */ }
    }
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG[lang] || 'en-IN';
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

  function listenSarvam(lang, onText, onEnd) {
    const ctl = { rec: null, stop() { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } };
    const t0 = Date.now();
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const chunks = [];
      const rec = new MediaRecorder(stream);
      ctl.rec = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
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
          // a failure only skips Sarvam for the next try, it does not switch off Sarvam for good
          else { sarvamSttBroken = true; setTimeout(() => (sarvamSttBroken = false), 30000); toast('Sarvam speech failed (' + (d.error || r.status) + '). Using the browser voice for the next try.'); }
        } catch (e) { toast('Speech error: ' + e.message); }
        onEnd && onEnd();
      };
      rec.start();
      toast('Listening… tap the mic again when you finish');
      setTimeout(() => ctl.stop(), 15000);
    }).catch(() => { toast('Microphone is blocked. Allow it in the browser.'); onEnd && onEnd(); });
    return ctl;
  }

  function listen(lang, onText, onEnd) {
    if (config.sarvam && !sarvamSttBroken && navigator.mediaDevices && window.MediaRecorder) return listenSarvam(lang, onText, onEnd);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice input needs Chrome. You can type instead.'); onEnd && onEnd(); return null; }
    const r = new SR();
    r.lang = LANG[lang] || 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onerror = (e) => { if (e.error !== 'aborted') toast('Microphone: ' + e.error); };
    r.onend = () => onEnd && onEnd();
    r.start();
    return r;
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
