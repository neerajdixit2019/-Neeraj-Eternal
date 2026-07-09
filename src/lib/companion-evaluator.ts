/**
 * InnerMate response evaluation layer.
 *
 * Scores a DRAFT reply across 10 dimensions before it is shown, and decides
 * PASS / REWRITE / SHOW_WITH_MINOR_EDIT. The heavy, judgment-based scoring is
 * done by the model (EVALUATOR_SYSTEM_PROMPT below, returns the JSON contract);
 * this module provides:
 *   - fast, dependency-free DETERMINISTIC pre-checks (anti-vagueness density,
 *     banned universal claims, grounding-when-no-distress, specificity markers)
 *     that catch the worst failures without a model call,
 *   - the exact aggregation rule and JSON shape,
 *   - the per-evaluator rewrite-instruction map,
 *   - the fallback reply and the log record shape.
 *
 * Safety note: this layer NEVER decides safety escalation. Risk is owned by the
 * deterministic classifier (companion-risk.ts) BEFORE generation. The evaluator
 * can only flag an over- or under-escalation for logging/rewrite; it can never
 * downgrade a Level 2/3 reply. If the evaluator errors, the caller shows the
 * draft unchanged (fail-open, never block a reply).
 *
 * Pure and side-effect free so it is unit-testable and safe to run anywhere.
 */
import type { ResponseMode } from "./companion-risk";

export type SafetyScope = "PASS" | "FAIL";
export type Decision = "PASS" | "REWRITE" | "SHOW_WITH_MINOR_EDIT";

export interface EvaluatorScores {
  intent_fit: number;            // 1-5
  mode_routing: number;          // 1-5
  specificity: number;           // 1-5
  emotional_accuracy: number;    // 1-5
  challenge_repair: number;      // 1-5
  practical_usefulness: number;  // 1-5
  anti_vagueness: number;        // 1-5
  contradiction_claims: number;  // 1-5
  safety_scope: SafetyScope;
  user_respect: number;          // 1-5
}

/** The JSON contract the model evaluator returns (also the module's output). */
export interface EvaluationResult {
  pass: boolean;
  overall_score: number;         // 1-5, mean of the numeric scores
  detected_user_state: string;
  selected_mode: string;
  failed_evaluators: string[];
  scores: EvaluatorScores;
  rewrite_instruction: string;
  approved_response: string;     // set when pass or minor-edit
  rewritten_response: string;    // filled by the caller after a regeneration
  decision: Decision;
}

/** What gets logged per turn (never shown to the user). */
export interface EvaluationLog {
  user_message: string;
  draft_response: string;
  detected_mode: string;
  detected_user_state: string;
  evaluator_scores: EvaluatorScores;
  failed_evaluators: string[];
  rewrite_instruction: string;
  final_response: string;
  pass: boolean;
  attempts: number;
  timestamp: string;
}

// ── Per-evaluator rewrite instructions (spec §"Rewrite instruction") ─────────

export const REWRITE_INSTRUCTIONS: Record<keyof EvaluatorScores, string> = {
  intent_fit:
    "Answer the user's exact question directly. Start with the answer, then give a concrete framework or example.",
  mode_routing: "Reroute to the correct mode and rewrite the answer accordingly.",
  specificity:
    "Make the answer specific. Add a checklist, decision rule, observable signs, or a 10-minute action.",
  emotional_accuracy: "Name the user's likely state more accurately and answer from that state.",
  challenge_repair:
    "Use Repair Mode. Say exactly what was wrong and give a sharper answer. Do not become softer or more poetic.",
  practical_usefulness: "Add one useful action the user can do now or one decision rule they can apply.",
  anti_vagueness: "Reduce abstract language by 70 percent. Replace with plain, concrete explanation.",
  contradiction_claims: "Remove the universal claim. Add nuance. Correct any contradiction.",
  safety_scope: "", // filled contextually (see composeRewriteInstruction)
  user_respect:
    "Assume the user is intelligent and asking for real clarity. Answer with depth and directness, no soothing.",
};

/** The two-attempt fallback reply (spec §"IMPLEMENTATION FLOW" step 7). */
export const EVALUATOR_FALLBACK_REPLY =
  "I'm not answering sharply enough. Let me reset. Are you asking for: 1. emotional clarity, 2. practical next step, 3. meaning, 4. a decision rule, or 5. a direct answer?";

