// The AI-first shell around the merchant screens: routes (#/screen?params), the short sidebar with sub-tabs,
// the Voxa Copilot (docked beside the screen on a computer, a bottom sheet on a phone), Ctrl/Cmd+K,
// Home with the briefing, Settings, hands-free voice and the theme. Loaded after the page script.
(function () {
  const { $, $$, esc, inr, i, icons, api } = V;
  const LS = window.localStorage;
  const L = () => (S && S.merchant && S.merchant.lang) || 'en';
  const t3 = (o) => (o && (o[L()] || o.en)) || '';

  // ---------- screens and navigation ----------
  const PANE_OF = { home: 'home', sales: 'dashboard', payments: 'payments', costs: 'costs', loan: 'loan', insights: 'insights', customers: 'customers', whatsapp: 'whatsapp', notes: 'notes', settings: 'settings' };
  window.SCREEN_OF = { dashboard: 'sales', voxa: 'ask', home: 'home', payments: 'payments', costs: 'costs', loan: 'loan', insights: 'insights', customers: 'customers', whatsapp: 'whatsapp', notes: 'notes', settings: 'settings' };
  const GROUPS = { money: ['sales', 'payments', 'costs', 'loan'], customers: ['customers', 'whatsapp'] };
  const groupOf = (screen) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(screen)) || screen;
  const NAMES = {
    home: { en: 'Home', ta: 'முகப்பு', hi: 'होम' }, ask: { en: 'Ask Voxa', ta: 'Voxa-விடம் கேள்', hi: 'Voxa से पूछें' }, money: { en: 'Money', ta: 'பணம்', hi: 'पैसा' },
    customers: { en: 'Customers', ta: 'வாடிக்கையாளர்கள்', hi: 'ग्राहक' }, insights: { en: 'Insights', ta: 'நுண்ணறிவு', hi: 'इनसाइट्स' }, notes: { en: 'Notes', ta: 'குறிப்புகள்', hi: 'नोट्स' },
    settings: { en: 'Settings', ta: 'அமைப்புகள்', hi: 'सेटिंग्स' }, sales: { en: 'Sales', ta: 'விற்பனை', hi: 'बिक्री' }, payments: { en: 'Payments', ta: 'பணம் வரவு', hi: 'पेमेंट' },
    costs: { en: 'Costs & profit', ta: 'செலவு & லாபம்', hi: 'खर्च और मुनाफ़ा' }, loan: { en: 'Loan', ta: 'கடன்', hi: 'लोन' }, whatsapp: { en: 'Messages', ta: 'செய்திகள்', hi: 'मैसेज' },
    udhaar: { en: 'Customers & Udhaar', ta: 'வாடிக்கையாளர் & உதார்', hi: 'ग्राहक और उधार' },
  };
  const subName = (s) => (s === 'customers' ? NAMES.udhaar : NAMES[s]);
  V.sections = [
    { id: 'home', label: 'Home', icon: 'house' },
    { id: 'ask', label: 'Ask Voxa', icon: 'sparkles' },
    { id: 'money', label: 'Money', icon: 'wallet', count: '' },
    { id: 'customers', label: 'Customers', icon: 'users' },
    { id: 'insights', label: 'Insights', icon: 'lightbulb' },
    { id: 'notes', label: 'Notes', icon: 'notebook-pen', count: '' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  V.onSection = (id) => {
    if (id === 'ask') { openFull(); return; }
    go(GROUPS[id] ? GROUPS[id][0] : id);
  };
  // the page's count badges used old ids
  const setCount0 = V.setCount;
  V.setCount = (id, n) => { const v = n ? n : ''; if (id === 'payments') setCount0('money', v); else if (id === 'notes') setCount0('notes', v); };

  let current = { screen: 'home', params: {} };
  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    const [screen, q] = h.split('?');
    const params = {};
    new URLSearchParams(q || '').forEach((v, k) => { params[k] = v; });
    return { screen: PANE_OF[screen] ? screen : 'home', params };
  }
  function go(screen, params = {}) {
    if (screen === 'ask') { openFull(); return; }
    const q = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
    const h = '#/' + screen + (q ? '?' + q : '');
    if (location.hash === h) route(); else location.hash = h;
  }
  V.go = go;
  function route() {
    current = parseHash();
    const { screen, params } = current;
    document.body.classList.remove('cp-full');
    showPane(PANE_OF[screen]);
    V.markSection(screen === 'ask' ? 'ask' : groupOf(screen));
    $('#title').textContent = t3(screen === 'customers' ? NAMES.udhaar : NAMES[screen]);
    $('#crumb').textContent = GROUPS[groupOf(screen)] ? `${t3(NAMES[groupOf(screen)])} / ${t3(subName(screen))}` : 'Murugan and Co';
    renderTabs();
    applyParams(screen, params);
    if (screen === 'home') renderHome(true);
    if (screen === 'settings') renderSettings();
    if (typeof renderChat === 'function' && S) renderChat();
    // a phone shows the chosen screen: the conversation sheet folds down
    if (isPhone()) document.body.classList.remove('cp-sheet');
  }
  window.addEventListener('hashchange', route);

  function renderTabs() {
    const g = GROUPS[groupOf(current.screen)];
    const el = $('#subtabs');
    el.classList.toggle('hidden', !g);
    if (!g) return;
    el.innerHTML = g.map((s) => `<button class="${s === current.screen ? 'on' : ''}" data-go="${s}" data-goparams="{}">${esc(t3(subName(s)))}</button>`).join('');
  }

  // ---------- filters Voxa applies when it opens a screen ----------
  const PERIOD_OF = { last_7_days: '7', this_week: '7', last_week: '7', last_30_days: '30', this_month: '30', last_month: '30', last_90_days: '90', last_6_months: 'm6', last_12_months: 'm12' };
  const FOCUS_LABEL = {
    weak_days: { en: 'Weak sales days', ta: 'குறைந்த விற்பனை நாட்கள்', hi: 'कमज़ोर बिक्री के दिन' }, regulars: { en: 'Regular customers who stopped', ta: 'வருவதை நிறுத்திய வழக்கமானவர்கள்', hi: 'आना बंद किए रेगुलर ग्राहक' },
    pending: { en: 'Stuck payments', ta: 'சிக்கிய பணம்', hi: 'अटके पेमेंट' }, owes: { en: 'Customers who owe Udhaar', ta: 'உதார் பாக்கி உள்ளவர்கள்', hi: 'जिन पर उधार बाकी है' },
    range: { en: 'Period chosen by Voxa', ta: 'Voxa தேர்ந்த காலம்', hi: 'Voxa का चुना समय' }, filtered: { en: 'Filtered by Voxa', ta: 'Voxa வடிகட்டியது', hi: 'Voxa ने छाँटा' }, clear: { en: 'Clear', ta: 'நீக்கு', hi: 'हटाएँ' },
  };
  async function focusCard(q, label) {
    const box = $('#paneFocus');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="focus-bar">${i('filter')}<b>${esc(t3(FOCUS_LABEL.filtered))}:</b> ${esc(label)}<button class="btn sm quiet" data-go="${esc(current.screen)}" data-goparams="{}">${i('x')}${esc(t3(FOCUS_LABEL.clear))}</button></div><div class="focus-card"><div class="vc skeleton"></div></div>`;
    icons();
    try {
      const c = await (await fetch('/api/card?' + new URLSearchParams(q))).json();
      if (c && c.type) { box.querySelector('.focus-card').innerHTML = VC.render(c, L(), S); icons(); }
    } catch { box.querySelector('.focus-card').innerHTML = ''; }
  }
  function applyParams(screen, p) {
    const box = $('#paneFocus');
    box.classList.add('hidden'); box.innerHTML = '';
    if ((screen === 'sales' || screen === 'insights') && p.range && PERIOD_OF[p.range] && typeof period !== 'undefined' && period !== PERIOD_OF[p.range]) { period = PERIOD_OF[p.range]; if (S) render(); }
    if (screen === 'insights' && p.view === 'weak_days') focusCard({ type: 'sales', range: p.range || 'last_30_days', group_by: 'weekday' }, t3(FOCUS_LABEL.weak_days));
    else if (screen === 'insights' && p.view === 'regulars') focusCard({ type: 'customers', filter: 'stopped' }, t3(FOCUS_LABEL.regulars));
    else if (screen === 'payments' && p.view && p.view !== 'all') focusCard({ type: 'payments', status: p.view }, t3(FOCUS_LABEL[p.view] || { en: p.view }));
    else if (screen === 'customers' && p.view && p.view !== 'all') focusCard({ type: 'customers', filter: p.view }, t3(FOCUS_LABEL[p.view] || { en: p.view }));
    else if (screen === 'costs' && p.range && p.range !== 'this_month') focusCard({ type: 'profit', range: p.range }, t3(FOCUS_LABEL.range));
    else if (screen === 'sales' && p.range && !['last_7_days', 'last_30_days', 'last_90_days', 'last_6_months', 'last_12_months'].includes(p.range)) focusCard({ type: 'sales', range: p.range }, t3(FOCUS_LABEL.range));
    if (screen === 'loan' && p.amount && typeof loanIn !== 'undefined') { loanIn.amount = Number(p.amount); if (p.months) loanIn.months = Number(p.months); setLoanView('calc'); loadPlan(); }
  }

  // what he is looking at goes with every question
  V.context = () => {
    const ctx = { screen: current.screen, params: current.params };
    if (current.screen === 'customers' && typeof crmOpen !== 'undefined' && crmOpen && S) { const cu = S.crm.customers.find((x) => x.id === crmOpen); if (cu) ctx.entity = { customer: cu.name }; }
    if (current.screen === 'sales' || current.screen === 'insights') ctx.params = { ...ctx.params, period: typeof period !== 'undefined' ? period : undefined };
    return ctx;
  };

  // ---------- the Copilot ----------
  const isPhone = () => window.matchMedia('(max-width: 899px)').matches;
  const body = document.body;
  function openCopilot(showConversation) {
    if (isPhone()) { if (showConversation !== false) body.classList.add('cp-sheet'); }
    else { body.classList.add('cp-open'); LS.setItem('voxa-cp', 'open'); }
    if (typeof renderChat === 'function' && S) renderChat();
  }
  function closeCopilot() {
    if (isPhone()) body.classList.remove('cp-sheet');
    else { body.classList.remove('cp-open', 'cp-full'); LS.setItem('voxa-cp', 'closed'); }
  }
  function openFull() {
    V.markSection('ask');
    if (isPhone()) { body.classList.add('cp-sheet'); }
    else { body.classList.add('cp-open', 'cp-full'); }
    if (typeof renderChat === 'function' && S) renderChat();
    setTimeout(() => $('#chatInput').focus({ preventScroll: true }), 60);
  }
  V.openCopilot = openCopilot; V.closeCopilot = closeCopilot;
  $('#voxaClose').onclick = () => { if (body.classList.contains('cp-full')) { body.classList.remove('cp-full'); V.markSection(groupOf(current.screen)); renderChat(); } else closeCopilot(); };
  $('#cpFull').onclick = () => { if (body.classList.contains('cp-full')) { body.classList.remove('cp-full'); V.markSection(groupOf(current.screen)); renderChat(); } else openFull(); };
  $('#cpExpand').onclick = () => body.classList.toggle('cp-sheet');
  $('#cpGrab').onclick = () => body.classList.toggle('cp-sheet');
  $('#chatInput').addEventListener('focus', () => { if (isPhone() && S && S.chat.length) body.classList.add('cp-sheet'); });
  // a topbar button opens and closes it on a computer
  function addTopButton() {
    const right = $('.topbar .right');
    if (!right || $('#cpToggle')) return false;
    const b = document.createElement('button');
    b.className = 'icon-btn cp-toggle'; b.id = 'cpToggle'; b.setAttribute('aria-label', 'Ask Voxa'); b.title = 'Ask Voxa (Ctrl+K)';
    b.innerHTML = i('sparkles');
    b.onclick = () => (body.classList.contains('cp-open') ? closeCopilot() : openCopilot());
    right.prepend(b);
    icons();
    return true;
  }
  // drag the left edge to resize; the width is remembered
  const savedW = Number(LS.getItem('voxa-cp-w'));
  if (savedW) document.documentElement.style.setProperty('--cp-w', savedW + 'px');
  $('#cpResize').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const move = (ev) => { const w = Math.max(340, Math.min(Math.round(window.innerWidth * 0.55), window.innerWidth - ev.clientX)); document.documentElement.style.setProperty('--cp-w', w + 'px'); LS.setItem('voxa-cp-w', w); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); body.classList.remove('cp-resizing'); };
    body.classList.add('cp-resizing');
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  // ---------- hands-free voice ----------
  const VS = { handsFree: LS.getItem('voxa-hands') === '1', onState };
  window.VS = VS;
  function setHands(on) {
    VS.handsFree = on; LS.setItem('voxa-hands', on ? '1' : '0');
    $('#handsFree').classList.toggle('on', on); $('#handsFree').setAttribute('aria-pressed', String(on));
    body.classList.toggle('hands-free', on);
  }
  $('#handsFree').onclick = () => { setHands(!VS.handsFree); if (VS.handsFree) { V.toast(t3({ en: 'Hands-free on: speak, Voxa answers, then listens again.', ta: 'கைகள் இல்லா முறை: பேசுங்கள், Voxa பதில் சொல்லி மீண்டும் கேட்கும்.', hi: 'हैंड्स-फ़्री चालू: बोलिए, Voxa जवाब देकर फिर सुनेगा।' })); if (!rec) $('#mic').click(); } };
  setHands(VS.handsFree);
  // after Voxa finishes speaking, listen again
  let wasSpeaking = false;
  document.addEventListener('voxa-speak', (e) => {
    if (e.detail) { wasSpeaking = true; return; }
    if (wasSpeaking && VS.handsFree && !rec && !busy && (body.classList.contains('cp-open') || body.classList.contains('cp-sheet'))) setTimeout(() => { if (!rec && VS.handsFree) $('#mic').click(); }, 350);
    wasSpeaking = false;
  });

  // ---------- Ctrl/Cmd+K: go anywhere or ask anything ----------
  const pal = document.createElement('div');
  pal.className = 'palette hidden'; pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-label', 'Search or ask');
  pal.innerHTML = `<div class="palette-box"><div class="palette-in">${i('sparkles')}<input id="palIn" data-noi18n autocomplete="off" placeholder="Go to a screen or ask Voxa…"><kbd>Esc</kbd></div><div class="palette-list" id="palList" data-noi18n></div></div>`;
  document.body.append(pal);
  let palSel = 0, palItems = [];
  const PAL_SCREENS = ['home', 'sales', 'payments', 'costs', 'loan', 'customers', 'whatsapp', 'insights', 'notes', 'settings'];
  const PAL_ICON = { home: 'house', sales: 'chart-column', payments: 'arrow-left-right', costs: 'piggy-bank', loan: 'hand-coins', customers: 'users', whatsapp: 'message-circle', insights: 'lightbulb', notes: 'notebook-pen', settings: 'settings' };
  function palRender() {
    const q = $('#palIn').value.trim().toLowerCase();
    const screens = PAL_SCREENS.filter((s) => !q || [NAMES[s].en, NAMES[s].ta, NAMES[s].hi, s, s === 'customers' ? 'udhaar' : ''].some((n) => n.toLowerCase().includes(q)))
      .map((s) => ({ kind: 'go', s, label: t3(subName(s)), icon: PAL_ICON[s] }));
    const asks = (q ? [$('#palIn').value.trim()] : quickFor(L()).slice(0, 4)).map((x) => ({ kind: 'ask', label: x, icon: 'sparkles' }));
    palItems = q ? [...asks, ...screens] : [...screens.slice(0, 6), ...asks];
    palSel = Math.min(palSel, palItems.length - 1);
    $('#palList').innerHTML = palItems.map((x, k) => `<button class="pal-item ${k === palSel ? 'on' : ''}" data-pal="${k}">${i(x.icon)}<span>${x.kind === 'ask' ? `<em>${esc(t3({ en: 'Ask Voxa', ta: 'Voxa-விடம் கேள்', hi: 'Voxa से पूछें' }))}:</em> ` : ''}${esc(x.label)}</span>${x.kind === 'go' ? `<small>${esc(t3({ en: 'Open', ta: 'திற', hi: 'खोलें' }))}</small>` : ''}</button>`).join('');
    icons();
  }
  function palOpen() { pal.classList.remove('hidden'); $('#palIn').value = ''; palSel = 0; palRender(); setTimeout(() => $('#palIn').focus(), 10); }
  function palClose() { pal.classList.add('hidden'); }
  function palPick(k) { const x = palItems[k]; if (!x) return; palClose(); if (x.kind === 'go') go(x.s); else { openCopilot(true); ask(x.label); } }
  $('#palIn').addEventListener('input', () => { palSel = 0; palRender(); });
  $('#palIn').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { palSel = (palSel + 1) % palItems.length; palRender(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { palSel = (palSel - 1 + palItems.length) % palItems.length; palRender(); e.preventDefault(); }
    else if (e.key === 'Enter') { palPick(palSel); e.preventDefault(); }
  });
  pal.addEventListener('click', (e) => { const b = e.target.closest('[data-pal]'); if (b) palPick(Number(b.dataset.pal)); else if (e.target === pal) palClose(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('hidden') ? palOpen() : palClose(); }
    else if (e.key === 'Escape') { if (!pal.classList.contains('hidden')) palClose(); else if (body.classList.contains('cp-full')) $('#voxaClose').click(); else if (body.classList.contains('cp-sheet')) body.classList.remove('cp-sheet'); }
  });
  V.palette = palOpen;

  // ---------- suggestions for the screen he is on ----------
  const BY_SCREEN = {
    home: { en: ['How much profit did I make this week?', 'Who owes me money?', 'Can I get a loan of 1 lakh?'], ta: ['இந்த வாரம் லாபம் எவ்வளவு?', 'யார் எனக்கு உதார் பாக்கி?', 'எனக்கு 1 லட்சம் கடன் கிடைக்குமா?'], hi: ['इस हफ़्ते कितना मुनाफ़ा हुआ?', 'किस पर उधार बाकी है?', 'क्या मुझे 1 लाख का लोन मिल सकता है?'] },
    customers: { en: ['Who owes me the most?', 'Remind everyone who owes me'], ta: ['யார் அதிகம் உதார் தர வேண்டும்?', 'பாக்கி உள்ள எல்லோருக்கும் நினைவூட்டு'], hi: ['सबसे ज़्यादा उधार किस पर है?', 'जिन पर उधार है सबको याद दिलाओ'] },
    loan: { en: ['Can I afford a 1 lakh loan?', 'Explain my loan simply'], ta: ['1 லட்சம் கடன் எடுக்க முடியுமா?', 'என் கடனை எளிமையாக விளக்குங்கள்'], hi: ['क्या मैं 1 लाख का लोन ले सकता हूँ?', 'मेरा लोन आसान शब्दों में समझाइए'] },
    costs: { en: ['How much profit did I make this week?', 'Profit last month'], ta: ['இந்த வாரம் லாபம் எவ்வளவு?', 'கடந்த மாதம் லாபம்'], hi: ['इस हफ़्ते कितना मुनाफ़ा हुआ?', 'पिछले महीने का मुनाफ़ा'] },
    insights: { en: ['Show weak sales days', 'Which regular customers stopped coming?'], ta: ['குறைந்த விற்பனை நாட்களைக் காட்டு', 'எந்த வழக்கமான வாடிக்கையாளர்கள் வரவில்லை?'], hi: ['कमज़ोर बिक्री वाले दिन दिखाओ', 'कौन से रेगुलर ग्राहक आना बंद हुए?'] },
    sales: { en: ['How were sales this week?', 'Show weak sales days'], ta: ['இந்த வார விற்பனை எப்படி?', 'குறைந்த விற்பனை நாட்களைக் காட்டு'], hi: ['इस हफ़्ते बिक्री कैसी रही?', 'कमज़ोर बिक्री वाले दिन दिखाओ'] },
    payments: { en: ['Any stuck payments today?', 'Payments yesterday'], ta: ['இன்று ஏதாவது பணம் சிக்கியதா?', 'நேற்றைய பணம்'], hi: ['आज कोई पेमेंट रुका है?', 'कल के पेमेंट'] },
  };
  const baseQuick = window.quickFor;
  window.quickFor = function (lang) {
    const own = (BY_SCREEN[current.screen] || {})[lang] || (BY_SCREEN[current.screen] || {}).en || [];
    return [...new Set([...own, ...baseQuick(lang)])].slice(0, 4);
  };

  // ---------- Home ----------
  const HOME_T = {
    ph: { en: 'Ask Voxa anything about your shop…', ta: 'உங்கள் கடையைப் பற்றி Voxa-விடம் எதையும் கேளுங்கள்…', hi: 'अपनी दुकान के बारे में Voxa से कुछ भी पूछिए…' },
    brief: { en: 'Today’s briefing', ta: 'இன்றைய சுருக்கம்', hi: 'आज की ख़ास बातें' },
    kpi: { today: { en: 'Today', ta: 'இன்று', hi: 'आज' }, week: { en: 'This week', ta: 'இந்த வாரம்', hi: 'इस हफ़्ते' }, left: { en: 'Left this month', ta: 'இந்த மாதம் மிச்சம்', hi: 'इस महीने बचे' }, bank: { en: 'Bank balance', ta: 'வங்கி இருப்பு', hi: 'बैंक बैलेंस' } },
    bills: { en: 'bills', ta: 'பில்கள்', hi: 'बिल' }, updated: { en: 'Updated', ta: 'புதுப்பித்தது', hi: 'अपडेट' },
    sub: { en: 'Speak or type in Tamil, Hindi or English', ta: 'தமிழ், இந்தி அல்லது ஆங்கிலத்தில் பேசுங்கள் அல்லது எழுதுங்கள்', hi: 'तमिल, हिंदी या अंग्रेज़ी में बोलिए या लिखिए' },
  };
  let briefRev = -1, briefLang = '', briefBusy = false;
  async function renderHome(force) {
    if (!S || current.screen !== 'home') return;
    const lang = L();
    $('#homeInput').placeholder = t3(HOME_T.ph);
    $('#homeChips').innerHTML = quickFor(lang).slice(0, 4).map((q) => `<button class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('');
    $('#briefTitle').textContent = t3(HOME_T.brief);
    if (briefBusy || (!force && briefRev === S.rev && briefLang === lang)) return;
    briefBusy = true;
    try {
      const b = await (await fetch('/api/merchant/briefing?lang=' + lang)).json();
      briefRev = S.rev; briefLang = lang;
      $('#homeGreet').innerHTML = `<h1>${esc(b.greeting)}</h1><p>${esc(t3(HOME_T.sub))}</p>`;
      const k = b.kpis;
      $('#homeKpis').innerHTML = [
        ['today', inr(k.today), `${k.bills} ${t3(HOME_T.bills)}`, 'sales'], ['week', inr(k.week), '', 'sales'], ['left', inr(k.left), '', 'costs'], ['bank', inr(k.bank), '', 'payments'],
      ].map(([key, v, sub, to]) => `<button class="hk" data-go="${to}" data-goparams="{}"><span>${esc(t3(HOME_T.kpi[key]))}</span><b>${v}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('');
      $('#briefing').innerHTML = b.items.map((it) => VC.render({ type: 'insight', data: it }, lang, S)).join('');
      $('#briefWhen').textContent = `${t3(HOME_T.updated)} ${new Date().toLocaleTimeString(lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' })}`;
      icons();
    } catch { /* keep what is shown */ } finally { briefBusy = false; }
  }
  $('#askBar').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#homeInput').value.trim(); if (!v) return; $('#homeInput').value = ''; openCopilot(true); ask(v); });
  $('#homeMic').onclick = () => { openCopilot(true); $('#mic').click(); };

  // ---------- Settings ----------
  const ST = {
    look: { en: 'Look', ta: 'தோற்றம்', hi: 'रूप' }, dark: { en: 'Dark mode', ta: 'இருண்ட தோற்றம்', hi: 'डार्क मोड' }, dev: { en: 'Developer', ta: 'டெவலப்பர்', hi: 'डेवलपर' },
    devShow: { en: 'Show which AI and voice answered', ta: 'எந்த AI, குரல் பதிலளித்தது என்று காட்டு', hi: 'कौन सा AI और आवाज़ ने जवाब दिया, दिखाएँ' },
    voice: { en: 'Voice', ta: 'குரல்', hi: 'आवाज़' }, hands: { en: 'Hands-free: after each answer, listen again', ta: 'ஒவ்வொரு பதிலுக்குப் பின் மீண்டும் கேள்', hi: 'हर जवाब के बाद फिर से सुनें' },
    demo: { en: 'Demo screens', ta: 'டெமோ திரைகள்', hi: 'डेमो स्क्रीन' }, reset: { en: 'Reset demo', ta: 'டெமோ மீட்டமை', hi: 'डेमो रीसेट' },
    resetHint: { en: 'Payments, tickets and balances go back to the start.', ta: 'பணம், புகார்கள், இருப்பு எல்லாம் தொடக்க நிலைக்கு.', hi: 'पेमेंट, टिकट और बैलेंस शुरुआत पर लौट जाएँगे।' },
    keys: { en: 'Shortcut: Ctrl+K (⌘K on Mac) to go anywhere or ask Voxa.', ta: 'Ctrl+K: எங்கும் செல்ல அல்லது Voxa-விடம் கேட்க.', hi: 'Ctrl+K: कहीं भी जाएँ या Voxa से पूछें।' },
  };
  const DEMO = [['/', 'layout-grid', 'All screens'], ['/pay', 'smartphone', 'Customer: Voxa Pay'], ['/naveen', 'smartphone', 'Customer: Naveen'], ['/bank', 'landmark', 'Voxa Bank'], ['/support', 'headphones', 'Voxa Support']];
  function renderSettings() {
    const dark = body.dataset.theme === 'dark', dev = body.classList.contains('dev');
    $('#settingsPane').innerHTML = `
      <div class="panel"><div class="panel-body stack" style="gap:14px">
        <h2 class="card-title">${esc(t3(ST.look))}</h2>
        <label class="switch-row"><span>${i('moon')}${esc(t3(ST.dark))}</span><input type="checkbox" id="setDark" ${dark ? 'checked' : ''}></label>
        <h2 class="card-title">${esc(t3(ST.voice))}</h2>
        <label class="switch-row"><span>${i('audio-lines')}${esc(t3(ST.hands))}</span><input type="checkbox" id="setHands" ${VS.handsFree ? 'checked' : ''}></label>
        <h2 class="card-title">${esc(t3(ST.dev))}</h2>
        <label class="switch-row"><span>${i('code-xml')}${esc(t3(ST.devShow))}</span><input type="checkbox" id="setDev" ${dev ? 'checked' : ''}></label>
        <div class="tiny muted dev-only" id="devInfo"></div>
        <p class="tiny muted">${esc(t3(ST.keys))}</p>
      </div></div>
      <div class="panel"><div class="panel-body stack" style="gap:12px">
        <h2 class="card-title">${esc(t3(ST.demo))}</h2>
        <div class="demo-links">${DEMO.map(([h, ic, n]) => `<a class="btn" href="${h}">${i(ic)}${esc(n)}</a>`).join('')}</div>
        <div class="row wrap" style="gap:10px;align-items:center"><button class="btn danger" id="setReset">${i('rotate-ccw')}${esc(t3(ST.reset))}</button><span class="small muted">${esc(t3(ST.resetHint))}</span></div>
      </div></div>`;
    $('#setDark').onchange = (e) => setTheme(e.target.checked ? 'dark' : 'light');
    $('#setHands').onchange = (e) => setHands(e.target.checked);
    $('#setDev').onchange = (e) => { body.classList.toggle('dev', e.target.checked); LS.setItem('voxa-dev', e.target.checked ? '1' : '0'); };
    $('#setReset').onclick = () => $('#sideReset').click();
    V.ready().then((c) => { const el = $('#devInfo'); if (el) el.textContent = `${$('#aiMode').textContent} · instance ${c.instance || ''}`; });
    icons();
  }
  function setTheme(t) { body.dataset.theme = t; LS.setItem('voxa-theme', t); document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0f1320' : '#ffffff'); }
  setTheme(LS.getItem('voxa-theme') || 'light');
  body.classList.toggle('dev', LS.getItem('voxa-dev') === '1');

  // ---------- language: labels follow the app language ----------
  function relabel() {
    $$('.side [data-section]').forEach((b) => { const s = b.querySelector('span'); if (s && NAMES[b.dataset.section]) s.textContent = t3(NAMES[b.dataset.section]); });
    renderTabs();
    const ai = $('#aiDot');
    V.ready().then((c) => { if (ai) { ai.classList.toggle('off', !c.ai); ai.title = c.ai ? 'AI on' : 'Offline mode: answers from the app data'; } });
  }

  // ---------- every state update ----------
  let lastLang = '';
  function onState() {
    if (!S) return;
    if (L() !== lastLang) { lastLang = L(); relabel(); if (current.screen === 'home') renderHome(true); $('#title').textContent = t3(current.screen === 'customers' ? NAMES.udhaar : NAMES[current.screen]); }
    if (current.screen === 'home') renderHome();
    // the money badge: stuck payments
    V.setCount('payments', S.txns.filter((t) => t.kind === 'payment' && t.status === 'pending').length);
  }

  // ---------- start ----------
  function start() {
    if (!$('.topbar .right')) { setTimeout(start, 30); return; }
    addTopButton();
    relabel();
    if (!isPhone() && LS.getItem('voxa-cp') !== 'closed' && window.innerWidth >= 1100) body.classList.add('cp-open');
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);
})();
