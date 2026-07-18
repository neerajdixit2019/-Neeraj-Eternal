import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  daysAway,
  latestActivityMs,
  returnStateFor,
  isReturning,
  RETURN_THRESHOLDS,
} from "../return-state.ts";

const NOW = new Date("2026-07-18T20:00:00Z").getTime();
const daysAgo = (d: number) => NOW - d * 86_400_000;

describe("return-state: measuring the gap", () => {
  it("a future timestamp (clock skew) reads as zero, never negative", () => {
    assert.equal(daysAway(NOW + 86_400_000, NOW), 0);
  });

  it("no history is a gap of zero", () => {
    assert.equal(daysAway(null, NOW), 0);
  });

  it("counts whole days away", () => {
    assert.equal(daysAway(daysAgo(5), NOW), 5);
    assert.equal(daysAway(daysAgo(0.5), NOW), 0);
  });
});

describe("return-state: the newest sign of the reader", () => {
  it("picks the most recent valid timestamp", () => {
    const ms = latestActivityMs([daysAgoISO(10), daysAgoISO(2), daysAgoISO(40)]);
    assert.equal(ms, daysAgo(2));
  });

  it("ignores blanks and invalid dates", () => {
    assert.equal(latestActivityMs([null, undefined, "", "not-a-date"]), null);
    assert.equal(latestActivityMs([null, daysAgoISO(3), "nonsense"]), daysAgo(3));
  });

  it("is null when there is no history at all", () => {
    assert.equal(latestActivityMs([]), null);
  });
});

function daysAgoISO(d: number) {
  return new Date(NOW - d * 86_400_000).toISOString();
}

describe("return-state: honouring absence, never scoring it", () => {
  it("a first-timer with no history is present, not returning", () => {
    const s = returnStateFor(null, NOW);
    assert.equal(s, "present");
    assert.equal(isReturning(s), false);
  });

  it("a couple of days away is still just present — a gap is nothing", () => {
    assert.equal(returnStateFor(daysAgo(2), NOW), "present");
  });

  it("crosses into a soft welcome at the stepped-away threshold", () => {
    assert.equal(returnStateFor(daysAgo(RETURN_THRESHOLDS.steppedAway), NOW), "stepped_away");
    assert.equal(returnStateFor(daysAgo(RETURN_THRESHOLDS.steppedAway - 1), NOW), "present");
  });

  it("a week or so earns 'been a while'", () => {
    assert.equal(returnStateFor(daysAgo(RETURN_THRESHOLDS.beenAWhile), NOW), "been_a_while");
    assert.equal(returnStateFor(daysAgo(14), NOW), "been_a_while");
  });

  it("a month or more earns the fullest 'still yours'", () => {
    assert.equal(returnStateFor(daysAgo(RETURN_THRESHOLDS.longAway), NOW), "long_away");
    assert.equal(returnStateFor(daysAgo(120), NOW), "long_away");
  });

  it("the thresholds climb in order", () => {
    assert.ok(RETURN_THRESHOLDS.steppedAway < RETURN_THRESHOLDS.beenAWhile);
    assert.ok(RETURN_THRESHOLDS.beenAWhile < RETURN_THRESHOLDS.longAway);
  });

  it("isReturning is true for every away-state and only those", () => {
    assert.equal(isReturning("present"), false);
    for (const s of ["stepped_away", "been_a_while", "long_away"] as const) {
      assert.equal(isReturning(s), true);
    }
  });
});

describe("return-state: wired into Home, honestly", () => {
  const home = readFileSync("src/routes/_app.home.tsx", "utf-8");
  const strings = readFileSync("src/lib/i18n-strings.ts", "utf-8");

  it("Home computes the state from real activity and renders the note", () => {
    assert.ok(home.includes("returnStateFor") && home.includes("latestActivityMs"), "must derive from activity");
    assert.ok(home.includes("isReturning(returning) && <ReturningNote"), "the note must be gated on isReturning");
  });

  it("freezes only after EVERY activity source has loaded (no false 'away')", () => {
    // convs feeds the gap, so the freeze must wait for it too — else a reader
    // active only in InnerMate is wrongly told they've been away.
    assert.match(home, /m === undefined \|\| j === undefined \|\| convs === undefined/,
      "the freeze guard must wait for moods, journal AND conversations");
  });

  it("every away-state has copy, and none of it counts what was missed", () => {
    const m = home.match(/RETURNING_COPY[\s\S]*?\n\};/);
    assert.ok(m, "the copy map must exist");
    const copy = m![0];
    for (const s of ["stepped_away", "been_a_while", "long_away"]) {
      assert.ok(copy.includes(s), `missing copy for ${s}`);
    }
    // no backlog, no streak, no count of skipped days
    assert.ok(!/missed|streak|\bdays? in a row\b|catch up on \d/i.test(copy), "copy must not scold or score absence");
    assert.ok(/nothing to catch up on|No backlog/i.test(copy), "copy must reassure there's nothing to catch up on");
  });

  it("the note's copy is offered in Hindi too", () => {
    assert.ok(strings.includes("पन्ना इंतज़ार करता रहा"), "the waiting-page line needs its Hindi");
    assert.ok(strings.includes("फिर से स्वागत है"), "the welcome-back line needs its Hindi");
  });
});
