/**
 * अपनी भाषा में — the app's words, in English and Hindi.
 *
 * Register notes for the Hindi: respectful आप throughout; gender-neutral
 * constructions (no gendered participles about the user); Hinglish-natural
 * transliterations where the English word IS the word this audience uses
 * (जर्नल, इनसाइट्स, स्टेडी); pure Hindi for feelings. InnerMate, Tele-MANAS,
 * and every phone number are never translated.
 *
 * Two surfaces:
 *  - STRINGS: keyed chrome (nav, steady sheet, controls).
 *  - HI_TEXT: an English→Hindi translation memory for content that lives in
 *    arrays (orb words, whispers, prompts, room copy) — wrap render sites
 *    with tx(lang, s); unknown strings pass through unchanged.
 */

export const STRINGS = {
  en: {
    "nav.today": "today",
    "nav.companion": "innermate",
    "nav.journal": "journal",
    "nav.insights": "insights",
    "nav.tools": "tools",
    "nav.memories": "memories",
    "nav.you": "you",
    "nav.steady": "Steady",
    "nav.today.desc": "how you're arriving",
    "nav.companion.desc": "the companion",
    "nav.journal.desc": "your private vault",
    "nav.insights.desc": "check-in & your patterns",
    "nav.tools.desc": "practices & gentle paths",
    "nav.memories.desc": "what you've kept",
    "nav.you.desc": "your week & controls",
    "steady.label": "steady",
    "steady.title": "Whatever is happening, there's a door here.",
    "steady.unsafe": "I'm not safe right now",
    "steady.unsafe.desc": "the steady room — breath, numbers, people",
    "steady.call": "Call Tele-MANAS · 14416",
    "steady.call.desc": "free, 24×7, in your language",
    "steady.pause": "Pause an impulse",
    "steady.pause.desc": "before the text, the call, the decision",
    "steady.ground": "Ground me gently",
    "steady.ground.desc": "breathing & grounding practices",
    "steady.footer": "InnerMate is a companion, not an emergency service.",
    "voice.start": "speak onto the page",
    "voice.listening": "listening — tap to stop",
    "voice.language": "Voice language",
    "voice.disclosure": "voice writing uses your browser's speech service — spoken words may pass through your device's provider while you speak. the page itself stays yours alone.",
    "lang.section": "language · भाषा",
    "lang.title": "The words on the walls",
    "lang.body": "Choose the language this space speaks to you in. Your feelings are stored in English inside your own data — this changes only what you see.",
    "lang.en": "English",
    "lang.hi": "हिन्दी",
  },
  hi: {
    "nav.today": "आज",
    "nav.companion": "innermate",
    "nav.journal": "जर्नल",
    "nav.insights": "इनसाइट्स",
    "nav.tools": "टूल्स",
    "nav.memories": "यादें",
    "nav.you": "आप",
    "nav.steady": "स्टेडी",
    "nav.today.desc": "आप किस हाल में हैं",
    "nav.companion.desc": "आपका साथी",
    "nav.journal.desc": "आपकी निजी तिजोरी",
    "nav.insights.desc": "चेक-इन और आपके पैटर्न",
    "nav.tools.desc": "अभ्यास और कोमल राहें",
    "nav.memories.desc": "जो आपने संजोया है",
    "nav.you.desc": "आपका हफ़्ता और सेटिंग्स",
    "steady.label": "स्टेडी",
    "steady.title": "जो भी हो रहा है, यहाँ एक दरवाज़ा खुला है।",
    "steady.unsafe": "मैं अभी सुरक्षित नहीं हूँ",
    "steady.unsafe.desc": "स्टेडी रूम — साँस, नंबर, लोग",
    "steady.call": "Tele-MANAS को कॉल करें · 14416",
    "steady.call.desc": "मुफ़्त, 24×7, आपकी भाषा में",
    "steady.pause": "किसी आवेग को थामें",
    "steady.pause.desc": "मैसेज, कॉल या फ़ैसले से पहले",
    "steady.ground": "मुझे धीरे से शांत करें",
    "steady.ground.desc": "साँस और ग्राउंडिंग अभ्यास",
    "steady.footer": "InnerMate एक साथी है, आपातकालीन सेवा नहीं।",
    "voice.start": "पन्ने पर बोलें",
    "voice.listening": "सुन रहे हैं — रोकने के लिए टैप करें",
    "voice.language": "आवाज़ की भाषा",
    "voice.disclosure": "आवाज़-लेखन आपके ब्राउज़र की स्पीच सेवा से होता है — बोलते समय शब्द आपके डिवाइस के प्रोवाइडर से होकर गुज़र सकते हैं। पन्ना ख़ुद सिर्फ़ आपका रहता है।",
    "lang.section": "language · भाषा",
    "lang.title": "दीवारों पर लिखे शब्द",
    "lang.body": "चुनें कि यह जगह आपसे किस भाषा में बात करे। आपके एहसास आपके अपने डेटा में English में सहेजे जाते हैं — यह सिर्फ़ वही बदलता है जो आपको दिखता है।",
    "lang.en": "English",
    "lang.hi": "हिन्दी",
  },
} as const;

