import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const src = readFileSync("src/routes/index.tsx", "utf-8");

// The VALUES/STEPS copy and the constellation labels are rendered dynamically
// (tx(lang, v.title) etc.), so the tx() literal scan can't see them — assert
// their Hindi directly so a new card can't ship English-only.
const DYNAMIC_CONTENT = [
  "Understand", "Name what's here — even when it's tangled — and see it a little more clearly.",
  "Notice patterns", "What keeps returning becomes visible, gently, from your own words. Never a diagnosis.",
  "Move forward", "When you're ready, find the one small next step — not a checklist, not pressure.",
  "Begin with what's here", "One feeling, one sentence. You don't have to explain everything.",
  "InnerMate listens", "It reflects, asks one gentle question at a time, and stays at your pace.",
  "Your sky takes shape", "With your permission, what matters becomes a quiet constellation you can return to.",
  "work", "rest", "hope",
];

describe("landing: every chrome string has Hindi", () => {
  it("every tx() literal on the page has a Hindi translation", () => {
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    // hero + toggle + window + how-it-works heading + closing line + promises
    assert.ok(found.length >= 12, `expected the landing chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `"${k}" tx-wrapped but no Hindi`);
  });

  it("the dynamically-rendered cards and star labels have Hindi too", () => {
    for (const k of DYNAMIC_CONTENT) {
      assert.ok(HI_TEXT[k] !== undefined, `"${k}" rendered via tx() but no Hindi`);
    }
  });

  it("the loud promises are wrapped — hero, CTA, and both safety/privacy lines", () => {
    for (const k of [
      "You don't have to explain everything at once.",
      "Enter your quiet space",
      "InnerMate is a reflective companion — not a clinician, and not for emergencies. If you're in crisis, please reach a local emergency line or a trusted person right now.",
      "Private by design: your words stay in your account, and nothing is remembered without your permission.",
    ]) {
      assert.ok(src.includes(`tx(lang, "${k.replace(/"/g, '\\"')}")`), `not wrapped: ${k}`);
      assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
    }
  });
});

describe("landing: the pre-auth language toggle exists and is bound", () => {
  it("renders a language group that calls setLang for both languages", () => {
    assert.ok(src.includes("useLang"), "reads the shared language");
    assert.ok(src.includes("setLang(l)"), "the toggle writes the language");
    assert.ok(src.includes('role="group"'), "the toggle is a labelled group");
    assert.ok(src.includes("aria-pressed={lang === l}"), "the active language is announced");
    assert.ok(src.includes('"en", "hi"') || src.includes('["en", "hi"]'), "both languages offered");
  });

  it("the toggle sits before the door — a Hindi reader is met in Hindi first", () => {
    assert.ok(src.indexOf("setLang(l)") < src.indexOf('to="/login"'), "language precedes sign-in");
  });
});

describe("landing: the brand and feature names are never translated", () => {
  it("InnerMate stays Latin in every Hindi string that names it", () => {
    for (const [en, hi] of Object.entries(HI_TEXT)) {
      if (en.includes("InnerMate")) assert.ok(hi.includes("InnerMate"), `transliterated in: ${hi}`);
    }
  });
});

describe("landing: no English leaks past the tx() net", () => {
  // The wrap-coverage test only proves wrapped strings HAVE Hindi — it can't
  // see a string that was never wrapped. An sr-only heading is the classic
  // blind spot (it renders to no visible pixels but is read aloud): pin that
  // no accessible-name heading carries bare English text.
  it("no sr-only heading renders a bare (unwrapped) English text node", () => {
    const leaks = [...src.matchAll(/className="[^"]*\bsr-only\b[^"]*">\s*([A-Za-z][^<{]*)/g)];
    assert.equal(leaks.length, 0, `sr-only heading leaks English: ${leaks.map((m) => m[1]).join(" | ")}`);
  });
});

describe("landing: the crisis promise never carries a phone number", () => {
  // Load-bearing invariant: hotline numbers come ONLY from crisis-resources.ts.
  // Neither the English source nor the Hindi of the landing's crisis line may
  // introduce a digit (ASCII or Devanagari ०–९).
  const CRISIS_EN =
    "InnerMate is a reflective companion — not a clinician, and not for emergencies. If you're in crisis, please reach a local emergency line or a trusted person right now.";
  it("the English source has no digits", () => {
    assert.match(CRISIS_EN, /crisis/, "crisis-line key present (guards against a silent rename)");
    assert.ok(!/[0-9०-९]/.test(CRISIS_EN), "English crisis line must contain no digits");
  });
  it("the Hindi translation has no digits", () => {
    const hi = HI_TEXT[CRISIS_EN];
    assert.ok(hi !== undefined, "crisis line must have a Hindi translation");
    assert.ok(!/[0-9०-९]/.test(hi), `Hindi crisis line must contain no digits: ${hi}`);
  });
});
