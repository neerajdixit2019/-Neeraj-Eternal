/**
 * InnerMate emotional-interpretation layer (pipeline v2, stage 1 + 2).
 *
 * Before generating a reply, a CHEAP model reads the message and returns a
 * hidden structured object: the emotion beneath the words, the underlying need,
 * the likely fear, any thinking pattern, what the user actually wants, and the
 * recommended response mode. This module is the PURE half of that stage:
 *   - the interpreter system prompt (the model returns ONLY the JSON),
 *   - a strict, fail-safe parser (`parseInterpretation` → object | null),
 *   - the routing blend that fuses the LLM read with the deterministic risk
 *     classifier, and the high-stakes / strong-model gates.
 *
 * SAFETY INVARIANT (non-negotiable): the deterministic classifier in
 * companion-risk.ts owns safety. The LLM interpretation is ADVISORY. It may
 * ESCALATE the risk floor (catch metaphor/subtext the lexical matcher misses,
 * up to Level 2 — a warm safety check + SOS, never a hard crisis lockout) but
 * it can NEVER DE-ESCALATE. Level 3 (the deterministic crisis template) is
 * reached only from lexical certainty, never from the model. If interpretation
 * fails or is malformed, the caller falls back to the rule-based routing and
 * loses nothing.
 *
 * React-free and side-effect free so it is unit-testable under node:test.
 */
import type { ResponseMode, RiskClassification, RiskLevel } from "./companion-risk";

/** Re-export of the shared mode union under a local name for callers/tests. */
export type ResponseModeLike = ResponseMode;

/** What the user is reaching for this turn. */
export type WantKind = "comfort" | "reflection" | "analysis" | "grounding" | "action";
/** Urge to text/call/check/confront/react. */
export type ImpulseRisk = "none" | "low" | "medium" | "high";
/** ADVISORY self-harm read. `active`/`passive` raise the floor to L2 only. */
export type SafetyRisk = "none" | "passive" | "active";

/** The hidden structured read (never shown to the user). */
export interface EmotionalInterpretation {
  primary_emotion: string;
  secondary_emotion: string;
  underlying_need: string;
  likely_fear: string;
  /** A cognitive distortion / thinking pattern, or "" when none is evident. */
  cognitive_pattern: string;
  wants: WantKind;
  impulse_risk: ImpulseRisk;
  safety_risk: SafetyRisk;
  /** From the SAME vocabulary as companion-risk's ResponseMode, so it maps 1:1. */
  recommended_mode: ResponseMode;
  memory_needed: boolean;
  /** 0–4 short search terms for relevant-memory retrieval. */
  memory_queries: string[];
}

const VALID_MODES: ResponseMode[] = [
  "calm", "mirror", "deep_thinking", "action", "no_impulse",
  "safety", "pattern", "repair", "precision", "flatness",
];
const VALID_WANTS: WantKind[] = ["comfort", "reflection", "analysis", "grounding", "action"];
const VALID_IMPULSE: ImpulseRisk[] = ["none", "low", "medium", "high"];
const VALID_SAFETY: SafetyRisk[] = ["none", "passive", "active"];

/**
 * Emotions heavy enough to route a turn as "high-stakes" (critic-gated + the
 * stronger model) even at risk Level 0. Matched as substrings so compound reads
 * like "grief + guilt" fire.
 */
const HEAVY_EMOTIONS = [
  "grief", "guilt", "shame", "heartbreak", "heartbroken", "hopeless", "despair",
  "longing", "worthless", "lonely", "loneliness", "abandon", "rejected", "rejection",
  "betray", "regret", "self-hate", "self hate", "numb", "empty",
];

export function isHeavyEmotion(text: string): boolean {
  const t = (text || "").toLowerCase();
  return HEAVY_EMOTIONS.some((e) => t.includes(e));
}

// ── The interpreter prompt (cheap model returns ONLY the JSON) ────────────────