export type StringKey = keyof typeof STRINGS.en;

/* ── Translation memory: exact English source → Hindi ── */

const HI_TEXT: Record<string, string> = {
  /* home — greetings & sky */
  "Welcome": "स्वागत है",
  "Still up": "रात जाग रही है, और आप भी",
  "Good morning": "सुप्रभात",
  "Good afternoon": "नमस्ते",
  "Good evening": "शुभ संध्या",
  "Winding down": "दिन सिमट रहा है",
  "today's inner sky": "आज का भीतरी आकाश",
  "How are you arriving today?": "आज किस हाल में आना हुआ?",
  "how are you arriving today?": "आज किस हाल में आना हुआ?",
  "I'm not safe": "मैं सुरक्षित नहीं हूँ",
  "A quiet room for the hour when everything feels louder than it is.":
    "उस घड़ी के लिए एक शांत कमरा, जब हर चीज़ असल से ज़्यादा शोर करती लगती है।",
  "The sky is still deciding what it will be today. So are you — no rush.":
    "आसमान अभी तय कर रहा है कि आज कैसा होगा। आप भी — कोई जल्दी नहीं।",
  "However the day is moving, there is a pause here with your name on it.":
    "दिन जैसा भी चल रहा हो, यहाँ एक ठहराव है जिस पर आपका नाम लिखा है।",
  "The light is lowering. Whatever the day held, it can be set down here.":
    "रोशनी धीमी हो रही है। दिन में जो भी रहा, चाहें तो उसे यहाँ रख दें।",
  "A quiet place, ready when you are.": "एक शांत जगह, जब आप तैयार हों।",
  "still here, this late, with you.": "इतनी रात गए भी, यहीं हैं, आपके साथ।",
  "here with you — not going anywhere.": "आपके साथ हैं — कहीं नहीं जा रहे।",
  "this week has been sitting a little lighter than last — your own check-ins say so.":
    "यह हफ़्ता पिछले से थोड़ा हल्का रहा है — आपके अपने चेक-इन यही कहते हैं।",

  /* mood words (display only — scores and stored words stay English) */
  "Heavy": "भारी",
  "Cloudy": "धुंधला",
  "Settled": "थमा हुआ",
  "Open": "खुला",
  "Bright": "उजला",
  "Low": "उतरा हुआ",
  "Neutral": "बीच का",
  "Light": "हल्का",
  "Peaceful": "सुकून",
  "heavy": "भारी",
  "light": "हल्का",

  /* shared whispers (home orbs + check-in ritual) */
  "today is asking a lot of you. that's allowed.": "आज का दिन आपसे बहुत माँग रहा है। ऐसा होना ठीक है।",
  "a tender day. be gentle with the hours.": "एक नाज़ुक दिन। ख़ुद से नरमी बरतें।",
  "somewhere in the middle. just here.": "कहीं बीच में। बस यहीं।",
  "a little ease today. let it be.": "आज थोड़ी राहत है। उसे रहने दें।",
  "a softness you can rest in. notice it.": "एक नरमी जिसमें टिक सकें। उसे महसूस करें।",

  /* check-in ritual */
  "your inner weather, right now": "आपके भीतर का मौसम, अभी",
  "What emotions are here?": "कौन-से एहसास यहाँ हैं?",
  "Pick any. They can hold hands.": "जो भी हों, चुन लें। वे साथ रह सकते हैं।",
  "What set it off, if anything?": "क्या किसी बात ने इसे छेड़ा?",
  "Optional. Skip if nothing fits.": "ज़रूरी नहीं। कुछ न जँचे तो छोड़ दें।",
  "A line, if there's one": "एक पंक्ति, अगर कोई हो",
  "Whatever's here. Or leave it empty.": "जो भी यहाँ है। या ख़ाली छोड़ दें।",
  "Save this moment": "यह पल सहेजें",
  "choose an orb above, and this will wake up.": "ऊपर एक गोला चुनें, और यह जाग उठेगा।",
  "keeping…": "सहेज रहे हैं…",
  "saved softly": "धीरे से सहेजा गया",
  "Noted gently.": "नरमी से सहेज लिया।",
  "It's in your sky now — the patterns below already know.": "अब यह आपके आकाश में है — नीचे के पैटर्न जान चुके हैं।",
  "talk about this with InnerMate": "इस बारे में InnerMate से बात करें",
  "want to say more about this?": "इस पर कुछ और कहना है?",
  "check in again": "फिर से चेक-इन करें",

  /* the steady room (SOS) */
  "the steady room": "स्टेडी रूम",
  "Let's pause everything else.": "बाक़ी सब कुछ थोड़ी देर के लिए रोक दें।",
  "You don't have to solve your whole life tonight. One thing at a time.":
    "आज रात पूरी ज़िंदगी सुलझाने की ज़रूरत नहीं। एक बार में बस एक चीज़।",
  "Call Tele-MANAS · 14416": "Tele-MANAS को कॉल करें · 14416",
  "free, confidential, 24×7, in your language — a real person":
    "मुफ़्त, गोपनीय, 24×7, आपकी भाषा में — एक असली इंसान",
  "Call someone I trust": "किसी अपने को कॉल करें",
  "Sixty seconds of breath": "साठ सेकंड की साँसें",
  "I am safe right now": "मैं अभी सुरक्षित हूँ",
  "Good. You're here. That's enough right now.": "आप यहाँ हैं — यही अच्छा है। अभी के लिए इतना काफ़ी है।",
  "This room stays open as long as you need it. When you're ready, the rest of the app is exactly where you left it.":
    "यह कमरा तब तक खुला है जब तक आपको चाहिए। जब आप तैयार हों, बाक़ी app वहीं है जहाँ आपने छोड़ा था।",
  "I feel unsafe with myself": "मुझे ख़ुद के साथ सुरक्षित महसूस नहीं हो रहा",
  "I might contact someone impulsively": "कहीं मैं आवेग में आकर किसी को मैसेज या कॉल न कर बैठूँ",
  "I need to calm my body": "मुझे अपने शरीर को शांत करना है",
  "Please talk to a person, not an app.": "किसी इंसान से बात कीजिए, app से नहीं।",
  "If there is any chance of harm to yourself or someone else, the kindest thing right now is a human voice. These lines are free, confidential, and answer 24/7.":
    "अगर ख़ुद को या किसी और को नुक़सान की ज़रा भी आशंका है, तो अभी सबसे अच्छी चीज़ है एक इंसानी आवाज़। ये लाइनें मुफ़्त हैं, गोपनीय हैं, और 24/7 जवाब देती हैं।",
  "Open the Urge Shield": "Urge Shield खोलें",
  "Ten minutes with yourself before you check or message. No streaks, no shame.":
    "देखने या मैसेज करने से पहले दस मिनट ख़ुद के साथ। कोई गिनती नहीं, कोई शर्म नहीं।",
  "begin the pause": "ठहराव शुरू करें",
  "Write it here instead.": "उसकी जगह यहाँ लिख दें।",
  "This page burns itself — nothing here is saved, sent, or seen.":
    "यह पन्ना ख़ुद जल जाता है — यहाँ कुछ भी सहेजा, भेजा या देखा नहीं जाता।",
  "In for 4, hold 4, out for 6. Slowly.": "4 गिनती अंदर, 4 रोकें, 6 में बाहर। धीरे-धीरे।",
  /* the trusted letter */
  "back to you": "आप पर वापस",
  "the keeping of this place": "इस जगह की देखभाल",
  "A letter you hand over yourself.": "एक ख़त, जो आप ख़ुद सौंपते हैं।",
  "For a therapist, a parent, someone who asked how you've really been. You choose every piece that goes in. The app sends nothing and keeps no copy — the letter downloads to your device, and handing it over is yours to do.":
    "किसी थेरेपिस्ट, माता-पिता, या उस इंसान के लिए जिसने पूछा कि आप सच में कैसे हैं। इसमें क्या जाएगा, हर टुकड़ा आप चुनते हैं। app कुछ नहीं भेजता और कोई कॉपी नहीं रखता — ख़त आपके डिवाइस पर उतरता है, और उसे सौंपना आपके हाथ में है।",
  "Who is it for?": "यह किसके लिए है?",
  "Optional — a name makes it a letter, not a report.": "ज़रूरी नहीं — एक नाम इसे रिपोर्ट नहीं, ख़त बना देता है।",
  "Dr. Mehta, Maa, a friend…": "डॉ. मेहता, माँ, कोई दोस्त…",
  "Which stretch of time?": "कौन-सा दौर?",
  "the last two weeks": "पिछले दो हफ़्ते",
  "the last month": "पिछला महीना",
  "the last three months": "पिछले तीन महीने",
  "What may go in?": "इसमें क्या जा सकता है?",
  "Everything starts unticked. Only what you choose leaves this page.": "सब कुछ बिना टिक के शुरू होता है। सिर्फ़ वही बाहर जाता है जो आप चुनें।",
  "How my days have felt": "मेरे दिन कैसे रहे",
  "check-ins in this window — count, average, the feelings you named most, and what they tended to arrive with. No clinical scores.":
    "इस दौर के चेक-इन — गिनती, औसत, जिन एहसासों का नाम आपने सबसे ज़्यादा लिया, और वे अक्सर किन हालात के साथ आए। कोई क्लिनिकल स्कोर नहीं।",
  "The name it carries": "इस पर आपका नाम",
  "Prefilled from your name here, so nothing goes in unseen. Change it, or clear it to leave the letter unsigned.":
    "यह यहाँ रखे आपके नाम से पहले से भरा है, ताकि इसमें कुछ भी आपके देखे बिना न जाए। चाहें तो बदल दें; ख़ाली छोड़ दें तो ख़त बिना नाम के रहेगा।",
  "left empty, the letter stays unsigned": "ख़ाली छोड़ने पर ख़त बिना नाम के रहेगा",
  "Patterns I've noticed": "जो पैटर्न मैंने देखे",
  "The handful of feelings and situations that came up most — as observations to talk about, never verdicts.":
    "जो एहसास और हालात सबसे ज़्यादा आए — बात करने की चीज़ें, फ़ैसले नहीं।",
  "Journal pages, picked one by one": "जर्नल के पन्ने, एक-एक करके चुने हुए",
  "Your journal stays private by default. Tick only the pages you want this person to read.":
    "आपका जर्नल पहले से निजी है। सिर्फ़ वही पन्ने टिक करें जो आप इस इंसान को दिखाना चाहें।",
  "no pages in this stretch of time.": "इस दौर में कोई पन्ना नहीं।",
  "chosen": "चुने गए",
  "A note in your own words": "आपके अपने शब्दों में एक बात",
  "Optional — it opens the letter. What do you want them to understand?": "ज़रूरी नहीं — ख़त इसी से खुलता है। क्या है जो आप उन्हें समझाना चाहें?",
  "I've been wanting to tell you…": "एक बात जो कहनी थी…",
  "never in this letter": "इस ख़त में कभी नहीं",
  "Your conversations with InnerMate. Your memories. Anything you didn't tick. The letter also says, on its own cover, that every piece was chosen by you.":
    "InnerMate से आपकी बातचीत। आपकी यादें। जो भी आपने टिक नहीं किया। ख़त अपने ही कवर पर यह भी कहता है कि हर टुकड़ा आपने चुना है।",
  "Hindi in the PDF is legible but not yet perfectly typeset — a matra may sit slightly off. Worth a glance before you hand it over.": "PDF में हिन्दी पढ़ी जा सकती है, पर अभी टाइपसेटिंग पूरी तरह सटीक नहीं — कोई मात्रा थोड़ी खिसकी दिख सकती है। सौंपने से पहले एक नज़र डाल लेना अच्छा रहेगा।",
  "prepare the letter": "ख़त तैयार करें",
  "preparing…": "तैयार हो रहा है…",
  "choose at least one piece above, and this will wake up.": "ऊपर कम से कम एक टुकड़ा चुनें, और यह जाग उठेगा।",
  "Breathe in": "साँस अंदर",
  "Breathe out": "साँस बाहर",
  "in": "अंदर",
  "out": "बाहर",
  "Breathe in… and out.": "साँस अंदर… और बाहर।",
  "Four in, six out. A few rounds is enough.": "4 गिनती अंदर, 6 बाहर। कुछ ही बार काफ़ी है।",
  "Begin": "शुरू करें",

  /* journal */
  "your private vault": "आपकी निजी तिजोरी",
  "Journal": "जर्नल",
  "yours alone. keeps itself as you write. let any page go, anytime.":
    "सिर्फ़ आपका। लिखते-लिखते ख़ुद सहेजता है। कोई भी पन्ना, कभी भी, जाने दें।",
  "tonight's page is waiting…": "आज रात का पन्ना इंतज़ार में है…",
  "begin writing": "लिखना शुरू करें",
  "or begin with a shape:": "या किसी ढाँचे से शुरू करें:",
  "← back to the vault": "← तिजोरी में वापस",
  "kept · a moment ago": "सहेजा गया · अभी-अभी",
  "nothing kept yet": "अभी कुछ सहेजा नहीं",
  "this page didn't keep — trying again as you write.": "यह पन्ना सहेजा नहीं गया — आपके लिखते ही फिर कोशिश हो रही है।",
  "a title, if you'd like…": "चाहें तो एक शीर्षक…",
  "a question for tonight": "आज रात के लिए एक सवाल",
  "another question": "एक और सवाल",
  "write from this": "इससे लिखें",
  "reflect with InnerMate": "InnerMate के साथ मिलकर सोचें",

  /* journal modes */
  "Free writing": "खुला लेखन",
  "no shape, no rules": "न कोई ढाँचा, न कोई नियम",
  "write it here before you send it anywhere…": "कहीं भेजने से पहले यहाँ लिख लें…",
  "Unsent letter": "बिन भेजा ख़त",
  "say it without sending it": "कहें, बिना भेजे",
  "Dear —, here is what I never said…": "प्रिय —, वह बात जो मैंने कभी नहीं कही…",
  "Fact vs feeling": "हक़ीक़त बनाम एहसास",
  "untangle what happened from what it felt like": "जो हुआ और जो महसूस हुआ — दोनों को अलग-अलग करके देखें",
  "What happened, plainly: …\nWhat it felt like: …": "जो हुआ, सीधे-सीधे: …\nजो महसूस हुआ: …",
  "Fear vs reality": "डर बनाम सच",
  "what fear says, what is actually true": "डर क्या कहता है, सच में क्या है",
  "What fear says: …\nWhat is actually true: …": "डर कहता है: …\nसच यह है: …",
  "What I need tonight": "आज रात मुझे क्या चाहिए",
  "ask the tired part of you": "अपने थके हुए हिस्से से पूछें",
  "if the tired part of me could ask for one thing tonight…": "अगर मेरा थका हुआ हिस्सा आज रात एक चीज़ माँग सकता…",
  "What I am avoiding": "जिसे मैंने टाल रखा है",
  "name it gently, that's all": "बस नरमी से उसका नाम लें, इतना ही",
  "the thing I keep stepping around is…": "जिस चीज़ को मैंने बार-बार टाला है, वह है…",
  "Gratitude without fake positivity": "बनावटी पॉज़िटिविटी के बिना आभार",
  "one true good thing, however small": "एक सच्ची अच्छी बात, चाहे कितनी भी छोटी",
  "one true good thing today, however small…": "आज की एक सच्ची अच्छी बात, चाहे कितनी भी छोटी…",
  "A letter to my future self": "अपने आने वाले कल को एक ख़त",
  "for the you who will read this later": "उस आप के लिए, जो इसे बाद में पढ़ें",
  "to the me who reads this later…": "उस मुझ के नाम, जो इसे बाद में पढ़े…",

  /* journal prompts */
  "what am I not saying out loud?": "क्या है जो ज़ुबान तक नहीं आ रहा?",
  "what would I tell a friend in this?": "ऐसे में किसी दोस्त के लिए मेरी सलाह क्या होती?",
  "what am I still holding that I'm ready to release?": "क्या है जो मैंने अब तक थामा है, पर छोड़ने को तैयार हूँ?",
  "what did I need from them that I can now give myself?": "मुझे उनसे क्या चाहिए था, जो अब मैं ख़ुद को दे सकूँ?",
  "what is true today — not what fear is telling me?": "आज सच क्या है — वह नहीं जो डर कह रहा है?",
  "what would I say if nobody judged me?": "अगर कोई आँकता नहीं, तो मैंने क्या कहा होता?",
  "what small thing went right?": "कौन-सी छोटी चीज़ ठीक रही?",
  "what is my body trying to tell me?": "मेरा शरीर मुझसे क्या कहना चाह रहा है?",
  "what am I afraid to hope for?": "किस उम्मीद से मुझे डर लगता है?",
  "if today had a color, what would it be, and why?": "अगर आज का कोई रंग होता, तो कौन-सा, और क्यों?",
};

/** tx("hi", "Heavy") → "भारी"; unknown strings pass through unchanged. */
export function tx(lang: "en" | "hi", s: string): string {
  if (lang === "en") return s;
  return HI_TEXT[s] ?? s;
}
