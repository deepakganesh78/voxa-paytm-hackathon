// Voxa answer cards: Sales, Profit, Customers, Loan offer, Payments, Insight and Confirm.
// Every card is drawn from the data the server sent with the answer (no extra AI call, works offline),
// in the app's language, and links to the screen it came from.
(function () {
  const { esc, inr, i } = V;
  const T = {
    open: { en: 'Open in', ta: 'திற:', hi: 'खोलें:' },
    screens: {
      sales: { en: 'Sales', ta: 'விற்பனை', hi: 'बिक्री' }, payments: { en: 'Payments', ta: 'பணம்', hi: 'पेमेंट' }, costs: { en: 'Costs & profit', ta: 'செலவு & லாபம்', hi: 'खर्च और मुनाफ़ा' },
      loan: { en: 'Loan', ta: 'கடன்', hi: 'लोन' }, insights: { en: 'Sales insights', ta: 'விற்பனை நுண்ணறிவு', hi: 'सेल्स इनसाइट्स' }, customers: { en: 'Customers & Udhaar', ta: 'வாடிக்கையாளர் & உதார்', hi: 'ग्राहक और उधार' },
      notes: { en: 'Voxa notes', ta: 'Voxa குறிப்புகள்', hi: 'Voxa नोट्स' }, home: { en: 'Home', ta: 'முகப்பு', hi: 'होम' }, whatsapp: { en: 'Messages', ta: 'செய்திகள்', hi: 'मैसेज' }, settings: { en: 'Settings', ta: 'அமைப்புகள்', hi: 'सेटिंग्स' },
    },
    sales: { en: 'Sales', ta: 'விற்பனை', hi: 'बिक्री' }, costs: { en: 'Costs', ta: 'செலவு', hi: 'खर्च' }, profit: { en: 'Profit', ta: 'லாபம்', hi: 'मुनाफ़ा' },
    loss: { en: 'Loss', ta: 'நஷ்டம்', hi: 'घाटा' }, bills: { en: 'bills', ta: 'பில்கள்', hi: 'बिल' }, perDay: { en: 'a day', ta: 'நாளொன்றுக்கு', hi: 'रोज़' },
    vsBefore: { en: 'vs the days before', ta: 'முந்தைய நாட்களை விட', hi: 'पहले के दिनों से' }, best: { en: 'Best', ta: 'அதிகம்', hi: 'सबसे अच्छा' }, weakest: { en: 'Weakest', ta: 'குறைவு', hi: 'सबसे कमज़ोर' },
    loanPaid: { en: 'Loan payments', ta: 'கடன் தவணை', hi: 'लोन किस्त' }, spread: { en: 'per day', ta: 'நாள் கணக்கில்', hi: 'प्रति दिन' },
    spreadNote: { en: 'Monthly bills (rent, electricity, salary, phone) are counted only for the days in this period.', ta: 'மாதாந்திர செலவுகள் (வாடகை, மின்சாரம், சம்பளம், போன்) இந்த நாட்களுக்கு மட்டும் கணக்கிடப்பட்டன.', hi: 'महीने के बिल (किराया, बिजली, वेतन, फ़ोन) सिर्फ़ इन दिनों के हिसाब से गिने गए।' },
    noCosts: { en: 'No costs added for this period yet, so this is not your real profit.', ta: 'இந்த காலத்துக்கு செலவுகள் சேர்க்கவில்லை, எனவே இது உண்மையான லாபம் அல்ல.', hi: 'इस समय के खर्च नहीं जोड़े, इसलिए यह असली मुनाफ़ा नहीं है।' },
    customers: { en: 'Customers', ta: 'வாடிக்கையாளர்கள்', hi: 'ग्राहक' }, owes: { en: 'Udhaar due', ta: 'உதார் பாக்கி', hi: 'उधार बाकी' }, regulars: { en: 'Regular customers', ta: 'வழக்கமான வாடிக்கையாளர்கள்', hi: 'रेगुलर ग्राहक' },
    stopped: { en: 'Stopped coming', ta: 'வருவதை நிறுத்தினர்', hi: 'आना बंद' }, loyalty: { en: 'Loyalty cards', ta: 'லாயல்டி கார்டு', hi: 'लॉयल्टी कार्ड' }, all: { en: 'Customers', ta: 'வாடிக்கையாளர்கள்', hi: 'ग्राहक' },
    every: { en: (n) => `every ${n} days`, ta: (n) => `${n} நாளுக்கு ஒருமுறை`, hi: (n) => `हर ${n} दिन` }, ago: { en: (n) => `last ${n} days ago`, ta: (n) => `${n} நாள் முன்`, hi: (n) => `${n} दिन पहले` },
    visits: { en: 'visits', ta: 'வருகை', hi: 'विज़िट' }, remindAll: { en: 'Remind them', ta: 'நினைவூட்டு', hi: 'याद दिलाएँ' }, none: { en: 'Nobody here yet.', ta: 'இங்கு யாரும் இல்லை.', hi: 'यहाँ अभी कोई नहीं।' },
    loanOffer: { en: 'Loan offer', ta: 'கடன் சலுகை', hi: 'लोन ऑफ़र' }, fits: { en: 'Fits your limit', ta: 'வரம்புக்குள்', hi: 'सीमा में' }, above: { en: 'Above your limit', ta: 'வரம்புக்கு மேல்', hi: 'सीमा से ज़्यादा' },
    monthly: { en: 'every month', ta: 'மாதம்', hi: 'हर महीने' }, amount: { en: 'Amount', ta: 'தொகை', hi: 'रकम' }, months: { en: 'Months', ta: 'மாதங்கள்', hi: 'महीने' },
    rate: { en: 'Rate a year', ta: 'ஆண்டு வட்டி', hi: 'सालाना ब्याज' }, interest: { en: 'Total interest', ta: 'மொத்த வட்டி', hi: 'कुल ब्याज' }, reaches: { en: 'Reaches your bank', ta: 'வங்கிக்கு வருவது', hi: 'बैंक में आएँगे' },
    ends: { en: 'Ends', ta: 'முடிவு', hi: 'ख़त्म' }, limit: { en: 'Your limit', ta: 'உங்கள் வரம்பு', hi: 'आपकी सीमा' }, apply: { en: 'Apply for this loan', ta: 'இந்தக் கடனுக்கு விண்ணப்பி', hi: 'इस लोन के लिए आवेदन' },
    lender: { en: 'Estimate. The lender sets the final rate after checking your credit score.', ta: 'மதிப்பீடு. இறுதி வட்டியை கடன் தருபவர் முடிவு செய்வார்.', hi: 'अनुमान। आख़िरी ब्याज लोन देने वाला तय करेगा।' },
    running: { en: 'Loan running', ta: 'கடன் நடப்பில்', hi: 'लोन चल रहा है' }, left: { en: 'left', ta: 'பாக்கி', hi: 'बाकी' },
    payments: { en: 'Payments', ta: 'பணம்', hi: 'पेमेंट' }, pending: { en: 'Stuck at the bank', ta: 'வங்கியில் சிக்கியது', hi: 'बैंक में अटके' }, nothing: { en: 'Nothing to show.', ta: 'காட்ட எதுவும் இல்லை.', hi: 'दिखाने को कुछ नहीं।' },
    status: { success: { en: 'Received', ta: 'வந்தது', hi: 'मिला' }, pending: { en: 'Stuck', ta: 'சிக்கியது', hi: 'अटका' }, failed: { en: 'Failed', ta: 'தோல்வி', hi: 'फ़ेल' }, refund: { en: 'Refund', ta: 'திருப்பம்', hi: 'रिफ़ंड' }, reversed: { en: 'Returned', ta: 'திரும்பியது', hi: 'लौटा' }, processing: { en: 'Processing', ta: 'நடக்கிறது', hi: 'चल रहा' }, awaiting_bank: { en: 'At bank', ta: 'வங்கியில்', hi: 'बैंक में' } },
    byStatus: { all: { en: 'Payments', ta: 'பணம்', hi: 'पेमेंट' }, pending: { en: 'Stuck payments', ta: 'சிக்கிய பணம்', hi: 'अटके पेमेंट' }, success: { en: 'Received payments', ta: 'வந்த பணம்', hi: 'मिले पेमेंट' }, failed: { en: 'Failed payments', ta: 'தோல்வி பணம்', hi: 'फ़ेल पेमेंट' }, refund: { en: 'Refunds', ta: 'திருப்பங்கள்', hi: 'रिफ़ंड' } },
    by: { en: 'by', ta: 'வரை', hi: 'तक' },
    confirm: { en: 'Confirm', ta: 'உறுதி செய்', hi: 'कन्फ़र्म' }, cancel: { en: 'Cancel', ta: 'ரத்து', hi: 'रद्द करें' }, needsOk: { en: 'Needs your OK', ta: 'உங்கள் ஒப்புதல் தேவை', hi: 'आपकी मंज़ूरी चाहिए' },
    cancelled: { en: 'Cancelled. Nothing was changed.', ta: 'ரத்து செய்யப்பட்டது. எதுவும் மாறவில்லை.', hi: 'रद्द किया। कुछ नहीं बदला।' }, failedTo: { en: 'Could not do it:', ta: 'செய்ய முடியவில்லை:', hi: 'नहीं हो सका:' },
    gone: { en: 'This request is no longer available.', ta: 'இந்தக் கோரிக்கை இப்போது இல்லை.', hi: 'यह अनुरोध अब नहीं है।' }, edit: { en: 'You can change the amounts before confirming.', ta: 'உறுதி செய்வதற்கு முன் தொகையை மாற்றலாம்.', hi: 'कन्फ़र्म करने से पहले रकम बदल सकते हैं।' },
    tip: { en: 'Tip', ta: 'குறிப்பு', hi: 'सुझाव' },
    cat: {
      stock: { en: 'Stock purchase', ta: 'சரக்கு வாங்கியது', hi: 'माल ख़रीद' }, rent: { en: 'Rent', ta: 'வாடகை', hi: 'किराया' }, electricity: { en: 'Electricity', ta: 'மின்சாரம்', hi: 'बिजली' },
      salary: { en: 'Staff salary', ta: 'சம்பளம்', hi: 'वेतन' }, transport: { en: 'Transport', ta: 'போக்குவரத்து', hi: 'ढुलाई' }, phone: { en: 'Phone & internet', ta: 'போன் & இணையம்', hi: 'फ़ोन और इंटरनेट' }, other: { en: 'Other costs', ta: 'மற்ற செலவுகள்', hi: 'बाकी खर्च' },
    },
  };
  const LOC = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };
  const t = (k, lang) => (k && (k[lang] || k.en)) || '';
  const short = (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1).replace(/\.0$/, '')}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : `₹${Math.round(v)}`);
  const day = (iso) => new Date(iso + 'T00:00:00');
  const openLink = (c, lang) => c.open && c.open.screen ? `<button class="vc-open" data-go="${esc(c.open.screen)}" data-goparams="${esc(JSON.stringify(c.open.params || {}))}">${t(T.open, lang)} ${t(T.screens[c.open.screen], lang)} ${i('arrow-up-right')}</button>` : '';
  const head = (icon, title, range, lang, extra = '') => `<div class="vc-head"><span class="vc-ico">${i(icon)}</span><div class="vc-title"><b>${esc(title)}</b>${range ? `<span>${esc(range.label ? range.label[lang] || range.label.en : '')}</span>` : ''}</div>${extra}</div>`;

  function groupLabel(g, by, lang) {
    const L = LOC[lang] || 'en-IN';
    if (by === 'weekday') return new Date(2024, 0, 1 + g.weekday).toLocaleDateString(L, { weekday: 'short' }); // 1 Jan 2024 was a Monday
    if (by === 'month') return new Date(g.key + '-01T00:00:00').toLocaleDateString(L, { month: 'short' });
    if (by === 'week') return day(g.key).toLocaleDateString(L, { day: 'numeric', month: 'short' });
    return `${day(g.key).toLocaleDateString(L, { weekday: 'short' })} ${day(g.key).getDate()}`;
  }
  function columns(groups, by, lang) {
    const real = groups.filter((g) => by !== 'weekday' || g.days);
    if (!real.length) return '';
    const max = Math.max(...real.map((g) => g.total), 1);
    const full = real.filter((g) => !g.today);
    const lo = full.length > 2 ? Math.min(...full.map((g) => g.total)) : null, hi = full.length > 2 ? Math.max(...full.map((g) => g.total)) : null;
    const n = real.length, W = Math.max(280, n * 34), H = 150, P = 18, bw = Math.min(26, (W - P) / n * 0.62);
    return `<div class="vc-chart"><svg viewBox="0 0 ${W} ${H + 24}" preserveAspectRatio="xMidYMid meet" role="img">${real.map((g, k) => {
      const x = P / 2 + (k + 0.5) * ((W - P) / n), h = Math.max(3, (g.total / max) * (H - 22)), y = H - h;
      const cls = g.total === lo ? 'lo' : g.total === hi ? 'hi' : g.today ? 'now' : '';
      return `<g class="${cls}"><rect x="${x - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="5"><title>${esc(groupLabel(g, by, lang))}: ${inr(g.total)}</title></rect>${n <= 14 ? `<text class="v" x="${x}" y="${y - 5}">${short(g.total)}</text>` : ''}<text class="l" x="${x}" y="${H + 16}">${esc(n > 16 && k % Math.ceil(n / 10) ? '' : groupLabel(g, by, lang))}</text></g>`;
    }).join('')}</svg></div>`;
  }

  const R = {};
  R.sales = (c, lang) => {
    const d = c.data;
    const ch = d.changeVsBefore;
    return `<div class="vc vc-sales">${head('chart-column', t(T.sales, lang), c.range, lang)}
      <div class="vc-big">${inr(d.total)}${ch !== null && ch !== undefined ? `<span class="vc-delta ${ch >= 0 ? 'up' : 'down'}">${i(ch >= 0 ? 'arrow-up-right' : 'arrow-down-right')}${Math.abs(ch)}% <small>${t(T.vsBefore, lang)}</small></span>` : ''}</div>
      <div class="vc-meta"><span>${d.bills} ${t(T.bills, lang)}</span><span>${inr(d.averagePerDay)} ${t(T.perDay, lang)}</span>${d.best && d.groupBy === 'day' ? `<span class="hi">${t(T.best, lang)}: ${esc(groupLabel({ key: d.best.date }, 'day', lang))}</span>` : ''}${d.worst && d.groupBy === 'day' ? `<span class="lo">${t(T.weakest, lang)}: ${esc(groupLabel({ key: d.worst.date }, 'day', lang))}</span>` : ''}</div>
      ${columns(d.groups, d.groupBy, lang)}${openLink(c, lang)}</div>`;
  };
  R.profit = (c, lang) => {
    const d = c.data;
    const spent = d.costs + d.loanPaid, base = Math.max(d.sales, spent, 1);
    const pw = Math.max(0, (d.profit / base) * 100), cw = (d.costs / base) * 100, lw = (d.loanPaid / base) * 100;
    return `<div class="vc vc-profit">${head('piggy-bank', t(T.profit, lang), c.range, lang)}
      <div class="vc-kpis"><div><span>${t(T.sales, lang)}</span><b>${inr(d.sales)}</b></div><div><span>${t(T.costs, lang)}</span><b class="cost">${inr(spent)}</b></div><div><span>${t(d.profit >= 0 ? T.profit : T.loss, lang)}</span><b class="${d.profit >= 0 ? 'up' : 'down'}">${inr(Math.abs(d.profit))}</b></div></div>
      <div class="vc-stack" aria-hidden="true"><i class="c" style="width:${cw}%"></i>${lw ? `<i class="l" style="width:${lw}%"></i>` : ''}<i class="p" style="width:${pw}%"></i></div>
      ${d.costItems && d.costItems.length ? `<ul class="vc-list">${d.costItems.map((x) => `<li><span>${esc(T.cat[x.category] ? t(T.cat[x.category], lang) : x.label)}${x.spread ? ` <em>${t(T.spread, lang)}</em>` : ''}</span><b>${inr(x.amount)}</b></li>`).join('')}${d.loanPaid ? `<li><span>${t(T.loanPaid, lang)}</span><b>${inr(d.loanPaid)}</b></li>` : ''}</ul>` : ''}
      ${!d.costsTold ? `<p class="vc-note warn">${i('info')}${t(T.noCosts, lang)}</p>` : d.costsSpread ? `<p class="vc-note">${i('info')}${t(T.spreadNote, lang)}</p>` : ''}
      ${openLink(c, lang)}</div>`;
  };
  R.customers = (c, lang) => {
    const d = c.data;
    const row = (x) => `<li class="vc-person"><span class="av">${esc(String(x.name || '?').trim()[0] || '?')}</span><span class="grow"><b>${esc(x.name)}</b><small>${
      x.kind === 'owes' ? t(T.owes, lang) : x.kind === 'loyalty' ? `${x.visits}/${x.of} ${t(T.visits, lang)}` : `${t(T.every, lang)(x.everyDays)} · ${t(T.ago, lang)(x.daysSince)}${x.stopped ? ` · <em class="lo">${t(T.stopped, lang)}</em>` : ''}`}</small></span>${x.amount ? `<b class="${x.kind === 'owes' ? 'owe' : ''}">${inr(x.amount)}</b>` : ''}</li>`;
    return `<div class="vc vc-customers">${head('users', t(T[d.filter] || T.customers, lang), null, lang, d.filter === 'owes' && d.totalDue ? `<span class="vc-pill warn">${inr(d.totalDue)}</span>` : '')}
      ${d.items.length ? `<ul class="vc-list people">${d.items.map(row).join('')}</ul>` : `<p class="vc-note">${t(T.none, lang)}</p>`}
      <div class="vc-actions">${d.canRemind ? `<button class="btn sm primary" data-propose="send_udhaar_reminders">${i('bell-ring')}${t(T.remindAll, lang)}</button>` : ''}${openLink(c, lang)}</div></div>`;
  };
  R.loan_offer = (c, lang) => {
    const d = c.data, p = d.plan;
    if (d.active) return `<div class="vc vc-loan">${head('hand-coins', t(T.running, lang), null, lang)}<div class="vc-big">${inr(d.active.outstanding)} <small>${t(T.left, lang)}</small></div><div class="vc-meta"><span>${inr(d.active.emi)} ${t(T.monthly, lang)}</span><span>${t(T.ends, lang)}: ${esc(d.active.finish)}</span></div>${openLink(c, lang)}</div>`;
    const id = 'L' + Math.random().toString(36).slice(2, 8);
    return `<div class="vc vc-loan" data-loancard="${id}" data-limit="${d.limit}">${head('hand-coins', t(T.loanOffer, lang), null, lang, d.asked ? `<span class="vc-pill ${d.fits ? 'ok' : 'warn'}">${t(d.fits ? T.fits : T.above, lang)}</span>` : '')}
      <div class="vc-big"><span data-lv="emi">${inr(p.emi)}</span> <small>${t(T.monthly, lang)}</small></div>
      <label class="vc-slider"><span>${t(T.amount, lang)} <b data-lv="amount">${inr(p.amount)}</b></span><input type="range" min="${d.min}" max="${Math.max(d.min, d.max)}" step="5000" value="${p.amount}" data-loanin="amount"></label>
      <label class="vc-slider"><span>${t(T.months, lang)} <b data-lv="months">${p.months}</b></span><input type="range" min="12" max="36" step="1" value="${p.months}" data-loanin="months"></label>
      <dl class="vc-grid"><div><dt>${t(T.rate, lang)}</dt><dd data-lv="rate">${p.rate}%</dd></div><div><dt>${t(T.interest, lang)}</dt><dd data-lv="totalInterest">${inr(p.totalInterest)}</dd></div><div><dt>${t(T.reaches, lang)}</dt><dd data-lv="received">${inr(p.received)}</dd></div><div><dt>${t(T.ends, lang)}</dt><dd data-lv="finish">${esc(p.finish)}</dd></div></dl>
      <p class="vc-note">${i('info')}${t(T.limit, lang)}: ${inr(d.limit)}. ${t(T.lender, lang)}</p>
      <div class="vc-actions"><button class="btn sm primary" data-loanapply>${i('check')}${t(T.apply, lang)}</button>${openLink(c, lang)}</div></div>`;
  };
  R.payments = (c, lang) => {
    const d = c.data;
    return `<div class="vc vc-payments">${head(d.status === 'pending' ? 'hourglass' : 'arrow-left-right', t(T.byStatus[d.status] || T.payments, lang), c.range, lang, d.count ? `<span class="vc-pill">${d.count} · ${inr(d.total)}</span>` : '')}
      ${d.items.length ? `<ul class="vc-list">${d.items.map((x) => `<li><span class="grow"><b>${esc(x.name)}</b><small>${esc(x.time)}${x.deadline ? ` · ${t(T.by, lang)} ${esc(x.deadline)}` : ''}</small></span><span class="vc-st ${esc(x.status)}">${t(T.status[x.status] || { en: x.status }, lang)}</span><b>${inr(x.amount)}</b></li>`).join('')}</ul>` : `<p class="vc-note">${t(T.nothing, lang)}</p>`}
      ${openLink(c, lang)}</div>`;
  };
  R.insight = (c, lang) => `<div class="vc vc-insight tone-${esc(c.data.tone || 'info')}">${head(c.data.icon || 'lightbulb', c.data.title || t(T.tip, lang), null, lang)}${c.data.text ? `<p>${esc(c.data.text)}</p>` : ''}${c.data.action ? `<div class="vc-actions">${actionBtn(c.data.action)}</div>` : ''}</div>`;
  R.confirm = (c, lang, S) => {
    const a = ((S && S.actions) || []).find((x) => x.id === c.actionId);
    if (!a) return `<div class="vc vc-confirm"><p class="vc-note">${t(T.gone, lang)}</p></div>`;
    const pending = a.status === 'pending';
    const items = (a.items || []).map((x) => `<li${x.selectable ? ' class="pick"' : ''}>${x.selectable ? `<input type="checkbox" data-actsel="${esc(x.key)}" ${x.selected !== false ? 'checked' : ''} ${pending ? '' : 'disabled'} aria-label="${esc(t(x.label, lang))}">` : ''}<span class="grow"><b>${esc(t(x.label, lang))}</b>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</span>${x.amount ? (x.editable && pending ? `<input class="vc-amt" type="number" min="1" inputmode="numeric" value="${x.amount}" data-actamt="${esc(x.key)}" aria-label="${esc(t(x.label, lang))}">` : `<b>${inr(x.amount)}</b>`) : ''}</li>`).join('');
    const foot = pending
      ? `<div class="vc-actions"><button class="btn sm primary" data-actok="${a.id}">${i('check')}${esc(t(a.confirm, lang) || t(T.confirm, lang))}</button><button class="btn sm" data-actno="${a.id}">${t(T.cancel, lang)}</button></div>`
      : `<p class="vc-done ${a.status}">${i(a.status === 'done' ? 'circle-check' : a.status === 'cancelled' ? 'circle-slash' : 'circle-alert')}${a.status === 'done' ? esc(t(a.done, lang)) : a.status === 'cancelled' ? t(T.cancelled, lang) : `${t(T.failedTo, lang)} ${esc(a.error || '')}`}</p>`;
    return `<div class="vc vc-confirm ${a.status}" data-action="${a.id}">${head('shield-check', t(a.title, lang), null, lang, pending ? `<span class="vc-pill warn">${t(T.needsOk, lang)}</span>` : '')}
      <ul class="vc-list">${items}</ul>${a.note ? `<p class="vc-note">${i('info')}${esc(t(a.note, lang))}</p>` : ''}${pending && (a.items || []).some((x) => x.editable) ? `<p class="vc-hint">${t(T.edit, lang)}</p>` : ''}${foot}</div>`;
  };

  function actionBtn(a) {
    if (!a) return '';
    if (a.nav) return `<button class="btn sm" data-go="${esc(a.nav.screen)}" data-goparams="${esc(JSON.stringify(a.nav.params || {}))}">${esc(a.label)}${i('arrow-right')}</button>`;
    if (a.propose) return `<button class="btn sm primary" data-propose="${esc(a.propose.type)}" data-proposeparams="${esc(JSON.stringify(a.propose.params || {}))}">${esc(a.label)}${i('arrow-right')}</button>`;
    if (a.ask) return `<button class="btn sm" data-ask="${esc(a.ask)}">${esc(a.label)}${i('arrow-right')}</button>`;
    return '';
  }

  // which cards this library draws (older dashboard cards are drawn by the page)
  function has(c) {
    if (!c || !R[c.type]) return false;
    if (c.type === 'sales' || c.type === 'payments') return !!c.data;
    return true;
  }
  function render(c, lang, S) { try { return R[c.type](c, lang, S); } catch (e) { console.error('card', c.type, e); return ''; } }

  // ---------- interactions ----------
  document.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { let p = {}; try { p = JSON.parse(go.dataset.goparams || '{}'); } catch {} if (V.go) V.go(go.dataset.go, p); return; }
    const ask = e.target.closest('[data-ask]');
    if (ask && !ask.closest('.chips-static')) { if (V.ask) V.ask(ask.dataset.ask); return; }
    const pr = e.target.closest('[data-propose]');
    if (pr) { let p = {}; try { p = JSON.parse(pr.dataset.proposeparams || '{}'); } catch {} pr.disabled = true; try { await V.api('/api/merchant/propose', { type: pr.dataset.propose, params: p }); if (V.openCopilot) V.openCopilot(); } finally { pr.disabled = false; } return; }
    const ok = e.target.closest('[data-actok]');
    if (ok) {
      const card = ok.closest('[data-action]');
      const amounts = {}; card.querySelectorAll('[data-actamt]').forEach((x) => { amounts[x.dataset.actamt] = Number(x.value); });
      const sel = card.querySelectorAll('[data-actsel]');
      const edits = { amounts, ...(sel.length ? { selected: [...sel].filter((x) => x.checked).map((x) => x.dataset.actsel) } : {}) };
      ok.disabled = true;
      try { await V.api('/api/merchant/action/confirm', { id: ok.dataset.actok, edits }); } catch { ok.disabled = false; }
      return;
    }
    const no = e.target.closest('[data-actno]');
    if (no) { no.disabled = true; try { await V.api('/api/merchant/action/cancel', { id: no.dataset.actno }); } catch { no.disabled = false; } return; }
    const ap = e.target.closest('[data-loanapply]');
    if (ap) {
      const card = ap.closest('[data-loancard]');
      const v = (k) => Number(card.querySelector(`[data-loanin="${k}"]`).value);
      ap.disabled = true;
      try { await V.api('/api/merchant/propose', { type: 'start_loan_application', params: { amount: v('amount'), months: v('months') } }); if (V.openCopilot) V.openCopilot(); } finally { ap.disabled = false; }
    }
  });
  const timers = {};
  document.addEventListener('input', (e) => {
    const s = e.target.closest('[data-loanin]');
    if (!s) return;
    const card = s.closest('[data-loancard]');
    const v = (k) => card.querySelector(`[data-loanin="${k}"]`).value;
    card.querySelector('[data-lv="amount"]').textContent = inr(Number(v('amount')));
    card.querySelector('[data-lv="months"]').textContent = v('months');
    clearTimeout(timers[card.dataset.loancard]);
    timers[card.dataset.loancard] = setTimeout(async () => {
      try {
        const p = await (await fetch(`/api/loanplan?amount=${v('amount')}&months=${v('months')}`)).json();
        const set = (k, txt) => { const el = card.querySelector(`[data-lv="${k}"]`); if (el) el.textContent = txt; };
        set('emi', inr(p.emi)); set('rate', p.rate + '%'); set('totalInterest', inr(p.totalInterest)); set('received', inr(p.received)); set('finish', p.finish);
      } catch { /* keep the last numbers */ }
    }, 180);
  });

  window.VC = { has, render, actionBtn, T, t };
})();
