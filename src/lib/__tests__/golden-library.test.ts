/**
 * Golden-library contract tests — every training example in
 * docs/training/golden-examples.json must agree with the REAL runtime:
 * the deterministic risk classifier, the banned-phrase detector, the
 * voice rules, and the crisis templates. If a future edit to the library
 * or the classifier breaks that agreement, a test fails here.
 * Run with: npm run test:companion
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyInnerMateMessage } from "../companion-risk.ts";
import { findBannedPhrases } from "../companion-quality.ts";
import { buildActiveDangerReply } from "../crisis-resources.ts";

type GoldenExample = {
  id: string;
  category: string;
  user_message: string;
  context?: { recent_user_messages?: string[]; recent_risk_label?: boolean };
  emotional_state: string;
  hidden_need: string;
  risk_level: number;
  impulse_risk: "none" | "low" | "medium" | "high";
  mode: string;
  use_memory: boolean;
  memory_note: string;
  response_length: "one_line" | "short" | "medium";
  next_best_action: string;
  bad_generic_response: string;
  innermate_response: string;
  why_it_works: string;
  success_criteria: string[];
  /** True when the reply is a verbatim config template, never model-generated. */
  deterministic?: boolean;
};

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(
  join(here, "..", "..", "..", "docs", "training", "golden-examples.json"),
  "utf8",
);
const library = JSON.parse(raw) as { examples: GoldenExample[] };
const examples = library.examples;
const words = (s: string) => s.trim().split(/\s+/).length;

// ── Shape and coverage ───────────────────────────────────────────────────────

test("library: at least 100 examples across at least 12 categories", () => {
  assert.ok(examples.length >= 100, `only ${examples.length} examples`);
  const cats = new Set(examples.map((e) => e.category));
  assert.ok(cats.size >= 12, `only ${cats.size} categories`);
});

test("library: every example is complete and ids are unique", () => {
  const ids = new Set<string>();
  for (const e of examples) {
    for (const k of [
      "id", "category", "user_message", "emotional_state", "hidden_need",
      "mode", "next_best_action", "bad_generic_response", "innermate_response",
      "why_it_works",
    ] as const) {
      assert.ok(typeof e[k] === "string" && e[k].length > 0, `${e.id ?? "?"}: missing ${k}`);
    }
    assert.ok(e.success_criteria.length >= 2 && e.success_criteria.length <= 4, `${e.id}: success_criteria count`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    if (e.use_memory) {
      assert.ok(e.memory_note && e.memory_note !== "none", `${e.id}: use_memory without memory_note`);
    }
  }
});

// ── Voice contracts (mechanical gate from the evaluation rubric) ─────────────

test("voice: no golden reply contains an em-dash, list, or banned phrase", () => {
  for (const e of examples) {
    const r = e.innermate_response;
    assert.ok(!r.includes("—"), `${e.id}: em-dash in reply`);
    assert.equal(findBannedPhrases(r).length, 0, `${e.id}: banned phrase in reply`);
  }
});

test("voice: at most one question per reply", () => {
  for (const e of examples) {
    const q = (e.innermate_response.match(/\?/g) ?? []).length;
    assert.ok(q <= 1, `${e.id}: ${q} questions`);
  }
});

test("voice: hard length rule (55 words; 110 for safety scripts)", () => {
  for (const e of examples) {
    const cap = e.risk_level >= 2 ? 110 : 55;
    const w = words(e.innermate_response);
    assert.ok(w <= cap, `${e.id}: ${w} words (cap ${cap})`);
  }
});

test("voice: the model never writes phone numbers (config templates exempt)", () => {
  for (const e of examples) {
    if (e.deterministic) continue;
    assert.ok(!/\d{3,}/.test(e.innermate_response), `${e.id}: 3+ digit number in a non-template reply`);
  }
});

// ── Safety invariants (mirror classifier-schema.json $defs.hard_invariants) ──

test("safety: emergency labels and risk levels are consistent", () => {
  for (const e of examples) {
    if (e.mode === "emergency") {
      assert.ok(e.risk_level >= 2, `${e.id}: emergency mode with risk_level ${e.risk_level}`);
      // Follow-up turns (confirmed_safe) are deliberately short; initial
      // safety scripts and templates are medium.
      if (!e.id.includes("follow")) {
        assert.equal(e.response_length, "medium", `${e.id}: emergency must be medium length`);
      }
    } else {
      assert.ok(e.risk_level <= 1, `${e.id}: risk_level ${e.risk_level} without emergency mode`);
    }
    if (e.risk_level >= 2) {
      assert.equal(e.use_memory, false, `${e.id}: memory must never surface in safety mode`);
    }
  }
});

test("safety: the real classifier agrees with every risk label", () => {
  for (const e of examples) {
    const ctx = e.context
      ? {
          recentUserMessages: e.context.recent_user_messages,
          recentRiskLabel: e.context.recent_risk_label,
        }
      : undefined;
    const cls = classifyInnerMateMessage(e.user_message, ctx);
    if (e.risk_level >= 2) {
      assert.ok(
        cls.riskLevel >= 2,
        `${e.id}: labeled ${e.risk_level} but classifier says ${cls.riskLevel} ("${e.user_message}")`,
      );
      assert.equal(cls.responseMode, "safety", `${e.id}: classifier mode ${cls.responseMode}, expected safety`);
    } else {
      assert.ok(
        cls.riskLevel <= 1,
        `${e.id}: benign-labeled message trips the classifier at level ${cls.riskLevel} ("${e.user_message}")`,
      );
      assert.equal(
        cls.riskLevel,
        e.risk_level,
        `${e.id}: labeled ${e.risk_level}, classifier says ${cls.riskLevel} ("${e.user_message}")`,
      );
    }
  }
});

test("safety: level-3 replies are the verbatim config template, never prose", () => {
  const l3 = examples.filter((e) => e.risk_level === 3);
  assert.ok(l3.length >= 2, "library must cover level 3");
  for (const e of l3) {
    assert.equal(e.deterministic, true, `${e.id}: level 3 must be deterministic`);
    assert.equal(e.innermate_response, buildActiveDangerReply("IN"), `${e.id}: not the verbatim template`);
  }
});

test("safety: level-2 golden replies follow the script shape", () => {
  const l2 = examples.filter((e) => e.risk_level === 2 && !e.deterministic && !e.id.includes("follow"));
  assert.ok(l2.length >= 3, "library must cover level 2");
  for (const e of l2) {
    const r = e.innermate_response.toLowerCase();
    if (e.id.includes("third-party") || e.id.includes("harm-others")) continue;
    assert.ok(r.includes("10 minutes") || r.includes("ten minutes"), `${e.id}: missing the 10-minute safety question`);
    assert.ok(r.includes("sos"), `${e.id}: missing the SOS mention`);
    assert.ok(r.includes("safe or not safe"), `${e.id}: missing the one-word ask`);
  }
});

// ── Distribution sanity ──────────────────────────────────────────────────────

test("distribution: impulse coverage and memory examples exist", () => {
  const high = examples.filter((e) => e.impulse_risk === "high");
  assert.ok(high.length >= 4, `only ${high.length} high-impulse examples`);
  const mem = examples.filter((e) => e.use_memory);
  assert.ok(mem.length >= 8, `only ${mem.length} memory examples`);
  const modes = new Set(examples.map((e) => e.mode));
  for (const m of ["calm", "mirror", "deep_thinking", "no_impulse", "shame_guilt", "action", "pattern", "spiritual", "emergency"]) {
    assert.ok(modes.has(m), `mode ${m} has no examples`);
  }
});
