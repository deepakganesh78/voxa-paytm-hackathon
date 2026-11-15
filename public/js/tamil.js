// Puts the merchant's screens into Tamil.
// Pages are written in English; when the shop's language is Tamil, every text on screen that has a
// translation here is swapped, and swapped back for English. Voxa's chat and notes are already
// written in the chosen language, so anything inside [data-noi18n] is left alone.
window.VT = (() => {
  const D = {
    // sidebar and top bar
    'This screen': 'இந்தத் திரை', Screens: 'திரைகள்', Dashboard: 'முகப்புப் பலகை', Payments: 'பணம் வரவு', 'Sales insights': 'விற்பனை பார்வை',
    Loan: 'கடன்', 'Costs & profit': 'செலவும் லாபமும்', 'Voxa notes': 'Voxa குறிப்புகள்', 'Ask Voxa': 'Voxa-விடம் கேளுங்கள்', Home: 'முகப்பு',
    'Demo mode': 'டெமோ முறை', 'Reset demo': 'டெமோவை மீட்டமை', 'Shop owner · Deepak': 'கடை உரிமையாளர் · தீபக்',
    'Voxa agent runs in offline mode. Add a Claude key for full AI.': 'Voxa இப்போது ஆஃப்லைன் முறையில் இயங்குகிறது.',
    '· Voxa Pay for Business': '· Voxa Pay வணிகம்', '· Customer': '· வாடிக்கையாளர்', '· Bank': '· வங்கி', '· Merchant': '· வணிகர்', '· Support': '· உதவி',
    'Dashboard overview': 'முகப்புப் பலகை', 'Download report': 'அறிக்கை பதிவிறக்கு',
    // dashboard
    "Today's sales": 'இன்றைய விற்பனை', "Today's bills": 'இன்றைய பில்கள்', 'Average bill': 'சராசரி பில்',
    'on this time yesterday': 'நேற்று இதே நேரத்தை விட', 'on the 30-day average': '30 நாள் சராசரியை விட',
    'Settles tonight': 'இன்றிரவு வங்கிக்கு', 'Bank balance': 'வங்கி இருப்பு', 'vs period before': 'முந்தைய காலத்தை விட', 'vs last year': 'கடந்த ஆண்டை விட',
    'Sales overview': 'விற்பனை கண்ணோட்டம்', 'This period': 'இந்தக் காலம்', 'Period before': 'முந்தைய காலம்', 'Same month last year': 'கடந்த ஆண்டு அதே மாதம்',
    'Sales by time of day': 'நேரவாரியான விற்பனை', "Share of an average day's sales": 'ஒரு சாதாரண நாளின் விற்பனைப் பங்கு',
    'Morning, 7 AM–12': 'காலை, 7–12', 'Afternoon, 12–5 PM': 'மதியம், 12–5', 'Evening, 5–11 PM': 'மாலை, 5–11', 'a normal day': 'சாதாரண நாள்', 'paid to you today': 'இன்று உங்களுக்கு',
    "Today's payments": 'இன்றைய பணம்', 'Received, stuck and refunded, by amount': 'வந்தது, சிக்கியது, திரும்பியது (தொகைப்படி)',
    Received: 'வந்தது', Stuck: 'சிக்கியது', Refunded: 'திரும்பியது', 'Daily sales': 'தினசரி விற்பனை', 'Monthly sales': 'மாத விற்பனை',
    Date: 'தேதி', Bills: 'பில்கள்', Sales: 'விற்பனை', Month: 'மாதம்', Today: 'இன்று', Week: 'வாரம்',
    'Most recent earnings': 'சமீபத்திய வருமானம்', 'What reached you, what is stuck between banks and what went back': 'உங்களுக்கு வந்தது, வங்கிகளுக்கிடையே சிக்கியது, திரும்பியது',
    'Stuck now': 'இப்போது சிக்கியது', 'Recent payments': 'சமீபத்திய பணம்', 'Voxa updates': 'Voxa தகவல்கள்', 'in your language': 'உங்கள் மொழியில்',
    'Voxa posts payment alerts, fixes and tips here.': 'பணம் பற்றிய தகவல்களும் குறிப்புகளும் இங்கே வரும்.',
    Success: 'வெற்றி', Pending: 'நிலுவை', Failed: 'தோல்வி', Processing: 'நடக்கிறது', 'Waiting for bank': 'வங்கிக்காகக் காத்திருக்கிறது',
    'Payment stuck between banks': 'வங்கிகளுக்கிடையே சிக்கிய பணம்', 'Customer says paid: verify': 'வாடிக்கையாளர் செலுத்தினார்: சரிபார்',
    'Took cash instead': 'பணமாக வாங்கினேன்', 'Paid twice': 'இரண்டு முறை வந்தது', 'Voxa is checking this payment with the bank…': 'Voxa இந்தப் பணத்தை வங்கியுடன் சரிபார்க்கிறது…',
    'Bank debit': 'வங்கி பற்று', Murugan: 'முருகன்', Done: 'முடிந்தது', 'no reply': 'பதில் இல்லை', failed: 'தோல்வி',
    // payments
    'Received today': 'இன்று வந்தது', 'All payments today': 'இன்றைய அனைத்து பணமும்', 'Voxa is following up': 'Voxa கவனித்துக்கொள்கிறது', 'no money moved': 'பணம் நகரவில்லை',
    '0 payments': '0 பணம்', '1 payment': '1 பணம்',
    // insights
    'Best day': 'சிறந்த நாள்', 'Weakest day': 'குறைந்த நாள்', 'Best week': 'சிறந்த வாரம்', 'Weakest week': 'குறைந்த வாரம்', 'Best month': 'சிறந்த மாதம்', 'Weakest month': 'குறைந்த மாதம்',
    'Monthly sales, this year vs last year': 'மாத விற்பனை: இந்த ஆண்டு, கடந்த ஆண்டு', 'Same months a year before': 'கடந்த ஆண்டு அதே மாதங்கள்',
    'Voxa’s shop planner': 'Voxa கடைத் திட்டம்', 'Only from your payments and what you told Voxa. Voxa does not see your stock.': 'உங்கள் பணம் வரவும், நீங்கள் Voxa-விடம் சொன்னதும் மட்டும். Voxa உங்கள் சரக்கைப் பார்ப்பதில்லை.',
    '2 PM to 5 PM is your quiet time': 'மதியம் 2 முதல் 5 வரை அமைதியான நேரம்',
    'Sales in these hours are about 49% below a normal hour. A good time to restock, do home deliveries or take a break. Your helper may not be needed then.': 'இந்த நேரத்தில் விற்பனை சாதாரண நேரத்தை விட சுமார் 49% குறைவு. சரக்கு அடுக்க, வீட்டு டெலிவரி செய்ய அல்லது ஓய்வெடுக்க நல்ல நேரம். அப்போது உதவியாளர் தேவைப்படாமல் இருக்கலாம்.',
    'The number of customers is steady, but each one buys a little less. Worth watching over the next weeks.': 'வாடிக்கையாளர் எண்ணிக்கை சரியாக உள்ளது, ஆனால் ஒவ்வொருவரும் கொஞ்சம் குறைவாக வாங்குகிறார்கள். வரும் வாரங்களில் கவனிக்கலாம்.',
    'Based on: Average sales per hour, last 30 days': 'அடிப்படை: கடந்த 30 நாள் மணிநேர விற்பனை', 'Based on: Monthly sales, last 24 months': 'அடிப்படை: கடந்த 24 மாத விற்பனை',
    'Based on: Payments by the same UPI ID': 'அடிப்படை: ஒரே UPI ID-யிலிருந்து வந்த பணம்', 'Based on: Average bill, last 30 days vs the 30 before': 'அடிப்படை: சராசரி பில், கடந்த 30 நாள்',
    'Based on: Bills you showed or told Voxa': 'அடிப்படை: நீங்கள் காட்டிய பில்கள்',
    // loan
    'My loan': 'என் கடன்', 'Loan estimate calculator': 'கடன் மதிப்பீடு', 'You have no loan right now. Voxa checked your sales the way a lender would.': 'இப்போது உங்களுக்கு கடன் இல்லை. கடன் தருபவர் பார்ப்பது போல Voxa உங்கள் விற்பனையைச் சரிபார்த்தது.',
    'Likely rate': 'எதிர்பார்க்கும் வட்டி', Fee: 'கட்டணம்', '+ 18% GST, taken at the start': '+ 18% GST, தொடக்கத்தில் எடுக்கப்படும்', Repaid: 'திருப்பிச் செலுத்துவது',
    Daily: 'தினமும்', 'a small amount from settlement': 'செட்டில்மென்டில் சிறு தொகை', 'Credit score': 'கடன் மதிப்பெண்', Lender: 'கடன் தருபவர்', 'checks it, not Voxa': 'பார்ப்பார், Voxa அல்ல',
    'Active Voxa Pay for Business account': 'செயலில் உள்ள வணிகக் கணக்கு', 'Regular money coming in': 'தொடர்ந்து பணம் வருகிறது', 'Sales almost every day': 'கிட்டத்தட்ட தினமும் விற்பனை',
    'Business is growing': 'வியாபாரம் வளர்கிறது', 'KYC and bank account linked': 'KYC மற்றும் வங்கிக் கணக்கு இணைக்கப்பட்டது', 'See the estimate': 'மதிப்பீட்டைப் பார்',
    'Estimate only. The lender decides the real amount, rate and fee. Source:': 'இது மதிப்பீடு மட்டுமே. உண்மையான தொகை, வட்டி, கட்டணத்தை கடன் தருபவர் முடிவு செய்வார். ஆதாரம்:',
    'Loan amount': 'கடன் தொகை', Interest: 'வட்டி', 'a year': 'ஆண்டுக்கு', 'Pay every month': 'மாதத் தவணை', 'Total interest': 'மொத்த வட்டி', 'Loan finishes': 'கடன் முடிவது',
    'Take this loan': 'இந்தக் கடனை வாங்கு', 'Use Voxa\'s guess': 'Voxa மதிப்பீட்டைப் பயன்படுத்து', 'Settlements': 'செட்டில்மென்ட்கள்', 'nightly payout to your bank': 'தினமும் இரவு வங்கிக்கு',
    'No settlement yet today. It runs in the evening.': 'இன்று இன்னும் செட்டில்மென்ட் இல்லை. மாலையில் நடக்கும்.',
    'Loan taken': 'வாங்கிய கடன்', 'Taken every day': 'தினமும் எடுக்கப்படுவது', 'Interest rate': 'வட்டி விகிதம்', 'Paid back so far': 'இதுவரை திருப்பியது', Active: 'நடப்பில்',
    'a year, set by the lender': 'ஆண்டுக்கு, கடன் தருபவர் நிர்ணயிப்பது',
    // costs & notes
    'Voxa keeps this page for you': 'இந்தப் பக்கத்தை Voxa உங்களுக்காக நிரப்பும்',
    'Tell Voxa what it cost to run your shop this month: rent, electricity, salary, stock. Speak in your own language. Voxa builds your profit picture here.': 'இந்த மாதம் கடை நடத்த ஆன செலவை Voxa-விடம் சொல்லுங்கள்: வாடகை, மின்சாரம், சம்பளம், சரக்கு. உங்கள் மொழியில் பேசுங்கள். Voxa உங்கள் லாபக் கணக்கை இங்கே காட்டும்.',
    'Cost to run the shop': 'கடை நடத்தும் செலவு', 'Loan payments': 'கடன் தவணை', 'Left with you': 'உங்களிடம் மீதம்', 'money that came in': 'வந்த பணம்', 'taken from settlements': 'செட்டில்மென்டில் எடுத்தது',
    "Where this month's money went": 'இந்த மாதப் பணம் எங்கே போனது', 'Costs Voxa has noted': 'Voxa குறித்த செலவுகள்', 'What you told Voxa': 'நீங்கள் Voxa-விடம் சொன்னது',
    'Only Voxa updates this page. To change a cost, just tell Voxa the new amount.': 'இந்தப் பக்கத்தை Voxa மட்டுமே மாற்றும். செலவை மாற்ற புதிய தொகையை Voxa-விடம் சொல்லுங்கள்.',
    'Stock purchase': 'சரக்கு வாங்கியது', Rent: 'வாடகை', Electricity: 'மின்சாரம்', 'Staff salary': 'சம்பளம்', Transport: 'போக்குவரத்து', 'Phone & internet': 'போன், இணையம்', 'Other costs': 'மற்ற செலவு',
    "Voxa's notes for you": 'உங்களுக்கான Voxa குறிப்புகள்',
    'Voxa writes important things here: stuck payment deadlines, your loan, your monthly costs. You can also say “remember to pay the milk supplier on Friday”.': 'முக்கியமானவற்றை Voxa இங்கே எழுதும்: சிக்கிய பணத்தின் கடைசி தேதி, உங்கள் கடன், மாதச் செலவுகள். “வெள்ளிக்கிழமை பால் சப்ளையருக்கு பணம் கொடுக்க நினைவில் வை” என்றும் சொல்லலாம்.',
    // Ask Voxa
    'Sound off': 'ஒலி அணை', 'Sound on': 'ஒலி இயக்கு', Clear: 'அழி', 'Brain: offline rules · Voice: browser': 'ஆஃப்லைன் முறை · உலாவி குரல்',
    'Speak or type in Tamil, Hindi or English…': 'தமிழில் பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள்…',
    'Ask me anything about your shop, in Tamil, Hindi or English. Tap the mic and speak.': 'உங்கள் கடையைப் பற்றி எதையும் கேளுங்கள். மைக்கைத் தட்டி தமிழில் பேசுங்கள்.',
    'Open costs and profit': 'செலவும் லாபமும் திற', 'Open sales insights': 'விற்பனை பார்வை திற', 'Open my loan': 'என் கடன் திற', 'Open payments': 'பணம் வரவு திற', 'Open Voxa notes': 'குறிப்புகள் திற', 'Open insights': 'விற்பனை பார்வை திற',
    'Voxa · offline mode': 'Voxa · ஆஃப்லைன்', 'Voxa · Claude': 'Voxa · Claude', 'Voxa is thinking…': 'Voxa யோசிக்கிறது…',
  };
  const TA_WD = { Sun: 'ஞாயிறு', Mon: 'திங்கள்', Tue: 'செவ்வாய்', Wed: 'புதன்', Thu: 'வியாழன்', Fri: 'வெள்ளி', Sat: 'சனி' };
  const TA_MO = { Jan: 'ஜன', Feb: 'பிப்', Mar: 'மார்', Apr: 'ஏப்', May: 'மே', Jun: 'ஜூன்', Jul: 'ஜூலை', Aug: 'ஆக', Sep: 'செப்', Oct: 'அக்', Nov: 'நவ', Dec: 'டிச' };
  const FULL_MO = { Jan: 'ஜனவரி', Feb: 'பிப்ரவரி', Mar: 'மார்ச்', Apr: 'ஏப்ரல்', May: 'மே', Jun: 'ஜூன்', Jul: 'ஜூலை', Aug: 'ஆகஸ்ட்', Sep: 'செப்டம்பர்', Oct: 'அக்டோபர்', Nov: 'நவம்பர்', Dec: 'டிசம்பர்' };
  Object.assign(D, {
    'Voxa’s shop planner': 'Voxa கடை திட்டம்',
    'Only from your payments and what you told Voxa. Voxa does not see your stock.': 'உங்கள் பணப் பரிவர்த்தனைகளும் நீங்கள் Voxa-விடம் சொன்னவையும் மட்டும். உங்கள் சரக்கை Voxa பார்ப்பதில்லை.',
    'Recent payments': 'சமீபத்திய பணம்', 'The last 5 payments': 'கடைசி 5 பணம்', 'Every payment that came in today, newest first': 'இன்று வந்த எல்லா பணமும், புதியது முதலில்',
    'Time': 'நேரம்', 'From': 'யாரிடமிருந்து', 'Amount': 'தொகை', 'Status': 'நிலை', 'Success': 'வெற்றி', 'Pending': 'நிலுவையில்', 'Failed': 'தோல்வி', 'Refunded': 'திருப்பி அனுப்பப்பட்டது', 'On its way': 'வந்துகொண்டிருக்கிறது',
    'Where these numbers come from': 'இந்த எண்கள் எங்கிருந்து வருகின்றன',
    'Paytm sales': 'Paytm விற்பனை', 'Added automatically from every payment made to you on Paytm.': 'Paytm-இல் உங்களுக்கு வந்த ஒவ்வொரு பணத்திலிருந்தும் தானாகச் சேர்க்கப்படுகிறது.',
    'Cash sales and costs': 'ரொக்க விற்பனையும் செலவுகளும்', 'Only what you add below or tell Voxa. Voxa never guesses a number.': 'கீழே நீங்கள் சேர்ப்பதும் Voxa-விடம் சொல்வதும் மட்டும். Voxa எந்த எண்ணையும் ஊகிப்பதில்லை.',
    'Add it yourself': 'நீங்களே சேர்க்கவும்', 'Cash sales or a cost Paytm cannot see. Adding the same kind again for this month replaces it.': 'Paytm பார்க்க முடியாத ரொக்க விற்பனை அல்லது செலவு. இந்த மாதம் அதே வகையை மீண்டும் சேர்த்தால் பழையது மாறும்.',
    'Cash sales (not on Paytm)': 'ரொக்க விற்பனை (Paytm இல்லாமல்)', 'Stock purchase': 'சரக்கு வாங்கியது', 'Rent': 'வாடகை', 'Electricity': 'மின்சாரம்', 'Staff salary': 'சம்பளம்', 'Transport': 'போக்குவரத்து', 'Phone & internet': 'போன் & இணையம்', 'Other costs': 'மற்ற செலவுகள்',
    'Add': 'சேர்', 'Cash sales': 'ரொக்க விற்பனை', 'Only from Paytm': 'Paytm-இல் இருந்து மட்டும்',
    'You or Voxa can update this page. Adding the same kind of cost again replaces it.': 'நீங்களோ Voxa-வோ இந்தப் பக்கத்தை மாற்றலாம். அதே வகைச் செலவை மீண்டும் சேர்த்தால் பழையது மாறும்.',
  });
  const tr0 = (k) => D[k] || null;
  // patterns for text with numbers or names in it
  const P = [
    [/^Home \/ Murugan and Co \/ (.+)$/, (m) => `முகப்பு / முருகன் அண்ட் கோ / ${tr0(m[1]) || m[1]}`],
    [/^Last (\d+) days(.*)$/, (m) => `கடந்த ${m[1]} நாட்கள்${m[2]}`],
    [/^Last (\d+) months(.*)$/, (m) => `கடந்த ${m[1]} மாதங்கள்${m[2]}`],
    [/^last (\d+) (days|months)$/, (m) => `கடந்த ${m[1]} ${m[2] === 'days' ? 'நாட்கள்' : 'மாதங்கள்'}`],
    [/^Sales · (.+)$/, (m) => `விற்பனை · ${tr0(m[1]) || m[1].replace(/^Last (\d+) days$/, 'கடந்த $1 நாட்கள்').replace(/^Last (\d+) months$/, 'கடந்த $1 மாதங்கள்')}`],
    [/^vs the (\d+) days before$/, (m) => `முந்தைய ${m[1]} நாட்களை விட`],
    [/^The (\d+) days before$/, (m) => `முந்தைய ${m[1]} நாட்கள்`],
    [/^(\d+) (payment|payments)( · .*)?$/, (m) => `${m[1]} பணம்${m[3] ? ' · ' + (tr0(m[3].slice(3)) || m[3].slice(3)) : ''}`],
    [/^Daily sales for the last (\d+) days, next to the \d+ days before$/, (m) => `கடந்த ${m[1]} நாட்களின் தினசரி விற்பனை, அதற்கு முந்தைய ${m[1]} நாட்களுடன்`],
    [/^Monthly sales for the last (\d+) months, next to the same months a year before$/, (m) => `கடந்த ${m[1]} மாத விற்பனை, கடந்த ஆண்டு அதே மாதங்களுடன்`],
    [/^Weekly sales over the last 90 days$/, () => 'கடந்த 90 நாள் வாராந்திர விற்பனை'],
    [/^Daily sales, last (\d+) days vs the \d+ days before$/, (m) => `தினசரி விற்பனை: கடந்த ${m[1]} நாட்கள், முந்தைய ${m[1]} நாட்களுடன்`],
    [/^You look eligible for up to (₹[\d,]+)$/, (m) => `${m[1]} வரை கடன் பெற தகுதி இருப்பது போல் தெரிகிறது`],
    [/^a month · ([\d.]+)% a year$/, (m) => `மாதத்திற்கு · ஆண்டுக்கு ${m[1]}%`],
    [/^about (₹[\d,]+) a day$/, (m) => `தினமும் சுமார் ${m[1]}`],
    [/^plus (₹[\d,]+) one-time fee$/, (m) => `+ ஒரு முறை கட்டணம் ${m[1]}`],
    [/^(\d+) months$/, (m) => `${m[1]} மாதங்கள்`],
    [/^(₹[\d,]+) reached your bank$/, (m) => `${m[1]} வங்கிக்கு வந்தது`],
    [/^(₹[\d,]+) a month, from settlement$/, (m) => `மாதம் ${m[1]}, செட்டில்மென்டில் இருந்து`],
    [/^Sales · (\w+) (\d{4})$/, (m) => `விற்பனை · ${FULL_MO[m[1].slice(0, 3)] || m[1]} ${m[2]}`],
    [/^(\d+) kinds of cost$/, (m) => `${m[1]} வகைச் செலவுகள்`],
    [/^(\d+)% of sales$/, (m) => `விற்பனையில் ${m[1]}%`],
    [/^Try: (.+)$/, (m) => `முயற்சி: ${m[1]}`],
    [/^No live payments yet\. (\d+) bills came in earlier today \((₹[\d,]+)\)\.$/, (m) => `இன்னும் நேரடி பணம் இல்லை. இன்று முன்பு ${m[1]} பில்கள் வந்தன (${m[2]}).`],
    [/^Pongal is in about (\d+) weeks$/, (m) => `பொங்கல் இன்னும் சுமார் ${m[1]} வாரங்களில்`],
    [/^(.+) has not paid you in (\d+) days$/, (m) => `${m[1]} ${m[2]} நாட்களாக பணம் செலுத்தவில்லை`],
    [/^Customers spend (₹[\d,]+) a visit, down from (₹[\d,]+)$/, (m) => `ஒரு வாடிக்கையாளர் ஒரு முறைக்கு ${m[1]} செலவிடுகிறார், முன்பு ${m[2]}`],
    [/^from (.+) · (.+)$/, (m) => `${m[1]} இடமிருந்து · ${m[2]}`],
    [/^(₹[\d,]+) received$/, (m) => `${m[1]} வந்தது`],
    [/^(₹[\d,]+) (more|less) than (₹[\d,]+)$/, (m) => `${m[3]}ஐ விட ${m[1]} ${m[2] === 'more' ? 'அதிகம்' : 'குறைவு'}`],
    [/^(₹[\d,]+) · (\d+)% (above|below) average$/, (m) => `${m[1]} · சராசரியை விட ${m[2]}% ${m[3] === 'above' ? 'அதிகம்' : 'குறைவு'}`],
    [/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d+) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, (m) => `${TA_WD[m[1]]}, ${m[2]} ${TA_MO[m[3]]}`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/, (m) => `${TA_MO[m[1]]} ${m[2]}`],
    [/^(\d+) payments? · (₹[\d,]+)$/, (m) => `${m[1]} பணம் · ${m[2]}`],
    [/^(\d+):(\d+) (am|pm)$/i, (m) => `${m[1]}:${m[2]} ${/pm/i.test(m[3]) ? 'பிற்பகல்' : 'காலை'}`],
    [/^Paytm (₹[\d,]+) \+ cash (₹[\d,]+)$/, (m) => `Paytm ${m[1]} + ரொக்கம் ${m[2]}`],
  ];
  function tr(raw) {
    const k = raw.trim();
    if (!k) return null;
    const hit = tr0(k);
    if (hit) return raw.replace(k, hit);
    for (const [re, fn] of P) { const m = k.match(re); if (m) return raw.replace(k, fn(m)); }
    return null;
  }

  const orig = new WeakMap();
  let lang = 'en';
  function walk() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('svg, script, style, [data-noi18n]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n;
    while ((n = w.nextNode())) {
      if (lang === 'ta') {
        if (orig.has(n) && n.nodeValue === orig.get(n).out) continue;
        const t = tr(n.nodeValue);
        if (t !== null && t !== n.nodeValue) { orig.set(n, { src: n.nodeValue, out: t }); n.nodeValue = t; }
      } else if (orig.has(n)) {
        const o = orig.get(n);
        if (n.nodeValue === o.out) n.nodeValue = o.src;
        orig.delete(n);
      }
    }
    document.querySelectorAll('[placeholder]').forEach((el) => {
      if (!el.dataset.phEn) el.dataset.phEn = el.placeholder;
      el.placeholder = lang === 'ta' ? (tr(el.dataset.phEn) || el.dataset.phEn) : el.dataset.phEn;
    });
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
  }
  let queued = false;
  const obs = new MutationObserver(() => {
    if (queued || lang !== 'ta') return;
    queued = true;
    setTimeout(() => { queued = false; run(); }, 30); // not requestAnimationFrame: it pauses in background tabs
  });
  function run() {
    obs.disconnect();
    walk();
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  function set(l) { if (l === lang && l === 'en') return; lang = l; run(); }
  return { set, tr };
})();