// ── Deterministic signal lists ───────────────────────────────────────────────

/** Soft/poetic words that must be EARNED. High density -> low anti-vagueness. */
const VAGUE_WORDS = [
  "maybe", "gentle", "gently", "wisdom", "space inside", "witnessed", "witness",
  "listen to your body", "return to life", "enough for now", "let it be enough",
  "quiet", "soften", "soft", "arrive slowly", "sit with it", "hold space",
  "the ache", "tender", "stillness", "presence",
];

/** Universal / exaggerated claims the reply must never assert as fact. */
const BANNED_CLAIMS = [
  "the body tells you first", "the body will tell you first", "rest should make you happy",
  "rest will make you happy", "if you feel clear you are ready",
  "if you feel clear, you are ready", "if you are unsettled you need grounding",
  "if you are unsettled, you need grounding", "everything happens for a reason",
];

/** Grounding/panic-recovery cues that must NOT appear when there's no distress. */
const GROUNDING_CUES = [
  "breathe with me", "take a breath", "one slow breath", "4-4-6", "4 4 6",
  "hand on your chest", "hand somewhere steady", "feet on the floor",
  "name five things", "name 5 things", "breathing exercise", "inhale", "exhale",
  "ground yourself", "grounding",
];

/** Concrete-answer markers: numbers, steps, tests, conditionals, checkable signs. */
const SPECIFIC_MARKERS = [
  /\b\d[.)]/,             // "1." "2)"
  /(^|\n)\s*[-*]\s+/,      // bullet lines
  /\bif\b.+\bthen\b/i,     // if/then
  /\bcheck\b|\btest\b|\bstep\b|\bsigns?\b|\brule\b|\btry\b|\bfor \d+ minutes?\b/i,
];

/** At least one usable takeaway: action, self-check, decision rule, question. */
const USEFUL_MARKERS = [
  /\btry\b|\bdo one\b|\bwrite\b|\bwalk\b|\bfor \d+ minutes?\b/i,
  /\bif\b.+\bthen\b/i,
  /\?\s*$/m,               // a question
  /\bcheck\b|\bask yourself\b|\bnotice\b|\brule\b/i,
];

/** Repair acknowledgment phrases (for the challenge-repair evaluator). */
const REPAIR_ACK = [
  "you're right", "youre right", "fair", "i missed", "i overstated",
  "i misread", "that didn't fit", "that didnt fit", "more accurate",
];

const norm = (s: string) => s.toLowerCase();
const countOccurrences = (hay: string, needles: string[]) =>
  needles.reduce((n, w) => (hay.includes(w) ? n + 1 : n), 0);
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

// ── Deterministic evaluators ─────────────────────────────────────────────────

export interface DraftContext {
  userMessage: string;
  mode: ResponseMode;
  riskLevel: number;
  /** True when the user explicitly asked for precision/specifics. */
  askedPrecision: boolean;
  /** True when the user is challenging (repair). */
  isChallenge: boolean;
}

/**
 * Cheap deterministic scoring. Numeric scores default to a passing 4 and are
 * only pulled DOWN by concrete red flags — the model judge refines upward. This
 * makes the module a conservative gate: it flags clear failures, never invents
 * praise.
 */
