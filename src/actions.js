// Changes Voxa proposes from the chat. Nothing changes and no money or message moves until the merchant
// taps Confirm (in the app, or the button under Voxa's Telegram message). The chat card shows the live status.
import * as E from './engine.js';
import * as CRM from './crm.js';
import { rupee } from './i18n.js';

const T3 = (en, ta, hi) => ({ en, ta, hi });
const COST_TA = { stock: 'சரக்கு', rent: 'வாடகை', electricity: 'மின்சாரம்', salary: 'சம்பளம்', transport: 'போக்குவரத்து', phone: 'போன், இணையம்', other: 'மற்ற செலவு' };
const COST_HI = { stock: 'माल', rent: 'किराया', electricity: 'बिजली', salary: 'वेतन', transport: 'ढुलाई', phone: 'फ़ोन, इंटरनेट', other: 'बाकी खर्च' };
const costLabel = (c) => T3(E.COST_CATEGORIES[c] || 'Other costs', COST_TA[c] || COST_TA.other, COST_HI[c] || COST_HI.other);
const CATS = Object.keys(E.COST_CATEGORIES);

export const ACTION_TYPES = ['record_expenses', 'record_cash_sales', 'udhaar_add', 'udhaar_paid', 'send_udhaar_reminders', 'report_issue', 'create_offer', 'start_loan_application'];

const list = () => { const S = E.getState(); S.actions = S.actions || []; return S.actions; };
export const findAction = (id) => list().find((a) => a.id === id) || null;

export function reminderText(cu, owed) {
  return `Murugan and Co: a gentle reminder, ${rupee(owed)} is due on your Udhaar. You can pay at the shop or by UPI. Thank you!`;
}
export function owingCustomers(names) {
  const c = E.getState().crm;
  const want = (names || []).map((n) => String(n).toLowerCase()).filter(Boolean);
  return (c ? c.customers : []).map((cu) => ({ cu, owed: CRM.balanceOf(cu) }))
    .filter((x) => x.owed > 0 && (!want.length || want.some((w) => x.cu.name.toLowerCase().includes(w))))
    .sort((a, b) => b.owed - a.owed);
}

