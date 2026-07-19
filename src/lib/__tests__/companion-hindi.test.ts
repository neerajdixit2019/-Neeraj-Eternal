import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildActiveDangerReply,
  buildSafetyCheckFallback,
  crisisResourcesFor,
} from "../crisis-resources.ts";
import { classifyInnerMateMessage } from "../companion-risk.ts";

/**
 * Phase 21 — InnerMate answers in your language.
 *
 * The model reply language is steered by a prompt directive (AI output, not
 * load-bearing). What IS load-bearing and tested here: the deterministic L3/L2
 * templates in Hindi (numbers ONLY from config), and the safety-loop closure —
 * the one-word Hindi answers the L2 template offers must be exactly what the
 * classifier recognizes, or a Hindi "unsafe" reply is silently missed.
 */

describe("hindi crisis reply: numbers come ONLY from config", () => {
  const hi = buildActiveDangerReply("IN", "hi");
  const phones = crisisResourcesFor("IN").map((r) => r.phone);

  it("includes every configured helpline number", () => {
    for (const p of phones) assert.ok(hi.includes(p), `missing ${p}`);
  });
  it("contains no phone-length digit-run that isn't a configured number", () => {
    // Short runs (e.g. "24/7", "13 भाषाएँ") are descriptive; a dialable number
    // is 3+ digits. Every such run must be a configured helpline.
    const runs = (hi.match(/\d+/g) ?? []).filter((r) => r.length >= 3);
    for (const run of runs) {
      assert.ok(phones.includes(run), `stray number in Hindi L3 reply: "${run}"`);
    }
  });
  it("keeps Tele-MANAS and the SOS affordance untranslated", () => {
    assert.ok(hi.includes("Tele-MANAS"), "Tele-MANAS must not be translated");
    assert.ok(hi.includes("SOS"), "SOS affordance stays");
  });
  it("is actually Hindi (Devanagari), not the English template", () => {
    assert.ok(/[ऀ-ॿ]/.test(hi), "expected Devanagari");
    assert.ok(!hi.includes("I'm staying right here"), "must not be the English copy");
  });
  it("stays gender-neutral about the user (no gendered participle)", () => {
    // 1st-person gendered forms would gender the (genderless) companion;
    // "सकते हैं" is the honorific-plural about the user the reviews flagged.
    // ("सकती है"/"सकता है" agreeing with a NOUN like चीज़ is fine, not listed.)
    for (const bad of ["करता हूँ", "करती हूँ", "रहा हूँ", "रही हूँ", "दबा सकते हैं", "रह सकते हैं"]) {
      assert.ok(!hi.includes(bad), `gendered form "${bad}" in Hindi L3 reply`);
    }
  });
  it("English default is unchanged (regression)", () => {
    const en = buildActiveDangerReply();
    assert.ok(en.includes("I'm staying right here with you"));
    assert.ok(en.includes("14416"));
    assert.equal(en, buildActiveDangerReply("IN", "en"));
  });
});

describe("hindi safety-check fallback closes the loop with the classifier", () => {
  const hi = buildSafetyCheckFallback("hi");

  it("offers the one-word answers सुरक्षित / असुरक्षित", () => {
    assert.ok(hi.includes("सुरक्षित"), "must invite 'सुरक्षित'");
    assert.ok(hi.includes("असुरक्षित"), "must invite 'असुरक्षित'");
  });
  it("the offered UNSAFE word escalates in a recent-risk context", () => {
    const r = classifyInnerMateMessage("असुरक्षित", { recentRiskLabel: true });
    assert.equal(r.riskLevel, 3, r.reason);
    assert.equal(r.safetyFollowUp, "not_safe");
  });
  it("the offered SAFE word confirms safe in a recent-risk context", () => {
    const r = classifyInnerMateMessage("सुरक्षित", { recentRiskLabel: true });
    assert.equal(r.riskLevel, 2);
    assert.equal(r.safetyFollowUp, "confirmed_safe");
  });
  it("a fuller Hindi 'not safe' answer also escalates", () => {
    const r = classifyInnerMateMessage("नहीं, मैं सुरक्षित नहीं हूं अभी", { recentRiskLabel: true });
    assert.equal(r.riskLevel, 3);
    assert.equal(r.safetyFollowUp, "not_safe");
  });
  it("English default unchanged (regression)", () => {
    const en = buildSafetyCheckFallback();
    assert.ok(en.includes("safe or not safe"));
    assert.equal(en, buildSafetyCheckFallback("en"));
  });
});

describe("hindi safety-check: a question/negation is NOT a confirmation", () => {
  const risk = { recentRiskLabel: true };
  // A Hindi yes/no question puts "सुरक्षित हूँ" contiguously at the end, and a
  // "नहीं, मैं सुरक्षित हूं" leads with negation — neither may read confirmed_safe.
  it("'क्या मैं सुरक्षित हूँ?' (a question) does not confirm safe", () => {
    const r = classifyInnerMateMessage("क्या मैं सुरक्षित हूँ?", risk);
    assert.notEqual(r.safetyFollowUp, "confirmed_safe");
    assert.equal(r.responseMode, "safety"); // safety stays open (watchful)
  });
  it("'नहीं, मैं सुरक्षित हूं' (leading negation) does not confirm safe", () => {
    const r = classifyInnerMateMessage("नहीं, मैं सुरक्षित हूं", risk);
    assert.notEqual(r.safetyFollowUp, "confirmed_safe");
  });
  it("a plain 'सुरक्षित' still confirms safe (the veto isn't over-broad)", () => {
    assert.equal(classifyInnerMateMessage("सुरक्षित", risk).safetyFollowUp, "confirmed_safe");
  });
});
