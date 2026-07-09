/**
 * Response-evaluation-layer tests. Verifies the deterministic evaluators,
 * the aggregation rule, and the JSON parser against the spec's own bad-vs-good
 * examples. Run with: npm run test:companion
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deterministicScores, evaluateDraft, decide, meanScore, failedEvaluators,
  parseEvaluation, composeRewriteInstruction, EVALUATOR_SYSTEM_PROMPT,
  EVALUATOR_FALLBACK_REPLY, type DraftContext,
} from "../companion-evaluator.ts";

const precisionCtx: DraftContext = {
  userMessage: "How does the body tell? Can you be specific?",
  mode: "precision", riskLevel: 0, askedPrecision: true, isChallenge: false,
};

// ── The spec's Bad response must fail; the Good response must pass ───────────

test("Bad (vague/poetic) draft to a precision ask is REWRITE", () => {
  const bad = "Maybe the body tells you first. Let it be witnessed, and gently return to life. Rest can be enough for now.";
  const r = evaluateDraft(bad, precisionCtx);
  assert.equal(r.decision, "REWRITE");
  assert.ok(r.scores.anti_vagueness < 4, `anti_vagueness ${r.scores.anti_vagueness}`);
  assert.ok(r.scores.contradiction_claims < 4, "should flag 'the body tells you first'");
  assert.ok(r.scores.specificity < 4, "no concrete markers");
  assert.ok(r.rewrite_instruction.length > 0);
});

test("Good (concrete checklist) draft to a precision ask PASSES", () => {
  const good = "Signs rest helped: your breathing feels less forced, your eyes feel less strained, you can do one small task. Signs it is avoidance: you keep extending it without feeling clearer, you want to disappear from responsibilities. The test is not 'am I happy' but 'am I slightly more able to return to life?'";
  const r = evaluateDraft(good, precisionCtx);
  assert.equal(r.scores.specificity, 5);
  assert.ok(r.scores.anti_vagueness >= 4);
  assert.equal(r.scores.mode_routing, 5);
  assert.equal(r.decision, "PASS", `failed: ${r.failed_evaluators.join(",")}`);
});

// ── Mode-routing leaks ───────────────────────────────────────────────────────

test("Grounding cue when there's no distress fails mode_routing and user_respect", () => {
  const draft = "Put one hand somewhere steady, chest or lap, and take one slow breath. Let the morning arrive slowly.";
  const ctx: DraftContext = {
    userMessage: "I don't feel panic", mode: "repair", riskLevel: 0,
    askedPrecision: false, isChallenge: true,
  };
  const s = deterministicScores(draft, ctx);
  assert.ok(s.mode_routing < 4, "grounding leak should fail mode_routing");
  assert.ok(s.user_respect < 4);
  assert.equal(decide(s, false), "REWRITE");
});

test("Repair draft that acknowledges and sharpens scores challenge_repair high", () => {
  const draft = "You're right, I overstated it. More accurate: the body gives clues but doesn't decide the whole truth. If it's clear but you're flat, check whether you need action, connection, or meaning.";
  const ctx: DraftContext = {
    userMessage: "that is contradictory, what are your qualifications?",
    mode: "repair", riskLevel: 0, askedPrecision: false, isChallenge: true,
  };
  const s = deterministicScores(draft, ctx);
  assert.equal(s.challenge_repair, 5);
});

test("Repair draft that only apologizes without sharpening fails", () => {
  const draft = "I'm so sorry, I'm sorry that wasn't helpful. I really apologize. Let me try to be gentle with you.";
  const ctx: DraftContext = {
    userMessage: "this is vague", mode: "repair", riskLevel: 0,
    askedPrecision: false, isChallenge: true,
  };
  const s = deterministicScores(draft, ctx);
  assert.ok(s.challenge_repair < 4, `challenge_repair ${s.challenge_repair}`);
});

// ── Safety scope (never owned here, only flagged) ────────────────────────────

test("Crisis language on a Level-0 turn fails safety_scope (over-trigger)", () => {
  const draft = "That sounds so heavy. Please tap SOS below or call your local emergency number, are you safe right now?";
  const ctx: DraftContext = {
    userMessage: "I'm just bored and not happy today", mode: "flatness",
    riskLevel: 0, askedPrecision: false, isChallenge: false,
  };
  const s = deterministicScores(draft, ctx);
  assert.equal(s.safety_scope, "FAIL");
  assert.ok(failedEvaluators(s).includes("safety_scope"));
});

test("A Level-2 draft missing the safety check fails safety_scope (under-trigger)", () => {
  const draft = "That is a lot of pain to carry. Let's slow down and think about what hurts most.";
  const ctx: DraftContext = {
    userMessage: "i dont want to live like this", mode: "safety",
    riskLevel: 2, askedPrecision: false, isChallenge: false,
  };
  const s = deterministicScores(draft, ctx);
  assert.equal(s.safety_scope, "FAIL");
});

// ── Aggregation rule ─────────────────────────────────────────────────────────

test("decide(): critical failure forces REWRITE even if average is high", () => {
  const s = {
    intent_fit: 2, mode_routing: 5, specificity: 5, emotional_accuracy: 5,
    challenge_repair: 5, practical_usefulness: 5, anti_vagueness: 5,
    contradiction_claims: 5, safety_scope: "PASS" as const, user_respect: 5,
  };
  assert.equal(decide(s, false), "REWRITE"); // intent_fit < 4
});

test("decide(): anti_vagueness<4 only forces rewrite when precision was asked", () => {
  const s = {
    intent_fit: 4, mode_routing: 4, specificity: 4, emotional_accuracy: 4,
    challenge_repair: 5, practical_usefulness: 4, anti_vagueness: 3,
    contradiction_claims: 5, safety_scope: "PASS" as const, user_respect: 4,
  };
  assert.equal(decide(s, true), "REWRITE");
  // Without a precision ask, the same scorecard is not a hard rewrite.
  assert.notEqual(decide(s, false), "REWRITE");
});

test("meanScore + composeRewriteInstruction cover the failed evaluators", () => {
  const s = deterministicScores("Maybe just listen to your body and let it be gentle.", precisionCtx);
  const failed = failedEvaluators(s);
  const instr = composeRewriteInstruction(s, failed, { riskLevel: 0 });
  assert.ok(instr.length > 0);
  assert.ok(meanScore(s) < 4);
});

// ── The model-judge JSON parser (fail-open) ──────────────────────────────────

test("parseEvaluation reads fenced JSON and clamps scores", () => {
  const raw = '```json\n{"pass":false,"overall_score":2,"detected_user_state":"flatness","selected_mode":"precision","failed_evaluators":["specificity"],"scores":{"intent_fit":2,"mode_routing":4,"specificity":9,"emotional_accuracy":4,"challenge_repair":5,"practical_usefulness":2,"anti_vagueness":2,"contradiction_claims":5,"safety_scope":"PASS","user_respect":3},"rewrite_instruction":"Add a checklist.","approved_response":"","rewritten_response":""}\n```';
  const r = parseEvaluation(raw);
  assert.ok(r);
  assert.equal(r!.pass, false);
  assert.equal(r!.scores.specificity, 5); // clamped from 9
  assert.equal(r!.detected_user_state, "flatness");
});

test("parseEvaluation fails open (null) on garbage", () => {
  assert.equal(parseEvaluation("the model refused to answer"), null);
  assert.equal(parseEvaluation(""), null);
});

// ── Contract presence ────────────────────────────────────────────────────────

test("judge prompt and fallback carry the required contract", () => {
  assert.ok(EVALUATOR_SYSTEM_PROMPT.includes("Return JSON ONLY"));
  assert.ok(EVALUATOR_SYSTEM_PROMPT.includes("\"safety_scope\":\"PASS\"|\"FAIL\""));
  assert.ok(EVALUATOR_SYSTEM_PROMPT.includes("I don't feel panic"));
  assert.ok(EVALUATOR_FALLBACK_REPLY.includes("Let me reset"));
  assert.ok(EVALUATOR_FALLBACK_REPLY.includes("1. emotional clarity"));
});
