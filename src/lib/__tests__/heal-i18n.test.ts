import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const list = readFileSync("src/routes/_app.heal.tsx", "utf-8");
const detail = readFileSync("src/routes/_app.heal.$slug.tsx", "utf-8");

describe("heal: fixed chrome strings have Hindi", () => {
  it("every tx() literal in both heal files has a Hindi translation", () => {
    const found = [...(list + "\n" + detail).matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 25, `expected the heal chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `"${k}" tx-wrapped but no Hindi`);
  });
});

describe("heal: the DB-sourced path CONTENT has Hindi (the practices themselves)", () => {
  // Content is DB-stored but seeded/stable; mirror the structural strings.
  const pathTitles = [
    "7-Day Heartbreak Reset", "Loneliness Support Path", "Night Calm Flow",
    "5-Day Overthinking Reset", "3-Day Social Media Comparison Reset",
  ];
  const pathDescs = [
    "A gentle week to feel, name, and slowly release what hurts.",
    "A tender path back to feeling connected — with yourself first.",
    "Soft rituals to soothe restless evenings and prepare you for sleep.",
    "Quiet the looping mind, one small ritual at a time.",
    "Step out of the comparison loop and return to your own life.",
  ];
  const themes = ["heartbreak", "loneliness", "night", "overthinking", "social"];
  it("every path title has Hindi", () => { for (const t of pathTitles) assert.ok(HI_TEXT[t], `path "${t}"`); });
  it("every path description has Hindi", () => { for (const d of pathDescs) assert.ok(HI_TEXT[d], `desc "${d.slice(0,30)}"`); });
  it("every theme label has Hindi", () => { for (const t of themes) assert.ok(HI_TEXT[t], `theme "${t}"`); });
});

describe("heal: list-page previews (first sentences) have Hindi — no mid-card English", () => {
  // Multi-sentence exercises are teased by their first sentence on the list;
  // that substring needs its own Hindi entry or the preview reverts to English.
  const previewFirstSentences = [
    "For 3 minutes, place a hand on your chest and breathe slowly.",
    "Look in the mirror for 60 seconds.",
    "Dim the lights an hour before bed.",
    "Wake gently.",
    "For one day, note every time a post makes you feel smaller.",
    "Write the exact thought running on repeat.",
  ];
  for (const p of previewFirstSentences) {
    it(`preview: "${p.slice(0, 30)}…"`, () => assert.ok(HI_TEXT[p], `preview "${p}" missing Hindi`));
  }
});

describe("heal: therapeutic Hindi stays gender-neutral about the user", () => {
  it("no user-gendered participle in the sampled exercises/prompts", () => {
    const keys = [
      "Write five things you are proud of that have nothing to do with them.",
      "Pick the smallest possible next action and do only that.",
      "Which of these needs can I begin to meet for myself?",
      "What did I survive today that deserves to be acknowledged?",
    ];
    for (const k of keys) {
      const hi = HI_TEXT[k] ?? "";
      assert.ok(hi.length > 0, `missing Hindi for "${k.slice(0,30)}"`);
      for (const bad of ["करता हूँ", "करती हूँ", "रहा हूँ", "रही हूँ", "सकता हूँ", "सकती हूँ", "करते हैं"]) {
        assert.ok(!hi.includes(bad), `"${bad}" (user-gendered) in: ${k.slice(0, 34)}…`);
      }
    }
  });
});
