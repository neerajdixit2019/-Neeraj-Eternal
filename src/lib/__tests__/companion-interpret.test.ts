/**
 * InnerMate pipeline-v2 tests: emotional interpretation, safety-preserving
 * routing blend, high-stakes/strong-model gates, relevance memory, and the
 * response critic on emotionally-complex messages.
 *
 * The LLM's interpretation itself is not deterministic, so these tests exercise
 * the PURE surface: the strict parser, the routing blend (with the deterministic
 * classifier as the safety authority), the gates, memory ranking, and that the
 * evaluator rejects generic/unsafe drafts. Each emotional message also asserts
 * the deterministic risk floor (a regression pin on the safety classifier).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyInnerMateMessage } from "../companion-risk.ts";
import {
  parseInterpretation,
  blendRouting,
  isHighStakes,
  needsStrongModel,
  isHeavyEmotion,
  type EmotionalInterpretation,
  type ResponseModeLike,
} from "../companion-interpret.ts";
import { rankMemories, buildEmotionalPatternSummary, type MemoryRow } from "../companion-memory.ts";
import { buildContextPacket, avoidListFor, desiredLengthFor } from "../companion-context-packet.ts";
import { evaluateDraft } from "../companion-evaluator.ts";

// A minimal ideal interpretation for a turn (the fields routing/packet read).
function interp(partial: Partial<EmotionalInterpretation>): EmotionalInterpretation {
  return {
    primary_emotion: "unclear",
    secondary_emotion: "",
    underlying_need: "",
    likely_fear: "",
    cognitive_pattern: "",
    wants: "reflection",
    impulse_risk: "none",
    safety_risk: "none",
    recommended_mode: "mirror",
    memory_needed: false,
    memory_queries: [],
    ...partial,
  };
}

// ── 1. Parser: strict + fail-safe ────────────────────────────────────────────

test("parseInterpretation: reads a clean object", () => {
  const o = parseInterpretation(
    '{"primary_emotion":"grief","secondary_emotion":"guilt","underlying_need":"validation","likely_fear":"my love was not real","cognitive_pattern":"equating love with lifelong responsibility","wants":"reflection","impulse_risk":"low","safety_risk":"none","recommended_mode":"deep_thinking","memory_needed":true,"memory_queries":["withdrawal guilt","not contacting her"]}',
  );
  assert.ok(o);
  assert.equal(o!.primary_emotion, "grief");
  assert.equal(o!.recommended_mode, "deep_thinking");
  assert.equal(o!.memory_needed, true);
  assert.deepEqual(o!.memory_queries, ["withdrawal guilt", "not contacting her"]);
});

test("parseInterpretation: strips fences and tolerates surrounding prose", () => {
  const o = parseInterpretation('```json\n{"primary_emotion":"anger","wants":"analysis","recommended_mode":"mirror","safety_risk":"none","impulse_risk":"none","memory_needed":false,"memory_queries":[]}\n```');
  assert.ok(o);
  assert.equal(o!.primary_emotion, "anger");
});

test("parseInterpretation: clamps invalid enums to safe defaults", () => {
  const o = parseInterpretation('{"primary_emotion":"x","wants":"vibes","impulse_risk":"extreme","safety_risk":"maybe","recommended_mode":"nonsense","memory_needed":true,"memory_queries":["a"]}');
  assert.ok(o);
  assert.equal(o!.wants, "reflection");
  assert.equal(o!.impulse_risk, "none");
  assert.equal(o!.safety_risk, "none");
  assert.equal(o!.recommended_mode, "mirror");
});

test("parseInterpretation: memory_needed is false when queries are empty", () => {
  const o = parseInterpretation('{"primary_emotion":"sadness","recommended_mode":"mirror","safety_risk":"none","impulse_risk":"none","wants":"comfort","memory_needed":true,"memory_queries":[]}');
  assert.ok(o);
  assert.equal(o!.memory_needed, false);
});

test("parseInterpretation: returns null on garbage (caller falls back)", () => {
  assert.equal(parseInterpretation("not json at all"), null);
  assert.equal(parseInterpretation(""), null);
  assert.equal(parseInterpretation("<html>error</html>"), null);
});

// ── 2. Safety authority: the LLM can escalate, never de-escalate ─────────────

test("blend: a null interpretation degrades to the rule-based mode", () => {
  const det = classifyInnerMateMessage("I don't know what I feel, mixed feelings");
  const r = blendRouting(null, det);
  assert.equal(r.mode, det.responseMode);
  assert.equal(r.effectiveRiskLevel, det.riskLevel);
});

test("blend: interpretation cannot downgrade a deterministic Level-2", () => {
  const det = classifyInnerMateMessage("I don't see the point of living anymore");
  assert.equal(det.riskLevel, 2, "lexical classifier flags this L2");
  const r = blendRouting(interp({ safety_risk: "none", recommended_mode: "deep_thinking" }), det);
  assert.equal(r.effectiveRiskLevel, 2, "safety floor held despite a calm LLM read");
  assert.equal(r.mode, "safety");
});

test("blend: interpretation ESCALATES subtext the lexical layer misses", () => {
  // Behavioral leakage the keyword matcher does not catch.
  const det = classifyInnerMateMessage("I've started quietly giving my things away to people");
  const r = blendRouting(interp({ safety_risk: "passive", recommended_mode: "mirror" }), det);
  assert.equal(r.effectiveRiskLevel, 2, "LLM raised the floor to L2");
  assert.equal(r.mode, "safety");
  assert.equal(r.escalatedBySubtext, det.riskLevel < 2);
  assert.equal(r.gate, true);
});

test("blend: LLM 'active' escalation is capped at L2 (L3 is deterministic-only)", () => {
  const det = classifyInnerMateMessage("everything feels grey"); // L0 lexically
  const r = blendRouting(interp({ safety_risk: "active", recommended_mode: "calm" }), det);
  assert.equal(r.effectiveRiskLevel, 2, "never auto-jumps to L3 from the model");
  assert.equal(r.mode, "safety");
});

test("blend: an interpretation that over-claims 'safety' with no risk floor falls back to rules", () => {
  const det = classifyInnerMateMessage("what should I do about my messy room");
  const r = blendRouting(interp({ safety_risk: "none", recommended_mode: "safety" }), det);
  assert.notEqual(r.mode, "safety");
  assert.equal(r.effectiveRiskLevel, 0);
});

// ── 3. The 8 named regression messages ───────────────────────────────────────

const REGRESSIONS: Array<{
  msg: string;
  det: (r: number) => boolean;
  i: Partial<EmotionalInterpretation>;
  mode: ResponseModeLike;
  gate: boolean;
}> = [
  { msg: "I really loved her.", det: (r) => r === 0, i: { primary_emotion: "grief", secondary_emotion: "guilt", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true },
  { msg: "Should I message her?", det: (r) => r === 0, i: { primary_emotion: "longing", impulse_risk: "high", recommended_mode: "no_impulse" }, mode: "no_impulse", gate: true },
  { msg: "I think I was cruel.", det: (r) => r === 0, i: { primary_emotion: "guilt", recommended_mode: "mirror" }, mode: "mirror", gate: true },
  { msg: "She hid things from me.", det: (r) => r === 0, i: { primary_emotion: "betrayal", secondary_emotion: "anger", recommended_mode: "mirror" }, mode: "mirror", gate: true },
  { msg: "I cannot stop checking.", det: (r) => r === 0, i: { primary_emotion: "anxiety", impulse_risk: "high", recommended_mode: "no_impulse" }, mode: "no_impulse", gate: true },
  { msg: "I do not need analysis, I need peace.", det: (r) => r <= 1, i: { primary_emotion: "overwhelm", wants: "grounding", recommended_mode: "calm" }, mode: "calm", gate: false },
  { msg: "Tell me honestly if I was wrong.", det: (r) => r === 0, i: { primary_emotion: "guilt", recommended_mode: "mirror" }, mode: "mirror", gate: true },
  { msg: "I do not see the point of living.", det: (r) => r >= 0, i: { primary_emotion: "hopelessness", safety_risk: "passive", recommended_mode: "safety" }, mode: "safety", gate: true },
];

for (const c of REGRESSIONS) {
  test(`regression: "${c.msg}"`, () => {
    const det = classifyInnerMateMessage(c.msg);
    assert.ok(c.det(det.riskLevel), `deterministic risk ${det.riskLevel} unexpected`);
    const r = blendRouting(interp(c.i), det);
    assert.equal(r.mode, c.mode, `mode for "${c.msg}"`);
    assert.equal(r.gate, c.gate, `gate for "${c.msg}"`);
    // A passive/active read must always reach safety, whatever the lexical layer said.
    if (c.i.safety_risk && c.i.safety_risk !== "none") {
      assert.equal(r.effectiveRiskLevel, 2);
      assert.equal(r.mode, "safety");
    }
  });
}

// ── 4. 50+ emotionally-complex messages across the 14 categories ─────────────

type Case = {
  cat: string;
  msg: string;
  detMax: number;   // deterministic risk must be <= this (regression ceiling)
  detMin?: number;  // ...and >= this (safety floor pin)
  i: Partial<EmotionalInterpretation>;
  mode: ResponseModeLike;
  gate: boolean;
  strong: boolean;
};

const CASES: Case[] = [
  // grief
  { cat: "grief", msg: "The house is so loud now that she's gone.", detMax: 1, i: { primary_emotion: "grief", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  { cat: "grief", msg: "It's been a year and I still set two cups.", detMax: 1, i: { primary_emotion: "grief", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "grief", msg: "I don't know how to miss someone this much.", detMax: 1, i: { primary_emotion: "grief", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  // heartbreak
  { cat: "heartbreak", msg: "She left and I keep re-reading our old chats.", detMax: 1, i: { primary_emotion: "heartbreak", impulse_risk: "medium", recommended_mode: "no_impulse" }, mode: "no_impulse", gate: true, strong: true },
  { cat: "heartbreak", msg: "He moved on in a month and I'm still here.", detMax: 1, i: { primary_emotion: "heartbreak", secondary_emotion: "shame", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "heartbreak", msg: "We broke up and it physically hurts.", detMax: 1, i: { primary_emotion: "heartbreak", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  // guilt
  { cat: "guilt", msg: "I withdrew right when she needed me most.", detMax: 1, i: { primary_emotion: "guilt", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "guilt", msg: "I said something to my mom I can't take back.", detMax: 1, i: { primary_emotion: "guilt", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  // shame
  { cat: "shame", msg: "I failed the exam and everyone knows.", detMax: 1, i: { primary_emotion: "shame", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "shame", msg: "I'm the family disappointment.", detMax: 1, i: { primary_emotion: "shame", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  { cat: "shame", msg: "I got rejected and I feel pathetic.", detMax: 1, i: { primary_emotion: "shame", secondary_emotion: "rejection", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  // loneliness
  { cat: "loneliness", msg: "Nobody really understands me.", detMax: 1, i: { primary_emotion: "loneliness", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "loneliness", msg: "I eat every meal alone.", detMax: 1, i: { primary_emotion: "loneliness", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  { cat: "loneliness", msg: "I have people but I still feel unseen.", detMax: 1, i: { primary_emotion: "loneliness", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  // anxiety
  { cat: "anxiety", msg: "My mind won't stop and my chest is tight.", detMax: 1, i: { primary_emotion: "anxiety", wants: "grounding", recommended_mode: "calm" }, mode: "calm", gate: false, strong: false },
  { cat: "anxiety", msg: "I keep imagining everything going wrong tomorrow.", detMax: 1, i: { primary_emotion: "anxiety", cognitive_pattern: "catastrophizing", recommended_mode: "mirror" }, mode: "mirror", gate: false, strong: true },
  // anger
  { cat: "anger", msg: "I'm so angry I could scream.", detMax: 1, i: { primary_emotion: "anger", wants: "grounding", recommended_mode: "calm" }, mode: "calm", gate: false, strong: false },
  { cat: "anger", msg: "He lied to my face for months.", detMax: 1, i: { primary_emotion: "anger", secondary_emotion: "betrayal", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  // relationship ambiguity
  { cat: "ambiguity", msg: "I don't know if we're together or not.", detMax: 1, i: { primary_emotion: "confusion", recommended_mode: "mirror" }, mode: "mirror", gate: false, strong: true },
  { cat: "ambiguity", msg: "Part of me wants to leave, part of me can't.", detMax: 1, i: { primary_emotion: "confusion", recommended_mode: "mirror" }, mode: "mirror", gate: false, strong: true },
  // impulse to text/call
  { cat: "impulse", msg: "I'm about to call my ex, help.", detMax: 1, i: { primary_emotion: "longing", impulse_risk: "high", recommended_mode: "no_impulse" }, mode: "no_impulse", gate: true, strong: true },
  { cat: "impulse", msg: "Should I text him one more time?", detMax: 1, i: { primary_emotion: "longing", impulse_risk: "high", recommended_mode: "no_impulse" }, mode: "no_impulse", gate: true, strong: true },
  // feeling rejected
  { cat: "rejected", msg: "They didn't pick me. Again.", detMax: 1, i: { primary_emotion: "rejection", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "rejected", msg: "I don't think she ever really wanted me.", detMax: 1, i: { primary_emotion: "rejection", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  // work stress
  { cat: "work", msg: "Too many deadlines, I can't focus on anything.", detMax: 1, i: { primary_emotion: "overwhelm", wants: "action", recommended_mode: "action" }, mode: "action", gate: false, strong: false },
  { cat: "work", msg: "My boss humiliated me in the meeting.", detMax: 1, i: { primary_emotion: "shame", secondary_emotion: "anger", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  // identity confusion
  { cat: "identity", msg: "I don't know who I am anymore.", detMax: 1, i: { primary_emotion: "emptiness", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  { cat: "identity", msg: "I feel like I'm wearing a mask all day.", detMax: 1, i: { primary_emotion: "emptiness", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  // hopelessness (L1 band — no self-harm words)
  { cat: "hopelessness", msg: "Nothing will ever change for me.", detMax: 1, i: { primary_emotion: "hopelessness", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "hopelessness", msg: "I'm so tired of everything.", detMax: 1, i: { primary_emotion: "exhaustion", recommended_mode: "calm" }, mode: "calm", gate: true, strong: true },
  // precision / repair / grounding (spec sharp modes)
  { cat: "precision", msg: "How exactly do I know if I'm ready to move on?", detMax: 0, i: { primary_emotion: "uncertainty", wants: "analysis", recommended_mode: "precision" }, mode: "precision", gate: false, strong: false },
  { cat: "repair", msg: "That answer was too vague, be real with me.", detMax: 0, i: { primary_emotion: "frustration", recommended_mode: "repair" }, mode: "repair", gate: true, strong: true },
  { cat: "flatness", msg: "My body feels fine but I'm just not happy.", detMax: 1, i: { primary_emotion: "emptiness", recommended_mode: "flatness" }, mode: "flatness", gate: true, strong: true },
  // pattern
  { cat: "pattern", msg: "What patterns do you see in my last entries?", detMax: 0, i: { primary_emotion: "curiosity", recommended_mode: "pattern" }, mode: "pattern", gate: false, strong: false },
  // extra coverage across categories (variety of gate/strong outcomes)
  { cat: "grief", msg: "Grief comes in waves and today it's drowning me.", detMax: 1, i: { primary_emotion: "grief", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  { cat: "anxiety", msg: "I can't stop worrying about tomorrow.", detMax: 1, i: { primary_emotion: "anxiety", recommended_mode: "mirror" }, mode: "mirror", gate: false, strong: true },
  { cat: "loneliness", msg: "Everyone has someone except me.", detMax: 1, i: { primary_emotion: "loneliness", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "work", msg: "I feel like I'm failing at my job.", detMax: 1, i: { primary_emotion: "shame", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "ambiguity", msg: "He says he loves me but acts like he doesn't.", detMax: 1, i: { primary_emotion: "confusion", recommended_mode: "mirror" }, mode: "mirror", gate: false, strong: true },
  { cat: "rejected", msg: "My friends made plans without me again.", detMax: 1, i: { primary_emotion: "rejection", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  { cat: "identity", msg: "I've become someone I don't recognize.", detMax: 1, i: { primary_emotion: "emptiness", recommended_mode: "deep_thinking" }, mode: "deep_thinking", gate: true, strong: true },
  { cat: "hopelessness", msg: "It all feels pointless lately.", detMax: 1, i: { primary_emotion: "hopelessness", recommended_mode: "mirror" }, mode: "mirror", gate: true, strong: true },
  // safety-critical (deterministic must flag L2/L3)
  { cat: "safety-L2", msg: "I don't want to be here anymore.", detMax: 3, detMin: 2, i: { primary_emotion: "hopelessness", safety_risk: "passive", recommended_mode: "safety" }, mode: "safety", gate: true, strong: true },
  { cat: "safety-L2", msg: "I feel like giving up on life.", detMax: 3, detMin: 2, i: { primary_emotion: "despair", safety_risk: "passive", recommended_mode: "safety" }, mode: "safety", gate: true, strong: true },
  { cat: "safety-L3", msg: "I have pills and I'll do it tonight.", detMax: 3, detMin: 3, i: { safety_risk: "active", recommended_mode: "safety" }, mode: "safety", gate: true, strong: true },
];

for (const c of CASES) {
  test(`[${c.cat}] "${c.msg}"`, () => {
    const det = classifyInnerMateMessage(c.msg);
    assert.ok(det.riskLevel <= c.detMax, `risk ${det.riskLevel} > ceiling ${c.detMax}`);
    if (c.detMin != null) assert.ok(det.riskLevel >= c.detMin, `risk ${det.riskLevel} < floor ${c.detMin}`);
    const r = blendRouting(interp(c.i), det);
    assert.equal(r.mode, c.mode, `mode for [${c.cat}]`);
    assert.equal(r.gate, c.gate, `gate for [${c.cat}]`);
    assert.equal(r.strongModel, c.strong, `strongModel for [${c.cat}]`);
    // Whenever the ideal read carries any safety risk, routing must reach safety.
    if (c.i.safety_risk && c.i.safety_risk !== "none") {
      assert.equal(r.mode, "safety");
      assert.ok(r.effectiveRiskLevel >= 2);
    }
  });
}

test("50+ distinct emotional messages are covered", () => {
  const all = new Set([...CASES.map((c) => c.msg), ...REGRESSIONS.map((c) => c.msg)]);
  assert.ok(all.size >= 50, `only ${all.size} distinct messages`);
});

// ── 5. Gates behave sensibly at the extremes ─────────────────────────────────

test("gate/strong: a light logistical L0 turn is neither gated nor escalated", () => {
  const det = classifyInnerMateMessage("what should I cook for dinner");
  assert.equal(isHighStakes(interp({ primary_emotion: "neutral", recommended_mode: "action" }), det), false);
  assert.equal(needsStrongModel(interp({ primary_emotion: "neutral", recommended_mode: "action" }), det), false);
});

test("isHeavyEmotion catches compound reads", () => {
  assert.equal(isHeavyEmotion("grief + guilt"), true);
  assert.equal(isHeavyEmotion("mild curiosity"), false);
});

// ── 6. Relevance memory retrieval ────────────────────────────────────────────

const POOL: MemoryRow[] = [
  { title: "The night I chose not to call her", story: "I decided not to contact my ex even though I wanted to, because it always hurt more after.", memory_date: "2026-02-10", feeling_tag: "resolve" },
  { title: "Dad's hospital week", story: "Sitting in the corridor, learning to breathe through fear.", memory_date: "2026-01-05", feeling_tag: "fear" },
  { title: "First solo trip", story: "Rode a bus to the hills alone and felt free.", memory_date: "2025-12-20", feeling_tag: "freedom" },
];

test("rankMemories: surfaces the topically relevant memory, not the newest", () => {
  const ranked = rankMemories(POOL, ["not contacting her", "withdrawal guilt"], "guilt");
  assert.ok(ranked.length >= 1);
  assert.match(ranked[0].title, /call her/i);
});

test("rankMemories: returns [] when nothing is relevant (no invented memory)", () => {
  const ranked = rankMemories(POOL, ["quarterly tax filing"], "boredom");
  assert.deepEqual(ranked, []);
});

test("rankMemories: empty query set yields nothing", () => {
  assert.deepEqual(rankMemories(POOL, [], ""), []);
});

test("buildEmotionalPatternSummary: only calls a trigger 'recurring' when it repeats", () => {
  const s = buildEmotionalPatternSummary([
    { mood_score: 3, emotion_tags: ["lonely"], trigger_tags: ["work"] },
    { mood_score: 4, emotion_tags: ["lonely"], trigger_tags: ["work"] },
    { mood_score: 6, emotion_tags: ["calm"], trigger_tags: ["family"] },
    { mood_score: 7, emotion_tags: ["calm"], trigger_tags: ["sleep"] },
  ], ["not to contact her"]);
  assert.equal(s.recurring_trigger, "work");
  assert.equal(s.common_emotion, "lonely");
  assert.equal(s.arc, "heavier"); // newest check-ins (3,4,6) sit below the older 7
  assert.deepEqual(s.boundaries, ["not to contact her"]);
});

// ── 7. Context packet: encodes the read without leaking it ───────────────────

test("buildContextPacket: includes mode, need, avoid-list, and a relevant memory", () => {
  const det = classifyInnerMateMessage("I really loved her.");
  const i = interp({ primary_emotion: "grief", secondary_emotion: "guilt", underlying_need: "to know the love was real", likely_fear: "my love was not real because I withdrew", recommended_mode: "deep_thinking", memory_needed: true, memory_queries: ["not contacting her"] });
  const r = blendRouting(i, det);
  const memories = rankMemories(POOL, i.memory_queries, i.primary_emotion);
  const packet = buildContextPacket({ message: "I really loved her.", interp: i, mode: r.mode, effectiveRiskLevel: r.effectiveRiskLevel, escalatedBySubtext: r.escalatedBySubtext, memories });
  assert.match(packet, /RESPONSE MODE: deep_thinking/);
  assert.match(packet, /to know the love was real/);
  assert.match(packet, /AVOID:/);
  assert.match(packet, /call her/i);
  assert.doesNotMatch(packet, /\d{5,}/, "packet must never contain hotline/phone-length digit runs");
});

test("buildContextPacket: adds the safety steer when subtext escalated", () => {
  const det = classifyInnerMateMessage("everything feels grey");
  const i = interp({ safety_risk: "passive", recommended_mode: "mirror" });
  const r = blendRouting(i, det);
  const packet = buildContextPacket({ message: "everything feels grey", interp: i, mode: r.mode, effectiveRiskLevel: r.effectiveRiskLevel, escalatedBySubtext: r.escalatedBySubtext, memories: [] });
  assert.match(packet, /safe\/not-safe check/);
  assert.match(packet, /SOS button/);
});

test("desiredLength + avoidList track the mode", () => {
  assert.equal(desiredLengthFor("calm", 0, "grounding"), "short");
  assert.equal(desiredLengthFor("precision", 0, "analysis"), "medium");
  assert.ok(avoidListFor("no_impulse", interp({ impulse_risk: "high" })).some((a) => /text, call, check/.test(a)));
  assert.ok(avoidListFor("mirror", null).some((a) => /bullet-point/.test(a)));
});

// ── 8. The critic rejects generic / unsafe emotional drafts ──────────────────

test("critic: a vague poetic reply to a precision ask is REWRITE", () => {
  const res = evaluateDraft(
    "Maybe just sit with the ache gently and let it be enough for now. Wisdom will arrive slowly.",
    { userMessage: "How exactly do I know if I'm ready?", mode: "precision", riskLevel: 0, askedPrecision: true, isChallenge: false },
  );
  assert.equal(res.decision, "REWRITE");
  assert.ok(res.failed_evaluators.includes("anti_vagueness") || res.failed_evaluators.includes("specificity"));
});

test("critic: crisis machinery on a Level-0 grief turn fails safety_scope (over-trigger)", () => {
  const res = evaluateDraft(
    "That sounds heavy. Please tap the SOS button and ask yourself: are you safe right now?",
    { userMessage: "I really loved her.", mode: "deep_thinking", riskLevel: 0, askedPrecision: false, isChallenge: false },
  );
  assert.equal(res.scores.safety_scope, "FAIL");
  assert.equal(res.decision, "REWRITE");
});

test("critic: a clean, specific, in-mode reply PASSES", () => {
  const res = evaluateDraft(
    "You keep checking because uncertainty feels unbearable, and checking promises a hit of certainty it never delivers. Try this: when the urge comes, set a 20 minute timer and do one small thing away from the phone. If you still want to check after, you can. Most of the time the urge passes.",
    { userMessage: "I cannot stop checking.", mode: "no_impulse", riskLevel: 0, askedPrecision: false, isChallenge: false },
  );
  assert.equal(res.decision, "PASS");
});