// Build the preview the merchant checks. Throws (with a plain reason) if it cannot be done at all.
function preview(type, p) {
  switch (type) {
    case 'record_expenses': {
      const items = (p.items || []).map((x) => ({ category: CATS.includes(x.category) ? x.category : 'other', amount: Math.round(Number(x.amount)) || 0, note: x.note || '' })).filter((x) => x.amount > 0);
      if (!items.length) throw new Error('No cost amounts to save.');
      const total = items.reduce((s, x) => s + x.amount, 0);
      return {
        params: { items, replace: p.replace !== false },
        title: T3(`Save ${rupee(total)} in costs for this month`, `இந்த மாத செலவாக ${rupee(total)} சேமிக்கவா?`, `इस महीने के खर्च में ${rupee(total)} जोड़ें?`),
        items: items.map((x, k) => ({ key: String(k), label: costLabel(x.category), amount: x.amount, editable: true, detail: x.note || '' })),
        confirm: T3('Save costs', 'செலவு சேமி', 'खर्च सेव करें'),
      };
    }
    case 'record_cash_sales': {
      const amount = Math.round(Number(p.amount));
      if (!(amount > 0)) throw new Error('No cash amount.');
      return {
        params: { amount },
        title: T3(`Save cash sales of ${rupee(amount)} for this month`, `இந்த மாத ரொக்க விற்பனை ${rupee(amount)} சேமிக்கவா?`, `इस महीने की नकद बिक्री ${rupee(amount)} सेव करें?`),
        items: [{ key: '0', label: T3('Cash sales', 'ரொக்க விற்பனை', 'नकद बिक्री'), amount, editable: true }],
        confirm: T3('Save', 'சேமி', 'सेव करें'),
      };
    }
    case 'udhaar_add': {
      const cu = CRM.findCustomer(p.customer);
      if (!cu) throw new Error(`${p.customer || 'That customer'} is not on your customer list yet. Ask them to scan the shop QR first.`);
      const amount = Math.round(Number(p.amount));
      if (!(amount > 0)) throw new Error('No Udhaar amount.');
      return {
        params: { customer: cu.phone, name: cu.name, amount, note: String(p.note || '').slice(0, 120) },
        title: T3(`Add ${rupee(amount)} Udhaar for ${cu.name}`, `${cu.name}க்கு ${rupee(amount)} உதார் சேர்க்கவா?`, `${cu.name} के उधार में ${rupee(amount)} जोड़ें?`),
        items: [{ key: '0', label: T3(cu.name, cu.name, cu.name), amount, editable: true, detail: `Owes now ${rupee(CRM.balanceOf(cu))}. They get a message.` }],
        confirm: T3('Add and message', 'சேர்த்து செய்தி அனுப்பு', 'जोड़ें और मैसेज भेजें'),
      };
    }
    case 'udhaar_paid': {
      const cu = CRM.findCustomer(p.customer);
      if (!cu) throw new Error(`${p.customer || 'That customer'} is not on your customer list.`);
      const owed = CRM.balanceOf(cu);
      if (owed <= 0) throw new Error(`${cu.name} owes nothing.`);
      const amount = Math.min(owed, Math.round(Number(p.amount)) || owed);
      return {
        params: { customer: cu.phone, name: cu.name, amount },
        title: T3(`${cu.name} paid back ${rupee(amount)}`, `${cu.name} ${rupee(amount)} திருப்பிச் செலுத்தினார்`, `${cu.name} ने ${rupee(amount)} लौटाए`),
        items: [{ key: '0', label: T3(cu.name, cu.name, cu.name), amount, editable: true, detail: `Owes ${rupee(owed)} now.` }],
        confirm: T3('Mark as paid', 'செலுத்தியதாகக் குறி', 'चुकाया मार्क करें'),
      };
    }
    case 'send_udhaar_reminders': {
      const due = owingCustomers(p.customers);
      if (!due.length) throw new Error('Nobody owes you any Udhaar right now.');
      const total = due.reduce((s, x) => s + x.owed, 0);
      return {
        params: { customers: due.map((x) => x.cu.phone) },
        title: T3(`Send a reminder to ${due.length} customer${due.length > 1 ? 's' : ''} (${rupee(total)} due)`, `${due.length} வாடிக்கையாளர்களுக்கு நினைவூட்டல் அனுப்பவா? (${rupee(total)} பாக்கி)`, `${due.length} ग्राहकों को याद दिलाएँ? (${rupee(total)} बाकी)`),
        items: due.map((x) => ({ key: x.cu.phone, label: T3(x.cu.name, x.cu.name, x.cu.name), amount: x.owed, selectable: true, selected: true, detail: reminderText(x.cu, x.owed) })),
        confirm: T3('Send reminders', 'நினைவூட்டல் அனுப்பு', 'रिमाइंडर भेजें'),
        note: CRM.WA_LIVE ? null : T3('Messaging is not connected, so nothing can be sent yet.', 'செய்தி சேவை இணைக்கப்படவில்லை.', 'मैसेजिंग जुड़ा नहीं है।'),
      };
    }
    case 'report_issue': {
      const title = String(p.title || 'Problem reported by Murugan').slice(0, 60);
      return {
        params: { title, summary_for_support: String(p.summary_for_support || title).slice(0, 900), customer: p.customer || '', amount: Number(p.amount) || 0, txn_id: p.txn_id || '' },
        title: T3(`Raise a support ticket: ${title}`, `புகார் பதிவு செய்யவா: ${title}`, `सपोर्ट टिकट बनाएँ: ${title}`),
        items: [{ key: '0', label: T3(title, title, title), detail: String(p.summary_for_support || '').slice(0, 300) }],
        confirm: T3('Raise ticket', 'புகார் பதிவு', 'टिकट बनाएँ'),
      };
    }
    case 'create_offer': {
      const percent = Math.max(1, Math.min(50, Math.round(Number(p.percent) || 10)));
      const start = Math.round(Number(p.start_hour ?? 14)), end = Math.round(Number(p.end_hour ?? 17));
      return {
        params: { percent, start, end },
        title: T3(`Start ${percent}% off from ${start}:00 to ${end}:00`, `${start}:00 முதல் ${end}:00 வரை ${percent}% தள்ளுபடி தொடங்கவா?`, `${start}:00 से ${end}:00 तक ${percent}% छूट शुरू करें?`),
        items: [{ key: '0', label: T3('Discount', 'தள்ளுபடி', 'छूट'), detail: `${percent}%, ${start}:00–${end}:00` }],
        confirm: T3('Start offer', 'தொடங்கு', 'शुरू करें'),
      };
    }
    case 'start_loan_application': {
      if (E.getState().loan.status === 'active') throw new Error('A loan is already running.');
      const plan = E.loanPlan({ amount: p.amount, months: p.months });
      return {
        params: { amount: plan.amount, months: plan.months },
        title: T3(`Take a loan of ${rupee(plan.amount)} for ${plan.months} months`, `${plan.months} மாதங்களுக்கு ${rupee(plan.amount)} கடன் எடுக்கவா?`, `${plan.months} महीने के लिए ${rupee(plan.amount)} का लोन लें?`),
        items: [
          { key: 'emi', label: T3('Every month', 'மாதம்', 'हर महीने'), amount: plan.emi },
          { key: 'interest', label: T3('Total interest', 'மொத்த வட்டி', 'कुल ब्याज'), amount: plan.totalInterest },
          { key: 'received', label: T3('Reaches your bank', 'வங்கிக்கு வருவது', 'बैंक में आएँगे'), amount: plan.received },
        ],
        confirm: T3('Apply', 'விண்ணப்பி', 'आवेदन करें'),
        note: T3(`Rate ${plan.rate}% a year (lender decides). Ends ${plan.finish}.`, `வட்டி ஆண்டுக்கு ${plan.rate}% (கடன் தருபவர் முடிவு). ${plan.finish}ல் முடியும்.`, `ब्याज ${plan.rate}% सालाना (लोन देने वाला तय करेगा)। ${plan.finish} में ख़त्म।`),
      };
    }
    default:
      throw new Error('Unknown action ' + type);
  }
}

