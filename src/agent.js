// Voxa, the AI accountant agent.
// The brain is Claude (ANTHROPIC_API_KEY) or Sarvam sarvam-105b (SARVAM_API_KEY), both with tool calling.
// With no key, or if a call fails, the same tools are driven by simple rules, so the demo never breaks on stage.
import Anthropic from '@anthropic-ai/sdk';
import * as SV from './sarvam.js';
import * as CRM from './crm.js';
import * as E from './engine.js';
import { msg, rupee, LANG_NAMES } from './i18n.js';

const MODEL = process.env.VOXA_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.VOXA_EFFORT || 'low';
const CLAUDE_KEY = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
// VOXA_BRAIN=claude|sarvam|rules picks one; otherwise Claude if its key is set, then Sarvam, then rules.
const BRAIN = process.env.VOXA_AI === 'off' ? 'rules'
  : process.env.VOXA_BRAIN === 'sarvam' && SV.SARVAM_ON ? 'sarvam'
  : process.env.VOXA_BRAIN === 'claude' && CLAUDE_KEY ? 'claude'
  : process.env.VOXA_BRAIN === 'rules' ? 'rules'
  : CLAUDE_KEY ? 'claude' : SV.SARVAM_ON ? 'sarvam' : 'rules';
const AI_ON = BRAIN !== 'rules';
// Automated events (stuck payments, settlements) can stay on rules to save credits: VOXA_EVENTS_AI=off
const EVENTS_AI = AI_ON && process.env.VOXA_EVENTS_AI !== 'off';
const client = BRAIN === 'claude' ? new Anthropic() : null;
let fallbacksSupported = true;

export const aiStatus = () => ({
  ai: AI_ON, brain: BRAIN, claude: BRAIN === 'claude',
  brainName: BRAIN === 'claude' ? 'Claude' : BRAIN === 'sarvam' ? 'Sarvam AI' : 'offline rules',
  model: BRAIN === 'claude' ? MODEL : BRAIN === 'sarvam' ? SV.CHAT_MODEL : null,
  vision: BRAIN === 'claude' ? MODEL : SV.SARVAM_ON ? SV.VISION_MODEL : null,
  aiUsage: SV.chatUsage,
});

// Voxa writes each message to Murugan itself, from the facts, in his language. One short call, no tools.
E.setPhraser(async (situation, facts, m) => {
  if (!EVENTS_AI) return null;
  const lang = E.getState().merchant.lang;
  const system = `You are Voxa, the AI accountant inside the shop app of Murugan, who owns a small shop in Chennai. Write ONE short message to Murugan in ${LANG_NAMES[lang]}. It is read aloud, so: one short sentence if possible, never more than two, under 25 words, plain spoken words, no markdown, no greeting. Use only the facts given; never invent numbers, dates or names. Money in Indian format with ₹. Do not take sides between Murugan and a customer. You work only for Murugan.`;
  const user = `Situation: ${situation}\nFacts: ${JSON.stringify(facts)}\nThe message must get this across (English reference): ${m.english}`;
  const text = await runBrain({ system, messages: [{ role: 'user', content: user }], tools: undefined, ctx: { agent: 'event', source: BRAIN } });
  if (!text || text.length > 600) return null;
  return { text, english: lang === 'en' ? text : m.english };
});

// one entry point for whichever brain is on
function runBrain({ system, messages, tools, ctx }) {
  if (BRAIN === 'sarvam') return SV.runSarvam({ system, messages, tools, ctx, callTool, log: E.log });
  return runClaude({ system, messages, tools, ctx });
}

// ---------------------------------------------------------------- tools
const TOOL_DEFS = {
  check_payment_status: {
    description: 'Look up a payment by txn_id, or the most recent payment of a given amount. Returns bank-level facts: whether the customer was debited, whether the merchant was credited, UTR, RBI deadline.',
    input_schema: { type: 'object', properties: { txn_id: { type: 'string' }, amount: { type: 'number', description: 'Amount in rupees, if txn_id is unknown' } } },
  },
  list_pending_payments: {
    description: 'List payments that are stuck (customer debited, merchant not yet credited).',
    input_schema: { type: 'object', properties: {} },
  },
  create_ticket: {
    description: 'Create a support ticket. For stuck payments it records the bank deadline (T+5); Voxa waits one day for the bank before a person takes over. Set needs_human=true for amounts of ₹10,000 or more, settlement holds and wrong loan deductions.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['stuck_payment', 'settlement_hold', 'wrong_deduction', 'other'] },
        ref_id: { type: 'string', description: 'txn_id or settlement id' },
        title: { type: 'string', description: 'Short title, under 60 characters' },
        summary_for_support: { type: 'string', description: 'A ready-to-act summary for the support agent: what happened, facts checked, what you already did, and the one decision needed.' },
        needs_human: { type: 'boolean' },
      },
      required: ['type', 'ref_id', 'title', 'summary_for_support', 'needs_human'],
    },
  },
  notify_merchant: {
    description: "Send a short message to the merchant's Voxa Pay for Business app, written in the merchant's language. It is read aloud. Keep it calm, under 45 words, include amount and ticket id.",
    input_schema: {
      type: 'object',
      properties: { message: { type: 'string' }, english_translation: { type: 'string' } },
      required: ['message', 'english_translation'],
    },
  },
  notify_customer: {
    description: "Send a short English message to the customer's Voxa Pay app (for example a pending receipt). Under 45 words.",
    input_schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
  },
  check_settlement: {
    description: 'Look up a settlement (end-of-day payout to the merchant bank): gross, loan deduction, expected deduction, hold reason.',
    input_schema: { type: 'object', properties: { settlement_id: { type: 'string' } }, required: ['settlement_id'] },
  },
  get_sales_summary: {
    description: "Sales totals for 'today', 'week' (last 7 days), 'month' (last 30 days) or '90days', with change vs the previous period and best/slowest day.",
    input_schema: { type: 'object', properties: { period: { type: 'string', enum: ['today', 'week', 'month', '90days'] } }, required: ['period'] },
  },
  get_hourly_pattern: {
    description: 'Average sales per hour of the day and the slow window, with a suggested offer.',
    input_schema: { type: 'object', properties: {} },
  },
  create_offer: {
    description: 'Start a discount offer customers see when paying. Only call after the merchant clearly agreed.',
    input_schema: {
      type: 'object',
      properties: { percent: { type: 'number' }, start_hour: { type: 'number', description: '24h clock' }, end_hour: { type: 'number' } },
      required: ['percent', 'start_hour', 'end_hour'],
    },
  },
  get_loan_offer: {
    description: 'Business loan plan for an amount and number of months, at the rate the lender is likely to set from his profile, with the standard EMI (reducing balance) formula: monthly EMI, about how much per day, total interest, the month it is paid off, the hardest month against expected sales, and the saving from paying extra each month. Ranges come from a third-party summary of Paytm business loans (amount ₹50,000–₹10 lakh for small merchants, up to about 36% a year, 12–36 months, 2–5% processing fee); the lender sets final terms and prepayment may have a charge.',
    input_schema: { type: 'object', properties: { amount: { type: 'number' }, months: { type: 'number' }, extra: { type: 'number', description: 'extra ₹ paid each month' } } },
  },
  get_planner_insights: {
    description: "Voxa's shop planner: suggestions built only from payment data and what the merchant told Voxa. Quiet hours, the next festival and how last year's festival month sold, regular customers who stopped paying, the trend in average bill, and stock bought (only from bills he showed). Voxa never sees stock on the shelves.",
    input_schema: { type: 'object', properties: {} },
  },
  get_regular_customers: {
    description: 'Regular customers seen in payments (same UPI ID paying again and again): how often they usually pay, how much, when they last paid, and whether they seem to have stopped.',
    input_schema: { type: 'object', properties: {} },
  },
  check_loan_eligibility: {
    description: "Pass amount = the amount he asked for (in rupees, e.g. 500000 for 5 lakh). Returns whether that amount fits, the limit and WHY (the rule and his numbers), what would be needed for the amount he asked, and a ready plan for the largest amount he can get. Voxa's own check of the merchant's Voxa Pay data the way a lender looks at it: regular collections, sales almost every day, growth, KYC. Returns whether he looks eligible, an estimated limit, the likely rate band (the lender sets the rate from his profile; he cannot choose it), the processing fee, and how to apply. The credit score is checked by the lender, not Voxa.",
    input_schema: { type: 'object', properties: { amount: { type: 'number', description: 'Amount he asked for, in rupees' } } },
  },
  add_note: {
    description: 'Write an important note on the Voxa notes page that the merchant can see again later, for example a deadline, a loan detail or something he asked you to remember. Keep it short.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' }, dashboard: { type: 'string', enum: ['none', 'sales', 'costs', 'loan', 'payments'], description: 'Attach a small live dashboard to the note when it helps, e.g. costs for a costs note.' }, period: { type: 'string', enum: ['7', '30', '90', 'm6', 'm12'], description: 'Period for a sales dashboard' } }, required: ['title', 'text'] },
  },
  save_answer_to_notes: {
    description: "Save one of your earlier answers in this chat to the Voxa notes page, with its dashboard. Use it when he says things like 'add it to notes', 'save this', 'note that down', 'அதை நோட்ல சேர்', 'इसे नोट में डालो'. which=1 is your last answer, 2 the one before, and so on.",
    input_schema: { type: 'object', properties: { which: { type: 'number', description: '1 = your last answer (default)' } } },
  },
  record_expenses: {
    description: "Save the shop's running costs that the merchant tells you (rent, electricity, salary, stock, transport, phone, other) for this month. If he gives a total and some parts, put the difference under other.",
    input_schema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { category: { type: 'string', enum: ['stock', 'rent', 'electricity', 'salary', 'transport', 'phone', 'other'] }, amount: { type: 'number' } }, required: ['category', 'amount'] } } },
      required: ['items'],
    },
  },
  record_cash_sales: {
    description: "Save the merchant's cash sales for this month (money he took in cash, not through Paytm). Only use the number he says. Saying it again replaces the earlier number.",
    input_schema: { type: 'object', properties: { amount: { type: 'number' } }, required: ['amount'] },
  },
  get_profit_summary: {
    description: "This month's money picture: sales so far, the running costs Voxa has recorded, loan payments taken from settlements, and what is left with the merchant.",
    input_schema: { type: 'object', properties: {} },
  },
  show_dashboard: {
    description: 'Show a dashboard card under your reply, or build the one he describes. type: sales | costs | loan | payments. style: costs can be bar (one strip), donut, columns or table; sales can be columns (default), line or table. period for sales: 7, 30, 90 days, m6 or m12 months. save=true also keeps it on the Voxa notes page with a title.',
    input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['sales', 'costs', 'loan', 'payments'] }, style: { type: 'string', enum: ['bar', 'donut', 'columns', 'line', 'table'] }, period: { type: 'string', enum: ['7', '30', '90', 'm6', 'm12'] }, title: { type: 'string' }, save: { type: 'boolean' } }, required: ['type'] },
  },
  report_issue: {
    description: "Raise a support ticket for Murugan when he reports a problem or asks you to report or complain (for example a payment he cannot match, a customer who paid twice or paid cash and UPI, money that is late, a wrong deduction). First look up the payments involved, then write a clear summary for the support team: who, how much, when, what each side says, what Voxa already knows, and the one thing support should check. A person at support handles it.",
    input_schema: { type: 'object', properties: {
      title: { type: 'string', description: 'Short title, under 60 characters' },
      summary_for_support: { type: 'string', description: 'Facts and the question for support, in English' },
      customer: { type: 'string' }, amount: { type: 'number' }, txn_id: { type: 'string' },
    }, required: ['title', 'summary_for_support'] },
  },
  udhar_check: {
    description: "Before giving Kanakku (store credit), check a customer on his WhatsApp list: visits, how they paid back before, what they owe now. Returns a score, risk, suggested limit and a yes/careful/no for the amount asked. Use for 'can I give Suresh 2000 credit?'.",
    input_schema: { type: 'object', properties: { customer: { type: 'string', description: 'Name or phone' }, amount: { type: 'number' } }, required: ['customer'] },
  },
  udhar_add: {
    description: "Record Kanakku (store credit) Murugan gave a customer, e.g. 'Suresh 2000 kanakku la ezhudhu' or 'Suresh 2000 udhar, keep it in log'. Voxa logs it and the customer gets a WhatsApp message with their total due. Only for customers who joined by scanning the shop QR.",
    input_schema: { type: 'object', properties: { customer: { type: 'string' }, amount: { type: 'number' }, note: { type: 'string', description: 'What it was for, optional' } }, required: ['customer', 'amount'] },
  },
  udhar_paid: {
    description: "Murugan says a customer paid back Kanakku (cash or any way). Records it as confirmed by Murugan, lowers their balance and messages them the new balance.",
    input_schema: { type: 'object', properties: { customer: { type: 'string' }, amount: { type: 'number', description: 'Leave out for the full balance' } }, required: ['customer'] },
  },
  customers_overview: {
    description: "Customers who joined on WhatsApp: loyalty card progress, Kanakku due, repayments waiting for Murugan's OK.",
    input_schema: { type: 'object', properties: {} },
  },
  show_style_choices: {
    description: "Show him visual templates (small previews in the app's style) of the looks a dashboard can have, so he taps the one he likes. Use it whenever he wants to change how a dashboard looks, asks what looks are possible, or has not said which look he wants. of: costs | sales | loan. note: words from a note title if he means a dashboard in his notes.",
    input_schema: { type: 'object', properties: { of: { type: 'string', enum: ['costs', 'sales', 'loan'] }, note: { type: 'string' }, period: { type: 'string', enum: ['7', '30', '90', 'm6', 'm12'] } }, required: ['of'] },
  },
  change_note_dashboard: {
    description: "Change a dashboard that is already on the Voxa notes page: its look (style: bar, donut, columns, line, table), what it shows (type), the period or the title. Use it when he says things like 'change that graph', 'show it as a pie', 'make the supermarket note a bar chart'. note: words from the note title, or 'last' for the newest dashboard note.",
    input_schema: { type: 'object', properties: { note: { type: 'string' }, style: { type: 'string', enum: ['bar', 'donut', 'columns', 'line', 'table'] }, type: { type: 'string', enum: ['sales', 'costs', 'loan', 'payments'] }, period: { type: 'string', enum: ['7', '30', '90', 'm6', 'm12'] }, title: { type: 'string' } } },
  },
  share_status_with_customer: {
    description: "Send the verified payment status (UTR, debit time, deadline) to the customer's phone so both sides see the same facts.",
    input_schema: { type: 'object', properties: { txn_id: { type: 'string' } }, required: ['txn_id'] },
  },
  get_settlements: {
    description: 'Recent settlements and loan repayment progress.',
    input_schema: { type: 'object', properties: {} },
  },
};

