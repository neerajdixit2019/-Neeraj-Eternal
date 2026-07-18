import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fnv1a, parkingLineFor, parkedEntry, PARKING_LINES } from "../wind-down.ts";
import { HI_TEXT } from "../i18n-strings.ts";

describe("wind-down: the worry reframe", () => {
  it("fnv1a is deterministic and unsigned", () => {
    assert.equal(fnv1a("exam tomorrow"), fnv1a("exam tomorrow"));
    assert.ok(fnv1a("a") >= 0 && fnv1a("a") <= 0xffffffff);
    assert.notEqual(fnv1a("exam"), fnv1a("exams"));
  });

  it("the same worry always parks to the same line — never random", () => {
    const w = "I said the wrong thing today";
    assert.equal(parkingLineFor(w), parkingLineFor(w));
    // whitespace/case don't change the parking line
    assert.equal(parkingLineFor(w), parkingLineFor(`  ${w.toUpperCase()}  `));
  });

  it("every parking line is a real, honest reframe (in the set)", () => {
    for (const seed of ["money", "a fight with mum", "the interview", "nothing really"]) {
      assert.ok(PARKING_LINES.includes(parkingLineFor(seed)));
    }
  });

  it("no parking line pretends the worry is solved or scolds", () => {
    for (const l of PARKING_LINES) {
      assert.ok(!/solved|fixed it|calm down|stop worrying/i.test(l), `line reassures wrongly: ${l}`);
      assert.ok(/morning|tomorrow|wait|keep|now/i.test(l), `line must defer, not dismiss: ${l}`);
    }
  });

  it("a parked worry is saved legibly, not disguised as a resolved reflection", () => {
    assert.equal(parkedEntry("  the deadline  "), "Parked till morning: the deadline");
  });
});

describe("wind-down: the whole room speaks both languages", () => {
  const src = readFileSync("src/routes/_app.wind-down.tsx", "utf-8");

  it("EVERY tx() string in the room has a Hindi translation", () => {
    // Scan the source for every tx(lang, "...") literal — so a new string
    // added without its Hindi fails the gate, not just a hand-kept list.
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 15, `expected the room's many strings, found ${found.length}`);
    for (const k of found) {
      // parkedLine is a variable (a PARKING_LINES value), covered separately
      if (k.startsWith("Parked till morning")) continue;
      assert.ok(HI_TEXT[k] !== undefined, `"${k}" is tx-wrapped but has no Hindi`);
    }
  });

  it("all four parking-line reframes have Hindi", () => {
    for (const l of PARKING_LINES) {
      assert.ok(HI_TEXT[l], `parking line missing Hindi: ${l}`);
    }
  });
});
