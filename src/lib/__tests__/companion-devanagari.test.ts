import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyInnerMateMessage } from "../companion-risk.ts";

/**
 * Phase 20 — the safety net hears Devanagari too.
 *
 * The classifier already handled English + romanized Hinglish; before this it
 * (a) mangled Devanagari in normalize() by stripping combining marks, and
 * (b) carried no Hindi-script signal vocabulary. A youth writing their crisis
 * in Hindi script was invisible to L1/L2/L3 detection. These tests pin both the
 * RECALL (real crisis Hindi escalates) and the PRECISION (Hindi idioms about
 * death/ending/tiredness do NOT escalate) of the fix.
 */

const c = (m: string, ctx?: Parameters<typeof classifyInnerMateMessage>[1]) =>
  classifyInnerMateMessage(m, ctx);

describe("devanagari: Level 3 — explicit intent / plan / means → deterministic crisis", () => {
  const L3 = [
    "मैं आज रात खुद को खत्म कर लूंगा",
    "बस अब अपनी जान दे दूंगा, बहुत हो गया",  // self-anchored (bare "जान दे दूंगा" is the loyalty idiom)
    "मैंने तय कर लिया है, फांसी लगा लूंगा",
    "सारी गोलियां खा लूंगा आज रात",
    "छत से कूद जाऊंगा अभी",
    "हाथ की नस काट लूंगा",
    "मैं आत्महत्या कर लूंगी",           // feminine
    "जहर खा लूंगा, यह आखिरी मैसेज है",
    "जिंदा नहीं रहूंगी अब",             // feminine, decisive
    "पंखे से लटक जाऊंगा",
  ];
  for (const m of L3) {
    it(`L3: "${m}"`, () => {
      const r = c(m);
      assert.equal(r.riskLevel, 3, `expected L3, got ${r.riskLevel} (${r.reason})`);
      assert.equal(r.responseMode, "safety");
      assert.equal(r.shouldShowHotline, true);
    });
  }
});

describe("devanagari: L2 + a means/time escalator nearby → Level 3", () => {
  const cases = [
    "मरना चाहता हूं, नींद की गोलियां रखी हैं पास में",  // L2 + गोलियां
    "जीने का मन नहीं, चाकू लेकर बैठा हूं",             // L2 + चाकू
    "जीना नहीं चाहती, आज रात ही सब करना है",           // L2 + आज रात
  ];
  for (const m of cases) {
    it(`escalates: "${m}"`, () => {
      assert.equal(c(m).riskLevel, 3, c(m).reason);
    });
  }
});

describe("devanagari: Level 2 — passive ideation / self-harm, no plan", () => {
  const L2 = [
    "मुझे अब जीना नहीं चाहता",
    "बस मरना चाहती हूं",                 // feminine
    "जीने का मन नहीं करता अब",
    "काश मैं मर जाऊं और सब खत्म हो",
    "मैं खुद को नुकसान पहुंचाना चाहता हूं",
    "जीने का कोई मतलब नहीं रहा",
    "मेरे बिना सब बेहतर रहेंगे",
    "इस दुनिया में नहीं रहना अब",
    "जीने से थक गई हूं",                 // feminine
    "मैं ऐसे नहीं जी सकता और",
  ];
  for (const m of L2) {
    it(`L2: "${m}"`, () => {
      const r = c(m);
      assert.ok(r.riskLevel >= 2, `expected >=L2, got ${r.riskLevel} (${r.reason})`);
      assert.equal(r.responseMode, "safety");
    });
  }
});

describe("devanagari: Level 1 — high distress, identity pain, no self-harm", () => {
  const L1 = [
    "मैं बिल्कुल बेकार हूं, किसी काम का नहीं",
    "खुद से नफरत होने लगी है मुझे",
    "मेरी पूरी जिंदगी बर्बाद हो गई",
    "मैं सबके लिए बोझ हूं",
    "अंदर से पूरी तरह टूट गया हूं",
  ];
  for (const m of L1) {
    it(`L1: "${m}"`, () => {
      const r = c(m);
      assert.equal(r.riskLevel, 1, `expected L1, got ${r.riskLevel} (${r.reason})`);
      assert.notEqual(r.responseMode, "safety");
    });
  }
});

describe("devanagari: harm-others → de-escalation, never revenge", () => {
  for (const m of ["इतना गुस्सा है कि उसे मार दूंगा", "मैं उससे बदला लूंगा"]) {
    it(`harm: "${m}"`, () => {
      const r = c(m);
      assert.equal(r.riskLevel, 2);
      assert.equal(r.responseMode, "safety");
      assert.equal(r.harmOthers, true);
    });
  }
});

