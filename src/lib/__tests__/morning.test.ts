import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MORNING_POSTURES,
  MORNING_LINES,
  morningLineFor,
  dayStamp,
  saveMorningPosture,
  readMorningPosture,
  clearMorningPosture,
} from "../morning.ts";
import { HI_TEXT } from "../i18n-strings.ts";

// a tiny localStorage stand-in for the node test environment
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
}

describe("morning: the opening line", () => {
  it("is deterministic per day and always in range", () => {
    for (let d = 1; d <= 31; d++) {
      const line = morningLineFor(d);
      assert.ok(MORNING_LINES.includes(line));
      assert.equal(morningLineFor(d), morningLineFor(d));
    }
  });

  it("never indexes out of bounds, even on odd inputs", () => {
    for (const d of [0, -1, 100, 366]) {
      assert.ok(MORNING_LINES.includes(morningLineFor(d)));
    }
  });
});

describe("morning: the postures are tones, not tasks", () => {
  it("offers a handful of gentle ways to meet the day", () => {
    assert.ok(MORNING_POSTURES.length >= 4 && MORNING_POSTURES.length <= 8);
  });

  it("carries no productivity, scoring, or streak language", () => {
    const all = MORNING_POSTURES.flatMap((p) => [p.key, p.echo]).join(" ");
    assert.ok(!/goal|task|productive|streak|finish|achieve|must|should/i.test(all), all);
  });
});

describe("morning: the carry is held for today, then clears", () => {
  beforeEach(installLocalStorage);

  it("returns the echo only on the same local day it was saved", () => {
    const morning = new Date("2026-07-18T07:00:00");
    saveMorningPosture("today, gently.", morning);
    assert.equal(readMorningPosture(morning), "today, gently.");
    // same day, later — still there
    assert.equal(readMorningPosture(new Date("2026-07-18T20:00:00")), "today, gently.");
    // next day — gone, no debt
    assert.equal(readMorningPosture(new Date("2026-07-19T07:00:00")), null);
  });

  it("dayStamp is the local calendar day, not UTC", () => {
    // late-evening local time must still read as that day
    assert.equal(dayStamp(new Date("2026-07-18T23:30:00")), "2026-07-18");
  });

  it("reads null when nothing is stored, and after clearing", () => {
    const now = new Date("2026-07-18T07:00:00");
    assert.equal(readMorningPosture(now), null);
    saveMorningPosture("steady, today — no need to rush.", now);
    clearMorningPosture();
    assert.equal(readMorningPosture(now), null);
  });

  it("survives a corrupt stored value", () => {
    globalThis.localStorage.setItem("mqs-morning", "{not json");
    assert.equal(readMorningPosture(new Date()), null);
  });
});

describe("morning: bilingual", () => {
  const strings = readFileSync("src/lib/i18n-strings.ts", "utf-8");
  it("every posture key and echo, and every opening line, has Hindi", () => {
    for (const p of MORNING_POSTURES) {
      assert.ok(HI_TEXT[p.key], `posture "${p.key}" missing Hindi`);
      assert.ok(HI_TEXT[p.echo], `echo "${p.echo}" missing Hindi`);
    }
    for (const l of MORNING_LINES) {
      assert.ok(HI_TEXT[l], `opening line missing Hindi: ${l}`);
    }
    assert.ok(strings.length > 0);
  });

  it("every fixed UI string in the room has Hindi too", () => {
    const UI = [
      "the first light · a gentle start",
      "How do you want to meet today?",
      "Pick a way, or write your own. It's a tone, not a task — nothing to keep or prove.",
      "in my own words",
      "today, I want to be…",
      "carry it",
      "not now",
      "Carried. It'll wait quietly on Today, just for you, and let go by tomorrow.",
      "into the day",
    ];
    for (const s of UI) assert.ok(HI_TEXT[s], `UI string missing Hindi: ${s}`);
  });
});
