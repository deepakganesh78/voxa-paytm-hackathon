# What Voxa can do

Voxa is the AI accountant inside **Voxa Pay for Business** (Murugan's shop screen, `/business`).
It works only for the shop owner. Its brain is **Gemini** (or Claude / Sarvam) with tool calling: it decides what to look up, calls the tools, then answers.
Common questions (profit, sales, loans, Udhaar, weak days) are answered straight from the app data without an AI call, so they are instant and work offline.
Without a key, or if the AI fails, the same tools run on built-in rules, so the demo never stops.

## The app is built around Voxa

- **Home** is the landing screen: a big ask bar (type, mic, camera), suggestion chips, today's briefing (stuck payments, Udhaar due, sales vs yesterday, a cost jump, regulars who stopped, loan eligibility, each with one tap), and a compact row of key numbers.
- **The Copilot** stays docked beside every screen on a computer (drag its edge to resize, close it from the sparkle button) and never covers the screen an answer refers to. On a phone it is a composer at the bottom of every screen with a big mic, opening into a sheet. **Ask Voxa** in the menu opens the full conversation view with past chats.
- **Ctrl/Cmd+K** opens a command bar anywhere: go to a screen or ask Voxa.
- **Menu**: Home, Ask Voxa, Money (Sales, Payments, Costs & profit, Loan), Customers (Customers & Udhaar, Messages), Insights, Notes, Settings. Every screen has its own address (`#/costs?range=this_week`), so the back button and links work.
- **Answers are cards**: Sales (chart), Profit, Customer list, Loan offer (sliders for amount and months), Payments, Insight and Confirm cards, in Tamil, Hindi or English, each with an "Open in …" link. Voxa can also open a screen with a filter, for example "show weak sales days" opens Sales insights with the weak days highlighted.
- **Time ranges are exact**: today, yesterday, this week (Monday to today), last week, last 7 days, this month, last month, last 30/90 days, last 6/12 months, in all three languages. Every period answer says which period it used. Monthly bills (rent, electricity, salary, phone) are counted per day for part of a month.
- **Nothing changes without your OK**: costs, cash sales, Udhaar entries, reminders to customers, support tickets, offers and loan applications appear as a Confirm card (amounts can be edited, people unticked). On Telegram the same request comes with Confirm / Cancel buttons.
- **Voxa knows where you are**: the screen, its filters and the selected customer go with every question, and the suggestion chips change per screen.
- **Hands-free voice**: switch it on next to the send button (or in Settings); speak, Voxa answers aloud, then listens again.
- **Settings**: dark mode, hands-free, Developer (shows which AI and voice answered), the demo screens and Reset demo.

---

## 1. Answer questions about the shop, from live data

Every question starts from a live snapshot of the shop: today's money, every payment and its status, anything stuck, money owed, open tickets, this month's costs, the loan and the notes. Voxa brings up anything urgent even if you did not ask.

| Ask | What Voxa does |
|---|---|
| "How were sales this week?" | Sales total, change, best and weakest day, plus a sales dashboard |
| "What happened to Sanjeevi's ₹2,340?" | Checks that payment: stuck, done late, gone back, and what happens next |
| "Any stuck payments today?" | Lists them, with when each will be fixed |
| "Show my profit" | Sales, costs, loan payments and what is left this month |
| "Any advice for my shop?" | Quiet hours, the next festival, regular customers who stopped paying, average bill |
| "Can I get a loan of 1 lakh?" | Eligibility check and a loan plan in simple words |

## 2. Keep the books (the only things Voxa can change)

Voxa can write to **Costs & profit**, **Voxa notes**, **Udhaar**, **support tickets**, **offers** and a **loan application**, and every one of these waits for your Confirm tap. It never changes sales or payments.

| Say or do | Result |
|---|---|
| "This month rent 6k, electricity 4k, salary 8k" | A Confirm card; saved as costs when you tap it |
| "I sold 30 thousand in cash this month" | A Confirm card for cash sales |
| 📷 or 📎 **Upload** a bill photo | Reads only the bill's **total** and offers to save it as one cost line |
| "Remind everyone who owes me" | A Confirm card listing each customer and their message; sent only after you confirm |
| "Remember to pay the milk supplier on Friday" | A note |
| "Add it to the notes" / "அதை நோட்ல சேர்" | Saves Voxa's last answer to notes, with its dashboard |

You can also add costs and cash sales by hand on the Costs & profit page.

## 3. Build dashboards

Voxa shows a small dashboard under its answers, and can build and keep dashboards in Voxa notes.

| Say | Result |
|---|---|
| "Make me a 30-day sales line chart and keep it" | New dashboard saved in notes |
| "Show my costs as a donut" | Costs dashboard as a donut |
| "Change the supermarket note's graph to columns" | Changes that note's dashboard |

Looks: costs as **strip, donut, columns or table**; sales as **columns, line or table**. Each dashboard in notes also has a switch to change the look by hand.

## 4. Watch payments and handle problems on its own

| What happens | What Voxa does |
|---|---|
| A payment is stuck at the bank | Tells Murugan at once, opens a ticket and waits **1 day** for the bank to fix it |
| The bank fixes it | Closes the ticket and tells Murugan ("Closed by Voxa alone") |
| Not fixed in 1 day, or ₹10,000+ | Hands the ticket to a person at support, with a ready summary |
| The customer pays again because the first is stuck | Notices the repeat payment and writes it in notes |
| The stuck one also arrives later | "You were paid twice. Give ₹1,000 back to Sanjeevi" (with a return button) |
| The stuck one goes back and the customer never paid again | "Ask Sanjeevi to pay again", and reminds him the next day |
| Settlement held, or too much taken for the loan | Ticket for a person straight away |

Each message to Murugan is written by Sarvam from the real facts, in his language.

## 5. Report a problem to support

Say "report this", "raise a ticket" or "something is wrong with Sanjeevi's payment". Voxa checks the payments, writes a short summary for support (who, how much, when, what each side says, what to check) and raises a ticket. It shows on the support screen as **Reported by Murugan · Needs a person**, and a note with the ticket number appears in Voxa notes. Support's reply comes back to Murugan's app.

## 5b. Brief the support agent when a customer reports a payment

In the customer's payment app (`/pay`), any payment can be reported with a reason: money left but the shop did not get it, paid twice, waiting for a refund, or something else.

- Support gets a ticket at once (**Reported by customer · Needs a person**). If a ticket for that payment is already open, the report is added to it and it goes to a person.
- **Voxa writes a brief for the support agent**, shown first in the ticket: what happened and where the money is now, the same customer's other payments today (paid again, cash, returned), what the customer says, what Voxa already did, and the one thing to check now.
- The same brief is written for every ticket that reaches a person: ₹10,000+, not fixed in a day, settlement holds, wrong loan deductions, Murugan's own reports. The agent can press **Refresh** for a new one.
- If Sarvam is down, a plain brief is built from the same facts.

## 5c. Customers on Telegram (demo) / WhatsApp (production): loyalty card and Udhaar

**Channel for the demo: Telegram bot** (free, official Bot API). Set `TELEGRAM_BOT_TOKEN` (from @BotFather) and `WA_PROVIDER=telegram` in `.env`. The poster QR opens the bot; the customer taps **Start**, taps YES to link their payment, and taps **Share my phone number** so Udhaar is kept under their real number. Buttons in the chat: YES / NO / SKIP, CARD, BALANCE, PAID 100, STOP. Voxa checks Telegram for new messages itself, so no public link is needed.

**Why not WhatsApp in the demo:** the official WhatsApp Business API (Meta, or Twilio on top of it) needs a verified business and a payment method before a number can message customers. The code for it is built (`WA_PROVIDER=meta` or `twilio`); switching is one setting. Linking a personal WhatsApp like WhatsApp Web (`WA_PROVIDER=linked`) also exists but is unofficial and was refused by WhatsApp in testing.

Everything below works the same on any channel.

### Customers on WhatsApp: details

Messages go to **real WhatsApp numbers** through Twilio. There is no pretend chat on screen: if Twilio is not set up, nothing is sent and the Customers page says "Not connected".

**Joining (zero typing):** Murugan prints the **Smart QR poster** from the **Customers & Udhaar** page. The customer scans it, WhatsApp opens with a message already typed, they tap **Send**. WhatsApp gives Voxa their number and name. If they just paid by UPI, Voxa asks "Was your payment just now ₹340 at 3:12 PM? YES / NO / SKIP": YES links their UPI name so visits count automatically. People who never use UPI can still join (SKIP) for Udhaar.

**7-day loyalty card:** each day a linked customer pays at the shop adds one dot (max one a day; no reset if they miss a day). After every payment they get "Your card: ●●●○○○○ (3 of 7)" on WhatsApp. At 7 they get the reward Murugan set on the Customers page (default ₹50 off), and a new card starts.

**Udhaar (store credit), tied to the phone number, not UPI:**
- Murugan tells Voxa "Suresh 2000 udhar, keep it in log" or uses **+ Udhaar** on the page. Suresh gets "₹2,000 added to your Udhaar. Total due: ₹2,000" on WhatsApp.
- "Can I give Suresh ₹2,000 credit?" → Voxa's **credit check**: score, risk, suggested limit and yes / careful / no, from his visits, how he paid back before and what he owes now.
- Paying back: the customer replies "PAID 500", or pays by UPI while owing. **Murugan must confirm** (on the page under "Waiting for your OK", or by replying CONFIRM on his own WhatsApp). Only then the balance drops and the customer gets the new balance. Murugan can also record a cash repayment with **Paid back**.

**Customer replies:** CARD (their loyalty card), BALANCE (Udhaar due), PAID 500, STOP (leave: their number, link, card and Udhaar are deleted; Murugan is told what they owed).

**Murugan's own WhatsApp updates** (switch on/off on the Customers page): daily summary at a time he picks, stuck payment alerts, and Udhaar paid-back requests. "Send a test message" and "Send today's update now" buttons.

**Setting up Twilio (once):** sign up at twilio.com → Messaging → Try it out → Send a WhatsApp message. Each test phone sends the sandbox join code to +1 415 523 8886. Add to `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`, restart. For replies from phones to reach Voxa, set the sandbox's "When a message comes in" URL to `https://<your public link>/api/whatsapp/incoming`.

## 6. Talk in Tamil, Hindi or English

- **Speak:** tap 🎤. Sarvam turns speech into text and detects the language. The text goes into the box first, so you can fix it, send it, or clear it with ✕.
- **Answers in your language:** Voxa answers in the language of your latest message (Tamil, also Tamil typed in English letters → Tamil; Hindi → Hindi; English → English).
- **Voice back:** if you spoke, Voxa answers aloud in a female voice (Sarvam Bulbul v3, "Kavitha").
- **Short answers:** one or two sentences, straight to the point. Ask for detail if you want more.

## 7. Chats

- **Chats** list on the left of Ask Voxa: open an old chat, or delete it.
- **New chat** keeps the old one.
- **Save to notes** under every answer.

## 8. Safety limits

- At most 4 AI calls per question; the last one must answer. The same tool never runs twice for one question.
- Voxa can only use the tools it is given for that job.
- Spend cap per server run (`SARVAM_BUDGET_RUPEES`, default ₹20) and 20 AI calls a minute; after that, free rules answer.
- Bill photos are checked on the phone first, for free: faces, scenes, colourful photos and blank pages are stopped before anything is sent. Sarvam also refuses anything that is not a bill.
- Every AI step is shown in the agent log on the support screen (`/support`).

## Rough cost (Sarvam)

| Action | About |
|---|---|
| A question | ₹0.04 – 0.15 |
| A message Voxa writes by itself | under ₹0.01 |
| A bill photo | ₹0.03 |
| A spoken reply | ₹0.4 – 0.6 |
| Speech to text | ₹0.49 a minute |
