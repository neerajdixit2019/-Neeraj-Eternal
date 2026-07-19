import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const src = readFileSync("src/routes/_app.reflect.tsx", "utf-8");

function txLiterals(s: string): string[] {
  return [...s.matchAll(/tx\((?:lang|uiLang),\s*"((?:[^"\\]|\\.)*)"\)/g)]
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

describe("reflect: every tx() literal has Hindi", () => {
  it("all wrapped strings translate", () => {
    const found = txLiterals(src);
    assert.ok(found.length >= 55, `expected the reflect chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `"${k}" wrapped but no Hindi`);
  });
});

describe("reflect: the dynamically-rendered values translate", () => {
  it("categories, feedback reasons, ratings, prompts, and micro-action types have Hindi", () => {
    for (const k of [
      // categories
      "Heartbreak", "Loneliness", "Anxiety", "Overthinking", "Relationship confusion",
      "Work pressure", "Family stress", "Something else",
      // feedback reasons
      "Felt too generic", "Too much advice", "Did not understand me", "Too long",
      "Too clinical", "Too emotional", "Repetitive", "Other",
      // ratings
      "Yes", "A little", "Not really",
      // prompts
      "What are you replaying?", "What do you wish you could say?", "What feels hardest to accept?",
      // micro-action types (rendered via action.type.replace("_"," "))
      "breathing", "grounding", "journal", "pause", "reach out",
    ]) {
      assert.ok(HI_TEXT[k] !== undefined, `"${k}" rendered via tx() but no Hindi`);
    }
  });
});

describe("reflect: the loud strings a writer reads are wrapped", () => {
  it("headings, CTAs, and both invoke-error toasts translate", () => {
    for (const k of [
      "What feels heaviest right now?",
      "You do not need to make it sound perfect.",
      "Receive a Quiet Reflection",
      "Creating a quiet reflection…",
      "Continue Gently",
      "Reflect on This",
    ]) {
      assert.ok(src.includes(`, "${k.replace(/"/g, '\\"')}")`), `not wrapped: ${k}`);
      assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
    }
  });
});

describe("reflect: the language is forwarded to the AI (part B)", () => {
  it("both edge-function invokes send lang", () => {
    assert.ok(src.includes('invoke("generate-reflection"'), "generate-reflection invoked");
    assert.ok(src.includes('invoke("continue-reflection"'), "continue-reflection invoked");
    // lang:uiLang must appear in each body (2 invokes → at least 2 occurrences)
    const langSends = [...src.matchAll(/lang:\s*uiLang/g)].length;
    assert.ok(langSends >= 2, `expected lang forwarded to both invokes, found ${langSends}`);
  });
});

describe("reflect: the crisis hotline number is never translated", () => {
  it("14416 stays a raw literal in reflect.tsx, never inside a tx() call", () => {
    assert.ok(src.includes("14416"), "the crisis number literal is present in the UI");
    // The number must live as inline JSX/literal, never as a translatable string —
    // translating it would let the Hindi copy drift from the real hotline.
    const txWithNumber = [...src.matchAll(/tx\((?:lang|uiLang),\s*"[^"]*14416[^"]*"\)/g)];
    assert.equal(txWithNumber.length, 0, "the hotline number must never be wrapped in tx()");
  });
});

describe("reflect: category/reason/rating VALUES stay English (display-only)", () => {
  it("the stored/functional values are never Devanagari", () => {
    // CATEGORIES label doubles as the value sent to the edge function; REASON/RATING ids
    // are the stored keys. Translating any of them would corrupt the AI request + feedback.
    for (const v of ["Heartbreak", "Loneliness", "Anxiety", "Something else"]) {
      assert.match(src, new RegExp(`label:\\s*"${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), `CATEGORIES lost value "${v}"`);
    }
    for (const id of ["felt_too_generic", "too_much_advice", "yes", "a_little", "not_really"]) {
      assert.match(src, new RegExp(`"${id}"`), `stored id "${id}" missing`);
    }
    // no Devanagari in any label:/id: value position
    assert.ok(!/(?:label|id):\s*"[^"]*[ऀ-ॿ]/.test(src), "a stored value was translated into Devanagari");
  });
});
