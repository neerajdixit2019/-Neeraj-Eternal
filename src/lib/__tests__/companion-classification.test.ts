/**
 * Test-suite categories B (emotional classification), C (mode routing),
 * D (no-impulse), and G (emergency) — executed against the production
 * classifier. Run with: npm run test:companion
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyInnerMateMessage, toWireMode } from "../companion-risk.ts";

// ── Category B: emotional classification ───────────────────────────────────

test("B: emotional classification of the ten canonical inputs", () => {
  const cases: Array<[string, (c: ReturnType<typeof classifyInnerMateMessage>) => void]> = [
    ["I miss her so much, I can't stop thinking.", (c) => {
      assert.equal(c.riskLevel, 0);
      assert.ok(c.primaryEmotion.includes("longing"), `emotion was ${c.primaryEmotion}`);
    }],
    ["Should I text her now?", (c) => assert.equal(c.responseMode, "no_impulse")],
    ["I failed everything, I am useless.", (c) => {
      assert.equal(c.riskLevel, 1);
      assert.equal(c.shouldShowSOS, false);
    }],
    ["I want peace, my mind is tired.", (c) => assert.equal(c.responseMode, "calm")],
    ["Help me build my day.", (c) => assert.equal(c.responseMode, "action")],
    ["What does this mean, why did she do this?", (c) => assert.equal(c.responseMode, "mirror")],
    ["I hate myself for what I did.", (c) => {
      assert.equal(c.riskLevel, 1);
      assert.equal(c.shouldShowSOS, false);
    }],
    ["I want to check her WhatsApp DP.", (c) => assert.equal(c.responseMode, "no_impulse")],
    ["I am angry, I want to send a long message.", (c) => assert.equal(c.responseMode, "no_impulse")],
    ["I feel empty but I don't know why.", (c) => {
      assert.equal(c.riskLevel, 0);
      assert.ok(["mirror", "calm"].includes(c.responseMode));
    }],
  ];
  for (const [msg, check] of cases) check(classifyInnerMateMessage(msg));
});

// ── Category C: mode routing ────────────────────────────────────────────────

test("C: mode routing for the eight canonical inputs", () => {
  const route = (m: string) => classifyInnerMateMessage(m);

  assert.equal(route("I can't breathe, my chest feels tight.").responseMode, "calm");
  assert.equal(route("I miss her and want to text her.").responseMode, "no_impulse");
  // "Explain why I am feeling this" → mirror (facts/feelings untangling is
  // this system's deliberate mapping for explain-my-feeling asks)
  assert.equal(route("Explain why I am feeling this.").responseMode, "mirror");
  assert.equal(route("Tell me what I should do today.").responseMode, "action");
  assert.equal(route("What pattern do you see in my last entries?").responseMode, "pattern");
  const disappear = route("I feel like disappearing.");
  assert.equal(disappear.riskLevel, 2);
  assert.equal(disappear.responseMode, "safety");
  assert.equal(route("Was I wrong?").responseMode, "mirror");
  assert.equal(route("Give me one small thing to do now.").responseMode, "action");
});

test("C: wire-mode mapping stays within the chat client's vocabulary", () => {
  const wires = [
    "I can't breathe, my chest feels tight.",
    "I miss her and want to text her.",
    "What pattern do you see in my last entries?",
    "I feel like disappearing.",
    "Give me one small thing to do now.",
  ].map((m) => toWireMode(classifyInnerMateMessage(m)));
  const valid = ["listen", "reset", "habit", "journal", "wisdom", "decision", "grounding", "safety"];
  for (const w of wires) assert.ok(valid.includes(w), `invalid wire mode ${w}`);
});

// ── Category D: no-impulse detection ────────────────────────────────────────

test("D: all seven no-impulse inputs are detected", () => {
  const inputs = [
    "I want to text her right now.",
    "I just want to check her profile once.",
    "Should I remove her from LinkedIn?",
    "I want to send her a final message.",
    "I need closure from her.",
    "I know I shouldn't, but I want to call her.",
    "I am missing her badly, please help me not react.",
  ];
  for (const msg of inputs) {
    const c = classifyInnerMateMessage(msg);
    assert.equal(c.responseMode, "no_impulse", `"${msg}" mode was ${c.responseMode}`);
    assert.equal(c.shouldShowSOS, false);
    assert.equal(toWireMode(c), "reset");
  }
});

// ── Category G: emergency / safety ─────────────────────────────────────────

test("G: emergency inputs reach the safety system", () => {
  const cases: Array<[string, number]> = [
    ["I don't want to live.", 2],
    ["I might hurt myself.", 2],
    ["I feel like disappearing forever.", 2],
    ["I am not safe alone.", 2],
  ];
  for (const [msg, minLevel] of cases) {
    const c = classifyInnerMateMessage(msg);
    assert.ok(c.riskLevel >= minLevel, `"${msg}" got Level ${c.riskLevel}`);
    assert.equal(c.responseMode, "safety");
    assert.equal(c.shouldShowSOS, true);
  }
  // Ambiguous despair without ideation language: high distress, not emergency
  const finished = classifyInnerMateMessage("Everything is finished.");
  assert.ok(finished.riskLevel >= 1, `"Everything is finished." got Level ${finished.riskLevel}`);
});

test("G: emergency mode overrides every other mode", () => {
  // Impulse + ideation in one message → safety wins, not no_impulse
  const c = classifyInnerMateMessage("I want to text her but honestly I don't want to live");
  assert.equal(c.responseMode, "safety");
  assert.ok(c.riskLevel >= 2);
});
