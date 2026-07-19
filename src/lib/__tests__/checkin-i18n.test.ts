import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";

const src = readFileSync("src/routes/_app.checkin.tsx", "utf-8");

// ── The stored vocabulary, mirrored from _app.checkin.tsx ──
// These are DISPLAYED via tx(lang, …) but STORED in English. room-state.ts and
// the Insights constellation key off these exact tags (lower-cased), so they
// must never change — only their display translates.
const STATE_LABELS = [
  "Overwhelmed", "Anxious", "Heavy", "Angry", "Lonely",
  "Numb", "Confused", "Calm", "Hopeful", "Grateful",
];
const TRIGGERS = ["Work", "Relationship", "Family", "Health", "Money", "Memories", "Sleep", "Future"];
const HEART_VALUES = [
  "Fear of failure", "Uncertainty", "Need for control",
  "Too much at once", "No room to rest",
  "Feeling unseen", "Missing someone", "Need for reassurance",
  "Feeling ignored", "Something unfair", "A crossed boundary",
  "Guilt or regret", "Past memories", "Low self-worth",
  "Running on empty", "Avoiding something", "Nothing feels mine",
  "Mixed feelings", "A decision I'm carrying",
  "Fear of losing someone", "Something else",
];
const NEED_LABELS = ["Calm", "Clarity", "Just listen", "A next step", "Stop an impulse", "Just save this"];
const NEED_LINES = [
  "help my body settle first", "help me think this through", "be here with me, no fixing",
  "help me decide what to do", "before I text or react", "putting it down is enough",
];

describe("check-in: bilingual from the first breath", () => {
  it("wires the language layer (useLang + tx)", () => {
    assert.ok(src.includes("useLang"), "check-in must read the current language");
    assert.ok(/import \{ tx \} from "@\/lib\/i18n-strings"/.test(src), "tx must be imported");
    assert.ok(src.includes("const lang = useLang()"), "lang must be resolved in the component");
  });

  it("every fixed tx() string in the room has Hindi", () => {
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 40, `expected the check-in's many strings, found ${found.length}`);
    for (const k of found) {
      assert.ok(HI_TEXT[k] !== undefined, `"${k}" is tx-wrapped but has no Hindi`);
    }
  });

  it("every mood/trigger/heart/need label a reader sees has Hindi", () => {
    // all rendered via dynamic tx(lang, s.label) / tx(lang, t) / tx(lang, h) /
    // tx(lang, n.label|n.line) — the literal scan can't reach them.
    for (const label of STATE_LABELS) assert.ok(HI_TEXT[label], `mood "${label}" missing Hindi`);
    for (const t of TRIGGERS) assert.ok(HI_TEXT[t], `trigger "${t}" missing Hindi`);
    for (const h of HEART_VALUES) assert.ok(HI_TEXT[h], `root-cause "${h}" missing Hindi`);
    for (const l of NEED_LABELS) assert.ok(HI_TEXT[l], `need label "${l}" missing Hindi`);
    for (const l of NEED_LINES) assert.ok(HI_TEXT[l], `need line "${l}" missing Hindi`);
  });
});

describe("check-in: what's stored stays English, whatever the display", () => {
  it("persists the raw English tags, never the translated labels", () => {
    // Pin the EXACT bare-identifier form — `emotions,` / `triggers,` with no
    // chained call. A regression to `emotions.map((e) => tx(lang, e))` breaks
    // this match (the identifier is no longer immediately followed by a comma),
    // where a loose src.includes("emotion_tags: emotions") would false-pass.
    assert.ok(/emotion_tags:\s*emotions,/.test(src), "emotions must be stored as the raw English array");
    assert.ok(/trigger_tags:\s*triggers,/.test(src), "triggers must be stored as the raw English array");
    // And no translation may appear anywhere in the logMood payload — catches
    // any tx() wrapping regardless of arrow-param style ((e) => vs e =>).
    const payload = src.slice(src.indexOf("await log("), src.indexOf("qc.invalidateQueries"));
    assert.ok(payload.length > 0, "found the logMood payload block");
    assert.ok(!/tx\(/.test(payload), "the stored check-in payload must not translate any value");
  });

  it("keeps the composed note's scaffolding in English (AI-readable)", () => {
    assert.ok(src.includes("`at the heart: ${hearts.join"), "note keeps English 'at the heart:' scaffolding");
    assert.ok(src.includes('`needed: ${'), "note keeps English 'needed:' scaffolding");
    assert.ok(src.includes("`one small thing: ${"), "note keeps English 'one small thing:' scaffolding");
  });

  it("mood score & heavy-arrival still derive from the English label, not the display", () => {
    assert.ok(src.includes("STATES.find((s) => s.label === e)?.score"), "score keys off English label");
    assert.ok(src.includes("STATES.find((s) => s.label === e)?.heavy"), "heavy keys off English label");
  });
});

describe("check-in: the room-that-responds contract is intact", () => {
  it("the stored mood vocabulary still contains every tag room-state.ts matches", () => {
    // room-state.ts (lines ~41-44) matches these lower-cased English tags.
    const lower = STATE_LABELS.map((s) => s.toLowerCase());
    for (const tag of ["anxious", "overwhelmed", "angry", "lonely", "heavy", "numb"]) {
      assert.ok(lower.includes(tag), `room-state tag "${tag}" must remain a real English mood label`);
    }
  });
});
