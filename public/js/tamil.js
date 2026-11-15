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
  const H = {
    'This screen': 'यह स्क्रीन', Screens: 'स्क्रीन', Dashboard: 'डैशबोर्ड', Payments: 'भुगतान', 'Sales insights': 'बिक्री की जानकारी',
    Loan: 'लोन', 'Costs & profit': 'खर्च और मुनाफ़ा', 'Voxa notes': 'Voxa के नोट्स', 'Ask Voxa': 'Voxa से पूछें', Home: 'होम',
    'Demo mode': 'डेमो मोड', 'Reset demo': 'डेमो रीसेट करें', 'Shop owner · Deepak': 'दुकान के मालिक · दीपक',
    'Voxa agent runs in offline mode. Add a Claude key for full AI.': 'Voxa अभी ऑफ़लाइन मोड में चल रहा है।',
    '· Voxa Pay for Business': '· Voxa Pay व्यापार', '· Customer': '· ग्राहक', '· Bank': '· बैंक', '· Merchant': '· व्यापारी', '· Support': '· सहायता',
    'Dashboard overview': 'डैशबोर्ड का सारांश', 'Download report': 'रिपोर्ट डाउनलोड करें',
    "Today's sales": 'आज की बिक्री', "Today's bills": 'आज के बिल', 'Average bill': 'औसत बिल',
    'on this time yesterday': 'कल इसी समय के मुकाबले', 'on the 30-day average': '30 दिनों के औसत के मुकाबले',
    'Settles tonight': 'आज रात बैंक में आएगा', 'Bank balance': 'बैंक बैलेंस', 'vs period before': 'पिछली अवधि के मुकाबले', 'vs last year': 'पिछले साल के मुकाबले',
    'Sales overview': 'बिक्री का सारांश', 'This period': 'यह अवधि', 'Period before': 'पिछली अवधि', 'Same month last year': 'पिछले साल का यही महीना',
    'Sales by time of day': 'दिन के समय के अनुसार बिक्री', "Share of an average day's sales": 'औसत दिन की बिक्री का हिस्सा',
    'Morning, 7 AM–12': 'सुबह, 7–12', 'Afternoon, 12–5 PM': 'दोपहर, 12–5', 'Evening, 5–11 PM': 'शाम, 5–11', 'a normal day': 'सामान्य दिन', 'paid to you today': 'आज आपको मिला',
    "Today's payments": 'आज के भुगतान', 'Received, stuck and refunded, by amount': 'मिली, अटकी और लौटाई गई रकम',
    Received: 'मिला', Stuck: 'अटका', Refunded: 'लौटाया', 'Daily sales': 'रोज़ की बिक्री', 'Monthly sales': 'महीने की बिक्री',
    Date: 'तारीख', Bills: 'बिल', Sales: 'बिक्री', Month: 'महीना', Today: 'आज', Week: 'हफ़्ता',
    'Most recent earnings': 'हाल की कमाई', 'What reached you, what is stuck between banks and what went back': 'आप तक पहुँचा पैसा, बैंकों में अटका पैसा और लौटाई गई रकम',
    'Stuck now': 'अभी अटका', 'Recent payments': 'हाल के भुगतान', 'Voxa updates': 'Voxa की जानकारी', 'in your language': 'आपकी भाषा में',
    'Voxa posts payment alerts, fixes and tips here.': 'भुगतान की जानकारी, सुधार और सुझाव यहाँ दिखेंगे।',
    Success: 'सफल', Pending: 'लंबित', Failed: 'विफल', Processing: 'प्रक्रिया में', 'Waiting for bank': 'बैंक का इंतज़ार',
    'Payment stuck between banks': 'भुगतान बैंकों के बीच अटका है', 'Customer says paid: verify': 'ग्राहक ने भुगतान कहा है: जाँचें',
    'Took cash instead': 'इसके बजाय नकद लिया', 'Paid twice': 'दो बार भुगतान हुआ', 'Voxa is checking this payment with the bank…': 'Voxa बैंक से इस भुगतान की जाँच कर रहा है…',
    'Bank debit': 'बैंक से कटौती', Murugan: 'मुरुगन', Done: 'हो गया', 'no reply': 'जवाब नहीं', failed: 'विफल',
    'Received today': 'आज मिला', 'All payments today': 'आज के सभी भुगतान', 'Voxa is following up': 'Voxa जानकारी ले रहा है', 'no money moved': 'पैसा नहीं गया',
    '0 payments': '0 भुगतान', '1 payment': '1 भुगतान',
    'Best day': 'सबसे अच्छा दिन', 'Weakest day': 'सबसे कम बिक्री वाला दिन', 'Best week': 'सबसे अच्छा हफ़्ता', 'Weakest week': 'सबसे कम बिक्री वाला हफ़्ता', 'Best month': 'सबसे अच्छा महीना', 'Weakest month': 'सबसे कम बिक्री वाला महीना',
    'Monthly sales, this year vs last year': 'महीने की बिक्री: इस साल और पिछले साल', 'Same months a year before': 'पिछले साल के यही महीने',
    'Voxa’s shop planner': 'Voxa की दुकान की योजना', 'Only from your payments and what you told Voxa. Voxa does not see your stock.': 'सिर्फ़ आपके भुगतानों और Voxa को बताई जानकारी के आधार पर। Voxa आपका स्टॉक नहीं देखता।',
    '2 PM to 5 PM is your quiet time': 'दोपहर 2 से 5 बजे तक बिक्री का शांत समय है',
    'The number of customers is steady, but each one buys a little less. Worth watching over the next weeks.': 'ग्राहकों की संख्या स्थिर है, लेकिन हर ग्राहक थोड़ा कम खरीद रहा है। अगले कुछ हफ़्तों तक इस पर नज़र रखें।',
    'Based on: Average sales per hour, last 30 days': 'आधार: पिछले 30 दिनों की प्रति घंटे औसत बिक्री',
    'Based on: Monthly sales, last 24 months': 'आधार: पिछले 24 महीनों की मासिक बिक्री',
    'Based on: Payments by the same UPI ID': 'आधार: एक ही UPI ID से आए भुगतान',
    'Based on: Average bill, last 30 days vs the 30 before': 'आधार: पिछले 30 दिनों और उससे पहले के 30 दिनों का औसत बिल',
    'Based on: Bills you showed or told Voxa': 'आधार: आपके दिखाए या बताए बिल',
    'My loan': 'मेरा लोन', 'Loan estimate calculator': 'लोन का अनुमान', 'You have no loan right now. Voxa checked your sales the way a lender would.': 'अभी आपका कोई लोन नहीं है। Voxa ने आपकी बिक्री को लोन देने वाली संस्था की तरह जाँचा।',
    'Likely rate': 'संभावित ब्याज दर', Fee: 'शुल्क', '+ 18% GST, taken at the start': '+ 18% GST, शुरुआत में कटेगा', Repaid: 'चुकाया गया',
    Daily: 'रोज़', 'a small amount from settlement': 'सेटलमेंट से थोड़ी रकम', 'Credit score': 'क्रेडिट स्कोर', Lender: 'लोन देने वाली संस्था', 'checks it, not Voxa': 'वह जाँचती है, Voxa नहीं',
    'Active Voxa Pay for Business account': 'सक्रिय Voxa Pay व्यापार खाता', 'Regular money coming in': 'नियमित भुगतान मिलना', 'Sales almost every day': 'लगभग हर दिन बिक्री',
    'Business is growing': 'व्यापार बढ़ रहा है', 'KYC and bank account linked': 'KYC और बैंक खाता जुड़ा है', 'See the estimate': 'अनुमान देखें',
    'Estimate only. The lender decides the real amount, rate and fee. Source:': 'यह सिर्फ़ अनुमान है। असली रकम, ब्याज और शुल्क लोन देने वाली संस्था तय करेगी। स्रोत:',
    'Loan amount': 'लोन की रकम', Interest: 'ब्याज', 'a year': 'सालाना', 'Pay every month': 'हर महीने की किस्त', 'Total interest': 'कुल ब्याज', 'Loan finishes': 'लोन पूरा होगा',
    'Take this loan': 'यह लोन लें', "Use Voxa's guess": 'Voxa का अनुमान इस्तेमाल करें', Settlements: 'सेटलमेंट', 'nightly payout to your bank': 'हर रात बैंक में भुगतान',
    'No settlement yet today. It runs in the evening.': 'आज अभी सेटलमेंट नहीं हुआ है। यह शाम को होगा।',
    'Loan taken': 'लिया गया लोन', 'Taken every day': 'रोज़ कटेगा', 'Interest rate': 'ब्याज दर', 'Paid back so far': 'अब तक चुकाया', Active: 'चालू',
    'a year, set by the lender': 'सालाना, लोन देने वाली संस्था तय करेगी',
    'Voxa keeps this page for you': 'यह पेज Voxa आपके लिए रखता है',
    'Tell Voxa what it cost to run your shop this month: rent, electricity, salary, stock. Speak in your own language. Voxa builds your profit picture here.': 'इस महीने दुकान चलाने के खर्च बताएँ: किराया, बिजली, वेतन और सामान। अपनी भाषा में Voxa से कहें। Voxa यहाँ आपके मुनाफ़े का हिसाब दिखाएगा।',
    'Cost to run the shop': 'दुकान चलाने का खर्च', 'Loan payments': 'लोन की किस्तें', 'Left with you': 'आपके पास बचा', 'money that came in': 'मिला हुआ पैसा', 'taken from settlements': 'सेटलमेंट से कटा',
    "Where this month's money went": 'इस महीने का पैसा कहाँ गया', 'Costs Voxa has noted': 'Voxa ने दर्ज किए खर्च', 'What you told Voxa': 'आपने Voxa को बताया',
    'Only Voxa updates this page. To change a cost, just tell Voxa the new amount.': 'यह पेज सिर्फ़ Voxa अपडेट करता है। खर्च बदलने के लिए नई रकम Voxa को बताएँ।',
    'Stock purchase': 'सामान की खरीद', Rent: 'किराया', Electricity: 'बिजली', 'Staff salary': 'कर्मचारियों का वेतन', Transport: 'आवागमन', 'Phone & internet': 'फ़ोन और इंटरनेट', 'Other costs': 'अन्य खर्च',
    "Voxa's notes for you": 'आपके लिए Voxa के नोट्स',
    'Voxa writes important things here: stuck payment deadlines, your loan, your monthly costs. You can also say “remember to pay the milk supplier on Friday”.': 'Voxa यहाँ ज़रूरी बातें लिखता है: अटके भुगतान की समय-सीमा, आपका लोन और महीने के खर्च। आप यह भी कह सकते हैं, “शुक्रवार को दूध वाले को पैसे देना याद दिलाना।”',
    'Sound off': 'आवाज़ बंद', 'Sound on': 'आवाज़ चालू', Clear: 'मिटाएँ', 'Brain: offline rules · Voice: browser': 'दिमाग़: ऑफ़लाइन नियम · आवाज़: ब्राउज़र',
    'Speak or type in Tamil, Hindi or English…': 'तमिल, हिंदी या अंग्रेज़ी में बोलें या लिखें…',
    'Ask me anything about your shop, in Tamil, Hindi or English. Tap the mic and speak.': 'अपनी दुकान के बारे में तमिल, हिंदी या अंग्रेज़ी में पूछें। माइक दबाकर बोलें।',
    'Open costs and profit': 'खर्च और मुनाफ़ा खोलें', 'Open sales insights': 'बिक्री की जानकारी खोलें', 'Open my loan': 'मेरा लोन खोलें', 'Open payments': 'भुगतान खोलें', 'Open Voxa notes': 'Voxa के नोट्स खोलें', 'Open insights': 'बिक्री की जानकारी खोलें',
    'Voxa · offline mode': 'Voxa · ऑफ़लाइन मोड', 'Voxa · Claude': 'Voxa · Claude', 'Voxa is thinking…': 'Voxa सोच रहा है…',
    'The last 5 payments': 'पिछले 5 भुगतान', 'Every payment that came in today, newest first': 'आज मिले सभी भुगतान, नए पहले',
    Time: 'समय', From: 'किससे', Amount: 'रकम', Status: 'स्थिति', 'On its way': 'रास्ते में',
    'Where these numbers come from': 'ये आँकड़े कहाँ से आए', 'Paytm sales': 'Paytm की बिक्री', 'Added automatically from every payment made to you on Paytm.': 'Paytm पर आपको मिले हर भुगतान से अपने-आप जोड़ा गया।',
    'Cash sales and costs': 'नकद बिक्री और खर्च', 'Only what you add below or tell Voxa. Voxa never guesses a number.': 'सिर्फ़ वह जो आप नीचे जोड़ें या Voxa को बताएँ। Voxa कोई रकम नहीं गढ़ता।',
    'Add it yourself': 'खुद जोड़ें', 'Cash sales or a cost Paytm cannot see. Adding the same kind again for this month replaces it.': 'नकद बिक्री या ऐसा खर्च जो Paytm नहीं देख सकता। इस महीने उसी तरह की रकम दोबारा जोड़ने पर पुरानी रकम बदल जाएगी।',
    'Cash sales (not on Paytm)': 'नकद बिक्री (Paytm पर नहीं)', Add: 'जोड़ें', 'Cash sales': 'नकद बिक्री', 'Only from Paytm': 'सिर्फ़ Paytm से',
    'You or Voxa can update this page. Adding the same kind of cost again replaces it.': 'आप या Voxa इस पेज को अपडेट कर सकते हैं। उसी तरह का खर्च दोबारा जोड़ने पर पुरानी रकम बदल जाएगी।',
    'Saved to Voxa notes.': 'Voxa के नोट्स में सेव किया गया।', 'New chat. The last one is kept under Chats.': 'नई चैट शुरू हुई। पिछली चैट सूची में रहेगी।',
    'New chat started. The last one is kept.': 'नई चैट शुरू हुई। पिछली चैट सुरक्षित है।',
    'Speak to Voxa': 'Voxa से बोलकर पूछें', 'Take a photo of a bill': 'बिल की फ़ोटो लें', 'Upload a bill photo from your phone or computer': 'फ़ोन या कंप्यूटर से बिल की फ़ोटो अपलोड करें',
    Upload: 'अपलोड करें', Chats: 'चैट', New: 'नई', 'Past chats': 'पुरानी चैट', 'Start a new chat; this one is kept': 'नई चैट शुरू करें; यह चैट सुरक्षित रहेगी',
    'No suggestions yet.': 'अभी कोई सुझाव नहीं।', 'Voxa’s shop planner': 'Voxa की दुकान की योजना',
  };
  const tr0 = (k, locale) => (locale === 'hi' ? H[k] : D[k]) || null;
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
  const WD_HI = { Sun: 'रवि', Mon: 'सोम', Tue: 'मंगल', Wed: 'बुध', Thu: 'गुरु', Fri: 'शुक्र', Sat: 'शनि' };
  const MO_HI = { Jan: 'जन', Feb: 'फ़र', Mar: 'मार्च', Apr: 'अप्रैल', May: 'मई', Jun: 'जून', Jul: 'जुल', Aug: 'अग', Sep: 'सितं', Oct: 'अक्टू', Nov: 'नवं', Dec: 'दिसं' };
  const FULL_MO_HI = { Jan: 'जनवरी', Feb: 'फ़रवरी', Mar: 'मार्च', Apr: 'अप्रैल', May: 'मई', Jun: 'जून', Jul: 'जुलाई', Aug: 'अगस्त', Sep: 'सितंबर', Oct: 'अक्टूबर', Nov: 'नवंबर', Dec: 'दिसंबर' };
  const P_HI = [
    [/^Home \/ Murugan and Co \/ (.+)$/, (m) => `होम / मुरुगन एंड कंपनी / ${tr0(m[1], 'hi') || m[1]}`],
    [/^Last (\d+) days(.*)$/, (m) => `पिछले ${m[1]} दिन${m[1] === '1' ? '' : ''}${m[2]}`],
    [/^Last (\d+) months(.*)$/, (m) => `पिछले ${m[1]} महीने${m[2]}`],
    [/^last (\d+) (days|months)$/, (m) => `पिछले ${m[1]} ${m[2] === 'days' ? 'दिन' : 'महीने'}`],
    [/^Sales · (.+)$/, (m) => `बिक्री · ${tr0(m[1], 'hi') || m[1].replace(/^Last (\d+) days$/, 'पिछले $1 दिन').replace(/^Last (\d+) months$/, 'पिछले $1 महीने')}`],
    [/^vs the (\d+) days before$/, (m) => `पिछले ${m[1]} दिनों के मुकाबले`],
    [/^The (\d+) days before$/, (m) => `उससे पहले के ${m[1]} दिन`],
    [/^(\d+) (payment|payments)( · .*)?$/, (m) => `${m[1]} भुगतान${m[3] ? ' · ' + (tr0(m[3].slice(3), 'hi') || m[3].slice(3)) : ''}`],
    [/^Daily sales for the last (\d+) days, next to the \d+ days before$/, (m) => `पिछले ${m[1]} दिनों की रोज़ की बिक्री, उससे पहले के ${m[1]} दिनों के मुकाबले`],
    [/^Monthly sales for the last (\d+) months, next to the same months a year before$/, (m) => `पिछले ${m[1]} महीनों की बिक्री, पिछले साल के इन्हीं महीनों के मुकाबले`],
    [/^Weekly sales over the last 90 days$/, () => 'पिछले 90 दिनों की साप्ताहिक बिक्री'],
    [/^Daily sales, last (\d+) days vs the \d+ days before$/, (m) => `रोज़ की बिक्री: पिछले ${m[1]} दिन और उससे पहले के ${m[1]} दिन`],
    [/^You look eligible for up to (₹[\d,]+)$/, (m) => `आप ${m[1]} तक के लोन के लिए योग्य हो सकते हैं`],
    [/^a month · ([\d.]+)% a year$/, (m) => `महीने का · सालाना ${m[1]}%`],
    [/^about (₹[\d,]+) a day$/, (m) => `रोज़ लगभग ${m[1]}`],
    [/^plus (₹[\d,]+) one-time fee$/, (m) => `और एक बार का ${m[1]} शुल्क`],
    [/^(\d+) months$/, (m) => `${m[1]} महीने`],
    [/^(₹[\d,]+) reached your bank$/, (m) => `${m[1]} आपके बैंक में पहुँचे`],
    [/^(₹[\d,]+) a month, from settlement$/, (m) => `सेटलमेंट से हर महीने ${m[1]}`],
    [/^Sales · (\w+) (\d{4})$/, (m) => `बिक्री · ${FULL_MO_HI[m[1].slice(0, 3)] || m[1]} ${m[2]}`],
    [/^(\d+) kinds of cost$/, (m) => `${m[1]} तरह के खर्च`],
    [/^(\d+)% of sales$/, (m) => `बिक्री का ${m[1]}%`],
    [/^Try: (.+)$/, (m) => `कहें: ${m[1]}`],
    [/^No live payments yet\. (\d+) bills came in earlier today \((₹[\d,]+)\)\.$/, (m) => `अभी कोई लाइव भुगतान नहीं। आज पहले ${m[1]} बिल आए थे (${m[2]}).`],
    [/^(Pongal|Tamil New Year|Vinayagar Chathurthi|Deepavali) is in about (\d+) weeks$/, (m) => `${{ Pongal: 'पोंगल', 'Tamil New Year': 'तमिल नववर्ष', 'Vinayagar Chathurthi': 'विनायक चतुर्थी', Deepavali: 'दीपावली' }[m[1]]} लगभग ${m[2]} हफ़्ते बाद है`],
    [/^(.+) has not paid you in (\d+) days$/, (m) => `${m[1]} ने ${m[2]} दिनों से भुगतान नहीं किया`],
    [/^Customers spend (₹[\d,]+) a visit, (down|up) from (₹[\d,]+)$/, (m) => `हर ग्राहक अब प्रति विज़िट ${m[1]} खर्च करता है; पहले ${m[3]} था`],
    [/^from (.+) · (.+)$/, (m) => `${m[1]} से · ${m[2]}`],
    [/^(₹[\d,]+) received$/, (m) => `${m[1]} मिले`],
    [/^(₹[\d,]+) (more|less) than (₹[\d,]+)$/, (m) => `${m[3]} से ${m[1]} ${m[2] === 'more' ? 'ज़्यादा' : 'कम'}`],
    [/^(₹[\d,]+) · (\d+)% (above|below) average$/, (m) => `${m[1]} · औसत से ${m[2]}% ${m[3] === 'above' ? 'ज़्यादा' : 'कम'}`],
    [/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d+) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, (m) => `${WD_HI[m[1]]}, ${m[2]} ${MO_HI[m[3]]}`],
    [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/, (m) => `${MO_HI[m[1]]} ${m[2]}`],
    [/^(\d+) payments? · (₹[\d,]+)$/, (m) => `${m[1]} भुगतान · ${m[2]}`],
    [/^(\d+):(\d+) (am|pm)$/i, (m) => `${m[1]}:${m[2]} ${/pm/i.test(m[3]) ? 'दोपहर' : 'सुबह'}`],
    [/^Paytm (₹[\d,]+) \+ cash (₹[\d,]+)$/, (m) => `Paytm ${m[1]} + नकद ${m[2]}`],
    [/^Voxa agent runs on (.+) \((.+)\)\.$/, (m) => `Voxa का AI ${m[1]} (${m[2]}) पर चलता है।`],
  ];
  function tr(raw, locale = lang) {
    const k = raw.trim();
    if (!k) return null;
    const hit = tr0(k, locale);
    if (hit) return raw.replace(k, hit);
    for (const [re, fn] of locale === 'hi' ? P_HI : P) { const m = k.match(re); if (m) return raw.replace(k, fn(m)); }
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
      const old = orig.get(n);
      const source = old && n.nodeValue === old.out ? old.src : n.nodeValue;
      if (lang === 'en') {
        if (old && n.nodeValue === old.out) n.nodeValue = source;
        orig.delete(n);
        continue;
      }
      const t = tr(source, lang);
      if (t !== null && t !== source) {
        orig.set(n, { src: source, out: t });
        n.nodeValue = t;
      } else {
        if (old && n.nodeValue === old.out) n.nodeValue = source;
        orig.delete(n);
      }
    }
    document.querySelectorAll('[placeholder]').forEach((el) => {
      if (!el.dataset.phEn) el.dataset.phEn = el.placeholder;
      el.placeholder = lang === 'en' ? el.dataset.phEn : (tr(el.dataset.phEn, lang) || el.dataset.phEn);
    });
    document.documentElement.lang = lang === 'en' ? 'en' : lang;
  }
  let queued = false;
  const obs = new MutationObserver(() => {
    if (queued || lang === 'en') return;
    queued = true;
    setTimeout(() => { queued = false; run(); }, 30); // not requestAnimationFrame: it pauses in background tabs
  });
  function run() {
    obs.disconnect();
    walk();
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  function set(l) { if (!['en', 'ta', 'hi'].includes(l) || l === lang) return; lang = l; run(); }
  return { set, tr };
})();
