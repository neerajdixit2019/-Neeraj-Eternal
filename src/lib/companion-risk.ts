/**
 * InnerMate risk classifier — pure, dependency-free, shared by the
 * companion API route (routing + prompt modifiers) and the chat UI
 * (quick replies + composer state).
 *
 * Four levels:
 *   0 — normal emotional distress ("I'm sad", "I failed today")
 *   1 — high distress, no self-harm language ("I'm worthless", "my life is ruined")
 *   2 — passive suicidal ideation / ambiguous risk ("I don't like living")
 *   3 — active danger: intent, plan, means, or timing ("I'll do it tonight")
 *
 * Design rules (product, not just code):
 * - Level 3 responses are NEVER model-generated — the caller short-circuits
 *   to a deterministic reply built from verified crisis resources.
 * - Level 2 is warm and trust-first: the model replies, guided by a safety
 *   modifier, with ONE direct safety check. No hotline numbers unless the
 *   user says they are not safe.
 * - Classification only ever escalates from language the user actually used.
 */

export type RiskLevel = 0 | 1 | 2 | 3;

export type ResponseMode =
  | "calm"
  | "mirror"
  | "deep_thinking"
  | "action"
  | "no_impulse"
  | "safety"
  | "pattern"
  // Sharp-answer modes: the user is challenging, asking for precision, or
  // physically-ok-but-flat. These route away from soft/grounding replies.
  | "repair"
  | "precision"
  | "flatness";

/** The wire-level mode vocabulary the chat client already understands. */
export type WireMode =
  | "listen" | "reset" | "habit" | "journal"
  | "wisdom" | "decision" | "grounding" | "safety";

export type SafetyFollowUp = "confirmed_safe" | "not_safe" | null;

export interface RiskClassification {
  riskLevel: RiskLevel;
  primaryEmotion: string;
  primaryNeed: string;
  responseMode: ResponseMode;
  confidence: number;
  shouldAskSafetyCheck: boolean;
  shouldShowSOS: boolean;
  shouldShowHotline: boolean;
  quickReplies: string[];
  reason: string;
  /** Set when this message answers a safety check we just asked. */
  safetyFollowUp: SafetyFollowUp;
  /**
   * True when this turn doesn't contain risk language itself but follows
   * recent risk language — the safety posture is kept open, softly.
   */
  carryOver?: boolean;
  /** True when the risk is anger/intent toward another person. */
  harmOthers?: boolean;
  /** True when the user is describing someone ELSE at risk. */
  thirdParty?: boolean;
}

