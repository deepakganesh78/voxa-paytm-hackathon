// 182 days (26 weeks) of example sales for Murugan and Co, tuned so the numbers match the pitch deck:
// last 7 days = ₹84,500 (up 6% on the week before), last 30 days ≈ ₹11,875 a day,
// and a clear dip between 2 PM and 5 PM.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Average rupees per hour, 7 AM to 10 PM (index 0 = 7 AM).
const HOURLY_SHAPE = [520, 1150, 1380, 1240, 980, 820, 700, 430, 390, 450, 720, 1050, 1320, 1180, 760, 260];
const WEEKDAY = [1.15, 0.9, 0.93, 0.95, 0.98, 1.04, 1.1]; // Sun..Sat

function scaleRange(days, from, to, targetSum) {
  const cur = days.slice(from, to).reduce((s, d) => s + d.total, 0);
  const k = targetSum / cur;
  for (let i = from; i < to; i++) days[i].total = Math.round(days[i].total * k);
  const diff = targetSum - days.slice(from, to).reduce((s, d) => s + d.total, 0);
  days[to - 1].total += diff;
}

export function buildSeed() {
  const rand = rng(1511);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 182; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const base = 11000 * WEEKDAY[d.getDay()] * (0.92 + rand() * 0.16);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: iso, total: Math.round(base) });
  }
  const n = days.length;
  // last 7 days, previous 7 days, and the rest of the last 30 days
  scaleRange(days, n - 7, n, 84500);
  scaleRange(days, n - 14, n - 7, 79717);
  scaleRange(days, n - 30, n - 14, 11875 * 30 - 84500 - 79717);
  // average bill: about ₹188 before, slipping to about ₹176 in the last 30 days (people buy fewer items a visit)
  days.forEach((d, k) => { d.count = Math.round(d.total / (k >= n - 30 ? 176 : 188)); });

  const avg30 = Math.round(days.slice(n - 30).reduce((s, d) => s + d.total, 0) / 30);
  const shapeSum = HOURLY_SHAPE.reduce((a, b) => a + b, 0);
  const hourly = HOURLY_SHAPE.map((v, i) => ({ hour: 7 + i, avg: Math.round((v * avg30) / shapeSum) }));

  return { days, hourly, avg30, todaySoFar: 6240, todayBills: 34, todayList: buildTodayList(rand, 34, 6240), monthly: MONTHLY, regulars: buildRegulars(today, rand) };
}

// The 34 bills (₹6,240) that came in before the demo started, as rows with names, times and UPI references.
const WALKINS = ['Lakshmi Narayanan', 'Selvam', 'Arun Prakash', 'Priya S', 'Karthik R', 'Meena Devi', 'Rahul J', 'Anitha K', 'Suresh Babu', 'Divya M', 'Mohammed Irfan', 'Gopal V', 'Revathi', 'Vignesh', 'Saranya P', 'Joseph A'];
function buildTodayList(rand, count, total) {
  const now = Date.now();
  const amts = Array.from({ length: count }, () => 60 + rand() * 360);
  const k = total / amts.reduce((a, b) => a + b, 0);
  const rounded = amts.map((a) => Math.max(10, Math.round(a * k)));
  rounded[0] += total - rounded.reduce((a, b) => a + b, 0);
  let t = now - 4 * 60000;
  return rounded.map((amount, j) => {
    t -= Math.round((4 + rand() * 9) * 60000); // a bill every 4–13 minutes, going back in time
    const fromName = WALKINS[Math.floor(rand() * WALKINS.length)];
    return { id: 'TE' + String(j + 1).padStart(4, '0'), utr: '4317' + String(Math.floor(rand() * 1e8)).padStart(8, '0'), kind: 'payment', status: 'success', amount, fromName, toName: 'Murugan and Co', createdAt: t, earlier: true };
  });
}

// A few named regular customers, as a payment app sees them: name, UPI ID, and when and how much they paid.
// Two of them have stopped paying, so Voxa has someone to notice.
const REGULARS = [
  { name: 'Ravi Kumar', vpa: 'ravikumar@oksbi', every: 7, amount: 640, sinceDays: 130, stoppedDaysAgo: 23 },
  { name: 'Lakshmi Narayanan', vpa: 'lakshmi.n@okhdfcbank', every: 3, amount: 310, sinceDays: 175, stoppedDaysAgo: 0 },
  { name: 'Arun Prakash', vpa: 'arunp@ybl', every: 7, amount: 820, sinceDays: 160, stoppedDaysAgo: 0 },
  { name: 'Fathima Begum', vpa: 'fathima.b@okicici', every: 10, amount: 1150, sinceDays: 180, stoppedDaysAgo: 34 },
  { name: 'Selvam', vpa: 'selvam@paytm', every: 2, amount: 120, sinceDays: 95, stoppedDaysAgo: 0 },
];
function buildRegulars(today, rand) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return REGULARS.map((r) => {
    const visits = [];
    for (let ago = r.sinceDays; ago > r.stoppedDaysAgo; ago -= r.every) {
      const jitter = Math.round((rand() - 0.5) * 2); // ±1 day
      const d = new Date(today);
      d.setDate(d.getDate() - Math.max(r.stoppedDaysAgo + 1, ago + jitter));
      // every past payment keeps its 12-digit UPI reference (UTR/RRN), so it can be traced back
      const utr = '4' + String(Math.floor(rand() * 1e11)).padStart(11, '0');
      visits.push({ date: iso(d), amount: Math.round(r.amount * (0.8 + rand() * 0.4)), utr });
    }
    return { name: r.name, vpa: r.vpa, usualGap: r.every, visits };
  });
}

// Example monthly sales for the last 12 months (Dec 2025 – Nov 2026) and the same months a year
// earlier. Peaks: Pongal (Jan), Tamil New Year (Apr), Vinayagar Chathurthi (Aug), Deepavali (Oct/Nov).
// Dips: February and the summer heat (May–Jun).
const MONTHLY = (() => {
  const names = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  const thisYear = [342180, 438260, 286540, 325110, 361870, 294320, 271460, 308930, 366250, 349180, 472640, 518370];
  const lastYear = [296410, 381050, 258320, 291760, 312480, 270150, 243890, 279340, 318620, 305470, 444210, 362080];
  return names.map((m, k) => ({
    month: m,
    year: k === 0 ? 2025 : 2026,
    thisYear: thisYear[k],
    lastYear: lastYear[k],
  }));
})();
