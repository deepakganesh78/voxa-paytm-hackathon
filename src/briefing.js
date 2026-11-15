// Home: today's briefing, built from the app data (no AI call, works offline).
// Each item says what matters, why, and gives one tap that does something about it.
import * as E from './engine.js';
import * as RG from './ranges.js';
import * as ACT from './actions.js';
import { rupee } from './i18n.js';

export function briefing(lang) {
  const S = E.getState();
  const L = ['en', 'ta', 'hi'].includes(lang) ? lang : S.merchant.lang;
  const t3 = (en, ta, hi) => ({ en, ta, hi }[L] || en);
  const out = [];
  const today = E.salesToday();
  const days = S.history.days, yest = days[days.length - 1];
  const h = new Date().getHours();
  const shape = S.history.hourly;
  const share = Math.max(0.05, shape.filter((x) => x.hour < h).reduce((s, x) => s + x.avg, 0) / shape.reduce((s, x) => s + x.avg, 0));
  const expected = Math.round(yest.total * Math.min(1, share));
  const diff = expected ? Math.round(((today.total - expected) / expected) * 100) : 0;
  out.push({ id: 'sales', priority: Math.abs(diff) >= 15 ? 70 : 40, tone: diff >= 0 ? 'good' : 'warn', icon: diff >= 0 ? 'trending-up' : 'trending-down',
    title: t3(`Today ${rupee(today.total)} from ${today.bills} bills`, `இன்று ${today.bills} பில்களில் ${rupee(today.total)}`, `आज ${today.bills} बिलों से ${rupee(today.total)}`),
    text: t3(`${Math.abs(diff)}% ${diff >= 0 ? 'ahead of' : 'behind'} yesterday at this time.`, `நேற்று இதே நேரத்தை விட ${Math.abs(diff)}% ${diff >= 0 ? 'அதிகம்' : 'குறைவு'}.`, `कल इसी समय से ${Math.abs(diff)}% ${diff >= 0 ? 'ज़्यादा' : 'कम'}।`),
    action: { label: t3('See sales', 'விற்பனை பார்', 'बिक्री देखें'), nav: { screen: 'sales', params: { range: 'last_7_days' } } } });

  const stuck = S.txns.filter((t) => t.kind === 'payment' && t.status === 'pending');
  if (stuck.length) {
    const who = stuck.map((t) => `${t.fromName} ${rupee(t.amount)}`).join(', ');
    out.push({ id: 'stuck', priority: 95, tone: 'bad', icon: 'hourglass',
      title: t3(`${stuck.length} payment${stuck.length > 1 ? 's' : ''} stuck at the bank`, `${stuck.length} பணம் வங்கியில் சிக்கியுள்ளது`, `${stuck.length} पेमेंट बैंक में अटके`),
      text: t3(`${who}. Voxa is following up.`, `${who}. Voxa கவனிக்கிறது.`, `${who}। Voxa देख रहा है।`),
      action: { label: t3('Check payments', 'பணத்தைப் பார்', 'पेमेंट देखें'), nav: { screen: 'payments', params: { view: 'pending' } } } });
  }

  const due = ACT.owingCustomers();
  if (due.length) {
    const tot = due.reduce((s, x) => s + x.owed, 0);
    out.push({ id: 'udhaar', priority: 80, tone: 'warn', icon: 'notebook-tabs',
      title: t3(`${rupee(tot)} Udhaar due from ${due.length} customer${due.length > 1 ? 's' : ''}`, `${due.length} வாடிக்கையாளர்களிடம் ${rupee(tot)} உதார் பாக்கி`, `${due.length} ग्राहकों पर ${rupee(tot)} उधार बाकी`),
      text: t3(`${due[0].cu.name} owes the most, ${rupee(due[0].owed)}.`, `அதிகம் ${due[0].cu.name}, ${rupee(due[0].owed)}.`, `सबसे ज़्यादा ${due[0].cu.name} पर, ${rupee(due[0].owed)}।`),
      action: { label: t3('Remind customers', 'நினைவூட்டு', 'याद दिलाएँ'), propose: { type: 'send_udhaar_reminders', params: {} } } });
  }

  const ps = E.profitSummary();
  const now = new Date();
  const prev = E.profitSummary(E.monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  const jump = ps.costs.map((c) => ({ c, before: (prev.costs.find((x) => x.category === c.category) || {}).amount || 0 })).find((x) => x.before && x.c.amount > x.before * 1.3);
  if (!ps.entries) {
    out.push({ id: 'costs', priority: 60, tone: 'info', icon: 'piggy-bank',
      title: t3('Add this month’s costs to see your real profit', 'உண்மையான லாபம் பார்க்க இந்த மாத செலவுகளைச் சேர்க்கவும்', 'असली मुनाफ़ा देखने के लिए इस महीने के खर्च जोड़ें'),
      text: t3('Just say it: “rent 6k, electricity 4k, stock 40k”.', 'சொல்லுங்கள்: “வாடகை 6 ஆயிரம், கரண்ட் 4 ஆயிரம்”.', 'बस बोलिए: “किराया 6 हज़ार, बिजली 4 हज़ार”।'),
      action: { label: t3('Add costs', 'செலவு சேர்', 'खर्च जोड़ें'), ask: t3('This month rent 6k, electricity 4k', 'இந்த மாதம் வாடகை 6 ஆயிரம், கரண்ட் 4 ஆயிரம்', 'इस महीने किराया 6 हज़ार, बिजली 4 हज़ार') } });
  } else if (jump) {
    out.push({ id: 'cost-jump', priority: 65, tone: 'warn', icon: 'alert-triangle',
      title: t3(`${jump.c.label} is up to ${rupee(jump.c.amount)}`, `${jump.c.label} ${rupee(jump.c.amount)} ஆக உயர்ந்தது`, `${jump.c.label} बढ़कर ${rupee(jump.c.amount)}`),
      text: t3(`It was ${rupee(jump.before)} last month.`, `கடந்த மாதம் ${rupee(jump.before)}.`, `पिछले महीने ${rupee(jump.before)} था।`),
      action: { label: t3('See costs', 'செலவு பார்', 'खर्च देखें'), nav: { screen: 'costs', params: { range: 'this_month' } } } });
  } else {
    out.push({ id: 'profit', priority: 50, tone: 'good', icon: 'wallet',
      title: t3(`${rupee(ps.left)} left this month after costs`, `இந்த மாதம் செலவு போக ${rupee(ps.left)} மிச்சம்`, `इस महीने खर्च के बाद ${rupee(ps.left)} बचे`),
      text: t3(`Sales ${rupee(ps.revenue)}, costs ${rupee(ps.costTotal)}.`, `விற்பனை ${rupee(ps.revenue)}, செலவு ${rupee(ps.costTotal)}.`, `बिक्री ${rupee(ps.revenue)}, खर्च ${rupee(ps.costTotal)}।`),
      action: { label: t3('Profit this week', 'இந்த வார லாபம்', 'इस हफ़्ते का मुनाफ़ा'), ask: t3('How much profit did I make this week?', 'இந்த வாரம் லாபம் எவ்வளவு?', 'इस हफ़्ते कितना मुनाफ़ा हुआ?') } });
  }

  const stopped = E.regularsStatus().filter((r) => r.stopped);
  if (stopped.length) {
    out.push({ id: 'regulars', priority: 55, tone: 'info', icon: 'user-x',
      title: t3(`${stopped.length} regular customer${stopped.length > 1 ? 's' : ''} stopped coming`, `${stopped.length} வழக்கமான வாடிக்கையாளர்கள் வரவில்லை`, `${stopped.length} रेगुलर ग्राहक आना बंद`),
      text: t3(`${stopped[0].name}: last paid ${stopped[0].daysSince} days ago, usually every ${stopped[0].usualGap} days.`, `${stopped[0].name}: ${stopped[0].daysSince} நாட்களுக்கு முன் கடைசியாக வந்தார்.`, `${stopped[0].name}: आख़िरी बार ${stopped[0].daysSince} दिन पहले आए।`),
      action: { label: t3('See who', 'யார் என்று பார்', 'देखें कौन'), nav: { screen: 'insights', params: { view: 'regulars' } } } });
  }

  if (S.loan.status !== 'active') {
    const pr = E.loanProfile();
    if (pr.eligible) out.push({ id: 'loan', priority: 35, tone: 'info', icon: 'hand-coins',
      title: t3(`You look eligible for a loan up to ${rupee(pr.limit)}`, `${rupee(pr.limit)} வரை கடன் பெறத் தகுதி தெரிகிறது`, `${rupee(pr.limit)} तक लोन के योग्य लगते हैं`),
      text: t3(`Based on about ${rupee(pr.avgMonth)} a month in sales. The lender decides.`, `மாதம் சுமார் ${rupee(pr.avgMonth)} விற்பனை அடிப்படையில். இறுதி முடிவு கடன் தருபவருடையது.`, `हर महीने करीब ${rupee(pr.avgMonth)} की बिक्री के आधार पर। आख़िरी फ़ैसला लोन देने वाले का।`),
      action: { label: t3('See loan offer', 'கடன் சலுகை பார்', 'लोन ऑफ़र देखें'), ask: t3('Can I get a loan of 1 lakh?', 'எனக்கு 1 லட்சம் கடன் கிடைக்குமா?', 'क्या मुझे 1 लाख का लोन मिल सकता है?') } });
  }

  out.sort((a, b) => b.priority - a.priority);
  const week = E.salesInRange(RG.rangeFromKey('this_week'));
  return {
    greeting: t3(`${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${S.merchant.owner}`, `வணக்கம், ${S.merchant.owner}`, `नमस्ते, ${S.merchant.owner}`),
    items: out.slice(0, 5),
    kpis: { today: today.total, bills: today.bills, week: week.total, left: ps.left, bank: S.merchant.bankBalance },
  };
}