const toolList = (names) => names.map((name) => ({ name, ...TOOL_DEFS[name] }));

function short(v) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 600 ? s.slice(0, 600) + '…' : s;
}

function findPayment(input) {
  const S = E.getState();
  if (input.txn_id) return E.findTxn(String(input.txn_id).toUpperCase());
  const amt = Number(input.amount);
  const pays = S.txns.filter((t) => t.kind === 'payment');
  if (amt) return pays.find((t) => t.amount === amt) || null;
  return pays.find((t) => t.status === 'pending') || pays[0] || null;
}

function runTool(name, input, ctx) {
  const S = E.getState();
  const lang = S.merchant.lang;
  switch (name) {
    case 'check_payment_status': {
      const t = findPayment(input || {});
      ctx.checked = true;
      return t ? E.paymentFacts(t) : { found: false, note: 'No payment matches.' };
    }
    case 'list_pending_payments':
      if (ctx.agent === 'chat') { ctx.cards = ctx.cards || []; if (!ctx.cards.some((c) => c.type === 'payments')) ctx.cards.push({ type: 'payments' }); }
      return S.txns.filter((t) => t.status === 'pending').map(E.paymentFacts);
    case 'create_ticket': {
      const ref = String(input.ref_id || ctx.refId || '');
      const txn = E.findTxn(ref);
      let needsHuman = !!input.needs_human;
      if (txn && txn.amount >= E.BIG_AMOUNT) needsHuman = true;
      if (input.type === 'settlement_hold' || input.type === 'wrong_deduction') needsHuman = true;
      const t = E.createTicket({ type: input.type, refId: ref, title: input.title, summary: input.summary_for_support, needsHuman, source: ctx.source });
      ctx.ticketId = t.id;
      return { ticket_id: t.id, status: t.status, deadline: t.deadline, udir_complaint: t.udir };
    }
    case 'notify_merchant':
      E.notify('merchant', { kind: 'voxa', text: input.message, english: input.english_translation, speak: true, refId: ctx.refId });
      ctx.notifiedMerchant = true;
      if (ctx.ticketId) E.addTimeline(ctx.ticketId, 'Voxa', 'Told Murugan: ' + (input.english_translation || input.message));
      return { sent: true };
    case 'notify_customer':
      E.notify('customer', { kind: 'voxa', text: input.message, refId: ctx.refId });
      ctx.notifiedCustomer = true;
      if (ctx.ticketId) E.addTimeline(ctx.ticketId, 'Voxa', 'Told Sanjeevi: ' + input.message);
      return { sent: true };
    case 'check_settlement': {
      const st = E.findSettlement(input.settlement_id);
      return st || { found: false };
    }
    case 'get_sales_summary':
      if (ctx.agent === 'chat') { ctx.cards = ctx.cards || []; if (!ctx.cards.some((c) => c.type === 'sales')) ctx.cards.push({ type: 'sales', period: ({ today: '7', week: '7', month: '30', '90days': '90' })[input.period] || '7' }); }
      return E.salesSummary(input.period || 'week');
    case 'get_hourly_pattern':
      return E.hourlyInsight();
    case 'create_offer': {
      const o = E.createOffer({ percent: input.percent, start: input.start_hour, end: input.end_hour });
      return { created: true, offer: o.label };
    }
    case 'get_loan_offer': {
      const p = E.loanPlan(input);
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'loan')) ctx.cards.push({ type: 'loan', amount: p.amount, months: p.months, rate: p.rate, extra: p.extra });
      return {
        status: S.loan.status, active_loan: S.loan.status === 'active' ? { amount: S.loan.amount, emi: S.loan.emi, repaid_so_far: S.loan.repaid, outstanding: S.loan.outstanding, finish: S.loan.finish } : null,
        amount: p.amount, months: p.months, interest_rate_per_year: p.rate, monthly_emi: p.emi, about_per_day: p.daily,
        total_interest: p.totalInterest, total_paid: p.totalPaid, processing_fee: p.fee, gst_on_fee: p.feeGst,
        starts: p.start, paid_off_by: p.finish, hardest_month: { month: p.hardest.label, share_of_expected_sales_percent: p.hardest.share }, if_sales_drop_20_percent: { share_of_sales_percent: p.slow.share, still_comfortable: p.slow.safe },
        extra_each_month: p.extra, saving_from_extra: p.saving,
        prepayment: 'Paying extra finishes sooner and saves interest, but some lenders charge for prepayment. Check the lender sanction letter.',
        source: p.source.name,
      };
    }
    case 'record_cash_sales': {
      E.setCashSales(input.amount, { source: ctx.source, said: ctx.said || '' });
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'costs')) ctx.cards.push({ type: 'costs' });
      return { saved_cash_sales: input.amount, month_summary: E.profitSummary() };
    }
    case 'record_expenses': {
      const added = E.addExpenses(input.items || [], { source: ctx.source, said: ctx.said || '' });
      const ps = E.profitSummary();
      E.addBoardNote({ key: 'costs-' + ps.month, tag: 'costs', title: `${ps.monthName}: cost to run the shop ${rupee(ps.costTotal)}`, text: `${ps.costs.map((c) => c.label + ' ' + rupee(c.amount)).join(', ')}. Left with you so far: ${rupee(ps.left)}.${ps.hasStock ? '' : ' Stock purchases not added yet.'}`, source: ctx.source });
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'costs')) ctx.cards.push({ type: 'costs' });
      return { saved: added.map((e) => ({ category: e.label, amount: e.amount })), month_summary: E.profitSummary() };
    }
    case 'get_profit_summary':
      if (ctx.agent === 'chat') { ctx.cards = ctx.cards || []; if (!ctx.cards.some((c) => c.type === 'costs')) ctx.cards.push({ type: 'costs' }); }
      return E.profitSummary();
    case 'get_planner_insights': {
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'planner')) ctx.cards.push({ type: 'planner' });
      return E.plannerInsights().map(({ title, text, data }) => ({ title, text, based_on: data }));
    }
    case 'get_regular_customers':
      return E.regularsStatus().map((r) => ({ name: r.name, usually_every_days: r.usualGap, average_payment: r.avgAmount, last_paid: r.lastPaid, days_since: r.daysSince, seems_stopped: r.stopped }));
    case 'check_loan_eligibility': {
      const pr = E.loanProfile();
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'eligibility')) ctx.cards.push({ type: 'eligibility' });
      E.addBoardNote({ key: 'eligibility', tag: 'loan', title: `Loan check: ${pr.eligible ? 'looks eligible' : 'not eligible yet'} up to ${rupee(pr.limit)}`, text: `Voxa's estimate from your sales: about ${pr.monthlyRate}% a month (${pr.rate}% a year), fee ${pr.feePct}% + GST. The lender also checks your CIBIL score and decides the final offer in the Paytm for Business app.`, source: ctx.source });
      // answer the amount he asked for: does it fit, why the limit is what it is, what would change it
      const asked = Math.round(Number(input.amount) || 0);
      const fits = asked ? asked <= pr.limit : null;
      const planFor = (amt) => { try { const p = E.loanPlan({ amount: amt, months: 12 }); return { amount: p.amount, months: 12, every_month: p.emi, about_a_day: p.daily, total_interest: p.totalInterest, reaches_bank: p.received, ends: p.finish }; } catch { return null; } };
      const askedAnswer = asked ? {
        asked_for: asked,
        fits: fits,
        why_the_limit: `Voxa's estimate lets him borrow about 85% of one month's average sales on Voxa Pay. His average is ${rupee(pr.avgMonth)} a month, so about ${rupee(pr.limit)}.`,
        monthly_sales_needed_for_asked: fits ? null : Math.ceil(asked / 0.85 / 1000) * 1000,
        what_could_help: fits ? null : ['Keep collecting more through Voxa Pay: the limit grows with monthly sales', 'A lender may still offer more after checking his credit score (CIBIL), which Voxa cannot see', 'Take the amount he can get now and ask again later'],
        plan_for_largest_he_can_get_now: fits ? planFor(asked) : planFor(pr.limit),
        where_to_apply: 'The Loan tab in this app (Voxa Pay for Business). Never send him to another app.',
      } : null;
      return { ...(askedAnswer ? { answer_for_his_amount: askedAnswer } : {}), eligible: pr.eligible, estimated_limit: pr.limit, likely_rate_per_month: pr.monthlyRate, likely_rate_per_year: pr.rate, processing_fee_percent: pr.feePct, profile: pr.band, checks: pr.checks.map((c) => ({ check: c.label, ok: c.ok, detail: c.detail })), how_to_apply: pr.steps };
    }
    case 'add_note': {
      const dash = ['sales', 'costs', 'loan', 'payments'].includes(input.dashboard) ? { type: input.dashboard, period: ['7', '30', '90', 'm6', 'm12'].includes(input.period) ? input.period : '30' } : null;
      const n = E.addBoardNote({ title: String(input.title || '').slice(0, 80), text: String(input.text || '').slice(0, 400), tag: dash ? 'dashboard' : 'note', source: ctx.source, card: dash });
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'notes')) ctx.cards.push({ type: 'notes' });
      return { saved: true, id: n.id };
    }
    case 'save_answer_to_notes': {
      const S2 = E.getState();
      const answers = S2.chat.map((m, k) => ({ m, k })).filter((x) => x.m.role === 'assistant');
      const pick = answers[answers.length - Math.max(1, Math.round(Number(input.which) || 1))];
      if (!pick) return { saved: false, reason: 'There is no earlier answer in this chat to save.' };
      if (pick.m.savedNote) return { saved: true, already: true, title: S2.board.find((n) => n.text === String(pick.m.text).slice(0, 600))?.title || '' };
      const n = E.saveAnswerToNotes(pick.k);
      ctx.cards = ctx.cards || [];
      if (!ctx.cards.some((c) => c.type === 'notes')) ctx.cards.push({ type: 'notes' });
      return { saved: true, title: n.title, has_dashboard: !!n.card };
    }
    case 'show_dashboard': {
      ctx.cards = ctx.cards || [];
      const card = { type: input.type, period: input.period || '7', ...(input.style ? { style: input.style } : {}), ...(input.title ? { title: String(input.title).slice(0, 50) } : {}) };
      ctx.cards = ctx.cards.filter((c) => c.type !== input.type);
      ctx.cards.push(card);
      if (input.save) {
        const n = E.addBoardNote({ title: (input.title || ({ sales: 'Sales', costs: 'Costs and profit', loan: 'Loan plan', payments: 'Payments' })[input.type]).slice(0, 80), text: 'Dashboard Voxa built for you. Ask Voxa to change its look any time.', tag: 'dashboard', source: ctx.source, card });
        return { shown: input.type, style: card.style || 'default', saved_to_notes: n.title };
      }
      return { shown: input.type, style: card.style || 'default' };
    }
    case 'report_issue': {
      const S2 = E.getState();
      const t = input.txn_id ? E.findTxn(String(input.txn_id).toUpperCase()) : (input.amount ? S2.txns.find((x) => x.kind === 'payment' && x.amount === Number(input.amount) && (!input.customer || x.fromName.toLowerCase().includes(String(input.customer).toLowerCase()))) : null);
      // one open report per payment: add to it instead of opening another
      const open = t && S2.tickets.find((k) => k.refId === t.id && k.status !== 'resolved');
      if (open) {
        E.addTimeline(open.id, 'Murugan', 'Reported again through Voxa: ' + String(input.summary_for_support).slice(0, 300));
        if (open.status !== 'needs_human') E.escalateTicket(open.id, 'Murugan reported a problem with this payment');
        return { ticket_id: open.id, status: 'already open, added his report and sent to a person' };
      }
      const k = E.createTicket({ type: 'merchant_report', refId: t ? t.id : 'MR-' + Date.now(), title: String(input.title).slice(0, 60), summary: String(input.summary_for_support).slice(0, 900), needsHuman: true, source: ctx.source });
      E.addTimeline(k.id, 'Murugan', 'Reported through Ask Voxa.');
      E.addBoardNote({ key: 'report-' + k.id, tag: 'payment', title: `Reported: ${k.title}`.slice(0, 80), text: `Ticket ${k.id} is with the support team. Voxa will tell you when there is an update.` });
      return { ticket_id: k.id, status: 'sent to the support team', linked_payment: t ? t.id : null };
    }
    case 'udhar_check': {
      const cu = CRM.findCustomer(input.customer);
      if (!cu) return { found: false, note: 'Not on his WhatsApp list. Ask the customer to scan the shop QR and tap Send; then Voxa can track their Kanakku.' };
      return { customer: cu.name, ...CRM.creditScore(cu, Number(input.amount) || 0) };
    }
    case 'udhar_add': {
      const cu = CRM.findCustomer(input.customer);
      if (!cu) return { saved: false, note: 'Not on his WhatsApp list yet. Ask them to scan the shop QR first.' };
      const r = CRM.addCredit(cu, input.amount, input.note || '');
      return { saved: true, customer: cu.name, total_due: r.balance, whatsapp: CRM.WA_LIVE ? 'message sent to the customer' : 'WhatsApp not connected, no message sent' };
    }
    case 'udhar_paid': {
      const cu = CRM.findCustomer(input.customer);
      if (!cu) return { saved: false, note: 'Not on his WhatsApp list.' };
      const owed = CRM.balanceOf(cu);
      if (owed <= 0) return { saved: false, note: cu.name + ' owes nothing.' };
      const e = CRM.repayClaim(cu, Math.min(owed, Number(input.amount) || owed), 'Murugan said so in Ask Voxa');
      const r = CRM.confirmRepay(e.id);
      return { saved: true, customer: cu.name, still_due: r.balance };
    }
    case 'customers_overview': {
      const c = E.getState().crm;
      return {
        whatsapp_connected: CRM.WA_LIVE,
        customers: c.customers.map((cu) => ({ name: cu.name, loyalty_days: cu.visits.filter((d) => d > (cu.cardResetOn || '')).length, rewards_won: cu.rewards, udhar_due: CRM.balanceOf(cu), waiting_for_ok: cu.udhar.filter((e) => e.status === 'pending').map((e) => e.amount) })),
        reward: c.reward,
      };
    }
    case 'show_style_choices': {
      const board = E.getState().board;
      const words = String(input.note || '').toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const n = words.length ? board.find((x) => x.card && words.some((w) => x.title.toLowerCase().includes(w))) : null;
      ctx.cards = ctx.cards || [];
      ctx.cards = ctx.cards.filter((c) => c.type !== 'style_picker');
      ctx.cards.push({ type: 'style_picker', of: input.of, note: n ? n.id : '', period: input.period || '' });
      return { shown: 'templates', of: input.of, for_note: n ? n.title : null, note: 'He will tap one. Reply in one short sentence asking him to pick.' };
    }
    case 'change_note_dashboard': {
      const board = E.getState().board;
      const q = String(input.note || 'last').toLowerCase();
      const words = q.split(/\s+/).filter((w) => w.length > 2 && w !== 'last' && w !== 'note');
      const dash = board.filter((n) => n.card);
      const pick = (words.length && board.find((n) => words.every((w) => (n.title + ' ' + n.text).toLowerCase().includes(w))))
        || (words.length && board.find((n) => words.some((w) => n.title.toLowerCase().includes(w))))
        || dash[0];
      if (!pick) return { changed: false, reason: 'No dashboard note found. Use show_dashboard with save=true to make one.' };
      const n = E.updateNoteDashboard(pick.id, input);
      ctx.cards = ctx.cards || [];
      ctx.cards = ctx.cards.filter((c) => c.type !== n.card.type);
      ctx.cards.push({ ...n.card });
      return { changed: true, note: n.title, now: n.card };
    }
    case 'share_status_with_customer': {
      const t = E.findTxn(String(input.txn_id || '').toUpperCase());
      if (!t) return { sent: false };
      shareWithCustomer(t);
      return { sent: true };
    }
    case 'get_settlements':
      return { settlements: S.settlements.slice(0, 5), loan: S.loan, unsettled_today: S.merchant.unsettled };
    default:
      return { error: 'unknown tool' };
  }
}

