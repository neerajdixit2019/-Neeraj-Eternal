import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const insights = readFileSync("src/routes/_app.insights.tsx", "utf-8");
const pattern = readFileSync("src/routes/_app.pattern.$tag.tsx", "utf-8");

function txLiterals(s: string): string[] {
  return [...s.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
    .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
}

describe("insights: every tx() literal has Hindi", () => {
  it("insights.tsx — all wrapped strings translate", () => {
    const found = txLiterals(insights);
    assert.ok(found.length >= 60, `expected the insights chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `insights: "${k}" wrapped but no Hindi`);
  });
  it("pattern.$tag.tsx — all wrapped strings translate", () => {
    const found = txLiterals(pattern);
    assert.ok(found.length >= 15, `expected the pattern-detail chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `pattern: "${k}" wrapped but no Hindi`);
  });
});

describe("insights: the readings are lang-threaded (not left English)", () => {
  it("engine string-functions receive lang at their call sites", () => {
    assert.match(insights, /skyReading\([^)]*lang/, "skyReading not passed lang");
    assert.match(insights, /timelineSummary\([^)]*lang/, "timelineSummary not passed lang");
    assert.match(insights, /changeSignals\([^)]*lang/, "changeSignals not passed lang");
    assert.match(insights, /weekdayRhythm\([^)]*lang/, "weekdayRhythm not passed lang");
    assert.match(insights, /describeMix\([^)]*lang/, "describeMix not passed lang");
    assert.match(insights, /innermateContext\([^)]*lang/, "innermateContext not passed lang");
    assert.match(insights, /WEIGHT_WORD\([^)]*lang/, "WEIGHT_WORD not passed lang");
    // tags rendered through tagLabel, not raw
    assert.match(insights, /tagLabel\(/, "tags not routed through tagLabel");
  });
});

describe("insights: stored tag VALUES stay English (display-only)", () => {
  it("the /pattern route param carries the raw English tag, never a translated one", () => {
    // Every Link to the detail page must pass the English tag as the param.
    assert.match(insights, /params=\{\{\s*tag:/, "pattern route param present");
    // No tagLabel(...) inside a params={{ tag: ... }} — that would corrupt the route key.
    assert.ok(!/params=\{\{\s*tag:\s*tagLabel/.test(insights), "route param must be the English tag, not tagLabel()");
    assert.ok(!/params=\{\{\s*tag:\s*tagLabel/.test(pattern), "route param must be the English tag, not tagLabel()");
  });
});
