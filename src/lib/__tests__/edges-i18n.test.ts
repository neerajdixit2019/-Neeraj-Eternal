import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const files = {
  root: readFileSync("src/routes/__root.tsx", "utf-8"),
  letter: readFileSync("src/routes/_app.letter.$id.tsx", "utf-8"),
  weekArc: readFileSync("src/components/WeekArc.tsx", "utf-8"),
  helpful: readFileSync("src/components/HelpfulnessPrompt.tsx", "utf-8"),
  reminder: readFileSync("src/components/DailyCheckinReminder.tsx", "utf-8"),
};

function txLiterals(s: string): string[] {
  return [...s.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

describe("edges: every tx() literal has Hindi", () => {
  for (const [name, src] of Object.entries(files)) {
    it(`${name} — all wrapped strings translate`, () => {
      const found = txLiterals(src);
      for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `${name}: "${k}" wrapped but no Hindi`);
    });
  }
  it("the whole edges set covers a meaningful amount of chrome", () => {
    const total = Object.values(files).reduce((n, s) => n + txLiterals(s).length, 0);
    assert.ok(total >= 55, `expected the edges chrome wrapped, found ${total}`);
  });
});

describe("edges: the load-bearing strings are wrapped", () => {
  it("404/error, the letter's keep+let-go, and the daily prompt flow translate", () => {
    for (const k of [
      "Page not found", "This page didn't load",
      "Keep this letter", "let this letter go? it won't be kept anywhere — that's a true goodbye.",
      "Two-minute check-in", "Breathe",
      "was this helpful?",
    ]) {
      assert.ok(HI_TEXT[k] !== undefined, `no Hindi: ${k}`);
    }
  });
  it("the 14 daily check-in prompts all have Hindi", () => {
    const promptLines = [...files.reminder.matchAll(/^\s*"([A-Z][^"\\]{10,})",?\s*$/gm)].map((m) => m[1]);
    const prompts = promptLines.filter((p) => HI_TEXT[p] !== undefined || /[?.]$/.test(p));
    assert.ok(prompts.length >= 10, `expected the PROMPTS array, found ${prompts.length}`);
    for (const p of prompts) assert.ok(HI_TEXT[p] !== undefined, `prompt has no Hindi: ${p}`);
  });
});

describe("edges: feedback/rating VALUES stay English (display-only)", () => {
  it("HelpfulnessPrompt stores English ids, translates only labels", () => {
    // rating + reason ids are the stored keys; the display goes through tx(lang, label)
    for (const id of ["felt_too_generic", "did_not_understand_me", "too_clinical", "a_little", "not_really"]) {
      assert.match(files.helpful, new RegExp(`"${id}"`), `stored id "${id}" missing`);
    }
    assert.ok(!/id:\s*"[^"]*[ऀ-ॿ]/.test(files.helpful), "a stored id was translated into Devanagari");
  });
});