function shareWithCustomer(t) {
  const S = E.getState();
  t.verified = true;
  E.notify('customer', {
    kind: 'verified', refId: t.id,
    text: `Verified by ${S.merchant.name}'s Voxa: your ${rupee(t.amount)} (UTR ${t.utr}) was debited at ${E.timeLabel(t.debitedAt || t.createdAt)} and is ${t.status === 'pending' ? 'still on the way between banks' : t.status}. ${t.status === 'pending' ? `It will reach the shop or come back to you by ${t.deadline}. Don't pay again by UPI.` : ''}`,
  });
  const tk = E.ticketForRef(t.id);
  if (tk) E.addTimeline(tk.id, 'Voxa', 'Shared the verified status with the customer at the counter.');
}

function callTool(name, input, ctx) {
  const t0 = Date.now();
  let out;
  try {
    out = runTool(name, input || {}, ctx);
  } catch (e) {
    out = { error: e.message };
  }
  E.log({ agent: ctx.agent, source: ctx.source, type: 'tool', name, input: short(input || {}), output: short(out), ms: Date.now() - t0 });
  return out;
}

// ---------------------------------------------------------------- Claude loop
async function createMessage(params) {
  const opts = { timeout: 30000, maxRetries: 1 };
  if (fallbacksSupported) {
    try {
      return await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }, opts);
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      fallbacksSupported = false; // retry once without the beta
    }
  }
  return client.messages.create(params, opts);
}

async function runClaude({ system, messages, tools, ctx, maxTurns = 6 }) {
  const convo = [...messages];
  for (let turn = 0; turn < maxTurns; turn++) {
    const t0 = Date.now();
    const res = await createMessage({ model: MODEL, max_tokens: 4000, system, tools, messages: convo, output_config: { effort: EFFORT } });
    E.log({ agent: ctx.agent, source: 'claude', type: 'model', name: res.model || MODEL, input: `turn ${turn + 1}`, output: `stop: ${res.stop_reason}`, ms: Date.now() - t0 });
    if (res.stop_reason === 'refusal') throw new Error('Model declined');
    if (res.stop_reason === 'pause_turn') { convo.push({ role: 'assistant', content: res.content }); continue; }
    const uses = res.content.filter((b) => b.type === 'tool_use');
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!uses.length) return text;
    convo.push({ role: 'assistant', content: res.content });
    const results = uses.map((u) => ({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify((tools || []).some((t) => t.name === u.name) ? callTool(u.name, u.input, ctx) : { error: 'That tool is not available here.' }) }));
    convo.push({ role: 'user', content: results });
  }
  return '';
}

// ---------------------------------------------------------------- event agent
const EVENT_SYSTEM = (lang) => `You are Voxa, an AI accountant agent inside Voxa Pay, a payments demo that uses fake money. You are handling an automated event, not chatting with anyone.
Your job for each event:
1. Check the facts with a tool.
2. Create exactly one ticket. For stuck payments, Voxa waits one day for the bank to fix it on its own before a person at support takes over.
3. Tell the merchant (Murugan, a small shop owner in Chennai) what happened, in ${LANG_NAMES[lang]}, in short plain spoken words: who paid, the amount, that it is stuck at the bank, and the deadline. Do not take sides or say who is right.
You work only for the merchant. Never message the customer; their own payment app shows them the status.
Rules: payments of ₹10,000 or more, settlement holds and wrong loan deductions need a human, so set needs_human=true for those. Never promise that the bank will pay faster; say the money will be credited or refunded by the deadline. After the tools, reply with one short English sentence summarising what you did.`;

async function handleEvent(kind, payload, rules) {
  const S = E.getState();
  const ctx = { agent: 'event', source: EVENTS_AI ? BRAIN : 'rules', refId: payload.id };
  E.log({ agent: 'event', source: 'monitor', type: 'event', name: kind, input: payload.id, output: kind === 'payment_pending' ? `${rupee(payload.amount)} debited, merchant not credited` : '', ms: 0 });
  if (EVENTS_AI) {
    try {
      const facts = kind.startsWith('payment') ? E.paymentFacts(payload) : payload;
      const summary = await runBrain({
        system: EVENT_SYSTEM(S.merchant.lang),
        messages: [{ role: 'user', content: `EVENT: ${kind}\nref_id: ${payload.id}\nmerchant_language: ${LANG_NAMES[S.merchant.lang]}\nfacts: ${JSON.stringify(facts)}` }],
        tools: toolList(kind.startsWith('payment') ? ['check_payment_status', 'create_ticket', 'notify_merchant'] : ['check_settlement', 'create_ticket', 'notify_merchant']),
        ctx,
      });
      if (summary) E.log({ agent: 'event', source: BRAIN, type: 'final', name: 'summary', input: '', output: summary, ms: 0 });
    } catch (e) {
      E.log({ agent: 'event', source: 'rules', type: 'fallback', name: 'ai_error', input: '', output: e.message, ms: 0 });
    }
  }
  ctx.source = ctx.source === 'claude' && ctx.ticketId ? 'claude' : 'rules';
  rules(payload, ctx); // fills in anything the model did not do
}

function rulesPending(txn, ctx) {
  const S = E.getState();
  const lang = S.merchant.lang;
  ctx.source = 'rules';
  if (!ctx.checked) callTool('check_payment_status', { txn_id: txn.id }, ctx);
  let t = E.ticketForRef(txn.id);
  const big = txn.amount >= E.BIG_AMOUNT;
  if (!t) {
    callTool('create_ticket', {
      type: 'stuck_payment', ref_id: txn.id, title: `${rupee(txn.amount)} stuck after debit`,
      summary_for_support: `${txn.fromName} paid ${rupee(txn.amount)} to ${txn.toName} at ${E.timeLabel(txn.createdAt)} (UTR ${txn.utr}). Voxa Bank debited the customer; the merchant-side credit timed out, so the payment is pending. UDIR complaint filed automatically; bank deadline ${txn.deadline}. Both sides notified.${big ? ' Amount is above ₹10,000, so a human should chase the bank today.' : ' No action needed unless the deadline passes.'}`,
      needs_human: big,
    }, ctx);
    t = E.ticketForRef(txn.id);
  } else if (big && t.status !== 'needs_human') {
    E.escalateTicket(t.id, 'amount is ₹10,000 or more');
  }
  if (!ctx.notifiedMerchant) {
    const m = msg('pending', lang, { amount: txn.amount, name: txn.fromName, deadline: txn.deadline, ticket: t.id });
    if (big) {
      const x = msg('escalated', lang, { amount: txn.amount, ticket: t.id });
      m.text += ' ' + x.text; m.english += ' ' + x.english;
    }
    callTool('notify_merchant', { message: m.text, english_translation: m.english }, ctx);
  }

  txn.voxa = 'done';
  E.addBoardNote({ key: 'stuck-' + txn.id, tag: 'payment', title: `Stuck payment ${rupee(txn.amount)} from ${txn.fromName}`, text: `Ticket ${t.id}, UTR ${txn.utr}. The bank must credit you or refund the customer by ${txn.deadline}. Voxa is following up.` });
  E.touch();
}

function rulesSettlement(st, ctx) {
  const S = E.getState();
  const lang = S.merchant.lang;
  ctx.source = 'rules';
  let t = E.ticketForRef(st.id);
  if (!t) {
    callTool('create_ticket', {
      type: 'settlement_hold', ref_id: st.id, title: `Settlement ${rupee(st.net)} on hold`,
      summary_for_support: `Settlement ${st.id} of ${rupee(st.net)} (gross ${rupee(st.gross)}) is held: ${st.holdReason}. Voxa checked: both names are on the same PAN and the bank account has paid out normally for 90 days. Suggested action: release the settlement.`,
      needs_human: true,
    }, ctx);
    t = E.ticketForRef(st.id);
  }
  if (!ctx.notifiedMerchant) {
    const m = msg('settlementHeld', lang, { amount: st.net, ticket: t.id });
    callTool('notify_merchant', { message: m.text, english_translation: m.english }, ctx);
  }
}

function rulesDeduction(st, ctx) {
  const S = E.getState();
  const lang = S.merchant.lang;
  ctx.source = 'rules';
  const extra = st.deduction - st.expectedDeduction;
  // a held settlement can also have a wrong deduction: use a separate ref so both tickets exist
  const ref = st.id + '-D';
  let t = E.ticketForRef(ref);
  if (!t) {
    callTool('create_ticket', {
      type: 'wrong_deduction', ref_id: ref, title: `Loan deduction ${rupee(extra)} too high`,
      summary_for_support: `Settlement ${st.id}: ${rupee(st.deduction)} was taken for the loan, but the agreed rule is 4% of ${rupee(st.gross)} = ${rupee(st.expectedDeduction)}. Extra ${rupee(extra)} taken, probably a duplicate deduction run. Suggested action: refund ${rupee(extra)} to the merchant's bank.`,
      needs_human: true,
    }, ctx);
    t = E.ticketForRef(ref);
  }
  if (!ctx.notifiedMerchant) {
    const m = msg('wrongDeduction', lang, { taken: st.deduction, expected: st.expectedDeduction, extra, ticket: t.id });
    callTool('notify_merchant', { message: m.text, english_translation: m.english }, ctx);
  }
}