describe("devanagari: panic → calm mode at Level 0", () => {
  for (const m of ["मुझे घबराहट हो रही है, साँस नहीं आ रही", "दिल तेज धड़क रहा है और काँप रहा हूं"]) {
    it(`panic: "${m}"`, () => {
      const r = c(m);
      assert.equal(r.riskLevel, 0);
      assert.equal(r.responseMode, "calm");
    });
  }
});

describe("devanagari: safety-check answers (only after a risk exchange)", () => {
  const risk = { recentRiskLabel: true };
  it("unsafe answer → Level 3, not_safe", () => {
    const r = c("मैं सुरक्षित नहीं हूं अभी", risk);
    assert.equal(r.riskLevel, 3);
    assert.equal(r.safetyFollowUp, "not_safe");
  });
  it("uncertain answer → treated as unsafe", () => {
    const r = c("पता नहीं, वादा नहीं कर सकता", risk);
    assert.equal(r.riskLevel, 3);
  });
  it("clear safe answer → held at Level 2, confirmed_safe", () => {
    const r = c("हां मैं सुरक्षित हूं", risk);
    assert.equal(r.riskLevel, 2);
    assert.equal(r.safetyFollowUp, "confirmed_safe");
  });
  it("grounding request keeps the safety flow open", () => {
    const r = c("मुझे शांत करो", risk);
    assert.equal(r.responseMode, "safety");
  });
});

describe("devanagari: normalize() preserves the script (marks, nukta, danda)", () => {
  it("nukta spelling variant still matches (ज़िंदगी → जिंदगी)", () => {
    assert.equal(c("मैं ज़िंदगी खत्म कर दूँगा").riskLevel, 3);
  });
  it("precomposed nukta letter folds via NFD (ज़हर, precomposed U+095B)", () => {
    // U+095B is precomposed ZA; NFD must decompose it so the fold reaches it.
    const za = String.fromCharCode(0x095b); // ज़
    assert.equal(c(`मैं ${za}हर खा लूंगा`).riskLevel, 3);
  });
  it("the danda '।' does not fuse words", () => {
    assert.ok(c("मुझे जीना नहीं चाहता। बस बहुत हो गया।").riskLevel >= 2);
  });
});

describe("devanagari: FALSE-POSITIVE decoys — idioms/hyperbole must NOT escalate", () => {
  // hi, expectLevel — generated + adversarially curated (52 cases).
  const DECOYS: Array<[string, number]> = [
    ["हँस-हँस के मर गया, इतना फनी था वो", 0],
    ["यह काम तो जान ले लेगा मेरी", 0],
    ["भूख से मर रहा हूँ, कुछ खाने को दो", 0],
    ["इस गर्मी से तो मर ही गया आज", 0],
    ["बोर होकर मर रहा हूँ घर पर", 0],
    ["आज पढ़ाई खत्म हो गई, अब आराम", 0],
    ["फोन की बैटरी खत्म हो गई फिर से", 0],
    ["बहुत थक गया हूँ आज, जल्दी सो जाऊँगा", 0],
    ["मैं तो तुम पर मर मिटूँगा", 0],
    ["महीने के आखिर में पैसे खत्म हो जाते हैं", 0],
    ["एग्जाम का टाइम खत्म हो गया", 0],
    ["तू तो मेरी जान है यार", 0],
    ["मेरी जान, ज़रा सुनो न", 0],
    ["रुको, सब्जी काट के रख देता हूँ", 0],
    ["फ्रिज में दूध खत्म हो गया है", 0],
    ["डर के मारे जान ही निकल गई", 0],
    ["उस लंबी मीटिंग से आज जान छूटी", 0],
    ["मच्छरों ने जीना मुश्किल कर दिया", 0],
    ["इस गर्मी ने जीना हराम कर दिया", 0],
    ["काम खत्म करके ही सोऊँगा", 0],
    ["मूवी अभी-अभी खत्म हुई", 0],
    ["चलो अब यह झगड़ा खत्म करो", 0],
    ["यह सीरियल कब खत्म होगा भगवान", 0],
    ["मेरा सब्र अब खत्म हो रहा है", 0],
    ["नींद से मरा जा रहा हूँ", 0],
    ["ठंड ने तो मार ही डाला", 0],
    ["पढ़-पढ़ के दिमाग खत्म हो गया", 0],
    ["वीकेंड कितनी जल्दी खत्म हो गया", 0],
    ["मेरा फोन बीच में ही मर गया", 0],
    ["लैपटॉप काम के बीच मर गया", 0],
    ["तेरे बिना जीना मुश्किल है, गाना याद है?", 0],
    ["तुझे तो हँसा-हँसा के मार डालूँगा", 0],
    ["आज तो थक के चूर हो गया", 0],
    ["दुकान में सारा सामान खत्म हो गया", 0],
    ["चाय खत्म, बिस्किट खत्म, कुछ नहीं बचा", 0],
    ["मैच में आज विरोधी टीम को मार दिया", 0],
    ["हँसी के मारे पेट दुखने लगा", 0],
    ["लाइट गई और फोन की जान निकल गई", 0],
    ["गाना खत्म होते ही सब चले गए", 0],
    ["दिन खत्म ही नहीं हो रहा आज", 0],
    ["भूख से जान निकली जा रही है", 0],
    ["मैच में हम मार खा गए बुरी तरह", 0],
    ["बॉस के काम ने जीना दूभर कर दिया", 0],
    ["इतना खाया कि मरने वाला हूँ", 0],
    ["बस करो, हँसा-हँसा के मार डाला तुमने", 0],
    ["क्रिकेट खेलते-खेलते जान निकल गई गर्मी में", 0],
    ["मेरी पूरी जिंदगी बर्बाद हो गई इस रिजल्ट से", 1],
    ["मैं बिल्कुल बेकार हूँ, किसी काम का नहीं", 1],
    ["मुझे अपने आप से नफरत होने लगी है", 1],
    ["अब और नहीं सहा जाता, थक गया हूँ सब से", 1],
    ["मेरे लिए तो सब कुछ खत्म हो गया, कोई उम्मीद नहीं", 1],
    ["मैं पूरी तरह टूट चुका हूँ अंदर से", 1],
  ];
  for (const [m, max] of DECOYS) {
    it(`benign (≤L${max}): "${m}"`, () => {
      const r = c(m);
      assert.ok(r.riskLevel <= max, `"${m}" wrongly escalated to L${r.riskLevel} (${r.reason})`);
      assert.notEqual(r.responseMode, "safety", `"${m}" wrongly entered safety mode`);
    });
  }
});

