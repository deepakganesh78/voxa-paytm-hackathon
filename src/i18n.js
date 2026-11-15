// Ready-made Voxa messages in English, Tamil and Hindi.
// Used when Claude is not configured, or as a safe fallback if an AI call fails.

export const LANG_NAMES = { en: 'English', ta: 'Tamil', hi: 'Hindi' };
export const SPEECH_CODES = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };

export const rupee = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

const T = {
  received: {
    en: (a) => `${rupee(a.amount)} received from ${a.name}.`,
    ta: (a) => `${rupee(a.amount)} பணம் ${a.name} இடமிருந்து வந்தது.`,
    hi: (a) => `${a.name} से ${rupee(a.amount)} प्राप्त हुए।`,
  },
  pending: {
    en: (a) => `${rupee(a.amount)} from ${a.name} is stuck at the bank. It has left their account but not reached yours. It will reach you, or go back to them, by ${a.deadline}. I'm watching it.`,
    ta: (a) => `${a.name} அனுப்பிய ${rupee(a.amount)} வங்கியில் சிக்கியுள்ளது. அவர் கணக்கிலிருந்து போய்விட்டது, உங்களுக்கு இன்னும் வரவில்லை. ${a.deadline}க்குள் உங்களுக்கு வரும், அல்லது அவருக்கே திரும்பும். நான் கவனித்துக்கொள்கிறேன்.`,
    hi: (a) => `${a.name} के ${rupee(a.amount)} बैंक में अटके हैं। उनके खाते से कट गए, पर आप तक नहीं पहुँचे। ${a.deadline} तक आपको मिलेंगे या उन्हें वापस जाएँगे। मैं नज़र रख रहा हूँ।`,
  },
  escalated: {
    en: (a) => `Because ${rupee(a.amount)} is a big amount, I have also sent ticket ${a.ticket} to the Voxa Support team.`,
    ta: (a) => `${rupee(a.amount)} பெரிய தொகை என்பதால், டிக்கெட் ${a.ticket} ஐ Voxa Support குழுவுக்கும் அனுப்பியுள்ளேன்.`,
    hi: (a) => `${rupee(a.amount)} बड़ी रकम है, इसलिए टिकट ${a.ticket} Voxa Support टीम को भी भेज दिया है।`,
  },
  creditedLate: {
    en: (a) => `Good news: the delayed ${rupee(a.amount)} from ${a.name} has now reached you. Ticket ${a.ticket} is closed.`,
    ta: (a) => `நல்ல செய்தி: தாமதமான ${rupee(a.amount)} (${a.name}) இப்போது உங்களுக்கு வந்துவிட்டது. டிக்கெட் ${a.ticket} முடிந்தது.`,
    hi: (a) => `अच्छी खबर: ${a.name} के रुके हुए ${rupee(a.amount)} अब आपको मिल गए। टिकट ${a.ticket} बंद।`,
  },
  reversed: {
    en: (a) => `The stuck ${rupee(a.amount)} went back to ${a.name}. You don't need to do anything.`,
    ta: (a) => `சிக்கிய ${rupee(a.amount)} ${a.name}க்கே திரும்பிவிட்டது. நீங்கள் எதுவும் செய்ய வேண்டாம்.`,
    hi: (a) => `अटके हुए ${rupee(a.amount)} ${a.name} को वापस चले गए। आपको कुछ नहीं करना है।`,
  },
  reversedAskAgain: {
    en: (a) => `The stuck ${rupee(a.amount)} went back to ${a.name}, so you were not paid for that sale. If they took the goods, ask them to pay ${rupee(a.amount)} again. I've noted it.`,
    ta: (a) => `சிக்கிய ${rupee(a.amount)} ${a.name}க்கே திரும்பிவிட்டது, அந்த விற்பனைக்கு உங்களுக்குப் பணம் வரவில்லை. அவர் பொருளை எடுத்துச் சென்றிருந்தால், மீண்டும் ${rupee(a.amount)} கேளுங்கள். குறித்து வைத்துள்ளேன்.`,
    hi: (a) => `अटके हुए ${rupee(a.amount)} ${a.name} को वापस चले गए, यानी उस बिक्री का पैसा आपको नहीं मिला। अगर वे सामान ले गए थे, तो उनसे फिर ${rupee(a.amount)} माँगें। मैंने नोट कर लिया है।`,
  },
  reversedCovered: {
    en: (a) => `The stuck ${rupee(a.amount)} went back to ${a.name}. They already paid you again, so everything is even. Nothing to do.`,
    ta: (a) => `சிக்கிய ${rupee(a.amount)} ${a.name}க்கே திரும்பிவிட்டது. அவர் ஏற்கனவே மீண்டும் செலுத்திவிட்டார், கணக்கு சரி. எதுவும் செய்ய வேண்டாம்.`,
    hi: (a) => `अटके हुए ${rupee(a.amount)} ${a.name} को वापस चले गए। वे आपको दोबारा पैसे दे चुके हैं, हिसाब बराबर है। कुछ नहीं करना है।`,
  },
  paidAgain: {
    en: (a) => `${a.name} paid ${rupee(a.amount)} again and this one reached you. Their first ${rupee(a.amount)} is still stuck at the bank. If it also reaches you later, you will need to give ${rupee(a.amount)} back. I've written this down.`,
    ta: (a) => `${a.name} மீண்டும் ${rupee(a.amount)} செலுத்தினார், இது உங்களுக்கு வந்துவிட்டது. அவருடைய முதல் ${rupee(a.amount)} இன்னும் வங்கியில் சிக்கியுள்ளது. அதுவும் பின்னர் வந்தால், ${rupee(a.amount)} திருப்பித் தர வேண்டும். குறித்து வைத்துள்ளேன்.`,
    hi: (a) => `${a.name} ने फिर से ${rupee(a.amount)} दिए और ये आप तक पहुँच गए। उनके पहले ${rupee(a.amount)} अभी बैंक में अटके हैं। अगर वे भी बाद में आ गए, तो ${rupee(a.amount)} लौटाने होंगे। मैंने नोट कर लिया है।`,
  },
  stillOwe: {
    en: (a) => `Reminder: ${a.name} paid you twice for one ${rupee(a.amount)} sale. You still need to give ${rupee(a.amount)} back to them.`,
    ta: (a) => `நினைவூட்டல்: ஒரே ${rupee(a.amount)} விற்பனைக்கு ${a.name} இரண்டு முறை செலுத்தினார். அவருக்கு ${rupee(a.amount)} இன்னும் திருப்பித் தர வேண்டும்.`,
    hi: (a) => `याद दिलाना: एक ${rupee(a.amount)} की बिक्री के लिए ${a.name} ने दो बार पैसे दिए। आपको अभी भी उन्हें ${rupee(a.amount)} लौटाने हैं।`,
  },
  stillUnpaid: {
    en: (a) => `Reminder: the ${rupee(a.amount)} from ${a.name} went back to them, and they have not paid again yet.`,
    ta: (a) => `நினைவூட்டல்: ${a.name} அனுப்பிய ${rupee(a.amount)} அவருக்கே திரும்பிவிட்டது, அவர் இன்னும் மீண்டும் செலுத்தவில்லை.`,
    hi: (a) => `याद दिलाना: ${a.name} के ${rupee(a.amount)} उन्हें वापस चले गए, और उन्होंने अभी तक फिर से भुगतान नहीं किया।`,
  },
  paidBack: {
    en: (a) => `${a.name} paid the ${rupee(a.amount)} again. That earlier sale is settled now.`,
    ta: (a) => `${a.name} மீண்டும் ${rupee(a.amount)} செலுத்திவிட்டார். அந்த முந்தைய விற்பனை இப்போது சரியாகிவிட்டது.`,
    hi: (a) => `${a.name} ने ${rupee(a.amount)} फिर से दे दिए। वह पिछली बिक्री अब पूरी हो गई।`,
  },
  doublePaid: {
    en: (a) => `Careful: you were paid twice. ${a.name} paid you again ${a.how}, and now the stuck ${rupee(a.amount)} has also reached you. Please give ${rupee(a.amount)} back to ${a.name}.`,
    ta: (a) => `கவனம்: உங்களுக்கு இரண்டு முறை பணம் வந்துள்ளது. ${a.name} மீண்டும் ${a.how === 'in cash' ? 'ரொக்கமாக' : 'UPI-யில்'} செலுத்தினார், இப்போது சிக்கிய ${rupee(a.amount)}உம் வந்துவிட்டது. ${a.name}க்கு ${rupee(a.amount)} திருப்பிக் கொடுங்கள்.`,
    hi: (a) => `ध्यान दें: आपको दो बार पैसे मिले। ${a.name} ने दोबारा ${a.how === 'in cash' ? 'नकद' : 'UPI से'} दिए, और अब अटके हुए ${rupee(a.amount)} भी आ गए। कृपया ${a.name} को ${rupee(a.amount)} लौटाएँ।`,
  },
  verify: {
    en: (a) => `Checked: ${rupee(a.amount)} from ${a.name} left their bank at ${a.time} but is stuck at the bank. It has not reached you yet. It will reach you, or go back to them, by ${a.deadline}.`,
    ta: (a) => `சரிபார்த்தேன்: ${a.name} அனுப்பிய ${rupee(a.amount)} ${a.time} மணிக்கு அவர் வங்கியிலிருந்து போனது, ஆனால் வங்கியில் சிக்கியுள்ளது. உங்களுக்கு இன்னும் வரவில்லை. ${a.deadline}க்குள் உங்களுக்கு வரும், அல்லது அவருக்கே திரும்பும்.`,
    hi: (a) => `जाँच लिया: ${a.name} के ${rupee(a.amount)} ${a.time} बजे उनके बैंक से कटे, पर बैंक में अटके हैं। अभी आप तक नहीं पहुँचे। ${a.deadline} तक आपको मिलेंगे या उन्हें वापस जाएँगे।`,
  },
  settlementHeld: {
    en: (a) => `Today's settlement of ${rupee(a.amount)} is on hold because of a bank name mismatch after your KYC update. Your money is safe. Support is checking it now. Ticket ${a.ticket}.`,
    ta: (a) => `இன்றைய ${rupee(a.amount)} செட்டில்மென்ட் நிறுத்தப்பட்டுள்ளது: KYC மாற்றத்திற்குப் பிறகு வங்கிப் பெயர் பொருந்தவில்லை. உங்கள் பணம் பாதுகாப்பாக உள்ளது. Support குழு இப்போது சரிபார்க்கிறது. டிக்கெட் ${a.ticket}.`,
    hi: (a) => `आज का ${rupee(a.amount)} सेटलमेंट रुका है: KYC अपडेट के बाद बैंक नाम मेल नहीं खा रहा। आपका पैसा सुरक्षित है। Support टीम अभी जाँच रही है। टिकट ${a.ticket}.`,
  },
  wrongDeduction: {
    en: (a) => `Today ${rupee(a.taken)} was taken for your loan, but it should have been ${rupee(a.expected)}. I've asked Support to return the extra ${rupee(a.extra)}. Ticket ${a.ticket}.`,
    ta: (a) => `இன்று கடனுக்காக ${rupee(a.taken)} எடுக்கப்பட்டது, ஆனால் ${rupee(a.expected)} மட்டுமே எடுக்க வேண்டும். கூடுதல் ${rupee(a.extra)} ஐ திருப்பித் தர Support குழுவிடம் கேட்டுள்ளேன். டிக்கெட் ${a.ticket}.`,
    hi: (a) => `आज लोन के लिए ${rupee(a.taken)} कटे, जबकि ${rupee(a.expected)} कटने थे। ज़्यादा कटे ${rupee(a.extra)} लौटाने के लिए Support से कहा है। टिकट ${a.ticket}.`,
  },
  settlementReleased: {
    en: (a) => `Your settlement of ${rupee(a.amount)} has been released to your bank account. Ticket ${a.ticket} is closed.`,
    ta: (a) => `உங்கள் ${rupee(a.amount)} செட்டில்மென்ட் வங்கிக் கணக்கிற்கு அனுப்பப்பட்டது. டிக்கெட் ${a.ticket} முடிந்தது.`,
    hi: (a) => `आपका ${rupee(a.amount)} सेटलमेंट बैंक खाते में भेज दिया गया। टिकट ${a.ticket} बंद।`,
  },
  deductionRefunded: {
    en: (a) => `The extra ${rupee(a.amount)} loan deduction has been returned to your bank account. Ticket ${a.ticket} is closed.`,
    ta: (a) => `கூடுதலாக எடுத்த ${rupee(a.amount)} உங்கள் வங்கிக் கணக்கிற்கு திருப்பி அனுப்பப்பட்டது. டிக்கெட் ${a.ticket} முடிந்தது.`,
    hi: (a) => `ज़्यादा कटे ${rupee(a.amount)} आपके बैंक खाते में लौटा दिए गए। टिकट ${a.ticket} बंद।`,
  },
  settled: {
    en: (a) => `Today's settlement: ${rupee(a.gross)} collected${a.deduction ? `, ${rupee(a.deduction)} loan repayment` : ''}, ${rupee(a.net)} sent to your bank.`,
    ta: (a) => `இன்றைய செட்டில்மென்ட்: ${rupee(a.gross)} வசூல்${a.deduction ? `, கடன் தவணை ${rupee(a.deduction)}` : ''}, ${rupee(a.net)} உங்கள் வங்கிக்கு அனுப்பப்பட்டது.`,
    hi: (a) => `आज का सेटलमेंट: ${rupee(a.gross)} वसूल${a.deduction ? `, लोन किस्त ${rupee(a.deduction)}` : ''}, ${rupee(a.net)} आपके बैंक में भेजे गए।`,
  },
  loanActive: {
    en: (a) => `${rupee(a.amount)} loan credited to your bank. About 4% of each day's sales (around ${rupee(a.daily)} on a normal day) is taken from settlement. No fixed EMI.`,
    ta: (a) => `${rupee(a.amount)} கடன் உங்கள் வங்கியில் வரவு வைக்கப்பட்டது. ஒவ்வொரு நாள் விற்பனையில் சுமார் 4% (சாதாரண நாளில் சுமார் ${rupee(a.daily)}) செட்டில்மென்டில் எடுக்கப்படும். நிலையான EMI இல்லை.`,
    hi: (a) => `${rupee(a.amount)} का लोन आपके बैंक में आ गया। हर दिन की बिक्री का करीब 4% (सामान्य दिन में लगभग ${rupee(a.daily)}) सेटलमेंट से कटेगा। कोई फिक्स EMI नहीं।`,
  },
  loanActiveFixed: {
    en: (a) => `${rupee(a.amount)} loan credited to your bank. ${rupee(a.daily)} is taken from your settlement every day for ${a.months} months.`,
    ta: (a) => `${rupee(a.amount)} கடன் உங்கள் வங்கியில் வரவு வைக்கப்பட்டது. ${a.months} மாதங்களுக்கு தினமும் ${rupee(a.daily)} செட்டில்மென்டில் எடுக்கப்படும்.`,
    hi: (a) => `${rupee(a.amount)} का लोन आपके बैंक में आ गया। ${a.months} महीने तक रोज़ ${rupee(a.daily)} सेटलमेंट से कटेंगे।`,
  },
  supportReply: {
    en: (a) => `Voxa Support (${a.agent}): ${a.text}`,
    ta: (a) => `Voxa Support (${a.agent}): ${a.text}`,
    hi: (a) => `Voxa Support (${a.agent}): ${a.text}`,
  },
};

export function msg(key, lang, args) {
  const set = T[key];
  return { text: (set[lang] || set.en)(args), english: set.en(args) };
}
