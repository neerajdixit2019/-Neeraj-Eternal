import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HI_TEXT } from "../i18n-strings.ts";
import { weekSentence } from "../week-sentence.ts";

const src = readFileSync("src/routes/_app.you.tsx", "utf-8");

describe("you: every chrome string has Hindi", () => {
  it("every tx() literal on the page has a Hindi translation", () => {
    const found = [...src.matchAll(/tx\(lang,\s*"((?:[^"\\]|\\.)*)"\)/g)]
      .map((m) => m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    assert.ok(found.length >= 20, `expected the You-hub chrome, found ${found.length}`);
    for (const k of found) assert.ok(HI_TEXT[k] !== undefined, `"${k}" tx-wrapped but no Hindi`);
  });
});

describe("you: the honest-week sentence in Hindi", () => {
  const hi = (w: { daysShowedUp: number; checkins: number; pages: number }) => weekSentence(w, "hi");

  it("empty week → the 'just beginning' line, in Hindi", () => {
    const s = hi({ daysShowedUp: 0, checkins: 0, pages: 0 });
    assert.ok(/[ऀ-ॿ]/.test(s), "Devanagari");
    assert.ok(s.includes("पहला पन्ना"), "the beginning line");
  });

  it("singular day/page/check-in agree (एक दिन बीता / एक पन्ना / एक बार)", () => {
    const s = hi({ daysShowedUp: 1, checkins: 1, pages: 1 });
    assert.ok(s.includes("एक दिन आपके साथ बीता"), `days-singular: ${s}`);
    assert.ok(s.includes("एक पन्ना रखा गया"), `page-singular: ${s}`);
    assert.ok(s.includes("एक बार"), `checkin-singular: ${s}`);
  });

  it("plural counts use Hindi number-words (तीन दिन बीते / दो पन्ने)", () => {
    const s = hi({ daysShowedUp: 3, checkins: 2, pages: 2 });
    assert.ok(s.includes("तीन दिन आपके साथ बीते"), `days-plural: ${s}`);
    assert.ok(s.includes("दो पन्ने रखे गए"), `pages-plural: ${s}`);
    assert.ok(s.includes("दो बार"), `checkins-plural: ${s}`);
    assert.ok(s.endsWith("।"), "ends with danda");
  });

  it("days-only week (no pages, no check-ins) is a clean single clause", () => {
    const s = hi({ daysShowedUp: 2, checkins: 0, pages: 0 });
    assert.ok(s.includes("दो दिन आपके साथ बीते"), s);
    assert.ok(!s.includes("पन्ने") && !s.includes("बार"), "no empty clauses");
  });

  it("NEVER genders the user, for any count combination", () => {
    // The verbs must agree with दिन/पन्ने/हाल (nouns), never with the reader.
    const banned = ["आए", "आईं", "लौटे", "लौटीं", "रखे आपने", "किया आपने", "बीते आप"];
    for (let d = 0; d <= 7; d++) for (const c of [0, 1, 3]) for (const p of [0, 1, 2]) {
      const s = hi({ daysShowedUp: d, checkins: c, pages: p });
      for (const b of banned) assert.ok(!s.includes(b), `"${b}" (gendered) in: ${s}`);
    }
  });

  it("English default is unchanged (regression)", () => {
    const en = weekSentence({ daysShowedUp: 3, checkins: 2, pages: 2 }, "en");
    assert.ok(en.includes("you came back three days this week"), en);
  });
});