// Late credit or reversal: always rules (fast, deterministic).
function onResolved(txn) {
  const S = E.getState();
  const lang = S.merchant.lang;
  const ctx = { agent: 'event', source: 'rules', refId: txn.id };
  E.log({ agent: 'event', source: 'monitor', type: 'event', name: 'payment_resolved', input: txn.id, output: txn.resolvedHow, ms: 0 });
  const t = E.ticketForRef(txn.id);
  const ticket = t ? t.id : '-';
  const covered = txn.cashTaken || txn.paidAgainBy;
  const how = txn.cashTaken ? 'in cash' : 'by UPI';
  const say = (key, extra = {}) => { const m = msg(key, lang, { amount: txn.amount, name: txn.fromName, ticket, how, ...extra }); return m; };
  if (txn.resolvedHow === 'late_credit') {
    if (covered) {
      const m = say('doublePaid');
      E.tellMerchant('The stuck payment reached Murugan late, but the customer had already paid him again, so he was paid twice and must give the extra back.', { customer: txn.fromName, amount: txn.amount, paid_again: how }, m, { kind: 'double_payment', refId: txn.id, action: { type: 'refund', label: `Give ${rupee(txn.amount)} back to ${txn.fromName}` } });
      if (t) E.resolveTicket(t.id, 'Voxa', `Bank credited late. ${txn.fromName} had already paid again ${how}, so Voxa told Murugan he was paid twice and should give ${rupee(txn.amount)} back.`);
    } else {
      const m = say('creditedLate');
      E.tellMerchant('A payment that was stuck at the bank has now reached Murugan. All settled.', { customer: txn.fromName, amount: txn.amount }, m, { refId: txn.id });
      if (t) E.resolveTicket(t.id, 'Voxa', 'Bank credited the merchant late after reconciliation. Murugan told. Closed without a person.');
    }
  } else {
    const m = say(covered ? 'reversedCovered' : 'reversedAskAgain');
    E.tellMerchant(covered ? 'A stuck payment went back to the customer, who had already paid Murugan again. Everything is even.' : 'A stuck payment went back to the customer, so Murugan was not paid for that sale. If the customer took the goods, he should ask them to pay again.', { customer: txn.fromName, amount: txn.amount, customer_paid_again: !!covered }, m, { refId: txn.id });
    if (t) E.resolveTicket(t.id, 'Voxa', covered ? `Bank sent the money back to ${txn.fromName}, who had already paid again. Nothing owed either way.` : `Bank sent the money back to ${txn.fromName}. Voxa reminded Murugan to ask for the ${rupee(txn.amount)} again if the goods were taken.`);
  }
  // Voxa notes keep the story, so Murugan can look back at it later
  const noteText = txn.resolvedHow === 'late_credit'
    ? (covered ? `${txn.fromName} paid you twice for one ${rupee(txn.amount)} sale (the stuck payment came through late, and they had already paid again ${how}). Give ${rupee(txn.amount)} back to ${txn.fromName}.` : `The stuck ${rupee(txn.amount)} from ${txn.fromName} reached you late. All settled.`)
    : (covered ? `The stuck ${rupee(txn.amount)} went back to ${txn.fromName}. They had already paid again, so all settled.` : `The stuck ${rupee(txn.amount)} went back to ${txn.fromName}. If they took the goods, ask them to pay ${rupee(txn.amount)} again.`);
  const open = (txn.resolvedHow === 'late_credit' && covered) || (txn.resolvedHow === 'reversed' && !covered);
  E.addBoardNote({ key: 'stuck-' + txn.id, tag: open ? 'payment' : 'done', title: open ? `${txn.fromName}: ${txn.resolvedHow === 'late_credit' ? 'give ' + rupee(txn.amount) + ' back' : 'ask for ' + rupee(txn.amount) + ' again'}` : `Settled: ${rupee(txn.amount)} from ${txn.fromName}`, text: noteText });
  callTool('check_payment_status', { txn_id: txn.id }, ctx);
}

const AGENT_DELAY = Number(process.env.VOXA_DELAY_MS || 2500);

export function startAgent() {
  E.bus.on('payment_pending', (txn) => {
    txn.voxa = 'checking';
    E.touch();
    setTimeout(() => {
      // the bank may already have fixed it while Voxa was getting ready: then there is nothing to open
      if (txn.status !== 'pending') { txn.voxa = 'done'; E.log({ agent: 'event', source: 'monitor', type: 'event', name: 'payment_pending', input: txn.id, output: 'already fixed by the bank, no ticket needed', ms: 0 }); E.touch(); return; }
      handleEvent('payment_pending', txn, rulesPending).catch(console.error);
    }, AGENT_DELAY);
  });
  E.bus.on('payment_resolved', (txn) => onResolved(txn));
  E.bus.on('ticket_created', (t) => { if (t.status === 'needs_human') setTimeout(() => writeBrief(t, 'new ticket').catch(console.error), 400); });
  E.bus.on('ticket_needs_person', (t) => setTimeout(() => writeBrief(t, 'sent to a person').catch(console.error), 400));
  E.bus.on('settlement_held', (st) => handleEvent('settlement_held', st, rulesSettlement).catch(console.error));
  E.bus.on('deduction_mismatch', (st) => setTimeout(() => handleEvent('deduction_mismatch', { ...st, id: st.id + '-D' }, (p, ctx) => rulesDeduction(st, ctx)).catch(console.error), 300));
  E.bus.on('payment_success', (txn) => {
    const S = E.getState();
    const lang = S.merchant.lang;
    const m = msg('received', lang, { amount: txn.amount, name: txn.fromName });
    E.notify('merchant', { kind: 'received', text: m.text, english: m.english, speak: true, refId: txn.id });
    linkRepeatPayment(txn);
  });
}

// Same customer, same amount: either paying again because the first one is stuck,
// or paying again after the stuck one went back. Voxa connects the two and keeps a note.
function linkRepeatPayment(txn) {
  const S = E.getState();
  const lang = S.merchant.lang;
  const same = (x) => x.kind === 'payment' && x.id !== txn.id && x.fromName === txn.fromName && x.amount === txn.amount;
  const stuck = S.txns.find((x) => same(x) && x.status === 'pending' && !x.paidAgainBy && !x.cashTaken);
  if (stuck) {
    stuck.paidAgainBy = txn.id;
    const m = msg('paidAgain', lang, { amount: txn.amount, name: txn.fromName });
    setTimeout(() => E.tellMerchant('The customer paid the same amount again because the first payment is stuck at the bank. The second one reached Murugan. If the stuck one also arrives later, he must give that amount back. Voxa has noted it.', { customer: txn.fromName, amount: txn.amount, first_payment_at: E.timeLabel(stuck.createdAt), second_payment_at: E.timeLabel(txn.createdAt), bank_deadline: stuck.deadline }, m, { refId: stuck.id }), 1500);
    const t = E.ticketForRef(stuck.id);
    if (t) E.addTimeline(t.id, 'Voxa', `${txn.fromName} paid ${rupee(txn.amount)} again at the counter (${txn.id}) and it went through. If the stuck one also arrives, Murugan must give ${rupee(txn.amount)} back.`);
    E.addBoardNote({ key: 'stuck-' + stuck.id, tag: 'payment', title: `${txn.fromName} paid ${rupee(txn.amount)} twice today`, text: `At ${E.timeLabel(stuck.createdAt)} the first ${rupee(txn.amount)} got stuck at the bank, so ${txn.fromName} paid again at ${E.timeLabel(txn.createdAt)} and that one reached you. If the stuck one also arrives, give ${rupee(txn.amount)} back. If it goes back to ${txn.fromName}, nothing to do. Bank deadline: ${stuck.deadline}.` });
    E.touch();
    return;
  }
  const owed = S.txns.find((x) => same(x) && x.resolvedHow === 'reversed' && !x.paidAgainBy && !x.cashTaken && !x.paidBackBy);
  if (owed) {
    owed.paidBackBy = txn.id;
    const m = msg('paidBack', lang, { amount: txn.amount, name: txn.fromName });
    setTimeout(() => E.tellMerchant('The customer whose earlier payment went back has now paid again. That sale is settled.', { customer: txn.fromName, amount: txn.amount }, m, { refId: owed.id }), 1500);
    E.addBoardNote({ key: 'stuck-' + owed.id, tag: 'done', title: `Settled: ${rupee(txn.amount)} from ${txn.fromName}`, text: `The first ${rupee(txn.amount)} went back to ${txn.fromName}, and they paid again at ${E.timeLabel(txn.createdAt)}. All settled.` });
    E.touch();
  }
}

// Customer pressed "Raise complaint" before Voxa got to it.
// The customer reports one of their payments from their own app (any status, with a reason).
// Support gets a ticket at once, with Voxa's brief: what happened, what the shop's side shows, what to check.
const REASONS = {
  not_received: 'Money left my account but the shop says it did not get it',
  paid_twice: 'I paid twice for one purchase',
  refund_missing: 'I am waiting for my money back',
  other: 'Something else is wrong with this payment',
};
export function customerComplaint(txnId, reason = 'not_received', note = '') {
  const txn = E.findTxn(txnId);
  if (!txn) throw new Error('Payment not found');
  const said = (REASONS[reason] || REASONS.other) + (note ? ': ' + String(note).slice(0, 200) : '');
  txn.customerReported = { reason, said, at: Date.now() };
  let t = E.getState().tickets.find((k) => k.refId === txn.id && k.status !== 'resolved');
  if (t) {
    E.addTimeline(t.id, txn.fromName, 'Customer reported from their payment app: ' + said);
    if (t.status !== 'needs_human') E.escalateTicket(t.id, 'the customer reported it from their payment app');
    else writeBrief(t, 'customer reported').catch(console.error);
    return t;
  }
  t = E.createTicket({ type: 'customer_report', refId: txn.id, title: `${txn.fromName} reported ${rupee(txn.amount)}`.slice(0, 60), summary: `${txn.fromName} says: ${said}.`, needsHuman: true, source: 'rules' });
  E.addTimeline(t.id, txn.fromName, 'Customer reported from their payment app: ' + said);
  return t;
}

// ---------- Voxa's brief for the support agent ----------
// Everything a person needs in one place: the payment's story, the same customer's other payments today,
// what Murugan did (cash, paid again, returned), what the customer says, and what to check.
function ticketFacts(t) {
  const S = E.getState();
  const txn = E.findTxn(t.refId) || null;
  const who = txn ? txn.fromName : null;
  const related = who ? S.txns.filter((x) => x.fromName === who && x.kind === 'payment').map((x) => ({
    id: x.id, amount: x.amount, at: E.timeLabel(x.createdAt), status: x.status, ended: x.resolvedHow || null,
    customer_paid_cash_instead: !!x.cashTaken, customer_paid_again_by: x.paidAgainBy || null, money_returned_by_shop: !!x.refunded,
  })) : [];
  const st = S.settlements.find((x) => x.id === t.refId || x.id + '-D' === t.refId);
  return {
    ticket: { id: t.id, type: t.type, title: t.title, status: t.status, opened: E.timeLabel(t.createdAt) },
    payment: txn ? E.paymentFacts(txn) : null,
    customer_report: txn && txn.customerReported ? txn.customerReported.said : null,
    same_customer_payments_today: related,
    settlement: st ? { id: st.id, collected: st.gross, loan_taken: st.deduction, should_be: st.expectedDeduction, status: st.status, hold_reason: st.holdReason || null } : null,
    what_happened_so_far: t.timeline.map((x) => `${E.timeLabel(x.at)} ${x.who}: ${x.text}`).slice(-12),
  };
}
function plainBrief(f) {
  const p = f.payment;
  const lines = [];
  if (p) lines.push(`What happened: ${p.customer} paid ${rupee(p.amount)} at ${p.created}. ${String(p.outcome).replace(/\.$/, '')}.`);
  const others = f.same_customer_payments_today.filter((x) => !p || x.id !== p.txn_id);
  if (others.length) lines.push(`Same customer today: ${others.map((x) => `${rupee(x.amount)} at ${x.at} (${x.status}${x.customer_paid_again_by ? ', paid again' : ''})`).join('; ')}.`);
  const r = f.same_customer_payments_today.find((x) => p && x.id === p.txn_id);
  if (r && (r.customer_paid_cash_instead || r.customer_paid_again_by)) lines.push(`Shop side: the customer already paid again ${r.customer_paid_cash_instead ? 'in cash' : 'by UPI'}${r.money_returned_by_shop ? '; the shop has returned the extra' : ''}.`);
  if (f.customer_report) lines.push(`Customer says: ${f.customer_report}.`);
  if (f.settlement) lines.push(`Settlement ${f.settlement.id}: collected ${rupee(f.settlement.collected)}, loan taken ${rupee(f.settlement.loan_taken)} (should be ${rupee(f.settlement.should_be)}).`);
  lines.push(p && p.status === 'pending' ? 'Check: ask the bank to credit or reverse this UTR today.' : 'Check: confirm the payment outcome above and reply to both sides.');
  return lines.join('\n');
}
export async function writeBrief(t, why = '') {
  if (!t) return;
  const f = ticketFacts(t);
  let text = '', source = 'rules';
  if (EVENTS_AI) {
    try {
      text = await runBrain({
        system: 'You are Voxa, the AI agent that watches payments for a small shop. A support agent at the payment company is about to handle this ticket. Brief them in plain English, in at most 5 short lines, using only the facts given: 1) What happened (who, how much, when, where the money is now). 2) What the shop side shows (paid again, cash, returned). 3) What the customer says, if anything. 4) What Voxa already did. 5) The one thing the agent should check or do now. No greetings, no markdown symbols.',
        messages: [{ role: 'user', content: 'Ticket facts: ' + JSON.stringify(f) }],
        tools: undefined,
        ctx: { agent: 'event', source: BRAIN },
      });
      if (text) source = BRAIN;
    } catch (e) {
      E.log({ agent: 'event', source: 'rules', type: 'fallback', name: 'ai_error', input: 'brief', output: e.message, ms: 0 });
    }
  }
  if (!text) text = plainBrief(f);
  t.brief = { text: text.slice(0, 1200), at: Date.now(), source, why };
  E.addTimeline(t.id, 'Voxa', 'Wrote a brief for the support team' + (why ? ' (' + why + ')' : '') + '.');
  E.log({ agent: 'event', source, type: 'final', name: 'support_brief', input: t.id, output: text.slice(0, 160), ms: 0 });
  E.touch();
}