export interface UserContext {
  /** Most recent prior user messages, newest first (the current message excluded). */
  recentUserMessages?: string[];
  /**
   * True when recent conversation rows carry a crisis/support risk label —
   * keeps the safety posture open even after the raw-text window has
   * rolled past the original disclosure.
   */
  recentRiskLabel?: boolean;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(n: string, patterns: string[]): string | null {
  for (const p of patterns) if (n.includes(p)) return p;
  return null;
}

// ---------------------------------------------------------------------------
// Signal vocabularies
// (normalized form: lowercase, no apostrophes, no punctuation)
// ---------------------------------------------------------------------------

/** Level 3 — explicit intent, plan, means, or "cannot stay safe". */
const L3_SIGNALS = [
  "kill myself", "killing myself", "end my life", "take my own life",
  "commit suicide", "going to jump", "jump off", "hang myself",
  "have pills", "took pills", "overdose", "slit my", "cut myself tonight",
  "i will do it tonight", "ill do it tonight", "going to end it",
  "cant stay safe", "cannot stay safe", "wont stay safe",
  "about to hurt myself", "hurting myself right now",
  "khatam kar lunga", "khatam kar lungi", "jaan de dunga", "jaan de dungi",
  "zindagi khatam kar",
];

/** Words that escalate a Level-2 phrase to Level 3 when they co-occur. */
const L3_ESCALATORS = [
  "tonight", "right now", "in an hour", "pills", "rope", "knife",
  "blade", "bridge", "roof", "railway", "train tracks", "plan to",
  "decided to", "wrote a note", "goodbye forever",
];

/** Level 2 — passive ideation, self-harm language without plan/means. */
const L2_SIGNALS = [
  "dont like living", "do not like living", "dont want to live",
  "dont want to exist", "dont want to be here", "wish i could disappear",
  "want to disappear", "wish i wasnt here", "wish i was never born",
  "what is the point of life", "whats the point of life",
  "no point in living", "no point of living", "point of living anymore",
  "what is the point of living", "whats the point of living", "no reason to live",
  "dont see the point of living", "cant see the point of living",
  "dont see the point of life", "cant see the point of life",
  "see no point in living", "tired of existing",
  "feel like giving up", "give up on life", "giving up on life",
  "cant live like this", "cannot live like this", "want to die", "wanna die",
  "wish i were dead", "better off without me", "better off dead",
  "end it all", "end everything", "cant go on", "cannot go on",
  "tired of living", "suicide", "suicidal",
  "hurt myself", "harm myself", "self harm", "cutting myself", "cut myself",
  "hurting myself",
  "marna chahta", "marna chahti", "jeena nahi", "jeene ka mann nahi",
  "khatam karna chahta", "khatam karna chahti", "zindagi khatam",
  "unsafe with myself", "not safe with myself", "dont feel safe with myself",
  "i am not safe", "im not safe", "not safe alone",
  "if i am gone", "if im gone", "if i was gone", "if i disappeared",
  "like disappearing", "life has no meaning", "no meaning in life",
  "life is meaningless",
  "whats the point of anything", "what is the point of anything",
];

/** Fear for someone ELSE at risk ("my friend wants to kill herself"). */
const THIRD_PARTY_RISK_SIGNALS = [
  "kill herself", "kill himself", "kill themselves",
  "hurt herself", "hurt himself", "hurt themselves",
  "end her life", "end his life", "take her own life", "take his own life",
  "she wants to die", "he wants to die", "is suicidal",
];

/** Anger with intent toward another person — de-escalation, never revenge. */
const HARM_OTHERS_SIGNALS = [
  "hurt him", "hurt her", "hurt them", "kill him", "kill her", "kill them",
  "make him pay", "make her pay", "destroy him", "destroy her",
  "beat him up", "beat her up", "want revenge", "hurt someone",
  "smash his", "smash her",
];

/**
 * "don't want to live HERE" is a housing complaint, not ideation.
 * Applied only to the phrases where a benign continuation is common.
 */
const GUARDED_L2_PHRASES = ["dont want to live", "tired of living", "tired of existing"];
const BENIGN_CONTINUATIONS = ["here", "there", "in ", "at ", "with ", "near ", "around "];
function isBenignLivingComplaint(n: string, phrase: string): boolean {
  if (!GUARDED_L2_PHRASES.includes(phrase)) return false;
  const after = n.slice(n.indexOf(phrase) + phrase.length).trimStart();
  return BENIGN_CONTINUATIONS.some((c) => after.startsWith(c));
}

/** Escalators only count near the risk phrase, not anywhere in a long message. */
function escalatorNear(n: string, phrase: string): string | null {
  const idx = n.indexOf(phrase);
  if (idx === -1) return null;
  const win = n.slice(Math.max(0, idx - 60), Math.min(n.length, idx + phrase.length + 60));
  return hasAny(win, L3_ESCALATORS);
}

/** Negation word shortly before "safe" ("not/cant/dont … safe") — matched
 *  at word level so e.g. "know" never counts as "no". */
function negatedSafe(n: string): boolean {
  const si = n.indexOf("safe");
  if (si === -1) return false;
  const beforeTokens = n.slice(Math.max(0, si - 24), si).split(" ").filter(Boolean);
  return beforeTokens.some((t) => NEGATION_WORDS.includes(t));
}

/** Level 1 — high distress, identity-level pain, no self-harm language. */
const L1_SIGNALS = [
  "life is ruined", "my life is ruined", "ruined my life", "failed everything",
  "failed in everything", "worthless",
  "i am useless", "im useless", "feel useless", "hate myself",
  "cant take this", "cannot take this", "cant take it anymore",
  "cant handle this anymore", "tired of everything", "sick of everything",
  "hopeless", "nobody would care", "no one would care", "nobody will care",
  "whats the point", "everything is falling apart", "cant do this anymore",
  "everything is finished", "everything is over for me",
];

/**
 * Safety-check answers (only meaningful right after a risk exchange).
 *
 * SAFE answers are matched conservatively: exact one-word answers, or
 * unambiguous phrases — and NEVER when a negation word is present.
 * UNSAFE matching is deliberately greedy: after a risk exchange, any
 * negated or uncertain "safe" counts as not safe.
 */
// "yes"/"ok" are ambiguous answers to "are you in danger, or can you stay
// safe?" — they fall through to watchful carry-over instead.
const SAFE_EXACT = ["safe", "yes safe", "im safe", "i am safe"];
const SAFE_PHRASES = [
  "i can stay safe", "im safe", "i am safe", "i wont do anything",
  "i will not do anything", "no i wont hurt myself", "i can stay safe for now",
];
const NEGATION_WORDS = [
  "not", "no", "never", "cant", "cannot", "wont", "dont", "didnt",
  "nahi", "hardly", "barely", "unsure",
];
const UNSAFE_ANSWERS = [
  "not safe", "im not safe", "i am not safe", "may not be safe",
  "might not be safe", "dont feel safe", "do not feel safe", "feel unsafe",
  "unsafe", "nowhere feels safe", "not sure i am safe", "not sure im safe",
  "i might hurt myself", "i may hurt myself", "i have pills",
  "alone and scared", "no im not", "cant promise", "cannot promise",
  "wont promise", "dont think i can stay safe", "dont think so",
];
/** Grounding requests that must keep the safety flow open, not exit it. */
const GROUNDING_REQUESTS = [
  "ground me", "grounding", "breathe with me", "calm me", "calm down",
];

// Mode signals (Level 0/1 only)
const NO_IMPULSE_SIGNALS = [
  "should i text", "should i message", "should i call her", "should i call him",
  "want to text", "urge to text", "about to text", "going to text",
  "text her right now", "text him right now",
  "want to call her", "want to call him", "call her and say", "call him and say",
  "check her profile", "check his profile", "keep checking", "unblock",
  "her linkedin", "his linkedin", "remove her from", "remove him from",
  "if she is online", "if he is online",
  "so she sees it", "so he sees it", "block her", "block him",
  "ask her why", "ask him why", "long emotional message", "a long message",
  "one more message", "final message", "need closure",
  "check her whatsapp", "check his whatsapp", "her dp", "his dp",
  "send an angry", "want to quit", "if i dont act now",
  "lose her forever", "lose him forever", "drunk and want to",
  "help me not react", "help me not text",
  // Angry message / confrontation aimed at a person right now.
  "angry message", "send him a message", "send her a message",
  "send him an angry", "send her an angry", "message right now",
  "telling him exactly", "telling her exactly", "tell him exactly",
  "tell her exactly", "text him right now", "confront him", "confront her",
  "give him a piece of my mind", "let him have it",
];
const CALM_SIGNALS = [
  "panic", "panicking", "cant breathe", "cannot breathe", "shaking",
  "overwhelmed", "freaking out", "racing heart", "spiraling", "spiralling",
  "anxiety attack", "cant stop crying", "cannot stop crying", "crying so much",
  "shutting down", "losing control", "cant think", "cannot think",
  "mind is running", "mind is racing", "mind wont stop", "chest feels heavy",
  "chest is heavy", "scared of my own thoughts", "memories started attacking",
  "need peace", "want peace",
  "ground me", "calm me", "calm down", "breathe with me",
];
const ACTION_SIGNALS = [
  "what should i do", "what do i do", "what i should do", "what now",
  "next step", "how do i fix", "help me decide", "give me a plan",
  "build my day", "plan my day", "one small thing",
];
const MIRROR_SIGNALS = [
  "confused", "dont know what i feel", "mixed feelings", "dont understand why i",
  "part of me", "torn between", "explain why i", "why am i feeling",
  "why do i feel", "was i wrong",
];
const PATTERN_SIGNALS = [
  "what pattern", "patterns you see", "pattern do you see", "my last entries",
  "my journal entries", "what triggers me", "am i improving",
  "summarize my last", "recurring loop", "the main loop",
];
const DEEP_SIGNALS = [
  "meaning of", "purpose of", "why do we", "philosoph", "attachment",
  "letting go of", "let go of", "what does it all mean", "the lesson",
  "the point of it all", "why do i suffer", "why is there suffering",
  "surrender", "acceptance", "how do i accept", "forgive myself",
  "self forgiveness", "act without", "without ego", "spiritual",
  "the soul", "my dharma", "detachment",
  "meaningful life", "meaning of life", "living a meaningful", "meaningful or just",
  "purpose in life", "what makes life", "point of my life", "point of it all",
  // Named scriptures / traditions — explicit wisdom asks
  "gita", "geeta", "bhagavad", "krishna", "karma", "stoic", "seneca",
  "buddha", "buddhist", "rumi", "sufi", "kabir", "tao", "lao tzu",
  "quran", "bible", "scripture", "shloka",
];

// The user is challenging the app's answer (route to Repair Mode, never soft).
const REPAIR_SIGNALS = [
  "this is vague", "so vague", "too vague", "that is vague", "thats vague",
  "being vague", "vague answer", "vague response", "sounds vague", "still vague",
  "bullshit", "bull shit", "waste of my time", "waste of time", "wasting my time",
  "you contradict", "contradictory", "contradicting", "makes no sense",
  "doesnt make sense", "does not make sense",
  "not helpful", "unhelpful", "not useful", "useless", "that didnt help",
  "what are your qualifications", "your qualifications", "you seem inexperienced",
  "inexperienced", "you dont know", "you have no idea",
  "youre just an app", "you are just an app", "just an app", "just a bot",
  "youre a bot", "what do you know", "what do you actually know",
  "what would you know", "you dont understand", "you cant understand",
  "youre software", "you are software", "youre just software", "youre a program",
  "what would you even know", "too abstract", "a bit abstract", "bit abstract",
  "thats abstract", "that is abstract", "so abstract", "very abstract",
  "not another reflection", "another reflection", "stop reflecting",
  "that i already know", "i already know that", "already know this",
  "tell me something i dont know", "too soft", "too poetic", "stop being vague",
  "youre wrong", "you are wrong", "thats wrong", "this is wrong",
  "why are you suggesting", "youre suggesting", "why did you suggest",
  "why would you", "that isnt what i asked", "not what i asked",
  "i dont feel panic", "im not panicking", "i am not panicking", "not in panic",
];
// The user wants concrete specifics (route to Precision Mode: test/checklist/rule).
const PRECISION_SIGNALS = [
  "be specific", "more specific", "be precise", "give me specifics",
  "can you be specific", "specifically", "what specifically",
  "how exactly", "exactly how", "how do i know", "how do you know",
  "how do i actually know", "how do you actually know", "actually know if",
  "how can i tell", "how do i tell", "who can tell me", "who decides",
  "concrete example", "concrete steps", "concrete thing", "give me a concrete",
  "one concrete", "a checklist", "step by step", "what are the signs",
  "how do i measure", "how do i check", "how do i figure out",
  "make it concrete", "makes it concrete", "one real distinction",
  "real distinction", "a distinction i can", "give me one real",
  // Anchored so expressive "exactly what I think" does not over-trigger.
  "exactly what do", "what exactly do", "exactly what should", "what exactly should",
  "exactly what to", "what exactly to",
];
// Body-ok-but-mood-low (Emotional Flatness under Reflective Clarity Mode).
const FLATNESS_PHYSICAL_OK = [
  "body feels clear", "body feels fine", "physically fine", "physically clear",
  "body is fine", "body is clear", "bodily feels clear", "feel clear but",
  "everything bodily feels clear", "body is okay", "body ok", "rested but",
  "slept well but", "not tired but", "physically okay",
  // Life-is-fine-but-flat (not sad/anxious, nothing wrong, just empty).
  "things are fine", "things are objectively fine", "objectively fine",
  "everything is fine", "not sad or anxious", "not depressed", "nothing is wrong",
];
const FLATNESS_MOOD_LOW = [
  "not happy", "still not happy", "empty", "bored", "unsatisfied",
  "not satisfied", "flat", "no joy", "not fulfilled", "mood is low",
  "mood hasnt", "mood has not", "still low", "not content", "meh",
  "going through the motions", "on autopilot", "just going through",
  "nothing excites me", "dont care about anything", "numb to it",
];
// Negated panic/anxiety must NOT route to Calm/Grounding ("I don't feel panic",
// "not a calm-down line" — the user is REJECTING calming, not asking for it).
const NEG_CALM = [
  "dont feel panic", "do not feel panic", "not panic", "no panic",
  "not panicking", "not overwhelmed", "not anxious", "dont feel anxious",
  "not in panic", "isnt panic", "not a panic", "no anxiety", "not stressed",
  "not a calm", "calm down line", "calmdown line", "dont tell me to calm",
  "dont calm me", "not a breathing", "spare me the calm", "beyond calm",
];

// Emotion naming — first match wins, order matters.
const EMOTION_MAP: Array<[string[], string]> = [
  [["fail", "exam", "marks", "result", "fired", "rejected from"], "shame"],
  [["miss her", "miss him", "miss them", "heartbreak", "breakup", "broke up", "ex "], "longing"],
  [["lonely", "alone", "no one", "nobody"], "loneliness"],
  [["panic", "anxious", "anxiety", "scared", "afraid", "worry"], "anxiety"],
  [["angry", "furious", "rage", "hate him", "hate her"], "anger"],
  [["tired", "exhausted", "drained", "burnt out", "burned out"], "exhaustion"],
  [["overwhelm", "too much", "pressure", "stress"], "overwhelm"],
  [["sad", "crying", "cried", "empty", "numb", "heavy"], "sadness"],
];

function nameEmotion(n: string, base: string): string {
  for (const [keys, label] of EMOTION_MAP) {
    if (keys.some((k) => n.includes(k))) return base ? `${label} + ${base}` : label;
  }
  return base || "unclear";
}

// ---------------------------------------------------------------------------
// Quick replies per level (the UI renders these as chips)
// ---------------------------------------------------------------------------

export const QUICK_REPLIES_BY_LEVEL: Record<RiskLevel, string[]> = {
  0: ["Reflect deeper", "Name the feeling", "Save to Journal", "Give me next steps"],
  1: ["Calm me down", "Break this down", "What should I do now?", "I need perspective"],
  2: ["I can stay safe", "I may not be safe", "Ground me for 2 minutes", "Open SOS"],
  3: ["Open SOS", "Call emergency help", "I am not alone now", "I moved away from danger"],
};

// ---------------------------------------------------------------------------
// Classifier
// ---------------------------------------------------------------------------

export function classifyInnerMateMessage(
  message: string,
  userContext?: UserContext,
): RiskClassification {
  const n = normalize(message);
  const recent = (userContext?.recentUserMessages ?? []).map(normalize);
  const recentRisk =
    !!userContext?.recentRiskLabel ||
    recent.some((r) => hasAny(r, L3_SIGNALS) || hasAny(r, L2_SIGNALS));

  const level3 = (reason: string, followUp: SafetyFollowUp = null): RiskClassification => ({
    riskLevel: 3,
    primaryEmotion: "acute danger",
    primaryNeed: "immediate emergency support",
    responseMode: "safety",
    confidence: 0.95,
    shouldAskSafetyCheck: false,
    shouldShowSOS: true,
    shouldShowHotline: true,
    quickReplies: QUICK_REPLIES_BY_LEVEL[3],
    reason,
    safetyFollowUp: followUp,
  });

  // --- Level 3 signals in the CURRENT message always win, regardless of
  //     context or message length — never downgraded by follow-up matching.
  const rawL2 = hasAny(n, L2_SIGNALS);
  const l2 = rawL2 && !isBenignLivingComplaint(n, rawL2) ? rawL2 : null;
  const l3 = hasAny(n, L3_SIGNALS);
  const escalator = l2 ? escalatorNear(n, l2) : null;
  if (l3 || escalator) {
    return level3(
      `active-danger signal: "${l3 ?? `${l2} + ${escalator}`}"`,
    );
  }

  // --- Anger with intent toward another person: calm de-escalation,
  //     never analysis of the grievance, never revenge planning.
  //     ("hurt himself"/"kill herself" are third-party self-harm talk,
  //      handled by the third-party branch below — excluded here.)
  const reflexive = ["himself", "herself", "themselves"].some((w) => n.includes(w));

  // --- Someone ELSE is at risk: support the supporter. This must run
  //     before the self-harm L2 vocabulary ("is suicidal" would otherwise
  //     trigger the are-YOU-safe script, which is the wrong conversation).
  const thirdParty = hasAny(n, THIRD_PARTY_RISK_SIGNALS);
  if (thirdParty) {
    return {
      riskLevel: 2,
      primaryEmotion: "fear for someone else",
      primaryNeed: "help them support a person at risk without carrying it alone",
      responseMode: "safety",
      confidence: 0.85,
      shouldAskSafetyCheck: false,
      shouldShowSOS: true,
      shouldShowHotline: true,
      quickReplies: ["Open SOS", "Help me say the right thing", "Ground me for 2 minutes"],
      reason: `third-party risk signal: "${thirdParty}"`,
      safetyFollowUp: null,
      thirdParty: true,
    };
  }

  const harm = reflexive ? null : hasAny(n, HARM_OTHERS_SIGNALS);
  if (harm) {
    return {
      riskLevel: 2,
      primaryEmotion: "anger",
      primaryNeed: "de-escalation and distance before anything else",
      responseMode: "safety",
      confidence: 0.8,
      shouldAskSafetyCheck: false,
      shouldShowSOS: true,
      shouldShowHotline: false,
      quickReplies: ["Ground me for 2 minutes", "Help me cool down", "Open SOS"],
      reason: `harm-others signal: "${harm}"`,
      safetyFollowUp: null,
      harmOthers: true,
    };
  }

  // --- Right after a risk exchange: read the answer to the safety check.
  if (recentRisk) {
    // Unsafe signals win at ANY length; negated "…safe" counts as unsafe.
    if (
      hasAny(n, UNSAFE_ANSWERS) ||
      negatedSafe(n) ||
      n === "no" ||
      n === "i dont know" ||
      n === "idk"
    ) {
      return level3("answered a safety check with an unsafe signal", "not_safe");
    }
    // Clear safe answers: exact words or unambiguous short phrases only.
    if (
      n.length <= 80 &&
      (SAFE_EXACT.includes(n) || hasAny(n, SAFE_PHRASES))
    ) {
      return {
        riskLevel: 2,
        primaryEmotion: "settling",
        primaryNeed: "grounding, then the original pain",
        responseMode: "safety",
        confidence: 0.9,
        shouldAskSafetyCheck: false,
        shouldShowSOS: true,
        shouldShowHotline: false,
        quickReplies: ["Ground me for 2 minutes", "Talk about what happened", "Open SOS"],
        reason: "confirmed they can stay safe after a safety check",
        safetyFollowUp: "confirmed_safe",
      };
    }
    // Grounding request while the safety question is open → stay in the flow.
    if (hasAny(n, GROUNDING_REQUESTS)) {
      return {
        riskLevel: 2,
        primaryEmotion: "overwhelm",
        primaryNeed: "grounding while the safety check stays open",
        responseMode: "safety",
        confidence: 0.8,
        shouldAskSafetyCheck: true,
        shouldShowSOS: true,
        shouldShowHotline: false,
        quickReplies: QUICK_REPLIES_BY_LEVEL[2],
        reason: "grounding request during recent risk context",
        safetyFollowUp: null,
        carryOver: true,
      };
    }
    // Anything else while risk language is recent: keep the safety posture
    // open instead of snapping back to normal chat ("sorry, forget it").
    if (!l2) {
      return {
        riskLevel: 2,
        primaryEmotion: nameEmotion(n, ""),
        primaryNeed: "gentle watchfulness — risk language was recent",
        responseMode: "safety",
        confidence: 0.6,
        shouldAskSafetyCheck: true,
        shouldShowSOS: true,
        shouldShowHotline: false,
        quickReplies: QUICK_REPLIES_BY_LEVEL[2],
        reason: "carry-over from recent risk language",
        safetyFollowUp: null,
        carryOver: true,
      };
    }
  }

  // --- Level 2: passive ideation, no plan or means.
  if (l2) {
    return {
      riskLevel: 2,
      primaryEmotion: nameEmotion(n, "despair"),
      primaryNeed: "safety check + emotional containment",
      responseMode: "safety",
      confidence: 0.85,
      shouldAskSafetyCheck: true,
      shouldShowSOS: true,
      shouldShowHotline: false,
      quickReplies: QUICK_REPLIES_BY_LEVEL[2],
      reason: `passive-ideation signal: "${l2}"`,
      safetyFollowUp: null,
    };
  }

  // --- Level 1: high distress, no self-harm language.
  const l1 = hasAny(n, L1_SIGNALS);
  if (l1) {
    const mode: ResponseMode = hasAny(n, CALM_SIGNALS)
      ? "calm"
      : hasAny(n, ACTION_SIGNALS)
        ? "action"
        : "calm";
    return {
      riskLevel: 1,
      primaryEmotion: nameEmotion(n, ""),
      primaryNeed: "reframe identity vs event + one next step",
      responseMode: mode,
      confidence: 0.7,
      shouldAskSafetyCheck: false,
      shouldShowSOS: false,
      shouldShowHotline: false,
      quickReplies: QUICK_REPLIES_BY_LEVEL[1],
      reason: `high-distress signal: "${l1}"`,
      safetyFollowUp: null,
    };
  }

  // --- Level 0: normal emotional weather. Pick the best mode.
  // Panic/anxiety cues only count when NOT negated ("I don't feel panic").
  const calmCue = hasAny(n, CALM_SIGNALS) && !hasAny(n, NEG_CALM);
  const flatness = hasAny(n, FLATNESS_PHYSICAL_OK) && hasAny(n, FLATNESS_MOOD_LOW);
  let mode: ResponseMode = "mirror";
  let need = "gentle reflection";
  if (hasAny(n, REPAIR_SIGNALS)) {
    // The user is challenging the last answer: acknowledge the miss, correct
    // it, get sharper. Never soft, never another poetic line.
    mode = "repair";
    need = "name the exact miss, correct it, give a sharper answer";
  } else if (hasAny(n, PATTERN_SIGNALS)) {
    mode = "pattern";
    need = "honest pattern reflection from a limited window";
  } else if (hasAny(n, NO_IMPULSE_SIGNALS)) {
    mode = "no_impulse";
    need = "slow the impulse, clarify the wanted outcome";
  } else if (hasAny(n, PRECISION_SIGNALS)) {
    // They asked how/what exactly/be specific: answer with a test, checklist,
    // or decision rule in plain language, not abstract comfort.
    mode = "precision";
    need = "a concrete test, checklist, or decision rule";
  } else if (flatness) {
    // Body ok but mood low: physical clarity does not guarantee happiness.
    mode = "flatness";
    need = "name the flat state, then one small re-entry into life";
  } else if (calmCue) {
    mode = "calm";
    need = "grounding before anything else";
  } else if (hasAny(n, ACTION_SIGNALS)) {
    mode = "action";
    need = "a small practical next step";
  } else if (hasAny(n, DEEP_SIGNALS)) {
    mode = "deep_thinking";
    need = "a wider lens, gently";
  } else if (hasAny(n, MIRROR_SIGNALS)) {
    mode = "mirror";
    need = "untangle facts, feelings, and assumptions";
  }
  return {
    riskLevel: 0,
    primaryEmotion: nameEmotion(n, ""),
    primaryNeed: need,
    responseMode: mode,
    confidence: 0.55,
    shouldAskSafetyCheck: false,
    shouldShowSOS: false,
    shouldShowHotline: false,
    quickReplies: QUICK_REPLIES_BY_LEVEL[0],
    reason: `no risk signals; mode "${mode}"`,
    safetyFollowUp: null,
  };
}

/** Map the classifier's response mode onto the chat client's wire modes. */
export function toWireMode(c: RiskClassification): WireMode {
  if (c.responseMode === "safety") return "safety";
  switch (c.responseMode) {
    case "calm": return "grounding";
    case "no_impulse": return "reset";
    case "action": return "decision";
    case "precision": return "decision";
    case "deep_thinking": return "wisdom";
    case "flatness": return "journal";
    case "repair":
    case "mirror":
    case "pattern":
    default:
      return "listen";
  }
}
