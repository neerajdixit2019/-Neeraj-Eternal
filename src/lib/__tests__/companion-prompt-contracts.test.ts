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
import { parseArrivalQuestions, parseArrivalRead, FALLBACK_QUESTIONS, fallbackRead } from "../arrival-schema.ts";
import { TEACHINGS, selectTeachings, namesTradition, wisdomGroundingBlock } from "../wisdom.ts";

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
  assert.ok(P.includes("Never quote verse numbers"));
  assert.ok(/never blame karma/i.test(P));
  assert.ok(P.includes("Honor the feeling FIRST"));
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

test("Voice: hard length rule, question restraint, contractions, language mirroring", () => {
  assert.ok(P.includes("HARD LENGTH RULE"));
  assert.ok(P.includes("At most ONE question per reply"));
  assert.ok(P.includes("use contractions"));
  assert.ok(P.includes("Mirror their language"));
  assert.ok(P.includes("Never open two replies in a row"));
});

test("Voice: discussion stance — thread-following, varied moves, honest pushback", () => {
  assert.ok(P.includes("A DISCUSSION, NOT AN INTERVIEW"));
  assert.ok(P.includes("Follow ONE thread across turns"));
  assert.ok(P.includes("tentative reading they can correct"));
  assert.ok(P.includes("Being corrected is progress"));
  assert.ok(P.includes("Disagree sometimes"));
  assert.ok(P.includes("A companion who agrees with everything isn't listening"));
});