// Merchant pressed "Customer says paid — verify".
export function verifyForCounter(txnId) {
  const S = E.getState();
  const t = E.findTxn(txnId);
  if (!t) throw new Error('Payment not found');
  const ctx = { agent: 'counter', source: 'rules', refId: t.id };
  callTool('check_payment_status', { txn_id: t.id }, ctx);
  const m = msg('verify', S.merchant.lang, { amount: t.amount, name: t.fromName, time: E.timeLabel(t.debitedAt || t.createdAt), utr: t.utr, deadline: t.deadline || '-' });
  E.tellMerchant('Murugan asked Voxa to check a customer\'s payment at the counter.', { customer: t.fromName, amount: t.amount, status: t.status, left_customer_bank_at: E.timeLabel(t.debitedAt || t.createdAt), bank_deadline: t.deadline || null }, m, { kind: 'verified', refId: t.id });
  return m;
}

// ---------------------------------------------------------------- chat agent
const CHAT_TOOLS = ['get_sales_summary', 'get_hourly_pattern', 'list_pending_payments', 'check_payment_status', 'get_loan_offer', 'get_planner_insights', 'get_regular_customers', 'get_settlements', 'record_expenses', 'record_cash_sales', 'get_profit_summary', 'show_dashboard', 'check_loan_eligibility', 'add_note', 'save_answer_to_notes', 'change_note_dashboard', 'report_issue', 'show_style_choices', 'udhar_check', 'udhar_add', 'udhar_paid', 'customers_overview'];