export const INTERPRETER_SYSTEM_PROMPT = `You are the silent emotional-interpretation layer for InnerMate, a reflection companion. You do NOT talk to the user. You read one user message (plus a little recent context) and return ONE JSON object describing the emotional meaning beneath the literal words. Another model writes the actual reply from your read.

Return JSON ONLY, no prose, no markdown fences, exactly this shape:
{"primary_emotion":"","secondary_emotion":"","underlying_need":"","likely_fear":"","cognitive_pattern":"","wants":"comfort|reflection|analysis|grounding|action","impulse_risk":"none|low|medium|high","safety_risk":"none|passive|active","recommended_mode":"calm|mirror|deep_thinking|action|no_impulse|safety|pattern|repair|precision|flatness","memory_needed":true|false,"memory_queries":[]}

FIELD RULES
- primary_emotion / secondary_emotion: plain words (grief, guilt, shame, longing, anger, loneliness, anxiety, numbness, relief). secondary_emotion "" if none.
- underlying_need: what would actually help (validation and meaning; permission to rest; to be heard; a decision; to feel less alone).
- likely_fear: the quiet fear under the message, in the user's own frame ("my love was not real because I withdrew"). "" if not evident.
- cognitive_pattern: a thinking distortion IF clearly present (all-or-nothing, mind-reading, catastrophizing, equating love with lifelong responsibility, self-blame for others' choices). "" when none is evident — do not invent one.
- wants: the single closest fit. Someone venting grief wants comfort or reflection, not action. "I don't need analysis, I need peace" = grounding.
- impulse_risk: high only when they want to text/call/check/confront/send/react to a person right now.
- safety_risk: "active" ONLY for stated intent, plan, means, or "can't stay safe". "passive" for "no point living / better off gone / want to disappear", including metaphor and behavioral leakage the keyword layer might miss (giving things away, "a permanent solution", "book a ticket out of this world"). "none" otherwise. Be conservative UPWARD: when unsure between none and passive on a dark message, choose passive. A safety net owns the hard calls; you only flag.
- recommended_mode: calm (panic/overwhelm they show), mirror (untangle facts/feelings/assumptions/guilt/responsibility), deep_thinking (meaning/love/values/forgiveness/identity), action (what-do-I-do), no_impulse (urge to text/check/react), pattern (asking about their patterns), repair (challenging the app: vague/wrong/qualifications), precision (be specific/how exactly/how do I know), flatness (body ok but mood low), safety (any self-harm read). Never pick safety unless safety_risk is passive or active.
- memory_needed: true only when a specific past event/person/decision would sharpen the reply. memory_queries: 0 to 4 short phrases to search their saved memories (e.g. "relationship withdrawal guilt", "decision not to contact her"). Empty when memory_needed is false.

Read the DEEPEST question, not the surface words. "I really loved her." is rarely a request for comfort about the past tense — it is often guilt asking whether the love was real. Never output anything but the JSON object.`;

// ── Parsing (fail-safe: any malformation → null → caller falls back) ──────────

const pick = <T,>(v: unknown, valid: readonly T[], fallback: T): T =>
  (valid as readonly unknown[]).includes(v) ? (v as T) : fallback;

export function parseInterpretation(raw: string): EmotionalInterpretation | null {
  try {
    const cleaned = String(raw).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    const o = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const queries = Array.isArray(o.memory_queries)
      ? o.memory_queries.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4)
      : [];
    const memory_needed = !!o.memory_needed && queries.length > 0;
    return {
      primary_emotion: str(o.primary_emotion) || "unclear",
      secondary_emotion: str(o.secondary_emotion),
      underlying_need: str(o.underlying_need),
      likely_fear: str(o.likely_fear),
      cognitive_pattern: str(o.cognitive_pattern),
      wants: pick(o.wants, VALID_WANTS, "reflection"),
      impulse_risk: pick(o.impulse_risk, VALID_IMPULSE, "none"),
      safety_risk: pick(o.safety_risk, VALID_SAFETY, "none"),
      recommended_mode: pick(o.recommended_mode, VALID_MODES, "mirror"),
      memory_needed,
      memory_queries: memory_needed ? queries : [],
    };
  } catch {
    return null;
  }
}

