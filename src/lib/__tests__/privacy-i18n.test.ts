import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const src = readFileSync("src/routes/_app.privacy.tsx", "utf-8");

describe("privacy: every disclosure sentence has Hindi", () => {
  it("every tx() literal on the page has a Hindi translation", () => {
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 35, `expected the privacy doc's many sentences, found ${found.length}`);
    for (const k of found) {
      assert.ok(HI_TEXT[k] !== undefined, `"${k.slice(0, 50)}…" is tx-wrapped but has no Hindi`);
    }
  });
});

describe("privacy: informed-consent fidelity is preserved in Hindi", () => {
  // A privacy document a Hindi reader can't verify is not informed consent.
  // The Hindi must state the SAME facts as the code enforces — no softening,
  // no omission of what is KEPT for safety/legal reasons.
  it("the 'Screen Privacy Mode is NOT encryption' warning survives translation", () => {
    assert.equal(HI_TEXT["not encryption"], "एन्क्रिप्शन नहीं");
  });
  it("what delete KEEPS still names safety events, consent records, and data-rights requests", () => {
    assert.ok(HI_TEXT["safety events"]?.includes("सुरक्षा"), "safety events");
    assert.ok(HI_TEXT["consent records"]?.includes("सहमति"), "consent records");
    assert.ok(HI_TEXT["data-rights requests"]?.includes("डेटा-अधिकार"), "data-rights requests");
  });
  it("the journal-not-sent guarantee keeps its negation in Hindi", () => {
    assert.ok(HI_TEXT["Your journal entries are not sent to the AI unless you paste them in."]?.includes("नहीं भेजी"),
      "must keep the 'not sent' negation");
  });
  it("the crisis footer points to a helpline in Hindi", () => {
    assert.ok(HI_TEXT["This app is a companion, not a clinician. In a crisis, please call a local helpline."]?.includes("हेल्पलाइन"));
  });
});

describe("privacy: gender-neutral Hindi (no participle agreeing with the user)", () => {
  it("no banned user-gendered forms in the privacy Hindi values", () => {
    const keys = [
      "Messages you write to the Companion or in a Reflection.",
      "Urge Shield pauses you choose to save.",
      "A JSON file with your profile, mood logs, journal entries, memories, story, AI conversations and messages, reflection sessions and turns, weekly letters, path progress, feedback, and consent records. Media files (e.g. memory photos) are referenced by path; you can re-download them individually from the Memories page.",
    ];
    for (const k of keys) {
      const hi = HI_TEXT[k] ?? "";
      for (const bad of ["करते हैं", "सकते हैं", "चुनते हैं", "लिखते हैं"]) {
        assert.ok(!hi.includes(bad), `"${bad}" (user-gendered) in: ${k.slice(0, 40)}…`);
      }
    }
  });
});
