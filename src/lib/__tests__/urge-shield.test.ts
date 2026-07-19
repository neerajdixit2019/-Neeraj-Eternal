import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { releaseLineFor, RELEASE_LINES } from "../urge-shield.ts";
import { HI_TEXT } from "../i18n-strings.ts";

describe("urge-shield: the release line", () => {
  it("the same drained message always releases to the same line", () => {
    const m = "I hate that you did this to me";
    assert.equal(releaseLineFor(m), releaseLineFor(m));
    assert.equal(releaseLineFor(m), releaseLineFor(`  ${m.toUpperCase()} `));
  });

  it("always returns a real release line from the set", () => {
    for (const seed of ["", "why", "please just answer me", "forget it"]) {
      assert.ok(RELEASE_LINES.includes(releaseLineFor(seed)));
    }
  });

  it("no release line pretends the feeling is gone, or scolds", () => {
    for (const l of RELEASE_LINES) {
      assert.ok(!/calm down|shouldn't|don't feel|over it|feeling is gone/i.test(l), l);
      // it must promise the words go nowhere and aren't kept — the drain's whole point
      assert.ok(/never|nothing|no one|unsent|unsaved|going nowhere|isn't kept/i.test(l), l);
    }
  });
});

describe("urge-shield: the drain never persists or sends", () => {
  const src = readFileSync("src/routes/_app.urge-shield.tsx", "utf-8");

  it("the drained draft is cleared and never passed to save()", () => {
    // the drain discards the words; the save path (finish) is built only from
    // the reflective target/cost summary — the raw message never persists.
    assert.ok(src.includes('setDraft("")'), "the draft must be discarded on let-go");
    const finishStart = src.indexOf("const finish");
    const exitStart = src.indexOf("const exit");
    assert.ok(finishStart !== -1 && exitStart > finishStart, "finish() precedes exit()");
    const finishBody = src.slice(finishStart, exitStart);
    assert.ok(finishBody.includes("save(") , "finish() is the save path");
    assert.ok(!finishBody.includes("draft"), "the save path must not reference the drained draft");
  });
});

describe("urge-shield: the whole room speaks both languages", () => {
  const src = readFileSync("src/routes/_app.urge-shield.tsx", "utf-8");

  it("every tx() literal in the room has a Hindi translation", () => {
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 25, `expected the room's many strings, found ${found.length}`);
    for (const k of found) {
      assert.ok(HI_TEXT[k] !== undefined, `"${k}" is tx-wrapped but has no Hindi`);
    }
  });

  it("all four release lines have Hindi", () => {
    for (const l of RELEASE_LINES) assert.ok(HI_TEXT[l], `release line missing Hindi: ${l}`);
  });
});