// ── Routing blend (deterministic safety authority + LLM refinement) ──────────

/** Map an advisory LLM safety read to a risk FLOOR. Capped at 2 — Level 3 is
 *  deterministic-only. */
function safetyFloor(s: SafetyRisk): RiskLevel {
  return s === "none" ? 0 : 2;
}

export interface RoutingDecision {
  /** The response mode the writer will use. */
  mode: ResponseMode;
  /** max(deterministic risk, advisory LLM floor). Never below deterministic. */
  effectiveRiskLevel: RiskLevel;
  /** True when the LLM raised the floor above the lexical classifier. */
  escalatedBySubtext: boolean;
  /** Critic-gate this turn (generate → evaluate → maybe regenerate → show)? */
  gate: boolean;
  /** Use the stronger response model for this (emotionally hard) turn? */
  strongModel: boolean;
}

/**
 * Fuse the deterministic risk classification with the (possibly null) LLM
 * interpretation. Safety wins: the effective risk is never below the
 * deterministic level; the LLM can only raise it (to L2). When interpretation
 * is null we degrade gracefully to the pure rule-based routing.
 */
export function blendRouting(
  interp: EmotionalInterpretation | null,
  risk: Pick<RiskClassification, "riskLevel" | "responseMode" | "primaryEmotion">,
): RoutingDecision {
  const floor = interp ? safetyFloor(interp.safety_risk) : 0;
  const effectiveRiskLevel = Math.max(risk.riskLevel, floor) as RiskLevel;
  const escalatedBySubtext = floor > risk.riskLevel;

  let mode: ResponseMode;
  if (effectiveRiskLevel >= 2) {
    mode = "safety"; // deterministic OR subtext-escalated risk → safety, always
  } else if (interp && interp.recommended_mode !== "safety") {
    mode = interp.recommended_mode; // LLM refines the mode for L0/L1
  } else {
    mode = risk.responseMode; // no interp (or it over-claimed safety) → rules
  }

  const heavy = isHeavyEmotion(
    `${interp?.primary_emotion ?? ""} ${interp?.secondary_emotion ?? ""} ${risk.primaryEmotion ?? ""}`,
  );
  // Critic-gate the turns where a generic/wrong reply is costliest: any
  // distress, subtext-escalation, an urge to act, a heavy emotion, or the
  // "hard emotional" modes (safety, repair, no-impulse, existential meaning,
  // flatness). Plain mirror/calm/action/pattern/precision turns stream live.
  const gate =
    effectiveRiskLevel >= 1 ||
    escalatedBySubtext ||
    heavy ||
    interp?.impulse_risk === "high" ||
    mode === "safety" || mode === "repair" || mode === "no_impulse" ||
    mode === "deep_thinking" || mode === "flatness";

  const strongModel =
    effectiveRiskLevel >= 1 ||
    escalatedBySubtext ||
    heavy ||
    interp?.impulse_risk === "high" ||
    mode === "safety" || mode === "deep_thinking" || mode === "mirror" ||
    mode === "repair" || mode === "flatness";

  return { mode, effectiveRiskLevel, escalatedBySubtext, gate, strongModel };
}

/** Standalone high-stakes test (mirrors blendRouting.gate) for callers/tests. */
export function isHighStakes(
  interp: EmotionalInterpretation | null,
  risk: Pick<RiskClassification, "riskLevel" | "responseMode" | "primaryEmotion">,
): boolean {
  return blendRouting(interp, risk).gate;
}

/** Standalone strong-model test (mirrors blendRouting.strongModel). */
export function needsStrongModel(
  interp: EmotionalInterpretation | null,
  risk: Pick<RiskClassification, "riskLevel" | "responseMode" | "primaryEmotion">,
): boolean {
  return blendRouting(interp, risk).strongModel;
}