export function deterministicScores(draft: string, ctx: DraftContext): EvaluatorScores {
  const d = norm(draft);
  const words = wordCount(draft);

  // Anti-vagueness: density of soft words per ~40 words.
  const vagueHits = countOccurrences(d, VAGUE_WORDS);
  const density = words ? vagueHits / (words / 40) : vagueHits;
  let anti_vagueness = density >= 3 ? 1 : density >= 2 ? 2 : density >= 1 ? 3 : 5;
  if (ctx.askedPrecision && vagueHits > 0 && !SPECIFIC_MARKERS.some((re) => re.test(draft))) {
    anti_vagueness = Math.min(anti_vagueness, 2);
  }

  // Contradiction / universal claims.
  const claimHit = BANNED_CLAIMS.some((c) => d.includes(c));
  const contradiction_claims = claimHit ? 2 : 5;

  // This is a CONSERVATIVE gate: numeric scores default to a passing 4 and are
  // only pulled DOWN by measurable red flags. Concrete answers often live in
  // plain prose ("open a note, write it, don't send it"), which no keyword
  // regex catches, so we never fail a reply merely for LACKING markers. The
  // model judge does the nuanced positive scoring; this catches clear misses.
  const isVague = anti_vagueness <= 2; // measurable fog, not just missing keywords
  const hasSpecific = SPECIFIC_MARKERS.some((re) => re.test(draft));

  // Specificity: 5 with explicit structure; else neutral-pass 4; only fail when
  // precision was asked AND the reply is measurably vague.
  let specificity = hasSpecific ? 5 : 4;
  if (ctx.askedPrecision && isVague) specificity = 2;

  // Practical usefulness: 5 with an explicit action/check/rule/question; else a
  // neutral-passing 4; only a foggy reply with nothing to do drops to 2.
  let practical_usefulness = USEFUL_MARKERS.some((re) => re.test(draft)) ? 5 : 4;
  if (isVague && !USEFUL_MARKERS.some((re) => re.test(draft))) practical_usefulness = 2;

  // Mode routing: the reliable deterministic tell is grounding cues with no
  // distress; and a repair turn that never acknowledges the miss.
  const groundingLeak = GROUNDING_CUES.some((c) => d.includes(c));
  let mode_routing = 5;
  if (groundingLeak && ctx.mode !== "calm" && ctx.riskLevel < 2) mode_routing = 2;
  if (ctx.mode === "repair" && !REPAIR_ACK.some((a) => d.includes(a))) mode_routing = Math.min(mode_routing, 3);

  // Challenge repair: only meaningful when the user challenged.
  let challenge_repair = 5;
  if (ctx.isChallenge) {
    const acked = REPAIR_ACK.some((a) => d.includes(a));
    const sharper = hasSpecific || words >= 25;
    const apologies = countOccurrences(d, ["sorry", "apologi", "my apologies"]);
    challenge_repair = acked && sharper ? (apologies > 1 ? 3 : 5) : acked ? 3 : 1;
  }

  // Intent fit / emotional accuracy / user respect: weak deterministically.
  // Start neutral-passing; pull down on obvious tells. The model judge is
  // authoritative for these three.
  let intent_fit = 4;
  if (ctx.askedPrecision && isVague) intent_fit = 2;
  if (ctx.isChallenge && challenge_repair <= 2) intent_fit = 2;

  let user_respect = 4;
  if (groundingLeak && ctx.riskLevel < 2 && !ctx.mode.startsWith("calm")) user_respect = 2;
  if (isVague && ctx.askedPrecision) user_respect = Math.min(user_respect, 3);

  const emotional_accuracy = groundingLeak && ctx.riskLevel < 2 ? 2 : 4;

  // Safety scope: risk is owned upstream. Deterministically PASS unless the
  // draft introduces crisis machinery on a Level-0 turn (over-trigger) or omits
  // a safety check on a Level-2 turn (under-trigger).
  const introducesCrisis = /\bsos\b|hotline|emergency (services|number)|are you (safe|in danger)/i.test(draft);
  let safety_scope: SafetyScope = "PASS";
  if (ctx.riskLevel === 0 && introducesCrisis) safety_scope = "FAIL"; // over-triggered
  if (ctx.riskLevel >= 2 && !/safe or not safe|stay safe|are you (safe|in danger)/i.test(draft)) {
    safety_scope = "FAIL"; // under-triggered
  }

  return {
    intent_fit, mode_routing, specificity, emotional_accuracy, challenge_repair,
    practical_usefulness, anti_vagueness, contradiction_claims, safety_scope, user_respect,
  };
}

// ── Aggregation (spec §"FINAL AGGREGATION RULE") ─────────────────────────────

const NUMERIC_KEYS: (keyof EvaluatorScores)[] = [
  "intent_fit", "mode_routing", "specificity", "emotional_accuracy",
  "challenge_repair", "practical_usefulness", "anti_vagueness",
  "contradiction_claims", "user_respect",
];

export function meanScore(s: EvaluatorScores): number {
  const sum = NUMERIC_KEYS.reduce((n, k) => n + (s[k] as number), 0);
  return Math.round((sum / NUMERIC_KEYS.length) * 100) / 100;
}

export function failedEvaluators(s: EvaluatorScores): string[] {
  const failed: string[] = [];
  for (const k of NUMERIC_KEYS) if ((s[k] as number) < 4) failed.push(k);
  if (s.safety_scope === "FAIL") failed.push("safety_scope");
  return failed;
}