// What is happening in the shop right now, so every answer starts from the live app, not a script.
function shopSnapshot() {
  const S = E.getState();
  const pays = S.txns.filter((t) => t.kind === 'payment');
  const today = E.salesToday();
  const month = E.profitSummary();
  const line = (t) => `${t.fromName} ${rupee(t.amount)} at ${E.timeLabel(t.createdAt)}`;
  const parts = [
    `Today so far: ${rupee(today.total)} from ${today.bills} payments.`,
    pays.length ? `Live payments today: ${pays.slice(0, 6).map((t) => line(t) + ' (' + t.status + ')').join('; ')}.` : '',
    pays.filter((t) => t.status === 'pending').map((t) => `STUCK: ${line(t)}, will reach him or go back by ${t.deadline}${t.paidAgainBy ? '; the customer already paid again' : ''}${t.cashTaken ? '; the customer paid cash instead' : ''}.`).join(' '),
    pays.filter((t) => t.resolvedHow === 'late_credit' && (t.cashTaken || t.paidAgainBy) && !t.refunded).map((t) => `HE OWES: ${t.fromName} paid twice for ${rupee(t.amount)}; he must give ${rupee(t.amount)} back.`).join(' '),
    pays.filter((t) => t.resolvedHow === 'reversed' && !t.paidAgainBy && !t.cashTaken && !t.paidBackBy).map((t) => `UNPAID: ${t.fromName}'s ${rupee(t.amount)} went back to them and they have not paid again.`).join(' '),
    S.tickets.filter((t) => t.status !== 'resolved').length ? `Open tickets: ${S.tickets.filter((t) => t.status !== 'resolved').map((t) => t.id + ' ' + t.title + ' (' + (t.status === 'needs_human' ? 'with support team' : 'waiting on bank') + ')').join('; ')}.` : '',
    `This month: sales ${rupee(month.revenue)}, costs noted ${rupee(month.costTotal)}${month.costs.length ? ' (' + month.costs.map((c) => c.label + ' ' + rupee(c.amount)).join(', ') + ')' : ' (none told yet)'}, left ${rupee(month.left)}.`,
    S.loan.status === 'active' ? `Loan: ${rupee(S.loan.outstanding)} left of ${rupee(S.loan.totalRepay)}, ${rupee(S.loan.daily)} taken daily.` : 'No loan running.',
    (() => { const c = S.crm; if (!c || !c.customers.length) return ''; const due = c.customers.filter((cu) => CRM.balanceOf(cu) > 0); const wait = c.customers.flatMap((cu) => cu.udhar.filter((e) => e.status === 'pending').map((e) => cu.name + ' ' + rupee(e.amount))); return `WhatsApp customers: ${c.customers.length}.${due.length ? ' Kanakku due: ' + due.map((cu) => cu.name + ' ' + rupee(CRM.balanceOf(cu))).join(', ') + '.' : ''}${wait.length ? ' WAITING FOR HIS OK, repayments: ' + wait.join(', ') + '.' : ''}`; })(),
    S.board.length ? `Voxa notes: ${S.board.slice(0, 5).map((n) => n.title).join('; ')}.` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

const CHAT_SYSTEM = (lang) => {
  const S = E.getState();
  return `You are Voxa, the AI accountant inside Voxa Pay for Business (a demo with fake money). You are talking to Murugan, who owns ${S.merchant.name}, a small shop in ${S.merchant.area}. He is busy, not technical, and may speak Tamil, Hindi or English.
He often speaks Tamil or Hindi written in English letters, or mixes them with English (for example "customer pay panna, aana payment varala" means the customer says they paid but the money has not come). Understand that and act on it. Never answer with a general list of what you can do; if the request is unclear, use the most likely tool or ask one short question.
LANGUAGE RULE: always answer in the language of his latest message. If he speaks or writes Tamil (in Tamil script, or Tamil words in English letters), answer in Tamil script. If Hindi, answer in Hindi (Devanagari). If English, answer in English. Never switch language because an earlier message was in another language.
Reply in ${LANG_NAMES[lang]} only (unless the language rule above says otherwise for English letters), in plain spoken words, because your reply is read aloud. No markdown, no bullet points, no tables. Be short and to the point: one or two short sentences, under 30 words, only the answer he needs. No greetings, no repeating his question, no extra advice, no offers like "anything else?". Give more detail only if he asks for it. Use Indian number format with ₹.
You are an agent: decide what to look up, call the tools, then answer. Answer exactly what he asked this time, with the numbers from this question; do not repeat an earlier answer if his question changed (a new amount, a new period, a new name). Think about what he is trying to do and give the most useful next step. Always use tools for numbers; never invent figures. Sales, payments, profit and loan tools add their dashboard under your reply by themselves, so do not call show_dashboard for those; answer right after you have the numbers. Ask for all the tools you need in one turn when you can. When he asks you to remember or keep something, save it with add_note, and attach a dashboard to the note when numbers are involved (for example dashboard "costs" for a costs note).
Bill photos: you CAN read bills. If he wants to send a photo of a bill or many bills, say yes and tell him to tap the camera button next to the mic; you will read every line, add up the costs and save them. Never tell him you cannot read photos or ask him to type the amounts instead. When a payment is already done (outcome starts with DONE), say only how it ended, for example the bank was late and the money has now reached him; never mention deadlines or RBI for a finished payment. If a customer says they paid but the money has not come, check it with check_payment_status or list_pending_payments, then tell Murugan simply: the money is stuck at the bank and will reach him or go back to the customer by the deadline. Do not say who is right. You work only for Murugan and never message customers.
Kanakku (கடன் கணக்கு, store credit; he may also say udhar, kadan or credit, all the same thing). Always call it kanakku in English replies and கணக்கு in Tamil replies, never udhar. Customers join his list by scanning the shop QR on WhatsApp. For 'can I give X credit?' use udhar_check and answer yes/careful/no with the reasons in one or two sentences. For 'X 2000 kanakku' or 'X 2000 udhar, keep it in log' use udhar_add. For 'X paid back' use udhar_paid. If the customer is not on the list, say they should scan the shop QR first. You can write Kanakku entries too, but never anything else about customers. Problems: if he reports a problem, says something does not add up, or asks you to complain or raise a ticket, check the payments first, then call report_issue with a clear summary for support, and tell him the ticket number in one sentence. Dashboards: you can build and change them, but only on your answers and his Voxa notes, never the app's own pages. When he wants a different look or has not said which look, call show_style_choices so he can tap a visual template; do not list chart types in words. If he names a look (pie, donut, bar, line, table), apply it directly. If he wants a different look (pie or donut, bars, columns, line, table) or different data or period, do it: for a dashboard in his notes use change_note_dashboard; for a new one use show_dashboard with the type, style and period he wants (save=true if he wants to keep it). Never say you cannot change a chart. If he asks you to add or save what you just said to the notes, call save_answer_to_notes (do not rewrite it with add_note). You may only change his Voxa notes (add_note, save_answer_to_notes, change_note_dashboard), his Costs & profit (record_expenses, record_cash_sales), and raise support tickets for him (report_issue); nothing else. Voxa notes (add_note, save_answer_to_notes) and Costs & profit (record_expenses, record_cash_sales). Never change sales, payments or the loan. Sales come only from his Paytm payments; cash sales and costs are only what he tells you, never a guess. If he tells you he sold some amount in cash, save it with record_cash_sales. If he tells you what he spent to run the shop (rent, electricity, salary, stock, transport and so on), save it with record_expenses, then tell him what is left this month. If stock purchases are missing, remind him the profit is not complete without them.
If he asks whether he can get a loan, call check_loan_eligibility with the amount he asked. Answer his exact amount: yes or no, why (the rule and his monthly sales), and what he can do now (the largest amount with its daily and monthly payment) or what would get him there. Loans are applied for in the Loan tab of this app; never mention another app. When explaining a loan, use get_loan_offer and explain it like to a friend: the daily amount taken from settlement, the monthly total, the total interest, the month it ends, and how much reaches his bank after the fee. He chooses the amount and months; the lender sets the rate from his profile. Most merchant plans have no charge for closing early, but he should check the Key Fact Statement. When something is worth remembering (a deadline, a loan detail, a request), save it with add_note. For advice on growing the shop use get_planner_insights; it only knows payments and what he told you, never his stock, so never guess what is on his shelves.
Today is ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}.
WHAT IS HAPPENING IN HIS SHOP RIGHT NOW (live from the app; use it, and if something here needs his attention, such as a stuck payment or money he owes, mention it briefly even if he did not ask):
${shopSnapshot()}`;
};

// Privacy: phone numbers never leave the shop. A customer's number becomes their name;
// any other number is hidden before the text goes to the AI.
export function maskPhones(t) {
  return String(t || '').replace(/(?:\+?91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, (m) => {
    const p = CRM.normPhone(m);
    const cu = ((E.getState().crm || {}).customers || []).find((x) => x.phone === p);
    return cu ? cu.name : '[phone number hidden]';
  });
}

export async function chat(text, lang) {
  const S = E.getState();
  lang = ['en', 'ta', 'hi'].includes(lang) ? lang : S.merchant.lang;
  // answer in the language he actually used: Tamil script → Tamil, Devanagari → Hindi
  if (/[஀-௿]/.test(text)) lang = 'ta'; else if (/[ऀ-ॿ]/.test(text)) lang = 'hi';
  S.chat.push({ role: 'user', text, lang, at: Date.now() });
  E.touch();
  const ctx = { agent: 'chat', source: BRAIN, said: text, cards: [] };
  let reply = '';
  if (AI_ON) {
    try {
      const history = S.chat.slice(-12);
      while (history.length && history[0].role !== 'user') history.shift();
      // leave out the offline-rules replies, so the AI does not copy their canned wording
      const messages = history.filter((m) => m.role === 'user' || m.source !== 'rules').map((m) => ({ role: m.role, content: maskPhones(m.text) }));
      const last = messages[messages.length - 1];
      // the language rule rides on his latest message: known script → that language; English letters → match this message
      if (last && last.role === 'user') last.content += lang === 'en'
        ? '\n\n[Answer in the language of THIS message: Tamil written in English letters (Tanglish) gets a Tamil answer in Tamil script, Hindi in English letters gets a Hindi answer in Devanagari, English gets English. Ignore the language of earlier messages. Short.]'
        : `\n\n[Answer only in ${LANG_NAMES[lang]}${lang === 'ta' ? ' (Tamil script)' : ' (Devanagari script)'}, even if earlier messages were in another language. Short.]`;
      reply = await runBrain({ system: CHAT_SYSTEM(lang), messages, tools: toolList(CHAT_TOOLS), ctx });
    } catch (e) {
      E.log({ agent: 'chat', source: 'rules', type: 'fallback', name: 'ai_error', input: '', output: e.message, ms: 0 });
    }
  }
  if (!reply) {
    ctx.source = 'rules';
    ctx.cards = [];
    reply = rulesChat(text, lang, ctx);
  }
  const at = Date.now();
  S.chat.push({ role: 'assistant', text: reply, lang, at, source: ctx.source, cards: ctx.cards || [] });
  if (S.chat.length > 40) S.chat.splice(0, S.chat.length - 40);
  E.touch();
  return { reply, source: ctx.source, cards: ctx.cards || [], lang, at };
}

// ---------------------------------------------------------------- rule-based chat (no API key)
const CAT_NAMES = {
  en: { stock: 'stock', rent: 'rent', electricity: 'electricity', salary: 'salary', transport: 'transport', phone: 'phone and internet', other: 'other costs' },
  ta: { stock: 'சரக்கு', rent: 'வாடகை', electricity: 'மின்சாரம்', salary: 'சம்பளம்', transport: 'போக்குவரத்து', phone: 'போன், இணையம்', other: 'மற்ற செலவு' },
  hi: { stock: 'माल', rent: 'किराया', electricity: 'बिजली', salary: 'वेतन', transport: 'ढुलाई', phone: 'फ़ोन, इंटरनेट', other: 'बाकी खर्च' },
};

const R = {
  help: {
    en: () => 'I am Voxa, your accountant. You can ask me: how were sales this week, what happened to a payment, explain the loan, or tell me your shop costs, like "this month rent 6k, electricity 4k", and I will make your profit dashboard.',
    ta: () => 'நான் Voxa, உங்கள் கணக்காளர். கேளுங்கள்: இந்த வார விற்பனை எப்படி, ஒரு பணம் என்ன ஆனது, கடனை விளக்குங்கள். அல்லது உங்கள் கடை செலவுகளைச் சொல்லுங்கள், உதாரணமாக "இந்த மாதம் வாடகை 6 ஆயிரம், கரண்ட் 4 ஆயிரம்". நான் லாப டாஷ்போர்டு உருவாக்குகிறேன்.',
    hi: () => 'मैं Voxa हूँ, आपका अकाउंटेंट। पूछिए: इस हफ्ते बिक्री कैसी रही, किसी पेमेंट का क्या हुआ, लोन समझाइए। या दुकान के खर्च बताइए, जैसे "इस महीने किराया 6 हज़ार, बिजली 4 हज़ार", मैं मुनाफे का डैशबोर्ड बना दूँगा।',
  },
  week: {
    en: (s, d) => `This week you sold ${rupee(s.total)}, ${s.changeVsPrevious >= 0 ? 'up' : 'down'} ${Math.abs(s.changeVsPrevious)}% on last week. Today so far ${rupee(d.total)} from ${d.bills} bills.`,
    ta: (s, d) => `இந்த வாரம் ${rupee(s.total)} விற்பனை, கடந்த வாரத்தை விட ${Math.abs(s.changeVsPrevious)}% ${s.changeVsPrevious >= 0 ? 'அதிகம்' : 'குறைவு'}. இன்று இதுவரை ${d.bills} பில்களில் ${rupee(d.total)}.`,
    hi: (s, d) => `इस हफ्ते ${rupee(s.total)} की बिक्री, पिछले हफ्ते से ${Math.abs(s.changeVsPrevious)}% ${s.changeVsPrevious >= 0 ? 'ज़्यादा' : 'कम'}। आज अब तक ${d.bills} बिलों में ${rupee(d.total)}।`,
  },
  month: {
    en: (s) => `Last 30 days: ${rupee(s.total)}, about ${rupee(s.averagePerDay)} a day, ${s.changeVsPrevious >= 0 ? 'up' : 'down'} ${Math.abs(s.changeVsPrevious)}% on the 30 days before.`,
    ta: (s) => `கடந்த 30 நாட்கள்: ${rupee(s.total)}, நாளொன்றுக்கு சுமார் ${rupee(s.averagePerDay)}. அதற்கு முந்தைய 30 நாட்களை விட ${Math.abs(s.changeVsPrevious)}% ${s.changeVsPrevious >= 0 ? 'அதிகம்' : 'குறைவு'}.`,
    hi: (s) => `पिछले 30 दिन: ${rupee(s.total)}, रोज़ करीब ${rupee(s.averagePerDay)}। उससे पहले के 30 दिनों से ${Math.abs(s.changeVsPrevious)}% ${s.changeVsPrevious >= 0 ? 'ज़्यादा' : 'कम'}।`,
  },
  loan: {
    en: (p) => `For ${rupee(p.amount)} over ${p.months} months, about ${rupee(p.daily)} is taken from your settlement each day, ${rupee(p.emi)} a month. With the rate a lender would likely give you, about ${p.rate}% a year, the total interest is ${rupee(p.totalInterest)}. After the fee and GST, ${rupee(p.received)} reaches your bank. Starting in ${p.start}, it ends in ${p.finish}. Most merchant plans let you close early with no charge, but check the Key Fact Statement.`,
    ta: (p) => `${rupee(p.amount)} கடன், ஆண்டுக்கு ${p.rate}% வட்டி, ${p.months} மாதங்கள் என்றால், மாதம் ${rupee(p.emi)} கட்ட வேண்டும், அதாவது தினமும் சுமார் ${rupee(p.daily)} செட்டில்மென்டில் எடுக்கப்படும். மொத்த வட்டி ${rupee(p.totalInterest)}. ${p.start}ல் தொடங்கினால் ${p.finish}க்குள் முடியும். ஒவ்வொரு மாதமும் கொஞ்சம் கூடுதலாகக் கட்டினால் சீக்கிரம் முடியும், ஆனால் சில நிறுவனங்கள் அதற்கு கட்டணம் வசூலிக்கும். இறுதி வட்டியை கடன் தரும் நிறுவனம் முடிவு செய்யும்.`,
    hi: (p) => `${rupee(p.amount)} का लोन, साल का ${p.rate}% ब्याज, ${p.months} महीने के लिए, तो हर महीने ${rupee(p.emi)} देने होंगे, यानी रोज़ करीब ${rupee(p.daily)} सेटलमेंट से कटेंगे। कुल ब्याज ${rupee(p.totalInterest)}। ${p.start} में शुरू करें तो ${p.finish} तक पूरा। हर महीने थोड़ा ज़्यादा दें तो जल्दी खत्म होगा, पर कुछ कंपनियाँ इसके लिए चार्ज लेती हैं। आख़िरी ब्याज दर लोन देने वाली कंपनी तय करती है।`,
  },
  loanActive: {
    en: (a) => `Your loan is running. You have paid back ${a.repaid} and ${a.left} is left. ${a.daily} comes out of your settlement each day, and it is finished by ${a.finish}.`,
    ta: (a) => `உங்கள் கடன் நடப்பில் உள்ளது. இதுவரை ${a.repaid} திருப்பிச் செலுத்தியுள்ளீர்கள், இன்னும் ${a.left} மீதம். தினமும் ${a.daily} செட்டில்மென்டில் எடுக்கப்படுகிறது. ${a.finish}க்குள் முடியும்.`,
    hi: (a) => `आपका लोन चल रहा है। अब तक ${a.repaid} चुका दिए, ${a.left} बाकी है। रोज़ ${a.daily} सेटलमेंट से कटते हैं, और ${a.finish} तक पूरा होगा।`,
  },
  slow: {
    en: (h) => `Between 2 and 5 PM your sales are about ${h.dropPercent}% lower than a normal hour. I suggest 10% off from 2 to 5 PM. Say yes and I will start it.`,
    ta: (h) => `மதியம் 2 முதல் 5 மணி வரை விற்பனை சாதாரண நேரத்தை விட சுமார் ${h.dropPercent}% குறைவு. 2 முதல் 5 மணி வரை 10% தள்ளுபடி தரலாம். சரி என்றால் நான் தொடங்குகிறேன்.`,
    hi: (h) => `दोपहर 2 से 5 बजे बिक्री आम घंटे से करीब ${h.dropPercent}% कम है। 2 से 5 बजे 10% छूट दीजिए। हाँ कहिए तो मैं शुरू कर दूँ।`,
  },
  offerOn: {
    en: () => 'Done. 10% off from 2 to 5 PM is live. Customers will see it when they pay you.',
    ta: () => 'முடிந்தது. மதியம் 2 முதல் 5 மணி வரை 10% தள்ளுபடி தொடங்கியது. வாடிக்கையாளர்கள் பணம் செலுத்தும்போது பார்ப்பார்கள்.',
    hi: () => 'हो गया। दोपहर 2 से 5 बजे 10% छूट शुरू हो गई। ग्राहक पेमेंट करते समय देखेंगे।',
  },
  noPending: {
    en: (t) => (t ? `No stuck payments right now. The last payment, ${rupee(t.amount)} from ${t.fromName}, is ${t.status}.` : 'No stuck payments right now, and no payments yet today.'),
    ta: (t) => (t ? `இப்போது சிக்கிய பணம் எதுவும் இல்லை. கடைசி பணம், ${t.fromName} இடமிருந்து ${rupee(t.amount)}, நிலை: ${t.status}.` : 'இப்போது சிக்கிய பணம் எதுவும் இல்லை.'),
    hi: (t) => (t ? `अभी कोई पेमेंट रुका नहीं है। आखिरी पेमेंट, ${t.fromName} से ${rupee(t.amount)}, स्थिति: ${t.status}।` : 'अभी कोई पेमेंट रुका नहीं है।'),
  },
  txn: {
    en: (t) => `${rupee(t.amount)} from ${t.fromName} at ${E.timeLabel(t.createdAt)}, UTR ${t.utr}: ${{ success: 'it reached you', pending: `it is stuck between banks and will reach you or go back by ${t.deadline}`, reversed: 'the bank sent it back to the customer', failed: 'it failed and no money moved' }[t.status] || t.status}.`,
    ta: (t) => `${t.fromName} இடமிருந்து ${rupee(t.amount)}, ${E.timeLabel(t.createdAt)}, UTR ${t.utr}: ${{ success: 'உங்களுக்கு வந்துவிட்டது', pending: `வங்கிகளுக்கு இடையில் சிக்கியுள்ளது, ${t.deadline}க்குள் உங்களுக்கு வரும் அல்லது திரும்பும்`, reversed: 'வங்கி வாடிக்கையாளருக்கு திருப்பி அனுப்பியது', failed: 'தோல்வியடைந்தது, பணம் எடுக்கப்படவில்லை' }[t.status] || t.status}.`,
    hi: (t) => `${t.fromName} से ${rupee(t.amount)}, ${E.timeLabel(t.createdAt)}, UTR ${t.utr}: ${{ success: 'आपको मिल गए', pending: `बैंकों के बीच रुके हैं, ${t.deadline} तक आपको मिलेंगे या वापस जाएँगे`, reversed: 'बैंक ने ग्राहक को लौटा दिए', failed: 'फेल हुआ, पैसे नहीं कटे' }[t.status] || t.status}।`,
  },
  costs: {
    en: (saved, p) => `${saved ? `Saved: ${saved}. ` : ''}This month you sold ${rupee(p.revenue)} so far. Costs are ${rupee(p.costTotal)}${p.loanPaid ? ` and loan payments ${rupee(p.loanPaid)}` : ''}, so ${rupee(p.left)} is left with you.${p.hasStock ? '' : ' Tell me what you spent on stock too, then this becomes your real profit.'}`,
    ta: (saved, p) => `${saved ? `சேமித்தேன்: ${saved}. ` : ''}இந்த மாதம் இதுவரை ${rupee(p.revenue)} விற்பனை. செலவுகள் ${rupee(p.costTotal)}${p.loanPaid ? `, கடன் தவணை ${rupee(p.loanPaid)}` : ''}. உங்களிடம் மீதம் ${rupee(p.left)}.${p.hasStock ? '' : ' சரக்கு வாங்கிய செலவையும் சொல்லுங்கள், அப்போது இது உண்மையான லாபமாகும்.'}`,
    hi: (saved, p) => `${saved ? `सेव किया: ${saved}। ` : ''}इस महीने अब तक ${rupee(p.revenue)} की बिक्री। खर्च ${rupee(p.costTotal)}${p.loanPaid ? `, लोन किस्त ${rupee(p.loanPaid)}` : ''}, तो आपके पास ${rupee(p.left)} बचे।${p.hasStock ? '' : ' माल खरीदने का खर्च भी बताइए, तब यह असली मुनाफा होगा।'}`,
  },
  eligible: {
    en: (p) => `From your Voxa Pay sales, you look eligible for a loan of up to about ${rupee(p.limit)}. You get about ${rupee(p.avgMonth)} a month, sales almost every day, and your business grew ${p.growth}%. A lender would likely charge about ${p.monthlyRate}% a month, that is ${p.rate}% a year, plus a ${p.feePct}% fee. The lender also checks your credit score, so open Business Loan in the Paytm for Business app to see the real offer.`,
    ta: (p) => `உங்கள் Voxa Pay விற்பனையைப் பார்த்தால், சுமார் ${rupee(p.limit)} வரை கடன் பெற தகுதி இருப்பது போல் தெரிகிறது. மாதம் சுமார் ${rupee(p.avgMonth)} வருகிறது, கிட்டத்தட்ட தினமும் விற்பனை, வியாபாரம் ${p.growth}% வளர்ந்துள்ளது. வட்டி மாதம் சுமார் ${p.monthlyRate}%, அதாவது ஆண்டுக்கு ${p.rate}%, கூடவே ${p.feePct}% கட்டணம். கடன் தருபவர் உங்கள் CIBIL மதிப்பெண்ணையும் பார்ப்பார், உண்மையான சலுகையை Paytm for Business செயலியில் Business Loan பகுதியில் பாருங்கள்.`,
    hi: (p) => `आपकी Voxa Pay बिक्री देखकर लगता है कि आप करीब ${rupee(p.limit)} तक के लोन के योग्य हैं। महीने में करीब ${rupee(p.avgMonth)} आते हैं, लगभग रोज़ बिक्री होती है, और बिज़नेस ${p.growth}% बढ़ा है। ब्याज करीब ${p.monthlyRate}% महीना, यानी ${p.rate}% सालाना, और ${p.feePct}% फीस। लोन देने वाला आपका CIBIL स्कोर भी देखेगा, असली ऑफर Paytm for Business ऐप के Business Loan में देखें।`,
  },
  noted: {
    en: (t) => `Noted. I put "${t}" on your Voxa notes page.`,
    ta: (t) => `குறித்துக்கொண்டேன். "${t}" ஐ உங்கள் Voxa குறிப்புகள் பக்கத்தில் வைத்துள்ளேன்.`,
    hi: (t) => `नोट कर लिया। "${t}" आपके Voxa नोट्स पेज पर है।`,
  },
  noCosts: {
    en: () => 'I have no costs for this month yet. Tell me, for example: "This month I paid 20k: rent 6k, electricity 4k, salary 8k".',
    ta: () => 'இந்த மாதத்துக்கான செலவுகள் இன்னும் இல்லை. உதாரணமாகச் சொல்லுங்கள்: "இந்த மாதம் 20 ஆயிரம் செலவு: வாடகை 6 ஆயிரம், கரண்ட் 4 ஆயிரம், சம்பளம் 8 ஆயிரம்".',
    hi: () => 'इस महीने का कोई खर्च अभी नहीं है। ऐसे बताइए: "इस महीने 20 हज़ार खर्च: किराया 6 हज़ार, बिजली 4 हज़ार, वेतन 8 हज़ार"।',
  },
};

// Spoken planner lines in the merchant's language
const FEST_NAMES = {
  ta: { Pongal: 'பொங்கல்', Deepavali: 'தீபாவளி', 'Tamil New Year': 'தமிழ் புத்தாண்டு', 'Vinayagar Chathurthi': 'விநாயகர் சதுர்த்தி' },
  hi: { Pongal: 'पोंगल', Deepavali: 'दिवाली', 'Tamil New Year': 'तमिल नव वर्ष', 'Vinayagar Chathurthi': 'विनायक चतुर्थी' },
};
const festName = (t, lang) => Object.entries(FEST_NAMES[lang] || {}).reduce((acc, [en, loc]) => acc.split(en).join(loc), t);
const PLAN_SAY = {
  quiet: {
    en: (x) => `${x.title}. ${x.text}`,
    ta: (x) => `மதியம் 2 முதல் 5 மணி வரை உங்கள் அமைதியான நேரம்: விற்பனை சாதாரண நேரத்தை விட சுமார் ${x.text.match(/(\d+)%/)[1]}% குறைவு. சரக்கு அடுக்க, வீட்டு டெலிவரி செய்ய அல்லது ஓய்வெடுக்க நல்ல நேரம்.`,
    hi: (x) => `दोपहर 2 से 5 बजे आपका शांत समय है: बिक्री आम घंटे से करीब ${x.text.match(/(\d+)%/)[1]}% कम। सामान भरने, होम डिलीवरी या आराम के लिए अच्छा समय।`,
  },
  festival: {
    en: (x) => `${x.title}. ${x.text}`,
    ta: (x) => `${festName(x.title, 'ta').replace(/ is in about (\d+) weeks/, ' இன்னும் சுமார் $1 வாரங்களில்')}. கடந்த ஆண்டு அந்த மாதம் உங்கள் சராசரி மாதத்தை விட அதிகம் விற்றது. சரக்கு வாங்க இரண்டு வாரம் முன்பே கூடுதல் பணம் தயாராக வையுங்கள். என்ன வாங்குவது என்பது உங்கள் முடிவு.`,
    hi: (x) => `${festName(x.title, 'hi').replace(/ is in about (\d+) weeks/, ' करीब $1 हफ्ते में है')}। पिछले साल उस महीने आपकी बिक्री औसत से ज़्यादा थी। माल खरीदने के लिए दो हफ्ते पहले से पैसे तैयार रखें। क्या खरीदना है, यह आपका फ़ैसला।`,
  },
  regulars: {
    en: (x) => `${x.title}. ${x.text}`,
    ta: (x) => `${x.title.replace(/ has not paid you in (\d+) days/, ' $1 நாட்களாக பணம் செலுத்தவில்லை')}. வழக்கமாக வந்தவர். எல்லாம் சரியா என்று ஒருமுறை விசாரிக்கலாம்.`,
    hi: (x) => `${x.title.replace(/ has not paid you in (\d+) days/, ' ने $1 दिन से पेमेंट नहीं किया')}। ये नियमित ग्राहक थे। एक बार हाल-चाल पूछ लीजिए।`,
  },
  avgbill: {
    en: (x) => `${x.title}. ${x.text}`,
    ta: (x) => `ஒரு வாடிக்கையாளர் ஒரு முறைக்கு செலவிடுவது: ${x.title.match(/₹[\d,]+/g).join(', முன்பு ')}. வாடிக்கையாளர் எண்ணிக்கை சரியாக உள்ளது, ஆனால் ஒவ்வொருவரும் கொஞ்சம் குறைவாக வாங்குகிறார்கள்.`,
    hi: (x) => `एक ग्राहक हर बार औसतन ${x.title.match(/₹[\d,]+/g).join(' खर्च करता है, पहले ')} था। ग्राहक उतने ही हैं, पर हर कोई थोड़ा कम खरीद रहा है।`,
  },
  stock: {
    en: (x) => `${x.title}. ${x.text}`,
    ta: (x) => `இந்த மாதம் வாங்கிய சரக்கு: ${(x.title.match(/₹[\d,]+/) || [''])[0]}. நீங்கள் காட்டிய பில்களை வைத்து மட்டும்.`,
    hi: (x) => `इस महीने खरीदा माल: ${(x.title.match(/₹[\d,]+/) || [''])[0]}। सिर्फ़ आपके दिखाए बिलों के आधार पर।`,
  },
};

// "This month I paid 20k: 6k rent, 4k electricity, 8k salary" → items + leftover as other
const CAT_WORDS = {
  rent: ['rent', 'வாடகை', 'किराया', 'kiraya'],
  electricity: ['electric', 'current', 'eb ', 'eb bill', 'power', 'மின்', 'கரண்ட்', 'बिजली', 'bijli'],
  salary: ['salary', 'salaries', 'staff', 'wage', 'helper', 'worker', 'சம்பளம்', 'வேலையாள்', 'वेतन', 'तनख्वाह', 'तनख़्वाह', 'मज़दूरी'],
  stock: ['stock', 'goods', 'purchase', 'supplier', 'wholesale', 'items', 'சரக்கு', 'சாமான்', 'கொள்முதல்', 'माल', 'सामान', 'खरीद'],
  transport: ['transport', 'delivery', 'petrol', 'diesel', 'auto', 'போக்குவரத்து', 'பெட்ரோல்', 'ढुलाई', 'पेट्रोल', 'भाड़ा'],
  phone: ['phone', 'mobile', 'internet', 'wifi', 'recharge', 'போன்', 'इंटरनेट', 'फ़ोन', 'फोन'],
  other: ['other', 'misc', 'extra', 'மற்ற', 'बाकी', 'अन्य'],
};
const TOTAL_WORDS = ['paid', 'spent', 'total', 'expense', 'cost', 'செலவு', 'கட்டின', 'மொத்தம்', 'खर्च', 'कुल', 'दिए', 'भरे'];
const UNIT_K = ['k', 'thousand', 'ஆயிரம்', 'हज़ार', 'हजार', 'hazar'];
const UNIT_L = ['lakh', 'lac', 'லட்சம்', 'लाख'];

function parseExpenses(text) {
  const segs = text.split(/[,;\n:]|\band\b|\bplus\b|மற்றும்|\sऔर\s/i).map((s) => s.trim()).filter(Boolean);
  const items = [];
  const loose = [];
  for (const seg of segs) {
    const m = seg.match(/(\d+(?:[.,]\d+)*)\s*(k\b|thousand|ஆயிரம்|हज़ार|हजार|hazar|lakh|lac|லட்சம்|लाख)?/i);
    if (!m) continue;
    let n = parseFloat(m[1].replace(/,/g, ''));
    const unit = (m[2] || '').toLowerCase();
    if (UNIT_K.includes(unit)) n *= 1000;
    if (UNIT_L.includes(unit)) n *= 100000;
    n = Math.round(n);
    if (!n) continue;
    const low = ' ' + seg.toLowerCase() + ' ';
    const cat = Object.keys(CAT_WORDS).find((c) => CAT_WORDS[c].some((w) => low.includes(w)));
    if (cat) items.push({ category: cat, amount: n });
    else loose.push({ amount: n, isTotal: TOTAL_WORDS.some((w) => low.includes(w)) });
  }
  const sum = items.reduce((s, x) => s + x.amount, 0);
  let total = null;
  for (const l of loose) {
    if (l.isTotal || l.amount > sum) total = Math.max(total || 0, l.amount);
    else items.push({ category: 'other', amount: l.amount });
  }
  const sum2 = items.reduce((s, x) => s + x.amount, 0);
  if (total && total > sum2) items.push({ category: 'other', amount: total - sum2 });
  return { items, total: total || sum2 };
}

const isCostTalk = (q) => [...Object.values(CAT_WORDS).flat().filter((w) => !['items', 'auto', 'other', 'extra'].includes(w)), ...TOTAL_WORDS].some((w) => q.includes(w));

function rulesChat(text, lang, ctx) {
  const S = E.getState();
  const q = ' ' + text.toLowerCase() + ' ';
  const has = (...w) => w.some((x) => q.includes(x));
  const hasNumber = /\d/.test(text);
  const card = (c) => { if (!ctx.cards.some((x) => x.type === c.type)) ctx.cards.push(c); };
  const lastBot = [...S.chat].reverse().find((m) => m.role === 'assistant');


  // "add it to the notes" / "save this": keep Voxa's last answer on the notes page
  const SAVE_WORDS = ['add it to note', 'add that to note', 'add this to note', 'add to note', 'add to my note', 'save it', 'save this', 'save that', 'put it in note', 'put that in note',
    'நோட்ல சேர்', 'நோட்டில் சேர்', 'குறிப்பில் சேர்', 'அதை சேமி', 'இதை சேமி', 'நோட்ஸ்ல', 'नोट में डाल', 'नोट में जोड़', 'इसे सेव', 'सेव कर'];
  if (has(...SAVE_WORDS) && text.length < 80) {
    const out = callTool('save_answer_to_notes', { which: 1 }, ctx);
    const said = { en: out.saved ? `Saved to your Voxa notes${out.title ? ': ' + out.title : ''}.` : 'There is nothing to save yet. Ask me something first.',
      ta: out.saved ? `Voxa குறிப்புகளில் சேமித்துவிட்டேன்${out.title ? ': ' + out.title : ''}.` : 'சேமிக்க இன்னும் எதுவும் இல்லை. முதலில் ஏதாவது கேளுங்கள்.',
      hi: out.saved ? `Voxa नोट्स में सेव कर दिया${out.title ? ': ' + out.title : ''}।` : 'अभी सेव करने को कुछ नहीं है। पहले कुछ पूछिए।' };
    return said[lang] || said.en;
  }

  // remember / note this (checked early: a reminder can mention money or payments)
  if (has('note this', 'note that', 'remember', 'remind', 'நினைவில்', 'குறித்துக்', 'याद', 'नोट कर')) {
    const body = text.replace(/^(please\s+)?(note this|note that|remember|remind me)( that| to)?[:,]?\s*/i, '').trim() || text;
    callTool('add_note', { title: body.slice(0, 60), text: body }, ctx);
    return R.noted[lang](body.slice(0, 60));
  }

  // shop planner: quiet hours, festivals, regular customers, average bill
  const plannerSay = (ids) => {
    const all = callTool('get_planner_insights', {}, ctx);
    const pick = E.plannerInsights().filter((x) => !ids || ids.includes(x.id));
    return pick.map((x) => PLAN_SAY[x.id] ? PLAN_SAY[x.id][lang](x) : x.title + '. ' + x.text).join(' ') || R.help[lang]();
  };
  if (has('regular', 'stopped coming', 'not coming', 'stopped paying', 'வழக்கமான', 'நிரந்தர', 'ரெகுலர்', 'नियमित', 'रेगुलर', 'आना बंद')) return plannerSay(['regulars']);
  if (has('festival', 'pongal', 'diwali', 'deepavali', 'பொங்கல', 'தீபாவளி', 'பண்டிகை', 'पोंगल', 'दिवाली', 'त्योहार')) return plannerSay(['festival']);
  if (has('average bill', 'per visit', 'spend per', 'சராசரி', 'औसत')) return plannerSay(['avgbill']);
  if (has('slow', 'afternoon', 'quiet', 'மதியம்', 'दोपहर')) return plannerSay(['quiet']);
  if (has('plan', 'advice', 'suggest', 'idea', 'grow', 'improve', 'what should i do', 'என்ன செய்ய', 'யோசனை', 'ஆலோசனை', 'सलाह', 'सुझाव', 'क्या करूँ')) return plannerSay(null);

  // cash sales told by voice or text → saved
  if (hasNumber && has('cash sale', 'sold in cash', 'in cash', 'ரொக்க', 'கேஷ்', 'கையில் வந்த', 'नकद', 'कैश')) {
    const amt = parseExpenses(text).items.reduce((s, x) => s + x.amount, 0);
    if (amt > 0) {
      callTool('record_cash_sales', { amount: amt }, ctx);
      const p = E.profitSummary();
      return {
        en: `Saved: cash sales ${rupee(amt)} this month. With ${rupee(p.paytmSales)} on Paytm, you sold ${rupee(p.revenue)}. ${rupee(p.left)} is left after costs.`,
        ta: `சேமித்தேன்: இந்த மாதம் ரொக்க விற்பனை ${rupee(amt)}. Paytm-இல் ${rupee(p.paytmSales)} சேர்த்து, மொத்தம் ${rupee(p.revenue)} விற்பனை. செலவுகள் போக ${rupee(p.left)} மிச்சம்.`,
        hi: `सेव किया: इस महीने नकद बिक्री ${rupee(amt)}। Paytm के ${rupee(p.paytmSales)} मिलाकर कुल ${rupee(p.revenue)} की बिक्री। खर्च के बाद ${rupee(p.left)} बचे।`,
      }[lang];
    }
  }

  // costs told by voice or text → saved, profit dashboard
  if (hasNumber && isCostTalk(q) && !has('loan', 'emi', 'கடன', 'लोन', 'utr', 'customer', 'வாடிக்கையாளர்', 'ग्राहक')) {
    const { items } = parseExpenses(text);
    if (items.length) {
      callTool('record_expenses', { items }, ctx);
      const names = CAT_NAMES[lang];
      const saved = items.map((x) => `${names[x.category]} ${rupee(x.amount)}`).join(', ');
      return R.costs[lang](saved, E.profitSummary());
    }
  }

  // profit / costs dashboard
  if (has('profit', 'cost', 'expense', 'spend', 'லாபம்', 'செலவு', 'मुनाफा', 'मुनाफ़ा', 'खर्च', 'दुकान का खर्च')) {
    const p = callTool('get_profit_summary', {}, ctx);
    card({ type: 'costs' });
    return p.entries ? R.costs[lang]('', p) : R.noCosts[lang]();
  }

  // a specific payment or a stuck payment
  const said = Number(((text.match(/\d[\d,]*/) || [''])[0]).replace(/,/g, ''));
  const txId = (text.match(/tx\s?\d{3,4}/i) || [''])[0].replace(/\s/, '').toUpperCase();
  if (txId || has('paid', 'pending', 'stuck', 'not received', 'customer says', 'payment', 'transaction', 'utr', 'வரவில்லை', 'அனுப்பி', 'செலுத்தி', 'பணம்', 'पैसे नहीं', 'भेज', 'नहीं आया', 'रुका', 'पेमेंट')) {
    card({ type: 'payments' });
    if (txId || (said && !has('pending', 'stuck', 'customer says'))) {
      const t = callTool('check_payment_status', txId ? { txn_id: txId } : { amount: said }, ctx);
      const found = txId ? E.findTxn(txId) : S.txns.find((x) => x.kind === 'payment' && x.amount === said);
      if (found && found.status !== 'pending') return R.txn[lang](found);
      if (!t || t.found === false) return R.noPending[lang](S.txns.find((x) => x.kind === 'payment'));
    }
    const pending = callTool('list_pending_payments', {}, ctx);
    if (pending.length) {
      const pick = pending.find((p) => p.amount === said) || pending[0];
      const t = E.findTxn(pick.txn_id);
      return msg('verify', lang, { amount: t.amount, name: t.fromName, time: E.timeLabel(t.debitedAt || t.createdAt), utr: t.utr, deadline: t.deadline }).text;
    }
    return R.noPending[lang](S.txns.find((x) => x.kind === 'payment'));
  }

  // can I get a loan?
  if (has('eligible', 'eligibility', 'qualify', 'can i get', 'how much loan', 'தகுதி', 'கிடைக்குமா', 'योग्य', 'पात्र', 'मिलेगा')) {
    callTool('check_loan_eligibility', {}, ctx);
    return R.eligible[lang](E.loanProfile());
  }

  // loan
  if (has('loan', 'emi', 'interest', 'கடன', 'லோன', 'வட்டி', 'लोन', 'कर्ज', 'क़र्ज़', 'ऋण', 'ब्याज')) {
    if (S.loan.status === 'active') {
      callTool('get_loan_offer', {}, ctx);
      return R.loanActive[lang]({ repaid: rupee(S.loan.repaid), left: rupee(S.loan.outstanding), daily: rupee(S.loan.daily), finish: S.loan.finish });
    }
    const amount = said >= 50000 ? said : undefined;
    callTool('get_loan_offer', { amount }, ctx);
    return R.loan[lang](E.loanPlan({ amount }));
  }

  if (has('month', 'மாத', 'महीन')) {
    card({ type: 'sales', period: '30' });
    return R.month[lang](callTool('get_sales_summary', { period: 'month' }, ctx));
  }
  if (has('sale', 'sold', 'week', 'today', 'income', 'business', 'dashboard', 'விற்பனை', 'வியாபார', 'வாரம்', 'இன்று', 'बिक्री', 'हफ्ते', 'आज', 'कमाई', 'डैशबोर्ड')) {
    card({ type: 'sales', period: '7' });
    const w = callTool('get_sales_summary', { period: 'week' }, ctx);
    return R.week[lang](w, E.salesToday());
  }
  return R.help[lang]();
}

// ---------------------------------------------------------------- bill reader (photo → costs)
// With a Claude key, Claude reads the photo itself (vision) and calls record_expenses.
// Offline, only the three sample bills drawn by the app can be read, from their known contents.
const SAMPLE_BILLS = {
  eb: { label: 'Electricity bill, Oct 2026 (sample)', items: [{ category: 'electricity', amount: 4180 }] },
  stock: { label: 'Wholesale stock invoice: rice, oil, dal, sugar (sample)', items: [{ category: 'stock', amount: 38650 }] },
  rent: { label: 'Shop rent receipt, Nov 2026 (sample)', items: [{ category: 'rent', amount: 6000 }] },
};
const BILL_TEXT = {
  read: {
    en: (label, saved) => `I read the bill: ${label}. Saved ${saved}.`,
    ta: (label, saved) => `பில்லைப் படித்தேன்: ${label}. சேமித்தேன்: ${saved}.`,
    hi: (label, saved) => `बिल पढ़ लिया: ${label}। सेव किया: ${saved}।`,
  },
  cannot: {
    en: () => 'I could not read that bill. Please take a clear photo of the printed bill, flat and in good light.',
    ta: () => 'அந்த பில்லைப் படிக்க முடியவில்லை. அச்சிட்ட பில்லை நேராக, நல்ல வெளிச்சத்தில் தெளிவாகப் படம் எடுங்கள்.',
    hi: () => 'वह बिल पढ़ नहीं पाया। छपे हुए बिल की सीधी, साफ़ फ़ोटो अच्छी रोशनी में लें।',
  },
  notBill: {
    en: () => 'That does not look like a bill, so I did not read it. Please send a photo of a printed bill or receipt only.',
    ta: () => 'இது பில் போல் தெரியவில்லை, அதனால் படிக்கவில்லை. அச்சிட்ட பில் அல்லது ரசீதின் படத்தை மட்டும் அனுப்புங்கள்.',
    hi: () => 'यह बिल जैसा नहीं लगता, इसलिए मैंने इसे नहीं पढ़ा। कृपया सिर्फ़ छपे बिल या रसीद की फ़ोटो भेजें।',
  },
};

export async function readBill({ image, mediaType = 'image/jpeg', sample = null, lang, thumb = null }) {
  const S = E.getState();
  lang = ['en', 'ta', 'hi'].includes(lang) ? lang : S.merchant.lang;
  const spoke = [...S.chat].reverse().find((m) => m.role === 'user' && m.lang);
  // follow him into Tamil or Hindi; never pull him back to English
  if (spoke && spoke.lang !== 'en' && spoke.lang !== lang) lang = spoke.lang;
  const known = sample && SAMPLE_BILLS[sample];
  S.chat.push({ role: 'user', text: known ? `📷 ${known.label}` : '📷 Bill photo', lang, at: Date.now(), thumb });
  E.touch();
  const ctx = { agent: 'chat', source: BRAIN, said: known ? known.label : 'Bill photo', cards: [] };
  E.log({ agent: 'chat', source: ctx.source, type: 'event', name: 'bill_photo', input: known ? sample : mediaType, output: image ? `${Math.round((image.length * 3) / 4 / 1024)} KB image` : '', ms: 0 });
  let reply = '';
  if (BRAIN !== 'claude' && SV.SARVAM_ON && image && !known) {
    try {
      ctx.source = 'sarvam';
      const t0 = Date.now();
      const r = await SV.readBillImage({ imageB64: image, mediaType, langName: LANG_NAMES[lang], categories: ['stock', 'rent', 'electricity', 'salary', 'transport', 'phone', 'other'] });
      E.log({ agent: 'chat', source: 'sarvam', type: 'model', name: SV.VISION_MODEL, input: 'bill photo', output: r.is_bill ? `bill: ${r.title || ''}` : `not a bill: ${r.reason || ''}`, ms: Date.now() - t0 });
      if (!r.is_bill) {
        reply = BILL_TEXT.notBill[lang]();
      } else {
        // only the bill's total counts, as one cost line; several bills in a month add up
        const total = Math.round(Number(r.total));
        const cats = ['stock', 'rent', 'electricity', 'salary', 'transport', 'phone', 'other'];
        const category = cats.includes(r.category) ? r.category : 'other';
        const title = String(r.title || 'Bill').slice(0, 40) + (r.shop && r.shop !== 'null' ? ` · ${String(r.shop).slice(0, 30)}` : '');
        if (total > 0 && total < 10000000) {
          E.addExpenses([{ category, amount: total, note: title }], { source: 'sarvam', said: `📷 ${title}: ${rupee(total)}`, replace: false });
          const ps = E.profitSummary();
          E.addBoardNote({ tag: 'dashboard', source: 'sarvam', card: { type: 'costs' }, title: `${title}: ${rupee(total)}`.slice(0, 80),
            text: `Saved under ${E.COST_CATEGORIES[category]}.${r.due_date && r.due_date !== 'null' ? ' Pay by ' + r.due_date + '.' : ''} This month's costs so far: ${rupee(ps.costTotal)}.` });
          ctx.cards = ctx.cards || [];
          if (!ctx.cards.some((c) => c.type === 'costs')) ctx.cards.push({ type: 'costs' });
          reply = (r.reply || '').trim() || BILL_TEXT.read[lang](title, rupee(total));
        } else {
          reply = BILL_TEXT.cannot[lang]();
        }
      }
    } catch (e) {
      E.log({ agent: 'chat', source: 'rules', type: 'fallback', name: 'ai_error', input: '', output: e.message, ms: 0 });
    }
  }
  if (BRAIN === 'claude' && image) {
    try {
      reply = await runClaude({
        system: CHAT_SYSTEM(lang),
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: `This is a photo of a bill or receipt for my shop. Read it. Save the shop running costs on it with record_expenses (choose the right category; use the total amount to pay). If it has a due date, save it with add_note. Then tell me in ${LANG_NAMES[lang]} what you read and saved, in one or two sentences.` },
        ] }],
        tools: toolList(['record_expenses', 'add_note', 'get_profit_summary']),
        ctx,
      });
    } catch (e) {
      E.log({ agent: 'chat', source: 'rules', type: 'fallback', name: 'ai_error', input: '', output: e.message, ms: 0 });
    }
  }
  if (!reply && known) {
    ctx.source = 'rules';
    callTool('record_expenses', { items: known.items }, ctx);
    const names = CAT_NAMES[lang];
    const saved = known.items.map((x) => `${names[x.category]} ${rupee(x.amount)}`).join(', ');
    reply = BILL_TEXT.read[lang](known.label, saved) + ' ' + R.costs[lang]('', E.profitSummary());
  }
  if (!reply) reply = BILL_TEXT.cannot[lang]();
  S.chat.push({ role: 'assistant', text: reply, lang, at: Date.now(), source: ctx.source, cards: ctx.cards || [] });
  if (S.chat.length > 40) S.chat.splice(0, S.chat.length - 40);
  E.touch();
  return { reply, source: ctx.source, cards: ctx.cards || [] };
}