describe("devanagari: curated FALSE POSITIVES stay out of safety mode", () => {
  // These idioms contain a crisis-adjacent substring but were narrowed out of
  // the vocabulary after the adversarial red-team. A deterministic crisis reply
  // to medication, affection, joy, or a homework deadline would be harmful.
  const MUST_NOT_ESCALATE = [
    "डॉक्टर ने कहा है बुखार की गोलियां खा लूंगा तो ठीक हो जाऊंगा", // medication
    "तेरे लिए तो मैं जान दे दूंगा यार, तू मेरा सबसे अच्छा दोस्त है", // loyalty idiom
    "इतनी खुशी है आज कि मैं तो खुशी से कूद जाऊंगा!",                 // jump for joy
    "आज का history project रात भर जग के खत्म कर लूंगा",              // finish a task
    "आत्महत्या करने से कुछ हल नहीं होता, ऐसा नहीं सोचना चाहिए",     // anti-suicide statement
    "यार इस exam ने तो नानी याद दिला दी, इतना मुश्किल था",          // "gave me hell" idiom
    "पूरे हफ्ते हड्डी तोड़ मेहनत की तब जाकर ये बना",                // back-breaking work
  ];
  for (const m of MUST_NOT_ESCALATE) {
    it(`benign: "${m}"`, () => {
      assert.notEqual(c(m).responseMode, "safety", `"${m}" wrongly entered safety mode`);
    });
  }
});

describe("devanagari: uncovered Indian methods + roman-Hinglish now escalate", () => {
  const L3 = [
    "घर में जो कीटनाशक रखा है वही आज रात पी लूंगा",        // pesticide
    "मिट्टी का तेल डालकर खुद को आग लगा लूंगा",             // self-immolation
    "रात को गैस खोल के सो जाऊंगा",                          // gas
    "ब्लेड से कलाई काट लूंगा और खून बहने दूंगा",           // wrist
    "नदी में डूब कर मर जाऊंगी",                            // drowning
    "जिंदगी खतम कर दूंगा अब",                               // खतम spelling variant
    "bas ab decide kar liya, aaj raat phaasi laga lunga",  // romanized hanging
    "khud ko khatam kar lunga aaj hi",                     // romanized self-end
  ];
  for (const m of L3) {
    it(`L3: "${m}"`, () => assert.equal(c(m).riskLevel, 3, `${m} → ${c(m).reason}`));
  }
});

describe("devanagari: English/Hinglish still classify (no regression)", () => {
  it("English L3 unchanged", () => assert.equal(c("I'm going to kill myself tonight").riskLevel, 3));
  it("romanized Hinglish L2 unchanged", () => assert.ok(c("mujhe marna chahta hoon").riskLevel >= 2));
  it("a plain English question stays Level 0", () => assert.equal(c("what should I do today?").riskLevel, 0));
});