export function decide(s: EvaluatorScores, askedPrecision: boolean): Decision {
  // REWRITE conditions (any):
  const criticalFail =
    s.intent_fit < 4 || s.mode_routing < 4 || s.specificity < 4 ||
    s.challenge_repair < 4 || s.safety_scope === "FAIL";
  const belowAverage = meanScore(s) < 4;
  const vagueWhenPrecise = s.anti_vagueness < 4 && askedPrecision;
  if (criticalFail || belowAverage || vagueWhenPrecise) return "REWRITE";

  // PASS conditions: no critical fail, intent/mode/specificity >= 4, safety PASS.
  if (
    s.intent_fit >= 4 && s.mode_routing >= 4 && s.specificity >= 4 &&
    s.safety_scope === "PASS"
  ) return "PASS";

  // Otherwise only tone/wording issues remain.
  return "SHOW_WITH_MINOR_EDIT";
}

/** Compose one rewrite instruction from the failed evaluators (most critical first). */
export function composeRewriteInstruction(
  s: EvaluatorScores,
  failed: string[],
  ctx: { riskLevel: number },
): string {
  const order: (keyof EvaluatorScores)[] = [
    "safety_scope", "intent_fit", "mode_routing", "specificity", "challenge_repair",
    "contradiction_claims", "anti_vagueness", "practical_usefulness",
    "emotional_accuracy", "user_respect",
  ];
  const parts: string[] = [];
  for (const k of order) {
    if (!failed.includes(k)) continue;
    if (k === "safety_scope") {
      parts.push(
        ctx.riskLevel >= 2
          ? "Use the safety script: meet the pain, ask one safe/not-safe check, point to SOS."
          : "Do not escalate. Remove crisis language and use reflective support.",
      );
    } else {
      parts.push(REWRITE_INSTRUCTIONS[k]);
    }
  }
  return parts.join(" ");
}

/**
 * Full deterministic evaluation of a draft: scores, decision, and (when a
 * rewrite is needed) the composed rewrite instruction. The model judge can
 * override the numeric scores; this is the fast path and the offline test path.
 */
export function evaluateDraft(
  draft: string,
  ctx: DraftContext & { detectedUserState?: string },
): EvaluationResult {
  const scores = deterministicScores(draft, ctx);
  const failed = failedEvaluators(scores);
  const decision = decide(scores, ctx.askedPrecision);
  const pass = decision === "PASS";
  return {
    pass,
    overall_score: meanScore(scores),
    detected_user_state: ctx.detectedUserState ?? "",
    selected_mode: ctx.mode,
    failed_evaluators: failed,
    scores,
    rewrite_instruction: decision === "REWRITE" ? composeRewriteInstruction(scores, failed, ctx) : "",
    approved_response: decision === "REWRITE" ? "" : draft,
    rewritten_response: "",
    decision,
  };
}

// ── The model judge prompt (returns the JSON contract) ───────────────────────

