// Voxa's skills: each skill is a job Voxa can do for the merchant, built from tools
// (functions Voxa calls on the shop's real data). With a Claude key, Claude picks the tools;
// without one, simple rules pick them. Sarvam handles the voice in and out.
export const SKILLS = [
  {
    id: 'sales', name: 'Sales answers', icon: 'chart-column',
    does: 'Answers any question about sales from the shop\'s own payment data: today, this week, best day, slow hours, festival months.',
    tools: ['get_sales_summary', 'get_hourly_pattern', 'show_dashboard'],
    data: '182 days of daily sales, 24 months of monthly sales, today\'s live payments',
    try: { en: 'How were sales this week?', ta: 'இந்த வார விற்பனை எப்படி?', hi: 'इस हफ्ते बिक्री कैसी रही?' },
  },
  {
    id: 'payments', name: 'Payment detective', icon: 'search-check',
    does: 'Finds any payment, explains a stuck one in plain words, files the bank complaint and tells both the shop and the customer the same facts.',
    tools: ['check_payment_status', 'list_pending_payments', 'create_ticket', 'notify_merchant', 'notify_customer'],
    data: 'Live payments with UTR, each step of the payment route, RBI T+5 deadline',
    try: { en: 'What happened to the ₹2,340 payment?', ta: '₹2,340 பணம் என்ன ஆனது?', hi: '₹2,340 पेमेंट का क्या हुआ?' },
  },
  {
    id: 'loan', name: 'Loan advisor', icon: 'hand-coins',
    does: 'Checks if the shop looks eligible, shows an estimated limit and rate, and explains the daily deduction, total interest and end date. Always says it is an estimate and the lender decides.',
    tools: ['check_loan_eligibility', 'get_loan_offer', 'get_settlements'],
    data: 'Monthly collections, sales consistency, growth, KYC status, settlement deductions',
    try: { en: 'Am I eligible for a loan?', ta: 'எனக்கு கடன் கிடைக்குமா?', hi: 'क्या मुझे लोन मिलेगा?' },
  },
  {
    id: 'costs', name: 'Cost and profit keeper', icon: 'piggy-bank',
    does: 'Listens to what it cost to run the shop (rent, electricity, salary, stock) and works out what is really left after costs and loan payments.',
    tools: ['record_expenses', 'get_profit_summary', 'show_dashboard'],
    data: 'Costs the merchant tells Voxa, this month\'s sales, loan deductions',
    try: { en: 'This month I paid 20k: rent 6k, electricity 4k, salary 8k', ta: 'இந்த மாதம் 20 ஆயிரம் செலவு: வாடகை 6 ஆயிரம், கரண்ட் 4 ஆயிரம், சம்பளம் 8 ஆயிரம்', hi: 'इस महीने 20 हज़ार खर्च: किराया 6 हज़ार, बिजली 4 हज़ार, वेतन 8 हज़ार' },
  },
  {
    id: 'bills', name: 'Bill reader', icon: 'scan-text',
    does: 'Reads a photo of a bill or receipt (electricity, wholesale stock, rent) and adds it to the shop\'s costs.',
    tools: ['read_bill_photo (Claude vision)', 'record_expenses', 'add_note'],
    data: 'A photo from the phone camera',
    try: { en: 'Tap the camera and take a photo of a bill', ta: 'கேமராவைத் தட்டி பில்லைப் படம் எடுங்கள்', hi: 'कैमरा दबाइए और बिल की फ़ोटो लीजिए' },
  },
  {
    id: 'dashboards', name: 'Dashboard maker', icon: 'layout-dashboard',
    does: 'Draws a small dashboard right inside the answer: sales chart, profit split, loan plan or recent payments, with a button to open the full page.',
    tools: ['show_dashboard'],
    data: 'Whatever the answer is about',
    try: { en: 'Show my profit', ta: 'என் லாபம் காட்டு', hi: 'मेरा मुनाफा दिखाओ' },
  },
  {
    id: 'notes', name: 'Notes keeper', icon: 'notebook-pen',
    does: 'Writes down what matters so the merchant can see it again: deadlines, the loan, monthly costs, and anything he says to remember.',
    tools: ['add_note'],
    data: 'Voxa notes page',
    try: { en: 'Remember to pay the milk supplier on Friday', ta: 'வெள்ளிக்கிழமை பால் சப்ளையருக்கு பணம் கொடுக்க நினைவில் வை', hi: 'याद रखो शुक्रवार को दूध वाले को पैसे देने हैं' },
  },
  {
    id: 'planner', name: 'Shop planner', icon: 'calendar-days',
    does: 'Suggests what to do from payment data only: quiet hours, getting money ready before festivals, regular customers who stopped paying, and average bill going up or down. It never guesses his stock.',
    tools: ['get_planner_insights', 'get_regular_customers', 'get_hourly_pattern'],
    data: 'Payments by hour, by month and by UPI ID; bills he showed Voxa',
    try: { en: 'Any advice for my shop?', ta: 'என் கடைக்கு ஏதாவது ஆலோசனை?', hi: 'मेरी दुकान के लिए कोई सलाह?' },
  },
  {
    id: 'voice', name: 'Speaks your language', icon: 'mic',
    does: 'Hears and answers in Tamil, Hindi or English. Sarvam Saaras turns speech into text; Sarvam Bulbul reads the answer aloud. The browser voice is the backup.',
    tools: ['Sarvam speech-to-text', 'Sarvam text-to-speech'],
    data: 'The merchant\'s voice',
    try: { en: 'Tap the mic and speak', ta: 'மைக்கைத் தட்டி பேசுங்கள்', hi: 'माइक दबाइए और बोलिए' },
  },
];
