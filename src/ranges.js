// Time ranges in the merchant's words ("this week", "இந்த வாரம்", "is mahine", ...) -> exact dates.
// Dates are local calendar days (YYYY-MM-DD), the same as the sales history. Weeks run Monday to Sunday.

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const RANGE_KEYS = ['today', 'yesterday', 'this_week', 'last_week', 'last_7_days', 'this_month', 'last_month', 'last_30_days', 'last_90_days', 'last_6_months', 'last_12_months'];

const NAMES = {
  today: { en: 'Today', ta: 'இன்று', hi: 'आज' },
  yesterday: { en: 'Yesterday', ta: 'நேற்று', hi: 'कल' },
  this_week: { en: 'This week', ta: 'இந்த வாரம்', hi: 'इस हफ़्ते' },
  last_week: { en: 'Last week', ta: 'கடந்த வாரம்', hi: 'पिछले हफ़्ते' },
  last_7_days: { en: 'Last 7 days', ta: 'கடந்த 7 நாட்கள்', hi: 'पिछले 7 दिन' },
  this_month: { en: 'This month', ta: 'இந்த மாதம்', hi: 'इस महीने' },
  last_month: { en: 'Last month', ta: 'கடந்த மாதம்', hi: 'पिछले महीने' },
  last_30_days: { en: 'Last 30 days', ta: 'கடந்த 30 நாட்கள்', hi: 'पिछले 30 दिन' },
  last_90_days: { en: 'Last 90 days', ta: 'கடந்த 90 நாட்கள்', hi: 'पिछले 90 दिन' },
  last_6_months: { en: 'Last 6 months', ta: 'கடந்த 6 மாதங்கள்', hi: 'पिछले 6 महीने' },
  last_12_months: { en: 'Last 12 months', ta: 'கடந்த 12 மாதங்கள்', hi: 'पिछले 12 महीने' },
};

// Most specific first: "last week" must win over "week", "last month" over "month".
const PATTERNS = [
  ['last_12_months', /\b(last|past) (12 months|year|one year)\b|12 மாத|ஒரு வருட|पिछले (12 महीने|साल)|\bpichhle saal\b/i],
  ['last_6_months', /\b(last|past) (6|six) months\b|6 மாத|पिछले 6 महीने/i],
  ['last_90_days', /\b(last|past) (90 days|3 months|three months|quarter)\b|90 நாள|3 மாத|पिछले (90 दिन|3 महीने)/i],
  ['last_30_days', /\b(last|past) (30|thirty) days\b|30 நாள|पिछले 30 दिन/i],
  ['last_7_days', /\b(last|past) (7|seven) days\b|\bpast week\b|7 நாள|पिछले 7 दिन/i],
  ['last_week', /\b(last|previous|prev) week\b|போன வாரம்|கடந்த வாரம்|முந்தைய வாரம்|\b(pona|pona|kadandha|kadantha) vaaram\b|पिछले हफ़?्ते|पिछला हफ़?्ता|\bpichh?le hafte\b|\bpichh?la hafta\b/i],
  ['this_week', /\bthis week\b|\bcurrent week\b|\bweek so far\b|இந்த வாரம்|\b(indha|intha) vaaram\b|इस हफ़?्ते|\bis hafte\b|\bis week\b/i],
  ['last_month', /\b(last|previous|prev) month\b|போன மாதம்|கடந்த மாதம்|போன மாசம்|\b(pona|kadandha) (maasam|masam|maadham)\b|पिछले महीने|पिछला महीना|\bpichh?le mahine\b/i],
  ['this_month', /\bthis month\b|\bmonth so far\b|\bcurrent month\b|இந்த மாதம்|இந்த மாசம்|\b(indha|intha) (maasam|masam|maadham)\b|इस महीने|\bis mahine\b/i],
  ['yesterday', /\byesterday\b|நேற்று|நேத்து|\b(netru|nethu|nettu)\b|बीते कल|\bkal ki\b|\bkal ka\b|\bkal ke\b|कल की|कल का|कल के/i],
  ['today', /\btoday\b|\btill now today\b|இன்று|இன்னைக்கு|இன்றைக்கு|\b(inniki|innaiku|innikku|indru)\b|आज|\baaj\b/i],
];

export function detectRangeKey(text) {
  const t = String(text || '');
  for (const [key, re] of PATTERNS) if (re.test(t)) return key;
  return null;
}

const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Exact dates for a range key. `now` is injectable for tests.
export function rangeFromKey(key, now = new Date()) {
  if (!RANGE_KEYS.includes(key)) return null;
  const today = day0(now);
  let from = today, to = today;
  if (key === 'yesterday') from = to = addDays(today, -1);
  else if (key === 'this_week') from = addDays(today, -((today.getDay() + 6) % 7));
  else if (key === 'last_week') { const mon = addDays(today, -((today.getDay() + 6) % 7)); from = addDays(mon, -7); to = addDays(mon, -1); }
  else if (key === 'last_7_days') from = addDays(today, -6);
  else if (key === 'this_month') from = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (key === 'last_month') { from = new Date(today.getFullYear(), today.getMonth() - 1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); }
  else if (key === 'last_30_days') from = addDays(today, -29);
  else if (key === 'last_90_days') from = addDays(today, -89);
  else if (key === 'last_6_months') from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  else if (key === 'last_12_months') from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const days = Math.round((to - from) / 86400000) + 1;
  const span = days === 1 ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
  const name = NAMES[key];
  return {
    key, from: iso(from), to: iso(to), days, includesToday: iso(to) === iso(today),
    // a whole calendar month: monthly costs count in full instead of per day
    wholeMonth: key === 'this_month' || key === 'last_month',
    span,
    label: { en: `${name.en} (${span})`, ta: `${name.ta} (${span})`, hi: `${name.hi} (${span})` },
    name,
  };
}

// The range the merchant asked for, or null if he did not say one.
export function parseRange(text, now = new Date()) {
  const key = detectRangeKey(text);
  return key ? rangeFromKey(key, now) : null;
}

export const todayIso = (now = new Date()) => iso(day0(now));
export { iso as isoDay };
