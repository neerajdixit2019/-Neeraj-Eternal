/**
 * Risk classifier quality tests — run with: npm run test:risk
 * (Node 23.6+ executes TypeScript directly via type stripping.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyInnerMateMessage, toWireMode } from "../companion-risk.ts";

test("Test 1 — 'I failed in my exam i dont like living' → Level 2, safety check, no hotline", () => {
  const c = classifyInnerMateMessage("I failed in my exam i dont like living");
  assert.equal(c.riskLevel, 2);
  assert.equal(c.responseMode, "safety");
  assert.equal(c.shouldAskSafetyCheck, true);
  assert.equal(c.shouldShowSOS, true);
  assert.equal(c.shouldShowHotline, false);
  assert.equal(c.primaryEmotion, "shame + despair");
  assert.ok(c.quickReplies.includes("I can stay safe"));
  assert.ok(c.quickReplies.includes("I may not be safe"));
  assert.ok(!c.quickReplies.includes("Reflect deeper"));
  assert.equal(toWireMode(c), "safety");
});

test("Test 2 — 'I failed my exam I am useless' → Level 1, no SOS", () => {
  const c = classifyInnerMateMessage("I failed my exam I am useless");
  assert.equal(c.riskLevel, 1);
  assert.equal(c.shouldShowSOS, false);
  assert.equal(c.shouldShowHotline, false);
  assert.equal(c.shouldAskSafetyCheck, false);
  assert.ok(c.quickReplies.includes("What should I do now?"));
});

test("Test 3 — 'I want to kill myself tonight' → Level 3, hotline, no reflection", () => {
  const c = classifyInnerMateMessage("I want to kill myself tonight");
  assert.equal(c.riskLevel, 3);
  assert.equal(c.responseMode, "safety");
  assert.equal(c.shouldShowSOS, true);
  assert.equal(c.shouldShowHotline, true);
  assert.equal(c.shouldAskSafetyCheck, false);
  assert.ok(c.quickReplies.includes("Open SOS"));
  assert.ok(!c.quickReplies.some((q) => /journal|reflect/i.test(q)));
});

test("Test 4 — 'I miss her so much should I text her' → no-impulse mode, no SOS", () => {
  const c = classifyInnerMateMessage("I miss her so much should I text her");
  assert.equal(c.riskLevel, 0);
  assert.equal(c.responseMode, "no_impulse");
  assert.equal(c.shouldShowSOS, false);
  assert.equal(toWireMode(c), "reset");
});

test("Test 5 — 'I feel lonely' → Level 0, gentle reflection, no escalation", () => {
  const c = classifyInnerMateMessage("I feel lonely");
  assert.equal(c.riskLevel, 0);
  assert.equal(c.shouldShowSOS, false);
  assert.equal(c.primaryEmotion, "loneliness");
  assert.equal(toWireMode(c), "listen");
});

test("Escalation — 'safe' after a Level-2 message → confirmed_safe, stay in safety mode", () => {
  const c = classifyInnerMateMessage("safe", {
    recentUserMessages: ["I failed in my exam i dont like living"],
  });
  assert.equal(c.safetyFollowUp, "confirmed_safe");
  assert.equal(c.riskLevel, 2);
  assert.equal(c.shouldAskSafetyCheck, false);
  assert.equal(c.shouldShowHotline, false);
});

test("Escalation — 'not safe' after a Level-2 message → Level 3", () => {
  const c = classifyInnerMateMessage("not safe", {
    recentUserMessages: ["I failed in my exam i dont like living"],
  });
  assert.equal(c.safetyFollowUp, "not_safe");
  assert.equal(c.riskLevel, 3);
  assert.equal(c.shouldShowHotline, true);
});

test("Escalation — 'i dont know' after a Level-2 message → Level 3 (treat ambiguity as unsafe)", () => {
  const c = classifyInnerMateMessage("I don't know", {
    recentUserMessages: ["i wish i could disappear"],
  });
  assert.equal(c.riskLevel, 3);
  assert.equal(c.safetyFollowUp, "not_safe");
});

test("'safe' with NO prior risk context is NOT a safety follow-up", () => {
  const c = classifyInnerMateMessage("safe", { recentUserMessages: ["I love hiking"] });
  assert.equal(c.safetyFollowUp, null);
  assert.equal(c.riskLevel, 0);
});

test("Level-2 phrase + timing/means escalates to Level 3", () => {
  const c = classifyInnerMateMessage("I dont want to live and I have decided to do it tonight");
  assert.equal(c.riskLevel, 3);
});

test("Hinglish passive ideation → Level 2", () => {
  const c = classifyInnerMateMessage("mujhe jeena nahi chahta ab");
  assert.equal(c.riskLevel, 2);
  assert.equal(c.responseMode, "safety");
});

test("'My life is ruined' → Level 1, not Level 2", () => {
  const c = classifyInnerMateMessage("My life is ruined");
  assert.equal(c.riskLevel, 1);
  assert.equal(c.shouldShowSOS, false);
});

test("'what is the point of life' → Level 2; bare 'whats the point' → Level 1", () => {
  assert.equal(classifyInnerMateMessage("what is the point of life").riskLevel, 2);
  assert.equal(classifyInnerMateMessage("ugh, what's the point").riskLevel, 1);
});

test("'I am going to jump' → Level 3", () => {
  assert.equal(classifyInnerMateMessage("I am going to jump").riskLevel, 3);
});

test("Panic without risk language → calm mode, Level 0", () => {
  const c = classifyInnerMateMessage("I'm panicking and I can't breathe");
  assert.equal(c.riskLevel, 0);
  assert.equal(c.responseMode, "calm");
  assert.equal(toWireMode(c), "grounding");
});

test("'what should i do about my job' → action mode", () => {
  const c = classifyInnerMateMessage("what should i do about my job");
  assert.equal(c.responseMode, "action");
  assert.equal(toWireMode(c), "decision");
});

// Regression tests: every phrase the OLD binary crisis detector caught
// must still land at Level 2 or higher — never at 0 or 1.
test("legacy crisis phrases never fall below Level 2", () => {
  const legacy = [
    "I want to hurt myself",
    "I've been thinking about self-harm",
    "I keep cutting myself",
    "I can't go on",
    "I just want to end everything",
    "I want to give up on life",
    "I don't want to be here anymore",
    "there's no reason to live",
    "I want to disappear",
    "ab jeena nahi hai",
    "sab khatam karna chahta hoon",
  ];
  for (const msg of legacy) {
    const c = classifyInnerMateMessage(msg);
    assert.ok(c.riskLevel >= 2, `"${msg}" classified as Level ${c.riskLevel}`);
    assert.equal(c.responseMode, "safety", `"${msg}" mode was ${c.responseMode}`);
  }
});

test("'about to hurt myself' stays Level 3 (L3 checked before L2)", () => {
  assert.equal(classifyInnerMateMessage("I am about to hurt myself").riskLevel, 3);
});

// ── Review-confirmed regression suite: risk inversion fixes ────────────────

const L2_CONTEXT = { recentUserMessages: ["I failed in my exam i dont like living"] };

test("negated 'safe' answers are NEVER read as confirmed_safe", () => {
  const unsafeAnswers = [
    "I can't stay safe",
    "I won't stay safe",
    "I don't feel safe",
    "I feel unsafe",
    "nowhere feels safe",
    "I am not sure I am safe",
  ];
  for (const msg of unsafeAnswers) {
    const c = classifyInnerMateMessage(msg, L2_CONTEXT);
    assert.equal(c.riskLevel, 3, `"${msg}" got Level ${c.riskLevel}`);
    assert.notEqual(c.safetyFollowUp, "confirmed_safe", `"${msg}" was read as safe`);
  }
});

test("L3 signals are never downgraded by follow-up matching", () => {
  const c = classifyInnerMateMessage("i will kill myself but not now", L2_CONTEXT);
  assert.equal(c.riskLevel, 3);
  const noCtx = classifyInnerMateMessage("i will kill myself but not now");
  assert.equal(noCtx.riskLevel, 3);
});

test("long unsafe answers (over 60 chars) still classify as not safe", () => {
  const c = classifyInnerMateMessage(
    "I don't think I can stay safe tonight, I'm scared and I'm all alone",
    L2_CONTEXT,
  );
  assert.equal(c.riskLevel, 3);
  assert.equal(c.safetyFollowUp, "not_safe");
});

test("changing the subject after risk language keeps the safety posture open", () => {
  const c = classifyInnerMateMessage("sorry, forget I said that", L2_CONTEXT);
  assert.equal(c.riskLevel, 2);
  assert.equal(c.responseMode, "safety");
  assert.equal(c.carryOver, true);
});

test("ambiguous 'ok' after a safety check is watchful carry-over, not confirmed safe", () => {
  const c = classifyInnerMateMessage("ok", L2_CONTEXT);
  assert.equal(c.riskLevel, 2);
  assert.notEqual(c.safetyFollowUp, "confirmed_safe");
});

test("the 'Ground me for 2 minutes' chip keeps safety mode during risk context", () => {
  const c = classifyInnerMateMessage(
    "Ground me for the next two minutes, one small step at a time.",
    L2_CONTEXT,
  );
  assert.equal(c.riskLevel, 2);
  assert.equal(c.responseMode, "safety");
});

test("clear safe answers still work", () => {
  for (const msg of ["safe", "I can stay safe", "I guess I can stay safe", "no i wont hurt myself"]) {
    const c = classifyInnerMateMessage(msg, L2_CONTEXT);
    assert.equal(c.safetyFollowUp, "confirmed_safe", `"${msg}" was not read as safe`);
  }
});

test("housing complaints are not ideation", () => {
  assert.equal(
    classifyInnerMateMessage("I don't want to live here anymore, this flat is terrible").riskLevel,
    0,
  );
  assert.equal(
    classifyInnerMateMessage("I'm tired of living with my roommate honestly").riskLevel,
    0,
  );
});

test("Hindi perfective 'zindagi khatam' lands at Level 2", () => {
  assert.equal(classifyInnerMateMessage("meri zindagi khatam ho gayi hai").riskLevel, 2);
});

test("'I feel so worthless' → Level 1 (broadened matching)", () => {
  assert.equal(classifyInnerMateMessage("I feel so worthless today").riskLevel, 1);
});

test("'Help me calm down' routes to calm/grounding", () => {
  const c = classifyInnerMateMessage("Help me calm down");
  assert.equal(c.responseMode, "calm");
  assert.equal(toWireMode(c), "grounding");
});

// ── QA-suite gap fixes (Category H/C/D coverage) ───────────────────────────

test("QA-H: previously-missed passive risk phrasings land at Level 2", () => {
  const cases = [
    "I feel unsafe with myself these days",
    "I feel like life has no meaning",
    "Nobody will care if I am gone",
  ];
  for (const msg of cases) {
    const c = classifyInnerMateMessage(msg);
    assert.equal(c.riskLevel, 2, `"${msg}" got Level ${c.riskLevel}`);
    assert.equal(c.responseMode, "safety");
  }
});

test("QA-H: 'unsafe with myself TONIGHT' escalates to Level 3 (time-boxed risk)", () => {
  assert.equal(classifyInnerMateMessage("I feel unsafe with myself tonight").riskLevel, 3);
});

test("QA-H: harm toward another person routes to safety de-escalation", () => {
  const c = classifyInnerMateMessage("I want to hurt him");
  assert.equal(c.riskLevel, 2);
  assert.equal(c.harmOthers, true);
  assert.equal(c.responseMode, "safety");
  assert.equal(c.shouldShowHotline, false);
});

test("QA-H: third-party self-harm talk is NOT harm-others", () => {
  const c = classifyInnerMateMessage("my friend wants to kill herself");
  assert.notEqual(c.harmOthers, true);
});

test("QA-H: third-party disclosure routes to support-the-supporter safety", () => {
  for (const msg of [
    "my friend wants to kill herself",
    "my brother says he wants to die",
    "my friend is suicidal and I don't know what to do",
  ]) {
    const c = classifyInnerMateMessage(msg);
    assert.equal(c.riskLevel, 2, `"${msg}" got Level ${c.riskLevel}`);
    assert.equal(c.thirdParty, true, `"${msg}" not flagged third-party`);
    assert.equal(c.shouldShowHotline, true);
  }
});

test("QA-H: first-person 'I am suicidal' stays the self-safety script", () => {
  const c = classifyInnerMateMessage("I am suicidal");
  assert.equal(c.riskLevel, 2);
  assert.notEqual(c.thirdParty, true);
  assert.equal(c.shouldAskSafetyCheck, true);
});

test("QA-H: risk labels keep the safety posture open past the text window", () => {
  const c = classifyInnerMateMessage("anyway, how does journaling work?", {
    recentUserMessages: ["thanks", "ok"],
    recentRiskLabel: true,
  });
  assert.equal(c.riskLevel, 2);
  assert.equal(c.carryOver, true);
});

test("QA-H: self-harm intent still beats harm-others matching", () => {
  assert.equal(classifyInnerMateMessage("I want to kill myself").riskLevel, 3);
});

test("QA-C: impulse phrasings route to no_impulse", () => {
  const cases = [
    "I am going to text her right now.",
    "I want to check her LinkedIn.",
    "I want to check if she is online.",
    "I am drunk and want to call her.",
    "I feel like if I don't act now, I will lose her forever.",
  ];
  for (const msg of cases) {
    const c = classifyInnerMateMessage(msg);
    assert.equal(c.responseMode, "no_impulse", `"${msg}" mode was ${c.responseMode}`);
  }
});

test("QA-D: panic phrasings route to calm mode", () => {
  const cases = [
    "My chest feels heavy and I cannot think.",
    "I am losing control.",
    "I cannot stop crying.",
    "I want peace.",
  ];
  for (const msg of cases) {
    const c = classifyInnerMateMessage(msg);
    assert.equal(c.responseMode, "calm", `"${msg}" mode was ${c.responseMode}`);
  }
});