export function propose(type, params = {}, { source = 'voxa', said = '' } = {}) {
  const p = preview(type, params);
  const a = { id: 'AC' + Math.random().toString(36).slice(2, 8).toUpperCase(), type, status: 'pending', at: Date.now(), source, said: String(said).slice(0, 200), ...p };
  const L = list();
  L.unshift(a);
  if (L.length > 40) L.length = 40;
  E.log({ agent: 'chat', source, type: 'tool', name: 'propose_action', input: type, output: a.title.en, ms: 0 });
  E.touch();
  return a;
}

// The merchant's answer. edits: { amounts: { key: number }, selected: [keys] } from the card.
export async function decide(id, ok, edits = {}) {
  const a = findAction(id);
  if (!a) throw new Error('That request is gone.');
  if (a.status !== 'pending') return a;
  if (!ok) { a.status = 'cancelled'; a.doneAt = Date.now(); E.touch(); return a; }
  const amt = (key, fallback) => { const v = edits.amounts && Number(edits.amounts[key]); return v > 0 ? Math.round(v) : fallback; };
  try {
    const p = a.params;
    let done;
    switch (a.type) {
      case 'record_expenses': {
        const items = p.items.map((x, k) => ({ ...x, amount: amt(String(k), x.amount) }));
        E.addExpenses(items, { source: a.source, said: a.said, replace: p.replace });
        const ps = E.profitSummary();
        done = T3(`Saved. This month's costs: ${rupee(ps.costTotal)}.`, `சேமித்தேன். இந்த மாத செலவு: ${rupee(ps.costTotal)}.`, `सेव किया। इस महीने का खर्च: ${rupee(ps.costTotal)}।`);
        break;
      }
      case 'record_cash_sales': {
        const v = E.setCashSales(amt('0', p.amount), { source: a.source, said: a.said });
        done = T3(`Saved cash sales of ${rupee(v)}.`, `ரொக்க விற்பனை ${rupee(v)} சேமித்தேன்.`, `नकद बिक्री ${rupee(v)} सेव की।`);
        break;
      }
      case 'udhaar_add': {
        const cu = CRM.findCustomer(p.customer);
        if (!cu) throw new Error('Customer not found.');
        const r = CRM.addCredit(cu, amt('0', p.amount), p.note);
        done = T3(`Added. ${cu.name} now owes ${rupee(r.balance)}.`, `சேர்த்தேன். ${cu.name} இப்போது ${rupee(r.balance)} தர வேண்டும்.`, `जोड़ दिया। ${cu.name} पर अब ${rupee(r.balance)} बाकी।`);
        break;
      }
      case 'udhaar_paid': {
        const cu = CRM.findCustomer(p.customer);
        if (!cu) throw new Error('Customer not found.');
        const e = CRM.repayClaim(cu, Math.min(CRM.balanceOf(cu), amt('0', p.amount)), 'Murugan confirmed it in Ask Voxa');
        const r = CRM.confirmRepay(e.id);
        done = T3(`Done. ${cu.name} still owes ${rupee(r.balance)}.`, `முடிந்தது. ${cu.name} இன்னும் ${rupee(r.balance)} தர வேண்டும்.`, `हो गया। ${cu.name} पर अभी ${rupee(r.balance)} बाकी।`);
        break;
      }
      case 'send_udhaar_reminders': {
        const pick = Array.isArray(edits.selected) ? edits.selected : p.customers;
        let sent = 0, failed = 0;
        for (const phone of pick) {
          const cu = E.getState().crm.customers.find((x) => x.phone === phone);
          if (!cu) continue;
          const owed = CRM.balanceOf(cu);
          if (owed <= 0) continue;
          const r = await CRM.waSend(cu.phone, reminderText(cu, owed));
          if (r && r.status === 'sent') sent++; else failed++;
        }
        a.result = { sent, failed };
        done = T3(`Sent ${sent} reminder${sent === 1 ? '' : 's'}${failed ? `, ${failed} could not be sent` : ''}.`, `${sent} நினைவூட்டல் அனுப்பினேன்${failed ? `, ${failed} அனுப்ப முடியவில்லை` : ''}.`, `${sent} रिमाइंडर भेजे${failed ? `, ${failed} नहीं भेजे जा सके` : ''}।`);
        break;
      }
      case 'report_issue': {
        const t = reportIssue(p, a.source);
        done = T3(`Ticket ${t.ticket_id} raised. Support will look at it.`, `புகார் ${t.ticket_id} பதிவானது.`, `टिकट ${t.ticket_id} बन गया।`);
        break;
      }
      case 'create_offer': {
        const o = E.createOffer({ percent: p.percent, start: p.start, end: p.end });
        done = T3(`Offer started: ${o.label}.`, `தள்ளுபடி தொடங்கியது: ${o.label}.`, `ऑफ़र शुरू: ${o.label}।`);
        break;
      }
      case 'start_loan_application': {
        E.acceptLoan({ amount: p.amount, months: p.months });
        done = T3(`Loan of ${rupee(p.amount)} started. The money is in your bank.`, `${rupee(p.amount)} கடன் தொடங்கியது. பணம் உங்கள் வங்கியில்.`, `${rupee(p.amount)} का लोन शुरू। पैसे आपके बैंक में।`);
        break;
      }
      default: throw new Error('Unknown action');
    }
    a.status = 'done'; a.doneAt = Date.now(); a.done = done;
  } catch (e) {
    a.status = 'failed'; a.doneAt = Date.now(); a.error = e.message;
  }
  E.log({ agent: 'chat', source: 'you', type: 'tool', name: 'confirm_action', input: a.type, output: a.status + (a.error ? ': ' + a.error : ''), ms: 0 });
  E.touch();
  return a;
}

