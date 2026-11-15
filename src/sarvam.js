// Sarvam AI as Voxa's brain: chat with tool calling (sarvam-105b) and reading bill photos (an image model).
// Docs: https://docs.sarvam.ai/api-reference-docs/chat/completions and https://docs.sarvam.ai/api/getting-started/pricing
// Credits are precious, so: reasoning is off, replies are short, and every call is counted.

const KEY = process.env.SARVAM_API_KEY || '';
export const SARVAM_ON = !!KEY;
export const CHAT_MODEL = process.env.SARVAM_CHAT_MODEL || 'sarvam-105b';
export const VISION_MODEL = process.env.SARVAM_VISION_MODEL || 'gemma4';

// ₹ per 1M tokens (input, output), from the pricing page. Used only for the on-screen estimate.
const PRICE = {
  'sarvam-105b': [15, 60], 'sarvam-105b-conversations': [15, 60],
  gemma4: [35, 90], 'glm5.3-flash': [13.5, 45], 'deepseekv4.1-flash-1017': [14, 55],
};
export const chatUsage = { calls: 0, inTokens: 0, outTokens: 0, rupees: 0, images: 0, errors: 0, blocked: 0 };

// Guards so a test session can never run away with the credits:
// - a spend cap for this server run (SARVAM_BUDGET_RUPEES, default ₹20): after it, Voxa uses the free rules
// - at most SARVAM_MAX_PER_MIN calls a minute (default 20)
export const BUDGET = Number(process.env.SARVAM_BUDGET_RUPEES || 20);
const PER_MIN = Number(process.env.SARVAM_MAX_PER_MIN || 20);
const recent = [];
function guard() {
  if (chatUsage.rupees >= BUDGET) { chatUsage.blocked++; throw new Error(`Sarvam budget of ₹${BUDGET} for this run is used up, using free rules`); }
  const now = Date.now();
  while (recent.length && now - recent[0] > 60000) recent.shift();
  if (recent.length >= PER_MIN) { chatUsage.blocked++; throw new Error('Too many AI calls this minute, using free rules'); }
  recent.push(now);
}

function count(model, usage) {
  chatUsage.calls++;
  if (!usage) return;
  const [pi, po] = PRICE[model] || [35, 90];
  chatUsage.inTokens += usage.prompt_tokens || 0;
  chatUsage.outTokens += usage.completion_tokens || 0;
  chatUsage.rupees = Math.round((chatUsage.rupees + ((usage.prompt_tokens || 0) * pi + (usage.completion_tokens || 0) * po) / 1e6) * 10000) / 10000;
}

// One call to the chat completions API. sarvam-105b is on /v1; the other models are served on /v2.
export async function complete(body) {
  if (!KEY) throw new Error('No SARVAM_API_KEY');
  guard();
  const url = body.model === 'sarvam-105b' || body.model === 'sarvam-105b-conversations'
    ? 'https://api.sarvam.ai/v1/chat/completions' : 'https://api.sarvam.ai/v2/chat/completions';
  const send = (b) => fetch(url, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
    signal: AbortSignal.timeout(45000),
  });
  let res = await send(body);
  // some models refuse reasoning_effort: retry once without it
  if (res.status === 400 && 'reasoning_effort' in body) {
    const { reasoning_effort, ...rest } = body;
    res = await send(rest);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    chatUsage.errors++;
    const m = (data.error && (data.error.message || data.error.code)) || res.statusText;
    throw new Error(`Sarvam ${res.status}: ${m}`);
  }
  count(body.model, data.usage);
  return data;
}

// Anthropic-style tool list → OpenAI-style functions, which Sarvam expects.
export const toFunctions = (tools) => tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));

// The agent loop: ask, run the tools it picks, give it the results, repeat until it answers.
// No endless loops: at most maxTurns model calls per question, the last one must answer (tool_choice none),
// and the same tool with the same input is never run twice in one question.
export async function runSarvam({ system, messages, tools, callTool, ctx, log, maxTurns = 4 }) {
  const convo = [{ role: 'system', content: system }, ...messages];
  const fns = tools && tools.length ? toFunctions(tools) : undefined;
  const seen = new Map();
  for (let turn = 0; turn < maxTurns; turn++) {
    const t0 = Date.now();
    const last = turn === maxTurns - 1;
    const res = await complete({
      model: CHAT_MODEL, messages: convo, tools: fns, tool_choice: fns ? (last ? 'none' : 'auto') : undefined,
      reasoning_effort: null, temperature: 0.2, max_tokens: 700,
    });
    const m = (res.choices && res.choices[0] && res.choices[0].message) || {};
    const calls = m.tool_calls || [];
    log({ agent: ctx.agent, source: 'sarvam', type: 'model', name: res.model || CHAT_MODEL, input: `turn ${turn + 1}`, output: `${calls.length ? calls.length + ' tool call(s)' : 'answer'} · ${res.usage ? res.usage.total_tokens + ' tokens' : ''}`, ms: Date.now() - t0 });
    if (!calls.length) return clean(m.content || '');
    convo.push({ role: 'assistant', content: m.content || '', tool_calls: calls });
    for (const c of calls) {
      let args = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch { args = {}; }
      const sig = c.function.name + JSON.stringify(args);
      const allowed = (tools || []).some((t) => t.name === c.function.name);
      const out = !allowed ? { error: 'That tool is not available here.' } : seen.has(sig) ? { note: 'Already done above. Use that result and answer now.' } : callTool(c.function.name, args, ctx);
      seen.set(sig, true);
      convo.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(out).slice(0, 6000) });
    }
  }
  return '';
}

// Remove any thinking text or markdown the model may still add; the reply is read aloud.
function clean(s) {
  return String(s).replace(/<think>[\s\S]*?<\/think>/g, '').replace(/[*#`_]+/g, '').replace(/\n{2,}/g, '\n').trim();
}

// Read one bill photo. Returns { is_bill, reason, items:[{category, amount}], due_date, title, reply }.
export async function readBillImage({ imageB64, mediaType, langName, categories }) {
  chatUsage.images++;
  const prompt = `You help a small shop owner in India keep his accounts. Look at this image.
First decide: is it a bill, receipt, invoice or payment slip printed or written on paper (or a screenshot of one)? If it shows a person, a face, an animal, a scene, or anything that is not a bill, set is_bill to false and do not read anything else.
If it is a bill, do NOT list or add up the items. Read only the final amount paid or to pay (grand total / net amount / amount payable). Choose ONE category for the whole bill from: ${categories.join(', ')}. Use "stock" for a supermarket, grocery or wholesale purchase bill, "electricity" for an EB/power bill, "rent" for rent receipts, "other" if unsure.
Reply with JSON only, no other text:
{"is_bill": true|false, "reason": "short reason in English", "title": "what the bill is, in English, 2 to 4 words, e.g. Grocery bill, EB bill", "shop": "shop or company name on the bill, or null", "total": 1234, "category": "stock", "due_date": "DD Mon YYYY or null", "reply": "one short spoken sentence in ${langName}: what bill and its total"}`;
  const res = await complete({
    model: VISION_MODEL,
    messages: [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageB64}`, detail: 'low' } },
      { type: 'text', text: prompt },
    ] }],
    reasoning_effort: 'none', temperature: 0, max_tokens: 300,
  });
  // keep underscores here: the JSON keys need them
  const text = String(((res.choices || [])[0] || {}).message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try { return JSON.parse(json); } catch { throw new Error('Could not read the bill reply'); }
}
