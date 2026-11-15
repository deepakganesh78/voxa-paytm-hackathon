# Voxa Sandbox

The live demo for **Voxa, the AI accountant for merchants**: Paytm Build for India AI Hackathon, Chennai, 15 Nov 2026.
Team: Naveen Roshan · Deepak Ganesh · Patnam Sanjeevi.

One website with four screens and fake money. Everyone opens the same link on their own laptop or phone.

| Screen | Link | Who | Device |
|---|---|---|---|
| **Voxa Pay** (customer app) | `/pay` | Sanjeevi | phone |
| **Voxa Bank** (bank + NPCI switch) | `/bank` | Deepak | laptop |
| **Voxa Pay for Business** (Murugan's shop + Voxa AI) | `/business` | Deepak | phone + laptop |
| **Voxa Support** (payment company console) | `/support` | Naveen | laptop |

The home page `/` has a QR code for each screen. Scan one to open that screen on a phone.

**What Voxa can do, with examples:** see [WHAT-VOXA-CAN-DO.md](WHAT-VOXA-CAN-DO.md).

---

## 1. Run it on your laptop (2 minutes)

Needs Node.js 20 or newer.

```bash
cd voxa-sandbox
npm install
npm start
```

Open http://localhost:3000. With no API keys it runs in **offline mode**: Voxa answers with built-in rules in English, Tamil and Hindi. Every demo works this way.

## 2. Turn on the real AI (each person uses their own key)

Copy `.env.example` to a new file named `.env` in this folder and fill in your own key. `.env` is private: git ignores it, so it is never pushed. Restart `npm start` after changing it. **Restarting clears the demo data**, so set the key first.

```
SARVAM_API_KEY=your-sarvam-key
```

| Variable | What it does |
|---|---|
| `SARVAM_API_KEY` | Voxa's **brain** is Sarvam `sarvam-105b` with tool calling: it decides what to look up, saves costs and notes, and answers in Tamil. It **reads bill photos** with a Sarvam image model, **listens** with Saaras and **speaks** with Bulbul. Reasoning is off and replies are short, to save credits (about ₹0.05 a question). |
| `ANTHROPIC_API_KEY` | Optional. If set, Claude is the brain instead of Sarvam. |
| `VOXA_BRAIN` | Optional: `sarvam`, `claude` or `rules` to force one. |
| `VOXA_EVENTS_AI` | Optional. `off` keeps automatic stuck-payment handling on the free rules, so only questions you ask use credits. |
| `SARVAM_VISION_MODEL` | Optional. Default `gemma4` for bill photos. |
| `RESET_PIN` | Optional. If set, "Reset demo" asks for this PIN. |
| `SARVAM_BUDGET_RUPEES` | Optional. Default 20. After about this many rupees of AI in one server run, Voxa switches to the free rules. |
| `SARVAM_MAX_PER_MIN` | Optional. Default 20 AI calls a minute. |

**Bill photos are checked on the phone first, for free.** Only a photo that looks like a printed or written bill (mostly white paper with text, no face, not colourful) is sent to the AI. Everything else is stopped before it leaves the phone, and the AI is also told to refuse anything that is not a bill.

**Safety limits:** at most 4 AI calls per question (the last one must answer), the same tool is never run twice for one question, the agent can only use the tools it is given (it can write only notes and costs, and never messages customers), every call times out after 45 seconds, and the spend cap and per-minute limit above stop runaway costs.

If an AI call fails (no internet, no credits), Voxa falls back to the built-in rules, so the demo never freezes. The support console's agent log shows which one ran (`sarvam`, `claude` or `rules`), with the tokens used.

## 3. Put it online (Render, free)

1. Create a new **private** GitHub repo and push the `voxa-sandbox` folder to it:
   ```bash
   cd voxa-sandbox
   git init
   git add .
   git commit -m "Voxa sandbox"
   git branch -M main
   git remote add origin https://github.com/<you>/voxa-sandbox.git
   git push -u origin main
   ```
2. Go to render.com → **New → Web Service** → connect the repo.
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: Free works. The $7 Starter plan never sleeps, which is safer on demo day.
3. Under **Environment**, add `ANTHROPIC_API_KEY`, `SARVAM_API_KEY` and `RESET_PIN`.
4. Deploy. You get a link like `https://voxa-sandbox.onrender.com`. Send it to Sanjeevi and Deepak.

There is also a `render.yaml`, so **New → Blueprint** works too.

**Important on the free plan:** the app sleeps after 15 minutes with no visitors, and waking up takes about a minute. Sleeping also **resets all demo data**. Open the link 5 minutes before you present, and keep one screen open.

> All data lives in memory. It resets when the server restarts or when you press **Reset demo** in Voxa Support. Press Reset right before you go on stage.

---

## 4. Before going on stage (checklist)

- [ ] Naveen presses **Reset demo** on `/support`.
- [ ] Each person opens their screen. The green dot in the top bar means it is live.
- [ ] Deepak taps **Sound off → Sound on** on `/business` (browsers only play sound after a tap), and picks **தமிழ்**.
- [ ] Mic: use **Chrome** for voice input. Allow microphone access once.
- [ ] Turn phone volume up. Connect Deepak's phone or laptop to the speaker if there is one.
- [ ] Have a phone hotspot ready in case the venue Wi-Fi is bad.

---

## 5. The five demos (who clicks what)

### Demo 1: Normal sale + Tamil soundbox (30 s)
1. **Sanjeevi** (`/pay`): tap ₹340 → Pay → any 4-digit PIN. The phone shows "Waiting for your bank…".
2. **Deepak** (`/bank`): the payment appears under **Incoming payments**. Click **Go through**.
3. **Deepak** (`/business`): the soundbox card flashes and Voxa speaks in Tamil.
> Say: *"Every payment is announced in the shop's language. Now watch what happens when it goes wrong."*

### Demo 2: The argument at the counter (the main demo, 90 s)
1. **Sanjeevi** (`/pay`): pay ₹1,000.
2. **Deepak** (`/bank`): under **Incoming payments**, click **Time out**. Sanjeevi's app shows **Payment pending · Amount debited**.
3. **Act it out:** Sanjeevi: "I paid!" Deepak (Murugan): "Nothing came!"
4. Within ~3 seconds Voxa tells Murugan, out loud in Tamil: the ₹1,000 is stuck at the bank, and it will reach him or go back by the deadline. It opens a ticket that waits for the bank. Voxa never messages Sanjeevi; his own app shows the status.
5. Murugan insists, so **Sanjeevi pays ₹1,000 again** and **Deepak** clicks **Go through**. Voxa notices the same customer paid the same amount twice and writes it in **Voxa notes**: "Sanjeevi paid ₹1,000 twice today. If the stuck one also arrives, give ₹1,000 back."
6. **Deepak** (`/bank`): **Credit merchant (late)** on the stuck one. Voxa: **"You were paid twice. Give ₹1,000 back to Sanjeevi."** Murugan taps the button to return it.
   - Or **Reverse**: Voxa says the money went back to Sanjeevi and they already paid again, so nothing to do.
   - If Sanjeevi had **not** paid again and the money goes back, Voxa says: "you were not paid for that sale; ask Sanjeevi to pay again", and reminds Murugan the next day until Sanjeevi pays.
7. **Naveen** (`/support`): the ticket is under **Closed by Voxa alone**. Open it to show every step Voxa took.
8. *Optional:* leave a stuck payment and press **1 day passes**. Voxa hands it to support: the bank had a day to fix it on its own.
> Say: *"The payment didn't fail. Trust at the counter failed. Voxa settles it in seconds, remembers what happened, and makes sure nobody ends up paying twice."*

### Demo 3: Big amount goes to a human (60 s)
1. **Sanjeevi** (`/pay`): pay ₹18,500. **Deepak** (`/bank`): click **Time out** on it.
2. **Naveen** (`/support`): ticket in **Needs you**, with Voxa's summary already written. Click **Chase bank to resolve today**.
3. **Deepak** (`/bank`): the request appears under *Requests from Voxa Support*. Click **Credit merchant**.
4. Voxa closes it and tells Murugan.
> Say: *"Above ₹10,000, Voxa doesn't decide alone. The support agent gets a ready summary instead of a phone call."*

### Demo 4: Ask Voxa in Tamil (45 s)
1. **Deepak** (`/business`): tap 🎤 and say *"இந்த வார விற்பனை எப்படி?"* ("How were sales this week?"), or tap the chip.
2. Voxa answers aloud: ₹84,500, up 6%.
3. Ask *"என் கடைக்கு ஏதாவது ஆலோசனை?"* ("Any advice for my shop?"). Voxa's shop planner answers: 2–5 PM is quiet, Pongal is in about 9 weeks (last January was 21% above an average month), Fathima Begum and Ravi Kumar stopped paying, and the average bill slipped from ₹188 to ₹176.
4. Open **Sales insights** to show the same planner cards, each with what it is based on.
> Say: *"Voxa tells him when money comes in, when he'll need it, and who stopped coming. What to stock stays his call."*

### Demo 5: Loan analysis in simple words (60 s)
1. **Deepak** (`/business` → **Loan**): set ₹1,50,000, 12 months, 24% a year. The page shows:
   - five cards: amount, interest, ₹14,184 a month (about ₹473 a day), total interest ₹20,206, paid off by Nov 2027;
   - a sales check: last year, this year and the loan year (estimate);
   - one bar per month: the month's sales, with the loan part (principal and interest) on top;
   - the same plan in simple words, in Tamil, Hindi or English.
2. Move **Pay extra each month** to ₹5,000: it finishes in Aug 2027 and saves ₹5,419 in interest. Point at the warning: some lenders charge for prepayment.
3. Tap **Take this loan**, then **Deepak** (`/bank`) **Run settlement now**: ₹473 is taken for the loan.
4. *Optional:* tick **takes the loan repayment twice** and run settlement again (after one more payment). Voxa catches the wrong deduction, and **Naveen** clicks **Refund extra**.
> Say: *"Voxa checks the shop's real sales before it lends, and explains the loan in the merchant's own language. The ranges and the EMI formula come from a public summary of Paytm business loans (businessesblaze.com/paytm-business-loan). The lender sets the final rate."*

### Demo 6: Costs and profit, built by voice (45 s)
1. **Deepak** (`/business` → **Ask Voxa**): tap the mic and say *"இந்த மாதம் 20 ஆயிரம் செலவு: வாடகை 6 ஆயிரம், கரண்ட் 4 ஆயிரம், சம்பளம் 8 ஆயிரம்"*, or tap that chip.
2. Voxa saves rent, electricity, salary and the remaining ₹2,000 as other costs, and draws a profit card in the chat.
3. Tap **Open costs and profit**: sales this month, cost to run the shop, loan payments, and what is left.
4. Say *"This month stock 1 lakh"*: the profit becomes real.
> Say: *"Payment apps only see money coming in. Voxa also learns what it costs to run the shop, just by listening, and turns it into a profit page nobody had to type."*

---

## 6. How it works

```
 Voxa Pay (/pay) ─┐                         ┌─ Voxa Pay for Business (/business)
 Voxa Bank (/bank)┼── one Node.js server ───┼─ Voxa Support (/support)
                  │   fake-money engine      │
                  │   + Voxa agent           │   live updates over Server-Sent Events
                  └──────────┬───────────────┘
                             │
          Claude (tool calling)   Sarvam Bulbul (voice)   Chrome speech recognition (ta-IN / hi-IN)
```

- `src/engine.js`: accounts, the 5-step payment chain (Voxa Pay → Voxa Bank debit → NPCI switch → merchant credit → confirmation), timeouts, late credit or reversal, settlements, loan, tickets.
- `src/agent.js`: the Voxa agent. Its tools are `check_payment_status`, `create_ticket` (files UDIR, starts the T+5 clock), `notify_merchant`, `notify_customer`, `get_sales_summary`, `get_hourly_pattern`, `create_offer`, `get_loan_offer`, `share_status_with_customer`, `check_settlement`. Hard rules are enforced in code: ₹10,000+ and every settlement or deduction problem goes to a human.
- `src/seed.js`: 90 days of example sales, tuned to the numbers in the pitch deck.
- `src/i18n.js`: ready-made Tamil, Hindi and English messages for offline mode.

**Compared with the pitch deck:** the agent, voice, languages, ticketing and data model are the same. Forecasting uses the 30-day average with ±20% cases instead of Prophet. Monitoring is the built-in agent log instead of Langfuse. The backend is Node/Express instead of FastAPI, so it runs as one small service.

Voxa Pay, Voxa Bank and Voxa Support are made-up demo brands. No real money, banks or customer data are involved.
