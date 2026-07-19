import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const src = readFileSync("src/routes/onboarding.tsx", "utf-8");

// The option values that are DISPLAYED via tx() but STORED in English.
const OPTION_LABELS = [
  "Heartbreak", "Missing Someone", "Loneliness", "Overthinking", "Anxiety",
  "Social Media Comparison", "Career Pressure", "I Just Need to Write",
  "Calm down", "Write freely", "Understand my emotions", "Stop overthinking",
  "Sleep", "Feel less alone",
  "Soft and gentle", "Direct and practical", "Deep and reflective",
  "Use wisdom from Gita/scriptures only when helpful", "Avoid spiritual advice unless I ask",
  "Don't push positivity", "Don't give long lectures",
  "Don't use Hindi unless I choose it", "Don't mention my memories unless relevant",
];

// Mood words rendered via tx(lang, m.word) — dynamic, so the tx() literal scan
// can't see them. Mirror the MOODS list in onboarding.tsx.
const MOOD_WORDS = ["Heavy", "Cloudy", "Settled", "Open", "Bright"];

// The full acknowledgment sets — rendered via tx(lang, STRUGGLE_ACK[...]) /
// tx(lang, NEED_ACK[...]) / tx(lang, moodEntry.ack), i.e. dynamic keys the
// literal scan misses. A new struggle/need/mood added without its Hindi pair
// must fail here, not ship English to a Hindi reader.
const ALL_ACKS = [
  // STRUGGLE_ACK
  "Heartbreak has real weight. Thank you for naming it.",
  "Missing someone can fill a whole day. It makes sense you came.",
  "Loneliness is heavy to carry quietly. You just said it out loud, which matters.",
  "A mind that won't stop is exhausting. We can slow it down together.",
  "Anxiety makes everything louder. There's no rush here.",
  "Other people's highlight reels are a hard mirror. Good that you noticed what it does to you.",
  "Career pressure can sit on your chest. It's allowed to be heavy.",
  "Then this will be your page. No performance needed.",
  // NEED_ACK
  "then we'll keep things slow and low-light.",
  "the page will always be ready first.",
  "we'll name things gently, one at a time.",
  "shorter loops, softer landings.",
  "evenings here will wind down with you.",
  "you won't be writing into a void.",
  // MOODS ack
  "Heavy days deserve gentleness, not homework. We'll keep this light.",
  "A tender, unclear kind of day. That's okay to bring here.",
  "Somewhere in the middle. That's a real answer too.",
  "A little ease today. Let's keep it.",
  "Something's going well. Worth noticing on purpose.",
];

describe("onboarding: bilingual from the first breath", () => {
  it("offers a language choice at the very start (before any question)", () => {
    assert.ok(src.includes("setLang"), "onboarding must let the reader switch language");
    // both languages are offered, and the toggle sits in step 0 (welcome)
    assert.ok(src.includes('["en", "hi"]') || src.includes("'en', 'hi'"), "both languages offered");
    assert.ok(src.includes("Choose your language"), "the language chooser is labelled");
  });

  it("every fixed tx() string in the room has Hindi", () => {
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 40, `expected onboarding's many strings, found ${found.length}`);
    for (const k of found) {
      assert.ok(HI_TEXT[k] !== undefined, `"${k}" is tx-wrapped but has no Hindi`);
    }
  });

  it("every option label a reader can pick has a Hindi display", () => {
    for (const label of OPTION_LABELS) {
      assert.ok(HI_TEXT[label], `option "${label}" missing Hindi`);
    }
  });

  it("every mood word has a Hindi display", () => {
    // rendered via tx(lang, m.word), which the literal tx() scan can't reach
    for (const word of MOOD_WORDS) {
      assert.ok(HI_TEXT[word], `mood "${word}" missing Hindi`);
    }
  });

  it("every acknowledgment line — struggle, need, and mood — has Hindi", () => {
    // the full sets, not a sample: these render via dynamic tx(lang, ACK[key])
    // calls the literal scan never sees, so a missing pair would ship English
    for (const ack of ALL_ACKS) {
      assert.ok(HI_TEXT[ack], `ack missing Hindi: ${ack}`);
    }
  });

  it("the coverage lists stay in step with onboarding.tsx", () => {
    // guards against the source growing a struggle/need/mood the test forgot:
    // if the counts drift, extend the mirrored lists above.
    assert.equal(MOOD_WORDS.length, [...src.matchAll(/word:\s*"/g)].length, "MOODS count drifted");
    const ackCount = [...src.matchAll(/ack:\s*"/g)].length; // MOODS acks only
    assert.ok(ackCount === 5, `expected 5 mood acks in source, found ${ackCount}`);
  });
});

describe("onboarding: what's stored stays English, whatever the display", () => {
  it("submits the raw English state values, never the translated labels", () => {
    // the personalization contract downstream matches these exact strings
    assert.ok(src.includes("primary_struggle: struggle"), "struggle stored as the English value");
    assert.ok(src.includes("initial_need: need"), "need stored as the English value");
    assert.ok(src.includes("speaking_styles: [speakStyle"), "styles stored as English values");
    // the tx() wrapping is display-only — no tx() around the submitted values
    const submitBody = src.slice(src.indexOf("const submit"), src.indexOf("const sheetLines"));
    assert.ok(!/tx\(lang,\s*struggle\)|tx\(lang,\s*need\)/.test(submitBody), "stored values must not be translated");
  });
});

describe("onboarding: the crisis number comes from the config", () => {
  it("uses crisis-resources, not a hand-typed number", () => {
    assert.ok(src.includes('crisisResourcesFor("IN")'), "crisis line must read from the config");
    assert.ok(src.includes("formatCrisisPhone"), "the number is formatted from config");
    assert.ok(!/tel:14416|Tele-MANAS 14416/.test(src), "no hand-typed helpline number");
  });
});