export const EVALUATOR_SYSTEM_PROMPT = `You are the quality gate for InnerMate, a reflection companion. You score a DRAFT reply before it reaches the user. InnerMate must be accurate first, useful second, warm third, poetic only when earned.

You will be given: the USER MESSAGE, the DETECTED MODE, and the DRAFT reply.

Score each dimension 1 to 5 (safety is PASS/FAIL):
1. intent_fit — does the draft answer the user's actual question directly? (5 = answers the exact question; 1 = avoids or misses it)
2. mode_routing — is the right mode used? Calm only for real panic/overwhelm; Precision for how/specific/how-do-I-know; Repair for vague/wrong/bullshit/contradiction/qualifications; Emotional Flatness (Reflective Clarity) for body-ok-but-mood-low; No-Impulse for text/check/react/decide; Action for what-to-do; Deep Thinking for meaning/guilt/love/values; Emergency only for real risk. "I don't feel panic" must NOT be Calm. "Be specific" must be Precision. "This is vague/bullshit" must be Repair. "Body clear but not happy" is Emotional Flatness. Qualifications challenge is Repair + humility.
3. specificity — concrete signals, examples, steps, tests, or decision rules present? ("Listen to your body" without how = fail.)
4. emotional_accuracy — correct read of the user's state (panic, grief, shame, anger, loneliness, emotional flatness, avoidance, restlessness, attachment loop, decision confusion, philosophical dissatisfaction, or user testing app quality)? Calm dissatisfaction is NOT panic; criticism of the app is NOT crisis.
5. challenge_repair — when challenged, does it acknowledge the exact failure, correct it, and give a sharper answer without repeated apology or poetry? (Only judged if the user is challenging; otherwise 5.)
6. practical_usefulness — can the user do something after reading (action, self-check, decision rule, test, reframe, journaling question, delay rule, or a small action under 10 minutes)?
7. anti_vagueness — clear and grounded vs foggy/poetic. Words like maybe, gentle, wisdom, space, witnessed, quiet, soften, "listen to your body", "return to life", "enough for now" must be earned by accuracy.
8. contradiction_claims — no universal or exaggerated claims. Never "the body tells you first", "rest should make you happy", "if you feel clear you are ready", "if unsettled you need grounding", or any medical/therapy certainty.
9. safety_scope — PASS unless Emergency handling is missed (real self-harm, harm to others, abuse, medical emergency, violence, severe panic) or OVER-triggered (escalating on normal sadness, anger at the app, dissatisfaction, boredom, philosophy, flatness, or "I am not happy").
10. user_respect — respects the user's intelligence; not patronizing, over-soothing, too basic, or a meditation script when they asked for precision.

AGGREGATION:
- PASS only if no critical evaluator failed AND intent_fit >= 4 AND mode_routing >= 4 AND specificity >= 4 AND safety_scope = PASS.
- REWRITE if any of intent_fit, mode_routing, specificity, challenge_repair, or safety fails, OR the average is below 4, OR anti_vagueness < 4 while the user asked for precision.
- SHOW_WITH_MINOR_EDIT if only tone/wording is off but the answer is accurate and useful.

Return JSON ONLY, no prose, exactly this shape:
{"pass":true|false,"overall_score":1-5,"detected_user_state":"","selected_mode":"","failed_evaluators":[],"scores":{"intent_fit":1-5,"mode_routing":1-5,"specificity":1-5,"emotional_accuracy":1-5,"challenge_repair":1-5,"practical_usefulness":1-5,"anti_vagueness":1-5,"contradiction_claims":1-5,"safety_scope":"PASS"|"FAIL","user_respect":1-5},"rewrite_instruction":"","approved_response":"","rewritten_response":""}

If REWRITE, put a single concrete rewrite_instruction that tells the writer exactly what to fix (answer the exact question, reroute the mode, add a checklist/test, remove the universal claim, cut abstract language, etc.). Never show this JSON to the user.`;

/** Parse + harden the model judge's JSON. Returns null on any malformation so
 *  the caller fails open (shows the draft) rather than blocking a reply. */
export function parseEvaluation(raw: string): EvaluationResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    const o = JSON.parse(cleaned.slice(start, end + 1));
    const s = o.scores ?? {};
    const clamp = (v: unknown) => Math.max(1, Math.min(5, Math.round(Number(v) || 0)));
    const scores: EvaluatorScores = {
      intent_fit: clamp(s.intent_fit), mode_routing: clamp(s.mode_routing),
      specificity: clamp(s.specificity), emotional_accuracy: clamp(s.emotional_accuracy),
      challenge_repair: clamp(s.challenge_repair), practical_usefulness: clamp(s.practical_usefulness),
      anti_vagueness: clamp(s.anti_vagueness), contradiction_claims: clamp(s.contradiction_claims),
      safety_scope: s.safety_scope === "FAIL" ? "FAIL" : "PASS",
      user_respect: clamp(s.user_respect),
    };
    return {
      pass: !!o.pass,
      overall_score: typeof o.overall_score === "number" ? o.overall_score : meanScore(scores),
      detected_user_state: String(o.detected_user_state ?? ""),
      selected_mode: String(o.selected_mode ?? ""),
      failed_evaluators: Array.isArray(o.failed_evaluators) ? o.failed_evaluators.map(String) : failedEvaluators(scores),
      scores,
      rewrite_instruction: String(o.rewrite_instruction ?? ""),
      approved_response: String(o.approved_response ?? ""),
      rewritten_response: String(o.rewritten_response ?? ""),
      decision: o.pass ? "PASS" : "REWRITE",
    };
  } catch {
    return null;
  }
}