test("Voice: no chatbot tells — em-dash rule present, examples and templates dash-free", () => {
  assert.ok(P.includes("NO EM-DASHES"));
  assert.ok(P.includes("No ventriloquizing"));
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

// ── Arrival questions: AI output contract ───────────────────────────────────

test("Arrival: valid AI JSON parses, including fenced replies", () => {
  const raw = '```json\n{"questions":[{"title":"What is pulling at you most?","options":["the day ahead","one person","my own thoughts","nothing specific"]},{"title":"What would help right now?","options":["quiet","company","movement","a plan"]}]}\n```';
  const qs = parseArrivalQuestions(raw);
  assert.ok(qs);
  assert.equal(qs!.length, 2);
  assert.equal(qs![0].opts.length, 4);
});

test("Arrival: malformed AI output falls back to null (never breaks the ritual)", () => {
  assert.equal(parseArrivalQuestions("Sure! Here are some questions..."), null);
  assert.equal(parseArrivalQuestions('{"questions":[{"title":"only one","options":["a","b","c","d"]}]}'), null);
  assert.equal(parseArrivalQuestions('{"questions":[{"title":"bad opts","options":["a"]},{"title":"x","options":["a","b","c","d"]}]}'), null);
});

test("Arrival: em-dashes are cleaned from AI questions and reads", () => {
  const raw = '{"questions":[{"title":"Heavy morning — what sits closest?","options":["work — deadlines","someone I miss","my health","the future"]},{"title":"What would soften it?","options":["rest","talking","a walk","writing"]}]}';
  const qs = parseArrivalQuestions(raw);
  assert.ok(qs);
  for (const q of qs!) {
    assert.ok(!q.title.includes("—"));
    for (const o of q.opts) assert.ok(!o.l.includes("—"));
  }
  const read = parseArrivalRead("You came in heavy — and still came. That counts.");
  assert.ok(read && !read.includes("—"));
});

test("Arrival: reads are clamped and short garbage rejected", () => {
  assert.equal(parseArrivalRead("ok"), null);
  const long = parseArrivalRead("a".repeat(400));
  assert.ok(long && long.length <= 220);
});

test("Arrival: fallback set is intact and composes a read", () => {
  assert.equal(FALLBACK_QUESTIONS.length, 2);
  const read = fallbackRead([FALLBACK_QUESTIONS[0].opts[1], FALLBACK_QUESTIONS[1].opts[3]]);
  assert.ok(read.includes("circling one thing"));
  assert.ok(read.includes("rest"));
});

// ── Wisdom / scripture ───────────────────────────────────────────────────────

test("Wisdom: teachings span multiple traditions, none preachy", () => {
  const traditions = new Set(TEACHINGS.map((t) => t.tradition));
  assert.ok(traditions.has("Gita"));
  assert.ok(traditions.size >= 5, `only ${traditions.size} traditions`);
  assert.ok(TEACHINGS.length >= 12);
});

test("Wisdom: NO teaching contains a verse number or em-dash", () => {
  for (const t of TEACHINGS) {
    assert.ok(!t.plain.includes("—"), `${t.id} has an em-dash`);
    // No "chapter N", "verse N", or "N.N" citation patterns
    assert.ok(!/\b(chapter|verse|shloka)\s*\d/i.test(t.plain), `${t.id} cites a number`);
    assert.ok(!/\b\d+[.:]\d+\b/.test(t.plain), `${t.id} has a verse-number pattern`);
  }
});

test("Wisdom: 'what does the Gita say about attachment' selects a real teaching", () => {
  const picks = selectTeachings("what does the gita say about attachment");
  assert.ok(picks.length >= 1);
  assert.ok(namesTradition("what does the gita say about attachment"));
  const block = wisdomGroundingBlock("what does the gita say about attachment");
  assert.ok(block.includes("WISDOM TO DRAW FROM"));
  assert.ok(block.includes("you may say which tradition"));
});

test("Wisdom: self-forgiveness maps to the be-your-own-friend teaching", () => {
  const picks = selectTeachings("how do i forgive myself, i can't forgive myself");
  assert.ok(picks.some((t) => t.id === "gita-be-your-friend"));
});

test("Wisdom: an ordinary message with no meaning-seeking yields no grounding", () => {
  assert.equal(wisdomGroundingBlock("had a long day at work"), "");
  assert.equal(selectTeachings("what's for dinner").length, 0);
});

test("Wisdom: grounding block hides the tradition name when not asked", () => {
  const block = wisdomGroundingBlock("i can't stop clinging to the past, how do i let go");
  assert.ok(block.length > 0);
  assert.ok(block.includes("do not name the tradition unless they ask"));
});

test("Wisdom: persona knows the traditions and forbids bypassing", () => {
  assert.ok(P.includes("You genuinely know these traditions"));
  assert.ok(P.includes("never use wisdom to bypass"));
  assert.ok(P.includes("Never quote verse numbers"));
});

test("Voice: dependency and role boundaries", () => {
  assert.ok(P.includes("Never encourage dependency"));
  assert.ok(P.includes("Never present yourself as the user's best friend, romantic companion or only safe place"));
  assert.ok(P.includes("You are not a work tool"));
});

// ── Transcript-review contracts (real production failure, 2026) ──────────────
// A frustrated user asked for wisdom/specificity and got grounding tips and
// symptom-checklists across nine turns. These pin the steers that prevent it.

test("Attunement: answer the ask, don't default to coping", () => {
  assert.ok(P.includes("ANSWER THE ASK YOU WERE GIVEN"));
  assert.ok(P.includes("on the FIRST reply"));
  assert.ok(P.includes("not a coping tip or a breathing cue"));
});

test("Grounding is opt-in: a neutral message must not trigger calming cues", () => {
  assert.ok(P.includes("Never enter this mode unprompted"));
  assert.ok(/not an invitation to ground/.test(P));
});

test("Anti-checklist: specific means one sharp thing, never a list", () => {
  assert.ok(P.includes("Being specific means naming ONE thing sharply, not listing several"));
  assert.ok(P.includes("Never number things to check"));
  assert.ok(P.includes("Itemizing is not the same as being concrete"));
});

test("Calibration: hold uncertain claims loosely on the first pass", () => {
  assert.ok(P.includes("Hold uncertain things loosely"));
  assert.ok(P.includes("not \"the body tells you first\""));
  assert.ok(P.includes("that honesty belongs in the first reply, not only after you're challenged"));
});

test("Ventriloquizing ban now covers quoted words and scripted self-questions", () => {
  assert.ok(P.includes("don't put quoted words in their mouth or script a question for them to ask themselves"));
});
