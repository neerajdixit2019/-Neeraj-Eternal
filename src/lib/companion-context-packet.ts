/**
 * InnerMate context-packet builder (pipeline v2, stage 4). PURE.
 *
 * Turns the interpretation + routing + ranked memories + pattern summary into a
 * concise, per-turn steering block appended to COMPANION_SYSTEM_PROMPT. The big
 * base prompt already encodes InnerMate's voice and mode craft; this packet
 * gives THIS turn its target: the inferred need, the selected mode, the memory
 * to use sparingly, what to avoid, and how long to be. It never restates the
 * base prompt.
 */
import type { ResponseMode, RiskLevel } from "./companion-risk";
import type { EmotionalInterpretation, WantKind } from "./companion-interpret";
import type { RankedMemory, EmotionalPatternSummary } from "./companion-memory";

export type DesiredLength = "short" | "medium" | "long";

/** Always-on guards + per-mode additions. Keeps replies from the generic tells. */
export function avoidListFor(
  mode: ResponseMode,
  interp: EmotionalInterpretation | null,
): string[] {
  const base = [
    "generic comfort that could apply to anyone",
    "therapy jargon and customer-support phrasing",
    "motivational quotes",
    'repeating "I understand"',
    "false certainty about another person's thoughts or motives",
    "more than one question",
  ];
  if (mode !== "action" && mode !== "precision" && mode !== "pattern") {
    base.push("bullet-point lists in an emotional reply");
  }
  if (mode !== "calm" && mode !== "safety") {
    base.push("breathing or grounding exercises nobody asked for");
  }
  if (interp?.impulse_risk === "high" || mode === "no_impulse") {
    base.push("any encouragement to text, call, check, confront, or send right now");
  }
  if (mode === "repair") {
    base.push("another soft or poetic line; apologising more than once; getting defensive");
  }
  if (mode === "deep_thinking" || mode === "mirror") {
    base.push("collapsing love, guilt, responsibility, fear and ego into one word");
  }
  return base;
}

/** Match reply length to the emotional state and the ask. */
export function desiredLengthFor(
  mode: ResponseMode,
  effectiveRiskLevel: RiskLevel,
  wants: WantKind | undefined,
): DesiredLength {
  if (mode === "calm" || mode === "safety") return "short";
  if (wants === "grounding" || wants === "comfort") return "short";
  if (mode === "precision" || mode === "action" || mode === "repair") return "medium";
  if (mode === "deep_thinking" || effectiveRiskLevel >= 1) return "medium";
  return "short";
}

const LENGTH_HINT: Record<DesiredLength, string> = {
  short: "2 to 3 short sentences (~40 words). Short invites them to keep talking.",
  medium: "up to ~120 words, in short paragraphs; a checklist only if they asked how.",
  long: "up to ~180 words when usefulness genuinely needs it; every line must earn its place.",
};

export interface PacketInput {
  message: string;
  interp: EmotionalInterpretation | null;
  mode: ResponseMode;
  effectiveRiskLevel: RiskLevel;
  escalatedBySubtext: boolean;
  memories: RankedMemory[];
  pattern?: EmotionalPatternSummary | null;
  /** The reader's UI language, for the closing steer. */
  lang?: "en" | "hi";
}

/**
 * Build the steering block. Returned as text appended after the base system
 * prompt + existing context. Never contains hotline numbers (those are the
 * deterministic layer's job) and never leaks the raw JSON to the user.
 */
export function buildContextPacket(input: PacketInput): string {
  const { interp, mode, effectiveRiskLevel, escalatedBySubtext, memories, pattern } = input;
  const length = desiredLengthFor(mode, effectiveRiskLevel, interp?.wants);
  const lines: string[] = [];

  lines.push("PER-TURN READ (silent; never quote this back, never show the user):");
  if (interp) {
    lines.push(`- Beneath the words: ${interp.primary_emotion}${interp.secondary_emotion ? ` + ${interp.secondary_emotion}` : ""}.`);
    if (interp.underlying_need) lines.push(`- What would actually help: ${interp.underlying_need}.`);
    if (interp.likely_fear) lines.push(`- The quiet fear: ${interp.likely_fear}.`);
    if (interp.cognitive_pattern) lines.push(`- A thinking pattern to gently loosen, not diagnose: ${interp.cognitive_pattern}.`);
  } else {
    lines.push("- (Interpretation unavailable — read the message directly and stay conservative.)");
  }

  lines.push(`RESPONSE MODE: ${mode}. Answer the deepest question, not the literal wording.`);
  lines.push("Give ONE strong, specific insight before any advice. Acknowledge the feeling without agreeing with the user's harshest conclusion about themselves.");

  if (memories.length) {
    lines.push("RELEVANT MEMORY (use at most one, naturally, only if it fits — never recite):");
    for (const m of memories) {
      lines.push(`- [${m.date}] "${m.title}" (${m.feeling_tag ?? "no tag"}; relevance ${m.confidence}): ${m.snippet}`);
    }
  } else if (interp?.memory_needed) {
    lines.push("RELEVANT MEMORY: none matched — say honestly you don't have that context rather than inventing it.");
  }

  if (pattern && (pattern.recurring_trigger || pattern.common_emotion) && mode === "pattern") {
    lines.push(`PATTERN (a small, honest window of ${pattern.sampleSize} check-ins; the full picture lives in Insights): recurring ${pattern.common_emotion || "feeling"}${pattern.recurring_trigger ? ` around ${pattern.recurring_trigger}` : ""}, mood ${pattern.arc}.`);
  }
  if (pattern?.boundaries.length) {
    lines.push(`They earlier chose: ${pattern.boundaries.join("; ")}. Honour it; never push them to break it.`);
  }

  if (escalatedBySubtext) {
    lines.push("SAFETY: the message reads heavier than its words. Stay warm and watchful; weave in ONE gentle safe/not-safe check without turning the reply into a script. Point to the SOS button, never a phone number.");
  }

  lines.push(`AVOID: ${avoidListFor(mode, interp).join("; ")}.`);
  lines.push(`LENGTH: ${LENGTH_HINT[length]}`);
  lines.push("Be honest when the context is thin. At most ONE meaningful question, and only if it genuinely helps.");

  return lines.join("\n");
}
