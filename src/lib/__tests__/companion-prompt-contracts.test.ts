/**
 * Prompt-contract tests — categories E (mirror), F (deep thinking),
 * J (spiritual), L (bad answers), plus safety-template and memory-honesty
 * contracts. These pin the load-bearing instructions the model receives:
 * if a future edit drops one, a test fails.
 * Run with: npm run test:companion
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COMPANION_SYSTEM_PROMPT } from "../ai-gateway.server.ts";
import { buildActiveDangerReply, buildSafetyCheckFallback, crisisResourcesFor } from "../crisis-resources.ts";
import { BANNED_REPLY_PHRASES, findBannedPhrases } from "../companion-quality.ts";

const here = dirname(fileURLToPath(import.meta.url));
const apiRouteSource = readFileSync(
  join(here, "..", "..", "routes", "api", "companion.ts"),
  "utf8",
);
const P = COMPANION_SYSTEM_PROMPT;

// ── E: Mirror-mode scaffolding exists in the persona ────────────────────────

test("E: facts/feelings/assumptions separation is instructed", () => {
  assert.ok(P.includes("facts, feelings, and assumptions"));
  assert.ok(P.includes("Validate the feeling without automatically agreeing with every interpretation"));
  assert.ok(P.includes("Never claim to know another person's thoughts or intentions"));
});

test("E: guilt handling forbids verdicts in both directions", () => {
  assert.ok(P.includes("GUILT AND SELF-JUDGMENT"));
  assert.ok(P.includes("no convicting, and no reflexive acquitting"));
});

// ── F: Deep-thinking scaffolding ────────────────────────────────────────────

test("F: deeper-water facet exists with restraint rules", () => {
  assert.ok(P.includes("DEEPER WATER"));
  assert.ok(P.includes("Never preach, never quote verse numbers"));
  assert.ok(P.includes("never blame karma"));
});

test("F/J: explicit tradition asks get the named-tradition carve-out", () => {
  assert.ok(apiRouteSource.includes("you may name it and take a few extra sentences"));
});

// ── G: safety templates are deterministic and config-driven ────────────────

test("G: Level-3 template carries verified resources and the three moves", () => {
  const reply = buildActiveDangerReply("IN");
  assert.ok(reply.includes("Tele-MANAS: 14416"));
  assert.ok(reply.includes("112"));
  assert.ok(reply.toLowerCase().includes("don't stay alone"));
  assert.ok(reply.includes("SOS"));
  assert.equal(findBannedPhrases(reply).length, 0);
});

test("G: unknown region falls back to local-emergency wording, never invented numbers", () => {
  assert.equal(crisisResourcesFor("ZZ").length, 0);
  const reply = buildActiveDangerReply("ZZ");
  assert.ok(reply.includes("Call your local emergency number"));
  assert.ok(!reply.includes("14416"));
});

test("G: rate-limited Level-2 fallback asks the safety check", () => {
  const fb = buildSafetyCheckFallback();
  assert.ok(fb.includes("safe for the next 10 minutes"));
  assert.ok(fb.includes("safe or not safe"));
  assert.equal(findBannedPhrases(fb).length, 0);
});

test("G: the model is forbidden from writing hotline numbers", () => {
  assert.ok(P.includes("NEVER write hotline or emergency phone numbers yourself"));
});

test("G: medical symptoms and physical danger are handled first", () => {
  assert.ok(P.includes("possibly medical"));
  assert.ok(P.includes("pull over, step back, sit down"));
});

// ── H: memory honesty is unconditional ──────────────────────────────────────

test("H: the no-fake-memory rule is always injected (not conditional)", () => {
  assert.ok(apiRouteSource.includes("Never pretend to remember anything that is not in this context"));
  // The rule must not be gated behind story/memory presence:
  assert.ok(!apiRouteSource.includes('(storyLines.length || memoryLines.length)\n          ? "\\n\\nRULES:'));
});

test("H: pattern questions get the honest-window steer with an Insights handoff", () => {
  assert.ok(apiRouteSource.includes("never invent history, counts, or trends"));
  assert.ok(apiRouteSource.includes("Insights page"));
});

// ── L: bad-answer vocabulary ────────────────────────────────────────────────

test("L: every suite bad-pattern phrase is in the detection vocabulary", () => {
  const mustDetect = [
    "Just move on.",
    "Text her if your heart says so.",
    "Everything happens for a reason.",
    "You are overthinking.",
    "She definitely loved you.",
    "She definitely used you.",
    "Don't worry, everything will be fine.",
    "As an AI language model, I think...",
  ];
  for (const bad of mustDetect) {
    assert.ok(findBannedPhrases(bad).length > 0, `not detected: "${bad}"`);
  }
});

test("L: the persona explicitly bans the core bad phrases", () => {
  for (const s of [
    "Everything happens for a reason.",
    "Just move on.",
    "Don't worry, everything will be fine.",
    "Text her if your heart says so.",
    "You are overthinking.",
    "As an AI language model",
  ]) {
    assert.ok(P.includes(s), `persona missing ban: "${s}"`);
  }
});

test("L: confrontation-pushing is banned", () => {
  assert.ok(P.includes("do not advise sudden confrontation"));
});

test("L: clean replies pass the detector", () => {
  assert.equal(
    findBannedPhrases("That loop is exhausting — which part keeps pulling you back in?").length,
    0,
  );
  assert.ok(BANNED_REPLY_PHRASES.length >= 20);
});

// ── Voice contracts ─────────────────────────────────────────────────────────

test("Voice: hard length rule, one question, contractions, language mirroring", () => {
  assert.ok(P.includes("HARD LENGTH RULE"));
  assert.ok(P.includes("Ask exactly one simple, easy-to-answer question"));
  assert.ok(P.includes("use contractions"));
  assert.ok(P.includes("Mirror their language"));
  assert.ok(P.includes("Never open two replies in a row"));
});

test("Voice: no chatbot tells — em-dash rule present, examples and templates dash-free", () => {
  assert.ok(P.includes("NO EM-DASHES"));
  assert.ok(P.includes("No ventriloquizing feelings"));
  // Every example reply the model learns from must be dash-free
  const goodLines = P.split("\n").filter((l) => l.startsWith("Good:"));
  assert.ok(goodLines.length >= 6);
  for (const l of goodLines) {
    assert.ok(!l.includes("—"), `example still contains an em-dash: ${l}`);
  }
  // Deterministic user-facing templates must be dash-free too
  assert.ok(!buildActiveDangerReply("IN").includes("—"));
  assert.ok(!buildSafetyCheckFallback().includes("—"));
});

test("Voice: dependency and role boundaries", () => {
  assert.ok(P.includes("Never encourage dependency"));
  assert.ok(P.includes("Never present yourself as the user's best friend, romantic companion or only safe place"));
  assert.ok(P.includes("You are not a work tool"));
});