// A support ticket for something Murugan reported (one open ticket per payment).
export function reportIssue(input, source = 'voxa') {
  const S = E.getState();
  const t = input.txn_id ? E.findTxn(String(input.txn_id).toUpperCase()) : (input.amount ? S.txns.find((x) => x.kind === 'payment' && x.amount === Number(input.amount) && (!input.customer || x.fromName.toLowerCase().includes(String(input.customer).toLowerCase()))) : null);
  const open = t && S.tickets.find((k) => k.refId === t.id && k.status !== 'resolved');
  if (open) {
    E.addTimeline(open.id, 'Murugan', 'Reported again through Voxa: ' + String(input.summary_for_support).slice(0, 300));
    if (open.status !== 'needs_human') E.escalateTicket(open.id, 'Murugan reported a problem with this payment');
    return { ticket_id: open.id, status: 'already open, added his report and sent to a person' };
  }
  const k = E.createTicket({ type: 'merchant_report', refId: t ? t.id : 'MR-' + Date.now(), title: String(input.title).slice(0, 60), summary: String(input.summary_for_support).slice(0, 900), needsHuman: true, source });
  E.addTimeline(k.id, 'Murugan', 'Reported through Ask Voxa.');
  E.addBoardNote({ key: 'report-' + k.id, tag: 'payment', title: `Reported: ${k.title}`.slice(0, 80), text: `Ticket ${k.id} is with the support team. Voxa will tell you when there is an update.` });
  return { ticket_id: k.id, status: 'sent to the support team', linked_payment: t ? t.id : null };
}
