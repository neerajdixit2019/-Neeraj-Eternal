import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

/**
 * Phase 27 — the companion room speaks your language, all the way down.
 *
 * _app.companion.tsx was mostly bilingual via tx(uiLang, …), but ~14 chrome
 * strings (aria-labels, tooltips, placeholders, bare JSX nodes, the thinking
 * phases and the crisis footer) leaked English in Hindi mode. This test pins:
 *   1. coverage — every tx(uiLang,"…") literal on the page has a Hindi value;
 *   2. dynamic content — strings rendered via tx(uiLang, VARIABLE) (facets,
 *      phase copy, chips) have Hindi too, since the literal scan can't see them;
 *   3. the leak-guard — no unwrapped aria-label/placeholder/title/bare-node
 *      slips back in (a coverage test can only see what WAS wrapped);
 *   4. the crisis footer keeps "Tele-MANAS 14416" literal (numbers never
 *      translate), while its prose is wrapped and carries no digits;
 *   5. the new Hindi stays gender-neutral about the user.
 */

const src = readFileSync("src/routes/_app.companion.tsx", "utf-8");

// ── 1. Coverage: every wrapped literal resolves to Hindi ──
describe("companion: every wrapped chrome string has Hindi", () => {
  it('every tx(uiLang,"…") literal on the page has a Hindi translation', () => {
    const found = [
      ...src.matchAll(/tx\((?:uiLang|uiLangRef\.current),\s*"((?:[^"\\]|\\.)*)"\)/g),
    ].map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 25, `expected the companion chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `"${k}" tx-wrapped but no Hindi`);
  });
});

// ── 2. Dynamically-rendered content: tx(uiLang, VARIABLE) — assert directly ──
// These render through a variable (FACETS[m], PHASE_COPY[p], chip.label, …), so
// the literal scan above can't see them; a new one shipping English-only would
// pass #1 silently. Pin their Hindi here.
const DYNAMIC = [
  // header facet line (FACETS[lastMode].line)
  "listening, quietly", "grounding, together", "steadying the wave",
  "building something small", "turning toward the page", "in slightly deeper water",
  "slowing it down, together", "right here with you",
  // pending "thinking" copy (PHASE_COPY[m.phase] + the fallback)
  "Listening with you", "Taking a breath", "Finding the words", "Holding this carefully",
  "Quietly thinking",
  // empty-state invitations
  "help me put the day down", "something is still tugging at me", "i don't know where to start",
  // support modes (label + hint) — the seeds are never displayed, so not listed
  "Just listen", "stay with me, no fixing",
  "Help me settle", "calm my body and mind",
  "Help me understand", "see what's really here",
  "Help me decide", "compare the choices",
  "One small step", "what can I actually do",
  "Pause an impulse", "before I react",
  // tone chips (label + description)
  "Gentle", "Poetic", "Practical",
  "Warm, soft, patient.", "Metaphorical and spacious.", "Grounded, direct, actionable.",
  // safety-mode chips (the only chips this room renders)
  "I can stay safe", "I may not be safe", "Ground me for 2 minutes", "Open SOS",
];
describe("companion: dynamically-rendered content has Hindi too", () => {
  for (const k of DYNAMIC) {
    it(`"${k.slice(0, 32)}" has Hindi`, () => assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`));
  }
});

// ── 3. Leak-guard: nothing unwrapped slips back in ──
describe("companion: no English leaks past the tx() net", () => {
  it("no aria-label carries a bare (unwrapped) string literal", () => {
    const leaks = [...src.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(leaks.length, 0, `unwrapped aria-label(s): ${leaks.join(" | ")}`);
  });
  it("no placeholder carries a bare string literal", () => {
    const leaks = [...src.matchAll(/placeholder="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(leaks.length, 0, `unwrapped placeholder(s): ${leaks.join(" | ")}`);
  });
  it("no title attribute carries a bare string literal", () => {
    const leaks = [...src.matchAll(/\stitle="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(leaks.length, 0, `unwrapped title(s): ${leaks.join(" | ")}`);
  });
  it("the known bare JSX text nodes are wrapped now", () => {
    for (const bare of [
      ">Conversations</SheetTitle>",
      "/>New conversation",
      ">Listening</span>",
      ">Stop</Button>",
      ">Voice language</p>",
    ]) {
      assert.ok(!src.includes(bare), `bare node still present: ${bare}`);
    }
  });
});

// ── 4. The crisis footer: number stays, prose translates, no digits in Hindi ──
describe("companion: the crisis footer keeps its number literal", () => {
  it("Tele-MANAS 14416 and the tel: link stay hardcoded, never tx-wrapped", () => {
    assert.ok(src.includes('href="tel:14416"'), "tel:14416 link must remain");
    assert.ok(src.includes("Tele-MANAS 14416"), "Tele-MANAS 14416 stays as literal text");
    assert.ok(!/tx\((?:uiLang|uiLangRef\.current),\s*"[^"]*14416/.test(src), "the number must not be wrapped in tx");
  });
  it("the prose is wrapped, has Hindi, and that Hindi carries no digits", () => {
    const key = "A reflection guide, not a therapist. In a crisis:";
    assert.ok(src.includes(`tx(uiLang, "${key}")`), "crisis prose must be wrapped");
    const hi = HI_TEXT[key];
    assert.ok(hi !== undefined, "crisis prose needs a Hindi translation");
    assert.ok(!/[0-9०-९]/.test(hi), `crisis prose Hindi must carry no digits: ${hi}`);
    assert.ok(!/Tele-MANAS/.test(hi), "the number/brand is not part of the translated prose");
  });
});

// ── 5. Gender-neutral: no new companion Hindi agrees with the user's gender ──
describe("companion: the new Hindi stays gender-neutral about the user", () => {
  // InnerMate refers to itself as plural "we" (…रहे हैं), which is neutral, and
  // controls are आप-imperatives or nouns. What must NEVER appear is a form that
  // agrees with the (unknown) USER's gender: 1st-person singular participles,
  // आप-agreeing honorific-plural participles, and ā-ending user adjectives.
  const NEW_KEYS = [
    "Back to home", "Conversation history", "Conversations", "Search…",
    "Nothing matches.", "No conversations yet. Start one — it stays private.",
    "Let this conversation go? You can always begin another.", "Delete conversation",
    "Tone settings", "Listening with you", "Taking a breath", "Finding the words",
    "Holding this carefully", "Quietly thinking", "Listening", "Stop",
    "Stop voice input", "Start voice input", "Speak", "Voice unavailable",
    "Voice input not supported", "Voice language", "Re-record", "Clear",
    "A reflection guide, not a therapist. In a crisis:",
    "Microphone permission denied.", "Couldn't hear you. Try again.",
    "Not signed in", "Companion error",
  ];
  const USER_GENDERED = [
    "करता हूँ", "करती हूँ", "रहा हूँ", "रही हूँ", "सकता हूँ", "सकती हूँ",
    "करते हैं", "करती हैं", "रखते हैं", "रखती हैं", "सकते हैं", "सकती हैं",
    "अकेला", "अकेली", "थका", "थकी", "अनदेखा", "अनदेखी",
  ];
  it("every new companion key has Hindi", () => {
    for (const k of NEW_KEYS) assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
  });
  it("no new companion Hindi uses a user-agreeing form", () => {
    for (const k of NEW_KEYS) {
      const hi = HI_TEXT[k] ?? "";
      for (const bad of USER_GENDERED) {
        assert.ok(!hi.includes(bad), `"${bad}" (user-gendered) in "${k}" → ${hi}`);
      }
    }
  });
});
